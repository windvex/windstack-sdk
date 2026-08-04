import { WISP_PROVIDER_CONTRACT } from "./provider-contract.js";

const { errors } = WISP_PROVIDER_CONTRACT;

export const WISP_ERROR_CODES = {
  USER_REJECTED: errors.userRejected,
  UNAUTHORIZED: errors.unauthorized,
  UNSUPPORTED_METHOD: errors.unsupportedMethod,
  DISCONNECTED: errors.disconnected,
  CHAIN_DISCONNECTED: errors.chainDisconnected,
  REQUEST_PENDING: errors.requestPending,
  UNSUPPORTED_CHAIN: errors.unsupportedChain,
  UNSUPPORTED_CAPABILITY: errors.unsupportedCapability,
  INCOMPATIBLE_VERSION: errors.incompatibleVersion,
  INVALID_REQUEST: errors.invalidRequest,
  METHOD_NOT_FOUND: errors.methodNotFound,
  INVALID_PARAMS: errors.invalidParams,
  INTERNAL_ERROR: errors.internalError,
} as const;

export type WispErrorCode = (typeof WISP_ERROR_CODES)[keyof typeof WISP_ERROR_CODES];

export class WispProviderError<TData = unknown> extends Error {
  readonly code: WispErrorCode | number;
  readonly data?: TData;

  constructor(code: WispErrorCode | number, message: string, data?: TData) {
    super(message);
    this.name = "WispProviderError";
    this.code = code;
    this.data = data;
  }
}

export function isWispProviderError(value: unknown): value is WispProviderError {
  return value instanceof WispProviderError || (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "number" &&
    Number.isInteger((value as { code: number }).code)
  );
}

export function userRejected(message = "User rejected the request") {
  return new WispProviderError(WISP_ERROR_CODES.USER_REJECTED, message);
}

export function requestPending(message = "A wallet request is already pending") {
  return new WispProviderError(WISP_ERROR_CODES.REQUEST_PENDING, message);
}

export function methodNotFound(method: string) {
  return new WispProviderError(WISP_ERROR_CODES.METHOD_NOT_FOUND, `Unsupported method: ${method}`);
}

export function invalidParams(message = "Invalid request parameters", data?: unknown) {
  return new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, message, data);
}

export function internalError(message = "Internal wallet error", data?: unknown) {
  return new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, message, data);
}

export function normalizeProviderError(error: unknown): WispProviderError {
  if (error instanceof WispProviderError) return error;
  if (isWispProviderError(error)) {
    const candidate = error as { code: number; message?: unknown; data?: unknown };
    return new WispProviderError(
      candidate.code,
      typeof candidate.message === "string" ? candidate.message : "Wallet request failed",
      candidate.data,
    );
  }
  if (error instanceof Error) return internalError(error.message, error);
  return internalError("Wallet request failed", error);
}
