import { readResponseText } from "@windstack/core";
import { normalizeEvmChainId } from "./address.js";

export type EvmFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type EvmRpcClientOptions = {
  endpoints: string | readonly string[];
  fetch?: EvmFetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  expectedChainId?: string | number | bigint;
};

export type EvmRpcRequestOptions = {
  signal?: AbortSignal;
  /** Read-only calls may fail over; writes are never retried automatically. */
  retry?: "safe" | "never";
};

export class EvmRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;
  readonly endpoint: string;

  constructor(message: string, code: number, endpoint: string, data?: unknown) {
    super(message);
    this.name = "EvmRpcError";
    this.code = code;
    this.endpoint = endpoint;
    this.data = data;
  }
}

export class EvmRpcTransportError extends Error {
  readonly endpoint: string;
  readonly status?: number;

  constructor(message: string, endpoint: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "EvmRpcTransportError";
    this.endpoint = endpoint;
    this.status = status;
  }
}

const SAFE_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "net_version",
  "web3_clientVersion",
]);

function endpoints(value: string | readonly string[]): string[] {
  const result = [
    ...new Set(
      (typeof value === "string" ? [value] : value).map((item) => {
        const url = new URL(item);
        if (url.protocol !== "https:" && url.protocol !== "http:")
          throw new TypeError("EVM RPC endpoints must use HTTP or HTTPS");
        if (url.username || url.password)
          throw new TypeError("EVM RPC endpoints cannot include credentials");
        return url.toString().replace(/\/$/, "");
      }),
    ),
  ];
  if (!result.length) throw new TypeError("At least one EVM RPC endpoint is required");
  return result;
}

export class EvmRpcClient {
  readonly endpoints: readonly string[];
  readonly #fetch: EvmFetch;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #expectedChainId?: `0x${string}`;
  readonly #verified = new Set<string>();
  #id = 0;

  constructor(options: EvmRpcClientOptions) {
    this.endpoints = Object.freeze(endpoints(options.endpoints));
    this.#fetch = options.fetch ?? globalThis.fetch;
    if (typeof this.#fetch !== "function")
      throw new TypeError("A fetch implementation is required");
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxResponseBytes = options.maxResponseBytes ?? 4 * 1024 * 1024;
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0)
      throw new RangeError("timeoutMs must be positive");
    if (!Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1024)
      throw new RangeError("maxResponseBytes must be at least 1024");
    this.#expectedChainId =
      options.expectedChainId === undefined
        ? undefined
        : normalizeEvmChainId(options.expectedChainId);
  }

  async request<TResult = unknown>(
    method: string,
    params: readonly unknown[] | Record<string, unknown> = [],
    options: EvmRpcRequestOptions = {},
  ): Promise<TResult> {
    if (typeof method !== "string" || !method) throw new TypeError("JSON-RPC method is required");
    const canRetry = options.retry === "safe" && SAFE_METHODS.has(method);
    const candidates = canRetry ? this.endpoints : this.endpoints.slice(0, 1);
    let lastError: unknown;
    for (const endpoint of candidates) {
      try {
        if (this.#expectedChainId && method !== "eth_chainId") {
          await this.#verifyEndpoint(endpoint, options.signal);
        }
        const result = await this.#post<TResult>(endpoint, method, params, options.signal);
        if (method === "eth_chainId" && this.#expectedChainId) {
          const actual = normalizeEvmChainId(result as string);
          if (actual !== this.#expectedChainId)
            throw new EvmRpcTransportError(
              `EVM chain mismatch: expected ${this.#expectedChainId}, received ${actual}`,
              endpoint,
            );
          this.#verified.add(endpoint);
        }
        return result;
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason ?? error;
        lastError = error;
        if (!canRetry || error instanceof EvmRpcError) break;
      }
    }
    throw lastError;
  }

  async #verifyEndpoint(endpoint: string, signal?: AbortSignal): Promise<void> {
    if (this.#verified.has(endpoint)) return;
    const chainId = normalizeEvmChainId(
      await this.#post<string>(endpoint, "eth_chainId", [], signal),
    );
    if (chainId !== this.#expectedChainId)
      throw new EvmRpcTransportError(
        `EVM chain mismatch: expected ${this.#expectedChainId}, received ${chainId}`,
        endpoint,
      );
    this.#verified.add(endpoint);
  }

  async #post<TResult>(
    endpoint: string,
    method: string,
    params: readonly unknown[] | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<TResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const id = ++this.#id;
    try {
      const response = await this.#fetch(endpoint, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        signal: controller.signal,
      });
      const text = await readResponseText(response, this.#maxResponseBytes);
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch (cause) {
        throw new EvmRpcTransportError("EVM RPC returned invalid JSON", endpoint, response.status, {
          cause,
        });
      }
      if (!response.ok)
        throw new EvmRpcTransportError(
          `EVM RPC returned HTTP ${response.status}`,
          endpoint,
          response.status,
        );
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new EvmRpcTransportError(
          "EVM RPC returned a malformed response",
          endpoint,
          response.status,
        );
      const record = payload as Record<string, unknown>;
      if (record.jsonrpc !== "2.0" || record.id !== id)
        throw new EvmRpcTransportError(
          "EVM RPC response id or version mismatch",
          endpoint,
          response.status,
        );
      if (record.error && typeof record.error === "object") {
        const error = record.error as Record<string, unknown>;
        if (!Number.isInteger(error.code) || typeof error.message !== "string")
          throw new EvmRpcTransportError(
            "EVM RPC returned a malformed error",
            endpoint,
            response.status,
          );
        throw new EvmRpcError(error.message, error.code as number, endpoint, error.data);
      }
      if (!("result" in record))
        throw new EvmRpcTransportError(
          "EVM RPC response is missing result",
          endpoint,
          response.status,
        );
      return record.result as TResult;
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      if (error instanceof EvmRpcError || error instanceof EvmRpcTransportError) throw error;
      throw new EvmRpcTransportError(
        controller.signal.aborted
          ? `EVM RPC timed out after ${this.#timeoutMs}ms`
          : "EVM RPC request failed",
        endpoint,
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
