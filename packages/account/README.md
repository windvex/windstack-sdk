# @windstack/account

## Overview

`@windstack/account` provides account reads and Vexanium-compatible account action builders. It supports account queries, VEX balances, token transfers, CPU and NET staking, unstaking, RAM operations, refunds, producer voting, proxy voting, producer registration, reward claims, account creation, and permission management.

System and token contract names are supplied by the parent client. The Vexanium preset uses `vexcore` for system actions and `vex.token` for the native `VEX` token.

## Installation

```bash
npm install @windstack/account
```

The account helper is normally created by `@windstack/antelope` so RPC, ABI caching, chain identity, and Vexanium contract configuration are shared automatically.

## Usage

```ts
import { createVexaniumClient } from "@windstack/antelope/vexanium";

const client = createVexaniumClient();
const account = client.account("alice");

const balances = await account.balance(undefined, "VEX");
const transfer = await account.transfer("bob", "1.0000 VEX", "WindStack");
const stake = await account.delegate("alice", "1.0000 VEX", "2.0000 VEX");
const unstake = await account.undelegate("alice", "1.0000 VEX", "1.0000 VEX");
const buyRam = await account.buyRam("alice", "5.0000 VEX");
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

Producer voting rejects duplicates and accepts at most 30 producer accounts, matching the Vexanium system contract. `clearVote()` removes the current direct producer or proxy selection.

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

The package also exposes `deletePermission()`, `linkPermission()`, `unlinkPermission()`, `createAccount()`, `registerProxy()`, `unregisterProducer()`, `claimRewards()`, `refund()`, `buyRamSelf()`, and `buyRamBytes()`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Network requests are delegated to `@windstack/rpc`; ABI loading and action serialization are delegated to `@windstack/contract` and `@windstack/abi`.

Action builders return serialized contract actions. They do not broadcast transactions themselves. Signing and broadcast are performed by `@windstack/antelope` or a compatible session layer.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
