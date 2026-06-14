export { normalizeSolanaAccount, normalizeSolanaAccounts } from "./accounts.js";
export { createSolanaClient } from "./client.js";
export { DEFAULT_SOLANA_SCOPE, SOLANA_METHODS, SOLANA_PROVIDER_GLOBAL } from "./constants.js";
export { getInjectedSolanaProvider } from "./discovery.js";
export type {
  SolanaAccount,
  SolanaClient,
  SolanaClientOptions,
  SolanaProvider,
  SolanaProviderEventMap,
  SolanaScope,
  SolanaSignMessageParams,
  SolanaTransactionParams,
} from "./types.js";
