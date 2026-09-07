# @windstack/rpc

## Overview

`@windstack/rpc` provides a typed client for Antelope chain RPC endpoints. It supports multiple endpoints, automatic failover for retriable read failures, request timeouts, `AbortSignal` cancellation, injected `fetch`, structured RPC errors, block queries, table queries, account queries, ABI queries, currency queries, required-key resolution, and transaction submission.

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
});

const info = await rpc.getInfo();
const account = await rpc.getAccount("alice");
const rows = await rpc.getTableRows({
  code: "vex.token",
  scope: "alice",
  table: "accounts",
});
```

HTTP request errors are exposed through `RpcError`. Timeouts use `RpcTimeoutError`. Invalid chain requests are returned immediately instead of being retried across every configured endpoint.

## Security

Read requests retry only failures that may be transient. `push_transaction` is never retried automatically, because losing the response does not prove that the node rejected the transaction. Callers should reconcile an uncertain result before choosing to submit again.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses the standard `fetch`, `Response`, `AbortController`, and `AbortSignal` interfaces. A compatible `fetch` implementation can be supplied through the constructor when the runtime does not provide one globally.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
