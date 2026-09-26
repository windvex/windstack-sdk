/**
 * WindStack SDK
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  type VexaniumAccount,
  type VexaniumActionInput,
  type VexaniumClient,
  type VexSigningRequestResult,
  type VexSigningRequestUri,
} from "@windstack/vexanium";
import {
  WISP_TELEGRAM_HANDOFF_EVENTS_PATH,
  WISP_TELEGRAM_HANDOFF_PREPARE_PATH,
  parseWispTelegramHandoffStatus,
  parseWispTelegramPreparedHandoff,
  type WispTelegramHandoffResult,
  type WispTelegramHandoffStatus,
  type WispTelegramPreparedHandoff,
} from "./telegram-protocol.js";

const DEFAULT_STORAGE_KEY = "windstack:wisp-telegram-session:v1";
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/u;
const TRANSACTION_ID_RE = /^[0-9a-f]{64}$/u;
const MAX_SESSION_ID_LENGTH = 512;
const TELEGRAM_CAPABILITIES = Object.freeze([
  VEXANIUM_CAPABILITIES.ACCOUNTS,
  VEXANIUM_CAPABILITIES.SESSIONS,
  VEXANIUM_CAPABILITIES.SIGNING_REQUEST,
] as const);

type MaybePromise<T> = T | Promise<T>;

type TelegramWebAppLike = {
  openTelegramLink?: (url: string) => void;
};

export type WispTelegramEventSource = {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
};

export type WispTelegramEventSourceFactory = (url: string) => WispTelegramEventSource;

export type WispTelegramSessionStorage = {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
};

export type WispTelegramDappMetadata = {
  name: string;
  description?: string;
  icon?: string;
  origin?: string;
  url?: string;
};

export type WispTelegramTransportOptions = {
  /** Public Wisp API base URL, for example https://api.windcrypto.com/wisp/v1. */
  apiUrl: string;
  dapp: WispTelegramDappMetadata;
  /**
   * Optional Telegram Mini App return target used only for navigation after a
   * terminal wallet action. It is never part of DApp identity or session auth.
   */
  telegramReturnUrl?: string;
  storage?: WispTelegramSessionStorage;
  storageKey?: string;
  fetch?: typeof globalThis.fetch;
  /** Optional EventSource factory for non-browser runtimes and deterministic tests. */
  eventSource?: WispTelegramEventSourceFactory;
  /** Optional custom launcher. Telegram Mini Apps are detected automatically when omitted. */
  openUrl?: (url: string) => MaybePromise<void>;
};

export type WispTelegramSession = Readonly<{
  sessionId: string;
  account: VexaniumAccount;
  accounts: readonly VexaniumAccount[];
  chainId: typeof VEXANIUM_MAINNET_CHAIN_ID;
  capabilities: typeof TELEGRAM_CAPABILITIES;
  origin: string;
  expiresAt?: number;
  /** Zero means this is only a persisted pointer and has not been revalidated this runtime. */
  validatedAt: number;
}>;

export type WispTelegramTransactArgs = {
  actions: readonly VexaniumActionInput[];
  signal?: AbortSignal;
};

type StoredSession = {
  version: 1;
  sessionId: string;
  actor: string;
  permission: string;
  chainId: string;
  origin: string;
  expiresAt?: number;
};

export class WispTelegramAlreadyConnectedError extends Error {
  constructor() {
    super("Wisp Telegram is already connected; disconnect before starting another session");
    this.name = "WispTelegramAlreadyConnectedError";
  }
}

export class WispTelegramNotConnectedError extends Error {
  constructor() {
    super("Wisp Telegram is not connected");
    this.name = "WispTelegramNotConnectedError";
  }
}
