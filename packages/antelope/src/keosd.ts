/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { PublicKey, Signature } from "@windstack/crypto";
import { readResponseText } from "@windstack/core";
import type { SignRequest, Signer } from "./index.js";

export interface KeosdTransport {
  request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown>;
}

export class KeosdError extends Error {
  readonly status?: number;
  readonly path?: string;

  constructor(message: string, options: { status?: number; path?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "KeosdError";
    this.status = options.status;
    this.path = options.path;
  }
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export type KeosdHttpTransportOptions = {
  endpoint: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  /** Remote keosd access can expose signing authority. It is disabled unless explicitly enabled over HTTPS. */
  allowRemoteHttps?: boolean;
};

export class KeosdHttpTransport implements KeosdTransport {
  readonly endpoint: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;

  constructor(options: KeosdHttpTransportOptions) {
    const endpoint = new URL(options.endpoint);
    if (!/^https?:$/.test(endpoint.protocol) || endpoint.username || endpoint.password)
      throw new TypeError("keosd endpoint must be an HTTP(S) URL without credentials");
    if (
      !isLoopback(endpoint.hostname) &&
      !(endpoint.protocol === "https:" && options.allowRemoteHttps)
    )
      throw new TypeError("Remote keosd requires HTTPS and allowRemoteHttps: true");
    this.endpoint = endpoint.toString().replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
    if (typeof this.#fetch !== "function")
      throw new TypeError("A fetch implementation is required");
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxResponseBytes = options.maxResponseBytes ?? 256 * 1024;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 100)
      throw new RangeError("keosd timeoutMs must be at least 100");
    if (!Number.isSafeInteger(this.#maxResponseBytes) || this.#maxResponseBytes < 1024)
      throw new RangeError("keosd maxResponseBytes must be at least 1024");
  }

  async request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    if (!path.startsWith("/v1/wallet/")) throw new TypeError("Unsupported keosd path");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.#fetch(`${this.endpoint}${path}`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await readResponseText(response, this.#maxResponseBytes);
      if (!response.ok)
        throw new KeosdError(`keosd returned HTTP ${response.status}`, {
          status: response.status,
          path,
        });
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new KeosdError("keosd returned invalid JSON", {
          status: response.status,
          path,
          cause,
        });
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      if (error instanceof KeosdError) throw error;
      throw new KeosdError(
        controller.signal.aborted
          ? `keosd request timed out after ${this.#timeoutMs}ms`
          : "keosd request failed",
        { path, cause: error },
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}

export type KeosdSignerOptions = {
  walletName: string;
  transport: KeosdTransport;
};

export class KeosdSigner implements Signer {
  readonly walletName: string;
  readonly #transport: KeosdTransport;
  readonly #rawKeyByNormalized = new Map<string, string>();

  constructor(options: KeosdSignerOptions) {
    if (!options.walletName?.trim()) throw new TypeError("keosd walletName is required");
    if (!options.transport?.request) throw new TypeError("A keosd transport is required");
    this.walletName = options.walletName.trim();
    this.#transport = options.transport;
  }

  async assertAvailable(signal?: AbortSignal): Promise<{ wallet: string; publicKeyCount: number }> {
    const value = await this.#transport.request("/v1/wallet/list_wallets", undefined, signal);
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
      throw new KeosdError("keosd returned a malformed wallet list");
    if (!value.some((item) => item.trim() === `${this.walletName} *`))
      throw new KeosdError(`keosd wallet ${this.walletName} is not unlocked`);
    const keys = await this.getAvailableKeys(signal);
    if (!keys.length) throw new KeosdError(`keosd wallet ${this.walletName} has no public keys`);
    return { wallet: this.walletName, publicKeyCount: keys.length };
  }

  async getAvailableKeys(signal?: AbortSignal): Promise<string[]> {
    const value = await this.#transport.request("/v1/wallet/get_public_keys", undefined, signal);
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === "string") ||
      value.length > 1000
    )
      throw new KeosdError("keosd returned a malformed public-key list");
    this.#rawKeyByNormalized.clear();
    return value.map((raw) => {
      const normalized = PublicKey.fromString(raw).toString();
      if (this.#rawKeyByNormalized.has(normalized))
        throw new KeosdError("keosd returned duplicate equivalent public keys");
      this.#rawKeyByNormalized.set(normalized, raw);
      return normalized;
    });
  }

  async sign(request: SignRequest, signal?: AbortSignal): Promise<string[]> {
    if (request.serializedContextFreeData.length)
      throw new KeosdError("keosd signer does not support non-empty context-free data");
    const requiredKeys = request.requiredKeys.map((key) => {
      const normalized = PublicKey.fromString(key).toString();
      return this.#rawKeyByNormalized.get(normalized) ?? key;
    });
    const value = await this.#transport.request(
      "/v1/wallet/sign_transaction",
      [
        { ...request.transaction, signatures: [], context_free_data: [] },
        requiredKeys,
        request.chainId,
      ],
      signal,
    );
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray((value as { signatures?: unknown }).signatures)
    )
      throw new KeosdError("keosd returned a malformed signed transaction");
    const signatures = (value as { signatures: unknown[] }).signatures;
    if (
      !signatures.length ||
      !signatures.every((item) => typeof item === "string") ||
      signatures.length > 100
    )
      throw new KeosdError("keosd returned a malformed signature list");
    return signatures.map((signature) => Signature.fromString(signature as string).toString());
  }
}
