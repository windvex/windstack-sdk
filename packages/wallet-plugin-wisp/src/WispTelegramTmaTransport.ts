/**
 * WindStack SDK
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  createWispTelegramTransport as createBaseWispTelegramTransport,
  WispTelegramAlreadyConnectedError,
  WispTelegramNotConnectedError,
  WispTelegramRestoreRequiredError,
  type WispTelegramDappMetadata,
  type WispTelegramSession,
  type WispTelegramSessionStorage,
  type WispTelegramTransactArgs,
  type WispTelegramTransport as BaseWispTelegramTransport,
  type WispTelegramTransportOptions as BaseWispTelegramTransportOptions,
} from "./WispTelegramTransport.js";

export {
  WispTelegramAlreadyConnectedError,
  WispTelegramNotConnectedError,
  WispTelegramRestoreRequiredError,
};
export type {
  WispTelegramDappMetadata,
  WispTelegramSession,
  WispTelegramSessionStorage,
  WispTelegramTransactArgs,
};

export type WispTelegramTransportOptions = BaseWispTelegramTransportOptions & {
  /**
   * Optional Telegram Mini App return target used only for navigation after a
   * terminal wallet action. It is never part of DApp identity or session auth.
   *
   * Use the HTTPS Telegram Mini App/deep-link form, for example:
   * https://t.me/example_bot/example_app
   */
  telegramReturnUrl?: string;
};

function normalizeTelegramReturnUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== "t.me" ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("invalid");
    }
    return parsed.toString();
  } catch {
    throw new TypeError(
      "Wisp Telegram telegramReturnUrl must be a credential-free https://t.me/ link",
    );
  }
}

function withTelegramReturnTarget(
  fetchImplementation: typeof globalThis.fetch,
  telegramReturnUrl: string,
): typeof globalThis.fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
    );
    if (
      telegramReturnUrl &&
      url.pathname.endsWith("/telegram/dapp/prepare") &&
      String(init?.method || "GET").toUpperCase() === "POST" &&
      typeof init?.body === "string"
    ) {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      return fetchImplementation(input, {
        ...init,
        body: JSON.stringify({ ...body, telegramReturnUrl }),
      });
    }
    return fetchImplementation(input, init);
  };
}

/**
 * Creates the Wisp Telegram transport with an optional explicit Telegram Mini
 * App return target. The base transport remains the owner of connection,
 * restore, session, signing, multi-action VSR, and disconnect semantics.
 */
export function createWispTelegramTransport(options: WispTelegramTransportOptions) {
  const { telegramReturnUrl: configuredReturnUrl, ...baseOptions } = options;
  const telegramReturnUrl = normalizeTelegramReturnUrl(configuredReturnUrl);
  if (!telegramReturnUrl) {
    return createBaseWispTelegramTransport(baseOptions);
  }

  const fetchImplementation = baseOptions.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new TypeError("Wisp Telegram transport requires fetch");
  }

  return createBaseWispTelegramTransport({
    ...baseOptions,
    fetch: withTelegramReturnTarget(fetchImplementation, telegramReturnUrl),
  });
}

export type WispTelegramTransport = BaseWispTelegramTransport;
