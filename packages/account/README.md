# @windstack/account

## Overview

`@windstack/account` provides account reads and common Antelope account action builders. It supports account queries, token balances and transfers, resource staking, RAM operations, refunds, producer voting, account creation, and permission management.

System and token contract names are supplied by the parent client. No chain, contract, symbol, or permission is selected implicitly for sensitive operations.

## Installation

```bash
npm install @windstack/account
```

The account helper is normally created by `@windstack/antelope` so RPC, ABI caching, and chain identity are shared automatically. Chain presets may supply the appropriate system and token contracts.

## Usage

```ts
import { AntelopeClient } from "@windstack/antelope";

const client = new AntelopeClient({
  endpoints: "https://node.example",
  chainId: "00".repeat(32),
  contracts: { system: "system", token: "token" },
});
const account = client.account("alice");

const balances = await account.balance(undefined, "TKN");
const transfer = await account.transfer("bob", "1.0000 TKN", "example");
const stake = await account.delegate("alice", "1.0000 TKN", "2.0000 TKN");
const unstake = await account.undelegate("alice", "1.0000 TKN", "1.0000 TKN");
const buyRam = await account.buyRam("alice", "5.0000 TKN");
const sellRam = await account.sellRam(4096);
```

### Voting and producer actions

```ts
const vote = await account.voteProducers([
  "producerone",
  "producertwo",
]);

const proxyVote = await account.voteProxy("myproxy");
const registerProxy = await account.registerProxy(true);

const producer = await account.registerProducer(
  "PUB_K1_...",
  "https://producer.example",
  0,
);
```

Producer voting rejects duplicates and accepts at most 30 producer accounts. `clearVote()` removes the current direct producer or proxy selection.

### Account permissions

Permission changes require the authorization permission to be supplied explicitly. The helper does not guess whether `owner`, `active`, or another permission is appropriate for a sensitive account change.

```ts
await account.updatePermission(
  "custom",
  "active",
  {
    threshold: 1,
    keys: [{ key: "PUB_K1_...", weight: 1 }],
    accounts: [],
    waits: [],
  },
  "active",
);
```

The package also exposes `deletePermission()`, `linkPermission()`, `unlinkPermission()`, `createAccount()`, `registerProxy()`, `unregisterProxy()`, `unregisterProducer()`, `claimRewards()`, `refund()`, `buyRamSelf()`, and `buyRamBytes()`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Network requests are delegated to `@windstack/rpc`; ABI loading and action serialization are delegated to `@windstack/contract` and `@windstack/abi`.

Action builders return serialized contract actions. They do not broadcast transactions themselves. Signing and broadcast are performed by `@windstack/antelope` or a compatible session layer.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
