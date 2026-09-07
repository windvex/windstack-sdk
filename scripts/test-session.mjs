/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import { PrivateKeySigner } from "../packages/antelope/dist/index.js";
import { PrivateKey } from "../packages/crypto/dist/index.js";
import { MemorySessionStorage, SessionManager } from "../packages/session/dist/index.js";

const chainId = "11".repeat(32);
const chain = {
  id: chainId,
  url: ["https://one.test", "https://two.test"],
  contracts: { system: "vexcore", token: "vex.token" },
};
const privateKey = PrivateKey.fromBytes(
  "K1",
  Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0)),
);
const signer = new PrivateKeySigner([privateKey]);
const identity = {
  actor: "alice",
  permission: "active",
  publicKey: privateKey.toPublicKey().toString(),
};

const storage = new MemorySessionStorage();
let logoutCalls = 0;
const plugin = {
  id: "test-wallet",
  async login() {
    return { identity, signer };
  },
  async restore() {
    return { identity, signer };
  },
  async logout() {
    logoutCalls += 1;
  },
};
const kit = new SessionManager({ chains: [chain], walletPlugins: [plugin], storage });
const session = await kit.login();
assert.equal(session.actor, "alice");
assert.equal(session.permission, "active");
assert.equal(Object.isFrozen(session.chain), true);
assert.equal(Object.isFrozen(session.chain.url), true);
assert.equal(Object.isFrozen(session.chain.contracts), true);
const stored = await storage.get("windstack:session");
assert.ok(stored);
assert.equal(
  stored.includes(privateKey.toString()),
  false,
  "stored sessions must never contain private keys",
);
await assert.rejects(() => kit.login(), /already active/);
await kit.logout();
assert.equal(kit.getSession(), null);
assert.equal(await storage.get("windstack:session"), null);
assert.equal(logoutCalls, 1);

await storage.set(
  "windstack:session",
  JSON.stringify({ chainId, walletPluginId: plugin.id, identity }),
);
assert.equal((await kit.restore())?.actor, "alice");
await kit.logout();

await storage.set(
  "windstack:session",
  JSON.stringify({ chainId, walletPluginId: "missing-wallet", identity }),
);
assert.equal(await kit.restore(), null);
assert.equal(await storage.get("windstack:session"), null);

await storage.set(
  "windstack:session",
  JSON.stringify({ chainId, walletPluginId: plugin.id, identity }),
);
const mismatchedRestoreKit = new SessionManager({
  chains: [chain],
  walletPlugins: [
    {
      ...plugin,
      async restore() {
        return { identity: { ...identity, actor: "bob" }, signer };
      },
    },
  ],
  storage,
});
await assert.rejects(() => mismatchedRestoreKit.restore(), /does not match/);
assert.equal(mismatchedRestoreKit.getSession(), null);
await storage.remove("windstack:session");

await storage.set("windstack:session", "{malformed");
assert.equal(await kit.getStoredSession(), null);
assert.equal(await storage.get("windstack:session"), null);

let rollbackCalls = 0;
const failingStorage = {
  async get() {
    return null;
  },
  async set() {
    throw new Error("storage full");
  },
  async remove() {},
};
const rollbackPlugin = {
  ...plugin,
  id: "rollback-wallet",
  async logout() {
    rollbackCalls += 1;
  },
};
const rollbackKit = new SessionManager({
  chains: [chain],
  walletPlugins: [rollbackPlugin],
  storage: failingStorage,
});
await assert.rejects(() => rollbackKit.login(), /storage full/);
assert.equal(rollbackCalls, 1);
assert.equal(rollbackKit.getSession(), null);

const cleanupStorage = new MemorySessionStorage();
const logoutFailureKit = new SessionManager({
  chains: [chain],
  walletPlugins: [
    {
      ...plugin,
      id: "logout-failure",
      async logout() {
        throw new Error("wallet offline");
      },
    },
  ],
  storage: cleanupStorage,
});
await logoutFailureKit.login();
await assert.rejects(() => logoutFailureKit.logout(), /wallet offline/);
assert.equal(logoutFailureKit.getSession(), null);
assert.equal(await cleanupStorage.get("windstack:session"), null);

let releaseLogin;
const pendingPlugin = {
  id: "pending-wallet",
  login: async () =>
    new Promise((resolve) => {
      releaseLogin = () => resolve({ identity, signer });
    }),
};
const pendingKit = new SessionManager({ chains: [chain], walletPlugins: [pendingPlugin] });
const pendingLogin = pendingKit.login();
await assert.rejects(() => pendingKit.login(), /already active/);
releaseLogin();
await pendingLogin;

assert.throws(
  () => new SessionManager({ chains: [chain, chain], walletPlugins: [plugin] }),
  /chain ids must be unique/,
);
assert.throws(
  () => new SessionManager({ chains: [chain], walletPlugins: [plugin, plugin] }),
  /plugin ids must be unique/,
);
const invalidIdentityKit = new SessionManager({
  chains: [chain],
  walletPlugins: [
    {
      id: "invalid-identity",
      login: async () => ({ identity: { actor: "bad-name", permission: "active" }, signer }),
    },
  ],
});
await assert.rejects(() => invalidIdentityKit.login(), /Invalid Antelope name character/);
const invalidSignerKit = new SessionManager({
  chains: [chain],
  walletPlugins: [{ id: "invalid-signer", login: async () => ({ identity, signer: {} }) }],
});
await assert.rejects(() => invalidSignerKit.login(), /invalid signer/);
console.log("Session lifecycle tests passed");
