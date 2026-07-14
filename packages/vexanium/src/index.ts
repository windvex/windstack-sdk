import "./window.js";

export { normalizeVexaniumAccount, normalizeVexaniumAccounts, parsePermissionLevel } from "./accounts.js";
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
  VSR_SCHEME,
  ESR_SCHEME,
  WISP_PROVIDER_RDNS,
  WISP_VEXANIUM_PROVIDER_INFO,
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
export { assetToNumber, formatAsset, parseAsset } from "./asset.js";
export type { VexAsset } from "./asset.js";
export { mapExplorerAction, mapExplorerTransaction } from "./decoder.js";
export type { ExplorerActionLike, ExplorerTransactionLike } from "./decoder.js";
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
export type {
  VexaniumActionModel,
  VexaniumProducerModel,
  VexaniumResourceModel,
  VexaniumResourceUsage,
  VexaniumTokenMetadata,
  VexaniumTransactionModel,
  VexaniumTransactionStatus,
} from "./models.js";
