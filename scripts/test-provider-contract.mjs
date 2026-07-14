import assert from "node:assert/strict";
import { Bytes, Checksum256, PrivateKey, Serializer, Transaction } from "@wharfkit/antelope";
import { SigningRequest } from "@wharfkit/signing-request";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_ERROR_CODES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_MAINNET_SCOPE,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  VexaniumProviderError,
  createVexaniumClient,
  isVexaniumProvider,
} from "../packages/vexanium/dist/index.js";

const capabilities = Object.values(VEXANIUM_CAPABILITIES);
const methods = Object.values(VEXANIUM_METHODS);
const privateKey = PrivateKey.generate("K1");
const signature = String(privateKey.signDigest(Checksum256.hash(Bytes.from("00"))));
const transaction = Transaction.from({
  expiration: "2026-07-14T12:00:00",
  ref_block_num: 1,
  ref_block_prefix: 2,
  max_net_usage_words: 0,
  max_cpu_usage_ms: 0,
  delay_sec: 0,
  context_free_actions: [],
  actions: [],
  transaction_extensions: [],
});
const portableRequest = SigningRequest.fromTransaction(
  VEXANIUM_MAINNET_CHAIN_ID,
  Serializer.encode({ object: transaction }).array,
).encode(false, true);
const account = {
  actor: "windstack",
  permission: "active",
  permissionLevel: "windstack@active",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
};

function makeProvider(overrides = {}) {
  const calls = [];
  let connected = false;
  const provider = {
    providerInfo: {
      uuid: "com.test.wallet",
      name: "Test Vexanium Wallet",
      rdns: "com.test.wallet",
      standard: VEXANIUM_PROVIDER_STANDARD,
      version: VEXANIUM_PROVIDER_VERSION,
      chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
      capabilities,
      ...overrides.providerInfo,
    },
    async request({ method, params }) {
      calls.push({ method, params });
      if (overrides.request) return overrides.request({ method, params, calls });

      switch (method) {
        case VEXANIUM_METHODS.GET_CAPABILITIES:
          return {
            standard: VEXANIUM_PROVIDER_STANDARD,
            version: VEXANIUM_PROVIDER_VERSION,
            capabilities,
            chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
            methods,
          };
        case VEXANIUM_METHODS.REQUEST_ACCOUNTS:
          connected = true;
          return {
            standard: VEXANIUM_PROVIDER_STANDARD,
            version: VEXANIUM_PROVIDER_VERSION,
            sessionId: "wallet-session-v1",
            chainId: VEXANIUM_MAINNET_CHAIN_ID,
            accounts: [account],
            capabilities,
          };
        case VEXANIUM_METHODS.GET_ACCOUNTS:
          return {
            sessionId: "wallet-session-v1",
            chainId: VEXANIUM_MAINNET_CHAIN_ID,
            accounts: connected ? [account] : [],
          };
        case VEXANIUM_METHODS.GET_CHAIN:
          return VEXANIUM_MAINNET_CHAIN_ID;
        case VEXANIUM_METHODS.SIGN_TRANSACTION:
          return { signatures: [signature] };
        case VEXANIUM_METHODS.SIGNING_REQUEST:
          return { signatures: [signature], broadcast: false };
        case VEXANIUM_METHODS.DISCONNECT:
          connected = false;
          return null;
        default:
          throw new VexaniumProviderError(
            VEXANIUM_ERROR_CODES.METHOD_NOT_FOUND,
            `Unsupported method: ${method}`,
          );
      }
    },
  };
  return { provider, calls };
}

// providerInfo is mandatory and brand-neutral.
assert.equal(isVexaniumProvider({ request: async () => null }), false);
const { provider, calls } = makeProvider();
assert.equal(isVexaniumProvider(provider), true);

const client = await createVexaniumClient({ provider, autoSync: false });
const negotiated = await client.negotiate([
  VEXANIUM_CAPABILITIES.ACCOUNTS,
  VEXANIUM_CAPABILITIES.SESSIONS,
]);
assert.equal(negotiated.standard, VEXANIUM_PROVIDER_STANDARD);
assert.equal(negotiated.version, VEXANIUM_PROVIDER_VERSION);
assert.ok(negotiated.capabilities.includes(VEXANIUM_CAPABILITIES.EXACT_TRANSACTION_SIGNING));

const accounts = await client.connect({ chainId: VEXANIUM_MAINNET_CHAIN_ID });
assert.equal(accounts[0].permissionLevel, "windstack@active");
assert.equal(client.getSession().walletSessionId, "wallet-session-v1");
assert.equal(client.getProviderInfo().rdns, "com.test.wallet");

const connectCall = calls.find((call) => call.method === VEXANIUM_METHODS.REQUEST_ACCOUNTS);
assert.equal(connectCall.params.standard, VEXANIUM_PROVIDER_STANDARD);
assert.equal(connectCall.params.version, VEXANIUM_PROVIDER_VERSION);
assert.ok(connectCall.params.requiredCapabilities.includes(VEXANIUM_CAPABILITIES.ACCOUNTS));

await client.signTransaction({
  serializedTransaction: "000102ff",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  account: "windstack",
  permission: "active",
});
const signCall = calls.find((call) => call.method === VEXANIUM_METHODS.SIGN_TRANSACTION);
assert.equal(signCall.params.sessionId, "wallet-session-v1");
assert.equal(signCall.params.serializedTransaction, "000102ff");

// WharfKit-compatible ESR input is validated and forwarded without rewriting it.
await client.signSigningRequest({ request: portableRequest, broadcast: false });
const requestCall = calls.find((call) => call.method === VEXANIUM_METHODS.SIGNING_REQUEST);
assert.equal(requestCall.params.request, portableRequest);

// Incompatible provider major versions fail negotiation deterministically.
const { provider: incompatibleProvider } = makeProvider({
  providerInfo: { version: "2.0.0" },
});
const incompatibleClient = await createVexaniumClient({
  provider: incompatibleProvider,
  autoSync: false,
});
await assert.rejects(
  () => incompatibleClient.negotiate(),
  (error) => error instanceof VexaniumProviderError && error.code === VEXANIUM_ERROR_CODES.INCOMPATIBLE_VERSION,
);

// Required unsupported capabilities use a standard error code.
const limitedCapabilities = [VEXANIUM_CAPABILITIES.ACCOUNTS];
const { provider: limitedProvider } = makeProvider({
  providerInfo: { capabilities: limitedCapabilities },
  request({ method }) {
    if (method === VEXANIUM_METHODS.GET_CAPABILITIES) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        capabilities: limitedCapabilities,
        chains: [VEXANIUM_MAINNET_CHAIN_ID],
        methods: [VEXANIUM_METHODS.GET_CAPABILITIES, VEXANIUM_METHODS.GET_ACCOUNTS],
      };
    }
    throw new Error(`Unexpected method ${method}`);
  },
});
const limitedClient = await createVexaniumClient({ provider: limitedProvider, autoSync: false });
await assert.rejects(
  () => limitedClient.negotiate([VEXANIUM_CAPABILITIES.EXACT_TRANSACTION_SIGNING]),
  (error) => error instanceof VexaniumProviderError && error.code === VEXANIUM_ERROR_CODES.UNSUPPORTED_CAPABILITY,
);

// Wallet errors keep their standard code through the SDK boundary.
const { provider: rejectingProvider } = makeProvider({
  request({ method }) {
    if (method === VEXANIUM_METHODS.GET_CAPABILITIES) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        capabilities,
        chains: [VEXANIUM_MAINNET_CHAIN_ID],
        methods,
      };
    }
    if (method === VEXANIUM_METHODS.REQUEST_ACCOUNTS) {
      throw { code: VEXANIUM_ERROR_CODES.USER_REJECTED, message: "User rejected" };
    }
    throw new Error(`Unexpected method ${method}`);
  },
});
const rejectingClient = await createVexaniumClient({ provider: rejectingProvider, autoSync: false });
await assert.rejects(
  () => rejectingClient.connect(),
  (error) => error instanceof VexaniumProviderError && error.code === VEXANIUM_ERROR_CODES.USER_REJECTED,
);

console.log("VexaniumProvider contract tests: PASS");
