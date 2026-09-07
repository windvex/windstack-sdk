# WindStack SDK

WindStack provides TypeScript packages for Antelope applications, Vexanium, Wisp Wallet, EVM providers, and Solana providers.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Overview

The Antelope packages are separated by responsibility so applications can install only the capabilities they need.

| Package | Purpose |
| --- | --- |
| `@windstack/crypto` | K1 and R1 keys, Antelope key formats, signatures, verification, and public-key recovery |
| `@windstack/abi` | ABI serialization and deserialization for Antelope values, actions, tables, structs, variants, and binary extensions |
| `@windstack/rpc` | Typed Antelope chain RPC with endpoint failover, request timeouts, cancellation, and structured errors |
| `@windstack/contract` | Contract ABI loading, action serialization, table queries, and shared ABI caching |
| `@windstack/account` | Account queries, token transfers, staking actions, RAM actions, and configurable chain contracts |
| `@windstack/antelope` | Transaction construction, TAPOS, signing digests, required-key resolution, signing, and broadcast |
| `@windstack/session` | Wallet plugins, authenticated Antelope sessions, persistence, restore, and transaction orchestration |

Additional packages provide Wisp provider interfaces and chain-specific helpers for Vexanium, EVM, and Solana applications.

## Installation

Install the high-level Antelope client and session package:

```bash
npm install @windstack/antelope @windstack/session
```

Individual packages can also be installed independently.

## Usage

The example below configures Vexanium Mainnet explicitly, including its chain ID and system contracts.

```ts
import {
  AntelopeClient,
  PrivateKey,
  PrivateKeySigner,
} from "@windstack/antelope";

const client = new AntelopeClient({
  endpoints: ["https://api.windcrypto.com"],
  chainId: "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
  contracts: {
    system: "vexcore",
    token: "vex.token",
  },
});

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

Applications should keep private keys in an appropriate secure storage or signing service. A wallet integration can provide its own `Signer` implementation instead of exposing private keys to application code.

## Runtime

The Antelope packages are ESM-first and use Web-standard primitives such as `Uint8Array`, `TextEncoder`, `fetch`, `AbortController`, and secure platform randomness. Node.js 20.19 or newer is supported. Browser and React Native environments must provide the Web APIs used by the selected package.

K1 and R1 cryptographic operations are provided by the Noble libraries. The Antelope package graph does not depend on `elliptic`, `bn.js`, or Node.js crypto polyfills.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
