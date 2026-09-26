import assert from "node:assert/strict";

import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  assertVexaniumAccountsResponse,
  assertVexaniumCapabilitiesRequest,
  assertVexaniumChainChangedEvent,
  assertVexaniumDisconnectEvent,
  createVexaniumAccountsChangedEvent,
  createVexaniumAccountsResponse,
  createVexaniumCapabilitiesResponse,
  createVexaniumChainChangedEvent,
  createVexaniumConnectResponse,
  createVexaniumDisconnectEvent,
  createVexaniumProviderInfo,
} from "../packages/vexanium/dist/index.js";
import {
  WISP_PROVIDER_MARKER,
  WISP_PROVIDER_NAME,
  WISP_PROVIDER_RDNS,
  createWispEip6963ProviderInfo,
  createWispVexaniumProviderInfo,
  isWispProviderRdns,
} from "../packages/wallet-plugin-wisp/dist/index.js";

const capabilities = Object.values(VEXANIUM_CAPABILITIES);

const providerInfo = createVexaniumProviderInfo({
  uuid: "example-wallet-provider",
  name: "Example Wallet",
  rdns: "org.example.wallet",
  chains: [VEXANIUM_MAINNET_CHAIN_ID],
  capabilities,
});
assert.equal(providerInfo.standard, VEXANIUM_PROVIDER_STANDARD);
assert.equal(providerInfo.version, VEXANIUM_PROVIDER_VERSION);

const capabilityResponse = createVexaniumCapabilitiesResponse({
  capabilities,
  chains: [VEXANIUM_MAINNET_CHAIN_ID],
  methods: Object.values(VEXANIUM_METHODS),
});
assert.equal(capabilityResponse.standard, VEXANIUM_PROVIDER_STANDARD);

assertVexaniumCapabilitiesRequest({
  standard: VEXANIUM_PROVIDER_STANDARD,
  version: VEXANIUM_PROVIDER_VERSION,
  requiredCapabilities: [VEXANIUM_CAPABILITIES.ACCOUNTS],
});
assert.throws(() =>
  assertVexaniumCapabilitiesRequest({
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: VEXANIUM_PROVIDER_VERSION,
    requiredCapabilities: ["not.real"],
  }),
);

const connectResponse = createVexaniumConnectResponse({
  sessionId: "wallet-session-1",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  accounts: ["alice@active"],
  capabilities,
});
assert.equal(connectResponse.accounts[0]?.permissionLevel, "alice@active");

const accountsResponse = createVexaniumAccountsResponse({
  sessionId: "wallet-session-1",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  accounts: ["alice@active"],
});
assertVexaniumAccountsResponse(accountsResponse);
assert.throws(() =>
  assertVexaniumAccountsResponse({
    sessionId: "",
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
    accounts: [],
  }),
);

const accountsChanged = createVexaniumAccountsChangedEvent({
  sessionId: "wallet-session-1",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  accounts: ["alice@active"],
});
assertVexaniumAccountsResponse(accountsChanged);

const chainChanged = createVexaniumChainChangedEvent(VEXANIUM_MAINNET_CHAIN_ID);
assert.equal(chainChanged, VEXANIUM_MAINNET_CHAIN_ID);
assertVexaniumChainChangedEvent(chainChanged);
assert.throws(() => assertVexaniumChainChangedEvent("not-a-chain"));

const disconnectEvent = createVexaniumDisconnectEvent({
  code: 4900,
  message: "Wallet disconnected",
});
assert.deepEqual(disconnectEvent, { code: 4900, message: "Wallet disconnected" });
assertVexaniumDisconnectEvent(disconnectEvent);
assert.throws(() => createVexaniumDisconnectEvent({ code: 4900, message: "" }));

assert.equal(WISP_PROVIDER_NAME, "Wisp");
assert.equal(WISP_PROVIDER_RDNS, "com.wisp.wallet");
assert.equal(WISP_PROVIDER_MARKER, "isWispWallet");
assert.equal(isWispProviderRdns("com.wisp.wallet"), true);

const wispVex = createWispVexaniumProviderInfo({ uuid: "wisp-frame-instance" });
assert.equal(wispVex.rdns, WISP_PROVIDER_RDNS);

const wispEvm = createWispEip6963ProviderInfo({
  uuid: "4f3d8f58-e618-4c72-87e3-6f98b8f695d5",
  icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
});
assert.equal(wispEvm.rdns, WISP_PROVIDER_RDNS);
assert.throws(() =>
  createWispEip6963ProviderInfo({
    uuid: "not-a-uuid",
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
  }),
);

console.log("Wisp identity and provider-author primitives: PASS");
