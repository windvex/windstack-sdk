# WindStack SDK

WindStack provides TypeScript packages for Vexanium and Antelope applications, Wisp Wallet, EVM providers, and Solana providers.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Overview

The Vexanium and Antelope packages are separated by responsibility so applications can install only the capabilities they need.

| Package | Purpose |
| --- | --- |
| `@windstack/crypto` | K1 and R1 keys, signatures, verification, recovery, and Vexanium-compatible key encoding |
| `@windstack/abi` | ABI serialization and deserialization for actions, tables, structs, variants, and binary extensions |
| `@windstack/rpc` | Chain RPC with endpoint failover, request timeouts, cancellation, and structured errors |
| `@windstack/contract` | Contract ABI loading, action serialization, table queries, and shared ABI caching |
| `@windstack/account` | VEX balances, transfers, staking, RAM, voting, producers, accounts, and permissions |
| `@windstack/antelope` | TAPOS, transaction serialization, signing digests, required keys, signing, and broadcast |
| `@windstack/session` | Wallet plugins, sessions, persistence, restore, and transaction orchestration |

Vexanium Mainnet is available as a first-class preset with the canonical chain ID, RPC endpoint, `vexcore` system contract, `vex.token` native token contract, `VEX` symbol, and precision `4`.

Additional packages provide Wisp provider interfaces and chain-specific helpers for VEX Native, VEX EVM, and Solana wallet integrations.

## Installation

Install the high-level transaction client and session package:

```bash
npm install @windstack/antelope @windstack/session
```

Individual packages can also be installed independently.

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

Applications should keep private keys in an appropriate secure storage or signing service. Wallet integrations can provide their own `Signer` implementation so application code never receives private-key material.

## Runtime

The seven release packages are ESM-first and use Web-standard primitives such as `Uint8Array`, `TextEncoder`, `fetch`, `AbortController`, and secure platform randomness. Node.js 20.19 or newer is supported. Browser and React Native environments must provide the Web APIs used by the selected package.

K1 and R1 cryptographic operations are provided by the Noble libraries. The seven-package transaction stack does not depend on `elliptic`, `bn.js`, or Node.js crypto polyfills.

Release validation checks package metadata, formatting, documentation, dependency boundaries, tests, package contents, and the current production ABIs for `vexcore` and `vex.token`.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
