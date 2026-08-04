import { WISP_PROVIDER_CONTRACT } from "@windstack/core";

const { evm, provider } = WISP_PROVIDER_CONTRACT;

export const EVM_PROVIDER_GLOBAL = evm.global;
export const EIP6963_REQUEST_PROVIDER_EVENT = evm.events.requestProvider;
export const EIP6963_ANNOUNCE_PROVIDER_EVENT = evm.events.announceProvider;
export const DEFAULT_EVM_DISCOVERY_TIMEOUT_MS = 120;
export const WISP_EVM_PROVIDER_RDNS = provider.rdns;
export const VEX_EVM_CHAIN_ID = evm.chainId;
export const VEX_EVM_CHAIN_ID_HEX = evm.chainIdHex;
export const VEX_EVM_SCOPE = evm.scope;

export const EVM_METHODS = {
  REQUEST_ACCOUNTS: evm.methods.requestAccounts,
  GET_ACCOUNTS: evm.methods.getAccounts,
  GET_COINBASE: evm.methods.getCoinbase,
  GET_CHAIN_ID: evm.methods.getChainId,
  GET_NETWORK_VERSION: evm.methods.getNetworkVersion,
  REQUEST_PERMISSIONS: evm.methods.requestPermissions,
  GET_PERMISSIONS: evm.methods.getPermissions,
  SWITCH_CHAIN: evm.methods.switchChain,
  ADD_CHAIN: evm.methods.addChain,
  SIGN_MESSAGE: evm.methods.signMessage,
  SIGN_TYPED_DATA: evm.methods.signTypedData,
  SIGN_TYPED_DATA_V3: evm.methods.signTypedDataV3,
  SIGN_TYPED_DATA_V4: evm.methods.signTypedDataV4,
  SIGN_TRANSACTION: evm.methods.signTransaction,
  SEND_TRANSACTION: evm.methods.sendTransaction,
} as const;
