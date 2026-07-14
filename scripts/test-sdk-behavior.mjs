import assert from "node:assert/strict";
import { Asset, Name } from "@wharfkit/antelope";
import {
  resolveDappMetadata,
} from "../packages/core/dist/index.js";
import {
  createEVMClient,
  discoverEVMProviders,
  getEVMProvider,
  isEIP6963ProviderDetail,
} from "../packages/evm/dist/index.js";
import {
  createWispSessionClient,
  isEVMScope,
  isVexaniumScope,
} from "../packages/session/dist/index.js";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_MAINNET_SCOPE,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  VexaniumProviderError,
  buildExplorerAccountUrl,
  buildExplorerTxUrl,
  createVexaniumClient,
  formatAsset,
  normalizeVexaniumAccount,
  parseAsset,
  parsePermissionLevel,
  sameVexaniumChain,
  vexEvm,
  vexNative,
} from "../packages/vexanium/dist/index.js";

class FakeDocument extends EventTarget {
  title = "Test dApp";
  visibilityState = "visible";

  querySelector() {
    return null;
  }
}

class FakeWindow extends EventTarget {
  document = new FakeDocument();
  location = {
    href: "https://app.example/path",
    origin: "https://app.example",
  };
}

function makeEIP1193Provider(chainId = "0x1") {
  const calls = [];
  const listeners = new Map();
  return {
    calls,
    async request(args) {
      calls.push(args);
      if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") {
        return ["0x0000000000000000000000000000000000000001"];
      }
      if (args.method === "eth_chainId") return chainId;
      return null;
    },
    on(event, handler) {
      const current = listeners.get(event) ?? new Set();
      current.add(handler);
      listeners.set(event, current);
    },
    removeListener(event, handler) {
      listeners.get(event)?.delete(handler);
    },
  };
}

const runtimeWindow = new FakeWindow();
globalThis.window = runtimeWindow;

const unsafeMetadata = resolveDappMetadata({
  url: "javascript:alert(1)",
  icon: "data:text/html,<script>alert(1)</script>",
});
assert.equal(unsafeMetadata.url, "https://app.example/path");
assert.equal(unsafeMetadata.icon, undefined);

const firstProvider = makeEIP1193Provider();
const firstDetail = {
  info: {
    uuid: "1b9ca1d2-8f9f-4ce8-8f79-ec4f29fb4230",
    name: "Wisp",
    icon: "data:image/png;base64,AA==",
    rdns: "com.wisp.wallet",
  },
  provider: firstProvider,
};
assert.equal(isEIP6963ProviderDetail(firstDetail), true);
assert.equal(isEIP6963ProviderDetail({ info: { name: "bad" }, provider: firstProvider }), false);

runtimeWindow.addEventListener("eip6963:requestProvider", () => {
  runtimeWindow.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: firstDetail }));
});
let discovered = await discoverEVMProviders(0);
assert.equal(discovered.length, 1);
assert.equal(Object.isFrozen(discovered[0].info), true);
assert.equal(await getEVMProvider(0), firstProvider);

const lateProvider = makeEIP1193Provider("0x1a50");
runtimeWindow.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
  detail: {
    info: {
      uuid: "f6924454-a838-46af-a89c-2c6a8d7f8421",
      name: "Late wallet",
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
      rdns: "com.example.latewallet",
    },
    provider: lateProvider,
  },
}));
discovered = await discoverEVMProviders(0);
assert.equal(discovered.length, 2);

const evmClient = await createEVMClient({ provider: firstProvider, discoveryTimeoutMs: 0 });
await assert.rejects(() => evmClient.switchChain("1"), { code: -32602 });
await assert.rejects(
  () => evmClient.addChain({ chainId: "0x1a50", rpcUrls: ["http://insecure.example"] }),
  { code: -32602 },
);
await evmClient.switchChain("0x1a50");

assert.equal(parseAsset("-1.2345 VEX").amount, -12345n);
assert.equal(formatAsset(-12345n, 4, "VEX"), "-1.2345 VEX");
assert.equal(parseAsset("-1.2345 VEX").value, Asset.from("-1.2345 VEX").toString());
assert.equal(Name.from(parsePermissionLevel("windstack").actor).toString(), "windstack");
assert.throws(() => parseAsset("01.00 VEX"));
assert.deepEqual(parsePermissionLevel("windstack"), {
  actor: "windstack",
  permission: "active",
  permissionLevel: "windstack@active",
});
assert.throws(() => parsePermissionLevel("wind@active@owner"), VexaniumProviderError);
assert.throws(
  () => normalizeVexaniumAccount({ actor: "UPPER", permission: "active" }, VEXANIUM_MAINNET_CHAIN_ID),
  VexaniumProviderError,
);
assert.equal(sameVexaniumChain(VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE), true);
assert.equal(vexNative.rpcUrl, "https://api.windcrypto.com");
assert.equal(vexEvm.chainIdHex, "0x1a50");
assert.equal(vexEvm.rpcUrl, "https://api.windcrypto.com/rpc");
assert.equal(vexEvm.statsUrl, "https://api.windcrypto.com/v3/evm/stats");
assert.equal(vexEvm.explorerUrl, "https://explorer.windcrypto.com/evm");
assert.equal(vexEvm.routes.home, "https://explorer.windcrypto.com/evm");
assert.equal(vexEvm.routes.tx("0xabc"), "https://explorer.windcrypto.com/evm/tx/0xabc");
assert.equal(vexEvm.routes.account("0x123"), "https://explorer.windcrypto.com/evm/address/0x123");
assert.equal(buildExplorerTxUrl("0xabc", { target: "evm" }), vexEvm.routes.tx("0xabc"));
assert.equal(buildExplorerAccountUrl("0x123", { target: "evm" }), vexEvm.routes.account("0x123"));
assert.equal(isVexaniumScope(VEXANIUM_MAINNET_SCOPE), true);
assert.equal(isVexaniumScope("antelope:not-a-chain"), false);
assert.equal(isEVMScope("eip155:6736"), true);
assert.equal(isEVMScope("eip155:-1"), false);

const vexAccount = {
  actor: "windstack",
  permission: "active",
  permissionLevel: "windstack@active",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
};
const vexCalls = [];
const vexProvider = {
  providerInfo: {
    uuid: "com.test.wallet",
    name: "Test wallet",
    rdns: "com.test.wallet",
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: VEXANIUM_PROVIDER_VERSION,
    chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
    capabilities: Object.values(VEXANIUM_CAPABILITIES),
  },
  async request({ method, params }) {
    vexCalls.push({ method, params });
    if (method === VEXANIUM_METHODS.GET_CAPABILITIES) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
        capabilities: Object.values(VEXANIUM_CAPABILITIES),
        methods: Object.values(VEXANIUM_METHODS),
      };
    }
    if (method === VEXANIUM_METHODS.REQUEST_ACCOUNTS) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        sessionId: "session-1",
        chainId: VEXANIUM_MAINNET_CHAIN_ID,
        accounts: [vexAccount],
        capabilities: Object.values(VEXANIUM_CAPABILITIES),
      };
    }
    if (method === VEXANIUM_METHODS.SIGN_TRANSACTION) {
      return { signatures: ["not-a-signature"] };
    }
    if (method === VEXANIUM_METHODS.DISCONNECT) return null;
    throw new Error(`Unexpected method: ${method}`);
  },
};
const vexClient = await createVexaniumClient({ provider: vexProvider, autoSync: false });
const connected = await vexClient.connect({ chainId: VEXANIUM_MAINNET_SCOPE });
assert.equal(connected[0].permissionLevel, "windstack@active");
connected[0].actor = "mutated";
const sessionSnapshot = vexClient.getSession();
sessionSnapshot.walletSessionId = "mutated-session";
assert.equal(vexClient.getSession().accounts[0].actor, "windstack");
assert.equal(vexClient.getSession().walletSessionId, "session-1");
await assert.rejects(
  () => vexClient.signTransaction({
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
    serializedTransaction: "00",
    account: "windstack",
    permission: "active",
  }),
  { code: -32600 },
);
const signCall = vexCalls.find(({ method }) => method === VEXANIUM_METHODS.SIGN_TRANSACTION);
assert.equal(signCall.params.sessionId, "session-1");

const wrongChainSession = await createWispSessionClient({
  evm: {
    isAvailable: () => true,
    getProvider: () => null,
    request: async () => null,
    connect: async () => ["0x0000000000000000000000000000000000000001"],
    getAccounts: async () => [],
    getChainId: async () => "0x1",
    switchChain: async () => null,
    addChain: async () => null,
    on() {},
    off() {},
  },
});
await assert.rejects(() => wrongChainSession.connect(["eip155:6736"]), { code: -32602 });
assert.equal(wrongChainSession.getSession(), null);

await vexClient.disconnect();
vexClient.destroy();
await assert.rejects(() => vexClient.getChain(), { code: 4900 });

delete globalThis.window;
console.log("SDK behavioral regression tests: PASS");
