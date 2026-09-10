# WindStack Supported Capabilities

## Overview

WindStack main provides a Vexanium-first SDK surface backed by modular chain primitives. Normal applications can configure one Vexanium client, connect a wallet, and interact with contracts without assembling ABI, transaction, signing-request, or provider compatibility layers themselves.

| Package | Supported capabilities |
| --- | --- |
| `@windstack/vexanium` | High-level Vexanium client, wallet connection, structured actions, multi-action transactions, shared ABI/RPC state, VSR, provider access, explorer routes, bridge primitives, and VEX EVM action decoding |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet discovery, account authorization, structured exact-transaction signing, context-free-data forwarding, and session integration |
| `@windstack/signing-request` | Native VSR encoding/parsing, minimal protocol revision selection, compression, callbacks, action inspection, ABI-aware multi-action decoding, resolution, transactions, and identity requests |
| `@windstack/antelope` | Vexanium-compatible TAPOS, transaction preparation, canonical serialization/deserialization, digest/id calculation, signers, required keys, broadcast, and keosd |
| `@windstack/contract` | ABI loading, in-flight deduplication, caching, structured action serialization, contract access, and table queries |
| `@windstack/account` | Token balances/transfers, resource operations, RAM, voting, producers, accounts, and permissions |
| `@windstack/abi` | ABI codec, names, exact assets, extended assets, token identity, and checked precision conversion |
| `@windstack/rpc` | Strict chain RPC, verified failover, cancellation, Spring states, Hyperion history, and safe submission |
| `@windstack/session` | Runtime-neutral wallet plugins, login, restore, persistence, logout, and transaction orchestration |
| `@windstack/crypto` | K1/R1 keys, canonical signatures, recovery, WIF, and modern/legacy Vexanium key handling |
| `@windstack/core` | Provider errors/events, exact decimal and basis-point operations, AMM quotes/routes, and liquidity math |
| `@windstack/evm` | Generic EVM primitives used by VEX EVM integrations, including verified JSON-RPC and provider discovery |
| `@windstack/solana` | Optional generic Solana provider primitives retained as an independently installable workspace |

## Vexanium application flow

The primary VEX Native flow is:

```text
createVexaniumClient → connect/connectOne → action/contract/account/transact
```

`transact()` performs ABI loading, action encoding, default wallet authorization, TAPOS preparation, canonical transaction serialization, exact wallet signing, and optional broadcast.

For portable signing flows:

```text
client.createSigningRequest → vsr: URI → client.parseSigningRequest/client.signSigningRequest
```

Client-bound VSR uses the same configured RPC and ABI cache as contract interaction. Vexanium-facing VSR accepts only the configured Vexanium chain.

## Multi-action signing

Multi-action transactions are first-class. WindStack preserves both canonical packed bytes and the structured transaction through the wallet-provider boundary. Wallets can inspect all actions directly instead of rebuilding transaction structure from serialized bytes.

The signing-request inspection API exposes one ABI-aware path for single action, action-array, and full-transaction request shapes while preserving action order and authorization data.

## Vexanium compatibility

The Vexanium Mainnet preset uses:

- Chain ID `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f`
- RPC `https://api.windcrypto.com`
- System contract `vexcore`
- Native token contract `vex.token`
- Native symbol `VEX`
- Precision `4`

Production ABI validation covers the Vexanium system/native-token contracts, while structured contract actions are resolved dynamically from the configured RPC rather than hardcoded per application.

## Runtime

The package set targets modern ESM environments. Node.js 20.19 or newer is supported. Browser and React Native applications can use packages that rely on Web-standard APIs such as `fetch`, `Uint8Array`, `TextEncoder`, `AbortController`, and secure platform randomness.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
