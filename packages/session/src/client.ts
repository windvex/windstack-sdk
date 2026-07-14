import {
  WISP_ERROR_CODES,
  WispProviderError,
  resolveDappMetadata,
  resolveDappRequestContext,
  type WispScope,
  type WispSession,
} from "@windstack/core";
import { createEVMClient, type EVMClient } from "@windstack/evm";
import { createSolanaClient, type SolanaClient } from "@windstack/solana";
import {
  createVexaniumClient,
  sameVexaniumChain,
  VEXANIUM_METHODS,
  type VexaniumClient,
} from "@windstack/vexanium";
import { createSessionId, isEVMScope, isSolanaScope, isVexaniumScope } from "./scopes.js";
import type { WispInvokeArgs, WispSessionClient, WispSessionClientOptions } from "./types.js";

function withWalletSessionParams<TParams>(params: TParams | undefined, walletSessionId?: string): TParams | undefined {
  if (!walletSessionId) return params;
  if (typeof params === "object" && params !== null && !Array.isArray(params)) {
    return { ...params, sessionId: (params as { sessionId?: string }).sessionId ?? walletSessionId } as TParams;
  }
  if (params === undefined) return { sessionId: walletSessionId } as TParams;
  return params;
}

const WALLET_SESSION_METHODS = new Set<string>([
  VEXANIUM_METHODS.SIGNING_REQUEST,
  VEXANIUM_METHODS.SIGN_MESSAGE,
  VEXANIUM_METHODS.SIGN_DIGEST,
  VEXANIUM_METHODS.SIGN_TRANSACTION,
  VEXANIUM_METHODS.DISCONNECT,
]);

function assertRequestedScopes(scopes: WispScope[]): void {
  if (scopes.length === 0) {
    throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, "At least one wallet scope is required");
  }
  if (!scopes.every((scope) => isEVMScope(scope) || isSolanaScope(scope) || isVexaniumScope(scope))) {
    throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, "One or more wallet scopes are invalid");
  }
  const families = [isEVMScope, isSolanaScope, isVexaniumScope];
  if (families.some((isFamily) => scopes.filter(isFamily).length > 1)) {
    throw new WispProviderError(
      WISP_ERROR_CODES.INVALID_PARAMS,
      "Only one scope per chain family can be connected in a session",
    );
  }
}

function evmScopeFromHexChainId(chainId: string): `eip155:${number}` {
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(chainId)) {
    throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, `Provider returned invalid EVM chain ID: ${chainId}`);
  }
  return `eip155:${BigInt(chainId).toString()}` as `eip155:${number}`;
}

function cloneWispSession(value: WispSession | null): WispSession | null {
  if (!value) return null;
  return {
    ...value,
    dapp: {
      ...value.dapp,
      icons: value.dapp.icons ? [...value.dapp.icons] : undefined,
    },
    scopes: [...value.scopes],
    accounts: value.accounts.map((account) => ({ ...account })),
  };
}

export async function createWispSessionClient(options: WispSessionClientOptions = {}): Promise<WispSessionClient> {
  const dapp = resolveDappMetadata(options.dapp);
  const requestContext = resolveDappRequestContext();
  let evmClient: EVMClient | undefined = options.evm;
  let solanaClient: SolanaClient | undefined = options.solana;
  let vexaniumClient: VexaniumClient | undefined = options.vexanium;
  let session: WispSession | null = null;

  const getEVMClient = async () => {
    evmClient = evmClient ?? await createEVMClient();
    return evmClient;
  };

  const getSolanaClient = async () => {
    solanaClient = solanaClient ?? await createSolanaClient();
    return solanaClient;
  };

  const getVexaniumClient = async () => {
    vexaniumClient = vexaniumClient ?? await createVexaniumClient({ dapp });
    return vexaniumClient;
  };

  const disconnectClients = async (): Promise<void> => {
    await Promise.allSettled([
      evmClient?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }),
      solanaClient?.disconnect(),
      vexaniumClient?.disconnect(),
    ]);
  };

  return {
    async connect(scopes: WispScope[]): Promise<WispSession> {
      const uniqueScopes = [...new Set(scopes)];
      assertRequestedScopes(uniqueScopes);
      if (session) {
        throw new WispProviderError(WISP_ERROR_CODES.REQUEST_PENDING, "A Wisp session is already active");
      }
      const accounts: WispSession["accounts"] = [];

      try {
        const evmScope = uniqueScopes.find(isEVMScope);
        if (evmScope) {
          const client = await getEVMClient();
          const evmAccounts = await client.connect();
          const activeScope = evmScopeFromHexChainId(await client.getChainId());
          if (activeScope !== evmScope) {
            throw new WispProviderError(
              WISP_ERROR_CODES.INVALID_PARAMS,
              `EVM provider is connected to ${activeScope}, not requested scope ${evmScope}`,
            );
          }
          for (const address of evmAccounts) accounts.push({ scope: evmScope, address });
        }

        const solanaScope = uniqueScopes.find(isSolanaScope);
        if (solanaScope) {
          const client = await getSolanaClient();
          const solanaAccounts = await client.connect();
          for (const account of solanaAccounts) {
            accounts.push({ scope: solanaScope, address: account.publicKey, label: account.label });
          }
        }

        const vexaniumScope = uniqueScopes.find(isVexaniumScope);
        if (vexaniumScope) {
          const client = await getVexaniumClient();
          const vexaniumAccounts = await client.connect({ chainId: vexaniumScope, dapp });
          const vexaniumSession = client.getSession();
          if (!vexaniumSession || !sameVexaniumChain(vexaniumSession.chainId, vexaniumScope)) {
            throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, "Vexanium provider returned the wrong chain");
          }
          for (const account of vexaniumAccounts) {
            accounts.push({ scope: vexaniumScope, address: account.permissionLevel, label: account.label });
          }
        }
      } catch (error) {
        await disconnectClients();
        throw error;
      }

      if (accounts.length === 0) {
        await disconnectClients();
        throw new WispProviderError(WISP_ERROR_CODES.UNAUTHORIZED, "No wallet accounts were authorized");
      }

      const now = Date.now();
      session = {
        id: createSessionId(uniqueScopes),
        dapp,
        origin: requestContext.origin,
        scopes: uniqueScopes,
        accounts,
        createdAt: now,
        updatedAt: now,
      };

      return cloneWispSession(session)!;
    },

    getSession() {
      return cloneWispSession(session);
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
        const client = await getVexaniumClient();
        const walletSessionId = client.getSession()?.walletSessionId;
        const request = WALLET_SESSION_METHODS.has(args.request.method)
          ? { ...args.request, params: withWalletSessionParams(args.request.params, walletSessionId) }
          : args.request;
        return await client.request<TResult, TParams>(request as typeof args.request);
      }

      throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, `Unsupported scope: ${args.scope}`);
    },

    async disconnect() {
      await disconnectClients();
      session = null;
    },
  };
}
