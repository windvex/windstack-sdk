# WindStack SDK

[![Build](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml/badge.svg)](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml)

WindStack is a general-purpose, ESM-first TypeScript SDK for Antelope chains, Vexanium, EVM providers, Solana providers, signing requests, exact asset arithmetic, and reusable protocol math.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Overview

Packages are independently installable and tree-shakeable. Generic primitives do not depend on a particular wallet, explorer, bot, DEX, token registry, or application state.

| Package | Purpose |
| --- | --- |
| `@windstack/core` | Provider errors/events, exact decimals, basis points, constant-product quotes, routes, and liquidity math |
| `@windstack/crypto` | K1/R1 keys and canonical signatures, WIF, recovery, and `VEX`/`EOS`/`PUB_K1` compatibility |
| `@windstack/abi` | Antelope ABI/binary codec, names, exact assets, extended assets, token identity, and precision conversion |
| `@windstack/rpc` | Typed Antelope RPC, verified endpoint failover, Spring finality, and Hyperion history |
| `@windstack/contract` | ABI caching, contract actions, and table queries |
| `@windstack/account` | Generic Antelope token, resource, governance, account, and permission actions |
| `@windstack/antelope` | TAPOS, transaction serialization/digest/id, signers, required keys, broadcast, and keosd |
| `@windstack/signing-request` | Portable ESR/VSR actions, transactions, identity requests, callbacks, compression, and resolution |
| `@windstack/session` | Runtime-neutral Antelope signer/session and wallet-plugin orchestration |
| `@windstack/evm` | Addresses, chain IDs, verified JSON-RPC, EIP-1193 clients, and EIP-6963 discovery |
| `@windstack/solana` | Solana provider discovery and account/client utilities |
| `@windstack/vexanium` | Vexanium presets, VEX EVM bridge and contract-action decoding, provider protocol, and explorer routes |
| `@windstack/wallet-plugin-wisp` | Optional Wisp Wallet adapter for the generic session API |

## Installation

Install only the packages needed by an application:

```bash
npm install @windstack/antelope @windstack/rpc
npm install @windstack/core @windstack/evm
npm install @windstack/vexanium
```

## Usage

Exact values and protocol math never require floating point:

```ts
import {
  parseDecimal,
  quoteConstantProduct,
  quoteConstantProductMinimum,
} from "@windstack/core";

const amountIn = parseDecimal("10.0000", 4);
const quote = quoteConstantProduct({
  reserveIn: 1_000_000n,
  reserveOut: 2_000_000n,
  amountIn,
  feeBps: 30,
});
const minimum = quoteConstantProductMinimum(quote, 50);
```

Build and sign an Antelope transaction with a network-specific client:

```ts
import { PrivateKey } from "@windstack/antelope";
import {
  createVexaniumAntelopeClient,
  createVexaniumPrivateKeySigner,
} from "@windstack/vexanium/antelope";

const client = createVexaniumAntelopeClient();
const signer = createVexaniumPrivateKeySigner([
  PrivateKey.fromString("PVT_K1_..."),
]);

const transfer = await client
  .account("alice")
  .transfer("bob", "1.0000 VEX", "example");

await client.transact({ actions: [transfer], signer });
```

The Vexanium signer announces legacy K1 keys with the native `VEX` prefix. The parser and required-key flow treat equivalent `VEX…`, `EOS…`, and `PUB_K1_…` strings as the same key.

## Vexanium Mainnet

| Setting | Value |
| --- | --- |
| Chain ID | `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f` |
| RPC | `https://api.windcrypto.com` |
| System contract | `vexcore` |
| Native token contract | `vex.token` |
| Native symbol and precision | `VEX`, `4` |
| VEX EVM chain ID | `6736` (`0x1a50`) |

Vexanium-specific presets and the reserved `0xbbbb…` native bridge address format live in `@windstack/vexanium`; generic EVM behavior remains in `@windstack/evm`.

## Runtime

Node.js 20.19, 22, and 24 are covered by CI. Browser-safe entrypoints use Web APIs and do not import Node built-ins. Unix-socket keosd support is isolated behind `@windstack/antelope/node`.

## Reliability

Read failover verifies every endpoint against the configured chain ID before use. Broadcast calls never retry automatically. RPC payloads, required keys, signatures, large integers, checksums, bridge calldata, and finality states are validated before acceptance. All public packages ship ESM, source maps, and declaration files.

## Documentation

- [Release changes](CHANGELOG.md)
- [Supported capabilities](docs/capability-matrix.md)
- [VexaniumProvider v1](VEXANIUM-PROVIDER-V1.md)
- Package-level API guides under `packages/*/README.md`

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
