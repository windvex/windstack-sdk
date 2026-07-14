export const VEXANIUM_PROVIDER_GLOBAL = "vexanium" as const;
export const VEXANIUM_REQUEST_PROVIDER_EVENT = "vexanium:requestProvider" as const;
export const VEXANIUM_ANNOUNCE_PROVIDER_EVENT = "vexanium:announceProvider" as const;

export const VEXANIUM_PROVIDER_STANDARD = "VexaniumProvider" as const;
export const VEXANIUM_PROVIDER_VERSION = "1.0.0" as const;
export const VEXANIUM_PROVIDER_MAJOR_VERSION = 1 as const;

export const VEXANIUM_CAPABILITIES = {
  ACCOUNTS: "vex.accounts",
  SESSIONS: "vex.sessions",
  EXACT_TRANSACTION_SIGNING: "vex.signTransaction",
  SIGNING_REQUEST: "vex.signingRequest",
  MESSAGE_SIGNING: "vex.signMessage",
  DIGEST_SIGNING: "vex.signDigest",
  EVENTS: "vex.events",
} as const;

export const VEXANIUM_METHODS = {
  GET_CAPABILITIES: "vex_getCapabilities",
  REQUEST_ACCOUNTS: "vex_requestAccounts",
  GET_ACCOUNTS: "vex_getAccounts",
  GET_CHAIN: "vex_getChain",
  SIGNING_REQUEST: "vex_signingRequest",
  SIGN_MESSAGE: "vex_signMessage",
  SIGN_DIGEST: "vex_signDigest",
  SIGN_TRANSACTION: "vex_signTransaction",
  DISCONNECT: "vex_disconnect",
} as const;

export const WISP_PROVIDER_RDNS = "com.wisp.wallet" as const;

export const VEXANIUM_MAINNET_CHAIN_ID =
  "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f" as const;
export const VEXANIUM_MAINNET_SCOPE = `antelope:${VEXANIUM_MAINNET_CHAIN_ID.slice(0, 32)}` as const;

export const WISP_VEXANIUM_PROVIDER_INFO = {
  uuid: WISP_PROVIDER_RDNS,
  name: "Wisp",
  rdns: WISP_PROVIDER_RDNS,
  standard: VEXANIUM_PROVIDER_STANDARD,
  version: VEXANIUM_PROVIDER_VERSION,
  chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
  capabilities: Object.values(VEXANIUM_CAPABILITIES),
} as const;

/** Canonical URI scheme for Vexanium Signing Requests. */
export const VSR_SCHEME = "vsr:" as const;
/** Interoperability input scheme for existing Antelope ESR tooling. */
export const ESR_SCHEME = "esr:" as const;

export const DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS = 120;
