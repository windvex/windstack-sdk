import assert from "node:assert/strict";

import { createWispTelegramTransport } from "../packages/wallet-plugin-wisp/dist/index.js";

const CHAIN_ID = "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f";
const TX_ID = "a".repeat(64);

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createHarness() {
  const prepared = new Map();
  const prepareBodies = [];
  const opened = [];
  let sequence = 0;

  const fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === "/telegram/dapp/prepare") {
      const body = JSON.parse(String(init.body || "{}"));
      const id = `handoff-${++sequence}`;
      prepareBodies.push(body);
      prepared.set(id, body);
      return response(200, {
        id,
        expiresAt: Date.now() + 60_000,
        launchUrl: `https://t.me/wispwalletbot?startapp=dapp_${id}`,
      });
    }

    if (url.pathname === "/telegram/dapp/status") {
      const id = url.searchParams.get("id");
      const body = prepared.get(id);
      assert.ok(body, `unknown handoff ${id}`);
      if (body.kind === "connect") {
        return response(200, {
          id,
          status: "approved",
          expiresAt: Date.now() + 60_000,
          result: {
            actor: "gvexa",
            permission: "active",
            sessionId: "wisp_session_123",
            chainId: CHAIN_ID,
          },
        });
      }
      if (body.kind === "restore") {
        return response(200, {
          id,
          status: "approved",
          expiresAt: Date.now() + 60_000,
          result: {
            actor: body.expectedAccount,
            permission: body.expectedPermission,
            sessionId: body.sessionId,
            chainId: CHAIN_ID,
          },
        });
      }
      return response(200, {
        id,
        status: "approved",
        expiresAt: Date.now() + 60_000,
        result: {
          actor: body.expectedAccount,
          permission: body.expectedPermission,
          transactionId: TX_ID,
        },
      });
    }

    return response(404, { error: { message: `unexpected ${url.pathname}` } });
  };

  return { fetch, prepareBodies, opened };
}

const storage = createStorage();
const firstHarness = createHarness();
const options = {
  apiUrl: "https://api.windcrypto.com",
  dapp: {
    name: "WindSwap",
    description: "Swap and provide liquidity on WindSwap V2.",
    origin: "https://swap.windcrypto.com",
    url: "https://swap.windcrypto.com/swap",
  },
  storage,
  fetch: firstHarness.fetch,
  openUrl(url) {
    firstHarness.opened.push(url);
  },
};

const first = createWispTelegramTransport(options);
const connected = await first.connect();
assert.equal(connected.sessionId, "wisp_session_123");
assert.equal(connected.account.permissionLevel, "gvexa@active");
assert.equal(firstHarness.prepareBodies.length, 1);
assert.equal(firstHarness.prepareBodies[0].kind, "connect");
assert.equal(firstHarness.opened.length, 1);

const secondHarness = createHarness();
const second = createWispTelegramTransport({
  ...options,
  fetch: secondHarness.fetch,
  openUrl(url) {
    secondHarness.opened.push(url);
  },
});

const pointer = await second.getStoredSession();
assert.ok(pointer);
assert.equal(pointer.sessionId, connected.sessionId);
assert.equal(pointer.validatedAt, 0, "persisted session pointer must not masquerade as wallet validation");

const restored = await second.restore();
assert.ok(restored);
assert.equal(restored.sessionId, connected.sessionId);
assert.equal(secondHarness.prepareBodies[0].kind, "restore");
assert.equal(secondHarness.prepareBodies[0].sessionId, connected.sessionId);
assert.equal(secondHarness.prepareBodies[0].origin, "https://swap.windcrypto.com");
assert.equal(secondHarness.prepareBodies[0].expectedAccount, "gvexa");
assert.equal(secondHarness.prepareBodies[0].expectedPermission, "active");

const createdRequests = [];
const actionInputs = [];
const fakeClient = {
  async action(input) {
    actionInputs.push(input);
    return input;
  },
  async createSigningRequest(input) {
    createdRequests.push(input);
    return "vsr:windstack-multi-action";
  },
};

const result = await second.transact(fakeClient, {
  actions: [
    { account: "vex.token", name: "transfer", data: { quantity: "1.0000 VEX" } },
    { account: "token.wind", name: "transfer", data: { quantity: "1.00000000 WIND" } },
    { account: "swapv2.wind", name: "addliquidity", data: { pair_id: 1 } },
  ],
});

assert.equal(result.transactionId, TX_ID);
assert.equal(actionInputs.length, 3);
assert.equal(createdRequests.length, 1, "multi-action transaction must create exactly one VSR");
assert.equal(createdRequests[0].actions.length, 3);
assert.equal(createdRequests[0].broadcast, true);

const signBody = secondHarness.prepareBodies.find((body) => body.kind === "sign");
assert.ok(signBody, "expected one Telegram signing handoff");
assert.equal(signBody.request, "vsr:windstack-multi-action");
assert.equal(signBody.sessionId, connected.sessionId);
assert.equal(signBody.expectedAccount, "gvexa");
assert.equal(signBody.expectedPermission, "active");
assert.equal(
  secondHarness.prepareBodies.filter((body) => body.kind === "sign").length,
  1,
  "multi-action transaction must open exactly one Telegram signing handoff",
);

await second.clearSession();
assert.equal(await second.getStoredSession(), null);

console.log("PASS: Wisp Telegram transport persists an opaque wallet session id");
console.log("PASS: cold restore revalidates the same wallet-authoritative session");
console.log("PASS: signing is bound to the restored session and account permission");
console.log("PASS: multi-action transact produces one VSR and one Telegram signing handoff");
