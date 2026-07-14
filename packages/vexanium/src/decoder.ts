import type { VexaniumActionModel, VexaniumTransactionModel, VexaniumTransactionStatus } from "./models.js";
import type { VexaniumPermissionLevel } from "./types.js";

export type ExplorerActionLike = {
  account?: unknown;
  name?: unknown;
  authorization?: unknown;
  data?: unknown;
  hex_data?: unknown;
  hexData?: unknown;
  act?: ExplorerActionLike;
};

export type ExplorerTransactionLike = {
  id?: unknown;
  trx_id?: unknown;
  transaction_id?: unknown;
  status?: unknown;
  block_num?: unknown;
  blockNum?: unknown;
  block_time?: unknown;
  blockTime?: unknown;
  producer?: unknown;
  actions?: unknown;
  action_traces?: unknown;
  traces?: unknown;
  cpu_usage_us?: unknown;
  net_usage_words?: unknown;
  net_usage_bytes?: unknown;
  console?: unknown;
  return_value?: unknown;
  returnValue?: unknown;
  signatures?: unknown;
};

const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const asOptionalString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

function normalizeStatus(value: unknown): VexaniumTransactionStatus {
  switch (value) {
    case "executed":
    case "soft_fail":
    case "hard_fail":
    case "delayed":
    case "expired":
      return value;
    default:
      return "unknown";
  }
}

function normalizeAuthorization(value: unknown): VexaniumPermissionLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const actor = asString(record.actor);
      const permission = asString(record.permission);
      return actor && permission ? { actor, permission } : null;
    })
    .filter((item): item is VexaniumPermissionLevel => Boolean(item));
}

export function mapExplorerAction<TData = unknown>(input: ExplorerActionLike): VexaniumActionModel<TData> {
  const source = input.act && typeof input.act === "object" ? input.act : input;
  return {
    account: asString(source.account),
    name: asString(source.name),
    authorization: normalizeAuthorization(source.authorization),
    data: source.data as TData,
    hexData: asOptionalString(source.hexData ?? source.hex_data),
  };
}

export function mapExplorerTransaction<TActionData = unknown>(input: ExplorerTransactionLike): VexaniumTransactionModel<TActionData> {
  const actionSource = Array.isArray(input.actions)
    ? input.actions
    : Array.isArray(input.action_traces)
      ? input.action_traces
      : Array.isArray(input.traces)
        ? input.traces
        : [];

  const netWords = asNumber(input.net_usage_words);
  const netBytes = asNumber(input.net_usage_bytes) ?? (netWords === undefined ? undefined : netWords * 8);
  const cpuUs = asNumber(input.cpu_usage_us);
  const resourceUsage = cpuUs === undefined && netBytes === undefined
    ? undefined
    : { cpuUs, netBytes };

  return {
    id: asString(input.id ?? input.trx_id ?? input.transaction_id),
    status: normalizeStatus(input.status),
    blockNum: asNumber(input.blockNum ?? input.block_num),
    blockTime: asOptionalString(input.blockTime ?? input.block_time),
    producer: asOptionalString(input.producer),
    actions: actionSource.map((action) => mapExplorerAction<TActionData>(action as ExplorerActionLike)),
    resourceUsage,
    console: asOptionalString(input.console),
    returnValue: input.returnValue ?? input.return_value,
    signatures: Array.isArray(input.signatures)
      ? input.signatures.filter((item): item is string => typeof item === "string")
      : undefined,
    raw: input,
  };
}
