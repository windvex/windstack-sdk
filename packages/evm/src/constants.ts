export const EVM_PROVIDER_GLOBAL = "ethereum" as const;
export const EIP6963_REQUEST_PROVIDER_EVENT = "eip6963:requestProvider" as const;
export const EIP6963_ANNOUNCE_PROVIDER_EVENT = "eip6963:announceProvider" as const;
export const DEFAULT_EVM_DISCOVERY_TIMEOUT_MS = 120;
export const WISP_EVM_PROVIDER_RDNS = "com.wisp.wallet" as const;

export const EVM_METHODS = {
  REQUEST_ACCOUNTS: "eth_requestAccounts",
  GET_ACCOUNTS: "eth_accounts",
  GET_CHAIN_ID: "eth_chainId",
  SWITCH_CHAIN: "wallet_switchEthereumChain",
  ADD_CHAIN: "wallet_addEthereumChain",
} as const;
