/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { formatAsset, parseAsset } from "@windstack/abi";
import {
  extractTransactionResourceUsage,
  type AccountResourceLimit,
  type AccountResources,
  type ComputeTransactionResponse,
  type TransactionResourceUsage,
} from "@windstack/antelope";

const VEX_SYMBOL = "VEX";
const VEX_PRECISION = 4;
const RAM_FEE_BPS = 50;
const STAKE_SAFETY_BPS = 1000;
const SETCODE_RAM_BYTES_MULTIPLIER = 10;

export type VexaniumResourceCertainty = "exact" | "minimum" | "estimate" | "unknown";
export type VexaniumResourceStatus = "sufficient" | "insufficient_resources";

export type VexaniumCpuRequirement = Readonly<{
  availableUs: number;
  requiredUs: number | null;
  deficitUs: number | null;
  sufficient: boolean | null;
  certainty: VexaniumResourceCertainty;
}>;

export type VexaniumNetRequirement = Readonly<{
  availableBytes: number;
  requiredBytes: number | null;
  deficitBytes: number | null;
  sufficient: boolean | null;
  certainty: VexaniumResourceCertainty;
}>;

export type VexaniumRamRequirement = Readonly<{
  availableBytes: number;
  requiredBytes: number | null;
  deficitBytes: number | null;
  sufficient: boolean | null;
  certainty: VexaniumResourceCertainty;
}>;

export type VexaniumResourceRequirements = Readonly<{
  cpu: VexaniumCpuRequirement;
  net: VexaniumNetRequirement;
  ram: VexaniumRamRequirement;
}>;

export type VexaniumStakeFundingQuote = Readonly<{
  currentStakeVex: string | null;
  minimumTotalStakeVex: string | null;
  minimumAdditionalStakeVex: string | null;
  suggestedTotalStakeVex: string | null;
  suggestedAdditionalStakeVex: string | null;
  safetyBps: number;
}>;

export type VexaniumRamMarketRow = {
  supply?: unknown;
  base?: { balance?: unknown; weight?: unknown };
  quote?: { balance?: unknown; weight?: unknown };
  [key: string]: unknown;
};

export type VexaniumRamMarketQuote = Readonly<{
  bytes: number;
  estimatedCostVex: string;
  feeBps: number;
  market: Readonly<{
    ramReserveBytes: string;
    vexReserve: string;
  }>;
}>;

export type VexaniumRamFundingQuote = Readonly<{
  deficitBytes: number | null;
  estimatedPurchaseVex: string | null;
  quote: VexaniumRamMarketQuote | null;
}>;

export type VexaniumResourceFunding = Readonly<{
  cpu: VexaniumStakeFundingQuote;
  net: VexaniumStakeFundingQuote;
  ram: VexaniumRamFundingQuote;
}>;

export type VexaniumStakeSnapshot = Readonly<{
  cpuStakeVex: string | null;
  netStakeVex: string | null;
}>;

export type VexaniumResourceAssessment = Readonly<{
  usage: TransactionResourceUsage;
  requirements: VexaniumResourceRequirements;
  resourceFailure: boolean;
  exception?: unknown;
}>;

type ResourceFailure = Readonly<{
  resource: "cpu" | "net" | "ram";
  name: string;
  required: number | null;
  limit: number | null;
  ramNeedsTotal: number | null;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(normalized) && (normalized as number) >= 0
    ? (normalized as number)
    : null;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError("ceilDiv expects a non-negative numerator and positive denominator");
  }
  return (numerator + denominator - 1n) / denominator;
}

function requirement(
  available: number,
  required: number | null,
  certainty: VexaniumResourceCertainty,
) {
  const deficit = required === null ? null : Math.max(0, required - available);
  return {
    required,
    deficit,
    sufficient: required === null ? null : deficit === 0,
    certainty,
  };
}

function exceptionData(exception: unknown): Record<string, unknown>[] {
  const item = record(exception);
  if (!item || !Array.isArray(item.stack)) return [];
  const result: Record<string, unknown>[] = [];
  for (const entry of item.stack) {
    const data = record(record(entry)?.data);
    if (data) result.push(data);
  }
  return result;
}

function firstInteger(
  values: readonly Record<string, unknown>[],
  keys: readonly string[],
): number | null {
  for (const value of values) {
    for (const key of keys) {
      const parsed = nonNegativeInteger(value[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function resourceFailure(response: ComputeTransactionResponse): ResourceFailure | null {
  const exception = record(response.processed.except);
  const name = typeof exception?.name === "string" ? exception.name : "";
  const data = exceptionData(response.processed.except);

  if (name === "tx_net_usage_exceeded") {
    return Object.freeze({
      resource: "net",
      name,
      required:
        firstInteger(data, ["net_usage"]) ?? nonNegativeInteger(response.processed.net_usage),
      limit: firstInteger(data, ["net_limit"]),
      ramNeedsTotal: null,
    });
  }

  if (name === "tx_cpu_usage_exceeded") {
    return Object.freeze({
      resource: "cpu",
      name,
      required: firstInteger(data, ["billed"]) ?? nonNegativeInteger(response.processed.elapsed),
      limit: firstInteger(data, ["limit", "billable"]),
      ramNeedsTotal: null,
    });
  }

  if (name === "ram_usage_exceeded") {
    return Object.freeze({
      resource: "ram",
      name,
      required: null,
      limit: firstInteger(data, ["available"]),
      ramNeedsTotal: firstInteger(data, ["needs"]),
    });
  }

  return null;
}

function collectRamDelta(value: unknown, totals: Map<string, number>): void {
  const item = record(value);
  if (!item || typeof item.account !== "string") return;
  const delta = nonNegativeInteger(item.delta);
  if (delta !== null) totals.set(item.account, (totals.get(item.account) ?? 0) + delta);
}

function collectTraceRam(value: unknown, totals: Map<string, number>): void {
  const trace = record(value);
  if (!trace) return;
  if (Array.isArray(trace.account_ram_deltas)) {
    for (const delta of trace.account_ram_deltas) collectRamDelta(delta, totals);
  }
  if (Array.isArray(trace.inline_traces)) {
    for (const inline of trace.inline_traces) collectTraceRam(inline, totals);
  }
}

function observedRamByAccount(
  response: ComputeTransactionResponse,
): Readonly<Record<string, number>> {
  const totals = new Map<string, number>();
  if (Array.isArray(response.processed.action_traces)) {
    for (const trace of response.processed.action_traces) collectTraceRam(trace, totals);
  }
  return Object.freeze(
    Object.fromEntries([...totals.entries()].sort(([left], [right]) => left.localeCompare(right))),
  );
}

function observedUsage(
  response: ComputeTransactionResponse,
  failure: ResourceFailure,
): TransactionResourceUsage {
  const ramByAccount = observedRamByAccount(response);
  const ramDeltaBytes = Object.values(ramByAccount).reduce((sum, bytes) => sum + bytes, 0);
  const cpuUs =
    failure.resource === "cpu"
      ? (failure.required ?? nonNegativeInteger(response.processed.elapsed) ?? 0)
      : (nonNegativeInteger(response.processed.elapsed) ?? 0);
  const netBytes =
    nonNegativeInteger(response.processed.net_usage) ??
    (failure.resource === "net" ? (failure.required ?? 0) : 0);

  return Object.freeze({
    status: "resource_exhausted",
    cpuUs,
    cpuMs: cpuUs / 1000,
    netWords: Math.ceil(netBytes / 8),
    netBytes,
    ramDeltaBytes,
    ramByAccount,
  });
}

function byteLength(value: unknown): number | null {
  if (value instanceof Uint8Array) return value.length;
  if (typeof value === "string") {
    const hex = value.startsWith("0x") ? value.slice(2) : value;
    if (/^(?:[0-9a-f]{2})*$/i.test(hex)) return hex.length / 2;
  }
  if (
    Array.isArray(value) &&
    value.every((item) => Number.isInteger(item) && item >= 0 && item <= 0xff)
  ) {
    return value.length;
  }
  return null;
}

/**
 * Estimate RAM charged by Vexanium native setcode/setabi actions before execution reaches RAM billing.
 * setcode uses the VexChain protocol's 10x code-size RAM multiplier. Existing code/ABI replacement can
 * reduce the actual delta, so callers should treat this as an estimate until compute_transaction succeeds.
 */
export function estimateVexaniumActionRamBytes(
  actions: readonly { account: string; name: string; data: unknown }[],
  actor: string,
  systemContract = "vexcore",
): number | null {
  let total = 0;
  let found = false;

  for (const action of actions) {
    if (action.account !== systemContract) continue;
    const data = record(action.data);
    if (!data || data.account !== actor) continue;

    if (action.name === "setcode") {
      const bytes = byteLength(data.code);
      if (bytes !== null) {
        total += bytes * SETCODE_RAM_BYTES_MULTIPLIER;
        found = true;
      }
    } else if (action.name === "setabi") {
      const bytes = byteLength(data.abi);
      if (bytes !== null) {
        total += bytes;
        found = true;
      }
    }
  }

  return found ? total : null;
}

export function assessVexaniumResourceResponse(
  response: ComputeTransactionResponse,
  resources: AccountResources,
  account: string,
  estimatedRamBytes: number | null = null,
): VexaniumResourceAssessment | null {
  const exception = response.processed.except;
  const hasException = exception !== undefined && exception !== null;
  const hasReceipt =
    response.processed.receipt !== undefined && response.processed.receipt !== null;

  if (!hasException && hasReceipt) {
    const usage = extractTransactionResourceUsage(response);
    const ramBytes = Math.max(0, usage.ramByAccount[account] ?? 0);
    const cpu = requirement(resources.cpu.available, usage.cpuUs, "exact");
    const net = requirement(resources.net.available, usage.netBytes, "exact");
    const ram = requirement(resources.ram.availableBytes, ramBytes, "exact");
    return Object.freeze({
      usage,
      requirements: Object.freeze({
        cpu: Object.freeze({
          availableUs: resources.cpu.available,
          requiredUs: cpu.required,
          deficitUs: cpu.deficit,
          sufficient: cpu.sufficient,
          certainty: cpu.certainty,
        }),
        net: Object.freeze({
          availableBytes: resources.net.available,
          requiredBytes: net.required,
          deficitBytes: net.deficit,
          sufficient: net.sufficient,
          certainty: net.certainty,
        }),
        ram: Object.freeze({
          availableBytes: resources.ram.availableBytes,
          requiredBytes: ram.required,
          deficitBytes: ram.deficit,
          sufficient: ram.sufficient,
          certainty: ram.certainty,
        }),
      }),
      resourceFailure: false,
    });
  }

  const failure = resourceFailure(response);
  if (!failure) return null;

  const usage = observedUsage(response, failure);
  const cpuRequired = failure.resource === "cpu" ? failure.required : null;
  const netRequired =
    failure.resource === "net"
      ? (failure.required ?? (usage.netBytes > 0 ? usage.netBytes : null))
      : usage.netBytes > 0
        ? usage.netBytes
        : null;

  const observedRam = Math.max(0, usage.ramByAccount[account] ?? 0);
  let ramRequired: number | null = null;
  let ramCertainty: VexaniumResourceCertainty = "unknown";

  if (failure.resource === "ram" && failure.ramNeedsTotal !== null) {
    ramRequired = Math.max(0, failure.ramNeedsTotal - resources.ram.usedBytes);
    ramCertainty = "minimum";
  }
  if (observedRam > 0) {
    ramRequired = Math.max(ramRequired ?? 0, observedRam);
    if (ramCertainty === "unknown") ramCertainty = "minimum";
  }
  if (estimatedRamBytes !== null) {
    ramRequired = Math.max(ramRequired ?? 0, estimatedRamBytes);
    ramCertainty = "estimate";
  }

  const cpu = requirement(
    resources.cpu.available,
    cpuRequired,
    cpuRequired === null ? "unknown" : "minimum",
  );
  const net = requirement(
    resources.net.available,
    netRequired,
    netRequired === null ? "unknown" : "exact",
  );
  const ram = requirement(resources.ram.availableBytes, ramRequired, ramCertainty);

  return Object.freeze({
    usage,
    requirements: Object.freeze({
      cpu: Object.freeze({
        availableUs: resources.cpu.available,
        requiredUs: cpu.required,
        deficitUs: cpu.deficit,
        sufficient: cpu.sufficient,
        certainty: cpu.certainty,
      }),
      net: Object.freeze({
        availableBytes: resources.net.available,
        requiredBytes: net.required,
        deficitBytes: net.deficit,
        sufficient: net.sufficient,
        certainty: net.certainty,
      }),
      ram: Object.freeze({
        availableBytes: resources.ram.availableBytes,
        requiredBytes: ram.required,
        deficitBytes: ram.deficit,
        sufficient: ram.sufficient,
        certainty: ram.certainty,
      }),
    }),
    resourceFailure: true,
    exception,
  });
}

function vexAsset(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = parseAsset(value);
    if (parsed.symbol !== VEX_SYMBOL || parsed.precision !== VEX_PRECISION || parsed.amount < 0n) {
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function extractVexaniumStakeSnapshot(value: unknown): VexaniumStakeSnapshot {
  const item = record(value);
  const total = record(item?.total_resources) ?? item;
  return Object.freeze({
    cpuStakeVex: vexAsset(total?.cpu_weight),
    netStakeVex: vexAsset(total?.net_weight),
  });
}

export function quoteVexaniumStake(
  limit: AccountResourceLimit,
  required: number | null,
  currentStakeVex: string | null,
  safetyBps = STAKE_SAFETY_BPS,
): VexaniumStakeFundingQuote {
  const empty = (current: string | null): VexaniumStakeFundingQuote =>
    Object.freeze({
      currentStakeVex: current,
      minimumTotalStakeVex: null,
      minimumAdditionalStakeVex: null,
      suggestedTotalStakeVex: null,
      suggestedAdditionalStakeVex: null,
      safetyBps,
    });

  if (
    required === null ||
    !Number.isSafeInteger(required) ||
    required < 0 ||
    !Number.isInteger(safetyBps) ||
    safetyBps < 0
  ) {
    return empty(currentStakeVex);
  }

  const current = currentStakeVex ? parseAsset(currentStakeVex) : null;
  if (
    !current ||
    current.symbol !== VEX_SYMBOL ||
    current.precision !== VEX_PRECISION ||
    current.amount <= 0n ||
    limit.max <= 0
  ) {
    return empty(currentStakeVex);
  }

  if (required <= limit.available) {
    const zero = formatAsset(0n, VEX_PRECISION, VEX_SYMBOL);
    return Object.freeze({
      currentStakeVex: current.value,
      minimumTotalStakeVex: current.value,
      minimumAdditionalStakeVex: zero,
      suggestedTotalStakeVex: current.value,
      suggestedAdditionalStakeVex: zero,
      safetyBps,
    });
  }

  const targetMax = BigInt(limit.used + required);
  const currentMax = BigInt(limit.max);
  const minimumTotalUnits = ceilDiv(current.amount * targetMax, currentMax);
  const minimumAdditionalUnits =
    minimumTotalUnits > current.amount ? minimumTotalUnits - current.amount : 0n;

  const bufferedTarget = ceilDiv(targetMax * BigInt(10_000 + safetyBps), 10_000n);
  const suggestedTotalUnits = ceilDiv(current.amount * bufferedTarget, currentMax);
  const suggestedAdditionalUnits =
    suggestedTotalUnits > current.amount ? suggestedTotalUnits - current.amount : 0n;

  return Object.freeze({
    currentStakeVex: current.value,
    minimumTotalStakeVex: formatAsset(minimumTotalUnits, VEX_PRECISION, VEX_SYMBOL),
    minimumAdditionalStakeVex: formatAsset(minimumAdditionalUnits, VEX_PRECISION, VEX_SYMBOL),
    suggestedTotalStakeVex: formatAsset(suggestedTotalUnits, VEX_PRECISION, VEX_SYMBOL),
    suggestedAdditionalStakeVex: formatAsset(suggestedAdditionalUnits, VEX_PRECISION, VEX_SYMBOL),
    safetyBps,
  });
}

export function quoteVexaniumRamFromMarket(
  bytes: number,
  row: VexaniumRamMarketRow,
): VexaniumRamMarketQuote {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new RangeError("RAM quote bytes must be a non-negative safe integer");
  }

  const base = parseAsset(String(row.base?.balance ?? ""));
  const quote = parseAsset(String(row.quote?.balance ?? ""));
  if (base.symbol !== "RAM" || base.precision !== 0 || base.amount <= 0n) {
    throw new TypeError("Vexanium RAM market base reserve must use whole RAM bytes");
  }
  if (quote.symbol !== VEX_SYMBOL || quote.precision !== VEX_PRECISION || quote.amount <= 0n) {
    throw new TypeError("Vexanium RAM market quote reserve must use 4-decimal VEX");
  }

  const requested = BigInt(bytes);
  if (requested >= base.amount) {
    throw new RangeError("Requested RAM exceeds the available market reserve");
  }

  let gross = 0n;
  if (requested > 0n) {
    const afterFee = ceilDiv(quote.amount * requested, base.amount - requested);
    gross = ceilDiv(afterFee * 200n, 199n);
    while (gross - ceilDiv(gross, 200n) < afterFee) gross += 1n;
  }

  return Object.freeze({
    bytes,
    estimatedCostVex: formatAsset(gross, VEX_PRECISION, VEX_SYMBOL),
    feeBps: RAM_FEE_BPS,
    market: Object.freeze({
      ramReserveBytes: base.amount.toString(),
      vexReserve: quote.value,
    }),
  });
}
