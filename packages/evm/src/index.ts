export { createEVMClient } from "./client.js";
export {
  DEFAULT_EVM_DISCOVERY_TIMEOUT_MS,
  EIP6963_ANNOUNCE_PROVIDER_EVENT,
  EIP6963_REQUEST_PROVIDER_EVENT,
  EVM_METHODS,
  EVM_PROVIDER_GLOBAL,
  WISP_EVM_PROVIDER_RDNS,
} from "./constants.js";
export {
  discoverEVMProviders,
  getEVMProvider,
  getInjectedEVMProvider,
  isEIP6963ProviderDetail,
  isEIP6963ProviderInfo,
  requestEIP6963Providers,
} from "./discovery.js";
export type {
  AddEthereumChainParameter,
  EIP1193Provider,
  EIP6963ProviderDetail,
  EIP6963ProviderInfo,
  EVMClient,
  EVMClientOptions,
  EVMProviderEventMap,
} from "./types.js";
