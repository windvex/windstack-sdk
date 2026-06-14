import type { DappMetadataInput, ProviderDetail, ProviderInfo, RequestArguments } from "@windstack/core";

export type EVMProviderEventMap = {
  connect: { chainId: string };
  disconnect: { code: number; message: string };
  accountsChanged: string[];
  chainChanged: string;
  message: unknown;
};

export type EIP1193Provider = {
  isMetaMask?: boolean;
  selectedAddress?: string | null;
  chainId?: string;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  on?<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
  off?<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
  removeListener?<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
};

export type EIP6963ProviderInfo = ProviderInfo & {
  rdns: string;
};

export type EIP6963ProviderDetail = ProviderDetail<EIP1193Provider, EIP6963ProviderInfo>;

export type EVMClientOptions = {
  dapp?: DappMetadataInput;
  provider?: EIP1193Provider;
  discoveryTimeoutMs?: number;
};

export type EVMClient = {
  isAvailable(): boolean;
  getProvider(): EIP1193Provider | null;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  connect(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getChainId(): Promise<string>;
  switchChain(chainId: string): Promise<unknown>;
  addChain(params: Record<string, unknown>): Promise<unknown>;
  on<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
  off<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
};
