/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BASIS_POINTS,
  convertPrecision,
  formatDecimal,
  parseDecimal,
  readResponseText,
  quoteConstantProduct,
  quoteConstantProductMinimum,
  quoteConstantProductRoute,
  quoteProportionalDeposit,
  quoteProportionalWithdrawal,
} from "../packages/core/dist/index.js";
import {
  ANTELOPE_ASSET_MAX_AMOUNT,
  bigIntToName,
  convertAssetPrecision,
  formatAsset,
  nameToBigInt,
  parseAsset,
  parseExtendedAsset,
  tokenIdentityFromAsset,
} from "../packages/abi/dist/index.js";
import {
  PrivateKey,
  PublicKey,
  formatPublicKey,
  normalizePublicKey,
  publicKeysEqual,
  sha256Digest,
} from "../packages/crypto/dist/index.js";
import {
  AntelopeClient,
  KeosdHttpTransport,
  KeosdSigner,
  RpcChainMismatchError,
  RpcClient,
  serializeTransaction,
  taposFromBlock,
  transactionId,
} from "../packages/antelope/dist/index.js";
import { KeosdUnixTransport } from "../packages/antelope/dist/node.js";
import {
  AntelopeTransactionHistory,
  HyperionClient,
  SpringFinalityClient,
} from "../packages/rpc/dist/index.js";
import {
  EvmRpcClient,
  evmChainIdsEqual,
  formatEvmAddress,
  normalizeEvmAddress,
  normalizeEvmChainId,
} from "../packages/evm/dist/index.js";
import {
  VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX,
  classifyVexEvmAddress,
  decodeVexEvmBridgeTransferCalldata,
  decodeVexEvmContractAction,
  hasReservedNativeBridgePrefix,
  isReservedNativeBridgeAddress,
  nativeAccountToReservedEvmAddress,
  reservedEvmAddressToNativeAccount,
} from "../packages/vexanium/dist/index.js";
import {
  VEXANIUM_LEGACY_PUBLIC_KEY_PREFIX,
  createVexaniumPrivateKeySigner,
} from "../packages/vexanium/dist/antelope.js";

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const modernKey = "PUB_K1_5p78kHbL33Rn3JWkTWRE2B9uz6gy4r1KbfAKLNQGE3ovLY8E9M";
assert.equal(privateKey.toPublicKey().toString(), modernKey, "known secp256k1 scalar-one vector");
const eosKey = privateKey.toPublicKey().toLegacyString("EOS");
const vexKey = privateKey.toPublicKey().toLegacyString("VEX");
assert.match(vexKey, /^VEX/);
assert.equal(normalizePublicKey(vexKey), modernKey);
assert.equal(normalizePublicKey(eosKey), modernKey);
assert.equal(publicKeysEqual(vexKey, eosKey), true);
assert.equal(PublicKey.fromString(vexKey).toLegacyString("VEX"), vexKey);
assert.equal(
  formatPublicKey(vexKey.replace(/^VEX/, "CHAIN"), {
    legacyPrefixes: ["CH", "CHAIN"],
    format: "modern",
  }),
  modernKey,
);
assert.throws(() => PublicKey.fromString(`${vexKey.slice(0, -1)}1`), /checksum|public key/i);
assert.equal(VEXANIUM_LEGACY_PUBLIC_KEY_PREFIX, "VEX");
assert.deepEqual(await createVexaniumPrivateKeySigner([privateKey]).getAvailableKeys(), [vexKey]);

assert.equal(parseDecimal("18446744073709551615.999", 3), 18446744073709551615999n);
assert.equal(parseDecimal("-0.005", 2, { signed: true, rounding: "half-up" }), -1n);
assert.throws(() => parseDecimal("-0.00", 2, { signed: true }), /negative zero/);
assert.equal(parseDecimal("-0.001", 2, { signed: true, rounding: "down" }), 0n);
assert.throws(() => parseDecimal("1.001", 2), /exceeds/);
assert.equal(formatDecimal(-1234500n, 4, { trimTrailingZeros: true }), "-123.45");
assert.equal(convertPrecision(123n, 2, 6), 1_230_000n);
assert.throws(() => convertPrecision(123n, 2, 1), /lose precision/);
assert.equal(BASIS_POINTS, 10_000n);
assert.throws(() => parseDecimal("1", 2, { signed: true, rounding: "invalid" }), /./);
assert.throws(() => formatDecimal(true, 0), /integer-compatible/);
await assert.rejects(
  () => readResponseText(new Response("x".repeat(1025)), 1024),
  /1024-byte limit/,
);
await assert.rejects(() => readResponseText(new Response(Uint8Array.of(0xff)), 1024), /encoded/);

const maxAsset = parseAsset("4611686018427387903 MAX");
const minAsset = parseAsset("-4611686018427387903 MIN");
assert.equal(maxAsset.amount, ANTELOPE_ASSET_MAX_AMOUNT);
assert.equal(minAsset.amount, -ANTELOPE_ASSET_MAX_AMOUNT);
assert.equal(formatAsset(minAsset.amount, 0, "MIN"), minAsset.value);
assert.throws(() => parseAsset("4611686018427387904 MAX"), /asset range/);
assert.throws(() => parseAsset("-4611686018427387904 MIN"), /asset range/);
assert.throws(() => parseAsset("-0.0000 VEX"), /negative zero/);
assert.throws(() => parseAsset("9223372036854775808 MAX"), /asset range/);
assert.equal(convertAssetPrecision(12_300n, 3, 1), 123n);
assert.throws(() => convertAssetPrecision(12_345n, 3, 1), /lose units/);
assert.throws(() => convertAssetPrecision(true, 0, 0), /integer-compatible/);
const extended = parseExtendedAsset("1.2345 VEX@vex.token");
assert.deepEqual(tokenIdentityFromAsset(extended), {
  contract: "vex.token",
  symbol: "VEX",
  precision: 4,
  key: "vex.token:VEX:4",
});
assert.throws(() => parseExtendedAsset("1.0000 VEX"), /extended_asset/);
assert.throws(() => parseExtendedAsset("1.0000 VEX@vex.token."), /canonical/);

for (const account of ["", "a", "alice", "wind.bridge", "zzzzzzzzzzzzj"]) {
  assert.equal(bigIntToName(nameToBigInt(account)), account);
}
assert.equal(nameToBigInt("zzzzzzzzzzzzj"), 0xffffffffffffffffn);
assert.throws(() => nameToBigInt("zzzzzzzzzzzzk"), /13th Antelope name character/);
assert.throws(() => bigIntToName(-1n), /uint64/);
assert.throws(() => bigIntToName(0x10000000000000000n), /uint64/);

const quote = quoteConstantProduct({
  reserveIn: 1_000_000n,
  reserveOut: 2_000_000n,
  amountIn: 10_000n,
  feeBps: 30,
});
assert.equal(quote.amountInAfterFee, 9_970n);
assert.equal(quote.amountOut, 19_743n);
assert.equal(quoteConstantProductMinimum(quote, 100), 19_545n);
const route = quoteConstantProductRoute({
  amountIn: 10_000n,
  slippageBps: 50,
  hops: [
    {
      poolId: "a",
      tokenIn: "A",
      tokenOut: "B",
      reserveIn: 1_000_000n,
      reserveOut: 2_000_000n,
      feeBps: 30,
    },
    {
      poolId: "b",
      tokenIn: "B",
      tokenOut: "C",
      reserveIn: 3_000_000n,
      reserveOut: 1_000_000n,
      feeBps: 20,
    },
  ],
});
assert.equal(route.hops.length, 2);
assert.ok(route.minimumAmountOut < route.amountOut);
assert.deepEqual(
  quoteProportionalWithdrawal({ liquidity: 10n, totalLiquidity: 100n, reserves: [1000n, 500n] }),
  [100n, 50n],
);
assert.deepEqual(
  quoteProportionalDeposit({ amount: 100n, sourceReserve: 1000n, otherReserves: [500n] }),
  [50n],
);

const blockId = `00000063${"00".repeat(4)}15cd5b07${"00".repeat(20)}`;
assert.deepEqual(taposFromBlock({ id: blockId, block_num: 99 }), {
  refBlockNum: 99,
  refBlockPrefix: 123456789,
  blockNum: 99,
  blockId,
});
const emptyTransaction = {
  expiration: "2026-09-07T00:00:00",
  ref_block_num: 99,
  ref_block_prefix: 123456789,
  max_net_usage_words: 0,
  max_cpu_usage_ms: 0,
  delay_sec: 0,
  context_free_actions: [],
  actions: [],
  transaction_extensions: [],
};
const serialized = serializeTransaction(emptyTransaction);
assert.equal(
  transactionId(serialized),
  "62b442d1fe6357c994b9543a79978e33104dc0bc289710becc20a6a3257abbf7",
);

for (const account of ["alice", "bob", ".alice", "wind.bridge", "bridgeuser"]) {
  const address = nativeAccountToReservedEvmAddress(account);
  assert.equal(address.startsWith(VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX), true);
  assert.equal(reservedEvmAddressToNativeAccount(address), account);
  assert.equal(isReservedNativeBridgeAddress(address), true);
  assert.deepEqual(classifyVexEvmAddress(address), {
    type: "reserved-native-bridge",
    address,
    account,
  });
}
const invalidReserved = "0xbbbbbbbbbbbbbbbbbbbbbbbb318c6318c6318c66";
assert.equal(hasReservedNativeBridgePrefix(invalidReserved), true);
assert.equal(isReservedNativeBridgeAddress(invalidReserved), false);
assert.throws(() => nativeAccountToReservedEvmAddress("alice."), /canonical/);

const abiWord = (value) => String(value).replace(/^0x/, "").padStart(64, "0");
const memoHex = Array.from(new TextEncoder().encode("alice"), (byte) =>
  byte.toString(16).padStart(2, "0"),
).join("");
const bridgeAddress = nativeAccountToReservedEvmAddress("alice");
const bridgeCalldata = `0x73761828${abiWord(bridgeAddress)}${abiWord("1e240")}${abiWord("60")}${abiWord("5")}${memoHex.padEnd(64, "0")}`;
assert.deepEqual(decodeVexEvmBridgeTransferCalldata(bridgeCalldata), {
  amount: 123456n,
  memo: "alice",
  nativeAccount: "alice",
  rawTarget: bridgeAddress,
  reservedTarget: bridgeAddress,
});
const packedAddress = `0x${"0".repeat(24)}${bridgeAddress.slice(-16)}`;
const packedCalldata = `0x73761828${abiWord(packedAddress)}${abiWord("1")}${abiWord("60")}${abiWord("0")}`;
assert.equal(decodeVexEvmBridgeTransferCalldata(packedCalldata).nativeAccount, "alice");
assert.throws(
  () => decodeVexEvmBridgeTransferCalldata(`${bridgeCalldata}00`),
  /length|trailing data/,
);
assert.throws(
  () =>
    decodeVexEvmBridgeTransferCalldata(
      `0x73761828${`1${abiWord(bridgeAddress).slice(1)}`}${abiWord("1")}${abiWord("60")}${abiWord("0")}`,
    ),
  /padding/,
);
assert.throws(
  () =>
    decodeVexEvmBridgeTransferCalldata(
      `0x73761828${abiWord(bridgeAddress)}${abiWord("1")}${abiWord("80")}${abiWord("0")}`,
    ),
  /memo offset/,
);

assert.deepEqual(
  decodeVexEvmContractAction({
    act: {
      account: "vex.evm",
      name: "evmtx",
      data: {
        event: [
          "evmtx_v1",
          { eos_evm_version: "1", rlptx: "DEADBEEF", base_fee_per_gas: "150000000000" },
        ],
      },
    },
  }),
  {
    contract: "vex.evm",
    name: "evmtx",
    event: {
      type: "evmtx_v1",
      protocolVersion: 1n,
      rlpTransaction: "0xdeadbeef",
      baseFeePerGas: 150000000000n,
    },
  },
);
assert.deepEqual(
  decodeVexEvmContractAction({
    account: "vex.evm",
    name: "evmtx",
    data: {
      event: [
        "evmtx_v3",
        {
          eos_evm_version: "3",
          rlptx: "0x02f8",
          overhead_price: "150000000000",
          storage_price: "150000000000",
        },
      ],
    },
  }),
  {
    contract: "vex.evm",
    name: "evmtx",
    event: {
      type: "evmtx_v3",
      protocolVersion: 3n,
      rlpTransaction: "0x02f8",
      overheadPrice: 150000000000n,
      storagePrice: 150000000000n,
    },
  },
);
assert.deepEqual(
  decodeVexEvmContractAction({
    account: "vex.evm",
    name: "pushtx",
    data: { miner: "alice", rlptx: "c0", min_inclusion_price: "42" },
  }),
  {
    contract: "vex.evm",
    name: "pushtx",
    miner: "alice",
    rlpTransaction: "0xc0",
    minInclusionPrice: 42n,
  },
);
assert.throws(
  () =>
    decodeVexEvmContractAction({
      account: "vex.evm",
      name: "evmtx",
      data: { event: ["evmtx_v2", { eos_evm_version: "2", rlptx: "c0" }] },
    }),
  /Unsupported/,
);
assert.throws(
  () =>
    decodeVexEvmContractAction({
      account: "vex.evm",
      name: "evmtx",
      data: {
        event: [
          "evmtx_v3",
          {
            eos_evm_version: "3",
            rlptx: "xyz",
            overhead_price: "1",
            storage_price: "1",
          },
        ],
      },
    }),
  /hexadecimal/,
);

assert.equal(
  normalizeEvmAddress("0xA00000000000000000000000000000000000000A"),
  "0xa00000000000000000000000000000000000000a",
);
assert.equal(formatEvmAddress("0xA00000000000000000000000000000000000000A"), "0xa0000000…0000000a");
assert.equal(normalizeEvmChainId(6736), "0x1a50");
assert.equal(evmChainIdsEqual("0x1a50", 6736n), true);

const info = (chainId) => ({
  chain_id: chainId,
  head_block_num: 100,
  last_irreversible_block_num: 99,
  head_block_id: blockId,
  head_block_time: "2026-09-07T00:00:00.000",
});
let malformedAttempts = 0;
const malformedRpc = new RpcClient({
  endpoints: ["https://bad.example", "https://good.example"],
  expectedChainId: "11".repeat(32),
  fetch: async (input) => {
    malformedAttempts += 1;
    return String(input).startsWith("https://bad.example")
      ? Response.json({ chain_id: "not-a-chain" })
      : Response.json(info("11".repeat(32)));
  },
});
assert.equal((await malformedRpc.getInfo()).chain_id, "11".repeat(32));
assert.equal(malformedAttempts, 2);
const oversizedRpc = new RpcClient({
  endpoints: "https://large.example",
  maxResponseBytes: 1024,
  retries: 0,
  fetch: async () => new Response("x".repeat(1025)),
});
await assert.rejects(() => oversizedRpc.getInfo(), /1024-byte limit/);
const mismatchRpc = new RpcClient({
  endpoints: "https://wrong.example",
  expectedChainId: "11".repeat(32),
  retries: 0,
  fetch: async () => Response.json(info("22".repeat(32))),
});
await assert.rejects(() => mismatchRpc.getInfo(), RpcChainMismatchError);

const txId = "a".repeat(64);
const springCases = [
  [
    { state: "UNKNOWN", irreversible_number: 100 },
    { state: "unknown", transactionId: txId },
  ],
  [
    { state: "LOCALLY_APPLIED", irreversible_number: 100 },
    { state: "locally_applied", transactionId: txId, irreversibleBlock: 100 },
  ],
  [
    { state: "IN_BLOCK", block_number: 101, irreversible_number: 100 },
    { state: "in_block", transactionId: txId, blockNumber: 101, irreversibleBlock: 100 },
  ],
  [
    { state: "IRREVERSIBLE", block_number: 99, irreversible_number: 100 },
    { state: "irreversible", transactionId: txId, blockNumber: 99, irreversibleBlock: 100 },
  ],
  [
    { state: "FAILED", irreversible_number: 100 },
    { state: "failed", transactionId: txId, irreversibleBlock: 100 },
  ],
  [
    { state: "FORKED_OUT", irreversible_number: 100 },
    { state: "forked_out", transactionId: txId, irreversibleBlock: 100 },
  ],
];
for (const [response, expected] of springCases) {
  const spring = new SpringFinalityClient(
    new RpcClient({
      endpoints: "https://spring.example",
      fetch: async () => Response.json(response),
      retries: 0,
    }),
  );
  assert.deepEqual(await spring.getTransactionStatus(txId), expected);
}
const malformedSpring = new SpringFinalityClient(
  new RpcClient({
    endpoints: "https://spring.example",
    fetch: async () => Response.json({ state: "IN_BLOCK", block_number: "101" }),
    retries: 0,
  }),
);
await assert.rejects(() => malformedSpring.getTransactionStatus(txId), /irreversible_number/);
let springFailoverAttempts = 0;
const failoverSpring = new SpringFinalityClient(
  new RpcClient({
    endpoints: ["https://bad-spring.example", "https://good-spring.example"],
    fetch: async (input) => {
      springFailoverAttempts += 1;
      return String(input).startsWith("https://bad-spring.example")
        ? Response.json({ state: "IN_BLOCK", block_number: "101" })
        : Response.json({ state: "IN_BLOCK", block_number: 101, irreversible_number: 100 });
    },
  }),
);
assert.equal((await failoverSpring.getTransactionStatus(txId)).state, "in_block");
assert.equal(springFailoverAttempts, 2);
const unsupportedSpring = new SpringFinalityClient(
  new RpcClient({
    endpoints: "https://spring.example",
    retries: 0,
    fetch: async () =>
      Response.json({ message: "Transaction Status Interface not enabled" }, { status: 500 }),
  }),
);
const hyperion = new HyperionClient({
  endpoint: "https://history.example",
  fetch: async () =>
    Response.json({ executed: true, trx_id: txId, lib: 101, actions: [{ block_num: 101 }] }),
});
assert.deepEqual(
  await new AntelopeTransactionHistory(unsupportedSpring, hyperion).getTransaction(txId),
  {
    state: "irreversible",
    transactionId: txId,
    blockNumber: 101,
    irreversibleBlock: 101,
  },
);
const unknownSpring = new SpringFinalityClient(
  new RpcClient({
    endpoints: "https://spring.example",
    retries: 0,
    fetch: async () => Response.json({ state: "UNKNOWN", irreversible_number: 101 }),
  }),
);
assert.deepEqual(
  await new AntelopeTransactionHistory(unknownSpring, hyperion).getTransaction(txId),
  {
    state: "irreversible",
    transactionId: txId,
    blockNumber: 101,
    irreversibleBlock: 101,
  },
);
const malformedHyperion = new HyperionClient({
  endpoint: "https://history.example",
  fetch: async () => new Response("not-json"),
});
await assert.rejects(() => malformedHyperion.getTransaction(txId), /invalid JSON/);
const failedSpring = new SpringFinalityClient(
  new RpcClient({
    endpoints: "https://spring.example",
    retries: 0,
    fetch: async () => Response.json({ state: "FAILED", irreversible_number: 101 }),
  }),
);
let forbiddenFallbackCalls = 0;
const forbiddenFallback = new HyperionClient({
  endpoint: "https://history.example",
  fetch: async () => {
    forbiddenFallbackCalls += 1;
    return Response.json({});
  },
});
assert.equal(
  (await new AntelopeTransactionHistory(failedSpring, forbiddenFallback).getTransaction(txId))
    .state,
  "failed",
);
assert.equal(forbiddenFallbackCalls, 0, "Spring terminal states must not use Hyperion fallback");

const digest = sha256Digest(new TextEncoder().encode("keosd regression"));
const signature = privateKey.signDigest(digest).toString();
const signRequest = {
  chainId: "11".repeat(32),
  transaction: emptyTransaction,
  serializedTransaction: serialized,
  serializedContextFreeData: new Uint8Array(),
  digest,
  requiredKeys: [modernKey],
};
function keosdResponse(url, body) {
  if (url.endsWith("/list_wallets")) return ["test *"];
  if (url.endsWith("/get_public_keys")) return [vexKey];
  if (url.endsWith("/sign_transaction")) {
    assert.equal(body[1][0], vexKey);
    return { signatures: [signature] };
  }
  throw new Error(`Unexpected keosd URL ${url}`);
}
const httpSigner = new KeosdSigner({
  walletName: "test",
  transport: new KeosdHttpTransport({
    endpoint: "http://127.0.0.1:8900",
    fetch: async (input, init) =>
      Response.json(
        keosdResponse(String(input), init?.body ? JSON.parse(String(init.body)) : undefined),
      ),
  }),
});
assert.deepEqual(await httpSigner.assertAvailable(), { wallet: "test", publicKeyCount: 1 });
assert.deepEqual(await httpSigner.sign(signRequest), [signature]);
assert.throws(() => new KeosdHttpTransport({ endpoint: "http://remote.example" }), /Remote keosd/);

const socketDirectory = await mkdtemp(path.join(tmpdir(), "windstack-keosd-"));
const socketPath = path.join(socketDirectory, "keosd.sock");
const server = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(keosdResponse(request.url, body)));
  });
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(socketPath, () => {
    server.off("error", reject);
    resolve();
  });
});
try {
  const unixSigner = new KeosdSigner({
    walletName: "test",
    transport: new KeosdUnixTransport({ socketPath }),
  });
  assert.deepEqual(await unixSigner.assertAvailable(), { wallet: "test", publicKeyCount: 1 });
  assert.deepEqual(await unixSigner.sign(signRequest), [signature]);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(socketDirectory, { recursive: true, force: true });
}

let evmCalls = 0;
const evmRpc = new EvmRpcClient({
  endpoints: ["https://wrong.example", "https://right.example"],
  expectedChainId: 6736,
  fetch: async (input, init) => {
    evmCalls += 1;
    const body = JSON.parse(String(init?.body));
    const wrong = String(input).startsWith("https://wrong.example");
    const result = body.method === "eth_chainId" ? (wrong ? "0x1" : "0x1a50") : "0x2a";
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  },
});
assert.equal(await evmRpc.request("eth_blockNumber", [], { retry: "safe" }), "0x2a");
assert.equal(evmCalls, 3, "wrong-chain endpoint must be rejected before failover read");

assert.equal(typeof AntelopeClient, "function");
console.log("General-purpose SDK regression tests passed");
