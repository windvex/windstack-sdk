# WindStack Supported Capabilities

## Overview

WindStack SDK 1.0.0 provides a coordinated set of packages for Vexanium, Antelope transactions, Wisp Wallet integration, EVM providers, and Solana providers.

The table below describes the capabilities available in the public 1.0.0 package set.

| Package | Supported capabilities |
| --- | --- |
| `@windstack/core` | Provider contracts, shared errors, events, browser helpers, and application metadata |
| `@windstack/crypto` | K1/R1 keys, signatures, verification, recovery, modern and Vexanium-compatible key formats |
| `@windstack/abi` | ABI primitives, structs, aliases, variants, inheritance, optionals, arrays, and binary extensions |
| `@windstack/rpc` | Vexanium and Antelope RPC reads, timeout handling, cancellation, endpoint failover, and safe transaction submission |
| `@windstack/contract` | ABI loading, caching, action serialization, contract access, and table queries |
| `@windstack/account` | VEX balances, transfers, resource operations, RAM, voting, producers, accounts, and permissions |
| `@windstack/antelope` | TAPOS, transaction serialization, signing digests, required-key discovery, signer validation, and broadcast |
| `@windstack/signing-request` | VSR/ESR parsing, encoding, compression, callbacks, chain constraints, action resolution, transactions, and identity requests |
| `@windstack/session` | Wallet plugins, login, restore, persistence, logout, and transaction orchestration |
| `@windstack/vexanium` | Vexanium chain metadata, provider access, signing-request helpers, asset utilities, and explorer links |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet discovery, account authorization, and exact Vexanium transaction signing |
| `@windstack/evm` | EIP-1193 requests, EIP-6963 discovery, chain management, accounts, and provider events |
| `@windstack/solana` | Wisp-compatible Solana provider access, accounts, requests, message signing, and provider events |

## Vexanium compatibility

WindStack 1.0.0 is validated against the current production ABIs for `vexcore` and `vex.token`.

The Vexanium Mainnet preset uses:

- Chain ID `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f`
- RPC `https://api.windcrypto.com`
- System contract `vexcore`
- Native token contract `vex.token`
- Native symbol `VEX`
- Precision `4`

## Runtime

The package set targets modern ESM environments. Node.js 20.19 or newer is supported. Browser and React Native applications can use the packages that rely on Web-standard APIs such as `fetch`, `Uint8Array`, `TextEncoder`, `AbortController`, and secure platform randomness.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
