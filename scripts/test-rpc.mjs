/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import {
  RpcClient,
  RpcError,
  RpcResponseError,
  RpcTimeoutError,
  extractTransactionResourceUsage,
} from "../packages/rpc/dist/index.js";

const requests = [];
const rpc = new RpcClient({
  endpoints: ["https://one.test/", "https://one.test", "https://two.test"],
  fetch: async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({
      chain_id: "00".repeat(32),
      head_block_num: 1,
      last_irreversible_block_num: 1,
      head_block_id: "00".repeat(32),
      head_block_time: "2026-09-07T00:00:00.000",
    });
  },
});
assert.deepEqual(rpc.endpoints, ["https://one.test", "https://two.test"]);
await rpc.getInfo();
assert.equal(requests[0].url, "https://one.test/v1/chain/get_info");

let attempts = 0;
const failover = new RpcClient({
  endpoints: ["https://bad.test", "https://good.test"],
  fetch: async (input) => {
    attempts += 1;
    if (String(input).startsWith("https://bad.test")) {
      return Response.json({ message: "temporary failure" }, { status: 503 });
    }
    return Response.json({
      chain_id: "00".repeat(32),
      head_block_num: 1,
      last_irreversible_block_num: 1,
      head_block_id: "00".repeat(32),
      head_block_time: "2026-09-07T00:00:00.000",
    });
  },
});
assert.equal((await failover.getInfo()).head_block_num, 1);
assert.equal(attempts, 2);

attempts = 0;
const invalidRequest = new RpcClient({
  endpoints: ["https://a.test", "https://b.test"],
  fetch: async () => {
    attempts += 1;
    return new Response("invalid request", { status: 400 });
  },
});
await assert.rejects(
  () => invalidRequest.getInfo(),
  (error) => error instanceof RpcError && error.status === 400,
);
assert.equal(attempts, 1);

attempts = 0;
const invalidJson = new RpcClient({
  endpoints: "https://json.test",
  retries: 1,
  fetch: async () => {
    attempts += 1;
    return attempts === 1
      ? new Response("not-json", { status: 200 })
      : Response.json({
          chain_id: "00".repeat(32),
          head_block_num: 1,
          last_irreversible_block_num: 1,
          head_block_id: "00".repeat(32),
          head_block_time: "2026-09-07T00:00:00.000",
        });
  },
});
assert.equal((await invalidJson.getInfo()).head_block_num, 1);
assert.equal(attempts, 2);

const invalidJsonNoRetry = new RpcClient({
  endpoints: "https://json.test",
  retries: 0,
  fetch: async () => new Response("not-json", { status: 200 }),
});
await assert.rejects(() => invalidJsonNoRetry.getInfo(), RpcResponseError);

const malformedRows = new RpcClient({
  endpoints: ["https://bad-rows.test", "https://good-rows.test"],
  fetch: async (input) =>
    String(input).startsWith("https://bad-rows.test")
      ? Response.json({ rows: {}, more: false })
      : Response.json({ rows: [], more: false }),
});
assert.deepEqual(
  await malformedRows.getTableRows({ code: "token", scope: "alice", table: "accounts" }),
  { rows: [], more: false },
);

const malformedBalance = new RpcClient({
  endpoints: "https://balance.test",
  retries: 0,
  fetch: async () => Response.json([1]),
});
await assert.rejects(
  () => malformedBalance.getCurrencyBalance("token", "alice"),
  /array of strings/,
);

const timeoutRpc = new RpcClient({
  endpoints: "https://timeout.test",
  timeoutMs: 5,
  retries: 0,
  fetch: async (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        {
          once: true,
        },
      );
    }),
});
await assert.rejects(() => timeoutRpc.getInfo(), RpcTimeoutError);

const controller = new AbortController();
const reason = new Error("caller cancelled");
controller.abort(reason);
await assert.rejects(
  () => rpc.getInfo(controller.signal),
  (error) => error === reason,
);

attempts = 0;
const pushRpc = new RpcClient({
  endpoints: ["https://a.test", "https://b.test"],
  retries: 5,
  fetch: async () => {
    attempts += 1;
    return Response.json({ message: "uncertain broadcast result" }, { status: 503 });
  },
});
await assert.rejects(
  () => pushRpc.pushTransaction({ signatures: [], packed_trx: "00" }),
  /uncertain broadcast result/,
);
assert.equal(attempts, 1, "push_transaction must never retry automatically");
await assert.rejects(
  () => pushRpc.sendTransaction({ signatures: [], packed_trx: "00" }),
  /uncertain broadcast result/,
);
assert.equal(attempts, 2, "send_transaction must never retry automatically");
await assert.rejects(
  () => pushRpc.sendTransaction2({ signatures: [], packed_trx: "00" }),
  /uncertain broadcast result/,
);
assert.equal(attempts, 3, "send_transaction2 must never retry automatically");

const computeRequests = [];
const computeRpc = new RpcClient({
  endpoints: "https://compute.test",
  fetch: async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    computeRequests.push(body);
    return Response.json({
      transaction_id: "ab".repeat(32),
      processed: {
        receipt: { status: "executed", cpu_usage_us: 320, net_usage_words: 20 },
        elapsed: 320,
        net_usage: 160,
        scheduled: false,
        action_traces: [
          {
            account_ram_deltas: [{ account: "alice", delta: 240 }],
            inline_traces: [
              { account_ram_deltas: [{ account: "contract", delta: -16 }] },
            ],
          },
        ],
      },
    });
  },
});
const computed = await computeRpc.computeTransaction({ signatures: [], packed_trx: "00" });
assert.deepEqual(computeRequests[0], {
  transaction: {
    compression: 0,
    packed_context_free_data: "",
    signatures: [],
    packed_trx: "00",
  },
});
assert.deepEqual(extractTransactionResourceUsage(computed), {
  status: "executed",
  cpuUs: 320,
  cpuMs: 0.32,
  netWords: 20,
  netBytes: 160,
  ramDeltaBytes: 224,
  ramByAccount: { alice: 240, contract: -16 },
});

assert.throws(
  () => new RpcClient({ endpoints: ["https://same.test", "https://same.test"], retries: -1 }),
  /non-negative integer/,
);

console.log("RPC resilience tests passed");
