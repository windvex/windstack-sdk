import {
  WISP_ERROR_CODES,
  WispProviderError,
  getRuntimeWindow,
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
  VexaniumClientEventMap,
  VexaniumClientOptions,
  VexaniumClientSessionChangeReason,
  VexaniumConnectParams,
  VexaniumConnectResponse,
  VexaniumDappSession,
  VexaniumProvider,
  VexaniumProviderEventMap,
  VexaniumSessionSyncOptions,
  VexSignMessageParams,
  VexSignTransactionParams,
  VsrSigningRequestParams,
  VsrSigningRequestResult,
} from "./types.js";

const DEFAULT_CHAIN_ID: VexaniumChainId = VEXANIUM_MAINNET_CHAIN_ID;

const DEFAULT_SYNC_OPTIONS: Required<VexaniumSessionSyncOptions> = {
  providerEvents: true,
  windowFocus: true,
  visibilityChange: true,
};

type Listener<TPayload> = (payload: TPayload) => void;
type ClientListenerStore = Map<keyof VexaniumClientEventMap, Set<Listener<VexaniumClientEventMap[keyof VexaniumClientEventMap]>>>;

type SessionMutation = {
  accounts: VexaniumAccount[];
  chainId: VexaniumChainId;
  sessionId?: string;
  dapp?: DappMetadata;
  reason: VexaniumClientSessionChangeReason;
};

function createLocalSessionId(dapp: DappMetadata, chainId: VexaniumChainId, account: VexaniumAccount): string {
  const entropy = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `vex:${dapp.origin}:${chainId}:${account.permissionLevel}:${entropy}`;
}

function extractAccountsPayload(payload: VexaniumConnectResponse | unknown): unknown[] {
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

function extractSessionId(payload: unknown): string | undefined {
  const source = firstObjectPayload(payload);
  const sessionId = source?.sessionId;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : undefined;
}

function extractChainId(payload: unknown): VexaniumChainId | undefined {
  const source = firstObjectPayload(payload);
  const chainId = source?.chainId;
  return typeof chainId === "string" && chainId.trim() ? chainId.trim() as VexaniumChainId : undefined;
}

function compactParams<T extends Record<string, unknown>>(params: T): T {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as T;
}

function normalizeSyncOptions(value: VexaniumClientOptions["autoSync"]): Required<VexaniumSessionSyncOptions> {
  if (value === false) {
    return { providerEvents: false, windowFocus: false, visibilityChange: false };
  }
  if (value === true || value === undefined) return DEFAULT_SYNC_OPTIONS;
  return { ...DEFAULT_SYNC_OPTIONS, ...value };
}

function addClientListener<TEvent extends keyof VexaniumClientEventMap>(
  listeners: ClientListenerStore,
  event: TEvent,
  handler: Listener<VexaniumClientEventMap[TEvent]>,
): void {
  const current = listeners.get(event) ?? new Set<Listener<VexaniumClientEventMap[keyof VexaniumClientEventMap]>>();
  current.add(handler as Listener<VexaniumClientEventMap[keyof VexaniumClientEventMap]>);
  listeners.set(event, current);
}

function removeClientListener<TEvent extends keyof VexaniumClientEventMap>(
  listeners: ClientListenerStore,
  event: TEvent,
  handler: Listener<VexaniumClientEventMap[TEvent]>,
): void {
  listeners.get(event)?.delete(handler as Listener<VexaniumClientEventMap[keyof VexaniumClientEventMap]>);
}

function emitClientEvent<TEvent extends keyof VexaniumClientEventMap>(
  listeners: ClientListenerStore,
  event: TEvent,
  payload: VexaniumClientEventMap[TEvent],
): void {
  const current = listeners.get(event);
  if (!current) return;
  for (const handler of [...current]) handler(payload as VexaniumClientEventMap[keyof VexaniumClientEventMap]);
}

export async function createVexaniumClient(options: VexaniumClientOptions = {}): Promise<VexaniumClient> {
  let provider: VexaniumProvider | null = options.provider ?? await getVexaniumProvider(options.discoveryTimeoutMs);
  const dapp = resolveDappMetadata(options.dapp);
  const listeners: ClientListenerStore = new Map();
  const syncOptions = normalizeSyncOptions(options.autoSync);
  const cleanupCallbacks = new Set<() => void>();
  let session: VexaniumDappSession | null = null;
  let syncInFlight: Promise<VexaniumAccount[]> | null = null;
  let destroyed = false;

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

  const emitSessionChanged = (reason: VexaniumClientSessionChangeReason): void => {
    emitClientEvent(listeners, "sessionChanged", {
      session,
      accounts: session?.accounts ?? [],
      reason,
    });
  };

  const updateSession = ({ accounts, chainId, sessionId, dapp: nextDapp, reason }: SessionMutation): VexaniumAccount[] => {
    if (accounts[0]) {
      const now = Date.now();
      const sessionDapp = nextDapp ?? session?.dapp ?? dapp;
      session = {
        id: sessionId ?? session?.id ?? createLocalSessionId(sessionDapp, chainId, accounts[0]),
        dapp: sessionDapp,
        origin: session?.origin ?? sessionDapp.origin,
        chainId,
        accounts,
        createdAt: session?.createdAt ?? now,
        updatedAt: now,
      };
    } else {
      session = null;
    }
    emitSessionChanged(reason);
    return accounts;
  };

  const clearSession = (reason: VexaniumClientSessionChangeReason): void => {
    if (!session) {
      emitSessionChanged(reason);
      return;
    }
    session = null;
    emitSessionChanged(reason);
  };

  const getChain = async (): Promise<VexaniumChainId> => {
    return await request<VexaniumChainId>({ method: VEXANIUM_METHODS.GET_CHAIN });
  };

  const syncAccounts = async (): Promise<VexaniumAccount[]> => {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      const rawResponse = await request<VexaniumConnectResponse>({ method: VEXANIUM_METHODS.GET_ACCOUNTS });
      const chainId = extractChainId(rawResponse) ?? session?.chainId ?? await getChain().catch(() => DEFAULT_CHAIN_ID);
      const accounts = normalizeVexaniumAccounts(extractAccountsPayload(rawResponse), chainId);
      return updateSession({
        accounts,
        chainId,
        sessionId: extractSessionId(rawResponse),
        reason: "sync",
      });
    })().finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  };

  const getAccounts = async (): Promise<VexaniumAccount[]> => syncAccounts();

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
    return updateSession({
      accounts,
      chainId,
      sessionId: extractSessionId(rawResponse) ?? params.sessionId,
      dapp: requestDapp,
      reason: "connect",
    });
  };

  const handleConnect = (payload: VexaniumProviderEventMap["connect"]): void => {
    const chainId = payload?.chainId ?? session?.chainId ?? DEFAULT_CHAIN_ID;
    const accounts = normalizeVexaniumAccounts(extractAccountsPayload(payload), chainId);
    updateSession({ accounts, chainId, reason: "connect" });
    emitClientEvent(listeners, "connect", { chainId, accounts });
  };

  const handleAccountsChanged = (payload: VexaniumProviderEventMap["accountsChanged"] | unknown): void => {
    const chainId = extractChainId(payload) ?? session?.chainId ?? DEFAULT_CHAIN_ID;
    const accounts = normalizeVexaniumAccounts(extractAccountsPayload(payload), chainId);
    updateSession({ accounts, chainId, reason: "accountsChanged" });
    emitClientEvent(listeners, "accountsChanged", accounts);
  };

  const handleChainChanged = (payload: VexaniumProviderEventMap["chainChanged"] | unknown): void => {
    const chainId = extractChainId(payload) ?? (typeof payload === "string" ? payload : undefined) ?? session?.chainId ?? DEFAULT_CHAIN_ID;
    if (session) {
      session = {
        ...session,
        chainId,
        accounts: session.accounts.map((account) => ({ ...account, chainId })),
        updatedAt: Date.now(),
      };
      emitSessionChanged("chainChanged");
    }
    emitClientEvent(listeners, "chainChanged", chainId);
  };

  const handleDisconnect = (payload: VexaniumProviderEventMap["disconnect"]): void => {
    clearSession("disconnect");
    emitClientEvent(listeners, "accountsChanged", []);
    emitClientEvent(listeners, "disconnect", payload ?? { code: 4900, message: "Disconnected" });
  };

  const bindProviderEvents = (): void => {
    const current = provider;
    if (!current?.on) return;
    current.on("connect", handleConnect);
    current.on("accountsChanged", handleAccountsChanged as (payload: VexaniumProviderEventMap["accountsChanged"]) => void);
    current.on("chainChanged", handleChainChanged);
    current.on("disconnect", handleDisconnect);
    const cleanup = () => {
      if (current.off) {
        current.off("connect", handleConnect);
        current.off("accountsChanged", handleAccountsChanged as (payload: VexaniumProviderEventMap["accountsChanged"]) => void);
        current.off("chainChanged", handleChainChanged);
        current.off("disconnect", handleDisconnect);
        return;
      }
      current.removeListener?.("connect", handleConnect);
      current.removeListener?.("accountsChanged", handleAccountsChanged as (payload: VexaniumProviderEventMap["accountsChanged"]) => void);
      current.removeListener?.("chainChanged", handleChainChanged);
      current.removeListener?.("disconnect", handleDisconnect);
    };
    cleanupCallbacks.add(cleanup);
  };

  const bindWindowSync = (): void => {
    const runtimeWindow = getRuntimeWindow();
    if (!runtimeWindow) return;

    const syncSilently = () => {
      if (destroyed) return;
      void syncAccounts().catch(() => {
        // Silent restore must never break the dApp surface.
      });
    };

    if (syncOptions.windowFocus) {
      runtimeWindow.addEventListener("focus", syncSilently);
      cleanupCallbacks.add(() => runtimeWindow.removeEventListener("focus", syncSilently));
    }

    if (syncOptions.visibilityChange && runtimeWindow.document) {
      const onVisibilityChange = () => {
        if (runtimeWindow.document.visibilityState === "visible") syncSilently();
      };
      runtimeWindow.document.addEventListener("visibilitychange", onVisibilityChange);
      cleanupCallbacks.add(() => runtimeWindow.document.removeEventListener("visibilitychange", onVisibilityChange));
    }
  };

  if (syncOptions.providerEvents) bindProviderEvents();
  bindWindowSync();

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
    syncAccounts,
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

    signDigest(digest: string, account?: string) {
      return request({
        method: VEXANIUM_METHODS.SIGN_DIGEST,
        params: compactParams({ digest, account, sessionId: session?.id, dapp: session ? undefined : dapp }),
      });
    },

    signTransaction(params: VexSignTransactionParams) {
      return request({
        method: VEXANIUM_METHODS.SIGN_TRANSACTION,
        params: compactParams({ ...params, sessionId: params.sessionId ?? session?.id, dapp: params.dapp ?? (session ? undefined : dapp) }),
      });
    },

    async disconnect() {
      try {
        await request({ method: VEXANIUM_METHODS.DISCONNECT, params: session ? { sessionId: session.id } : undefined });
      } finally {
        clearSession("disconnect");
      }
    },

    on<TEvent extends keyof VexaniumClientEventMap>(event: TEvent, handler: (payload: VexaniumClientEventMap[TEvent]) => void) {
      addClientListener(listeners, event, handler);
    },

    off<TEvent extends keyof VexaniumClientEventMap>(event: TEvent, handler: (payload: VexaniumClientEventMap[TEvent]) => void) {
      removeClientListener(listeners, event, handler);
    },

    subscribeSession(handler: (payload: VexaniumClientEventMap["sessionChanged"]) => void) {
      addClientListener(listeners, "sessionChanged", handler);
      return () => removeClientListener(listeners, "sessionChanged", handler);
    },

    destroy() {
      destroyed = true;
      for (const cleanup of [...cleanupCallbacks]) cleanup();
      cleanupCallbacks.clear();
      listeners.clear();
    },
  };
}
