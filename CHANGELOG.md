# Changelog

## Overview

### 2.1.0 — 2026-09-10

- Added canonical transaction deserialization with size/count limits and canonical round-trip verification.
- Preserved structured transactions through the Wisp exact-signing boundary so wallets can inspect complete multi-action transactions without rebuilding them from opaque bytes.
- Added structured transaction and serialized context-free-data fields to exact signing, with byte-for-byte transaction consistency checks before wallet approval.
- Added first-class Vexanium client transaction helpers for ABI-aware action construction, default wallet authorization, TAPOS preparation, signing, and optional broadcast.
- Added client-bound VSR creation that reuses the configured Vexanium RPC and ABI cache instead of relying on a separate hidden RPC source.
- Added unified VSR action inspection and ABI-aware decoding for single action, multi-action, and full-transaction request forms.
- Added ABI request deduplication for concurrent multi-action resolution and strengthened shared ABI caching behavior.
- Made Vexanium-facing signing requests VSR-only and restricted creation, parsing, signing, and exact transaction signing to the configured Vexanium chain.
- Changed signing-request revision selection to use the minimal compatible protocol revision instead of forcing revision 3 for ordinary fixed-chain requests.
- Strengthened provider capability negotiation, chain/session guards, malformed transaction handling, and wallet response validation.
- Added multi-contract regression coverage using `vex.token` and `token.wind`, including repeated-contract ABI deduplication.
- Updated the public Vexanium SDK documentation around the primary `configure → connect → interact` application flow.

### 2.0.0 — 2026-09-07

- Repositioned WindStack as a general-purpose SDK with application-neutral public APIs.
- Added exact decimal, basis-point, constant-product, multi-hop, and proportional liquidity math.
- Added exact extended-asset parsing, token identity, and checked precision conversion.
- Corrected asset validation to enforce Antelope's `±(2^62−1)` amount range.
- Added legacy `VEX` public-key parsing/output and required-key equivalence with `EOS` and `PUB_K1`.
- Added public TAPOS extraction and transaction ID calculation.
- Added endpoint chain verification, strict RPC response checks, Spring transaction status, and Hyperion fallback.
- Added keosd HTTP signing and a Node-only Unix-socket transport.
- Added generic EVM address/chain helpers and a chain-verified JSON-RPC client.
- Added VEX EVM reserved native bridge address and calldata decoding primitives.
- Added strict `vex.evm::evmtx` v1/v3 and `vex.evm::pushtx` action decoding with exact uint64 fields.
- Removed the lossy `assetToNumber` API. Use `formatDecimal` or bigint units.
- Moved the Vexanium Antelope preset from `@windstack/antelope/vexanium` to `@windstack/vexanium/antelope`; use `createVexaniumAntelopeClient` for the chain-bound Antelope client.
- Replaced product-prefixed core provider errors and session types with generic `ProviderRpcError`, `ProviderLike`, `ChainScope`, and `ProviderSession` APIs.
- Moved VEX EVM chain metadata out of `@windstack/evm`; use `vexEvm` from `@windstack/vexanium`.
- Removed duplicate Vexanium asset utilities and application-facing explorer models; use exact asset primitives from `@windstack/abi` and raw typed history responses from `@windstack/rpc`.
- Changed EIP-6963 selection so a wallet is preferred only when `preferredRdns` is explicitly supplied.
- Strengthened release version drift, coordinated dependency, tarball, Node 24, and no-silent-skip publish gates.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
