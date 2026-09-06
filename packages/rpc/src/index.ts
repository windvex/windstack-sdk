/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type RpcClientOptions = { endpoints: string | string[]; fetch?: FetchLike; timeoutMs?: number; retries?: number };
export type GetInfoResponse = { server_version?: string; chain_id: string; head_block_num: number; last_irreversible_block_num: number; head_block_id: string; head_block_time: string; head_block_producer?: string; [key: string]: unknown };
export type GetBlockResponse = { timestamp: string; producer?: string; confirmed?: number; previous?: string; transaction_mroot?: string; action_mroot?: string; schedule_version?: number; producer_signature?: string; id: string; block_num: number; ref_block_prefix?: number; [key: string]: unknown };
export type TableRowsRequest = { code: string; scope: string; table: string; json?: boolean; lower_bound?: string | number; upper_bound?: string | number; limit?: number; key_type?: string; index_position?: string | number; reverse?: boolean; show_payer?: boolean };
export type TableRowsResponse<T> = { rows: T[]; more: boolean | string; next_key?: string };

export class RpcError extends Error {
  readonly status: number; readonly endpoint: string; readonly payload: unknown;
  constructor(message: string, status: number, endpoint: string, payload?: unknown) { super(message); this.name = "RpcError"; this.status = status; this.endpoint = endpoint; this.payload = payload; }
}

export class RpcClient {
  readonly endpoints: readonly string[];
  readonly #fetch: FetchLike; readonly #timeoutMs: number; readonly #retries: number;
  #cursor = 0;
  constructor(options: RpcClientOptions) {
    const endpoints = (Array.isArray(options.endpoints) ? options.endpoints : [options.endpoints]).map((endpoint) => endpoint.replace(/\/+$/, ""));
    if (!endpoints.length || endpoints.some((endpoint) => !/^https?:\/\//.test(endpoint))) throw new TypeError("At least one http(s) RPC endpoint is required");
    this.endpoints = Object.freeze([...new Set(endpoints)]);
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#retries = Math.max(0, options.retries ?? Math.max(1, this.endpoints.length - 1));
  }
  async request<T>(path: string, body: unknown = {}, signal?: AbortSignal): Promise<T> {
    let lastError: unknown;
    const attempts = Math.min(this.#retries + 1, Math.max(this.endpoints.length, 1) + this.#retries);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const endpoint = this.endpoints[(this.#cursor + attempt) % this.endpoints.length]!;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new DOMException("RPC request timed out", "TimeoutError")), this.#timeoutMs);
      const onAbort = () => controller.abort(signal?.reason);
      if (signal) { if (signal.aborted) controller.abort(signal.reason); else signal.addEventListener("abort", onAbort, { once: true }); }
      try {
        const response = await this.#fetch(`${endpoint}${path}`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), signal: controller.signal });
        const text = await response.text();
        let payload: unknown = null;
        try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
        if (!response.ok) {
          const detail = typeof payload === "object" && payload && "message" in payload ? String((payload as { message: unknown }).message) : response.statusText;
          throw new RpcError(detail || `RPC HTTP ${response.status}`, response.status, endpoint, payload);
        }
        this.#cursor = (this.#cursor + attempt) % this.endpoints.length;
        return payload as T;
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Antelope RPC request failed");
  }
  getInfo(signal?: AbortSignal): Promise<GetInfoResponse> { return this.request("/v1/chain/get_info", {}, signal); }
  getBlock(blockNumOrId: number | string, signal?: AbortSignal): Promise<GetBlockResponse> { return this.request("/v1/chain/get_block", { block_num_or_id: blockNumOrId }, signal); }
  getAccount<T = Record<string, unknown>>(accountName: string, signal?: AbortSignal): Promise<T> { return this.request("/v1/chain/get_account", { account_name: accountName }, signal); }
  getAbi(accountName: string, signal?: AbortSignal): Promise<{ account_name: string; abi: unknown }> { return this.request("/v1/chain/get_abi", { account_name: accountName }, signal); }
  getTableRows<T = Record<string, unknown>>(args: TableRowsRequest, signal?: AbortSignal): Promise<TableRowsResponse<T>> { return this.request("/v1/chain/get_table_rows", { json: true, ...args }, signal); }
  getCurrencyBalance(code: string, account: string, symbol?: string, signal?: AbortSignal): Promise<string[]> { return this.request("/v1/chain/get_currency_balance", { code, account, ...(symbol ? { symbol } : {}) }, signal); }
  getRequiredKeys(transaction: unknown, availableKeys: string[], signal?: AbortSignal): Promise<{ required_keys: string[] }> { return this.request("/v1/chain/get_required_keys", { transaction, available_keys: availableKeys }, signal); }
  pushTransaction<T = Record<string, unknown>>(transaction: { signatures: string[]; compression?: number; packed_context_free_data?: string; packed_trx: string }, signal?: AbortSignal): Promise<T> { return this.request("/v1/chain/push_transaction", { compression: 0, packed_context_free_data: "", ...transaction }, signal); }
}
