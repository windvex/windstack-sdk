import { WISP_PROVIDER_CONTRACT } from "@windstack/core";

const { evm, provider } = WISP_PROVIDER_CONTRACT;

export const EVM_PROVIDER_GLOBAL = evm.global;
export const EIP6963_REQUEST_PROVIDER_EVENT = evm.events.requestProvider;
export const EIP6963_ANNOUNCE_PROVIDER_EVENT = evm.events.announceProvider;
export const DEFAULT_EVM_DISCOVERY_TIMEOUT_MS = 120;
export const WISP_EVM_PROVIDER_RDNS = provider.rdns;

export const EVM_METHODS = {
  REQUEST_ACCOUNTS: evm.methods.requestAccounts,
  GET_ACCOUNTS: evm.methods.getAccounts,
  GET_CHAIN_ID: evm.methods.getChainId,
  SWITCH_CHAIN: evm.methods.switchChain,
  ADD_CHAIN: evm.methods.addChain,
} as const;
