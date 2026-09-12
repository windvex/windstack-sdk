/**
 * WindStack SDK
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  VEXANIUM_MAINNET_CHAIN_ID,
  type VexaniumAccount,
  type VexaniumActionInput,
  type VexaniumClient,
  type VexSigningRequestResult,
  type VexSigningRequestUri,
} from "@windstack/vexanium";

const DEFAULT_STORAGE_KEY = "windstack:wisp-telegram-session:v1";
const DEFAULT_POLL_INTERVAL_MS = 1_500;
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/u;
const TRANSACTION_ID_RE = /^[0-9a-f]{64}$/u;
const MAX_SESSION_ID_LENGTH = 512;

type MaybePromise<T> = T | Promise<T>;

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
  /** Public Wisp API base URL, for example https://api.windcrypto.com. */
  apiUrl: string;
  dapp: WispTelegramDappMetadata;
  storage?: WispTelegramSessionStorage;
  storageKey?: string;
  fetch?: typeof globalThis.fetch;
  openUrl?: (url: string) => MaybePromise<void>;
  pollIntervalMs?: number;
};

export type WispTelegramSession = Readonly<{
  sessionId: string;
  account: VexaniumAccount;
  chainId: typeof VEXANIUM_MAINNET_CHAIN_ID;
  origin: string;
  validatedAt: number;
}>;

export type WispTelegramTransactArgs = {
  actions: readonly VexaniumActionInput[];
  signal?: AbortSignal;
};

type HandoffResult = {
  actor?: string;
  permission?: string;
  sessionId?: string;
  chainId?: string;
  transactionId?: string;
  error?: string;
};

type HandoffStatus = {
  id: string;
  status: "pending" | "opened" | "approved" | "rejected" | "failed";
  expiresAt: number;
  result?: HandoffResult;
};

type PreparedHandoff = {
  id: string;
  expiresAt: number;
  launchUrl: string;
};

type StoredSession = {
  version: 1;
  sessionId: string;
  actor: string;
  permission: string;
  chainId: string;
  origin: string;
};

class WispTelegramHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WispTelegramHttpError";
  }
}

class WispTelegramResultError extends Error {
  constructor(
    message: string,
    readonly status: "rejected" | "failed" | "expired",
  ) {
    super(message);
    this.name = "WispTelegramResultError";
  }
}

function hasControlCharacters(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function opaqueSessionId(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SESSION_ID_LENGTH ||
    value !== value.trim() ||
    hasControlCharacters(value)
  ) {
    return "";
  }
  return value;
}

function credentialFreeHttpsUrl(value: string, label: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
    return parsed;
  } catch {
    throw new TypeError(`${label} must be a credential-free HTTPS URL`);
  }
}

function runtimeLocation() {
  return typeof globalThis.location === "object" ? globalThis.location : null;
}

function runtimeStorage(): WispTelegramSessionStorage | null {
  try {
    return typeof globalThis.localStorage === "object" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function memoryStorage(): WispTelegramSessionStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function normalizeAccount(result: HandoffResult): VexaniumAccount {
  const actor = String(result.actor || "").trim();
  const permission = String(result.permission || "active").trim();
  if (!ACCOUNT_RE.test(actor) || !ACCOUNT_RE.test(permission)) {
    throw new Error("Wisp Telegram returned an invalid Vexanium account");
  }
  return {
    actor,
    permission,
    permissionLevel: `${actor}@${permission}`,
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
  };
}

function resultErrorMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object") {
    const error = (value as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message) return error.message;
  }
  return fallback;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Wallet request cancelled", "AbortError"));
      return;
    }
    const timer = globalThis.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer);
        reject(new DOMException("Wallet request cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}

export function createWispTelegramTransport(options: WispTelegramTransportOptions) {
  const apiUrl = credentialFreeHttpsUrl(options.apiUrl, "Wisp Telegram apiUrl");
  const runtime = runtimeLocation();
  const requestedOrigin = String(options.dapp.origin || runtime?.origin || "").trim();
  const origin = credentialFreeHttpsUrl(requestedOrigin, "Wisp Telegram DApp origin").origin;
  if (runtime?.origin && runtime.origin !== origin) {
    throw new TypeError("Wisp Telegram DApp origin must match the current page origin");
  }

  const pageUrl = credentialFreeHttpsUrl(
    String(options.dapp.url || runtime?.href || origin),
    "Wisp Telegram DApp url",
  );
  if (pageUrl.origin !== origin) {
    throw new TypeError("Wisp Telegram DApp url must have the same origin as the current DApp");
  }

  const name = String(options.dapp.name || "").trim();
  if (!name) throw new TypeError("Wisp Telegram DApp name is required");
  const description = String(options.dapp.description || "").trim();
  const icon = String(options.dapp.icon || "").trim();
  if (icon) credentialFreeHttpsUrl(icon, "Wisp Telegram DApp icon");

  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new TypeError("Wisp Telegram transport requires fetch");
  }
  const storage = options.storage ?? runtimeStorage() ?? memoryStorage();
  const storageKey = String(options.storageKey || DEFAULT_STORAGE_KEY).trim();
  if (!storageKey) throw new TypeError("Wisp Telegram storageKey must be non-empty");
  const pollIntervalMs = Math.max(
    250,
    Math.min(10_000, Number(options.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS),
  );
  let currentSession: WispTelegramSession | null = null;

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImplementation(new URL(path, apiUrl).toString(), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    });
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !body) {
      throw new WispTelegramHttpError(
        resultErrorMessage(body, `Wisp Telegram returned ${response.status}`),
        response.status,
      );
    }
    return body as T;
  }

  async function openTelegram(url: string) {
    if (options.openUrl) {
      await options.openUrl(url);
      return;
    }
    if (typeof globalThis.window !== "object") {
      throw new Error("Wisp Telegram transport requires openUrl outside a browser");
    }
    const opened = globalThis.window.open(url, "wisp-wallet");
    if (opened) {
      opened.opener = null;
      opened.focus();
      return;
    }
    globalThis.window.location.assign(url);
  }

  async function prepare(
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<PreparedHandoff> {
    const prepared = await requestJson<PreparedHandoff>("/telegram/dapp/prepare", {
      method: "POST",
      signal,
      body: JSON.stringify({
        name,
        description,
        icon,
        origin,
        url: pageUrl.toString(),
        chainId: VEXANIUM_MAINNET_CHAIN_ID,
        ...body,
      }),
    });
    if (!prepared.id || !prepared.launchUrl || prepared.expiresAt <= Date.now()) {
      throw new Error("Wisp Telegram returned an invalid handoff");
    }
    await openTelegram(prepared.launchUrl);
    return prepared;
  }

  async function waitForResult(
    prepared: PreparedHandoff,
    signal?: AbortSignal,
  ): Promise<HandoffResult> {
    while (Date.now() < prepared.expiresAt) {
      if (signal?.aborted) throw new DOMException("Wallet request cancelled", "AbortError");
      try {
        const status = await requestJson<HandoffStatus>(
          `/telegram/dapp/status?id=${encodeURIComponent(prepared.id)}`,
          { signal },
        );
        if (status.status === "approved") return status.result ?? {};
        if (status.status === "rejected") {
          throw new WispTelegramResultError(
            status.result?.error || "Request rejected in Wisp Telegram",
            "rejected",
          );
        }
        if (status.status === "failed") {
          throw new WispTelegramResultError(
            status.result?.error || "Wisp Telegram could not complete the request",
            "failed",
          );
        }
      } catch (error) {
        if (signal?.aborted) throw new DOMException("Wallet request cancelled", "AbortError");
        if (error instanceof WispTelegramResultError) throw error;
        if (error instanceof WispTelegramHttpError && error.status < 500 && error.status !== 429) {
          throw error;
        }
      }
      await sleep(pollIntervalMs, signal);
    }
    throw new WispTelegramResultError("Wisp Telegram request expired", "expired");
  }

  function sessionFromResult(result: HandoffResult): WispTelegramSession {
    const sessionId = opaqueSessionId(result.sessionId);
    if (!sessionId) throw new Error("Wisp Telegram did not return a wallet session id");
    const chainId = String(result.chainId || VEXANIUM_MAINNET_CHAIN_ID).toLowerCase();
    if (chainId !== VEXANIUM_MAINNET_CHAIN_ID) {
      throw new Error("Wisp Telegram returned a session for an unexpected chain");
    }
    return Object.freeze({
      sessionId,
      account: normalizeAccount(result),
      chainId: VEXANIUM_MAINNET_CHAIN_ID,
      origin,
      validatedAt: Date.now(),
    });
  }

  async function persistSession(session: WispTelegramSession) {
    const stored: StoredSession = {
      version: 1,
      sessionId: session.sessionId,
      actor: session.account.actor,
      permission: session.account.permission,
      chainId: session.chainId,
      origin: session.origin,
    };
    await storage.setItem(storageKey, JSON.stringify(stored));
    currentSession = session;
    return session;
  }

  async function clearSession() {
    currentSession = null;
    await storage.removeItem(storageKey);
  }

  async function getStoredSession(): Promise<WispTelegramSession | null> {
    try {
      const raw = await storage.getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<StoredSession>;
      const sessionId = opaqueSessionId(value.sessionId);
      const actor = String(value.actor || "").trim();
      const permission = String(value.permission || "").trim();
      if (
        value.version !== 1 ||
        !sessionId ||
        !ACCOUNT_RE.test(actor) ||
        !ACCOUNT_RE.test(permission) ||
        String(value.chainId || "").toLowerCase() !== VEXANIUM_MAINNET_CHAIN_ID ||
        value.origin !== origin
      ) {
        await clearSession();
        return null;
      }
      return Object.freeze({
        sessionId,
        account: {
          actor,
          permission,
          permissionLevel: `${actor}@${permission}` as `${string}@${string}`,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
        },
        chainId: VEXANIUM_MAINNET_CHAIN_ID,
        origin,
        // A persisted pointer is not proof of authorization. Only connect,
        // restore, or a wallet-validated signing request can refresh this time.
        validatedAt: 0,
      });
    } catch {
      await clearSession().catch(() => undefined);
      return null;
    }
  }

  async function connect(signal?: AbortSignal) {
    const prepared = await prepare({ kind: "connect", request: "" }, signal);
    return persistSession(sessionFromResult(await waitForResult(prepared, signal)));
  }

  async function restore(signal?: AbortSignal): Promise<WispTelegramSession | null> {
    const stored = await getStoredSession();
    if (!stored) return null;
    try {
      const prepared = await prepare(
        {
          kind: "restore",
          request: "",
          sessionId: stored.sessionId,
          expectedAccount: stored.account.actor,
          expectedPermission: stored.account.permission,
        },
        signal,
      );
      const restored = sessionFromResult(await waitForResult(prepared, signal));
      if (
        restored.sessionId !== stored.sessionId ||
        restored.account.permissionLevel !== stored.account.permissionLevel
      ) {
        await clearSession();
        throw new Error("Wisp Telegram restored a different wallet session");
      }
      return persistSession(restored);
    } catch (error) {
      if (error instanceof WispTelegramResultError) {
        await clearSession();
        return null;
      }
      throw error;
    }
  }

  async function sessionPointer() {
    return currentSession ?? (await getStoredSession());
  }

  async function signSigningRequest(
    request: VexSigningRequestUri,
    signal?: AbortSignal,
  ): Promise<VexSigningRequestResult> {
    if (typeof request !== "string" || !request.toLowerCase().startsWith("vsr:")) {
      throw new TypeError("Wisp Telegram signing requires a canonical Vexanium VSR");
    }
    const session = await sessionPointer();
    if (!session) throw new Error("Connect Wisp Telegram before signing");

    const prepared = await prepare(
      {
        kind: "sign",
        request,
        sessionId: session.sessionId,
        expectedAccount: session.account.actor,
        expectedPermission: session.account.permission,
      },
      signal,
    );
    const result = await waitForResult(prepared, signal);
    const signer = normalizeAccount(result);
    if (signer.permissionLevel !== session.account.permissionLevel) {
      throw new Error("Wisp Telegram signed with a different account than the active session");
    }
    if (result.sessionId && opaqueSessionId(result.sessionId) !== session.sessionId) {
      throw new Error("Wisp Telegram signing result does not match the active session");
    }
    const transactionId = String(result.transactionId || "")
      .trim()
      .toLowerCase();
    if (!TRANSACTION_ID_RE.test(transactionId)) {
      throw new Error("Wisp Telegram did not return a broadcast transaction id");
    }

    await persistSession({
      ...session,
      account: signer,
      validatedAt: Date.now(),
    });
    return {
      transactionId,
      signatures: [],
      signer: signer.actor,
      signerPermission: signer.permission,
      broadcast: true,
      raw: { transport: "wisp-telegram", handoffId: prepared.id },
    };
  }

  async function transact(
    client: VexaniumClient,
    args: WispTelegramTransactArgs,
  ): Promise<VexSigningRequestResult> {
    if (!args.actions.length)
      throw new TypeError("Wisp Telegram transaction requires at least one action");
    const session = await sessionPointer();
    if (!session) throw new Error("Connect Wisp Telegram before transacting");

    const actions = await Promise.all(
      args.actions.map((action) =>
        client.action(
          {
            ...action,
            authorization: action.authorization ?? [
              {
                actor: session.account.actor,
                permission: session.account.permission,
              },
            ],
          },
          args.signal,
        ),
      ),
    );
    const request = await client.createSigningRequest({
      broadcast: true,
      actions,
    });
    return signSigningRequest(request, args.signal);
  }

  return Object.freeze({
    connect,
    restore,
    getSession: () => currentSession,
    getStoredSession,
    clearSession,
    signSigningRequest,
    transact,
  });
}

export type WispTelegramTransport = ReturnType<typeof createWispTelegramTransport>;
