# @windstack/contract

## Overview

`@windstack/contract` provides ABI-aware contract access for Antelope applications. It loads contract ABIs, caches them with a configurable TTL, serializes action data, validates account/action/authorization names, and exposes table-row queries through the shared RPC client.

`ContractKit` can be used when several contracts should share the same RPC connection and ABI cache.

## Installation

```bash
npm install @windstack/contract @windstack/rpc
```

## Usage

```ts
import { ContractKit } from "@windstack/contract";
import { RpcClient } from "@windstack/rpc";

const rpc = new RpcClient({ endpoints: "https://node.example" });
const contracts = new ContractKit(rpc);
const token = await contracts.load("token.cntrct");

const action = await token.action(
  "transfer",
  {
    from: "alice",
    to: "bob",
    quantity: "1.0000 TKN",
    memo: "example",
  },
  ["alice@active"],
);

const rows = await token.tableRows("accounts", "alice");
```

Concurrent ABI reads that use the same `AbiCache` share one in-flight request, including reads from different `Contract` instances. Use `refreshAbi()` for an explicit refresh and `deleteAbi()` or `AbiCache.clear()` when an application knows a contract has changed.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Runtime network behavior is provided by `@windstack/rpc`, while action encoding is provided by `@windstack/abi`.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
