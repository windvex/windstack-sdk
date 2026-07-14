import type { ProviderDetail, RequestArguments } from "@windstack/core";

export type EVMProviderEventMap = {
  connect: { chainId: string };
  disconnect: { code: number; message: string };
  accountsChanged: string[];
  chainChanged: string;
  message: { type: string; data: unknown };
};

export type EIP1193Provider = {
  isMetaMask?: boolean;
  selectedAddress?: string | null;
  chainId?: string;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  on<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
  off?<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
  removeListener<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
};

export type EIP6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type EIP6963ProviderDetail = ProviderDetail<EIP1193Provider, EIP6963ProviderInfo>;

export type EVMClientOptions = {
  provider?: EIP1193Provider;
  discoveryTimeoutMs?: number;
};

export type AddEthereumChainParameter = {
  chainId: string;
  blockExplorerUrls?: string[];
  chainName?: string;
  iconUrls?: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
};

export type EVMClient = {
  isAvailable(): boolean;
  getProvider(): EIP1193Provider | null;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  connect(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getChainId(): Promise<string>;
  switchChain(chainId: string): Promise<unknown>;
  addChain(params: AddEthereumChainParameter): Promise<unknown>;
  on<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
  off<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void): void;
};
