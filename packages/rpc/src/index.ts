/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type RpcClientOptions = {
  endpoints: string | string[];
  fetch?: FetchLike;
  timeoutMs?: number;
  retries?: number;
};
export type RpcRequestOptions = { retries?: number };
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

function rpcMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) return record.message;
  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>;
    if (typeof error.what === "string" && error.what) return error.what;
    if (Array.isArray(error.details)) {
      const detail = error.details.find(
        (item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).message === "string",
      ) as Record<string, unknown> | undefined;
      if (detail?.message) return String(detail.message);
    }
  }
  return fallback;
}

function isRetriable(error: unknown): boolean {
  if (error instanceof RpcTimeoutError) return true;
  if (error instanceof RpcError) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError || (error instanceof Error && error.name === "AbortError");
}

export class RpcClient {
  readonly endpoints: readonly string[];
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #retries: number;
  #cursor = 0;

  constructor(options: RpcClientOptions) {
    const endpoints = (Array.isArray(options.endpoints) ? options.endpoints : [options.endpoints])
      .map((endpoint) => endpoint.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    if (!endpoints.length || endpoints.some((endpoint) => !/^https?:\/\//.test(endpoint))) {
      throw new TypeError("At least one http(s) RPC endpoint is required");
    }
    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") {
      throw new TypeError("A fetch implementation is required in this runtime");
    }
    const timeoutMs = options.timeoutMs ?? 10_000;
    const retries = options.retries ?? Math.max(0, endpoints.length - 1);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("timeoutMs must be greater than zero");
    if (!Number.isInteger(retries) || retries < 0) throw new RangeError("retries must be a non-negative integer");

    this.endpoints = Object.freeze([...new Set(endpoints)]);
    this.#fetch = fetchImplementation.bind(globalThis);
    this.#timeoutMs = timeoutMs;
    this.#retries = retries;
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

    const retries = options.retries ?? this.#retries;
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
        const response = await this.#fetch(`${endpoint}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await response.text();
        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
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

  getInfo(signal?: AbortSignal): Promise<GetInfoResponse> {
    return this.request("/v1/chain/get_info", {}, signal);
  }

  getBlock(blockNumOrId: number | string, signal?: AbortSignal): Promise<GetBlockResponse> {
    return this.request("/v1/chain/get_block", { block_num_or_id: blockNumOrId }, signal);
  }

  getAccount<T = Record<string, unknown>>(accountName: string, signal?: AbortSignal): Promise<T> {
    return this.request("/v1/chain/get_account", { account_name: accountName }, signal);
  }

  getAbi(accountName: string, signal?: AbortSignal): Promise<{ account_name: string; abi: unknown }> {
    return this.request("/v1/chain/get_abi", { account_name: accountName }, signal);
  }

  getRawAbi<T = Record<string, unknown>>(accountName: string, signal?: AbortSignal): Promise<T> {
    return this.request("/v1/chain/get_raw_abi", { account_name: accountName }, signal);
  }

  getCodeHash<T = Record<string, unknown>>(accountName: string, signal?: AbortSignal): Promise<T> {
    return this.request("/v1/chain/get_code_hash", { account_name: accountName }, signal);
  }

  getTableRows<T = Record<string, unknown>>(
    args: TableRowsRequest,
    signal?: AbortSignal,
  ): Promise<TableRowsResponse<T>> {
    return this.request("/v1/chain/get_table_rows", { json: true, ...args }, signal);
  }

  getTableByScope(
    args: TableByScopeRequest,
    signal?: AbortSignal,
  ): Promise<{ rows: TableByScopeRow[]; more: string }> {
    return this.request("/v1/chain/get_table_by_scope", args, signal);
  }

  getCurrencyBalance(
    code: string,
    account: string,
    symbol?: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    return this.request(
      "/v1/chain/get_currency_balance",
      { code, account, ...(symbol ? { symbol } : {}) },
      signal,
    );
  }

  getCurrencyStats<T = Record<string, unknown>>(
    code: string,
    symbol: string,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request("/v1/chain/get_currency_stats", { code, symbol }, signal);
  }

  getRequiredKeys(
    transaction: unknown,
    availableKeys: string[],
    signal?: AbortSignal,
  ): Promise<{ required_keys: string[] }> {
    return this.request(
      "/v1/chain/get_required_keys",
      { transaction, available_keys: availableKeys },
      signal,
    );
  }

  pushTransaction<T = Record<string, unknown>>(
    transaction: {
      signatures: string[];
      compression?: number;
      packed_context_free_data?: string;
      packed_trx: string;
    },
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request(
      "/v1/chain/push_transaction",
      { compression: 0, packed_context_free_data: "", ...transaction },
      signal,
      { retries: 0 },
    );
  }
}
