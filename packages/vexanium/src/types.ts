import type {
  DappMetadata,
  DappMetadataInput,
  DappRequestContext,
  DappRequestMetadataParams,
  ProviderDetail,
  RequestArguments,
} from "@windstack/core";
import type { SigningRequestCreateArguments, SigningRequestEncodingOptions } from "@wharfkit/signing-request";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_PROVIDER_STANDARD,
} from "./constants.js";

export type VexaniumFullChainId = string;
export type VexaniumCaip2ChainId = `antelope:${string}`;
export type VexaniumChainId = VexaniumFullChainId | VexaniumCaip2ChainId;
export type VexaniumCapability =
  (typeof VEXANIUM_CAPABILITIES)[keyof typeof VEXANIUM_CAPABILITIES];

export type VexaniumPermissionLevel = {
  actor: string;
  permission: string;
};

export type VexaniumAccount = VexaniumPermissionLevel & {
  chainId: VexaniumChainId;
  permissionLevel: `${string}@${string}`;
  publicKey?: string;
  label?: string;
};

export type VexaniumDappSession = {
  /** SDK-local session identifier. Never send this to the wallet as a wallet session id. */
  id: string;
  /** Opaque session identifier issued by the wallet/provider. Required by VexaniumProvider v1 connect. */
  walletSessionId: string;
  dapp: DappMetadata;
  /** Trusted runtime/transport origin kept separately from display metadata. */
  origin: string;
  chainId: VexaniumChainId;
  accounts: VexaniumAccount[];
  createdAt: number;
  updatedAt: number;
};

/** Required provider identity and static capability declaration for VexaniumProvider v1. */
export type VexaniumProviderInfo = {
  uuid: string;
  name: string;
  icon?: string;
  /** Reverse-DNS wallet identifier. Wisp Wallet uses `com.wisp.wallet`. */
  rdns: string;
  standard: typeof VEXANIUM_PROVIDER_STANDARD;
  /** Semantic protocol version implemented by the provider, for example `1.0.0`. */
  version: string;
  chains: readonly VexaniumChainId[];
  capabilities: readonly VexaniumCapability[];
};

export type VexaniumProviderDetail = ProviderDetail<VexaniumProvider, VexaniumProviderInfo>;

export type VexaniumCapabilitiesRequest = {
  standard: typeof VEXANIUM_PROVIDER_STANDARD;
  /** Highest VexaniumProvider protocol version understood by the dApp SDK. */
  version: string;
  requiredCapabilities?: readonly VexaniumCapability[];
};

export type VexaniumCapabilitiesResponse = {
  standard: typeof VEXANIUM_PROVIDER_STANDARD;
  version: string;
  capabilities: VexaniumCapability[];
  chains: VexaniumChainId[];
  methods: string[];
};

export type VexaniumConnectParams = DappRequestMetadataParams & {
  chainId?: VexaniumChainId;
  requiredCapabilities?: readonly VexaniumCapability[];
};

/** Canonical wire request for `vex_requestAccounts`. The SDK fills standard/version. */
export type VexaniumConnectRequest = DappRequestMetadataParams & {
  standard: typeof VEXANIUM_PROVIDER_STANDARD;
  version: string;
  chainId?: VexaniumChainId;
  requiredCapabilities?: readonly VexaniumCapability[];
};

/** Canonical VexaniumProvider v1 connect response. */
export type VexaniumConnectResponse = {
  standard: typeof VEXANIUM_PROVIDER_STANDARD;
  version: string;
  sessionId: string;
  chainId: VexaniumFullChainId;
  accounts: VexaniumAccount[];
  capabilities: VexaniumCapability[];
};

export type VexaniumAccountsResponse = {
  sessionId: string;
  chainId: VexaniumFullChainId;
  accounts: VexaniumAccount[];
};

export type VexaniumProviderEventMap = {
  connect: VexaniumConnectResponse;
  disconnect: { code: number; message: string };
  accountsChanged: VexaniumAccountsResponse;
  chainChanged: VexaniumChainId;
  message: unknown;
};

/** Formal VexaniumProvider v1 runtime contract. `providerInfo` is mandatory. */
export type VexaniumProvider = {
  providerInfo: VexaniumProviderInfo;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  on?<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
  off?<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
  removeListener?<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
};

export type VexaniumClientSessionChangeReason =
  | "connect"
  | "accountsChanged"
  | "disconnect"
  | "chainChanged"
  | "sync";

export type VexaniumClientSessionChange = {
  session: VexaniumDappSession | null;
  accounts: VexaniumAccount[];
  reason: VexaniumClientSessionChangeReason;
};

export type VexaniumClientEventMap = VexaniumProviderEventMap & {
  sessionChanged: VexaniumClientSessionChange;
};

export type VexaniumSessionSyncOptions = {
  providerEvents?: boolean;
  windowFocus?: boolean;
  visibilityChange?: boolean;
};

export type VexaniumClientOptions = {
  dapp?: DappMetadataInput;
  /** Optional explicit VexaniumProvider v1 implementation. */
  provider?: VexaniumProvider;
  /** Optional provider reverse-DNS identifier used during multi-wallet discovery. */
  providerRdns?: string;
  discoveryTimeoutMs?: number;
  autoSync?: boolean | VexaniumSessionSyncOptions;
};

export type CanonicalSigningRequestUri = `vsr:${string}`;
/** VSR is canonical; ESR is accepted for Antelope interoperability. */
export type VexSigningRequestUri = string;

export type VexSigningRequestCreateInput = SigningRequestCreateArguments;
export type VexSigningRequestCreateOptions = SigningRequestEncodingOptions & {
  compress?: boolean;
  slashes?: boolean;
};
export type VexSigningRequestParseOptions = Pick<
  SigningRequestEncodingOptions,
  "abiProvider" | "zlib"
>;

/** Portable Vexanium Signing Request parameters for QR/deep-link/external wallet flows. */
export type VexSigningRequestParams = DappRequestMetadataParams & {
  request: VexSigningRequestUri;
  broadcast?: boolean;
};

export type VexSigningRequestResult = {
  transactionId?: string;
  signatures: string[];
  signer?: string;
  signerPermission?: string;
  broadcast: boolean;
  raw?: unknown;
};

export type VexSignMessageParams = DappRequestMetadataParams & {
  message: string | number[];
  account?: string;
  permission?: string;
};

export type VexSignDigestParams = DappRequestMetadataParams & {
  digest: string;
  account?: string;
  permission?: string;
};

/** Exact resolved Antelope transaction signing parameters. */
export type VexSignTransactionParams = DappRequestMetadataParams & {
  serializedTransaction: string;
  chainId: VexaniumFullChainId;
  account: string;
  permission: string;
};

export type VexSignTransactionResult = {
  signatures: string[];
  signer?: string;
  signerPermission?: string;
  raw?: unknown;
};

export type VexaniumClient = {
  isAvailable(): boolean;
  getProvider(): VexaniumProvider | null;
  getProviderInfo(): VexaniumProviderInfo;
  getDappMetadata(): DappMetadata;
  getRequestContext(): DappRequestContext;
  getSession(): VexaniumDappSession | null;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  negotiate(requiredCapabilities?: readonly VexaniumCapability[]): Promise<VexaniumCapabilitiesResponse>;
  connect(params?: VexaniumConnectParams): Promise<VexaniumAccount[]>;
  connectOne(params?: VexaniumConnectParams): Promise<VexaniumAccount>;
  getAccounts(): Promise<VexaniumAccount[]>;
  syncAccounts(): Promise<VexaniumAccount[]>;
  getChain(): Promise<VexaniumChainId>;
  signSigningRequest(params: VexSigningRequestParams): Promise<VexSigningRequestResult>;
  signMessage(message: string | Uint8Array, account?: string): Promise<unknown>;
  signDigest(digest: string, account?: string): Promise<unknown>;
  signTransaction(params: VexSignTransactionParams): Promise<VexSignTransactionResult>;
  disconnect(): Promise<void>;
  on<TEvent extends keyof VexaniumClientEventMap>(event: TEvent, handler: (payload: VexaniumClientEventMap[TEvent]) => void): void;
  off<TEvent extends keyof VexaniumClientEventMap>(event: TEvent, handler: (payload: VexaniumClientEventMap[TEvent]) => void): void;
  subscribeSession(handler: (payload: VexaniumClientEventMap["sessionChanged"]) => void): () => void;
  destroy(): void;
};
