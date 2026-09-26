/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { normalizeWispHttpsUrl } from "./url.js";

export const WISP_TELEGRAM_HANDOFF_PREPARE_PATH = "telegram/dapp/prepare" as const;
export const WISP_TELEGRAM_HANDOFF_EVENTS_PATH = "telegram/dapp/events" as const;
export const WISP_TELEGRAM_HANDOFF_EVENT_RETRY_MS = 1_500 as const;

export const WISP_TELEGRAM_HANDOFF_KINDS = [
  "connect",
  "restore",
  "sign",
  "disconnect",
] as const;
export const WISP_TELEGRAM_HANDOFF_STATUSES = [
  "pending",
  "opened",
  "approved",
  "rejected",
  "failed",
] as const;
export const WISP_TELEGRAM_HANDOFF_TERMINAL_STATUSES = [
  "approved",
  "rejected",
  "failed",
] as const;

export type WispTelegramHandoffKind = (typeof WISP_TELEGRAM_HANDOFF_KINDS)[number];
export type WispTelegramHandoffStatusValue =
  (typeof WISP_TELEGRAM_HANDOFF_STATUSES)[number];

export type WispTelegramHandoffPrepareRequest = {
  kind: WispTelegramHandoffKind;
  request: string;
  sessionId?: string;
  chainId: string;
  origin: string;
  url: string;
  telegramReturnUrl?: string;
  name: string;
  description?: string;
  icon?: string;
  expectedAccount?: string;
  expectedPermission?: string;
};

export type WispTelegramHandoffResult = {
  actor?: string;
  permission?: string;
  sessionId?: string;
  chainId?: string;
  transactionId?: string;
  sessionExpiresAt?: number;
  sessionInvalidated?: boolean;
  error?: string;
};

export type WispTelegramHandoffStatus = {
  id: string;
  eventId: number;
  status: WispTelegramHandoffStatusValue;
  expiresAt: number;
  result?: WispTelegramHandoffResult;
};

export type WispTelegramPreparedHandoff = WispTelegramHandoffStatus & {
  startParam?: string;
  launchUrl?: string;
};

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/u;
const TRANSACTION_ID_RE = /^[0-9a-f]{64}$/u;
const MAX_OPAQUE_ID_LENGTH = 512;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOpaqueId(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_OPAQUE_ID_LENGTH ||
    value !== value.trim()
  ) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalPositiveInteger(value: unknown): value is number | undefined {
  return value === undefined || (Number.isSafeInteger(value) && Number(value) > 0);
}

function isHandoffResult(value: unknown, status: WispTelegramHandoffStatusValue): boolean {
  if (!isRecord(value)) return false;
  if (
    !isOptionalString(value.actor) ||
    !isOptionalString(value.permission) ||
    !isOptionalString(value.sessionId) ||
    !isOptionalString(value.chainId) ||
    !isOptionalString(value.transactionId) ||
    !isOptionalPositiveInteger(value.sessionExpiresAt) ||
    !isOptionalString(value.error) ||
    (value.sessionInvalidated !== undefined && typeof value.sessionInvalidated !== "boolean")
  ) {
    return false;
  }
  if (value.actor && !ACCOUNT_RE.test(value.actor)) return false;
  if (value.permission && !ACCOUNT_RE.test(value.permission)) return false;
  if (value.sessionId && !isOpaqueId(value.sessionId)) return false;
  if (value.transactionId && !TRANSACTION_ID_RE.test(value.transactionId.toLowerCase())) {
    return false;
  }
  if (value.sessionInvalidated === true && status !== "failed") return false;
  if (status === "approved" && !value.actor) return false;
  return true;
}

export function isWispTelegramHandoffStatus(
  value: unknown,
): value is WispTelegramHandoffStatus {
  if (!isRecord(value)) return false;
  if (
    !isOpaqueId(value.id) ||
    !Number.isSafeInteger(value.eventId) ||
    Number(value.eventId) <= 0 ||
    !WISP_TELEGRAM_HANDOFF_STATUSES.includes(
      value.status as WispTelegramHandoffStatusValue,
    ) ||
    !Number.isSafeInteger(value.expiresAt) ||
    Number(value.expiresAt) <= 0
  ) {
    return false;
  }

  const status = value.status as WispTelegramHandoffStatusValue;
  const terminal = WISP_TELEGRAM_HANDOFF_TERMINAL_STATUSES.includes(
    status as (typeof WISP_TELEGRAM_HANDOFF_TERMINAL_STATUSES)[number],
  );
  if (terminal) return isHandoffResult(value.result, status);
  return value.result === undefined;
}

export function parseWispTelegramHandoffStatus(
  value: unknown,
  expectedId?: string,
): WispTelegramHandoffStatus {
  if (!isWispTelegramHandoffStatus(value)) {
    throw new TypeError("Invalid Wisp Telegram handoff status");
  }
  if (expectedId !== undefined && value.id !== expectedId) {
    throw new TypeError("Wisp Telegram handoff status id does not match the active request");
  }
  return value;
}

export function parseWispTelegramPreparedHandoff(value: unknown): WispTelegramPreparedHandoff {
  const status = parseWispTelegramHandoffStatus(value);
  const record = value as Record<string, unknown>;
  if (record.startParam !== undefined && typeof record.startParam !== "string") {
    throw new TypeError("Invalid Wisp Telegram handoff start parameter");
  }
  if (record.launchUrl !== undefined) {
    if (typeof record.launchUrl !== "string") {
      throw new TypeError("Invalid Wisp Telegram handoff launch URL");
    }
    if (record.launchUrl) normalizeWispHttpsUrl(record.launchUrl, "Wisp Telegram launch URL");
  }
  return status as WispTelegramPreparedHandoff;
}
