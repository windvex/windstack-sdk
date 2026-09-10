import "./window.js";

export {
  normalizeVexaniumAccount,
  normalizeVexaniumAccounts,
  parsePermissionLevel,
} from "./accounts.js";
export { createVexaniumClient } from "./client.js";
export {
  DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS,
  VEXANIUM_ANNOUNCE_PROVIDER_EVENT,
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_PROVIDER_MAJOR_VERSION,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  VEXANIUM_MAINNET_SCOPE,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_GLOBAL,
  VEXANIUM_REQUEST_PROVIDER_EVENT,
  VEX_EVM_ANTELOPE_CONTRACT,
  VSR_SCHEME,
} from "./constants.js";
export {
  VEXANIUM_ERROR_CODES,
  VexaniumProviderError,
  isVexaniumProviderError,
  normalizeVexaniumProviderError,
  vexaniumInvalidParams,
  vexaniumUnsupportedCapability,
  vexaniumUnsupportedChain,
} from "./errors.js";
export {
  assertCompatibleVexaniumProviderVersion,
  assertVexaniumCapabilitiesResponse,
  assertVexaniumConnectResponse,
  assertVexaniumProviderInfo,
  isCompatibleVexaniumProviderVersion,
  isVexaniumProviderInfo,
} from "./standard.js";
export {
  announceVexaniumProvider,
  discoverVexaniumProviders,
  getInjectedVexaniumProvider,
  isVexaniumProvider,
  getVexaniumProvider,
  requestVexaniumProviders,
} from "./discovery.js";
export type { GetVexaniumProviderOptions } from "./discovery.js";
export type {
  CanonicalSigningRequestUri,
  VexSignMessageParams,
  VexSignDigestParams,
  VexSignTransactionParams,
  VexSignTransactionResult,
  VexSigningRequestCreateInput,
  VexSigningRequestCreateOptions,
  VexSigningRequestParseOptions,
  VexSigningRequestParams,
  VexSigningRequestResult,
  VexSigningRequestUri,
  VexSigningRequestZlibProvider,
  VexaniumAccount,
  VexaniumAccountsResponse,
  VexaniumCapabilitiesRequest,
  VexaniumCapabilitiesResponse,
  VexaniumCapability,
  VexaniumCaip2ChainId,
  VexaniumChainId,
  VexaniumClient,
  VexaniumClientEventMap,
  VexaniumClientOptions,
  VexaniumClientSessionChange,
  VexaniumClientSessionChangeReason,
  VexaniumConnectParams,
  VexaniumConnectRequest,
  VexaniumConnectResponse,
  VexaniumDappSession,
  VexaniumFullChainId,
  VexaniumPermissionLevel,
  VexaniumProvider,
  VexaniumProviderDetail,
  VexaniumProviderEventMap,
  VexaniumProviderInfo,
  VexaniumSessionSyncOptions,
} from "./types.js";
export {
  createSigningRequest,
  encodeSigningRequest,
  parseSigningRequest,
} from "./signing-request.js";

export {
  createVexaniumEvmExplorerRoutes,
  createVexaniumExplorerRoutes,
  getVexaniumChain,
  vexaniumChains,
  vexEvm,
  vexNative,
} from "./chains.js";
export type {
  VexaniumChainKey,
  VexaniumEvmChainConfig,
  VexaniumNativeChainConfig,
  WindstackChainEnvironment,
  WindstackChainFamily,
  WindstackExplorerRoutes,
  WindstackNativeCurrency,
} from "./chains.js";
export {
  buildExplorerAccountUrl,
  buildExplorerActionUrl,
  buildExplorerBlockUrl,
  buildExplorerProducerUrl,
  buildExplorerTokenUrl,
  buildExplorerTxUrl,
} from "./explorer.js";
export type { BuildExplorerUrlOptions, ExplorerTarget } from "./explorer.js";
export {
  isAntelopeName,
  isChecksum256,
  isHexBytes,
  isVexaniumCaip2ChainId,
  isVexaniumChainId,
  isVexaniumFullChainId,
  sameVexaniumChain,
  toVexaniumCaip2ChainId,
} from "./validation.js";
export {
  VEX_EVM_BRIDGE_TRANSFER_SELECTOR,
  VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX,
  classifyVexEvmAddress,
  decodeVexEvmBridgeTransferCalldata,
  hasReservedNativeBridgePrefix,
  isReservedNativeBridgeAddress,
  nativeAccountToReservedEvmAddress,
  reservedEvmAddressToNativeAccount,
} from "./bridge.js";
export type { VexEvmAddressClassification, VexEvmBridgeTransfer } from "./bridge.js";
export { decodeVexEvmContractAction } from "./evm-action.js";
export type { VexEvmContractAction, VexEvmTransactionEvent } from "./evm-action.js";
