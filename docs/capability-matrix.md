# WindStack Capability Matrix

## Overview

This matrix defines the public scope for WindStack SDK 1.0.0 based on Vexanium production ABIs, node RPC behavior, and the APIs used by WindCrypto applications.

| Area | 1.0 classification | WindStack API | Status |
| --- | --- | --- | --- |
| Shared provider contracts and metadata | MUST HAVE | `@windstack/core` | Complete |
| K1/R1 keys and signatures | MUST HAVE | `@windstack/crypto` | Complete |
| ABI serialization and production ABI compatibility | MUST HAVE | `@windstack/abi` | Complete |
| Safe node RPC and endpoint failover | MUST HAVE | `@windstack/rpc` | Complete |
| Contract ABI caching, actions and table queries | MUST HAVE | `@windstack/contract` | Complete |
| Token, resource, voting, producer, account and permission helpers | MUST HAVE | `@windstack/account` | Complete |
| TAPOS, transaction serialization and signer validation | MUST HAVE | `@windstack/antelope` | Complete |
| Vexanium Mainnet preset | MUST HAVE | `@windstack/antelope/vexanium` | Complete |
| VSR/ESR parsing, encoding, compression, resolution and callbacks | MUST HAVE | `@windstack/signing-request` | Complete |
| Vexanium provider and signing-request convenience APIs | MUST HAVE | `@windstack/vexanium` | Complete |
| Wallet sessions and persistence | MUST HAVE | `@windstack/session` | Complete |
| Wisp Wallet signing integration | MUST HAVE | `@windstack/wallet-plugin-wisp` | Complete |
| EVM provider integration | MUST HAVE | `@windstack/evm` | Complete |
| Solana provider integration | MUST HAVE | `@windstack/solana` | Complete |
| Additional typed RPC endpoints | SHOULD HAVE | Add from demonstrated application use | Evaluated per consumer migration |
| Packed transaction convenience APIs | SHOULD HAVE | Add when repeated consumer use justifies a shared API | Evaluated per consumer migration |
| REX and PowerUp high-level helpers | SHOULD HAVE | Add when repeated application use is confirmed | Evaluated per consumer migration |
| Generated contract bindings | SHOULD HAVE | Application build tooling | Outside the core runtime |
| High-level wrappers for every system-administration action | NOT NEEDED | Use generic actions | Intentionally omitted |
| Indexed history APIs | NOT NEEDED in chain RPC | Use an indexer client | Outside node RPC scope |

WindStack 1.0.0 is released as a coordinated package set. Application migrations should still be performed repository by repository because transaction composition, UI approval flows, storage, and application-specific resource logic remain consumer responsibilities.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
