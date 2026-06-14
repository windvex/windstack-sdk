import type {
  DappMetadata,
  DappMetadataInput,
  DappRequestMetadataParams,
  ProviderDetail,
  ProviderInfo,
  RequestArguments,
} from "@windstack/core";
import type {
  AnyAction,
  AnyTransaction,
  PermissionLevelType,
  TransactionType,
} from "@wharfkit/antelope";
import type { SigningRequestCreateArguments, SigningRequestEncodingOptions } from "@wharfkit/signing-request";

export type VexaniumFullChainId = string;
export type VexaniumCaip2ChainId = `antelope:${string}`;
export type VexaniumChainId = VexaniumFullChainId | VexaniumCaip2ChainId;

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
  id: string;
  dapp: DappMetadata;
  origin: string;
  chainId: VexaniumChainId;
  accounts: VexaniumAccount[];
  createdAt: number;
  updatedAt: number;
};

export type VexaniumProviderInfo = ProviderInfo & {
  /** Reverse-DNS wallet identifier. Wisp Wallet uses `com.wisp.wallet`. */
  rdns: string;
  chains?: readonly VexaniumChainId[];
};

export type VexaniumProviderDetail = ProviderDetail<VexaniumProvider, VexaniumProviderInfo>;

export type VexaniumProviderEventMap = {
  connect: { chainId: VexaniumChainId; accounts: VexaniumAccount[] };
  disconnect: { code: number; message: string };
  accountsChanged: VexaniumAccount[];
  chainChanged: VexaniumChainId;
  message: unknown;
};

export type VexaniumProvider = {
  providerInfo?: VexaniumProviderInfo;
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
  /** Bind provider events such as accountsChanged and disconnect. Defaults to true. */
  providerEvents?: boolean;
  /** Re-check vex_getAccounts when the browser window regains focus. Defaults to true. */
  windowFocus?: boolean;
  /** Re-check vex_getAccounts when the document becomes visible again. Defaults to true. */
  visibilityChange?: boolean;
};

export type VexaniumClientOptions = {
  dapp?: DappMetadataInput;
  /** Optional explicit provider. The SDK stores this reference only; it never wraps or overwrites Wisp Wallet globals. */
  provider?: VexaniumProvider;
  discoveryTimeoutMs?: number;
  /**
   * Keeps the local SDK session aligned with wallet state.
   * Enabled by default so wallet-side revoke/disconnect clears dApp state once the provider emits an event
   * or the page regains focus.
   */
  autoSync?: boolean | VexaniumSessionSyncOptions;
};

export type VexaniumConnectParams = DappRequestMetadataParams & {
  chainId?: VexaniumChainId;
};

export type VexaniumConnectResponse =
  | unknown[]
  | {
      accounts?: unknown[];
      account?: unknown;
      sessionId?: string;
      chainId?: VexaniumChainId;
    };

export type VsrUri = `vsr:${string}` | string;

export type VsrCreateInput = SigningRequestCreateArguments;
export type VsrCreateOptions = SigningRequestEncodingOptions & {
  compress?: boolean;
  slashes?: boolean;
};

export type VsrSigningRequestParams = DappRequestMetadataParams & {
  vsr: VsrUri;
  broadcast?: boolean;
};

export type VsrSigningRequestResult = {
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

export type VexSignTransactionParams = DappRequestMetadataParams & {
  serializedTransaction?: string;
  packed_trx?: string;
  packedTransaction?: string;
  chainId?: VexaniumChainId;
  account?: string;
  permission?: string;
  transaction?: unknown;
};

export type VexaniumClient = {
  isAvailable(): boolean;
  getProvider(): VexaniumProvider | null;
  getDappMetadata(): DappMetadata;
  getSession(): VexaniumDappSession | null;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  connect(params?: VexaniumConnectParams): Promise<VexaniumAccount[]>;
  connectOne(params?: VexaniumConnectParams): Promise<VexaniumAccount>;
  getAccounts(): Promise<VexaniumAccount[]>;
  /** Silent alias for getAccounts(), useful after wallet revoke/focus events. */
  syncAccounts(): Promise<VexaniumAccount[]>;
  getChain(): Promise<VexaniumChainId>;
  signVsr(params: VsrSigningRequestParams): Promise<VsrSigningRequestResult>;
  signMessage(message: string | Uint8Array, account?: string): Promise<unknown>;
  signDigest(digest: string, account?: string): Promise<unknown>;
  signTransaction(params: VexSignTransactionParams): Promise<unknown>;
  disconnect(): Promise<void>;
  on<TEvent extends keyof VexaniumClientEventMap>(event: TEvent, handler: (payload: VexaniumClientEventMap[TEvent]) => void): void;
  off<TEvent extends keyof VexaniumClientEventMap>(event: TEvent, handler: (payload: VexaniumClientEventMap[TEvent]) => void): void;
  /** Subscribe to normalized SDK session changes and receive an unsubscribe function. */
  subscribeSession(handler: (payload: VexaniumClientEventMap["sessionChanged"]) => void): () => void;
  /** Remove provider/window listeners created by the SDK client. */
  destroy(): void;
};

export type CreateVsrFromActionArgs = {
  action: AnyAction;
  chainId: VexaniumFullChainId;
  broadcast?: boolean;
};

export type CreateVsrFromActionsArgs = {
  actions: AnyAction[];
  chainId: VexaniumFullChainId;
  broadcast?: boolean;
};

export type CreateVsrFromTransactionArgs = {
  transaction: Partial<AnyTransaction> | TransactionType;
  chainId: VexaniumFullChainId;
  broadcast?: boolean;
};

export type CreateVsrIdentityArgs = {
  chainId: VexaniumFullChainId;
  callback: string | { url: string; background: boolean };
  account?: string;
  permission?: string;
  scope?: string;
};

export type PermissionLevelInput = PermissionLevelType | `${string}@${string}`;
