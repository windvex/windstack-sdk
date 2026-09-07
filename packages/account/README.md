# @windstack/account

## Overview

`@windstack/account` provides account reads and common Antelope account actions. It supports account queries, token balances, token transfers, CPU/NET staking actions, RAM purchases, RAM sales, and refund action construction.

System and token contract names are configured explicitly so the same package can be used safely across Antelope chains with different system account names.

## Installation

```bash
npm install @windstack/account
```

## Usage

The account helper is normally created by `@windstack/antelope`, which passes the chain contract configuration automatically.

```ts
import { AntelopeClient } from "@windstack/antelope";

const client = new AntelopeClient({
  endpoints: "https://api.windcrypto.com",
  contracts: {
    system: "vexcore",
    token: "vex.token",
  },
});

const account = client.account("alice");
const balances = await account.balance(undefined, "VEX");
const transfer = await account.transfer("bob", "1.0000 VEX", "WindStack");
const stake = await account.delegate("alice", "1.0000 VEX", "2.0000 VEX");
```

If a token or system contract has not been configured, helpers that depend on it fail before building an action. Applications can also pass a token contract directly for individual token operations.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Network requests are delegated to `@windstack/rpc`, and action serialization is delegated to `@windstack/contract` and `@windstack/abi`.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
