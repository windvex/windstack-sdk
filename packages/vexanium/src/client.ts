import {
  getRuntimeWindow,
  resolveDappMetadata,
  resolveDappRequestContext,
} from "@windstack/core";
import type { DappMetadata, RequestArguments } from "@windstack/core";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
} from "./constants.js";
import {
  VEXANIUM_ERROR_CODES,
  VexaniumProviderError,
  normalizeVexaniumProviderError,
  vexaniumUnsupportedCapability,
} from "./errors.js";
import { getVexaniumProvider, isVexaniumProvider } from "./discovery.js";
import { normalizeVexaniumAccounts } from "./accounts.js";
import { parseSigningRequest } from "./signing-request.js";
import {
  assertVexaniumCapabilitiesResponse,
  assertVexaniumConnectResponse,
  assertVexaniumProviderInfo,
} from "./standard.js";
import type {
  VexaniumAccount,
  VexaniumAccountsResponse,
  VexaniumCapabilitiesResponse,
  VexaniumCapability,
  VexaniumChainId,
  VexaniumClient,
  VexaniumClientEventMap,
  VexaniumClientOptions,
  VexaniumClientSessionChangeReason,
  VexaniumConnectParams,
  VexaniumConnectRequest,
  VexaniumConnectResponse,
  VexaniumDappSession,
  VexaniumProvider,
  VexaniumProviderEventMap,
  VexaniumSessionSyncOptions,
  VexSignDigestParams,
  VexSignMessageParams,
  VexSignTransactionParams,
  VexSignTransactionResult,
  VexSigningRequestParams,
  VexSigningRequestResult,
} from "./types.js";
import { Signature } from "@wharfkit/antelope";
import {
  isAntelopeName,
  isChecksum256,
  isHexBytes,
  isVexaniumChainId,
  isVexaniumFullChainId,
  sameVexaniumChain,
} from "./validation.js";

const DEFAULT_CONNECT_CAPABILITIES: readonly VexaniumCapability[] = [
  VEXANIUM_CAPABILITIES.ACCOUNTS,
  VEXANIUM_CAPABILITIES.SESSIONS,
];

const DEFAULT_SYNC_OPTIONS: Required<VexaniumSessionSyncOptions> = {
  providerEvents: true,
  windowFocus: true,
  visibilityChange: true,
};

const CAPABILITY_METHODS: Readonly<Record<VexaniumCapability, readonly string[]>> = {
  [VEXANIUM_CAPABILITIES.ACCOUNTS]: [
    VEXANIUM_METHODS.REQUEST_ACCOUNTS,
    VEXANIUM_METHODS.GET_ACCOUNTS,
    VEXANIUM_METHODS.GET_CHAIN,
  ],
  [VEXANIUM_CAPABILITIES.SESSIONS]: [VEXANIUM_METHODS.DISCONNECT],
  [VEXANIUM_CAPABILITIES.EXACT_TRANSACTION_SIGNING]: [VEXANIUM_METHODS.SIGN_TRANSACTION],
  [VEXANIUM_CAPABILITIES.SIGNING_REQUEST]: [VEXANIUM_METHODS.SIGNING_REQUEST],
  [VEXANIUM_CAPABILITIES.MESSAGE_SIGNING]: [VEXANIUM_METHODS.SIGN_MESSAGE],
  [VEXANIUM_CAPABILITIES.DIGEST_SIGNING]: [VEXANIUM_METHODS.SIGN_DIGEST],
  [VEXANIUM_CAPABILITIES.EVENTS]: [],
};

type Listener<TPayload> = (payload: TPayload) => void;
type ClientListenerStore = Map<
  keyof VexaniumClientEventMap,
  Set<Listener<VexaniumClientEventMap[keyof VexaniumClientEventMap]>>
>;

type SessionMutation = {
  accounts: VexaniumAccount[];
  chainId: VexaniumChainId;
  walletSessionId: string;
  dapp?: DappMetadata;
  reason: VexaniumClientSessionChangeReason;
};

function cloneDappMetadata(value: DappMetadata): DappMetadata {
  return {
    ...value,
    icons: value.icons ? [...value.icons] : undefined,
  };
}

function cloneAccounts(accounts: VexaniumAccount[]): VexaniumAccount[] {
  return accounts.map((account) => ({ ...account }));
}

function cloneSession(value: VexaniumDappSession | null): VexaniumDappSession | null {
  if (!value) return null;
  return {
    ...value,
    dapp: cloneDappMetadata(value.dapp),
    accounts: cloneAccounts(value.accounts),
  };
}

function createLocalSessionId(origin: string, chainId: VexaniumChainId, account: VexaniumAccount): string {
  const entropy = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `vex:${origin}:${chainId}:${account.permissionLevel}:${entropy}`;
}

function compactParams<T extends Record<string, unknown>>(params: T): T {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as T;
}

function normalizeSyncOptions(value: VexaniumClientOptions["autoSync"]): Required<VexaniumSessionSyncOptions> {
  if (value === false) return { providerEvents: false, windowFocus: false, visibilityChange: false };
  if (value === true || value === undefined) return DEFAULT_SYNC_OPTIONS;
  return { ...DEFAULT_SYNC_OPTIONS, ...value };
}

function assertAccountsResponse(value: unknown): asserts value is VexaniumAccountsResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as { sessionId?: unknown }).sessionId !== "string" ||
    !isVexaniumFullChainId((value as { chainId?: unknown }).chainId) ||
    !Array.isArray((value as { accounts?: unknown }).accounts)
  ) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Malformed vex_getAccounts response",
      value,
    );
  }
}

function assertValidSignatures(value: unknown, method: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string")) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      `Malformed ${method} response: expected at least one signature`,
      value,
    );
  }
  try {
    for (const signature of value) Signature.from(signature);
  } catch {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      `Malformed ${method} response: invalid Antelope signature`,
      value,
    );
  }
}

function assertSignTransactionParams(params: VexSignTransactionParams): void {
  if (!isVexaniumFullChainId(params.chainId)) {
    throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_PARAMS, "Invalid Antelope chain ID");
  }
  if (!isHexBytes(params.serializedTransaction)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_PARAMS,
      "serializedTransaction must be non-empty, even-length hexadecimal bytes",
    );
  }
  if (!isAntelopeName(params.account) || !isAntelopeName(params.permission)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_PARAMS,
      "Invalid Antelope account or permission name",
    );
  }
}

function assertCapabilityMethods(response: VexaniumCapabilitiesResponse): void {
  for (const capability of response.capabilities) {
    for (const method of CAPABILITY_METHODS[capability]) {
      if (!response.methods.includes(method)) {
        throw new VexaniumProviderError(
          VEXANIUM_ERROR_CODES.INVALID_REQUEST,
          `Provider declares ${capability} without required method ${method}`,
        );
      }
    }
  }
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
  for (const handler of [...current]) {
    handler(payload as VexaniumClientEventMap[keyof VexaniumClientEventMap]);
  }
}

export async function createVexaniumClient(options: VexaniumClientOptions = {}): Promise<VexaniumClient> {
  let provider: VexaniumProvider | null = options.provider ?? await getVexaniumProvider({
    timeoutMs: options.discoveryTimeoutMs,
    rdns: options.providerRdns,
  });

  if (provider && !isVexaniumProvider(provider)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Explicit provider does not implement the VexaniumProvider v1 contract",
    );
  }

  const dapp = resolveDappMetadata(options.dapp);
  const requestContext = resolveDappRequestContext();
  const listeners: ClientListenerStore = new Map();
  const syncOptions = normalizeSyncOptions(options.autoSync);
  const cleanupCallbacks = new Set<() => void>();
  let session: VexaniumDappSession | null = null;
  let syncInFlight: Promise<VexaniumAccount[]> | null = null;
  let negotiation: VexaniumCapabilitiesResponse | null = null;
  let negotiationInFlight: Promise<VexaniumCapabilitiesResponse> | null = null;
  let destroyed = false;

  const requireProvider = (): VexaniumProvider => {
    if (!provider?.request || !isVexaniumProvider(provider)) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.DISCONNECTED,
        "No compatible VexaniumProvider v1 provider is available",
      );
    }
    assertVexaniumProviderInfo(provider.providerInfo);
    return provider;
  };

  const request = async <TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult> => {
    try {
      if (destroyed) {
        throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.DISCONNECTED, "Vexanium client has been destroyed");
      }
      return await requireProvider().request<TResult, TParams>(args);
    } catch (error) {
      throw normalizeVexaniumProviderError(error);
    }
  };

  const negotiate = async (
    requiredCapabilities: readonly VexaniumCapability[] = [],
  ): Promise<VexaniumCapabilitiesResponse> => {
    if (negotiation) {
      for (const capability of requiredCapabilities) {
        if (!negotiation.capabilities.includes(capability)) throw vexaniumUnsupportedCapability(capability);
      }
      return negotiation;
    }

    if (!negotiationInFlight) {
      negotiationInFlight = request<VexaniumCapabilitiesResponse>({
        method: VEXANIUM_METHODS.GET_CAPABILITIES,
        params: {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          requiredCapabilities,
        },
      }).then((response) => {
        assertVexaniumCapabilitiesResponse(response, requiredCapabilities);
        assertCapabilityMethods(response);
        const info = requireProvider().providerInfo;
        for (const capability of response.capabilities) {
          if (!info.capabilities.includes(capability)) {
            throw new VexaniumProviderError(
              VEXANIUM_ERROR_CODES.INVALID_REQUEST,
              `Provider negotiated undeclared capability: ${capability}`,
            );
          }
        }
        for (const chainId of response.chains) {
          if (!info.chains.some((declaredChainId) => sameVexaniumChain(chainId, declaredChainId))) {
            throw new VexaniumProviderError(
              VEXANIUM_ERROR_CODES.INVALID_REQUEST,
              `Provider negotiated undeclared chain: ${chainId}`,
            );
          }
        }
        negotiation = response;
        return response;
      }).finally(() => {
        negotiationInFlight = null;
      });
    }

    const response = await negotiationInFlight;
    for (const capability of requiredCapabilities) {
      if (!response.capabilities.includes(capability)) throw vexaniumUnsupportedCapability(capability);
    }
    return response;
  };

  const emitSessionChanged = (reason: VexaniumClientSessionChangeReason): void => {
    const sessionSnapshot = cloneSession(session);
    emitClientEvent(listeners, "sessionChanged", {
      session: sessionSnapshot,
      accounts: sessionSnapshot?.accounts ?? [],
      reason,
    });
  };

  const updateSession = ({
    accounts,
    chainId,
    walletSessionId,
    dapp: nextDapp,
    reason,
  }: SessionMutation): VexaniumAccount[] => {
    if (accounts[0]) {
      const now = Date.now();
      const sessionDapp = cloneDappMetadata(nextDapp ?? session?.dapp ?? dapp);
      const sessionAccounts = cloneAccounts(accounts);
      session = {
        id: session?.walletSessionId === walletSessionId
          ? session.id
          : createLocalSessionId(requestContext.origin, chainId, accounts[0]),
        walletSessionId,
        dapp: sessionDapp,
        origin: session?.origin ?? requestContext.origin,
        chainId,
        accounts: sessionAccounts,
        createdAt: session?.createdAt ?? now,
        updatedAt: now,
      };
    } else {
      session = null;
    }
    emitSessionChanged(reason);
    return cloneAccounts(accounts);
  };

  const clearSession = (reason: VexaniumClientSessionChangeReason): void => {
    if (!session) return;
    session = null;
    emitSessionChanged(reason);
  };

  const getChain = async (): Promise<VexaniumChainId> => {
    const chainId = await request<VexaniumChainId>({ method: VEXANIUM_METHODS.GET_CHAIN });
    if (!isVexaniumChainId(chainId)) {
      throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_REQUEST, "Malformed vex_getChain response");
    }
    return chainId;
  };

  const syncAccounts = async (): Promise<VexaniumAccount[]> => {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      await negotiate([VEXANIUM_CAPABILITIES.ACCOUNTS]);
      const rawResponse = await request<VexaniumAccountsResponse>({ method: VEXANIUM_METHODS.GET_ACCOUNTS });
      assertAccountsResponse(rawResponse);
      const accounts = normalizeVexaniumAccounts(rawResponse.accounts, rawResponse.chainId);
      return updateSession({
        accounts,
        chainId: rawResponse.chainId,
        walletSessionId: rawResponse.sessionId,
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
    const requiredCapabilities = params.requiredCapabilities ?? DEFAULT_CONNECT_CAPABILITIES;
    if (params.chainId && !isVexaniumChainId(params.chainId)) {
      throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_PARAMS, "Invalid Vexanium chain ID");
    }
    await negotiate(requiredCapabilities);

    const wireParams: VexaniumConnectRequest = compactParams({
      standard: VEXANIUM_PROVIDER_STANDARD,
      version: VEXANIUM_PROVIDER_VERSION,
      dapp: requestDapp,
      chainId: params.chainId,
      sessionId: params.sessionId,
      requiredCapabilities,
    });

    const rawResponse = await request<VexaniumConnectResponse, VexaniumConnectRequest>({
      method: VEXANIUM_METHODS.REQUEST_ACCOUNTS,
      params: wireParams,
    });
    assertVexaniumConnectResponse(rawResponse);

    const info = requireProvider().providerInfo;
    if (!info.chains.some((chainId) => sameVexaniumChain(chainId, rawResponse.chainId))) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        `Wallet connected to undeclared chain: ${rawResponse.chainId}`,
      );
    }

    if (params.chainId && !sameVexaniumChain(rawResponse.chainId, params.chainId)) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.UNSUPPORTED_CHAIN,
        `Wallet connected to ${rawResponse.chainId}, but dApp requested ${params.chainId}`,
      );
    }
    for (const capability of requiredCapabilities) {
      if (!rawResponse.capabilities.includes(capability)) throw vexaniumUnsupportedCapability(capability);
    }

    const accounts = normalizeVexaniumAccounts(rawResponse.accounts, rawResponse.chainId);
    if (!accounts[0]) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        "VexaniumProvider v1 connect response contained no valid accounts",
      );
    }

    return updateSession({
      accounts,
      chainId: rawResponse.chainId,
      walletSessionId: rawResponse.sessionId,
      dapp: requestDapp,
      reason: "connect",
    });
  };

  const handleConnect = (payload: VexaniumProviderEventMap["connect"]): void => {
    try {
      assertVexaniumConnectResponse(payload);
      const accounts = normalizeVexaniumAccounts(payload.accounts, payload.chainId);
      updateSession({
        accounts,
        chainId: payload.chainId,
        walletSessionId: payload.sessionId,
        reason: "connect",
      });
      emitClientEvent(listeners, "connect", payload);
    } catch {
      // Invalid provider events are ignored rather than corrupting local session state.
    }
  };

  const handleAccountsChanged = (payload: VexaniumProviderEventMap["accountsChanged"]): void => {
    try {
      assertAccountsResponse(payload);
      const accounts = normalizeVexaniumAccounts(payload.accounts, payload.chainId);
      updateSession({
        accounts,
        chainId: payload.chainId,
        walletSessionId: payload.sessionId,
        reason: "accountsChanged",
      });
      emitClientEvent(listeners, "accountsChanged", payload);
    } catch {
      // Ignore malformed events.
    }
  };

  const handleChainChanged = (chainId: VexaniumProviderEventMap["chainChanged"]): void => {
    if (!isVexaniumChainId(chainId)) return;
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
    emitClientEvent(listeners, "disconnect", payload ?? { code: 4900, message: "Disconnected" });
  };

  const bindProviderEvents = (): void => {
    const current = provider;
    if (!current?.on) return;
    current.on("connect", handleConnect);
    current.on("accountsChanged", handleAccountsChanged);
    current.on("chainChanged", handleChainChanged);
    current.on("disconnect", handleDisconnect);
    const cleanup = () => {
      if (current.off) {
        current.off("connect", handleConnect);
        current.off("accountsChanged", handleAccountsChanged);
        current.off("chainChanged", handleChainChanged);
        current.off("disconnect", handleDisconnect);
        return;
      }
      current.removeListener?.("connect", handleConnect);
      current.removeListener?.("accountsChanged", handleAccountsChanged);
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

  const signSigningRequest = async (
    params: VexSigningRequestParams,
  ): Promise<VexSigningRequestResult> => {
    await negotiate([VEXANIUM_CAPABILITIES.SIGNING_REQUEST]);
    try {
      parseSigningRequest(params.request);
    } catch (error) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_PARAMS,
        "Invalid Vexanium Signing Request payload",
        error,
      );
    }
    const result = await request<VexSigningRequestResult, VexSigningRequestParams>({
      method: VEXANIUM_METHODS.SIGNING_REQUEST,
      params: compactParams({
        ...params,
        request: params.request,
        sessionId: params.sessionId ?? session?.walletSessionId,
        dapp: params.dapp ?? (session ? undefined : dapp),
      }),
    });
    if (typeof result !== "object" || result === null || typeof result.broadcast !== "boolean") {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        "Malformed vex_signingRequest response",
        result,
      );
    }
    assertValidSignatures(result.signatures, VEXANIUM_METHODS.SIGNING_REQUEST);
    if (params.broadcast !== undefined && result.broadcast !== params.broadcast) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        "Wallet returned an unexpected signing-request broadcast state",
        result,
      );
    }
    if (result.transactionId !== undefined && !isChecksum256(result.transactionId)) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        "Wallet returned an invalid Vexanium transaction ID",
        result,
      );
    }
    return result;
  };

  return {
    isAvailable() {
      return Boolean(provider && isVexaniumProvider(provider));
    },

    getProvider() {
      return provider;
    },

    getProviderInfo() {
      const info = requireProvider().providerInfo;
      return {
        ...info,
        chains: [...info.chains],
        capabilities: [...info.capabilities],
      };
    },

    getDappMetadata() {
      return cloneDappMetadata(dapp);
    },

    getRequestContext() {
      return requestContext;
    },

    getSession() {
      return cloneSession(session);
    },

    request,
    negotiate,
    connect,

    async connectOne(params?: VexaniumConnectParams) {
      const [account] = await connect(params);
      if (!account) {
        throw new VexaniumProviderError(
          VEXANIUM_ERROR_CODES.INVALID_REQUEST,
          "No Vexanium account was returned",
        );
      }
      return account;
    },

    getAccounts,
    syncAccounts,
    getChain,

    signSigningRequest,

    async signMessage(message: string | Uint8Array, account?: string) {
      if (account && !isAntelopeName(account)) {
        throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_PARAMS, "Invalid Antelope account name");
      }
      await negotiate([VEXANIUM_CAPABILITIES.MESSAGE_SIGNING]);
      const params: VexSignMessageParams = compactParams({
        message: typeof message === "string" ? message : Array.from(message),
        account,
        sessionId: session?.walletSessionId,
        dapp: session ? undefined : dapp,
      });
      return request({ method: VEXANIUM_METHODS.SIGN_MESSAGE, params });
    },

    async signDigest(digest: string, account?: string) {
      if (!isChecksum256(digest)) {
        throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_PARAMS, "Digest must be 32-byte hexadecimal");
      }
      if (account && !isAntelopeName(account)) {
        throw new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_PARAMS, "Invalid Antelope account name");
      }
      await negotiate([VEXANIUM_CAPABILITIES.DIGEST_SIGNING]);
      const params: VexSignDigestParams = compactParams({
        digest,
        account,
        sessionId: session?.walletSessionId,
        dapp: session ? undefined : dapp,
      });
      return request({ method: VEXANIUM_METHODS.SIGN_DIGEST, params });
    },

    async signTransaction(params: VexSignTransactionParams) {
      assertSignTransactionParams(params);
      await negotiate([VEXANIUM_CAPABILITIES.EXACT_TRANSACTION_SIGNING]);
      const result = await request<VexSignTransactionResult, VexSignTransactionParams>({
        method: VEXANIUM_METHODS.SIGN_TRANSACTION,
        params: compactParams({
          ...params,
          sessionId: params.sessionId ?? session?.walletSessionId,
          dapp: params.dapp ?? (session ? undefined : dapp),
        }),
      });
      if (typeof result !== "object" || result === null) {
        throw new VexaniumProviderError(
          VEXANIUM_ERROR_CODES.INVALID_REQUEST,
          "Malformed vex_signTransaction response",
          result,
        );
      }
      assertValidSignatures(result.signatures, VEXANIUM_METHODS.SIGN_TRANSACTION);
      if (result.signer !== undefined && result.signer !== params.account) {
        throw new VexaniumProviderError(
          VEXANIUM_ERROR_CODES.INVALID_REQUEST,
          "Wallet signed with a different Vexanium account",
          result,
        );
      }
      if (result.signerPermission !== undefined && result.signerPermission !== params.permission) {
        throw new VexaniumProviderError(
          VEXANIUM_ERROR_CODES.INVALID_REQUEST,
          "Wallet signed with a different Vexanium permission",
          result,
        );
      }
      return result;
    },

    async disconnect() {
      try {
        if (session) {
          await request({
            method: VEXANIUM_METHODS.DISCONNECT,
            params: { sessionId: session.walletSessionId },
          });
        }
      } finally {
        clearSession("disconnect");
      }
    },

    on<TEvent extends keyof VexaniumClientEventMap>(
      event: TEvent,
      handler: (payload: VexaniumClientEventMap[TEvent]) => void,
    ) {
      addClientListener(listeners, event, handler);
    },

    off<TEvent extends keyof VexaniumClientEventMap>(
      event: TEvent,
      handler: (payload: VexaniumClientEventMap[TEvent]) => void,
    ) {
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
      session = null;
    },
  };
}
