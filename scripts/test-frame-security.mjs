import assert from "node:assert/strict";

import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  createVexaniumFrameHost,
  createVexaniumFrameProvider,
  createVexaniumProviderInfo,
} from "../packages/vexanium/dist/index.js";

function messageEvent(source, origin, data) {
  const event = new Event("message");
  Object.defineProperties(event, {
    source: { value: source },
    origin: { value: origin },
    data: { value: data },
  });
  return event;
}

const parentOrigin = "https://wallet.example";
const childOrigin = "https://app.example";
const parentRuntime = new EventTarget();
const childRuntime = new EventTarget();

let parentProxy;
let childProxy;

parentProxy = {
  postMessage(data, targetOrigin) {
    assert.equal(targetOrigin, parentOrigin);
    assert.notEqual(targetOrigin, "*");
    parentRuntime.dispatchEvent(messageEvent(childProxy, childOrigin, data));
  },
};

childProxy = {
  postMessage(data, targetOrigin) {
    assert.equal(targetOrigin, childOrigin);
    assert.notEqual(targetOrigin, "*");
    childRuntime.dispatchEvent(messageEvent(parentProxy, parentOrigin, data));
  },
};

let requestCount = 0;
const host = createVexaniumFrameHost({
  allowedOrigin: childOrigin,
  sourceWindow: childProxy,
  window: parentRuntime,
  handleRequest({ method }) {
    requestCount += 1;
    if (method === "vex_getChain") return VEXANIUM_MAINNET_CHAIN_ID;
    throw Object.assign(new Error("Unsupported test method"), { code: 4200 });
  },
});

const frameRequest = {
  channel: "windstack:vexanium:frame:v1",
  type: "request",
  id: "spoofed",
  args: { method: "vex_getChain" },
};

parentRuntime.dispatchEvent(
  messageEvent({ postMessage() {} }, childOrigin, frameRequest),
);
parentRuntime.dispatchEvent(
  messageEvent(childProxy, "https://attacker.example", frameRequest),
);
parentRuntime.dispatchEvent(
  messageEvent(childProxy, childOrigin, {
    channel: "unknown:channel",
    type: "request",
    id: "unknown",
    args: { method: "vex_getChain" },
  }),
);
assert.equal(requestCount, 0);

let announcements = 0;
childRuntime.addEventListener("vexanium:announceProvider", (event) => {
  announcements += 1;
  assert.equal(event.detail.info.rdns, "org.example.framewallet");
});

const provider = createVexaniumFrameProvider({
  parentOrigin,
  parentWindow: parentProxy,
  window: childRuntime,
  requestTimeoutMs: 2_000,
  providerInfo: createVexaniumProviderInfo({
    uuid: "frame-wallet-instance",
    name: "Frame Wallet",
    rdns: "org.example.framewallet",
    chains: [VEXANIUM_MAINNET_CHAIN_ID],
    capabilities: Object.values(VEXANIUM_CAPABILITIES),
  }),
});

assert.equal(announcements, 1);
childRuntime.dispatchEvent(new Event("vexanium:requestProvider"));
assert.equal(announcements, 2);
assert.equal(await provider.request({ method: "vex_getChain" }), VEXANIUM_MAINNET_CHAIN_ID);
assert.equal(requestCount, 1);

let accountsChanged = null;
let chainChanged = null;
provider.on("accountsChanged", (payload) => {
  accountsChanged = payload;
});
provider.on("chainChanged", (payload) => {
  chainChanged = payload;
});

host.emit("accountsChanged", {
  sessionId: "frame-session-1",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  accounts: [
    {
      actor: "alice",
      permission: "active",
      permissionLevel: "alice@active",
      chainId: VEXANIUM_MAINNET_CHAIN_ID,
    },
  ],
});
host.emit("chainChanged", VEXANIUM_MAINNET_CHAIN_ID);

assert.equal(accountsChanged?.sessionId, "frame-session-1");
assert.equal(accountsChanged?.accounts[0]?.permissionLevel, "alice@active");
assert.equal(chainChanged, VEXANIUM_MAINNET_CHAIN_ID);

provider.destroy();
host.destroy();
await assert.rejects(() => provider.request({ method: "vex_getChain" }), /destroyed/u);

console.log("Vexanium frame security tests: PASS");
