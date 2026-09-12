import assert from "node:assert/strict";
import { PrivateKey } from "../packages/crypto/dist/index.js";
import { MemorySessionStorage, SessionManager } from "../packages/session/dist/index.js";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_ERROR_CODES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  VexaniumProviderError,
} from "../packages/vexanium/dist/index.js";
import { WispWalletPlugin } from "../packages/wallet-plugin-wisp/dist/index.js";

const walletSessionId = "wallet-session-cold-restore-1";
const privateKey = PrivateKey.fromBytes(
  "K1",
  Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0)),
);
const account = {
  actor: "windstack",
  permission: "active",
  permissionLevel: "windstack@active",
  publicKey: privateKey.toPublicKey().toString(),
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
};
const capabilities = Object.values(VEXANIUM_CAPABILITIES);
const methods = Object.values(VEXANIUM_METHODS);

let interactiveConnectCalls = 0;
let restoreCalls = 0;
let getAccountsCalls = 0;
let disconnectCalls = 0;
let authorized = false;

const provider = {
  providerInfo: {
    uuid: "com.test.wisp",
    name: "Test Wisp",
    rdns: "com.test.wisp",
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: VEXANIUM_PROVIDER_VERSION,
    chains: [VEXANIUM_MAINNET_CHAIN_ID],
    capabilities,
  },
  async request({ method, params }) {
    switch (method) {
      case VEXANIUM_METHODS.GET_CAPABILITIES:
        return {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          capabilities,
          chains: [VEXANIUM_MAINNET_CHAIN_ID],
          methods,
        };
      case VEXANIUM_METHODS.REQUEST_ACCOUNTS:
        interactiveConnectCalls += 1;
        authorized = true;
        return {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          sessionId: walletSessionId,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
          accounts: [account],
          capabilities,
        };
      case VEXANIUM_METHODS.RESTORE_SESSION:
        restoreCalls += 1;
        assert.equal(params.standard, VEXANIUM_PROVIDER_STANDARD);
        assert.equal(params.version, VEXANIUM_PROVIDER_VERSION);
        assert.equal(params.sessionId, walletSessionId);
        assert.equal(params.chainId, VEXANIUM_MAINNET_CHAIN_ID);
        if (!authorized) {
          throw new VexaniumProviderError(
            VEXANIUM_ERROR_CODES.UNAUTHORIZED,
            "Wallet session is revoked",
          );
        }
        return {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          sessionId: walletSessionId,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
          accounts: [account],
          capabilities,
        };
      case VEXANIUM_METHODS.GET_ACCOUNTS:
        getAccountsCalls += 1;
        return {
          sessionId: walletSessionId,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
          accounts: authorized ? [account] : [],
        };
      case VEXANIUM_METHODS.DISCONNECT:
        disconnectCalls += 1;
        assert.equal(params.sessionId, walletSessionId);
        authorized = false;
        return null;
      default:
        throw new VexaniumProviderError(
          VEXANIUM_ERROR_CODES.METHOD_NOT_FOUND,
          `Unsupported method: ${method}`,
        );
    }
  },
};

const chain = {
  id: VEXANIUM_MAINNET_CHAIN_ID,
  url: "https://api.windcrypto.com",
  contracts: { system: "vexcore", token: "vex.token" },
};
const storage = new MemorySessionStorage();

const firstKit = new SessionManager({
  chains: [chain],
  walletPlugins: [new WispWalletPlugin({ provider })],
  storage,
  appName: "Cold Restore Test",
});
const firstSession = await firstKit.login();
assert.equal(firstSession.actor, account.actor);
assert.equal(firstSession.walletSessionId, walletSessionId);
assert.equal(interactiveConnectCalls, 1);
assert.equal(restoreCalls, 0);

const storedAfterLogin = JSON.parse(await storage.get("windstack:session"));
assert.equal(storedAfterLogin.walletSessionId, walletSessionId);

const restoredKit = new SessionManager({
  chains: [chain],
  walletPlugins: [new WispWalletPlugin({ provider })],
  storage,
  appName: "Cold Restore Test",
});
const restoredSession = await restoredKit.restore();
assert.ok(restoredSession);
assert.equal(restoredSession.actor, account.actor);
assert.equal(restoredSession.permission, account.permission);
assert.equal(restoredSession.walletSessionId, walletSessionId);
assert.equal(interactiveConnectCalls, 1, "cold restore must never reopen interactive connect");
assert.equal(restoreCalls, 1);
assert.equal(getAccountsCalls, 1, "cold restore must synchronize canonical client session state");

await restoredKit.logout();
assert.equal(disconnectCalls, 1, "cold-restored logout must revoke the wallet session");
assert.equal(await storage.get("windstack:session"), null);

const reconnectKit = new SessionManager({
  chains: [chain],
  walletPlugins: [new WispWalletPlugin({ provider })],
  storage,
  appName: "Cold Restore Test",
});
await reconnectKit.login();
assert.equal(interactiveConnectCalls, 2);
authorized = false;

const revokedKit = new SessionManager({
  chains: [chain],
  walletPlugins: [new WispWalletPlugin({ provider })],
  storage,
  appName: "Cold Restore Test",
});
assert.equal(await revokedKit.restore(), null);
assert.equal(
  interactiveConnectCalls,
  2,
  "revoked restore must not silently fall back to vex_requestAccounts",
);
assert.equal(restoreCalls, 2);
assert.equal(await storage.get("windstack:session"), null);

const conflictingPlugin = new WispWalletPlugin({ provider });
await conflictingPlugin.login({ chain, appName: "Restore Conflict Test" });
const disconnectsBeforeSessionConflict = disconnectCalls;
assert.equal(
  await conflictingPlugin.restore({
    chain,
    appName: "Restore Conflict Test",
    identity: {
      actor: account.actor,
      permission: account.permission,
      publicKey: account.publicKey,
    },
    walletSessionId: "wallet-session-conflict",
  }),
  null,
);
assert.equal(
  disconnectCalls,
  disconnectsBeforeSessionConflict + 1,
  "a conflicting in-memory session must be disconnected before restore returns null",
);

await conflictingPlugin.login({ chain, appName: "Restore Conflict Test" });
const disconnectsBeforeIdentityConflict = disconnectCalls;
assert.equal(
  await conflictingPlugin.restore({
    chain,
    appName: "Restore Conflict Test",
    identity: {
      actor: "alice",
      permission: account.permission,
      publicKey: account.publicKey,
    },
    walletSessionId,
  }),
  null,
);
assert.equal(
  disconnectCalls,
  disconnectsBeforeIdentityConflict + 1,
  "an account/permission conflict must not leave the Vexanium client connected",
);

console.log("Wisp cold session restore tests: PASS");
