import type { ProviderInfo } from "@windstack/core";

export const VEXANIUM_PROVIDER_GLOBAL = "vexanium" as const;
export const VEXANIUM_REQUEST_PROVIDER_EVENT = "vexanium:requestProvider" as const;
export const VEXANIUM_ANNOUNCE_PROVIDER_EVENT = "vexanium:announceProvider" as const;

export const VEXANIUM_METHODS = {
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
  chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
} as const satisfies ProviderInfo & { chains: readonly string[] };

export const VSR_SCHEME = "vsr:" as const;
export const DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS = 120;
