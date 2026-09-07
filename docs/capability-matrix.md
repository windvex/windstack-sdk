# WindStack Supported Capabilities

## Overview

WindStack SDK 2.0.0 provides a coordinated, general-purpose package set for Antelope, Vexanium, EVM, Solana, signing, exact assets, and protocol math.

The table below describes the capabilities available in the public 2.0.0 package set.

| Package | Supported capabilities |
| --- | --- |
| `@windstack/core` | Provider errors/events, exact decimal and basis-point operations, AMM quotes/routes, and liquidity math |
| `@windstack/crypto` | K1/R1 keys, canonical signatures, WIF, recovery, and equivalent `VEX`/`EOS`/modern key formats |
| `@windstack/abi` | ABI codec, names, exact assets, extended assets, token identity, and checked precision conversion |
| `@windstack/rpc` | Strict Antelope RPC, verified failover, cancellation, Spring states, Hyperion history, and safe submission |
| `@windstack/contract` | ABI loading, caching, action serialization, contract access, and table queries |
| `@windstack/account` | Token balances/transfers, resource operations, RAM, voting, producers, accounts, and permissions |
| `@windstack/antelope` | TAPOS, transaction serialization/digest/id, required keys, signer validation, keosd, and broadcast |
| `@windstack/signing-request` | VSR/ESR parsing, encoding, compression, callbacks, chain constraints, action resolution, transactions, and identity requests |
| `@windstack/session` | Wallet plugins, login, restore, persistence, logout, and transaction orchestration |
| `@windstack/vexanium` | Vexanium metadata, provider access, signing requests, bridge primitives, VEX EVM transaction-action decoding, and explorer links |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet discovery, account authorization, and exact Vexanium transaction signing |
| `@windstack/evm` | Address/chain normalization, verified JSON-RPC, EIP-1193 requests, EIP-6963 discovery, and events |
| `@windstack/solana` | Solana provider access, account normalization, requests, message signing, and provider events |

## Vexanium compatibility

WindStack 2.0.0 is validated against the current production ABIs for `vexcore` and `vex.token`.

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
