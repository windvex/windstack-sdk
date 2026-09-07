import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AbiSerializer } from "../packages/abi/dist/index.js";
import { PrivateKey, PublicKey, sha256Digest } from "../packages/crypto/dist/index.js";
import { decodeVexEvmContractAction } from "../packages/vexanium/dist/index.js";

const RPC = "https://api.windcrypto.com";
const CHAIN_ID = "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f";
const EXPECTED_ABI = {
  "vex.evm": "a388596c4b2a04bff58c16781dc17c6a1a6bbe4920d463225e5ae7e074cfb4ca",
  "vex.token": "b05a9a7fa75705eb216a5330f8549a291d66c367eea1e49c980fd64783d9c2a0",
  vexcore: "3f92498072f9ae810dc758b1ae15ecfa9ee3baae7763f0a73ada5a2a185c68f5",
};

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const privateKey = PrivateKey.fromBytes("K1", scalarOne);
const publicKey = privateKey.toPublicKey().toString();
const signature = privateKey
  .signDigest(sha256Digest(new TextEncoder().encode("WindStack Vexanium ABI")))
  .toString();

async function post(path, body = {}) {
  const response = await fetch(`${RPC}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.error?.what ?? payload?.message;
    throw new Error(
      `Vexanium RPC ${path} failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  return payload;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function structuralAbi(abi) {
  return {
    version: abi.version,
    types: abi.types ?? [],
    structs: abi.structs ?? [],
    actions: (abi.actions ?? []).map(({ name, type }) => ({ name, type })),
    tables: abi.tables ?? [],
    variants: abi.variants ?? [],
    action_results: abi.action_results ?? [],
  };
}

function structuralHash(abi) {
  return createHash("sha256")
    .update(stableStringify(structuralAbi(abi)))
    .digest("hex");
}

function makeSampler(abi) {
  const aliases = new Map((abi.types ?? []).map((item) => [item.new_type_name, item.type]));
  const structs = new Map((abi.structs ?? []).map((item) => [item.name, item]));
  const variants = new Map((abi.variants ?? []).map((item) => [item.name, item]));

  function resolve(type) {
    let current = type;
    const seen = new Set();
    while (aliases.has(current)) {
      if (seen.has(current)) throw new Error(`Cyclic ABI alias: ${type}`);
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
    if (stack.includes(type))
      throw new Error(`Recursive ABI type cannot be sampled: ${[...stack, type].join(" -> ")}`);

    const struct = structs.get(type);
    if (struct) {
      const value = {};
      if (struct.base) Object.assign(value, sample(struct.base, [...stack, type]));
      for (const field of struct.fields ?? []) {
        value[field.name] = sample(field.type, [...stack, type]);
      }
      return value;
    }

    const variant = variants.get(type);
    if (variant) {
      const selected = variant.types?.[0];
      if (!selected) throw new Error(`ABI variant ${type} has no alternatives`);
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
        return "2026-09-07T00:00:00.000000Z";
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
        throw new Error(`Unsupported ABI type in production Vexanium ABI: ${type}`);
    }
  }

  return sample;
}

function validateAbi(contract, abi) {
  assert.ok(abi && typeof abi === "object", `${contract} returned no ABI`);
  assert.equal(abi.version, "eosio::abi/1.2", `${contract} ABI version changed`);
  assert.equal(
    structuralHash(abi),
    EXPECTED_ABI[contract],
    `${contract} ABI changed since release audit`,
  );

  const serializer = new AbiSerializer(abi);
  const sample = makeSampler(abi);

  for (const action of abi.actions ?? []) {
    const bytes = serializer.encodeAction(action.name, sample(action.type));
    serializer.decodeAction(action.name, bytes);
  }
  for (const table of abi.tables ?? []) {
    const bytes = serializer.encode(table.type, sample(table.type));
    serializer.decode(table.type, bytes);
  }
  for (const result of abi.action_results ?? []) {
    const bytes = serializer.encode(result.result_type, sample(result.result_type));
    serializer.decode(result.result_type, bytes);
  }
}

const info = await post("/v1/chain/get_info");
assert.equal(String(info.chain_id).toLowerCase(), CHAIN_ID, "RPC endpoint is not Vexanium Mainnet");

const token = await post("/v1/chain/get_abi", { account_name: "vex.token" });
const system = await post("/v1/chain/get_abi", { account_name: "vexcore" });
const evm = await post("/v1/chain/get_abi", { account_name: "vex.evm" });
validateAbi("vex.token", token.abi);
validateAbi("vexcore", system.abi);
validateAbi("vex.evm", evm.abi);

const evmHistoryUrl = new URL("/v2/history/get_actions", `${RPC}/`);
evmHistoryUrl.searchParams.set("account", "vex.evm");
evmHistoryUrl.searchParams.set("filter", "vex.evm:evmtx");
evmHistoryUrl.searchParams.set("limit", "1");
evmHistoryUrl.searchParams.set("sort", "desc");
const evmHistoryResponse = await fetch(evmHistoryUrl, {
  headers: { accept: "application/json" },
  signal: AbortSignal.timeout(15_000),
});
assert.equal(evmHistoryResponse.ok, true, "VEX EVM history lookup failed");
const evmHistory = await evmHistoryResponse.json();
assert.ok(Array.isArray(evmHistory.actions) && evmHistory.actions.length > 0);
const decodedEvmAction = decodeVexEvmContractAction(evmHistory.actions[0]);
assert.equal(decodedEvmAction.name, "evmtx");
assert.match(decodedEvmAction.event.rlpTransaction, /^0x[0-9a-f]+$/);

const block = await post("/v1/chain/get_block", {
  block_num_or_id: info.last_irreversible_block_num,
});
assert.equal(block.block_num, info.last_irreversible_block_num);
assert.match(block.id, /^[0-9a-f]{64}$/i);

const account = await post("/v1/chain/get_account", { account_name: "vexcore" });
assert.equal(account.account_name, "vexcore");

const rawAbi = await post("/v1/chain/get_raw_abi", { account_name: "vex.token" });
assert.equal(rawAbi.account_name, "vex.token");
assert.match(rawAbi.abi_hash, /^[0-9a-f]{64}$/i);

const codeHash = await post("/v1/chain/get_code_hash", { account_name: "vex.token" });
assert.equal(codeHash.account_name, "vex.token");
assert.match(codeHash.code_hash, /^[0-9a-f]{64}$/i);

const statRows = await post("/v1/chain/get_table_rows", {
  json: true,
  code: "vex.token",
  scope: "VEX",
  table: "stat",
  limit: 1,
});
assert.match(statRows.rows[0]?.supply, / VEX$/);

const scopes = await post("/v1/chain/get_table_by_scope", {
  code: "vex.token",
  table: "accounts",
  limit: 1,
});
assert.ok(Array.isArray(scopes.rows));

const balance = await post("/v1/chain/get_currency_balance", {
  code: "vex.token",
  account: "vexcore",
  symbol: "VEX",
});
assert.ok(Array.isArray(balance));
assert.ok(balance.every((value) => / VEX$/.test(value)));

const stats = await post("/v1/chain/get_currency_stats", {
  code: "vex.token",
  symbol: "VEX",
});
assert.match(stats.VEX?.supply, / VEX$/);

const expiration = new Date(`${info.head_block_time}Z`);
expiration.setUTCSeconds(expiration.getUTCSeconds() + 60);
const producers = await post("/v1/chain/get_table_rows", {
  json: true,
  code: "vexcore",
  scope: "vexcore",
  table: "producers",
  limit: 1,
});
const actor = producers.rows[0]?.owner;
assert.match(actor, /^[.1-5a-z]{1,12}$/);
const actorAccount = await post("/v1/chain/get_account", { account_name: actor });
const activePermission = actorAccount.permissions?.find(
  (permission) => permission.perm_name === "active",
);
const activeKey = activePermission?.required_auth?.keys?.find(
  (key) => key.weight >= activePermission.required_auth.threshold,
)?.key;
assert.equal(typeof activeKey, "string", `${actor} has no directly usable active key`);
const normalizedActiveKey = PublicKey.fromString(activeKey).toString();
assert.match(normalizedActiveKey, /^PUB_(?:K1|R1)_/);
const transferData = new AbiSerializer(token.abi).encodeAction("transfer", {
  from: actor,
  to: actor,
  quantity: "0.0001 VEX",
  memo: "read-only required-key probe",
});
const requiredKeys = await post("/v1/chain/get_required_keys", {
  transaction: {
    expiration: expiration.toISOString().replace(/\.\d{3}Z$/, ""),
    ref_block_num: block.block_num & 0xffff,
    ref_block_prefix: block.ref_block_prefix,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: [
      {
        account: "vex.token",
        name: "transfer",
        authorization: [{ actor, permission: "active" }],
        data: Array.from(transferData, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      },
    ],
    transaction_extensions: [],
  },
  available_keys: [activeKey],
});
assert.deepEqual(requiredKeys.required_keys, [activeKey]);

const tokenActions = new Set(token.abi.actions.map((item) => item.name));
const tokenTables = new Set(token.abi.tables.map((item) => item.name));
for (const name of ["transfer", "open", "close", "issue", "retire"])
  assert.ok(tokenActions.has(name));
for (const name of ["accounts", "stat", "blacklist"]) assert.ok(tokenTables.has(name));

const systemActions = new Set(system.abi.actions.map((item) => item.name));
const systemTables = new Set(system.abi.tables.map((item) => item.name));
for (const name of [
  "delegatebw",
  "undelegatebw",
  "buyram",
  "buyrambytes",
  "sellram",
  "refund",
  "voteproducer",
  "regproducer",
  "regproxy",
  "newaccount",
  "updateauth",
  "deleteauth",
  "linkauth",
  "unlinkauth",
]) {
  assert.ok(systemActions.has(name), `vexcore is missing ${name}`);
}
for (const name of [
  "producers",
  "voters",
  "refunds",
  "userres",
  "delband",
  "rammarket",
  "instantund",
]) {
  assert.ok(systemTables.has(name), `vexcore is missing table ${name}`);
}

console.log(
  `Vexanium read-only RPC and production ABI verified: ${token.abi.actions.length} vex.token actions, ${system.abi.actions.length} vexcore actions, ${evm.abi.actions.length} vex.evm actions`,
);
