import assert from "node:assert/strict";
import { createEvmFrameHost, createEvmFrameProvider } from "../packages/evm/dist/index.js";

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
    parentRuntime.dispatchEvent(messageEvent(childProxy, childOrigin, data));
  },
};

childProxy = {
  postMessage(data, targetOrigin) {
    assert.equal(targetOrigin, childOrigin);
    childRuntime.dispatchEvent(messageEvent(parentProxy, parentOrigin, data));
  },
};

const calls = [];
const host = createEvmFrameHost({
  allowedOrigin: childOrigin,
  sourceWindow: childProxy,
  window: parentRuntime,
  async handleRequest(args) {
    calls.push(args);
    if (args.method === "eth_chainId") return "0x1a50";
    if (args.method === "eth_requestAccounts") {
      return ["0x0000000000000000000000000000000000000001"];
    }
    throw Object.assign(new Error("Unsupported test method"), { code: 4200 });
  },
});

let announcements = 0;
childRuntime.addEventListener("eip6963:announceProvider", (event) => {
  announcements += 1;
  assert.equal(event.detail.info.rdns, "com.wisp.wallet");
});

const provider = createEvmFrameProvider({
  parentOrigin,
  parentWindow: parentProxy,
  window: childRuntime,
  requestTimeoutMs: 2_000,
  providerInfo: {
    uuid: "6fd3e0d4-b77c-4ab8-9a95-b9f4c80db196",
    name: "Wisp Wallet",
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    rdns: "com.wisp.wallet",
  },
});

assert.equal(announcements, 1);
childRuntime.dispatchEvent(new Event("eip6963:requestProvider"));
assert.equal(announcements, 2);
assert.equal(await provider.request({ method: "eth_chainId" }), "0x1a50");
assert.deepEqual(await provider.request({ method: "eth_requestAccounts" }), [
  "0x0000000000000000000000000000000000000001",
]);

let changed = null;
provider.on("accountsChanged", (accounts) => {
  changed = accounts;
});
host.emit("accountsChanged", ["0x0000000000000000000000000000000000000002"]);
assert.deepEqual(changed, ["0x0000000000000000000000000000000000000002"]);

await assert.rejects(
  () => provider.request({ method: "eth_notSupported" }),
  (error) => error?.code === 4200 && error?.message === "Unsupported test method",
);

provider.destroy();
host.destroy();
await assert.rejects(() => provider.request({ method: "eth_chainId" }), /destroyed/u);
assert.equal(calls.length, 3);

console.log("EVM frame provider tests: PASS");
