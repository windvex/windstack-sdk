# Changelog

## Overview

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
