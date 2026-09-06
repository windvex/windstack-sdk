import assert from "node:assert/strict";
import { AbiSerializer, bigIntToName, nameToBigInt } from "../packages/abi/dist/index.js";
import { AntelopeClient, PrivateKeySigner } from "../packages/antelope/dist/index.js";
import { PrivateKey, sha256Digest } from "../packages/crypto/dist/index.js";

const privateKey = PrivateKey.fromBytes("K1", Uint8Array.from({ length: 32 }, (_, index) => index === 31 ? 1 : 0));
const digest = sha256Digest(new TextEncoder().encode("windstack-antelope-v1"));
const publicKey = privateKey.toPublicKey();
const signature = privateKey.signDigest(digest);
assert.equal(signature.verifyDigest(digest, publicKey), true);
assert.equal(signature.recoverDigest(digest).toString(), publicKey.toString());
assert.equal(PrivateKey.fromString(privateKey.toString()).toString(), privateKey.toString());
assert.equal(bigIntToName(nameToBigInt("vex.token")), "vex.token");

const abi = {
  version: "eosio::abi/1.2",
  structs: [{ name: "transfer", base: "", fields: [
    { name: "from", type: "name" }, { name: "to", type: "name" }, { name: "quantity", type: "asset" }, { name: "memo", type: "string" }
  ] }],
  actions: [{ name: "transfer", type: "transfer" }]
};
const serializer = new AbiSerializer(abi);
const encoded = serializer.encodeAction("transfer", { from: "alice", to: "bob", quantity: "1.0000 VEX", memo: "WindStack" });
assert.deepEqual(serializer.decodeAction("transfer", encoded), { from: "alice", to: "bob", quantity: "1.0000 VEX", memo: "WindStack" });

const chainId = "00".repeat(32);
const blockId = "00".repeat(32);
const fetchMock = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body ?? "{}"));
  if (url.endsWith("/get_info")) return Response.json({ chain_id: chainId, head_block_num: 100, last_irreversible_block_num: 99, head_block_id: blockId, head_block_time: "2026-09-07T00:00:00.000" });
  if (url.endsWith("/get_block")) return Response.json({ id: blockId, block_num: Number(body.block_num_or_id), ref_block_prefix: 123456789, timestamp: "2026-09-07T00:00:00.000" });
  if (url.endsWith("/get_required_keys")) return Response.json({ required_keys: [publicKey.toString()] });
  if (url.endsWith("/push_transaction")) return Response.json({ transaction_id: "ab".repeat(32), processed: {} });
  return new Response(JSON.stringify({ message: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
};
const client = new AntelopeClient({ endpoints: "https://unit.test", fetch: fetchMock });
const result = await client.transact({ actions: [{ account: "eosio", name: "noop", authorization: [{ actor: "alice", permission: "active" }], data: "" }], signer: new PrivateKeySigner([privateKey]) });
assert.equal(result.signatures.length, 1);
assert.equal(result.response.transaction_id.length, 64);
console.log("native Antelope SDK tests passed");
