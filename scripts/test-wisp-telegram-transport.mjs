import assert from "node:assert/strict";

import { createWispTelegramTransport } from "../packages/wallet-plugin-wisp/dist/index.js";

const CHAIN_ID = "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f";
const TX_ID = "a".repeat(64);
const SESSION_ID = "wisp_session_123";
const SESSION_EXPIRES_AT = Date.now() + 7 * 24 * 60 * 60_000;

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

function resultFor(body, extra = {}) {
  return {
    actor: body.expectedAccount || "gvexa",
    permission: body.expectedPermission || "active",
    sessionId: body.sessionId || SESSION_ID,
    chainId: CHAIN_ID,
    sessionExpiresAt: SESSION_EXPIRES_AT,
    ...extra,
  };
}

function createHarness({ immediateRestore = false, immediateDisconnect = false } = {}) {
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

      if (body.kind === "restore" && immediateRestore) {
        return response(200, {
          id,
          status: "approved",
          expiresAt: Date.now() + 60_000,
          launchUrl: "",
          result: resultFor(body),
        });
      }
      if (body.kind === "disconnect" && immediateDisconnect) {
        return response(200, {
          id,
          status: "approved",
          expiresAt: Date.now() + 60_000,
          launchUrl: "",
          result: resultFor(body),
        });
      }

      return response(200, {
        id,
        status: "pending",
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
          result: resultFor(body),
        });
      }
      if (body.kind === "sign") {
        return response(200, {
          id,
          status: "approved",
          expiresAt: Date.now() + 60_000,
          result: resultFor(body, { transactionId: TX_ID }),
        });
      }
      return response(200, {
        id,
        status: "approved",
        expiresAt: Date.now() + 60_000,
        result: resultFor(body),
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
assert.equal(first.connected(), false);
assert.equal(await first.getSessionId(), null);
const connected = await first.connect();
assert.equal(first.connected(), true);
assert.equal(await first.getSessionId(), SESSION_ID);
assert.equal(connected.sessionId, SESSION_ID);
assert.equal(connected.account.permissionLevel, "gvexa@active");
assert.equal(connected.accounts.length, 1);
assert.equal(connected.expiresAt, SESSION_EXPIRES_AT);
assert.deepEqual(first.getCapabilities(), ["vex.accounts", "vex.sessions", "vex.signingRequest"]);
assert.equal(first.getChain(), CHAIN_ID);
assert.equal(firstHarness.prepareBodies.length, 1);
assert.equal(firstHarness.prepareBodies[0].kind, "connect");
assert.equal(firstHarness.opened.length, 1);
await assert.rejects(
  () => first.connect(),
  /already connected/iu,
  "connect must not create a second session while already connected",
);

const secondHarness = createHarness({ immediateRestore: true, immediateDisconnect: true });
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
assert.equal(
  pointer.validatedAt,
  0,
  "persisted session pointer must not masquerade as wallet validation",
);
assert.equal(second.connected(), false, "persisted pointer must not mean connected");
assert.equal(await second.getSessionId(), null, "unrestored pointer must not expose active session id");
assert.deepEqual(await second.getAccounts(), [], "unrestored pointer must not expose connected accounts");
await assert.rejects(
  () => second.signSigningRequest("vsr:requires-restore"),
  /Restore the persisted Wisp Telegram session/iu,
  "signing must require authoritative restore after a cold start",
);
await assert.rejects(
  () => second.connect(),
  /Restore the persisted Wisp Telegram session/iu,
  "connect must not replace a persisted session before restore resolves its state",
);

const restored = await second.restore();
assert.ok(restored);
assert.equal(second.connected(), true);
assert.equal(await second.getSessionId(), connected.sessionId);
assert.deepEqual((await second.getAccounts()).map((item) => item.permissionLevel), ["gvexa@active"]);
assert.equal(restored.sessionId, connected.sessionId);
assert.equal(secondHarness.prepareBodies[0].kind, "restore");
assert.equal(secondHarness.prepareBodies[0].sessionId, connected.sessionId);
assert.equal(secondHarness.prepareBodies[0].origin, "https://swap.windcrypto.com");
assert.equal(secondHarness.prepareBodies[0].expectedAccount, "gvexa");
assert.equal(secondHarness.prepareBodies[0].expectedPermission, "active");
assert.equal(
  secondHarness.opened.length,
  0,
  "authoritative restore must not reopen the wallet Mini App",
);

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
assert.equal(secondHarness.opened.length, 1, "signing must open Wisp exactly once");

await second.disconnect();
const disconnectBody = secondHarness.prepareBodies.find((body) => body.kind === "disconnect");
assert.ok(disconnectBody, "expected a wallet-authoritative disconnect request");
assert.equal(disconnectBody.sessionId, connected.sessionId);
assert.equal(second.connected(), false);
assert.equal(await second.getSessionId(), null);
assert.deepEqual(await second.getAccounts(), []);
assert.equal(
  secondHarness.opened.length,
  1,
  "authoritative disconnect must not reopen Wisp after the signing handoff",
);
assert.equal(await second.getStoredSession(), null);
await assert.rejects(
  () => second.disconnect(),
  /not connected/iu,
  "disconnect must report a real not-connected state instead of silently succeeding",
);

console.log("PASS: Wisp Telegram persisted pointer is not treated as a live connection");
console.log("PASS: cold restore revalidates immediately without reopening Wisp");
console.log("PASS: connect/sign/transact enforce the restored active-session lifecycle");
console.log("PASS: signing is bound to the restored session and account permission");
console.log("PASS: multi-action transact produces one VSR and one Telegram signing handoff");
console.log("PASS: disconnect clears local connection state and revokes the captured wallet session");
