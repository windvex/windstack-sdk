import { WISP_PROVIDER_CONTRACT } from "@windstack/core";

const { provider, vex } = WISP_PROVIDER_CONTRACT;

export const VEXANIUM_PROVIDER_GLOBAL = vex.global;
export const VEXANIUM_REQUEST_PROVIDER_EVENT = vex.events.requestProvider;
export const VEXANIUM_ANNOUNCE_PROVIDER_EVENT = vex.events.announceProvider;

export const VEXANIUM_PROVIDER_STANDARD = vex.standard;
export const VEXANIUM_PROVIDER_VERSION = vex.version;
export const VEXANIUM_PROVIDER_MAJOR_VERSION = 1 as const;

export const VEXANIUM_CAPABILITIES = {
  ACCOUNTS: vex.capabilities[0],
  SESSIONS: vex.capabilities[1],
  EXACT_TRANSACTION_SIGNING: vex.capabilities[2],
  SIGNING_REQUEST: vex.capabilities[3],
  MESSAGE_SIGNING: vex.capabilities[4],
  DIGEST_SIGNING: vex.capabilities[5],
  EVENTS: vex.capabilities[6],
} as const;

export const VEXANIUM_METHODS = {
  GET_CAPABILITIES: vex.methods.getCapabilities,
  REQUEST_ACCOUNTS: vex.methods.requestAccounts,
  GET_ACCOUNTS: vex.methods.getAccounts,
  GET_CHAIN: vex.methods.getChain,
  SIGNING_REQUEST: vex.methods.signingRequest,
  SIGN_MESSAGE: vex.methods.signMessage,
  SIGN_DIGEST: vex.methods.signDigest,
  SIGN_TRANSACTION: vex.methods.signTransaction,
  DISCONNECT: vex.methods.disconnect,
} as const;

export const WISP_PROVIDER_RDNS = provider.rdns;

export const VEXANIUM_MAINNET_CHAIN_ID = vex.chainId;
export const VEXANIUM_MAINNET_SCOPE = vex.scope;

export const WISP_VEXANIUM_PROVIDER_INFO = {
  uuid: WISP_PROVIDER_RDNS,
  name: provider.name,
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
