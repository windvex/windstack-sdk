import { WISP_ERROR_CODES } from "@windstack/core";

export const VEXANIUM_ERROR_CODES = WISP_ERROR_CODES;

export type VexaniumErrorCode =
  (typeof VEXANIUM_ERROR_CODES)[keyof typeof VEXANIUM_ERROR_CODES];

export class VexaniumProviderError<TData = unknown> extends Error {
  readonly code: VexaniumErrorCode | number;
  readonly data?: TData;

  constructor(code: VexaniumErrorCode | number, message: string, data?: TData) {
    super(message);
    this.name = "VexaniumProviderError";
    this.code = code;
    this.data = data;
  }
}

export function isVexaniumProviderError(value: unknown): value is VexaniumProviderError {
  return value instanceof VexaniumProviderError || (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "number" &&
    Number.isInteger((value as { code: number }).code)
  );
}

export function normalizeVexaniumProviderError(error: unknown): VexaniumProviderError {
  if (error instanceof VexaniumProviderError) return error;
  if (isVexaniumProviderError(error)) {
    const candidate = error as { code: number; message?: unknown; data?: unknown };
    return new VexaniumProviderError(
      candidate.code,
      typeof candidate.message === "string" ? candidate.message : "Vexanium provider request failed",
      candidate.data,
    );
  }
  if (error instanceof Error) {
    return new VexaniumProviderError(VEXANIUM_ERROR_CODES.INTERNAL_ERROR, error.message, error);
  }
  return new VexaniumProviderError(
    VEXANIUM_ERROR_CODES.INTERNAL_ERROR,
    "Vexanium provider request failed",
    error,
  );
}

export function vexaniumInvalidParams(message = "Invalid request parameters", data?: unknown) {
  return new VexaniumProviderError(VEXANIUM_ERROR_CODES.INVALID_PARAMS, message, data);
}

export function vexaniumUnsupportedChain(chainId: string) {
  return new VexaniumProviderError(
    VEXANIUM_ERROR_CODES.UNSUPPORTED_CHAIN,
    `Unsupported Vexanium chain: ${chainId}`,
    { chainId },
  );
}

export function vexaniumUnsupportedCapability(capability: string) {
  return new VexaniumProviderError(
    VEXANIUM_ERROR_CODES.UNSUPPORTED_CAPABILITY,
    `Unsupported Vexanium provider capability: ${capability}`,
    { capability },
  );
}
