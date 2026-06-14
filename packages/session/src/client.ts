import {
  WISP_ERROR_CODES,
  WispProviderError,
  resolveDappMetadata,
  type WispScope,
  type WispSession,
} from "@windstack/core";
import { createEVMClient, type EVMClient } from "@windstack/evm";
import { createSolanaClient, type SolanaClient } from "@windstack/solana";
import { createVexaniumClient, VEXANIUM_METHODS, type VexaniumClient } from "@windstack/vexanium";
import { createSessionId, isEVMScope, isSolanaScope, isVexaniumScope } from "./scopes.js";
import type { WispInvokeArgs, WispSessionClient, WispSessionClientOptions } from "./types.js";

function withSessionParams<TParams>(params: TParams | undefined, session: WispSession): TParams & { sessionId: string } {
  if (typeof params === "object" && params !== null && !Array.isArray(params)) {
    return { ...params, sessionId: (params as { sessionId?: string }).sessionId ?? session.id } as TParams & { sessionId: string };
  }
  return { sessionId: session.id } as TParams & { sessionId: string };
}

export async function createWispSessionClient(options: WispSessionClientOptions = {}): Promise<WispSessionClient> {
  const dapp = resolveDappMetadata(options.dapp);
  let evmClient: EVMClient | undefined = options.evm;
  let solanaClient: SolanaClient | undefined = options.solana;
  let vexaniumClient: VexaniumClient | undefined = options.vexanium;
  let session: WispSession | null = null;

  const getEVMClient = async () => {
    evmClient = evmClient ?? await createEVMClient({ dapp });
    return evmClient;
  };

  const getSolanaClient = async () => {
    solanaClient = solanaClient ?? await createSolanaClient({ dapp });
    return solanaClient;
  };

  const getVexaniumClient = async () => {
    vexaniumClient = vexaniumClient ?? await createVexaniumClient({ dapp });
    return vexaniumClient;
  };

  return {
    async connect(scopes: WispScope[]): Promise<WispSession> {
      const uniqueScopes = [...new Set(scopes)];
      const accounts: WispSession["accounts"] = [];

      if (uniqueScopes.some(isEVMScope)) {
        const client = await getEVMClient();
        const evmAccounts = await client.connect();
        for (const scope of uniqueScopes.filter(isEVMScope)) {
          for (const address of evmAccounts) accounts.push({ scope, address });
        }
      }

      if (uniqueScopes.some(isSolanaScope)) {
        const client = await getSolanaClient();
        const solanaAccounts = await client.connect();
        for (const scope of uniqueScopes.filter(isSolanaScope)) {
          for (const account of solanaAccounts) accounts.push({ scope, address: account.publicKey, label: account.label });
        }
      }

      if (uniqueScopes.some(isVexaniumScope)) {
        const client = await getVexaniumClient();
        for (const scope of uniqueScopes.filter(isVexaniumScope)) {
          const vexaniumAccounts = await client.connect({ chainId: scope, dapp });
          const vexaniumSession = client.getSession();
          for (const account of vexaniumAccounts) accounts.push({ scope, address: account.permissionLevel, label: account.label });
          if (vexaniumSession) {
            // Prefer the wallet-provided Vexanium session id for Vexanium-only sessions.
            session = session ?? {
              id: vexaniumSession.id,
              dapp,
              origin: dapp.origin,
              scopes: uniqueScopes,
              accounts: [],
              createdAt: vexaniumSession.createdAt,
              updatedAt: vexaniumSession.updatedAt,
            };
          }
        }
      }

      const now = Date.now();
      session = {
        id: session?.id ?? createSessionId(uniqueScopes),
        dapp,
        origin: dapp.origin,
        scopes: uniqueScopes,
        accounts,
        createdAt: session?.createdAt ?? now,
        updatedAt: now,
      };

      return session;
    },

    getSession() {
      return session;
    },

    async invoke<TResult = unknown, TParams = unknown>(args: WispInvokeArgs<TParams>): Promise<TResult> {
      if (!session) {
        throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, "No active Wisp session. Call connect() first.");
      }
      if (!session.scopes.includes(args.scope)) {
        throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, `Scope is not authorized: ${args.scope}`);
      }

      if (isEVMScope(args.scope)) return await (await getEVMClient()).request<TResult, TParams>(args.request);
      if (isSolanaScope(args.scope)) return await (await getSolanaClient()).request<TResult, TParams>(args.request);
      if (isVexaniumScope(args.scope)) {
        const request = args.request.method === VEXANIUM_METHODS.SIGNING_REQUEST || args.request.method === VEXANIUM_METHODS.SIGN_MESSAGE
          ? { ...args.request, params: withSessionParams(args.request.params, session) }
          : args.request;
        return await (await getVexaniumClient()).request<TResult, TParams>(request as typeof args.request);
      }

      throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, `Unsupported scope: ${args.scope}`);
    },

    async disconnect() {
      await Promise.allSettled([
        evmClient?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }),
        solanaClient?.disconnect(),
        vexaniumClient?.disconnect(),
      ]);
      session = null;
    },
  };
}
