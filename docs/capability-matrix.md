# WindStack Antelope Capability Matrix

## Overview

This matrix defines the public scope for WindStack SDK 1.0.0. It is based on Vexanium production ABIs, node RPC behavior, transaction security requirements, and the APIs used by WindCrypto wallets, explorers, dApps, bots, and services.

| Area | 1.0 classification | WindStack API | Status |
| --- | --- | --- | --- |
| K1/R1 keys, recoverable signatures, WIF and legacy K1 input | MUST HAVE | `@windstack/crypto` | Complete |
| ABI primitives, structs, aliases, variants, extensions and inheritance | MUST HAVE | `@windstack/abi` | Complete |
| `vexcore` and `vex.token` production ABI compatibility | MUST HAVE | ABI fixture and live gates | Complete |
| Safe node RPC reads, endpoint failover and non-retried broadcast | MUST HAVE | `@windstack/rpc` | Complete |
| ABI cache, action encoding and account/symbol/numeric table scopes | MUST HAVE | `@windstack/contract` | Complete |
| Common token, resource, voting, producer, account and permission operations | MUST HAVE | `@windstack/account` | Complete |
| Generic contract action escape hatch | MUST HAVE | `Contract.action()` and `AccountClient.systemAction()` | Complete |
| TAPOS, digest, context-free data, required keys and signer validation | MUST HAVE | `@windstack/antelope` | Complete |
| Strict Vexanium preset | MUST HAVE | `@windstack/antelope/vexanium` | Complete |
| Wallet login, restore, logout, persistence and signer abstraction | MUST HAVE | `@windstack/session` | Complete |
| Wisp provider integration with native sessions | MUST HAVE | `@windstack/wallet-plugin-wisp` | Complete |
| Portable VSR/ESR compatibility for existing applications | MUST HAVE at compatibility boundary | `@windstack/vexanium` adapter | Retained and tested |
| Additional typed node RPC endpoints | SHOULD HAVE | Add only from demonstrated application use | Evaluated per consumer migration |
| Generated contract bindings | SHOULD HAVE | Application build tooling | Outside the core runtime |
| Native VSR/ESR parser, resolver and identity proof implementation | FUTURE / OPTIONAL | Separate audited module | Deferred until full protocol vectors and resolution behavior are covered |
| High-level wrappers for every system-administration action | NOT NEEDED | Use generic actions | Intentionally omitted |
| Indexed history APIs | NOT NEEDED in chain RPC | Use an indexer client | Outside node RPC scope |

The portable signing-request boundary remains deliberately separate from the seven native packages. Those packages do not import or depend on WharfKit. A future native implementation must cover action, transaction and identity requests; chain constraints; TAPOS placeholders; callbacks; broadcast flags; compression; QR/deep links; parsing; encoding; and resolution before replacing the compatibility adapter.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
