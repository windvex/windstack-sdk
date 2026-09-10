import assert from "node:assert/strict";
import { bytesToHex } from "../packages/abi/dist/index.js";
import { serializeTransaction } from "../packages/antelope/dist/index.js";
import { PrivateKey, sha256Digest } from "../packages/crypto/dist/index.js";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_ERROR_CODES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_MAINNET_SCOPE,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  VexaniumProviderError,
  createSigningRequest,
  createVexaniumClient,
  isVexaniumProvider,
} from "../packages/vexanium/dist/index.js";

const capabilities = Object.values(VEXANIUM_CAPABILITIES);
const methods = Object.values(VEXANIUM_METHODS);
const privateKey = PrivateKey.generate("K1");
const signature = privateKey.signDigest(sha256Digest(Uint8Array.of(0))).toString();
const exactTransaction = {
  expiration: "2026-07-14T12:00:00",
  ref_block_num: 1,
  ref_block_prefix: 2,
  max_net_usage_words: 0,
  max_cpu_usage_ms: 0,
  delay_sec: 0,
  context_free_actions: [],
  actions: [],
  transaction_extensions: [],
};
const exactSerializedTransaction = bytesToHex(serializeTransaction(exactTransaction));
const portableRequest = await createSigningRequest({
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  transaction: exactTransaction,
});
const account = {
  actor: "windstack",
  permission: "active",
  permissionLevel: "windstack@active",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
};
const transferAbi = {
  version: "eosio::abi/1.2",
  structs: [
    {
      name: "transfer",
      base: "",
      fields: [
        { name: "from", type: "name" },
        { name: "to", type: "name" },
        { name: "quantity", type: "asset" },
        { name: "memo", type: "string" },
      ],
    },
  ],
  actions: [{ name: "transfer", type: "transfer" }],
};
const blockId = `00000063${"00".repeat(4)}15cd5b07${"00".repeat(20)}`;
let rpcPushes = 0;
const rpcFetch = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}"));
  if (url.endsWith("/get_info")) {
    return Response.json({
      chain_id: VEXANIUM_MAINNET_CHAIN_ID,
      head_block_num: 100,
      last_irreversible_block_num: 99,
      head_block_id: blockId,
      head_block_time: "2026-09-10T12:00:00.000",
    });
  }
  if (url.endsWith("/get_block")) {
    return Response.json({ id: blockId, block_num: 99, timestamp: "2026-09-10T11:59:00.000" });
  }
  if (url.endsWith("/get_abi")) {
    assert.ok(body.account_name === "vex.token" || body.account_name === "token.wind");
    return Response.json({ account_name: body.account_name, abi: transferAbi });
  }
  if (url.endsWith("/push_transaction")) {
    rpcPushes += 1;
    return Response.json({ transaction_id: "ab".repeat(32) });
  }
  return Response.json({ message: "not found" }, { status: 404 });
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

assert.equal(isVexaniumProvider({ request: async () => null }), false);
const { provider, calls } = makeProvider();
assert.equal(isVexaniumProvider(provider), true);

const client = await createVexaniumClient({
  provider,
  autoSync: false,
  rpcUrl: "https://unit.test",
  fetch: rpcFetch,
});
const negotiated = await client.negotiate([
  VEXANIUM_CAPABILITIES.ACCOUNTS,
  VEXANIUM_CAPABILITIES.SESSIONS,
]);
assert.equal(negotiated.standard, VEXANIUM_PROVIDER_STANDARD);
assert.equal(negotiated.version, VEXANIUM_PROVIDER_VERSION);
assert.ok(negotiated.capabilities.includes(VEXANIUM_CAPABILITIES.EXACT_TRANSACTION_SIGNING));

const explicitAction = await client.action({
  account: "vex.token",
  name: "transfer",
  authorization: [{ actor: "windstack", permission: "active" }],
  data: {
    from: "windstack",
    to: "receiver",
    quantity: "1.0000 VEX",
    memo: "explicit authorization",
  },
});
assert.deepEqual(explicitAction.authorization, [{ actor: "windstack", permission: "active" }]);
assert.equal(client.getSession(), null);

const accounts = await client.connect({ chainId: VEXANIUM_MAINNET_CHAIN_ID });
assert.equal(accounts[0].permissionLevel, "windstack@active");
assert.equal(client.getSession().walletSessionId, "wallet-session-v1");
assert.equal(client.getProviderInfo().rdns, "com.test.wallet");

const connectCall = calls.find((call) => call.method === VEXANIUM_METHODS.REQUEST_ACCOUNTS);
assert.equal(connectCall.params.standard, VEXANIUM_PROVIDER_STANDARD);
assert.equal(connectCall.params.version, VEXANIUM_PROVIDER_VERSION);
assert.ok(connectCall.params.requiredCapabilities.includes(VEXANIUM_CAPABILITIES.ACCOUNTS));

await client.signTransaction({
  serializedTransaction: exactSerializedTransaction,
  transaction: exactTransaction,
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  account: "windstack",
  permission: "active",
});
const signCall = calls.find((call) => call.method === VEXANIUM_METHODS.SIGN_TRANSACTION);
assert.equal(signCall.params.sessionId, "wallet-session-v1");
assert.equal(signCall.params.serializedTransaction, exactSerializedTransaction);
assert.equal(signCall.params.serializedContextFreeData, "");
assert.deepEqual(signCall.params.transaction, exactTransaction);
await assert.rejects(
  () =>
    client.signTransaction({
      serializedTransaction: exactSerializedTransaction,
      chainId: "11".repeat(32),
      account: "windstack",
      permission: "active",
    }),
  (error) =>
    error instanceof VexaniumProviderError && error.code === VEXANIUM_ERROR_CODES.UNSUPPORTED_CHAIN,
);
await assert.rejects(
  () =>
    client.signTransaction({
      serializedTransaction: "000102ff",
      chainId: VEXANIUM_MAINNET_CHAIN_ID,
      account: "windstack",
      permission: "active",
    }),
  (error) =>
    error instanceof VexaniumProviderError && error.code === VEXANIUM_ERROR_CODES.INVALID_PARAMS,
);

const preparedAction = await client.action({
  account: "vex.token",
  name: "transfer",
  data: {
    from: "windstack",
    to: "receiver",
    quantity: "1.0000 VEX",
    memo: "single action",
  },
});
assert.equal(preparedAction.authorization[0].actor, "windstack");

const highLevelResult = await client.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: "windstack",
        to: "swapv2.wind",
        quantity: "2.0000 VEX",
        memo: "liquidity",
      },
    },
    {
      account: "token.wind",
      name: "transfer",
      data: {
        from: "windstack",
        to: "swapv2.wind",
        quantity: "3.00000000 WIND",
        memo: "liquidity",
      },
    },
  ],
  broadcast: false,
});
assert.equal(highLevelResult.transaction.actions.length, 2);
assert.equal(highLevelResult.transaction.actions[0].account, "vex.token");
assert.equal(highLevelResult.transaction.actions[1].account, "token.wind");
assert.equal(highLevelResult.transaction.actions[0].authorization[0].actor, "windstack");
assert.equal(rpcPushes, 0);
const highLevelSignCall = calls.filter((call) => call.method === VEXANIUM_METHODS.SIGN_TRANSACTION).at(-1);
assert.equal(highLevelSignCall.params.transaction.actions.length, 2);
assert.equal(highLevelSignCall.params.serializedContextFreeData, "");

await client.signSigningRequest({ request: portableRequest, broadcast: false });
const requestCall = calls.find((call) => call.method === VEXANIUM_METHODS.SIGNING_REQUEST);
assert.equal(requestCall.params.request, portableRequest);
assert.match(requestCall.params.request, /^vsr:\/\//);

const { provider: incompatibleProvider } = makeProvider({
  providerInfo: { version: "2.0.0" },
});
const incompatibleClient = await createVexaniumClient({
  provider: incompatibleProvider,
  autoSync: false,
});
await assert.rejects(
  () => incompatibleClient.negotiate(),
  (error) =>
    error instanceof VexaniumProviderError &&
    error.code === VEXANIUM_ERROR_CODES.INCOMPATIBLE_VERSION,
);

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
  (error) =>
    error instanceof VexaniumProviderError &&
    error.code === VEXANIUM_ERROR_CODES.UNSUPPORTED_CAPABILITY,
);

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
const rejectingClient = await createVexaniumClient({
  provider: rejectingProvider,
  autoSync: false,
});
await assert.rejects(
  () => rejectingClient.connect(),
  (error) =>
    error instanceof VexaniumProviderError && error.code === VEXANIUM_ERROR_CODES.USER_REJECTED,
);

console.log("VexaniumProvider contract tests: PASS");
