# Changelog

## Overview

Release history for the WindStack package set.

### 2.2.0 — 2026-09-12

- Added wallet-authoritative cold session restore through VexaniumProvider `1.1.0` and the explicit non-interactive `vex_restoreSession` method.
- Persisted opaque wallet session identifiers through `@windstack/session` login, restore, logout, stale-session cleanup, and identity/session mismatch guards.
- Updated `@windstack/wallet-plugin-wisp` so restored signing and disconnect use the authoritative wallet session identifier across recreated application runtimes.
- Added `createWispTelegramTransport()` to `@windstack/wallet-plugin-wisp` for Telegram DApp connection, cold restore, VSR signing, transactions, disconnect, and Telegram return navigation through one reusable transport.
- Made persisted Telegram session data a restore pointer rather than a live connection: `connected()`, `getSessionId()`, accounts, signing, and transactions require a session validated in the current runtime, while startup restore remains non-interactive.
- Added typed `WispTelegramAlreadyConnectedError`, `WispTelegramNotConnectedError`, and `WispTelegramRestoreRequiredError` exports so consumers can handle connection state explicitly without parsing error strings.
- Aligned Telegram disconnect with wallet-connection lifecycle semantics by clearing live local connection state and requesting authoritative wallet-side revocation with the captured opaque session pointer.
- Bound Telegram signing requests to the restored wallet session, exact DApp origin, Vexanium chain, account, and permission while keeping persisted DApp state limited to an opaque session pointer and public account metadata.
- Added optional `telegramReturnUrl` transport policy for Telegram Mini Apps. It accepts only credential-free `https://t.me/` targets and remains separate from DApp identity and session authorization.
- Added multi-action Telegram transaction handling that resolves all actions into one canonical VSR and opens exactly one wallet handoff, preserving one review, one signature flow, and one broadcast.
- Added regression coverage for recreated-client restore, revoked-session cleanup, unrestored pointers, duplicate connect rejection, cold-start signing guards, Telegram return targets, and one-handoff multi-action transactions across the supported Node.js compatibility matrix.

### 2.1.1 — 2026-09-11

- Made signing-request action resolution deterministic in wire order so failures identify the exact contract action and position.
- Added WindSwap liquidity regression coverage for one VSR containing `swapv2.wind::opendepo`, VEX transfer, and WIND transfer actions.
- Added single-action `swapv2.wind::withdraw` regression coverage and deterministic ABI-resolution failure assertions.

### 2.1.0 — 2026-09-10

- Added canonical transaction deserialization with size and count limits plus canonical round-trip verification.
- Preserved structured transactions through Vexanium wallet signing so complete multi-action transactions can be reviewed before approval.
- Added structured transaction and serialized context-free-data fields to exact signing with byte-for-byte consistency checks.
- Added high-level Vexanium transaction APIs for ABI-aware action construction, wallet authorization, TAPOS preparation, signing, and optional broadcast.
- Updated client-bound VSR creation to use the configured Vexanium RPC and ABI cache.
- Added VSR action inspection and ABI-aware decoding for single-action, multi-action, and full-transaction requests.
- Added ABI request deduplication for concurrent action resolution and shared ABI caching.
- Restricted Vexanium-facing signing-request and exact-signing operations to VSR and the configured Vexanium chain.
- Updated signing-request revision selection to use the minimum compatible protocol revision for each request.
- Strengthened provider capability negotiation, chain and session validation, malformed transaction handling, and wallet response validation.

### 2.0.0 — 2026-09-07

- Added application-neutral APIs across the WindStack package set.
- Added exact decimal, basis-point, constant-product, multi-hop, and proportional liquidity math.
- Added exact extended-asset parsing, token identity, and checked precision conversion.
- Corrected asset validation to enforce Antelope's `±(2^62−1)` amount range.
- Added legacy `VEX` public-key parsing/output and required-key equivalence with supported modern and legacy K1 encodings.
- Added public TAPOS extraction and transaction ID calculation.
- Added endpoint chain verification, strict RPC response checks, Spring transaction status, and Hyperion fallback.
- Added keosd HTTP signing and a Node-only Unix-socket transport.
- Added generic EVM address and chain helpers plus a chain-verified JSON-RPC client.
- Added VEX EVM reserved native bridge address and calldata decoding utilities.
- Added `vex.evm::evmtx` v1/v3 and `vex.evm::pushtx` action decoding with exact uint64 fields.
- Removed the lossy `assetToNumber` API. Use `formatDecimal` or bigint units instead.
- Moved the Vexanium Antelope preset to `@windstack/vexanium/antelope`; use `createVexaniumAntelopeClient` for the chain-bound Antelope client.
- Added generic `ProviderRpcError`, `ProviderLike`, `ChainScope`, and `ProviderSession` APIs.
- Moved VEX EVM chain metadata to `@windstack/vexanium`.
- Consolidated Vexanium asset handling around exact primitives from `@windstack/abi` and typed history responses from `@windstack/rpc`.
- Updated EIP-6963 wallet selection so a wallet is preferred only when `preferredRdns` is explicitly supplied.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
