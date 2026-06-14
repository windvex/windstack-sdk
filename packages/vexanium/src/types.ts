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
  name: "Wisp";
  rdns: "com.wisp.wallet";
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
  /** Canonical Wisp marker. Do not use legacy wallet markers. */
  isWisp?: true;
  providerInfo?: VexaniumProviderInfo;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  on?<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
  off?<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
  removeListener?<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
};

export type VexaniumClientOptions = {
  dapp?: DappMetadataInput;
  provider?: VexaniumProvider;
  discoveryTimeoutMs?: number;
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

export type VexaniumClient = {
  isAvailable(): boolean;
  getProvider(): VexaniumProvider | null;
  getDappMetadata(): DappMetadata;
  getSession(): VexaniumDappSession | null;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  connect(params?: VexaniumConnectParams): Promise<VexaniumAccount[]>;
  connectOne(params?: VexaniumConnectParams): Promise<VexaniumAccount>;
  getAccounts(): Promise<VexaniumAccount[]>;
  getChain(): Promise<VexaniumChainId>;
  signVsr(params: VsrSigningRequestParams): Promise<VsrSigningRequestResult>;
  signMessage(message: string | Uint8Array, account?: string): Promise<unknown>;
  disconnect(): Promise<void>;
  on<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
  off<TEvent extends keyof VexaniumProviderEventMap>(event: TEvent, handler: (payload: VexaniumProviderEventMap[TEvent]) => void): void;
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
