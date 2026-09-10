# WindStack SDK

[![Build](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml/badge.svg)](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml)

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
