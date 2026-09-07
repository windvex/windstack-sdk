import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bytesToHex } from "../packages/abi/dist/index.js";
import { PrivateKey, sha256Digest } from "../packages/crypto/dist/index.js";
import { SigningRequest } from "../packages/signing-request/dist/index.js";
import { deflateRaw, inflateRaw } from "pako";
import {
  ESR_SCHEME,
  VSR_SCHEME,
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_MAINNET_SCOPE,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  WISP_VEXANIUM_PROVIDER_INFO,
  createSigningRequest,
  createVexaniumClient,
  encodeSigningRequest,
  parseSigningRequest,
} from "../packages/vexanium/dist/index.js";
import { WispWalletPlugin } from "../packages/wallet-plugin-wisp/dist/index.js";

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const signature = privateKey.signDigest(sha256Digest(Uint8Array.of(0))).toString();
const calls = [];
const methods = Object.values(VEXANIUM_METHODS);

const provider = {
  providerInfo: WISP_VEXANIUM_PROVIDER_INFO,
  async request({ method, params }) {
    calls.push({ method, params });

    if (method === VEXANIUM_METHODS.GET_CAPABILITIES) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        capabilities: Object.values(VEXANIUM_CAPABILITIES),
        chains: [VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE],
        methods,
      };
    }

    if (method === VEXANIUM_METHODS.SIGN_TRANSACTION) {
      return { signatures: [signature] };
    }

    if (method === VEXANIUM_METHODS.SIGNING_REQUEST) {
      return { signatures: [signature], broadcast: false };
    }

    if (method === VEXANIUM_METHODS.GET_CHAIN) {
      return VEXANIUM_MAINNET_CHAIN_ID;
    }

    if (method === VEXANIUM_METHODS.GET_ACCOUNTS) {
      return {
        sessionId: "wallet-session-1",
        chainId: VEXANIUM_MAINNET_CHAIN_ID,
        accounts: [],
      };
    }

    throw new Error(`Unexpected method ${method}`);
  },
};

const portableTransaction = {
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
const nativeRequest = await SigningRequest.create({
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  transaction: portableTransaction,
});
const canonicalVsr = encodeSigningRequest(nativeRequest, {
  compress: false,
  slashes: true,
});
const esr = nativeRequest.encode(false, true, "esr");

assert.ok(canonicalVsr.startsWith(`${VSR_SCHEME}//`));
assert.ok(esr.startsWith(`${ESR_SCHEME}//`));
assert.equal(parseSigningRequest(canonicalVsr).encode(false, true, "esr"), esr);
assert.equal(parseSigningRequest(esr).encode(false, true, "esr"), esr);

const compressedSigningInput = {
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  transaction: portableTransaction,
  info: { note: "windstack-zlib-round-trip-".repeat(64) },
};
const uncompressedVsr = await createSigningRequest(compressedSigningInput, {
  compress: false,
});
const compressedVsr = await createSigningRequest(compressedSigningInput, {
  compress: true,
});
const compressedPayload = Buffer.from(
  compressedVsr.slice(compressedVsr.indexOf(":") + 1).replace(/^\/\//, ""),
  "base64url",
);

assert.notEqual(compressedPayload[0] & 0x80, 0);
assert.equal(
  parseSigningRequest(compressedVsr).encode(false, true, "esr"),
  parseSigningRequest(uncompressedVsr).encode(false, true, "esr"),
);

let customDeflateCalls = 0;
let customInflateCalls = 0;
const customZlib = {
  deflateRaw(data) {
    customDeflateCalls += 1;
    return deflateRaw(data);
  },
  inflateRaw(data) {
    customInflateCalls += 1;
    return inflateRaw(data);
  },
};
const customCompressedVsr = await createSigningRequest(
  {
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
    transaction: portableTransaction,
    info: { note: "custom-zlib-provider-".repeat(64) },
  },
  { compress: true, zlib: customZlib },
);
parseSigningRequest(customCompressedVsr, { zlib: customZlib });

assert.equal(customDeflateCalls, 1);
assert.equal(customInflateCalls, 1);

const vexTokenAbi = JSON.parse(
  await readFile(new URL("../test/fixtures/vexanium/vex.token.abi.json", import.meta.url), "utf8"),
);
const originalFetch = globalThis.fetch;
let abiFetchCalls = 0;
globalThis.fetch = async (input, init) => {
  abiFetchCalls += 1;
  assert.equal(String(input), "https://api.windcrypto.com/v1/chain/get_abi");
  assert.equal(init?.method, "POST");
  assert.deepEqual(JSON.parse(String(init?.body)), { account_name: "vex.token" });
  return new Response(
    JSON.stringify({
      account_name: "vex.token",
      abi: vexTokenAbi,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};
try {
  const structuredVsr = await createSigningRequest({
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
    action: {
      account: "vex.token",
      name: "transfer",
      authorization: [{ actor: "alice", permission: "active" }],
      data: {
        from: "alice",
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "WindStack",
      },
    },
  });
  const structuredRequest = parseSigningRequest(structuredVsr);
  assert.equal(structuredRequest.data.request.type, "action");
  assert.equal(structuredRequest.data.request.value.account, "vex.token");
  assert.equal(structuredRequest.data.request.value.name, "transfer");
  assert.ok(structuredRequest.data.request.value.data.length > 0);
  assert.equal(abiFetchCalls, 1);
} finally {
  globalThis.fetch = originalFetch;
}

const client = await createVexaniumClient({ provider, autoSync: false });
await client.signSigningRequest({ request: esr, broadcast: false });

const portableCalls = calls.filter((call) => call.method === VEXANIUM_METHODS.SIGNING_REQUEST);
assert.equal(portableCalls.length, 1);
assert.equal(portableCalls[0].params.request, esr);

calls.length = 0;
const pluginClient = {
  async connectOne() {
    return {
      chainId: VEXANIUM_MAINNET_CHAIN_ID,
      actor: "windstack",
      permission: "active",
      permissionLevel: "windstack@active",
      publicKey: privateKey.toPublicKey().toString(),
    };
  },
  async signTransaction(params) {
    calls.push({ method: VEXANIUM_METHODS.SIGN_TRANSACTION, params });
    return { signatures: [signature] };
  },
  getSession() {
    return null;
  },
  async disconnect() {},
};
const plugin = new WispWalletPlugin({ client: pluginClient });
const exactBytes = new Uint8Array([0, 1, 2, 255]);
const login = await plugin.login({
  chain: { id: VEXANIUM_MAINNET_CHAIN_ID, url: "https://api.windcrypto.com" },
});
const signed = await login.signer.sign({
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  serializedTransaction: exactBytes,
});
assert.equal(signed.length, 1);

const exactCalls = calls.filter((call) => call.method === VEXANIUM_METHODS.SIGN_TRANSACTION);
assert.equal(exactCalls.length, 1);
assert.equal(
  calls.some((call) => call.method === VEXANIUM_METHODS.SIGNING_REQUEST),
  false,
);
assert.equal(exactCalls[0].params.serializedTransaction, bytesToHex(exactBytes));
assert.equal(exactCalls[0].params.chainId, VEXANIUM_MAINNET_CHAIN_ID);
assert.equal(exactCalls[0].params.account, "windstack");
assert.equal(exactCalls[0].params.permission, "active");

console.log("Signing protocol tests: PASS");
