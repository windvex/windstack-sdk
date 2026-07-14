import {
  VEXANIUM_PROVIDER_MAJOR_VERSION,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
} from "./constants.js";
import {
  VEXANIUM_ERROR_CODES,
  VexaniumProviderError,
  vexaniumUnsupportedCapability,
} from "./errors.js";
import type {
  VexaniumCapabilitiesResponse,
  VexaniumCapability,
  VexaniumConnectResponse,
  VexaniumProviderInfo,
} from "./types.js";
import { isVexaniumChainId, isVexaniumFullChainId } from "./validation.js";

const SEMVER_PATTERN = new RegExp(
  "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
  "(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$",
);
const RDNS_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function allUnique(values: unknown[]): boolean {
  return new Set(values).size === values.length;
}

function isSafeIcon(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  if (value.startsWith("data:image/")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function parseMajor(version: string): number | null {
  const match = SEMVER_PATTERN.exec(version.trim());
  return match ? Number(match[1]) : null;
}

export function isCompatibleVexaniumProviderVersion(version: string): boolean {
  return parseMajor(version) === VEXANIUM_PROVIDER_MAJOR_VERSION;
}

export function assertCompatibleVexaniumProviderVersion(version: string): void {
  if (!isCompatibleVexaniumProviderVersion(version)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INCOMPATIBLE_VERSION,
      `Incompatible VexaniumProvider version: ${version}. SDK supports ${VEXANIUM_PROVIDER_VERSION}.`,
      {
        requestedVersion: VEXANIUM_PROVIDER_VERSION,
        providerVersion: version,
        requiredMajor: VEXANIUM_PROVIDER_MAJOR_VERSION,
      },
    );
  }
}

export function isVexaniumProviderInfo(value: unknown): value is VexaniumProviderInfo {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.uuid) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.rdns) &&
    RDNS_PATTERN.test(value.rdns) &&
    value.standard === VEXANIUM_PROVIDER_STANDARD &&
    isNonEmptyString(value.version) &&
    parseMajor(value.version) !== null &&
    Array.isArray(value.chains) &&
    value.chains.every(isVexaniumChainId) &&
    allUnique(value.chains) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every(isNonEmptyString) &&
    allUnique(value.capabilities) &&
    isSafeIcon(value.icon)
  );
}

export function assertVexaniumProviderInfo(value: unknown): asserts value is VexaniumProviderInfo {
  if (!isVexaniumProviderInfo(value)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Provider does not expose valid mandatory VexaniumProvider v1 providerInfo",
      { standard: VEXANIUM_PROVIDER_STANDARD, version: VEXANIUM_PROVIDER_VERSION },
    );
  }
  assertCompatibleVexaniumProviderVersion(value.version);
}

export function assertVexaniumCapabilitiesResponse(
  value: unknown,
  requiredCapabilities: readonly VexaniumCapability[] = [],
): asserts value is VexaniumCapabilitiesResponse {
  if (!isRecord(value)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Invalid vex_getCapabilities response",
    );
  }
  if (
    value.standard !== VEXANIUM_PROVIDER_STANDARD ||
    !isNonEmptyString(value.version) ||
    !Array.isArray(value.capabilities) ||
    !value.capabilities.every(isNonEmptyString) ||
    !Array.isArray(value.chains) ||
    !value.chains.every(isVexaniumChainId) ||
    !Array.isArray(value.methods) ||
    !value.methods.every(isNonEmptyString) ||
    !allUnique(value.capabilities) ||
    !allUnique(value.chains) ||
    !allUnique(value.methods)
  ) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Malformed vex_getCapabilities response",
      value,
    );
  }

  assertCompatibleVexaniumProviderVersion(value.version);
  for (const capability of requiredCapabilities) {
    if (!value.capabilities.includes(capability)) {
      throw vexaniumUnsupportedCapability(capability);
    }
  }
}

export function assertVexaniumConnectResponse(value: unknown): asserts value is VexaniumConnectResponse {
  if (!isRecord(value)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Invalid vex_requestAccounts response",
    );
  }

  if (
    value.standard !== VEXANIUM_PROVIDER_STANDARD ||
    !isNonEmptyString(value.version) ||
    !isNonEmptyString(value.sessionId) ||
    !isVexaniumFullChainId(value.chainId) ||
    !Array.isArray(value.accounts) ||
    value.accounts.length === 0 ||
    !Array.isArray(value.capabilities) ||
    !value.capabilities.every(isNonEmptyString) ||
    !allUnique(value.capabilities)
  ) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Malformed VexaniumProvider v1 connect response",
      value,
    );
  }

  assertCompatibleVexaniumProviderVersion(value.version);
}
