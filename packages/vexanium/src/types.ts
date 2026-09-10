/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import type {
  AccountClient,
  Action,
  AuthorizationInput,
  Contract,
  Transaction,
  TransactionExtension,
  TransactResult,
} from "@windstack/antelope";
import type {
  DappMetadata,
  DappMetadataInput,
  DappRequestContext,
  DappRequestMetadataParams,
  ProviderDetail,
  RequestArguments,
} from "@windstack/core";
import type { FetchLike } from "@windstack/rpc";
import type {
  SigningRequest,
  SigningRequestCreateArguments,
  SigningRequestEncodingOptions,
  SigningRequestParseOptions,
} from "@windstack/signing-request";
import type { VEXANIUM_CAPABILITIES, VEXANIUM_PROVIDER_STANDARD } from "./constants.js";

export type VexaniumFullChainId = string;
export type VexaniumCaip2ChainId = `antelope:${string}`;
export type VexaniumChainId = VexaniumFullChainId | VexaniumCaip2ChainId;
export type VexaniumCapability = (typeof VEXANIUM_CAPABILITIES)[keyof typeof VEXANIUM_CAPABILITIES];

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
  on?<TEvent extends keyof VexaniumProviderEventMap>(
    event: TEvent,
    handler: (payload: VexaniumProviderEventMap[TEvent]) => void,
  ): void;
  off?<TEvent extends keyof VexaniumProviderEventMap>(
    event: TEvent,
    handler: (payload: VexaniumProviderEventMap[TEvent]) => void,
  ): void;
  removeListener?<TEvent extends keyof VexaniumProviderEventMap>(
    event: TEvent,
    handler: (payload: VexaniumProviderEventMap[TEvent]) => void,
  ): void;
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
  /** Vexanium RPC endpoint or ordered endpoint list. */
  rpcUrl?: string | readonly string[];
  /** Optional fetch implementation shared by the Vexanium RPC client. */
  fetch?: FetchLike;
  discoveryTimeoutMs?: number;
  autoSync?: boolean | VexaniumSessionSyncOptions;
};

export type VexaniumActionInput = {
  account: string;
  name: string;
  data: unknown;
  /** Defaults to the connected signer permission for normal transaction actions. */
  authorization?: AuthorizationInput[];
};

export type VexaniumTransactArgs = {
  actions: VexaniumActionInput[];
  contextFreeActions?: VexaniumActionInput[];
  contextFreeData?: Uint8Array[];
  transactionExtensions?: TransactionExtension[];
  signer?: VexaniumPermissionLevel;
  broadcast?: boolean;
  expireSeconds?: number;
  signal?: AbortSignal;
};

export type CanonicalSigningRequestUri = `vsr:${string}`;
/** Public Vexanium signing-request URIs always use the canonical `vsr:` scheme. */
export type VexSigningRequestUri = CanonicalSigningRequestUri;

export type VexSigningRequestZlibProvider = {
  deflateRaw(data: Uint8Array): Uint8Array;
  inflateRaw(data: Uint8Array): Uint8Array;
};

export type VexSigningRequestCreateInput = SigningRequestCreateArguments;
export type VexSigningRequestCreateOptions = Omit<
  SigningRequestEncodingOptions,
  "scheme" | "compressionProvider"
> & {
  zlib?: VexSigningRequestZlibProvider;
};
export type VexSigningRequestParseOptions = Omit<
  SigningRequestParseOptions,
  "compressionProvider"
> & {
  zlib?: VexSigningRequestZlibProvider;
};

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

/** Exact resolved Vexanium transaction signing parameters. */
export type VexSignTransactionParams = DappRequestMetadataParams & {
  serializedTransaction: string;
  /** Canonical packed context-free data. Empty string means no context-free data. */
  serializedContextFreeData?: string;
  /**
   * Canonical structured representation of `serializedTransaction`.
   * When omitted, WindStack decodes the packed bytes before forwarding the request to a wallet.
   */
  transaction?: Transaction;
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
  negotiate(
    requiredCapabilities?: readonly VexaniumCapability[],
  ): Promise<VexaniumCapabilitiesResponse>;
  connect(params?: VexaniumConnectParams): Promise<VexaniumAccount[]>;
  connectOne(params?: VexaniumConnectParams): Promise<VexaniumAccount>;
  getAccounts(): Promise<VexaniumAccount[]>;
  syncAccounts(): Promise<VexaniumAccount[]>;
  getChain(): Promise<VexaniumChainId>;
  contract(account: string): Contract;
  account(name?: string): AccountClient;
  action(input: VexaniumActionInput, signal?: AbortSignal): Promise<Action>;
  transact<T = Record<string, unknown>>(args: VexaniumTransactArgs): Promise<TransactResult<T>>;
  createSigningRequest(
    args: VexSigningRequestCreateInput,
    options?: VexSigningRequestCreateOptions,
  ): Promise<CanonicalSigningRequestUri>;
  parseSigningRequest(
    uri: VexSigningRequestUri,
    options?: VexSigningRequestParseOptions,
  ): SigningRequest;
  signSigningRequest(params: VexSigningRequestParams): Promise<VexSigningRequestResult>;
  signMessage(message: string | Uint8Array, account?: string): Promise<unknown>;
  signDigest(digest: string, account?: string): Promise<unknown>;
  signTransaction(params: VexSignTransactionParams): Promise<VexSignTransactionResult>;
  disconnect(): Promise<void>;
  on<TEvent extends keyof VexaniumClientEventMap>(
    event: TEvent,
    handler: (payload: VexaniumClientEventMap[TEvent]) => void,
  ): void;
  off<TEvent extends keyof VexaniumClientEventMap>(
    event: TEvent,
    handler: (payload: VexaniumClientEventMap[TEvent]) => void,
  ): void;
  subscribeSession(
    handler: (payload: VexaniumClientEventMap["sessionChanged"]) => void,
  ): () => void;
  destroy(): void;
};
