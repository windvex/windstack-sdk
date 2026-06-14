import type { DappMetadataInput, RequestArguments, WispScope, WispSession } from "@windstack/core";
import type { EVMClient } from "@windstack/evm";
import type { SolanaClient } from "@windstack/solana";
import type { VexaniumClient } from "@windstack/vexanium";

export type WispSessionClientOptions = {
  dapp?: DappMetadataInput;
  evm?: EVMClient;
  solana?: SolanaClient;
  vexanium?: VexaniumClient;
};

export type WispInvokeArgs<TParams = unknown> = {
  scope: WispScope;
  request: RequestArguments<TParams>;
};

export type WispSessionClient = {
  connect(scopes: WispScope[]): Promise<WispSession>;
  getSession(): WispSession | null;
  invoke<TResult = unknown, TParams = unknown>(args: WispInvokeArgs<TParams>): Promise<TResult>;
  disconnect(): Promise<void>;
};
