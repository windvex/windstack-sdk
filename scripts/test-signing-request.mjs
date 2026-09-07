import assert from "node:assert/strict";
import { AbiSerializer, bytesToHex } from "../packages/abi/dist/index.js";
import { PrivateKey } from "../packages/crypto/dist/index.js";
import {
  SIGNING_REQUEST_ABI,
  SIGNING_REQUEST_PLACEHOLDER_ACTOR,
  SIGNING_REQUEST_PLACEHOLDER_PERMISSION,
  SIGNING_REQUEST_PROTOCOL_VERSION,
  SigningRequest,
  createSigningRequestCallback,
  pakoCompressionProvider,
  resolveSigningRequest,
  verifyResolvedSigningRequestSignature,
} from "../packages/signing-request/dist/index.js";

const VEX_CHAIN_ID = "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f";
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
const abiProvider = {
  async getAbi(account) {
    assert.equal(account, "vex.token");
    return transferAbi;
  },
};

// Public Revision 2 interoperability vector published with the Signing Request specification.
const publicCompressedVector =
  "esr:gmNcs7jsE9uOP6rL3rrcvpMWUmN27LCdleD836_eTzFz-vCSjZGRYcm-EsZXBqEMILDA6C5QBAKYoLQQTAAIFNycd-1iZGAUyigpKSi20tdPyc9NzMzTS87PZQAA";
const legacy = SigningRequest.from(publicCompressedVector);
assert.equal(legacy.version, 2);
assert.equal(legacy.data.request.type, "action[]");
assert.equal(legacy.data.request.value[0].account, "eosio.forum");
assert.equal(legacy.data.request.value[0].name, "vote");
assert.equal(legacy.isBroadcast, true);
assert.equal(legacy.data.callback, "https://domain.com");

const request = await SigningRequest.create(
  {
    chainId: VEX_CHAIN_ID,
    action: {
      account: "vex.token",
      name: "transfer",
      authorization: [
        {
          actor: SIGNING_REQUEST_PLACEHOLDER_ACTOR,
          permission: SIGNING_REQUEST_PLACEHOLDER_PERMISSION,
        },
      ],
      data: {
        from: SIGNING_REQUEST_PLACEHOLDER_ACTOR,
        to: "receiver",
        quantity: "1.0000 VEX",
        memo: "WindStack",
      },
    },
    broadcast: true,
    callback: "https://app.example/complete?tx={{tx}}&sig={{sig}}",
    info: { note: "WindStack VSR" },
  },
  { abiProvider },
);
assert.equal(request.version, SIGNING_REQUEST_PROTOCOL_VERSION);
assert.equal(request.getInfoText("note"), "WindStack VSR");

const vsr = request.encode(true, true, "vsr");
assert.match(vsr, /^vsr:\/\/[A-Za-z0-9_-]+$/);
const parsed = SigningRequest.from(vsr);
assert.equal(parsed.data.chainId.type, "chain_id");
assert.equal(parsed.data.chainId.value, VEX_CHAIN_ID);
assert.equal(parsed.isBroadcast, true);
assert.equal(parsed.data.request.type, "action");

const resolved = await resolveSigningRequest(parsed, {
  actor: "windstack",
  permission: "active",
  abiProvider,
  tapos: {
    expiration: "2026-09-07T04:00:00",
    refBlockNum: 65539,
    refBlockPrefix: 123456789,
    refBlockId: "11".repeat(32),
  },
});
assert.equal(resolved.chainId, VEX_CHAIN_ID);
assert.equal(resolved.transaction.ref_block_num, 3);
assert.equal(resolved.transaction.ref_block_prefix, 123456789);
assert.equal(resolved.transaction.actions[0].authorization[0].actor, "windstack");
assert.equal(resolved.transaction.actions[0].authorization[0].permission, "active");
const resolvedTransfer = new AbiSerializer(transferAbi).decodeAction(
  "transfer",
  Uint8Array.from(
    resolved.transaction.actions[0].data.match(/.{2}/g).map((value) => Number.parseInt(value, 16)),
  ),
);
assert.equal(resolvedTransfer.from, "windstack");
assert.equal(resolvedTransfer.to, "receiver");
assert.equal(resolvedTransfer.quantity, "1.0000 VEX");

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const signedRequest = request.sign("windstack", privateKey);
assert.equal(signedRequest.verifyRequestSignature(privateKey.toPublicKey()), true);
const signedRoundTrip = SigningRequest.from(signedRequest.encode(true, false, "vsr"));
assert.equal(signedRoundTrip.requestSignature.signer, "windstack");
assert.equal(signedRoundTrip.verifyRequestSignature(privateKey.toPublicKey()), true);

const txSignature = privateKey.signDigest(resolved.digest);
assert.equal(
  verifyResolvedSigningRequestSignature(resolved, txSignature, privateKey.toPublicKey()),
  true,
);
const callback = createSigningRequestCallback(resolved, {
  transactionId: "ab".repeat(32),
  blockNum: 123,
  signatures: [txSignature],
});
assert.equal(callback.background, false);
assert.equal(callback.payload.bn, "123");
assert.equal(callback.payload.cid, VEX_CHAIN_ID);
assert.ok(callback.url.includes("tx=abab"));

const identity = await SigningRequest.create({
  chainId: VEX_CHAIN_ID,
  identity: { scope: "windstack" },
  callback: "https://app.example/login?actor={{sa}}",
});
assert.equal(identity.isIdentity, true);
assert.throws(
  () => SigningRequest.from(identity.encode(false, false, "vsr").replace(/^vsr:/, "http:")),
  /vsr: or esr:/,
);
const identityResolved = await resolveSigningRequest(identity, {
  actor: "windstack",
  permission: "active",
  abiProvider,
  tapos: {
    expiration: "2026-09-07T04:00:00",
    refBlockNum: 0,
    refBlockPrefix: 0,
  },
});
assert.equal(identityResolved.transaction.ref_block_num, 0);
assert.equal(identityResolved.transaction.ref_block_prefix, 0);
assert.equal(identityResolved.transaction.actions[0].account, "");
assert.equal(identityResolved.transaction.actions[0].name, "identity");
assert.deepEqual(identityResolved.transaction.actions[0].authorization, [
  { actor: "windstack", permission: "active" },
]);
const identityData = new AbiSerializer(SIGNING_REQUEST_ABI).decode(
  "identity",
  Uint8Array.from(
    identityResolved.transaction.actions[0].data
      .match(/.{2}/g)
      .map((value) => Number.parseInt(value, 16)),
  ),
);
assert.equal(identityData.scope, "windstack");
assert.deepEqual(identityData.permission, { actor: "windstack", permission: "active" });

const multiChain = await SigningRequest.create({
  chainAlias: 0,
  identity: { scope: "windstack" },
  callback: "https://app.example/login",
});
const selected = await resolveSigningRequest(multiChain, {
  actor: "windstack",
  permission: "active",
  selectedChainId: VEX_CHAIN_ID,
  abiProvider,
  tapos: { expiration: "2026-09-07T04:00:00", refBlockNum: 0, refBlockPrefix: 0 },
});
assert.equal(selected.chainId, VEX_CHAIN_ID);

const compressedBytes = pakoCompressionProvider.deflate(new Uint8Array(16_384));
assert.throws(() => pakoCompressionProvider.inflate(compressedBytes, 1024), /size limit/);
assert.throws(() => SigningRequest.from("vsr:not+base64"), /valid vsr: or esr:/);
assert.throws(
  () => SigningRequest.from(`vsr:${Buffer.from(Uint8Array.of(4, 0)).toString("base64url")}`),
  /Unsupported signing-request protocol version/,
);

assert.equal(bytesToHex(resolved.digest).length, 64);
console.log("Native signing-request protocol tests: PASS");
