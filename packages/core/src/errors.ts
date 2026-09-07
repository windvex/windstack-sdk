export const PROVIDER_ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  REQUEST_PENDING: -32002,
  UNSUPPORTED_CHAIN: -32004,
  UNSUPPORTED_CAPABILITY: -32005,
  INCOMPATIBLE_VERSION: -32006,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES];

export class ProviderRpcError<TData = unknown> extends Error {
  readonly code: ProviderErrorCode | number;
  readonly data?: TData;

  constructor(code: ProviderErrorCode | number, message: string, data?: TData) {
    super(message);
    this.name = "ProviderRpcError";
    this.code = code;
    this.data = data;
  }
}

export function isProviderRpcError(value: unknown): value is ProviderRpcError {
  return (
    value instanceof ProviderRpcError ||
    (typeof value === "object" &&
      value !== null &&
      "code" in value &&
      typeof (value as { code: unknown }).code === "number" &&
      Number.isInteger((value as { code: number }).code))
  );
}

export function normalizeProviderRpcError(error: unknown): ProviderRpcError {
  if (error instanceof ProviderRpcError) return error;
  if (isProviderRpcError(error)) {
    const candidate = error as { code: number; message?: unknown; data?: unknown };
    return new ProviderRpcError(
      candidate.code,
      typeof candidate.message === "string" ? candidate.message : "Provider request failed",
      candidate.data,
    );
  }
  if (error instanceof Error)
    return new ProviderRpcError(PROVIDER_ERROR_CODES.INTERNAL_ERROR, error.message, error);
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.INTERNAL_ERROR,
    "Provider request failed",
    error,
  );
}

export function userRejected(message = "User rejected the request") {
  return new ProviderRpcError(PROVIDER_ERROR_CODES.USER_REJECTED, message);
}

export function requestPending(message = "A wallet request is already pending") {
  return new ProviderRpcError(PROVIDER_ERROR_CODES.REQUEST_PENDING, message);
}

export function methodNotFound(method: string) {
  return new ProviderRpcError(
    PROVIDER_ERROR_CODES.METHOD_NOT_FOUND,
    `Unsupported method: ${method}`,
  );
}

export function invalidParams(message = "Invalid request parameters", data?: unknown) {
  return new ProviderRpcError(PROVIDER_ERROR_CODES.INVALID_PARAMS, message, data);
}

export function internalError(message = "Internal wallet error", data?: unknown) {
  return new ProviderRpcError(PROVIDER_ERROR_CODES.INTERNAL_ERROR, message, data);
}
