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
  estimateVexaniumActionRamBytes,
  quoteVexaniumRamFromMarket,
} from "../packages/vexanium/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenAbi = JSON.parse(
  await readFile(path.join(root, "test/fixtures/vexanium/vex.token.abi.json"), "utf8"),
);
const systemAbi = JSON.parse(
  await readFile(path.join(root, "test/fixtures/vexanium/vexcore.abi.json"), "utf8"),
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

const ramMarket = {
  supply: "10000000000.0000 RAMCORE",
  base: { balance: "1000000000 RAM", weight: 0.5 },
  quote: { balance: "1000000.0000 VEX", weight: 0.5 },
};

const rpcCalls = [];
let computeMode = "success";

function accountResources() {
  if (computeMode === "success") {
    return {
      ram_quota: 8192,
      ram_usage: 4096,
      cpu_limit: { used: 100, available: 1900, max: 2000 },
      net_limit: { used: 64, available: 4032, max: 4096 },
    };
  }
  return {
    ram_quota: 5470,
    ram_usage: 2996,
    cpu_limit: { used: 0, available: 15328, max: 15328 },
    net_limit: { used: 0, available: 17200, max: 17200 },
  };
}

function resourceException(name, data) {
  return {
    code:
      name === "ram_usage_exceeded"
        ? 3080001
        : name === "tx_net_usage_exceeded"
          ? 3080002
          : 3080004,
    name,
    message: name,
    stack: [{ data }],
  };
}

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
      return Response.json({
        account_name: body.account_name,
        abi: body.account_name === "vexcore" ? systemAbi : tokenAbi,
      });
    }
    if (url.endsWith("/v1/chain/get_account")) {
      return Response.json(accountResources());
    }
    if (url.endsWith("/v1/chain/get_table_rows")) {
      if (body.table === "userres") {
        return Response.json({
          rows: [
            {
              owner: "alice",
              net_weight: "1.0000 VEX",
              cpu_weight: "1.0000 VEX",
              ram_bytes: 5470,
            },
          ],
          more: false,
        });
      }
      if (body.table === "rammarket") {
        return Response.json({ rows: [ramMarket], more: false });
      }
      return Response.json({ rows: [], more: false });
    }
    if (url.endsWith("/v1/chain/compute_transaction")) {
      assert.deepEqual(body.transaction.signatures, []);
      assert.equal(typeof body.transaction.packed_trx, "string");

      if (computeMode === "net") {
        return Response.json({
          transaction_id: "04".repeat(32),
          processed: {
            receipt: null,
            elapsed: 233,
            net_usage: 19101,
            scheduled: false,
            action_traces: [],
            account_ram_delta: null,
            except: resourceException("tx_net_usage_exceeded", {
              net_usage: 19101,
              net_limit: 17200,
            }),
            error_code: "10000000000000000000",
          },
        });
      }

      if (computeMode === "cpu") {
        return Response.json({
          transaction_id: "05".repeat(32),
          processed: {
            receipt: null,
            elapsed: 21658,
            net_usage: 368,
            scheduled: false,
            action_traces: [
              {
                account_ram_deltas: [{ account: "alice", delta: 661 }],
              },
            ],
            account_ram_delta: null,
            except: resourceException("tx_cpu_usage_exceeded", {
              billed: 21600,
              billable: 15328,
              limit: 15328,
            }),
            error_code: "10000000000000000000",
          },
        });
      }

      if (computeMode === "ram") {
        return Response.json({
          transaction_id: "06".repeat(32),
          processed: {
            receipt: null,
            elapsed: 600,
            net_usage: 192,
            scheduled: false,
            action_traces: [
              {
                account_ram_deltas: [{ account: "alice", delta: 3000 }],
              },
            ],
            account_ram_delta: null,
            except: resourceException("ram_usage_exceeded", {
              account: "alice",
              needs: 6500,
              available: 5470,
            }),
            error_code: "10000000000000000000",
          },
        });
      }

      if (computeMode === "execution") {
        return Response.json({
          transaction_id: "07".repeat(32),
          processed: {
            receipt: null,
            elapsed: 50,
            net_usage: 0,
            scheduled: false,
            action_traces: [],
            account_ram_delta: null,
            except: {
              code: 3050003,
              name: "eosio_assert_message_exception",
              message: "assertion failure with message: test failure",
            },
            error_code: 3050003,
          },
        });
      }

      return Response.json({
        transaction_id: "03".repeat(32),
        processed: {
          receipt: { status: "executed", cpu_usage_us: 350, net_usage_words: 21 },
          elapsed: 350,
          net_usage: 168,
          scheduled: false,
          action_traces: [{ account_ram_deltas: [{ account: "alice", delta: 240 }] }],
          account_ram_delta: null,
          except: null,
          error_code: null,
        },
      });
    }

    return Response.json({ message: "not found" }, { status: 404 });
  },
});

const connected = await vex.connectOne();
const transferActions = [
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
];

const estimate = await vex.estimateResources({ actions: transferActions });
assert.equal(estimate.status, "sufficient");
assert.equal(estimate.valid, true);
assert.equal("exception" in estimate, false);
assert.equal(estimate.usage.cpuUs, 350);
assert.equal(estimate.usage.netBytes, 168);
assert.equal(estimate.usage.ramByAccount.alice, 240);
assert.equal(estimate.requirements.cpu.requiredUs, 350);
assert.equal(estimate.requirements.net.requiredBytes, 168);
assert.equal(estimate.requirements.ram.requiredBytes, 240);
assert.equal(estimate.check.sufficient, true);
assert.equal(estimate.funding.cpu.minimumAdditionalStakeVex, "0.0000 VEX");
assert.equal(estimate.funding.net.minimumAdditionalStakeVex, "0.0000 VEX");
assert.equal(estimate.funding.ram.estimatedPurchaseVex, "0.0000 VEX");
assert.ok(rpcCalls.some(({ url }) => url.endsWith("/v1/chain/compute_transaction")));

computeMode = "net";
const setcodeActions = [
  {
    account: "vexcore",
    name: "setcode",
    data: {
      account: connected.actor,
      vmtype: 0,
      vmversion: 0,
      code: "00".repeat(1000),
    },
  },
];
assert.equal(estimateVexaniumActionRamBytes(setcodeActions, "alice"), 10000);

const netEstimate = await vex.estimateResources({ actions: setcodeActions });
assert.equal(netEstimate.status, "insufficient_resources");
assert.equal(netEstimate.valid, false);
assert.equal(netEstimate.exception?.name, "tx_net_usage_exceeded");
assert.equal(netEstimate.requirements.net.requiredBytes, 19101);
assert.equal(netEstimate.requirements.net.availableBytes, 17200);
assert.equal(netEstimate.requirements.net.deficitBytes, 1901);
assert.equal(netEstimate.requirements.net.certainty, "exact");
assert.equal(netEstimate.requirements.cpu.requiredUs, null);
assert.equal(netEstimate.requirements.cpu.certainty, "unknown");
assert.equal(netEstimate.requirements.ram.requiredBytes, 10000);
assert.equal(netEstimate.requirements.ram.availableBytes, 2474);
assert.equal(netEstimate.requirements.ram.deficitBytes, 7526);
assert.equal(netEstimate.requirements.ram.certainty, "estimate");
assert.notEqual(netEstimate.funding.net.minimumAdditionalStakeVex, null);
assert.notEqual(netEstimate.funding.net.minimumAdditionalStakeVex, "0.0000 VEX");
assert.notEqual(netEstimate.funding.net.suggestedAdditionalStakeVex, null);
assert.notEqual(netEstimate.funding.ram.estimatedPurchaseVex, null);
assert.match(netEstimate.funding.ram.estimatedPurchaseVex ?? "", / VEX$/u);

computeMode = "cpu";
const setabiActions = [
  {
    account: "vexcore",
    name: "setabi",
    data: {
      account: connected.actor,
      abi: "00".repeat(661),
    },
  },
];
const cpuEstimate = await vex.estimateResources({ actions: setabiActions });
assert.equal(cpuEstimate.status, "insufficient_resources");
assert.equal(cpuEstimate.valid, false);
assert.equal(cpuEstimate.exception?.name, "tx_cpu_usage_exceeded");
assert.equal(cpuEstimate.requirements.cpu.requiredUs, 21600);
assert.equal(cpuEstimate.requirements.cpu.availableUs, 15328);
assert.equal(cpuEstimate.requirements.cpu.deficitUs, 6272);
assert.equal(cpuEstimate.requirements.cpu.certainty, "minimum");
assert.equal(cpuEstimate.requirements.net.requiredBytes, 368);
assert.equal(cpuEstimate.requirements.ram.requiredBytes, 661);
assert.notEqual(cpuEstimate.funding.cpu.minimumAdditionalStakeVex, null);
assert.notEqual(cpuEstimate.funding.cpu.minimumAdditionalStakeVex, "0.0000 VEX");
assert.equal(cpuEstimate.funding.ram.estimatedPurchaseVex, "0.0000 VEX");

computeMode = "ram";
const ramEstimate = await vex.estimateResources({ actions: transferActions });
assert.equal(ramEstimate.status, "insufficient_resources");
assert.equal(ramEstimate.valid, false);
assert.equal(ramEstimate.exception?.name, "ram_usage_exceeded");
assert.equal(ramEstimate.requirements.ram.requiredBytes, 3504);
assert.equal(ramEstimate.requirements.ram.availableBytes, 2474);
assert.equal(ramEstimate.requirements.ram.deficitBytes, 1030);
assert.equal(ramEstimate.requirements.ram.certainty, "minimum");
assert.notEqual(ramEstimate.funding.ram.estimatedPurchaseVex, null);

const directRamQuote = quoteVexaniumRamFromMarket(1024, ramMarket);
assert.equal(directRamQuote.bytes, 1024);
assert.equal(directRamQuote.feeBps, 50);
assert.match(directRamQuote.estimatedCostVex, / VEX$/u);
assert.deepEqual(await vex.quoteRam(1024), directRamQuote);

computeMode = "execution";
await assert.rejects(
  () => vex.estimateResources({ actions: transferActions }),
  (error) => {
    assert.equal(error?.name, "VexaniumProviderError");
    assert.match(error?.message ?? "", /test failure/u);
    assert.equal(error?.data?.response?.processed?.receipt, null);
    assert.equal(error?.data?.exception?.name, "eosio_assert_message_exception");
    return true;
  },
);

await vex.disconnect();
vex.destroy();
console.log("Vexanium resource estimation tests passed");
