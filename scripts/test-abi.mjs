/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import {
  AbiSerializer,
  bigIntToName,
  formatAsset,
  nameToBigInt,
  parseAsset,
} from "../packages/abi/dist/index.js";
import { PrivateKey, sha256Digest } from "../packages/crypto/dist/index.js";

const abi = {
  version: "eosio::abi/1.2",
  types: [
    { new_type_name: "account_name", type: "name" },
    { new_type_name: "account_list", type: "account_name[]" },
  ],
  structs: [
    { name: "base", base: "", fields: [{ name: "id", type: "uint64" }] },
    {
      name: "child",
      base: "base",
      fields: [
        { name: "accounts", type: "account_list" },
        { name: "memo", type: "string?" },
      ],
    },
    {
      name: "extension",
      base: "",
      fields: [
        { name: "value", type: "string" },
        { name: "extra", type: "uint32$" },
      ],
    },
  ],
  variants: [{ name: "value_variant", types: ["string", "uint64"] }],
  actions: [{ name: "save", type: "child" }],
  tables: [{ name: "records", index_type: "i64", type: "child" }],
  action_results: [{ name: "save", result_type: "value_variant" }],
};
const serializer = new AbiSerializer(abi);

const child = { id: "18446744073709551615", accounts: ["alice", "vex.token"], memo: null };
assert.deepEqual(serializer.decode("child", serializer.encode("child", child)), {
  id: 18446744073709551615n,
  accounts: ["alice", "vex.token"],
  memo: null,
});
assert.deepEqual(serializer.decode("account_list", serializer.encode("account_list", ["alice"])), [
  "alice",
]);
assert.deepEqual(serializer.decode("extension", serializer.encode("extension", { value: "VEX" })), {
  value: "VEX",
  extra: undefined,
});
assert.deepEqual(
  serializer.decode("extension", serializer.encode("extension", { value: "VEX", extra: 7 })),
  { value: "VEX", extra: 7 },
);
assert.deepEqual(
  serializer.decode(
    "value_variant",
    serializer.encode("value_variant", { type: "uint64", value: "9" }),
  ),
  { type: "uint64", value: 9n },
);
assert.equal(serializer.getActionType("save"), "child");
assert.equal(serializer.getTableType("records"), "child");

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const publicKey = privateKey.toPublicKey().toString();
const signature = privateKey.signDigest(sha256Digest(new Uint8Array(0))).toString();
const cases = [
  ["bool", true, true],
  ["uint8", 255, 255],
  ["int8", -128, -128],
  ["uint16", 65535, 65535],
  ["int16", -32768, -32768],
  ["uint32", 4294967295, 4294967295],
  ["int32", -2147483648, -2147483648],
  ["uint64", "18446744073709551615", 18446744073709551615n],
  ["int64", "-9223372036854775808", -9223372036854775808n],
  ["uint128", "340282366920938463463374607431768211455", 340282366920938463463374607431768211455n],
  ["int128", "-170141183460469231731687303715884105728", -170141183460469231731687303715884105728n],
  ["varuint32", 4294967295, 4294967295],
  ["varint32", -2147483648, -2147483648],
  ["float32", 1.5, 1.5],
  ["float64", Math.PI, Math.PI],
  ["float128", "ab".repeat(16), "ab".repeat(16)],
  ["string", "Vexanium", "Vexanium"],
  ["bytes", "00ff", "00ff"],
  ["checksum160", "11".repeat(20), "11".repeat(20)],
  ["checksum256", "22".repeat(32), "22".repeat(32)],
  ["checksum512", "33".repeat(64), "33".repeat(64)],
  ["asset", "1.0000 VEX", "1.0000 VEX"],
  ["symbol", "4,VEX", "4,VEX"],
  ["symbol_code", "VEX", "VEX"],
  [
    "extended_asset",
    { quantity: "1.0000 VEX", contract: "vex.token" },
    { quantity: "1.0000 VEX", contract: "vex.token" },
  ],
  ["time_point", "2026-09-07T00:00:00.123456Z", "2026-09-07T00:00:00.123456Z"],
  ["time_point_sec", "2026-09-07T00:00:00Z", "2026-09-07T00:00:00.000Z"],
  ["block_timestamp_type", "2026-09-07T00:00:00.500Z", "2026-09-07T00:00:00.500Z"],
  ["public_key", publicKey, publicKey],
  ["signature", signature, signature],
];
for (const [type, input, expected] of cases) {
  assert.deepEqual(serializer.decode(type, serializer.encode(type, input)), expected, type);
}

assert.equal(bigIntToName(nameToBigInt("vex.token")), "vex.token");
assert.deepEqual(parseAsset("1.0000 VEX"), {
  amount: 10000n,
  precision: 4,
  symbol: "VEX",
  value: "1.0000 VEX",
});
assert.equal(formatAsset(-10000n, 4, "VEX"), "-1.0000 VEX");
assert.equal(bigIntToName(nameToBigInt("abcdefghij123")), "abcdefghij123");
assert.throws(() => nameToBigInt("aaaaaaaaaaaak"), /13th Antelope name character/);
assert.throws(
  () => serializer.encode("uint64", Number.MAX_SAFE_INTEGER + 1),
  /bigint or a decimal string/,
);
assert.throws(() => serializer.encode("uint8", 256), /uint8/);
assert.throws(() => serializer.encode("bytes", null), /hexadecimal or Uint8Array/);
assert.throws(() => serializer.encode("bytes", { length: 2 }), /hexadecimal or Uint8Array/);
assert.throws(() => parseAsset("01.0000 VEX"), /Invalid asset/);
assert.throws(() => serializer.decode("bool", Uint8Array.of(2)), /Invalid bool/);
assert.throws(() => serializer.decode("uint64", new Uint8Array(7)), /Unexpected end/);
assert.throws(() => serializer.decode("uint8", Uint8Array.of(1, 2)), /Unused ABI bytes/);
assert.throws(
  () => serializer.decode("string", Uint8Array.of(1, 0xff)),
  /encoded data was not valid/,
);
assert.throws(
  () =>
    new AbiSerializer({
      version: "eosio::abi/1.2",
      structs: [{ name: "bad", fields: [{ name: "x", type: "mystery" }] }],
    }),
  /Unsupported ABI type mystery/,
);
assert.throws(
  () =>
    new AbiSerializer({
      version: "eosio::abi/1.2",
      types: [
        { new_type_name: "a", type: "b" },
        { new_type_name: "b", type: "a" },
      ],
    }),
  /Cyclic ABI alias/,
);
assert.throws(
  () =>
    new AbiSerializer({
      version: "eosio::abi/1.2",
      structs: [
        {
          name: "bad",
          fields: [
            { name: "tail", type: "uint8$" },
            { name: "later", type: "uint8" },
          ],
        },
      ],
    }),
  /Binary-extension fields must be last/,
);

console.log("ABI codec tests passed");
