# WindStack Consumer Migration Guide

## Overview

This guide tracks known WindCrypto applications that can move to WindStack SDK 1.0.0. It separates SDK-level capabilities from application-specific work so migrations can be completed without broad search-and-replace changes.

| Repository | Main requirement | WindStack replacement | Status |
| --- | --- | --- | --- |
| `windstack-sdk` | Vexanium values, signing requests and wallet sessions | Native WindStack packages | Migrated and tested |
| `wisp-wallet` | VSR/ESR, identity flow, ABI resolution and transaction signing | `@windstack/signing-request`, `@windstack/contract`, `@windstack/antelope`, `@windstack/session` | SDK requirements complete; application migration ready after 1.0.0 publish |
| `wisp-wallet-telegram` | VSR/ESR, identity flow, ABI resolution and transaction signing | `@windstack/signing-request`, `@windstack/contract`, `@windstack/antelope`, `@windstack/session` | SDK requirements complete; application migration ready after 1.0.0 publish |
| `explorer-wind` | Wallet session, VSR, ABI and packed transaction handling | `@windstack/session`, `@windstack/signing-request`, `@windstack/contract`, `@windstack/crypto` | Ready for controlled migration; packed transaction convenience remains application-specific |
| `wind-swap-v2` | RPC, ABI cache, actions and wallet sessions | `@windstack/rpc`, `@windstack/contract`, `@windstack/session` | Ready after 1.0.0 package installation and repository regression tests |
| `wisp-tip-bot/server` | RPC, contract access, serialization and signing | `@windstack/rpc`, `@windstack/contract`, `@windstack/crypto`, `@windstack/antelope` | Ready after contract-specific regression tests |
| `wind-realms` | Authentication signatures and chain transactions | `@windstack/crypto`, `@windstack/abi`, `@windstack/rpc`, `@windstack/antelope` | Ready for coordinated client/server migration |
| `wisp-backend` | Rewards, account creation and signed transactions | `@windstack/crypto`, `@windstack/account`, `@windstack/antelope` | Ready for transaction API adaptation |
| `wind-wallet-web-vue` | RPC, contracts, account resources, VSR and REX/resource flows | WindStack 1.0 packages | SDK core is ready; REX/PowerUp application flows require repository-local validation |
| Maintained wallet forks | Wallet provider, values, VSR and transaction flows | WindStack 1.0 packages | Migrate only maintained source trees after ownership is confirmed |
| `wisp-dapp-examples` | RPC and ABI cache | `@windstack/rpc`, `@windstack/contract` | Ready after 1.0.0 package installation |
| Vexanium EVM miner services | Private signer and resource operations | `PrivateKeySigner`, `AntelopeClient`, account helpers | Core SDK ready; specialized operational logic remains application-specific |

The WindStack 1.0.0 package set now covers the recurring SDK-level requirements discovered during the consumer audit, including native VSR/ESR processing and wallet sessions. Remaining work belongs to application integration, regression testing, UI approval flows, or specialized transaction composition rather than missing core SDK primitives.

Migration should be performed one repository at a time. Each consumer should update dependencies, migrate imports and public API usage, then pass its own typecheck, tests and production build before the previous dependency path is removed.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
