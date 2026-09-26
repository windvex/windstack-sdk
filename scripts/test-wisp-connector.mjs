import assert from "node:assert/strict";

import { MemorySessionStorage } from "../packages/session/dist/index.js";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
} from "../packages/vexanium/dist/index.js";
import {
  createWispConnector,
  createWispVexaniumProviderInfo,
} from "../packages/wallet-plugin-wisp/dist/index.js";

const ALL_CAPABILITIES = Object.values(VEXANIUM_CAPABILITIES);
const ALL_METHODS = Object.values(VEXANIUM_METHODS);
const SESSION_ID = "wisp_connector_session_1";

function createProvider() {
  const accounts = [
    {
      actor: "gvexa",
      permission: "active",
      permissionLevel: "gvexa@active",
      chainId: VEXANIUM_MAINNET_CHAIN_ID,
    },
  ];
  const providerInfo = createWispVexaniumProviderInfo({
    uuid: "4bd9c8f1-d730-4e19-9d8e-1eb85be03f64",
  });

  return {
    providerInfo,
    async request({ method, params }) {
      if (method === VEXANIUM_METHODS.GET_CAPABILITIES) {
        return {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          capabilities: ALL_CAPABILITIES,
          chains: [VEXANIUM_MAINNET_CHAIN_ID],
          methods: ALL_METHODS,
        };
      }
      if (method === VEXANIUM_METHODS.REQUEST_ACCOUNTS) {
        return {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          sessionId: SESSION_ID,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
          accounts,
          capabilities: ALL_CAPABILITIES,
        };
      }
      if (method === VEXANIUM_METHODS.RESTORE_SESSION) {
        assert.equal(params.sessionId, SESSION_ID);
        return {
          standard: VEXANIUM_PROVIDER_STANDARD,
          version: VEXANIUM_PROVIDER_VERSION,
          sessionId: SESSION_ID,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
          accounts,
          capabilities: ALL_CAPABILITIES,
        };
      }
      if (method === VEXANIUM_METHODS.GET_ACCOUNTS) {
        return {
          sessionId: SESSION_ID,
          chainId: VEXANIUM_MAINNET_CHAIN_ID,
          accounts,
        };
      }
      if (method === VEXANIUM_METHODS.GET_CHAIN) return VEXANIUM_MAINNET_CHAIN_ID;
      if (method === VEXANIUM_METHODS.DISCONNECT) return null;
      throw new Error(`Unexpected provider method: ${method}`);
    },
  };
}

const storage = new MemorySessionStorage();
const provider = createProvider();
const connector = createWispConnector({
  provider,
  appName: "Connector Test",
  dapp: {
    name: "Connector Test",
    url: "https://example.com/app",
  },
  sessionStorage: storage,
});

let notifications = 0;
const unsubscribe = connector.subscribe(() => {
  notifications += 1;
});

assert.equal(connector.getSnapshot().status, "idle");
const connected = await connector.connect();
assert.equal(connected.status, "connected");
assert.equal(connected.transport, "injected");
assert.equal(connected.account?.permissionLevel, "gvexa@active");
assert.equal(connected.sessionId, SESSION_ID);
assert.ok(connector.getProviderSession());
assert.ok(notifications >= 2);

unsubscribe();
connector.destroy();

const restoredConnector = createWispConnector({
  provider,
  appName: "Connector Test",
  dapp: {
    name: "Connector Test",
    url: "https://example.com/app",
  },
  sessionStorage: storage,
});
const restored = await restoredConnector.restore();
assert.equal(restored.status, "connected");
assert.equal(restored.transport, "injected");
assert.equal(restored.sessionId, SESSION_ID);
await restoredConnector.disconnect();
assert.equal(restoredConnector.getSnapshot().status, "idle");
restoredConnector.destroy();

const telegramSession = {
  sessionId: "telegram-session-1",
  account: {
    actor: "gvexa",
    permission: "active",
    permissionLevel: "gvexa@active",
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
  },
  accounts: [],
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  capabilities: [],
  origin: "https://example.com",
  validatedAt: Date.now(),
};
let telegramConnected = false;
const telegram = {
  async connect() {
    telegramConnected = true;
    return telegramSession;
  },
  async restore() {
    return telegramConnected ? telegramSession : null;
  },
  async disconnect() {
    telegramConnected = false;
  },
  connected: () => telegramConnected,
  getSession: () => (telegramConnected ? telegramSession : null),
  getSessionId: async () => (telegramConnected ? telegramSession.sessionId : null),
  getStoredSession: async () => (telegramConnected ? telegramSession : null),
  getAccounts: async () => (telegramConnected ? [telegramSession.account] : []),
  getChain: () => VEXANIUM_MAINNET_CHAIN_ID,
  getCapabilities: () => [],
  async clearSession() {
    telegramConnected = false;
  },
  async signSigningRequest() {
    throw new Error("not used");
  },
  async transact() {
    throw new Error("not used");
  },
};

const telegramConnector = createWispConnector({ telegram });
const telegramConnectedSnapshot = await telegramConnector.connect({ transport: "telegram" });
assert.equal(telegramConnectedSnapshot.status, "connected");
assert.equal(telegramConnectedSnapshot.transport, "telegram");
assert.equal(telegramConnectedSnapshot.sessionId, "telegram-session-1");
await telegramConnector.disconnect();
assert.equal(telegramConnector.getSnapshot().status, "idle");
telegramConnector.destroy();

console.log("Wisp framework-neutral connector: PASS");
