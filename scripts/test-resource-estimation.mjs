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
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  createVexaniumClient,
} from "../packages/vexanium/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenAbi = JSON.parse(
  await readFile(path.join(root, "test/fixtures/vexanium/vex.token.abi.json"), "utf8"),
);

const account = {
  actor: "alice",
  permission: "active",
  permissionLevel: "alice@active",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
};
const provider = {
  providerInfo: {
    uuid: "resource-test-wallet",
    name: "Resource Test Wallet",
    rdns: "com.example.resources",
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: VEXANIUM_PROVIDER_VERSION,
    chains: [VEXANIUM_MAINNET_CHAIN_ID],
    capabilities: [VEXANIUM_CAPABILITIES.ACCOUNTS, VEXANIUM_CAPABILITIES.SESSIONS],
  },
  async request({ method }) {
    if (method === VEXANIUM_METHODS.GET_CAPABILITIES) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        chains: [VEXANIUM_MAINNET_CHAIN_ID],
        capabilities: [VEXANIUM_CAPABILITIES.ACCOUNTS, VEXANIUM_CAPABILITIES.SESSIONS],
        methods: [
          VEXANIUM_METHODS.REQUEST_ACCOUNTS,
          VEXANIUM_METHODS.GET_ACCOUNTS,
          VEXANIUM_METHODS.GET_CHAIN,
          VEXANIUM_METHODS.DISCONNECT,
        ],
      };
    }
    if (method === VEXANIUM_METHODS.REQUEST_ACCOUNTS) {
      return {
        standard: VEXANIUM_PROVIDER_STANDARD,
        version: VEXANIUM_PROVIDER_VERSION,
        sessionId: "resource-session",
        chainId: VEXANIUM_MAINNET_CHAIN_ID,
        accounts: [account],
        capabilities: [VEXANIUM_CAPABILITIES.ACCOUNTS, VEXANIUM_CAPABILITIES.SESSIONS],
      };
    }
    if (method === VEXANIUM_METHODS.DISCONNECT) return null;
    throw new Error(`Unexpected provider method: ${method}`);
  },
};

const rpcCalls = [];
const vex = await createVexaniumClient({
  provider,
  autoSync: false,
  fetch: async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    rpcCalls.push({ url, body });
    if (url.endsWith("/v1/chain/get_info")) {
      return Response.json({
        chain_id: VEXANIUM_MAINNET_CHAIN_ID,
        head_block_num: 100,
        last_irreversible_block_num: 99,
        head_block_id: "01".repeat(32),
        head_block_time: "2026-09-21T00:00:00.000",
      });
    }
    if (url.endsWith("/v1/chain/get_block")) {
      return Response.json({
        timestamp: "2026-09-21T00:00:00.000",
        id: "02".repeat(32),
        block_num: 99,
        ref_block_prefix: 123456,
      });
    }
    if (url.endsWith("/v1/chain/get_abi")) {
      return Response.json({ account_name: body.account_name, abi: tokenAbi });
    }
    if (url.endsWith("/v1/chain/compute_transaction")) {
      assert.deepEqual(body.transaction.signatures, []);
      assert.equal(typeof body.transaction.packed_trx, "string");
      return Response.json({
        transaction_id: "03".repeat(32),
        processed: {
          receipt: { status: "executed", cpu_usage_us: 350, net_usage_words: 21 },
          elapsed: 350,
          net_usage: 168,
          scheduled: false,
          action_traces: [
            { account_ram_deltas: [{ account: "alice", delta: 240 }] },
          ],
        },
      });
    }
    if (url.endsWith("/v1/chain/get_account")) {
      return Response.json({
        ram_quota: 8192,
        ram_usage: 4096,
        cpu_limit: { used: 100, available: 1900, max: 2000 },
        net_limit: { used: 64, available: 4032, max: 4096 },
      });
    }
    return Response.json({ message: "not found" }, { status: 404 });
  },
});

const connected = await vex.connectOne();
const estimate = await vex.estimateResources({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: connected.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "",
      },
    },
  ],
});

assert.equal(estimate.valid, true);
assert.equal(estimate.usage.cpuUs, 350);
assert.equal(estimate.usage.netBytes, 168);
assert.equal(estimate.usage.ramByAccount.alice, 240);
assert.equal(estimate.check.sufficient, true);
assert.equal(estimate.check.cpu.availableUs, 1900);
assert.equal(estimate.check.ram.requiredBytes, 240);
assert.ok(rpcCalls.some(({ url }) => url.endsWith("/v1/chain/compute_transaction")));

await vex.disconnect();
vex.destroy();
console.log("Vexanium resource estimation tests passed");
