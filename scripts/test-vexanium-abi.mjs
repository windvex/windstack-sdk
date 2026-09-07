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
import { AbiSerializer } from "../packages/abi/dist/index.js";
import { PrivateKey, sha256Digest } from "../packages/crypto/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const publicKey = privateKey.toPublicKey().toString();
const signature = privateKey
  .signDigest(sha256Digest(new TextEncoder().encode("WindStack ABI fixture")))
  .toString();

async function readAbi(account) {
  return JSON.parse(
    await readFile(path.join(root, "test", "fixtures", "vexanium", `${account}.abi.json`), "utf8"),
  );
}

function createSampler(abi) {
  const aliases = new Map((abi.types ?? []).map((item) => [item.new_type_name, item.type]));
  const structs = new Map((abi.structs ?? []).map((item) => [item.name, item]));
  const variants = new Map((abi.variants ?? []).map((item) => [item.name, item]));

  function resolve(type) {
    const seen = new Set();
    let current = type;
    while (aliases.has(current)) {
      if (seen.has(current)) throw new TypeError(`Cyclic fixture alias: ${type}`);
      seen.add(current);
      current = aliases.get(current);
    }
    return current;
  }

  function sample(rawType, stack = []) {
    if (rawType.endsWith("[]")) return [];
    if (rawType.endsWith("?")) return null;
    if (rawType.endsWith("$")) return undefined;
    const type = resolve(rawType);
    if (type !== rawType) return sample(type, stack);
    if (stack.includes(type)) {
      throw new TypeError(
        `Recursive fixture type cannot be sampled: ${[...stack, type].join(" -> ")}`,
      );
    }
    const struct = structs.get(type);
    if (struct) {
      const value = {};
      if (struct.base) Object.assign(value, sample(struct.base, [...stack, type]));
      for (const field of struct.fields ?? [])
        value[field.name] = sample(field.type, [...stack, type]);
      return value;
    }
    const variant = variants.get(type);
    if (variant) {
      const selected = variant.types[0];
      return { type: selected, value: sample(selected, [...stack, type]) };
    }
    switch (type) {
      case "bool":
        return false;
      case "uint8":
      case "int8":
      case "uint16":
      case "int16":
      case "uint32":
      case "int32":
      case "varuint32":
      case "varuint":
      case "varint32":
      case "varint":
      case "float32":
      case "float64":
        return 0;
      case "uint64":
      case "int64":
      case "uint128":
      case "int128":
        return "0";
      case "float128":
        return "00".repeat(16);
      case "name":
        return "alice";
      case "string":
      case "bytes":
        return "";
      case "checksum160":
        return "00".repeat(20);
      case "checksum256":
        return "00".repeat(32);
      case "checksum512":
        return "00".repeat(64);
      case "asset":
        return "1.0000 VEX";
      case "extended_asset":
        return { quantity: "1.0000 VEX", contract: "vex.token" };
      case "symbol":
        return "4,VEX";
      case "symbol_code":
        return "VEX";
      case "time_point":
        return "2026-09-07T00:00:00.123456Z";
      case "time_point_sec":
        return "2026-09-07T00:00:00Z";
      case "block_timestamp_type":
        return "2026-09-07T00:00:00.000Z";
      case "public_key":
      case "publickey":
        return publicKey;
      case "signature":
        return signature;
      default:
        throw new TypeError(`Unsupported primitive in Vexanium fixture: ${type}`);
    }
  }
  return sample;
}

function validateFixture(account, abi) {
  assert.equal(abi.version, "eosio::abi/1.2");
  const serializer = new AbiSerializer(abi);
  const sample = createSampler(abi);

  for (const alias of abi.types ?? []) {
    assert.equal(typeof serializer.resolveType(alias.new_type_name), "string");
  }
  for (const struct of abi.structs ?? []) {
    const bytes = serializer.encode(struct.name, sample(struct.name));
    serializer.decode(struct.name, bytes);
  }
  for (const variant of abi.variants ?? []) {
    const bytes = serializer.encode(variant.name, sample(variant.name));
    serializer.decode(variant.name, bytes);
  }
  for (const action of abi.actions ?? []) {
    serializer.decodeAction(action.name, serializer.encodeAction(action.name, sample(action.type)));
  }
  for (const table of abi.tables ?? []) {
    assert.equal(serializer.getTableType(table.name), table.type);
    serializer.decode(table.type, serializer.encode(table.type, sample(table.type)));
  }
  for (const result of abi.action_results ?? []) {
    serializer.decode(
      result.result_type,
      serializer.encode(result.result_type, sample(result.result_type)),
    );
  }

  return {
    account,
    actions: abi.actions?.length ?? 0,
    tables: abi.tables?.length ?? 0,
    structs: abi.structs?.length ?? 0,
  };
}

const token = await readAbi("vex.token");
const system = await readAbi("vexcore");
const tokenResult = validateFixture("vex.token", token);
const systemResult = validateFixture("vexcore", system);

assert.equal(tokenResult.actions, 10);
assert.equal(tokenResult.tables, 3);
assert.equal(systemResult.actions, 84);
assert.equal(systemResult.tables, 34);
assert.deepEqual(
  token.actions.map((item) => item.name),
  [
    "addblacklist",
    "close",
    "create",
    "issue",
    "issuefixed",
    "open",
    "retire",
    "rmblacklist",
    "setmaxsupply",
    "transfer",
  ],
);

console.log(
  `Vexanium ABI fixtures passed: ${tokenResult.actions + systemResult.actions} actions, ${tokenResult.tables + systemResult.tables} tables, ${tokenResult.structs + systemResult.structs} structs`,
);
