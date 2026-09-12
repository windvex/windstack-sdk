import assert from "node:assert/strict";

import { createWispTelegramTransport } from "../packages/wallet-plugin-wisp/dist/index.js";

const CHAIN_ID = "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f";
const SESSION_ID = "wisp_session_tma_return";
const RETURN_URL = "https://t.me/windswapbot/app";

const storage = new Map();
let prepareBody = null;

const transport = createWispTelegramTransport({
  apiUrl: "https://api.windcrypto.com",
  telegramReturnUrl: RETURN_URL,
  dapp: {
    name: "WindSwap",
    origin: "https://swap.windcrypto.com",
    url: "https://swap.windcrypto.com/swap",
  },
  storage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  openUrl() {},
  async fetch(input, init = {}) {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/telegram/dapp/prepare")) {
      prepareBody = JSON.parse(String(init.body || "{}"));
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "handoff-tma-return",
            status: "approved",
            expiresAt: Date.now() + 60_000,
            result: {
              actor: "gvexa",
              permission: "active",
              sessionId: SESSION_ID,
              chainId: CHAIN_ID,
              sessionExpiresAt: Date.now() + 60 * 60_000,
            },
          };
        },
      };
    }
    throw new Error(`unexpected request ${url.pathname}`);
  },
});

await transport.connect();
assert.equal(prepareBody?.telegramReturnUrl, RETURN_URL);
assert.equal(prepareBody?.origin, "https://swap.windcrypto.com");
assert.equal(prepareBody?.kind, "connect");

assert.throws(
  () =>
    createWispTelegramTransport({
      apiUrl: "https://api.windcrypto.com",
      telegramReturnUrl: "https://evil.example/return",
      dapp: {
        name: "WindSwap",
        origin: "https://swap.windcrypto.com",
        url: "https://swap.windcrypto.com/swap",
      },
    }),
  /https:\/\/t\.me\//iu,
);

console.log("PASS: Telegram Mini App return target is explicit transport metadata");
console.log("PASS: non-Telegram return targets are rejected before handoff creation");
