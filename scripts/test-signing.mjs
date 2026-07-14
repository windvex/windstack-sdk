import assert from "node:assert/strict";
import {
  Bytes,
  Checksum256,
  PermissionLevel,
  PrivateKey,
  Serializer,
  Transaction,
} from "@wharfkit/antelope";
import { SigningRequest } from "@wharfkit/signing-request";
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

const privateKey = PrivateKey.generate("K1");
const signature = String(privateKey.signDigest(Checksum256.hash(Bytes.from("00"))));
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

// Portable signing request: canonical VSR output, ESR interoperability input.
const portableTransaction = Transaction.from({
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
const portableBytes = Serializer.encode({ object: portableTransaction }).array;
const wharfRequest = SigningRequest.fromTransaction(
  VEXANIUM_MAINNET_CHAIN_ID,
  portableBytes,
);
const canonicalVsr = encodeSigningRequest(wharfRequest, {
  compress: false,
  slashes: true,
});
const esr = wharfRequest.encode(false, true, ESR_SCHEME);

assert.ok(canonicalVsr.startsWith(`${VSR_SCHEME}//`));
assert.ok(esr.startsWith(`${ESR_SCHEME}//`));
assert.equal(parseSigningRequest(canonicalVsr).encode(false, true), esr);
assert.equal(parseSigningRequest(esr).encode(false, true), esr);

// Compressed portable requests work without app-level zlib configuration.
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
  parseSigningRequest(compressedVsr).encode(false, true),
  parseSigningRequest(uncompressedVsr).encode(false, true),
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
const customCompressedVsr = await createSigningRequest({
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  transaction: portableTransaction,
  info: { note: "custom-zlib-provider-".repeat(64) },
}, { compress: true, zlib: customZlib });
parseSigningRequest(customCompressedVsr, { zlib: customZlib });

assert.equal(customDeflateCalls, 1);
assert.equal(customInflateCalls, 1);

const client = await createVexaniumClient({ provider, autoSync: false });
await client.signSigningRequest({ request: esr, broadcast: false });

const portableCalls = calls.filter(
  (call) => call.method === VEXANIUM_METHODS.SIGNING_REQUEST,
);
assert.equal(portableCalls.length, 1);
assert.equal(portableCalls[0].params.request, esr);

// Connected SessionKit plugin path: exact serialized transaction bytes only.
calls.length = 0;
const plugin = new WispWalletPlugin({ provider });
const exactBytes = new Uint8Array([0, 1, 2, 255]);
const resolved = {
  chainId: Checksum256.from(VEXANIUM_MAINNET_CHAIN_ID),
  serializedTransaction: exactBytes,
  signer: PermissionLevel.from("windstack@active"),
};

const signed = await plugin.sign(resolved, {});
assert.equal(signed.signatures.length, 1);

const exactCalls = calls.filter(
  (call) => call.method === VEXANIUM_METHODS.SIGN_TRANSACTION,
);
assert.equal(exactCalls.length, 1);
assert.equal(
  calls.some((call) => call.method === VEXANIUM_METHODS.SIGNING_REQUEST),
  false,
);
assert.equal(
  exactCalls[0].params.serializedTransaction,
  Bytes.from(exactBytes).hexString,
);
assert.equal(exactCalls[0].params.chainId, VEXANIUM_MAINNET_CHAIN_ID);
assert.equal(exactCalls[0].params.account, "windstack");
assert.equal(exactCalls[0].params.permission, "active");

console.log("Signing protocol tests: PASS");
