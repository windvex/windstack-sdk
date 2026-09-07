# WindStack SDK

[![Build](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml/badge.svg)](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml)

WindStack is a TypeScript SDK for Vexanium and Antelope applications, Wisp Wallet integrations, EVM providers, and Solana providers.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Overview

WindStack 1.0.0 provides a coordinated set of focused packages. Applications can install only the capabilities they need while keeping provider contracts, transaction formats, signing behavior, and Vexanium configuration consistent across the stack.

| Package | Purpose |
| --- | --- |
| `@windstack/core` | Shared provider contracts, errors, events, browser helpers, and application metadata |
| `@windstack/crypto` | K1 and R1 keys, signatures, verification, recovery, and Vexanium-compatible key encoding |
| `@windstack/abi` | ABI serialization and deserialization for actions, tables, structs, variants, and binary extensions |
| `@windstack/rpc` | Chain RPC with endpoint failover, request timeouts, cancellation, and structured errors |
| `@windstack/contract` | Contract ABI loading, action serialization, table queries, and shared ABI caching |
| `@windstack/account` | VEX balances, transfers, staking, RAM, voting, producers, accounts, and permissions |
| `@windstack/antelope` | TAPOS, transaction serialization, signing digests, required keys, signing, and broadcast |
| `@windstack/signing-request` | VSR/ESR parsing, encoding, compression, resolution, callbacks, and portable signing flows |
| `@windstack/session` | Wallet plugins, sessions, persistence, restore, and transaction orchestration |
| `@windstack/vexanium` | Vexanium provider client, chain metadata, signing-request helpers, and explorer utilities |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet session and Vexanium signing integration |
| `@windstack/evm` | EIP-1193 and EIP-6963 provider client for Wisp-compatible EVM applications |
| `@windstack/solana` | Solana provider client for Wisp-compatible applications |

## Installation

Install the high-level Vexanium transaction and session packages:

```bash
npm install @windstack/antelope @windstack/session
```

For portable Vexanium signing requests:

```bash
npm install @windstack/signing-request
```

For browser applications that connect to Wisp Wallet:

```bash
npm install @windstack/vexanium @windstack/wallet-plugin-wisp
```

Each package can also be installed independently.

## Usage

```ts
import { PrivateKey, PrivateKeySigner } from "@windstack/antelope";
import {
  VEXANIUM_MAINNET,
  createVexaniumClient,
} from "@windstack/antelope/vexanium";

const client = createVexaniumClient();

console.log(VEXANIUM_MAINNET.contracts.system); // vexcore
console.log(VEXANIUM_MAINNET.contracts.token); // vex.token
console.log(VEXANIUM_MAINNET.nativeToken.symbol); // VEX

const signer = new PrivateKeySigner([
  PrivateKey.fromString("PVT_K1_..."),
]);

const transfer = await client
  .account("alice")
  .transfer("bob", "1.0000 VEX", "WindStack");

const result = await client.transact({
  actions: [transfer],
  signer,
});

console.log(result.response);
```

Applications should keep private keys in appropriate secure storage or a signing service. Wallet integrations can provide their own `Signer` implementation so application code never receives private-key material.

## Vexanium Mainnet

| Setting | Value |
| --- | --- |
| Chain ID | `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f` |
| RPC | `https://api.windcrypto.com` |
| System contract | `vexcore` |
| Native token contract | `vex.token` |
| Native symbol | `VEX` |
| Precision | `4` |

## Runtime

WindStack is ESM-first and uses Web-standard primitives such as `Uint8Array`, `TextEncoder`, `fetch`, `AbortController`, and secure platform randomness.

Node.js 20.19 or newer is supported. Browser and React Native environments must provide the Web APIs required by the selected package.

K1 and R1 cryptographic operations are provided by the Noble libraries. The WindStack 1.0.0 dependency graph does not require `elliptic`, `bn.js`, or Node.js crypto polyfills.

## Reliability

WindStack is covered by package-level and regression tests for cryptography, ABI serialization, RPC behavior, contract and account operations, Antelope transactions, VSR/ESR requests, provider contracts, wallet sessions, and Vexanium production ABI compatibility.

The Vexanium compatibility checks use the current `vexcore` and `vex.token` production ABIs and read-only Mainnet RPC calls.

## Documentation

- [Supported capabilities](docs/capability-matrix.md)
- [VexaniumProvider v1](VEXANIUM-PROVIDER-V1.md)

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
