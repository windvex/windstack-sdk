import assert from "node:assert/strict";
import { AbiSerializer, bigIntToName, nameToBigInt } from "../packages/abi/dist/index.js";
import { AntelopeClient, PrivateKeySigner } from "../packages/antelope/dist/index.js";
import { PrivateKey, PublicKey, sha256Digest } from "../packages/crypto/dist/index.js";
import { RpcClient } from "../packages/rpc/dist/index.js";
import { MemorySessionStorage, SessionManager } from "../packages/session/dist/index.js";

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const digest = sha256Digest(new TextEncoder().encode("windstack-antelope-v1"));
const publicKey = privateKey.toPublicKey();
const signature = privateKey.signDigest(digest);

assert.equal(signature.verifyDigest(digest, publicKey), true);
assert.equal(signature.recoverDigest(digest).toString(), publicKey.toString());
assert.equal(signature.isCanonical(), true);
assert.equal(PrivateKey.fromString(privateKey.toString()).toString(), privateKey.toString());
assert.equal(PrivateKey.fromString(privateKey.toWif()).toString(), privateKey.toString());
assert.equal(PublicKey.fromString(publicKey.toLegacyString()).toString(), publicKey.toString());
assert.throws(() => PrivateKey.fromBytes("K1", new Uint8Array(32)), /Invalid K1 private key/);

const r1Key = PrivateKey.fromBytes("R1", scalarOne);
const r1Signature = r1Key.signDigest(digest);
assert.equal(r1Signature.verifyDigest(digest, r1Key.toPublicKey()), true);
assert.equal(r1Signature.recoverDigest(digest).toString(), r1Key.toPublicKey().toString());
assert.equal(bigIntToName(nameToBigInt("vex.token")), "vex.token");
assert.throws(() => nameToBigInt("invalid-name"), /Invalid Antelope name character/);

const abi = {
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
    {
      name: "types",
      base: "",
      fields: [
        { name: "signed", type: "int128" },
        { name: "unsigned", type: "uint128" },
        { name: "hash160", type: "checksum160" },
        { name: "hash512", type: "checksum512" },
        { name: "when", type: "time_point" },
        { name: "slot", type: "block_timestamp_type" },
        { name: "balance", type: "extended_asset" },
        { name: "maybe", type: "string?" },
      ],
    },
  ],
  actions: [
    { name: "transfer", type: "transfer" },
    { name: "types", type: "types" },
  ],
  tables: [{ name: "accounts", index_type: "i64", type: "types" }],
};
const serializer = new AbiSerializer(abi);
const encodedTransfer = serializer.encodeAction("transfer", {
  from: "alice",
  to: "bob",
  quantity: "1.0000 VEX",
  memo: "WindStack",
});
assert.deepEqual(serializer.decodeAction("transfer", encodedTransfer), {
  from: "alice",
  to: "bob",
  quantity: "1.0000 VEX",
  memo: "WindStack",
});
assert.equal(serializer.getTableType("accounts"), "types");

const typesValue = {
  signed: "-170141183460469231731687303715884105728",
  unsigned: "340282366920938463463374607431768211455",
  hash160: "11".repeat(20),
  hash512: "22".repeat(64),
  when: "2026-09-07T00:00:00.123456Z",
  slot: "2026-09-07T00:00:00.500Z",
  balance: { quantity: "1.0000 VEX", contract: "vex.token" },
  maybe: null,
};
const decodedTypes = serializer.decodeAction("types", serializer.encodeAction("types", typesValue));
assert.equal(decodedTypes.signed, BigInt(typesValue.signed));
assert.equal(decodedTypes.unsigned, BigInt(typesValue.unsigned));
assert.equal(decodedTypes.hash160, typesValue.hash160);
assert.equal(decodedTypes.hash512, typesValue.hash512);
assert.equal(decodedTypes.when, typesValue.when);
assert.deepEqual(decodedTypes.balance, { quantity: "1.0000 VEX", contract: "vex.token" });
assert.equal(decodedTypes.maybe, null);
assert.throws(() => serializer.encode("uint8", 256), /uint8/);
assert.throws(() => serializer.encode("bool", 1), /bool expects/);

const chainId = "00".repeat(32);
const blockId = "00".repeat(32);
let requiredKeysRequest;
let pushedTransaction;
const fetchMock = async (input, init) => {
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
    return Response.json({
      id: blockId,
      block_num: Number(body.block_num_or_id),
      ref_block_prefix: 123456789,
      timestamp: "2026-09-06T23:50:00.000",
    });
  }
  if (url.endsWith("/get_abi")) return Response.json({ account_name: "vex.token", abi });
  if (url.endsWith("/get_required_keys")) {
    requiredKeysRequest = body;
    return Response.json({ required_keys: [publicKey.toLegacyString()] });
  }
  if (url.endsWith("/push_transaction")) {
    pushedTransaction = body;
    return Response.json({ transaction_id: "ab".repeat(32), processed: {} });
  }
  return new Response(JSON.stringify({ message: "not found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
};

const client = new AntelopeClient({
  endpoints: "https://unit.test",
  fetch: fetchMock,
  chainId,
  contracts: { system: "vexcore", token: "vex.token" },
});
const account = client.account("alice");
const transfer = await account.transfer("bob", "1.0000 VEX", "WindStack");
assert.equal(transfer.account, "vex.token");
const result = await client.transact({
  actions: [transfer],
  signer: new PrivateKeySigner([privateKey]),
});
assert.equal(result.transaction.expiration, "2026-09-07T00:02:00.000Z".replace(".000Z", ""));
assert.equal(result.signatures.length, 1);
assert.equal(result.response.transaction_id.length, 64);
assert.match(requiredKeysRequest.available_keys[0], /^EOS/);
assert.equal(pushedTransaction.compression, 0);
assert.ok(pushedTransaction.packed_trx.length > 0);

const mismatchedClient = new AntelopeClient({
  endpoints: "https://unit.test",
  fetch: fetchMock,
  chainId: "11".repeat(32),
});
await assert.rejects(
  () =>
    mismatchedClient.transact({
      actions: [transfer],
      signer: new PrivateKeySigner([privateKey]),
    }),
  /RPC chain mismatch/,
);

let rpcAttempts = 0;
const rpc = new RpcClient({
  endpoints: ["https://a.test", "https://b.test"],
  fetch: async () => {
    rpcAttempts += 1;
    return new Response(JSON.stringify({ message: "invalid request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  },
});
await assert.rejects(() => rpc.getInfo(), /invalid request/);
assert.equal(rpcAttempts, 1);

const storage = new MemorySessionStorage();
await storage.set("windstack:session", "{broken-json");
const walletPlugin = {
  id: "test-wallet",
  async login() {
    return {
      identity: { actor: "alice", permission: "active" },
      signer: new PrivateKeySigner([privateKey]),
    };
  },
};
const kit = new SessionManager({
  chains: [
    {
      id: chainId,
      url: "https://unit.test",
      contracts: { system: "vexcore", token: "vex.token" },
    },
  ],
  walletPlugins: [walletPlugin],
  storage,
});
assert.equal(await kit.getStoredSession(), null);

console.log("WindStack Antelope validation passed");
