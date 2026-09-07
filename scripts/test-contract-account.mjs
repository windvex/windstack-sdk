/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AbiSerializer, hexToBytes } from "../packages/abi/dist/index.js";
import { AccountClient } from "../packages/account/dist/index.js";
import { AbiCache, Contract, ContractKit } from "../packages/contract/dist/index.js";
import { PrivateKey } from "../packages/crypto/dist/index.js";
import { RpcClient } from "../packages/rpc/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenAbi = JSON.parse(
  await readFile(path.join(root, "test/fixtures/vexanium/vex.token.abi.json"), "utf8"),
);
const systemAbi = JSON.parse(
  await readFile(path.join(root, "test/fixtures/vexanium/vexcore.abi.json"), "utf8"),
);
let abiRequests = 0;
const tableRequests = [];
const rpc = new RpcClient({
  endpoints: "https://unit.test",
  fetch: async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.endsWith("/get_abi")) {
      abiRequests += 1;
      await Promise.resolve();
      return Response.json({
        account_name: body.account_name,
        abi: body.account_name === "vex.token" ? tokenAbi : systemAbi,
      });
    }
    if (url.endsWith("/get_table_rows")) {
      tableRequests.push(body);
      return Response.json({ rows: [], more: false });
    }
    if (url.endsWith("/get_currency_balance")) return Response.json(["1.0000 VEX"]);
    return Response.json({ message: "not found" }, { status: 404 });
  },
});

const cache = new AbiCache(60_000);
const first = new Contract("vex.token", rpc, cache);
const second = new Contract("vex.token", rpc, cache);
await Promise.all([first.getAbi(), second.getAbi()]);
assert.equal(abiRequests, 1, "ABI requests must be shared across contract instances");
await first.refreshAbi();
assert.equal(abiRequests, 2);
first.deleteAbi();
await second.getAbi();
assert.equal(abiRequests, 3);

const transfer = await first.action(
  "transfer",
  { from: "alice", to: "bob", quantity: "1.0000 VEX", memo: "WindStack" },
  ["alice@active"],
);
assert.deepEqual(transfer.authorization, [{ actor: "alice", permission: "active" }]);
assert.deepEqual(new AbiSerializer(tokenAbi).decodeAction("transfer", hexToBytes(transfer.data)), {
  from: "alice",
  to: "bob",
  quantity: "1.0000 VEX",
  memo: "WindStack",
});
await first.tableRows("accounts", "alice", { limit: 10 });
await first.tableRows("stat", "VEX", { lower_bound: "VEX" });
await first.tableRows("accounts", 42n);
assert.deepEqual(
  tableRequests.map((item) => item.scope),
  ["alice", "VEX", "42"],
);
assert.equal(new ContractKit(rpc, { abiCache: cache }).contract("vex.token").abiCache, cache);

const account = new AccountClient("alice", rpc, cache, {
  tokenContract: "vex.token",
  systemContract: "vexcore",
});
assert.deepEqual(await account.balance(), ["1.0000 VEX"]);
const publicKey = PrivateKey.fromBytes(
  "K1",
  Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0)),
)
  .toPublicKey()
  .toString();
const authority = {
  threshold: 1,
  keys: [{ key: publicKey, weight: 1 }],
  accounts: [],
  waits: [],
};
const actions = await Promise.all([
  account.transfer("bob", "1.0000 VEX"),
  account.delegate("bob", "1.0000 VEX", "2.0000 VEX"),
  account.stake("bob", "1.0000 VEX", "2.0000 VEX"),
  account.undelegate("bob", "1.0000 VEX", "2.0000 VEX"),
  account.unstake("bob", "1.0000 VEX", "2.0000 VEX"),
  account.buyRam("bob", "1.0000 VEX"),
  account.buyRamSelf("1.0000 VEX"),
  account.buyRamBytes("bob", 4096),
  account.sellRam("9223372036854775807"),
  account.refund(),
  account.voteProducers(["alice", "bob"]),
  account.voteProxy("bob"),
  account.clearVote(),
  account.registerProxy(),
  account.unregisterProxy(),
  account.registerProducer(publicKey, "https://producer.example", 65535),
  account.unregisterProducer(),
  account.claimRewards(),
  account.createAccount("bob", authority, authority),
  account.updatePermission("active", "owner", authority, "owner"),
  account.deletePermission("custom", "owner"),
  account.linkPermission("vex.token", "transfer", "active", "owner"),
  account.unlinkPermission("vex.token", "transfer", "owner"),
]);
const systemSerializer = new AbiSerializer(systemAbi);
for (const action of actions) {
  const actionAbi = action.account === "vex.token" ? new AbiSerializer(tokenAbi) : systemSerializer;
  actionAbi.decodeAction(action.name, hexToBytes(action.data));
}
assert.equal(actions[1].name, "delegatebw");
assert.equal(actions[8].name, "sellram");
assert.equal(actions[14].name, "regproxy");

assert.throws(() => account.voteProducers(["alice", "alice"]), /duplicate/);
assert.throws(
  () => account.voteProducers(Array.from({ length: 31 }, (_, index) => `a${index}`)),
  /between 1 and 30/,
);
assert.throws(() => account.buyRamBytes("bob", 0), /RAM bytes/);
assert.throws(() => account.sellRam("9223372036854775808"), /signed 64-bit/);
assert.throws(() => account.registerProducer("invalid", "", 0), /public-key format/);
assert.throws(
  () => account.createAccount("bob", { ...authority, threshold: 2 }, authority),
  /threshold exceeds/,
);

console.log("Contract and account compatibility tests passed");
