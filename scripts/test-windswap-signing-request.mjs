import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AbiSerializer, hexToBytes } from "../packages/abi/dist/index.js";
import {
  SigningRequest,
  pakoCompressionProvider,
  resolveSigningRequest,
} from "../packages/signing-request/dist/index.js";

const VEX_CHAIN_ID = "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f";
const SIGNER = { actor: "gvexa", permission: "active" };
const TAPOS = {
  expiration: "2030-01-01T00:05:00",
  refBlockNum: 12345,
  refBlockPrefix: 0x12345678,
  refBlockId: "00".repeat(32),
};

const swapAbi = JSON.parse(
  readFileSync(new URL("../test/fixtures/vexanium/swapv2.wind.abi.json", import.meta.url), "utf8"),
);

const tokenAbi = {
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
  actions: [{ name: "transfer", type: "transfer", ricardian_contract: "" }],
};

const abiProvider = {
  async getAbi(account) {
    if (account === "swapv2.wind") return swapAbi;
    if (account === "vex.token" || account === "token.wind") return tokenAbi;
    throw new Error(`Unexpected ABI account: ${account}`);
  },
};

const addLiquidity = await SigningRequest.create(
  {
    chainId: VEX_CHAIN_ID,
    broadcast: true,
    actions: [
      {
        account: "swapv2.wind",
        name: "opendepo",
        authorization: [SIGNER],
        data: { owner: SIGNER.actor, pair_id: "1" },
      },
      {
        account: "vex.token",
        name: "transfer",
        authorization: [SIGNER],
        data: {
          from: SIGNER.actor,
          to: "swapv2.wind",
          quantity: "1.0000 VEX",
          memo: "deposit:1",
        },
      },
      {
        account: "token.wind",
        name: "transfer",
        authorization: [SIGNER],
        data: {
          from: SIGNER.actor,
          to: "swapv2.wind",
          quantity: "1.00000000 WIND",
          memo: "deposit:1",
        },
      },
    ],
  },
  { abiProvider },
);

const addUri = addLiquidity.encode(true, true, "vsr", pakoCompressionProvider);
assert.match(addUri, /^vsr:\/\/[A-Za-z0-9_-]+$/u);
const addParsed = SigningRequest.from(addUri, { compressionProvider: pakoCompressionProvider });
assert.equal(addParsed.getData().request.type, "action[]");
assert.equal(addParsed.getData().request.value.length, 3);

const addResolved = await resolveSigningRequest(addParsed, {
  actor: SIGNER.actor,
  permission: SIGNER.permission,
  abiProvider,
  selectedChainId: VEX_CHAIN_ID,
  tapos: TAPOS,
});
assert.equal(addResolved.broadcast, true);
assert.deepEqual(
  addResolved.transaction.actions.map((action) => `${action.account}::${action.name}`),
  ["swapv2.wind::opendepo", "vex.token::transfer", "token.wind::transfer"],
);

const decodedAdd = await Promise.all(
  addResolved.transaction.actions.map(async (action) => {
    const abi = await abiProvider.getAbi(action.account);
    return new AbiSerializer(abi).decodeAction(action.name, hexToBytes(action.data));
  }),
);
assert.equal(decodedAdd[0].owner, SIGNER.actor);
assert.equal(String(decodedAdd[0].pair_id), "1");
assert.equal(decodedAdd[1].quantity, "1.0000 VEX");
assert.equal(decodedAdd[1].memo, "deposit:1");
assert.equal(decodedAdd[2].quantity, "1.00000000 WIND");
assert.equal(decodedAdd[2].memo, "deposit:1");

const removeLiquidity = await SigningRequest.create(
  {
    chainId: VEX_CHAIN_ID,
    broadcast: true,
    action: {
      account: "swapv2.wind",
      name: "withdraw",
      authorization: [SIGNER],
      data: { owner: SIGNER.actor, pair_id: "1", amount: "100" },
    },
  },
  { abiProvider },
);
const removeParsed = SigningRequest.from(
  removeLiquidity.encode(true, true, "vsr", pakoCompressionProvider),
  { compressionProvider: pakoCompressionProvider },
);
assert.equal(removeParsed.getData().request.type, "action");
const removeResolved = await resolveSigningRequest(removeParsed, {
  actor: SIGNER.actor,
  permission: SIGNER.permission,
  abiProvider,
  selectedChainId: VEX_CHAIN_ID,
  tapos: TAPOS,
});
assert.equal(removeResolved.transaction.actions.length, 1);
assert.equal(removeResolved.transaction.actions[0].account, "swapv2.wind");
assert.equal(removeResolved.transaction.actions[0].name, "withdraw");
const decodedRemove = new AbiSerializer(swapAbi).decodeAction(
  "withdraw",
  hexToBytes(removeResolved.transaction.actions[0].data),
);
assert.equal(decodedRemove.owner, SIGNER.actor);
assert.equal(String(decodedRemove.pair_id), "1");
assert.equal(String(decodedRemove.amount), "100");

const resolutionOrder = [];
const failingAbiProvider = {
  async getAbi(account) {
    resolutionOrder.push(account);
    if (account === "swapv2.wind") throw new Error("fixture ABI unavailable");
    return tokenAbi;
  },
};
await assert.rejects(
  () =>
    resolveSigningRequest(addParsed, {
      actor: SIGNER.actor,
      permission: SIGNER.permission,
      abiProvider: failingAbiProvider,
      selectedChainId: VEX_CHAIN_ID,
      tapos: TAPOS,
    }),
  /Unable to resolve swapv2\.wind::opendepo in signing-request actions: action 1\/3; fixture ABI unavailable/u,
);
assert.deepEqual(resolutionOrder, ["swapv2.wind"]);

console.log("WindSwap signing-request integration tests: PASS");
