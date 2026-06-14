export const SOLANA_PROVIDER_GLOBAL = "solana" as const;

export const SOLANA_METHODS = {
  REQUEST_ACCOUNTS: "solana_requestAccounts",
  GET_ACCOUNTS: "solana_accounts",
  SIGN_MESSAGE: "solana_signMessage",
  SIGN_TRANSACTION: "solana_signTransaction",
  SIGN_AND_SEND_TRANSACTION: "solana_signAndSendTransaction",
  DISCONNECT: "solana_disconnect",
} as const;

export const DEFAULT_SOLANA_SCOPE = "solana:mainnet" as const;
