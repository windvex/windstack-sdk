/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AntelopeClient,
  PrivateKeySigner,
  deserializeTransaction,
  serializeContextFreeData,
  serializeTransaction,
  transactionDigest,
} from "../packages/antelope/dist/index.js";
import {
  concatBytes,
  hexToBytes,
  PrivateKey,
  sha256Digest,
} from "../packages/crypto/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenAbi = JSON.parse(
  await readFile(path.join(root, "test/fixtures/vexanium/vex.token.abi.json"), "utf8"),
);
const chainId = "11".repeat(32);
const blockId = `00000063${"00".repeat(4)}15cd5b07${"00".repeat(20)}`;
const privateKey = PrivateKey.fromBytes(
  "K1",
  Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0)),
);
const otherKey = PrivateKey.fromBytes(
  "K1",
  Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 2 : 0)),
);
const publicKey = privateKey.toPublicKey().toLegacyString();
let pushes = 0;
let signerCalls = 0;
let lastSignRequest;

const fetch = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}"));
  if (url.endsWith("/get_info")) {
    return Response.json({
      chain_id: chainId,
      head_block_num: 100,
      last_irreversible_block_num: 99,
      head_block_id: blockId,
      head_block_time: "2026-09-07T00:00:00.000",
    });
  }
  if (url.endsWith("/get_block")) {
    assert.equal(body.block_num_or_id, 99);
    return Response.json({ id: blockId, block_num: 99, timestamp: "2026-09-06T23:59:00.000" });
  }
  if (url.endsWith("/get_abi")) return Response.json({ account_name: "vex.token", abi: tokenAbi });
  if (url.endsWith("/get_required_keys")) {
    assert.equal(body.transaction.ref_block_num, 99);
    return Response.json({ required_keys: [publicKey] });
  }
  if (url.endsWith("/push_transaction")) {
    pushes += 1;
    return Response.json({ transaction_id: "ab".repeat(32) });
  }
  return Response.json({ message: "not found" }, { status: 404 });
};

const client = new AntelopeClient({
  endpoints: "https://unit.test",
  fetch,
  chainId,
  contracts: { system: "vexcore", token: "vex.token" },
});
const action = await client.account("alice").transfer("bob", "1.0000 VEX", "WindStack");
const signer = {
  async getAvailableKeys() {
    return [publicKey];
  },
  async sign(request) {
    signerCalls += 1;
    lastSignRequest = request;
    return [privateKey.signDigest(request.digest)];
  },
};
const contextFreeData = [Uint8Array.of(1, 2, 3), new Uint8Array(0)];
const result = await client.transact({
  actions: [action],
  signer,
  contextFreeData,
  transactionExtensions: [[7, "aabb"]],
  broadcast: false,
});
assert.equal(pushes, 0);
assert.equal(signerCalls, 1);
assert.equal(result.transaction.expiration, "2026-09-07T00:02:00");
assert.equal(result.transaction.ref_block_num, 99);
assert.equal(result.transaction.ref_block_prefix, 123456789);
assert.deepEqual(result.serializedContextFreeData, serializeContextFreeData(contextFreeData));
assert.deepEqual(result.serializedTransaction, serializeTransaction(result.transaction));
assert.deepEqual(deserializeTransaction(result.serializedTransaction), result.transaction);
assert.deepEqual(deserializeTransaction(Buffer.from(result.serializedTransaction).toString("hex")), result.transaction);
assert.deepEqual(lastSignRequest.transaction, result.transaction);

const multiTransaction = {
  ...result.transaction,
  actions: [action, { ...action, data: action.data }],
};
const multiSerialized = serializeTransaction(multiTransaction);
const multiDecoded = deserializeTransaction(multiSerialized);
assert.equal(multiDecoded.actions.length, 2);
assert.deepEqual(multiDecoded, multiTransaction);
assert.deepEqual(serializeTransaction(multiDecoded), multiSerialized);

const expectedDigest = sha256Digest(
  concatBytes(
    hexToBytes(chainId),
    result.serializedTransaction,
    sha256Digest(result.serializedContextFreeData),
  ),
);
assert.deepEqual(lastSignRequest.digest, expectedDigest);
assert.deepEqual(
  transactionDigest(
    chainId,
    result.serializedTransaction,
    sha256Digest(result.serializedContextFreeData),
  ),
  expectedDigest,
);

const broadcast = await client.transact({
  actions: [action],
  signer: new PrivateKeySigner([privateKey]),
});
assert.equal(broadcast.response.transaction_id, "ab".repeat(32));
assert.equal(pushes, 1);
assert.throws(() => new PrivateKeySigner([privateKey, privateKey]), /duplicate keys/);

const mismatch = new AntelopeClient({
  endpoints: "https://unit.test",
  fetch,
  chainId: "22".repeat(32),
});
await assert.rejects(() => mismatch.transact({ actions: [action], signer }), /RPC chain mismatch/);
assert.equal(signerCalls, 1, "chain mismatch must stop before signing");

const badSigner = {
  async getAvailableKeys() {
    return [publicKey];
  },
  async sign(request) {
    return [otherKey.signDigest(request.digest)];
  },
};
await assert.rejects(
  () => client.transact({ actions: [action], signer: badSigner, broadcast: false }),
  /does not match the required keys/,
);
await assert.rejects(
  () =>
    client.transact({
      actions: [action],
      signer: { getAvailableKeys: async () => [publicKey], sign: async () => [] },
      broadcast: false,
    }),
  /0 signatures for 1 required keys/,
);
await assert.rejects(
  () =>
    client.transact({
      actions: [action],
      signer: { getAvailableKeys: async () => [publicKey], sign: async () => [{}] },
      broadcast: false,
    }),
  /invalid signature value/,
);
assert.throws(() => serializeContextFreeData(["not bytes"]), /Uint8Array/);
assert.throws(() => transactionDigest("bad", new Uint8Array()), /chain id/);
assert.throws(() => deserializeTransaction(new Uint8Array()), /cannot be empty/);
assert.throws(() => deserializeTransaction(Uint8Array.of(0)), /Unexpected end/);

console.log("Antelope transaction and signer tests passed");
