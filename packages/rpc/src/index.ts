/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { ResponseSizeError, readResponseText } from "@windstack/core";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type RpcClientOptions = {
  endpoints: string | readonly string[];
  fetch?: FetchLike;
  timeoutMs?: number;
  retries?: number;
  maxResponseBytes?: number;
  /** Reject every endpoint whose `/v1/chain/get_info` chain id does not match. */
  expectedChainId?: string;
};
export type RpcRequestOptions = {
  retries?: number;
  retry?: "safe" | "never";
  validate?: (value: unknown) => void;
};
export type GetInfoResponse = {
  server_version?: string;
  chain_id: string;
  head_block_num: number;
  last_irreversible_block_num: number;
  head_block_id: string;
  head_block_time: string;
  head_block_producer?: string;
  [key: string]: unknown;
};
export type GetBlockResponse = {
  timestamp: string;
  producer?: string;
  confirmed?: number;
  previous?: string;
  transaction_mroot?: string;
  action_mroot?: string;
  schedule_version?: number;
  producer_signature?: string;
  id: string;
  block_num: number;
  ref_block_prefix?: number;
  [key: string]: unknown;
};
export type TableRowsRequest = {
  code: string;
  scope: string;
  table: string;
  json?: boolean;
  lower_bound?: string | number;
  upper_bound?: string | number;
  limit?: number;
  key_type?: string;
  index_position?: string | number;
  reverse?: boolean;
  show_payer?: boolean;
};
export type TableRowsResponse<T> = { rows: T[]; more: boolean | string; next_key?: string };
export type TableByScopeRequest = {
  code: string;
  table?: string;
  lower_bound?: string;
  upper_bound?: string;
  limit?: number;
  reverse?: boolean;
};
export type TableByScopeRow = {
  code: string;
  scope: string;
  table: string;
  payer: string;
  count: number;
};
export type PackedTransaction = {
  signatures: string[];
  compression?: number;
  packed_context_free_data?: string;
  packed_trx: string;
};
export type SendTransaction2Request = PackedTransaction & {
  return_failure_trace?: boolean;
  retry_trx?: boolean;
};

export class RpcError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly payload: unknown;

  constructor(message: string, status: number, endpoint: string, payload?: unknown) {
    super(message);
    this.name = "RpcError";
    this.status = status;
    this.endpoint = endpoint;
    this.payload = payload;
  }
}

export class RpcTimeoutError extends Error {
  readonly endpoint: string;
  readonly timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number) {
    super(`RPC request to ${endpoint} timed out after ${timeoutMs}ms`);
    this.name = "RpcTimeoutError";
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}

export class RpcResponseError extends RpcError {
  constructor(endpoint: string, status: number, payload: string) {
    super(`RPC response from ${endpoint} is not valid JSON`, status, endpoint, payload);
    this.name = "RpcResponseError";
  }
}

export class RpcResponseTooLargeError extends RpcError {
  readonly maxResponseBytes: number;

  constructor(endpoint: string, status: number, maxResponseBytes: number) {
    super(
      `RPC response from ${endpoint} exceeds the ${maxResponseBytes}-byte limit`,
      status,
      endpoint,
    );
    this.name = "RpcResponseTooLargeError";
    this.maxResponseBytes = maxResponseBytes;
  }
}

export class RpcChainMismatchError extends RpcError {
  readonly expectedChainId: string;
  readonly actualChainId: string;

  constructor(endpoint: string, expectedChainId: string, actualChainId: string, payload?: unknown) {
    super(
      `RPC chain mismatch: expected ${expectedChainId}, received ${actualChainId}`,
      0,
      endpoint,
      payload,
    );
    this.name = "RpcChainMismatchError";
    this.expectedChainId = expectedChainId;
    this.actualChainId = actualChainId;
  }
}

function rpcMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) return record.message;
  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>;
    if (typeof error.what === "string" && error.what) return error.what;
    if (Array.isArray(error.details)) {
      const detail = error.details.find(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).message === "string",
      ) as Record<string, unknown> | undefined;
      if (detail?.message) return String(detail.message);
    }
  }
  return fallback;
}

function isRetriable(error: unknown): boolean {
  if (error instanceof RpcChainMismatchError) return true;
  if (error instanceof RpcResponseTooLargeError) return true;
  if (error instanceof RpcTimeoutError) return true;
  if (error instanceof RpcResponseError) return true;
  if (error instanceof RpcError) {
    return (
      error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500
    );
  }
  return error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
}

const SAFE_RPC_PATHS = new Set([
  "/v1/chain/get_abi",
  "/v1/chain/get_account",
  "/v1/chain/get_block",
  "/v1/chain/get_block_info",
  "/v1/chain/get_code_hash",
  "/v1/chain/get_currency_balance",
  "/v1/chain/get_currency_stats",
  "/v1/chain/get_info",
  "/v1/chain/get_raw_abi",
  "/v1/chain/get_required_keys",
  "/v1/chain/get_table_by_scope",
  "/v1/chain/get_table_rows",
  "/v1/chain/get_transaction_status",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a JSON object`);
  return value as Record<string, unknown>;
}

function uint32(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 0xffffffff)
    throw new TypeError(`${label} must be a uint32 integer`);
  return value as number;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== "string" || !value)
    throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

export function assertGetInfoResponse(value: unknown): asserts value is GetInfoResponse {
  const item = record(value, "get_info response");
  if (!/^[0-9a-f]{64}$/i.test(stringField(item.chain_id, "chain_id")))
    throw new TypeError("chain_id must contain 32 hexadecimal bytes");
  uint32(item.head_block_num, "head_block_num");
  uint32(item.last_irreversible_block_num, "last_irreversible_block_num");
  if (!/^[0-9a-f]{64}$/i.test(stringField(item.head_block_id, "head_block_id")))
    throw new TypeError("head_block_id must contain 32 hexadecimal bytes");
  stringField(item.head_block_time, "head_block_time");
}

export function assertGetBlockResponse(value: unknown): asserts value is GetBlockResponse {
  const item = record(value, "get_block response");
  if (!/^[0-9a-f]{64}$/i.test(stringField(item.id, "block id")))
    throw new TypeError("block id must contain 32 hexadecimal bytes");
  uint32(item.block_num, "block_num");
  stringField(item.timestamp, "block timestamp");
  if (item.ref_block_prefix !== undefined) uint32(item.ref_block_prefix, "ref_block_prefix");
}

export function assertRequiredKeysResponse(
  value: unknown,
): asserts value is { required_keys: string[] } {
  const item = record(value, "get_required_keys response");
  if (
    !Array.isArray(item.required_keys) ||
    !item.required_keys.every((key) => typeof key === "string" && key)
  )
    throw new TypeError("required_keys must be an array of non-empty strings");
}

function assertTableRowsResponse(value: unknown): asserts value is TableRowsResponse<unknown> {
  const response = record(value, "get_table_rows response");
  if (!Array.isArray(response.rows)) throw new TypeError("get_table_rows rows must be an array");
  if (typeof response.more !== "boolean" && typeof response.more !== "string")
    throw new TypeError("get_table_rows more must be a boolean or string");
  if (response.next_key !== undefined && typeof response.next_key !== "string")
    throw new TypeError("get_table_rows next_key must be a string");
}

function assertTableByScopeResponse(
  value: unknown,
): asserts value is { rows: TableByScopeRow[]; more: string } {
  const response = record(value, "get_table_by_scope response");
  if (
    !Array.isArray(response.rows) ||
    !response.rows.every((row) => row && typeof row === "object")
  )
    throw new TypeError("get_table_by_scope rows must be an array of objects");
  if (typeof response.more !== "string")
    throw new TypeError("get_table_by_scope more must be a string");
}

function assertCurrencyBalanceResponse(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((balance) => typeof balance === "string"))
    throw new TypeError("get_currency_balance response must be an array of strings");
}

export class RpcClient {
  readonly endpoints: readonly string[];
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #retries: number;
  readonly #maxResponseBytes: number;
  readonly #expectedChainId?: string;
  readonly #verifiedEndpoints = new Set<string>();
  #cursor = 0;

  constructor(options: RpcClientOptions) {
    const endpoints = [
      ...new Set(
        (typeof options.endpoints === "string" ? [options.endpoints] : options.endpoints).map(
          (endpoint) => {
            const url = new URL(endpoint);
            if (!/^https?:$/.test(url.protocol) || url.username || url.password)
              throw new TypeError("RPC endpoints must be HTTP(S) URLs without credentials");
            return url.toString().replace(/\/$/, "");
          },
        ),
      ),
    ];
    if (!endpoints.length) throw new TypeError("At least one RPC endpoint is required");
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new TypeError("A fetch implementation is required in this runtime");
    }
    const timeoutMs = options.timeoutMs ?? 10_000;
    const retries = options.retries ?? Math.max(0, endpoints.length - 1);
    const maxResponseBytes = options.maxResponseBytes ?? 4 * 1024 * 1024;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new RangeError("timeoutMs must be greater than zero");
    if (!Number.isInteger(retries) || retries < 0)
      throw new RangeError("retries must be a non-negative integer");
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1024)
      throw new RangeError("maxResponseBytes must be at least 1024");

    this.endpoints = Object.freeze(endpoints);
    this.#fetch = fetchImplementation.bind(globalThis);
    this.#timeoutMs = timeoutMs;
    this.#retries = retries;
    this.#maxResponseBytes = maxResponseBytes;
    if (options.expectedChainId && !/^[0-9a-f]{64}$/i.test(options.expectedChainId))
      throw new TypeError("expectedChainId must contain exactly 32 hexadecimal bytes");
    this.#expectedChainId = options.expectedChainId?.toLowerCase();
  }

  async request<T>(
    path: string,
    body: unknown = {},
    signal?: AbortSignal,
    options: RpcRequestOptions = {},
  ): Promise<T> {
    if (!path.startsWith("/")) throw new TypeError("RPC path must start with /");
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error("RPC request aborted");
    }

    const retry = options.retry ?? (SAFE_RPC_PATHS.has(path) ? "safe" : "never");
    const retries = retry === "never" ? 0 : (options.retries ?? this.#retries);
    if (!Number.isInteger(retries) || retries < 0) {
      throw new RangeError("RPC request retries must be a non-negative integer");
    }
    const attempts = retries + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const endpointIndex = (this.#cursor + attempt) % this.endpoints.length;
      const endpoint = this.endpoints[endpointIndex]!;
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.#timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        if (
          this.#expectedChainId &&
          path !== "/v1/chain/get_info" &&
          !this.#verifiedEndpoints.has(endpoint)
        ) {
          const info = await this.#post(endpoint, "/v1/chain/get_info", {}, controller.signal);
          assertGetInfoResponse(info);
          const actual = info.chain_id.toLowerCase();
          if (actual !== this.#expectedChainId)
            throw new RpcChainMismatchError(endpoint, this.#expectedChainId, actual, info);
          this.#verifiedEndpoints.add(endpoint);
        }
        const payload = await this.#post(endpoint, path, body, controller.signal);
        if (path === "/v1/chain/get_info") {
          assertGetInfoResponse(payload);
          if (this.#expectedChainId && payload.chain_id.toLowerCase() !== this.#expectedChainId)
            throw new RpcChainMismatchError(
              endpoint,
              this.#expectedChainId,
              payload.chain_id.toLowerCase(),
              payload,
            );
          this.#verifiedEndpoints.add(endpoint);
        }
        options.validate?.(payload);
        this.#cursor = endpointIndex;
        return payload as T;
      } catch (error) {
        if (signal?.aborted) {
          throw signal.reason instanceof Error ? signal.reason : error;
        }
        lastError = timedOut ? new RpcTimeoutError(endpoint, this.#timeoutMs) : error;
        if (!isRetriable(lastError) || attempt === attempts - 1) break;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Antelope RPC request failed");
  }

  async #post(
    endpoint: string,
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown> {
    const response = await this.#fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    let text: string;
    try {
      text = await readResponseText(response, this.#maxResponseBytes);
    } catch (error) {
      if (error instanceof ResponseSizeError) {
        throw new RpcResponseTooLargeError(endpoint, response.status, this.#maxResponseBytes);
      }
      throw error;
    }
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      if (response.ok) throw new RpcResponseError(endpoint, response.status, text);
      payload = text;
    }
    if (!response.ok) {
      throw new RpcError(
        rpcMessage(payload, response.statusText || `RPC HTTP ${response.status}`),
        response.status,
        endpoint,
        payload,
      );
    }
    return payload;
  }

  async getInfo(signal?: AbortSignal): Promise<GetInfoResponse> {
    const response = await this.request<unknown>("/v1/chain/get_info", {}, signal);
    assertGetInfoResponse(response);
    return response;
  }

  async getBlock(blockNumOrId: number | string, signal?: AbortSignal): Promise<GetBlockResponse> {
    const response = await this.request<unknown>(
      "/v1/chain/get_block",
      { block_num_or_id: blockNumOrId },
      signal,
      { validate: assertGetBlockResponse },
    );
    assertGetBlockResponse(response);
    return response;
  }

  async getBlockInfo(blockNum: number, signal?: AbortSignal): Promise<GetBlockResponse> {
    if (!Number.isInteger(blockNum) || blockNum < 0 || blockNum > 0xffffffff) {
      throw new RangeError("Block number must be a uint32 integer");
    }
    const response = await this.request<unknown>(
      "/v1/chain/get_block_info",
      { block_num: blockNum },
      signal,
      { validate: assertGetBlockResponse },
    );
    assertGetBlockResponse(response);
    return response;
  }

  async getAccount<T = Record<string, unknown>>(
    accountName: string,
    signal?: AbortSignal,
  ): Promise<T> {
    return record(
      await this.request<unknown>("/v1/chain/get_account", { account_name: accountName }, signal, {
        validate: (value) => record(value, "get_account response"),
      }),
      "get_account response",
    ) as T;
  }

  async getAbi(
    accountName: string,
    signal?: AbortSignal,
  ): Promise<{ account_name: string; abi: unknown }> {
    const response = record(
      await this.request<unknown>("/v1/chain/get_abi", { account_name: accountName }, signal, {
        validate: (value) => {
          const item = record(value, "get_abi response");
          stringField(item.account_name, "get_abi account_name");
          if (!("abi" in item)) throw new TypeError("get_abi response is missing abi");
        },
      }),
      "get_abi response",
    );
    stringField(response.account_name, "get_abi account_name");
    if (!("abi" in response)) throw new TypeError("get_abi response is missing abi");
    return response as { account_name: string; abi: unknown };
  }

  async getRawAbi<T = Record<string, unknown>>(
    accountName: string,
    signal?: AbortSignal,
  ): Promise<T> {
    return record(
      await this.request<unknown>("/v1/chain/get_raw_abi", { account_name: accountName }, signal, {
        validate: (value) => record(value, "get_raw_abi response"),
      }),
      "get_raw_abi response",
    ) as T;
  }

  async getCodeHash<T = Record<string, unknown>>(
    accountName: string,
    signal?: AbortSignal,
  ): Promise<T> {
    return record(
      await this.request<unknown>(
        "/v1/chain/get_code_hash",
        { account_name: accountName },
        signal,
        {
          validate: (value) => record(value, "get_code_hash response"),
        },
      ),
      "get_code_hash response",
    ) as T;
  }

  async getTableRows<T = Record<string, unknown>>(
    args: TableRowsRequest,
    signal?: AbortSignal,
  ): Promise<TableRowsResponse<T>> {
    const response = record(
      await this.request<unknown>("/v1/chain/get_table_rows", { json: true, ...args }, signal, {
        validate: assertTableRowsResponse,
      }),
      "get_table_rows response",
    );
    return response as TableRowsResponse<T>;
  }

  async getTableByScope(
    args: TableByScopeRequest,
    signal?: AbortSignal,
  ): Promise<{ rows: TableByScopeRow[]; more: string }> {
    const response = record(
      await this.request<unknown>("/v1/chain/get_table_by_scope", args, signal, {
        validate: assertTableByScopeResponse,
      }),
      "get_table_by_scope response",
    );
    return response as { rows: TableByScopeRow[]; more: string };
  }

  async getCurrencyBalance(
    code: string,
    account: string,
    symbol?: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const response = await this.request<unknown>(
      "/v1/chain/get_currency_balance",
      { code, account, ...(symbol ? { symbol } : {}) },
      signal,
      { validate: assertCurrencyBalanceResponse },
    );
    return response as string[];
  }

  async getCurrencyStats<T = Record<string, unknown>>(
    code: string,
    symbol: string,
    signal?: AbortSignal,
  ): Promise<T> {
    return record(
      await this.request<unknown>("/v1/chain/get_currency_stats", { code, symbol }, signal, {
        validate: (value) => record(value, "get_currency_stats response"),
      }),
      "get_currency_stats response",
    ) as T;
  }

  async getRequiredKeys(
    transaction: unknown,
    availableKeys: string[],
    signal?: AbortSignal,
  ): Promise<{ required_keys: string[] }> {
    const response = await this.request<unknown>(
      "/v1/chain/get_required_keys",
      { transaction, available_keys: availableKeys },
      signal,
      { validate: assertRequiredKeysResponse },
    );
    assertRequiredKeysResponse(response);
    return response;
  }

  pushTransaction<T = Record<string, unknown>>(
    transaction: PackedTransaction,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request(
      "/v1/chain/push_transaction",
      { compression: 0, packed_context_free_data: "", ...transaction },
      signal,
      { retries: 0 },
    );
  }

  sendTransaction<T = Record<string, unknown>>(
    transaction: PackedTransaction,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request(
      "/v1/chain/send_transaction",
      { compression: 0, packed_context_free_data: "", ...transaction },
      signal,
      { retries: 0 },
    );
  }

  sendTransaction2<T = Record<string, unknown>>(
    transaction: SendTransaction2Request,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request(
      "/v1/chain/send_transaction2",
      { compression: 0, packed_context_free_data: "", ...transaction },
      signal,
      { retries: 0 },
    );
  }
}

export {
  AntelopeTransactionHistory,
  HyperionClient,
  HyperionError,
  SpringFinalityClient,
  isSpringTransactionStatusUnsupported,
} from "./history.js";
export type {
  HyperionClientOptions,
  TransactionObservation,
} from "./history.js";
