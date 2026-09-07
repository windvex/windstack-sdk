/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { readResponseText } from "@windstack/core";
import { type FetchLike, type RpcClient, RpcError } from "./index.js";

const TRANSACTION_ID = /^[0-9a-f]{64}$/;

export type TransactionObservation =
  | Readonly<{ state: "unknown"; transactionId: string }>
  | Readonly<{ state: "locally_applied"; transactionId: string; irreversibleBlock: number }>
  | Readonly<{
      state: "in_block";
      transactionId: string;
      blockNumber: number;
      irreversibleBlock: number;
    }>
  | Readonly<{
      state: "irreversible";
      transactionId: string;
      blockNumber: number;
      irreversibleBlock: number;
    }>
  | Readonly<{ state: "failed"; transactionId: string; irreversibleBlock: number }>
  | Readonly<{ state: "forked_out"; transactionId: string; irreversibleBlock: number }>;

function transactionId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!TRANSACTION_ID.test(normalized)) throw new TypeError("Invalid Antelope transaction id");
  return normalized;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function blockNumber(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 0xffffffff)
    throw new TypeError(`${label} must be a uint32 integer`);
  return value as number;
}

function assertSpringStatusPayload(value: unknown): void {
  const payload = object(value, "Spring transaction status");
  const state = String(payload.state);
  if (
    !["UNKNOWN", "LOCALLY_APPLIED", "IN_BLOCK", "IRREVERSIBLE", "FAILED", "FORKED_OUT"].includes(
      state,
    )
  ) {
    throw new TypeError("Spring returned an unknown transaction state");
  }
  blockNumber(payload.irreversible_number, "irreversible_number");
  if (state === "IN_BLOCK" || state === "IRREVERSIBLE") {
    blockNumber(payload.block_number, "block_number");
  }
}

export function isSpringTransactionStatusUnsupported(error: unknown): boolean {
  if (!(error instanceof RpcError)) return false;
  if (error.status === 404) return true;
  const text = `${error.message} ${JSON.stringify(error.payload ?? "")}`.toLowerCase();
  return (
    text.includes("transaction status interface not enabled") ||
    text.includes("get_transaction_status is not enabled") ||
    (text.includes("unsupported_feature") && text.includes("transaction"))
  );
}

export class SpringFinalityClient {
  constructor(readonly rpc: RpcClient) {}

  async getTransactionStatus(id: string, signal?: AbortSignal): Promise<TransactionObservation> {
    const normalized = transactionId(id);
    const payload = object(
      await this.rpc.request<unknown>(
        "/v1/chain/get_transaction_status",
        { id: normalized },
        signal,
        { retry: "safe", validate: assertSpringStatusPayload },
      ),
      "Spring transaction status",
    );
    const state = payload.state;
    const irreversibleBlock = blockNumber(payload.irreversible_number, "irreversible_number");
    if (state === "UNKNOWN") return Object.freeze({ state: "unknown", transactionId: normalized });
    if (state === "LOCALLY_APPLIED")
      return Object.freeze({
        state: "locally_applied",
        transactionId: normalized,
        irreversibleBlock,
      });
    if (state === "FAILED")
      return Object.freeze({ state: "failed", transactionId: normalized, irreversibleBlock });
    if (state === "FORKED_OUT")
      return Object.freeze({ state: "forked_out", transactionId: normalized, irreversibleBlock });
    const included = blockNumber(payload.block_number, "block_number");
    return Object.freeze({
      state:
        state === "IRREVERSIBLE" || irreversibleBlock >= included ? "irreversible" : "in_block",
      transactionId: normalized,
      blockNumber: included,
      irreversibleBlock,
    });
  }
}

export class HyperionError extends Error {
  readonly status?: number;
  readonly url: string;

  constructor(message: string, url: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "HyperionError";
    this.status = status;
    this.url = url;
  }
}

export type HyperionClientOptions = {
  endpoint: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export class HyperionClient {
  readonly endpoint: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;

  constructor(options: HyperionClientOptions) {
    const endpoint = new URL(options.endpoint);
    if (!/^https?:$/.test(endpoint.protocol) || endpoint.username || endpoint.password)
      throw new TypeError("Hyperion endpoint must be an HTTP(S) URL without credentials");
    this.endpoint = endpoint.toString().replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
    if (typeof this.#fetch !== "function")
      throw new TypeError("A fetch implementation is required");
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxResponseBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs <= 0)
      throw new RangeError("Hyperion timeoutMs must be positive");
    if (!Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1024)
      throw new RangeError("Hyperion maxResponseBytes must be at least 1024");
  }

  async health(signal?: AbortSignal): Promise<Readonly<Record<string, string>>> {
    const payload = object(await this.#get("/v2/health", undefined, signal), "Hyperion health");
    if (!Array.isArray(payload.health)) throw new TypeError("Hyperion health list is missing");
    const services: Record<string, string> = {};
    for (const value of payload.health) {
      const item = object(value, "Hyperion health service");
      if (typeof item.service !== "string" || typeof item.status !== "string")
        throw new TypeError("Malformed Hyperion health service");
      services[item.service] = item.status;
    }
    return Object.freeze(services);
  }

  async assertAvailable(signal?: AbortSignal): Promise<void> {
    const health = await this.health(signal);
    for (const service of ["Elasticsearch", "NodeosRPC"]) {
      if (health[service]?.toUpperCase() !== "OK")
        throw new HyperionError(`Hyperion ${service} health is not OK`, this.endpoint);
    }
  }

  async getTransaction(id: string, signal?: AbortSignal): Promise<TransactionObservation> {
    const normalized = transactionId(id);
    const payload = object(
      await this.#get("/v2/history/get_transaction", { id: normalized }, signal),
      "Hyperion transaction",
    );
    if (typeof payload.trx_id !== "string" || payload.trx_id.toLowerCase() !== normalized)
      throw new HyperionError("Hyperion returned an unexpected transaction id", this.endpoint);
    if (payload.error)
      throw new HyperionError("Hyperion transaction lookup reported an error", this.endpoint);
    if (payload.executed === false)
      return Object.freeze({ state: "unknown", transactionId: normalized });
    if (
      payload.executed !== true ||
      !Array.isArray(payload.actions) ||
      payload.actions.length === 0
    )
      throw new TypeError("Malformed executed Hyperion transaction");
    const blocks = payload.actions.map((value) =>
      blockNumber(object(value, "Hyperion action").block_num, "block_num"),
    );
    const included = Math.max(...blocks);
    const irreversibleBlock =
      payload.lib === null || payload.lib === undefined ? 0 : blockNumber(payload.lib, "lib");
    return Object.freeze({
      state: irreversibleBlock >= included ? "irreversible" : "in_block",
      transactionId: normalized,
      blockNumber: included,
      irreversibleBlock,
    });
  }

  async #get(path: string, query?: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(path, `${this.endpoint}/`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.#fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const text = await readResponseText(response, this.#maxResponseBytes);
      if (!response.ok)
        throw new HyperionError(
          `Hyperion returned HTTP ${response.status}`,
          url.toString(),
          response.status,
        );
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new HyperionError("Hyperion returned invalid JSON", url.toString(), response.status, {
          cause,
        });
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      if (error instanceof HyperionError) throw error;
      throw new HyperionError(
        controller.signal.aborted
          ? `Hyperion request timed out after ${this.#timeoutMs}ms`
          : "Hyperion request failed",
        url.toString(),
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}

/** Spring is authoritative while it tracks a transaction; Hyperion is used only for unknown/unsupported history. */
export class AntelopeTransactionHistory {
  constructor(
    readonly spring: SpringFinalityClient,
    readonly hyperion: HyperionClient,
  ) {}

  async getTransaction(id: string, signal?: AbortSignal): Promise<TransactionObservation> {
    try {
      const observation = await this.spring.getTransactionStatus(id, signal);
      if (observation.state !== "unknown") return observation;
    } catch (error) {
      if (!isSpringTransactionStatusUnsupported(error)) throw error;
    }
    return this.hyperion.getTransaction(id, signal);
  }
}
