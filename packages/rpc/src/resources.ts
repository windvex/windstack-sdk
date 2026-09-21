/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */

export type TransactionResourceReceipt = {
  status: string;
  cpu_usage_us: number;
  net_usage_words: number;
};

export type ComputeTransactionResponse = {
  transaction_id: string;
  processed: {
    receipt: TransactionResourceReceipt | null;
    elapsed?: number;
    net_usage?: number;
    scheduled?: boolean;
    action_traces?: unknown[];
    account_ram_delta?: unknown;
    except?: unknown;
    [key: string]: unknown;
  };
};

export type TransactionResourceUsage = Readonly<{
  status: string;
  cpuUs: number;
  cpuMs: number;
  netWords: number;
  netBytes: number;
  ramDeltaBytes: number;
  ramByAccount: Readonly<Record<string, number>>;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, label: string): number {
  const normalized = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(normalized)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  return normalized as number;
}

function collectRamDelta(value: unknown, totals: Map<string, number>, label: string): boolean {
  const delta = object(value, label);
  if (typeof delta.account !== "string" || !delta.account) {
    throw new TypeError(`${label}.account must be a non-empty string`);
  }
  const bytes = integer(delta.delta, `${label}.delta`);
  totals.set(delta.account, (totals.get(delta.account) ?? 0) + bytes);
  return true;
}

function collectActionTraceRam(value: unknown, totals: Map<string, number>): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const trace = value as Record<string, unknown>;
  let found = false;

  if (Array.isArray(trace.account_ram_deltas)) {
    for (const [index, delta] of trace.account_ram_deltas.entries()) {
      collectRamDelta(delta, totals, `account_ram_deltas[${index}]`);
      found = true;
    }
  }

  if (Array.isArray(trace.inline_traces)) {
    for (const inline of trace.inline_traces) {
      if (collectActionTraceRam(inline, totals)) found = true;
    }
  }

  return found;
}

export function extractTransactionResourceUsage(value: unknown): TransactionResourceUsage {
  const response = object(value, "transaction response");
  const processed = object(response.processed, "transaction response.processed");
  const receipt = object(processed.receipt, "transaction response.processed.receipt");

  if (typeof receipt.status !== "string" || !receipt.status) {
    throw new TypeError("transaction receipt status must be a non-empty string");
  }
  const cpuUs = integer(receipt.cpu_usage_us, "cpu_usage_us");
  const netWords = integer(receipt.net_usage_words, "net_usage_words");
  if (cpuUs < 0 || netWords < 0) {
    throw new RangeError("transaction CPU and NET usage cannot be negative");
  }

  const ramTotals = new Map<string, number>();
  let foundActionRam = false;
  if (Array.isArray(processed.action_traces)) {
    for (const trace of processed.action_traces) {
      if (collectActionTraceRam(trace, ramTotals)) foundActionRam = true;
    }
  }

  if (
    !foundActionRam &&
    processed.account_ram_delta !== undefined &&
    processed.account_ram_delta !== null
  ) {
    const fallback = processed.account_ram_delta;
    if (Array.isArray(fallback)) {
      for (const [index, delta] of fallback.entries()) {
        collectRamDelta(delta, ramTotals, `account_ram_delta[${index}]`);
      }
    } else {
      collectRamDelta(fallback, ramTotals, "account_ram_delta");
    }
  }

  const ramByAccount = Object.freeze(
    Object.fromEntries(
      [...ramTotals.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  const ramDeltaBytes = Object.values(ramByAccount).reduce((sum, bytes) => sum + bytes, 0);

  return Object.freeze({
    status: receipt.status,
    cpuUs,
    cpuMs: cpuUs / 1000,
    netWords,
    netBytes: netWords * 8,
    ramDeltaBytes,
    ramByAccount,
  });
}
