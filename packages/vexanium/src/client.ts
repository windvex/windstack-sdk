import {
  WISP_ERROR_CODES,
  WispProviderError,
  normalizeProviderError,
  resolveDappMetadata,
} from "@windstack/core";
import type { DappMetadata, RequestArguments } from "@windstack/core";
import { VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_METHODS } from "./constants.js";
import { getVexaniumProvider } from "./discovery.js";
import { normalizeVexaniumAccounts } from "./accounts.js";
import type {
  VexaniumAccount,
  VexaniumChainId,
  VexaniumClient,
  VexaniumClientOptions,
  VexaniumConnectParams,
  VexaniumConnectResponse,
  VexaniumDappSession,
  VexaniumProvider,
  VexaniumProviderEventMap,
  VexSignMessageParams,
  VsrSigningRequestParams,
  VsrSigningRequestResult,
} from "./types.js";

const DEFAULT_CHAIN_ID: VexaniumChainId = VEXANIUM_MAINNET_CHAIN_ID;

function createLocalSessionId(dapp: DappMetadata, chainId: VexaniumChainId, account: VexaniumAccount): string {
  const entropy = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `vex:${dapp.origin}:${chainId}:${account.permissionLevel}:${entropy}`;
}

function extractAccountsPayload(payload: VexaniumConnectResponse): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "object" && payload !== null) {
    const source = payload as { accounts?: unknown[]; account?: unknown };
    if (Array.isArray(source.accounts)) return source.accounts;
    if (source.account) return [source.account];
  }
  return [];
}

function firstObjectPayload(payload: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" && !Array.isArray(first) ? first as Record<string, unknown> : undefined;
  }
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : undefined;
}

function extractSessionId(payload: VexaniumConnectResponse): string | undefined {
  const source = firstObjectPayload(payload);
  const sessionId = source?.sessionId;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : undefined;
}

function extractChainId(payload: VexaniumConnectResponse): VexaniumChainId | undefined {
  const source = firstObjectPayload(payload);
  const chainId = source?.chainId;
  return typeof chainId === "string" && chainId.trim() ? chainId.trim() as VexaniumChainId : undefined;
}

function compactParams<T extends Record<string, unknown>>(params: T): T {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as T;
}

export async function createVexaniumClient(options: VexaniumClientOptions = {}): Promise<VexaniumClient> {
  let provider: VexaniumProvider | null = options.provider ?? await getVexaniumProvider(options.discoveryTimeoutMs);
  const dapp = resolveDappMetadata(options.dapp);
  let session: VexaniumDappSession | null = null;

  const requireProvider = (): VexaniumProvider => {
    if (!provider?.request) {
      throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, "No Vexanium provider is available");
    }
    return provider;
  };

  const request = async <TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult> => {
    try {
      return await requireProvider().request<TResult, TParams>(args);
    } catch (error) {
      throw normalizeProviderError(error);
    }
  };

  const getChain = async (): Promise<VexaniumChainId> => {
    return await request<VexaniumChainId>({ method: VEXANIUM_METHODS.GET_CHAIN });
  };

  const getAccounts = async (): Promise<VexaniumAccount[]> => {
    const rawResponse = await request<VexaniumConnectResponse>({ method: VEXANIUM_METHODS.GET_ACCOUNTS });
    const chainId = extractChainId(rawResponse) ?? session?.chainId ?? await getChain().catch(() => DEFAULT_CHAIN_ID);
    const accounts = normalizeVexaniumAccounts(extractAccountsPayload(rawResponse), chainId);
    if (accounts[0]) {
      const now = Date.now();
      session = {
        id: extractSessionId(rawResponse) ?? session?.id ?? createLocalSessionId(dapp, chainId, accounts[0]),
        dapp: session?.dapp ?? dapp,
        origin: session?.origin ?? dapp.origin,
        chainId,
        accounts,
        createdAt: session?.createdAt ?? now,
        updatedAt: now,
      };
    } else {
      session = null;
    }
    return accounts;
  };

  const connect = async (params: VexaniumConnectParams = {}): Promise<VexaniumAccount[]> => {
    const requestDapp = params.dapp ?? dapp;
    const requestedChainId = params.chainId;
    const rawResponse = await request<VexaniumConnectResponse, VexaniumConnectParams>({
      method: VEXANIUM_METHODS.REQUEST_ACCOUNTS,
      params: compactParams({
        dapp: requestDapp,
        chainId: requestedChainId,
        sessionId: params.sessionId,
      }),
    });
    const chainId = extractChainId(rawResponse) ?? requestedChainId ?? await getChain().catch(() => DEFAULT_CHAIN_ID);
    const accounts = normalizeVexaniumAccounts(extractAccountsPayload(rawResponse), chainId);
    if (!accounts[0]) {
      throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, "No Vexanium account was returned");
    }
    const now = Date.now();
    session = {
      id: extractSessionId(rawResponse) ?? params.sessionId ?? createLocalSessionId(requestDapp, chainId, accounts[0]),
      dapp: requestDapp,
      origin: requestDapp.origin,
      chainId,
      accounts,
      createdAt: session?.createdAt ?? now,
      updatedAt: now,
    };
    return accounts;
  };

  return {
    isAvailable() {
      return Boolean(provider?.request);
    },

    getProvider() {
      return provider;
    },

    getDappMetadata() {
      return dapp;
    },

    getSession() {
      return session;
    },

    request,

    connect,

    async connectOne(params?: VexaniumConnectParams) {
      const [account] = await connect(params);
      if (!account) {
        throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, "No Vexanium account was returned");
      }
      return account;
    },

    getAccounts,
    getChain,

    signVsr(params: VsrSigningRequestParams) {
      return request<VsrSigningRequestResult, VsrSigningRequestParams>({
        method: VEXANIUM_METHODS.SIGNING_REQUEST,
        params: compactParams({
          ...params,
          sessionId: params.sessionId ?? session?.id,
          dapp: params.dapp ?? (session ? undefined : dapp),
        }),
      });
    },

    signMessage(message: string | Uint8Array, account?: string) {
      const params: VexSignMessageParams = compactParams({
        message: typeof message === "string" ? message : Array.from(message),
        account,
        sessionId: session?.id,
        dapp: session ? undefined : dapp,
      });
      return request({ method: VEXANIUM_METHODS.SIGN_MESSAGE, params });
    },

    async disconnect() {
      await request({ method: VEXANIUM_METHODS.DISCONNECT, params: session ? { sessionId: session.id } : undefined });
      session = null;
    },

    on<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void) {
      requireProvider().on?.(event, handler);
    },

    off<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void) {
      const current = requireProvider();
      if (current.off) current.off(event, handler);
      else current.removeListener?.(event, handler);
    },
  };
}
