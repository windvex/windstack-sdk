# WindStack SDK

WindStack provides TypeScript packages for Vexanium and Antelope applications, Wisp Wallet, EVM providers, and Solana providers.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Overview

WindStack 1.0.0 is a coordinated package set. Applications can install only the capabilities they need while keeping provider contracts, transaction formats, signing behavior, and chain configuration consistent across the stack.

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

Vexanium Mainnet is available as a first-class preset with the canonical chain ID, RPC endpoint, `vexcore` system contract, `vex.token` native token contract, `VEX` symbol, and precision `4`.

## Installation

Install the high-level Antelope transaction and session packages:

```bash
npm install @windstack/antelope @windstack/session
```

For portable Vexanium signing requests:

```bash
npm install @windstack/signing-request
```

Individual packages can be installed independently.

## Usage

```ts
import {
  PrivateKey,
  PrivateKeySigner,
} from "@windstack/antelope";
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

## Runtime

The thirteen WindStack 1.0.0 packages are ESM-first and use Web-standard primitives such as `Uint8Array`, `TextEncoder`, `fetch`, `AbortController`, and secure platform randomness. Node.js 20.19 or newer is supported. Browser and React Native environments must provide the Web APIs used by the selected package.

K1 and R1 cryptographic operations are provided by the Noble libraries. The WindStack 1.0.0 dependency graph does not require `elliptic`, `bn.js`, or Node.js crypto polyfills.

Release validation checks package metadata, formatting, documentation, dependency boundaries, regression tests, package contents, dependency audit results, and the current production ABIs for `vexcore` and `vex.token`.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
