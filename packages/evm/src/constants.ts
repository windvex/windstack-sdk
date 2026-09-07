export const EVM_PROVIDER_GLOBAL = "ethereum" as const;
export const EIP6963_REQUEST_PROVIDER_EVENT = "eip6963:requestProvider" as const;
export const EIP6963_ANNOUNCE_PROVIDER_EVENT = "eip6963:announceProvider" as const;
export const DEFAULT_EVM_DISCOVERY_TIMEOUT_MS = 120;

export const EVM_METHODS = {
  REQUEST_ACCOUNTS: "eth_requestAccounts",
  GET_ACCOUNTS: "eth_accounts",
  GET_COINBASE: "eth_coinbase",
  GET_CHAIN_ID: "eth_chainId",
  GET_NETWORK_VERSION: "net_version",
  REQUEST_PERMISSIONS: "wallet_requestPermissions",
  GET_PERMISSIONS: "wallet_getPermissions",
  SWITCH_CHAIN: "wallet_switchEthereumChain",
  ADD_CHAIN: "wallet_addEthereumChain",
  SIGN_MESSAGE: "personal_sign",
  SIGN_TYPED_DATA: "eth_signTypedData",
  SIGN_TYPED_DATA_V3: "eth_signTypedData_v3",
  SIGN_TYPED_DATA_V4: "eth_signTypedData_v4",
  SIGN_TRANSACTION: "eth_signTransaction",
  SEND_TRANSACTION: "eth_sendTransaction",
} as const;
