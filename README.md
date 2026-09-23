# WindStack SDK

<p align="center">
  <img src="docs/assets/windstack-sdk.png" width="128" height="128" alt="WindStack SDK icon">
</p>

[![npm](https://img.shields.io/npm/v/@windstack/vexanium?label=npm)](https://www.npmjs.com/package/@windstack/vexanium) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D20.19.0-brightgreen.svg)](package.json)

## Overview

WindStack is a modular TypeScript SDK for Vexanium applications and reusable blockchain primitives.

For Vexanium applications, `@windstack/vexanium` provides the primary high-level client for wallet connection, account and contract access, ABI-aware transactions, Vexanium Signing Requests (VSR), explorer routes, and VEX EVM utilities.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Install

```bash
npm install @windstack/vexanium
```

Use the lower-level packages only when your application needs direct access to a specific primitive such as RPC, ABI serialization, signing requests, sessions, or Antelope transaction handling.

## Quick start

```ts
import { createVexaniumClient } from "@windstack/vexanium";

const vex = await createVexaniumClient({
  dapp: {
    name: "Example App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

const account = await vex.connectOne();

const result = await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "Example transfer",
      },
    },
  ],
});

console.log(result.response);
```

`transact()` accepts structured action data and handles ABI encoding, wallet authorization, TAPOS preparation, transaction serialization, signing, and optional broadcast.

## Multi-action transactions

Pass multiple actions in the same `actions` array. Action order and authorization are preserved through signing.

```ts
await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "First action",
      },
    },
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "0.5000 VEX",
        memo: "Second action",
      },
    },
  ],
});
```

Wallets receive the canonical transaction bytes together with the matching structured transaction so every action can be reviewed before approval.

## Vexanium Signing Request

Portable signing requests use VSR and the `vsr:` URI scheme.

```ts
const uri = await vex.createSigningRequest({
  broadcast: true,
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      authorization: [{ actor: account.actor, permission: account.permission }],
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "VSR example",
      },
    },
  ],
});

const request = vex.parseSigningRequest(uri);
```

## Resource estimation

Vexanium transactions can be evaluated before broadcast to measure the connected account's CPU, NET, and RAM requirements and estimate the VEX needed to cover any deficit.

```ts
const estimate = await vex.estimateResources({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "",
      },
    },
  ],
});

console.log(estimate.status);
console.log(estimate.requirements.cpu);
console.log(estimate.requirements.net);
console.log(estimate.requirements.ram);
console.log(estimate.funding.cpu.suggestedAdditionalStakeVex);
console.log(estimate.funding.net.suggestedAdditionalStakeVex);
console.log(estimate.funding.ram.estimatedPurchaseVex);
```

`estimateResources()` uses Antelope transaction computation without broadcasting state changes. Account resource exhaustion is returned as `status: "insufficient_resources"` with structured requirements instead of being treated as a generic execution failure. CPU and NET funding estimates are derived from the account's current stake and live resource capacity, while RAM purchase estimates use the current `vexcore::rammarket` state.

Requirements include a `certainty` field. A completed compute result is `exact`; a resource limit reached during execution can produce a `minimum` requirement; deployment RAM inferred from native `setcode` or `setabi` sizing is an `estimate`; and resources that cannot yet be determined are `unknown`. Non-resource transaction failures still reject normally.

## Configure RPC

WindStack includes Vexanium Mainnet defaults. A different trusted Vexanium RPC endpoint can be supplied through the same client API:

```ts
const vex = await createVexaniumClient({
  rpcUrl: "https://my-vexanium-rpc.example",
});
```

The configured RPC is used consistently for account access, contracts, ABI loading, transaction preparation, VSR creation, and broadcasting.

## Vexanium Mainnet

| Setting | Value |
| --- | --- |
| Chain ID | `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f` |
| RPC | `https://api.windcrypto.com` |
| System contract | `vexcore` |
| Native token contract | `vex.token` |
| Native symbol and precision | `VEX`, `4` |
| VEX EVM chain ID | `6736` (`0x1a50`) |

## Packages

| Package | Purpose |
| --- | --- |
| `@windstack/vexanium` | High-level Vexanium client, chain metadata, VSR, explorer and VEX EVM utilities |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet integration for `@windstack/session` |
| `@windstack/session` | Wallet session management and signer orchestration |
| `@windstack/antelope` | Antelope transaction preparation, TAPOS, signing, broadcast and keosd support |
| `@windstack/contract` | ABI-aware contract actions and table queries |
| `@windstack/account` | Account, token, resource, governance and permission operations |
| `@windstack/abi` | ABI codec, names, assets, symbols and action serialization |
| `@windstack/rpc` | Typed Antelope RPC, endpoint verification, finality and history |
| `@windstack/crypto` | K1/R1 keys, signatures, verification and recovery |
| `@windstack/core` | Shared provider types, exact numeric utilities and AMM math |
| `@windstack/signing-request` | VSR encoding, parsing, resolution, inspection and callbacks |
| `@windstack/evm` | Generic EVM RPC and wallet-provider utilities |
| `@windstack/solana` | Generic Solana browser-wallet provider utilities |

## Security

WindStack validates chain identity, transaction encoding, wallet capabilities, ABI payloads, signatures, numeric bounds, and other protocol-sensitive inputs at the relevant API boundaries.

Broadcast requests are not automatically retried when submission status is uncertain. Applications should reconcile transaction state before resubmitting.

## Runtime

WindStack is ESM-first. Packages that support Node.js require Node.js 20.19 or newer. Browser-facing packages use standard Web APIs, and Node-specific keosd Unix-socket transport is exposed separately.

## Documentation

- [Vexanium application guide](packages/vexanium/README.md)
- [Supported capabilities](docs/capability-matrix.md)
- [VexaniumProvider v1 specification](VEXANIUM-PROVIDER-V1.md) — for wallet and provider implementers
- [Release changes](CHANGELOG.md)
- Package-level API guides under `packages/*/README.md`

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
