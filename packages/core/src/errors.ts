export const WISP_ERROR_CODES = {
  USER_REJECTED: 4001,
  REQUEST_PENDING: -32002,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
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
    typeof (value as { code: unknown }).code === "number"
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
