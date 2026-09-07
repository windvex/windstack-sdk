# @windstack/rpc

## Overview

`@windstack/rpc` provides typed Antelope node RPC, chain-verified endpoint failover, request timeouts, cancellation, strict response validation, Spring/Savanna transaction state, and Hyperion-compatible history.

Broadcast requests are not automatically retried because a transaction may already have reached the chain even when the original network response is lost.

## Installation

```bash
npm install @windstack/rpc
```

## Usage

```ts
import { RpcClient } from "@windstack/rpc";

const rpc = new RpcClient({
  endpoints: [
    "https://api.windcrypto.com",
    "https://backup.example",
  ],
  timeoutMs: 10_000,
  maxResponseBytes: 4 * 1024 * 1024,
  expectedChainId: "0123...64 hexadecimal characters...",
});

const info = await rpc.getInfo();
const account = await rpc.getAccount("alice");
const rows = await rpc.getTableRows({
  code: "vex.token",
  scope: "alice",
  table: "accounts",
});
```

Recent finality is read from Spring and historical lookup falls back to Hyperion only when Spring reports `UNKNOWN` or explicitly does not support the status API:

```ts
import { AntelopeTransactionHistory, HyperionClient, SpringFinalityClient } from "@windstack/rpc";

const history = new AntelopeTransactionHistory(
  new SpringFinalityClient(rpc),
  new HyperionClient({ endpoint: "https://history.example" }),
);
const observation = await history.getTransaction(transactionId, signal);
```

HTTP request errors are exposed through `RpcError`; chain mismatches use `RpcChainMismatchError`; timeouts use `RpcTimeoutError`. Custom RPC paths do not retry unless marked `{ retry: "safe" }`.

## Security

Read requests retry only failures that may be transient. `push_transaction` is never retried automatically, because losing the response does not prove that the node rejected the transaction. Callers should reconcile an uncertain result before choosing to submit again.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses the standard `fetch`, `Response`, `AbortController`, and `AbortSignal` interfaces. A compatible `fetch` implementation can be supplied through the constructor when the runtime does not provide one globally.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
