import type { RequestArguments } from "@windstack/core";

export type SolanaScope = "solana:mainnet" | "solana:devnet" | `solana:${string}`;

export type SolanaAccount = {
  scope: SolanaScope;
  publicKey: string;
  label?: string;
};

export type SolanaProviderEventMap = {
  connect: { accounts: SolanaAccount[] };
  disconnect: { code: number; message: string };
  accountsChanged: SolanaAccount[];
  chainChanged: SolanaScope;
  message: unknown;
};

export type SolanaProvider = {
  providerInfo?: {
    name: string;
    rdns: string;
    icon?: string;
  };
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  on?<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void): void;
  off?<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void): void;
  removeListener?<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void): void;
};

export type SolanaClientOptions = {
  provider?: SolanaProvider;
};

export type SolanaSignMessageParams = {
  message: string | number[];
  publicKey?: string;
};

export type SolanaTransactionParams = {
  transaction: string;
};

export type SolanaClient = {
  isAvailable(): boolean;
  getProvider(): SolanaProvider | null;
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  connect(): Promise<SolanaAccount[]>;
  getAccounts(): Promise<SolanaAccount[]>;
  signMessage(message: string | Uint8Array, publicKey?: string): Promise<unknown>;
  signTransaction(transactionBase64: string): Promise<unknown>;
  signAndSendTransaction(transactionBase64: string): Promise<unknown>;
  disconnect(): Promise<void>;
  on<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void): void;
  off<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void): void;
};
