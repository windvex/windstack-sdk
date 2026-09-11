# Wisp Persistent Session — SSOT Checkpoint

## Overview

This file is the single source of truth for the Wisp persistent-session rollout across WindStack, Wisp Wallet Telegram, Telegram Mini Apps, and consumer dApps such as WindSwap.

Baseline before this work: `windvex/windstack-sdk` `main` at `bbd69a8` (`2.1.1`).

Current WindStack SDK phase: **100%** once the containing commit is on `main`.

Current end-to-end rollout: **35%**. The protocol/client foundation is complete in WindStack; the authoritative wallet-side session registry and Telegram transport still belong in `windvex/wisp-wallet-telegram`.

Created by **Gilang Ramadan**.

## Non-negotiable architecture

Persistent connection, trusted-dApp policy, wallet vault unlock, and transaction signing approval are separate states.

- WindStack owns the generic connection/session protocol and consumer API.
- Wisp Wallet owns authoritative authorization, expiry, revocation, vault state, and signing policy.
- A dApp may persist only an opaque wallet-issued session identifier plus public connection metadata.
- A dApp never receives a wallet password, PIN, decrypted private key, or signing secret.
- Restore is non-interactive. It must never silently fall back to a new `vex_requestAccounts` authorization.
- A revoked, expired, unknown, origin-mismatched, account-mismatched, permission-mismatched, or chain-mismatched session must fail closed.
- Restoring a connection does not imply silent transaction signing.
- Multi-action Vexanium transactions remain one canonical structured transaction, one review/signing request, one signature flow, and one broadcast.
- WindSwap and other consumers must not add Wisp-specific compatibility, ABI-rebuild, transaction-rebuild, or session-reconstruction helpers.

## Official reference baseline

The design is based on official platform documentation, not inferred behavior:

- TON Connect SDK: `restoreConnection()` restores an existing connection, while transaction requests remain separate — https://docs.ton.org/applications/ton-connect/api-reference/sdk
- TON Connect core concepts: dApp and wallet retain corresponding session state; revoked/unknown sessions cannot be restored — https://docs.ton.org/applications/ton-connect/core-concepts
- TON Connect get started / manifest and storage model — https://docs.ton.org/applications/ton-connect/get-started
- Telegram Mini Apps: authorization data must use validated `initData`; `initDataUnsafe` is not a trust boundary — https://core.telegram.org/bots/webapps
- OKX Wallet Connect SDK for Telegram: Telegram return/deep-link strategy and connection restoration are transport/session concerns — https://web3.okx.com/build/dev-docs/sdks/app-connect-evm-ui

The Wisp wire format remains a WindStack/Wisp protocol. The references above define the architectural patterns, not a claim that Wisp implements TON Connect or OKX protocols.

## 0–100% rollout

### 0–10% — Reference and threat model — DONE

- Verified official TON Connect persistent connection/restore behavior.
- Verified official Telegram Mini App trust boundary.
- Verified official OKX Telegram return/restore patterns.
- Defined connection restore as distinct from unlock and signing approval.

### 10–20% — Vexanium provider protocol — DONE

- Bumped VexaniumProvider v1 minor protocol from `1.0.0` to `1.1.0`.
- Added explicit `vex_restoreSession`.
- Restore requires a wallet-issued opaque `sessionId`.
- Restore is explicitly non-interactive and cannot create a new authorization.
- Provider must return the same session ID and chain or fail.
- Older v1 providers remain major-version compatible; lack of the restore method means cold restore is unavailable rather than emulated.

### 20–30% — WindStack durable session state — DONE

- `@windstack/session` persists optional `walletSessionId`.
- Wallet session ID is propagated through login, restore, logout, and the runtime `Session`.
- Malformed session IDs are discarded.
- Identity mismatch or wallet-session-ID mismatch clears stale storage and fails closed.
- `restore()` returning `null` clears stale persisted state.
- Legacy generic wallet plugins without `walletSessionId` remain supported.

### 30–35% — Wisp wallet plugin cold restore — DONE

- `@windstack/wallet-plugin-wisp` records the authoritative Wisp session ID after interactive connect.
- A fresh Wisp client can call `vex_restoreSession` using persisted opaque session state.
- Restored signing explicitly includes the wallet session ID and does not depend on the old JavaScript runtime.
- Revoked/disconnected/unsupported old providers return a non-restorable session instead of silently opening Connect.
- Cold-restored logout revokes the wallet session even when the fresh client has no in-memory connection object.
- Regression coverage verifies cold restart, no interactive reconnect, revoke cleanup, and logout.

### 35–60% — Wisp Wallet Telegram authoritative registry — NEXT

Target repo: `windvex/wisp-wallet-telegram`.

Implement the provider side of `vex_restoreSession`:

- Generate cryptographically secure opaque session IDs during approved `vex_requestAccounts`.
- Persist wallet-side authorization records keyed by session ID.
- Bind each record to authoritative dApp/transport origin, chain, actor, permission, and granted capabilities.
- Track `createdAt`, `lastUsedAt`, `expiresAt`, and revocation state.
- Validate restore against wallet-owned state; never trust dApp-supplied origin metadata.
- Return exactly the previously authorized account/permission/chain.
- Make `vex_disconnect` revoke the wallet-side record.
- Expired/revoked/unknown sessions return the appropriate provider error.
- Keep vault lock state separate from dApp connection state.
- Do not store decrypted private keys or passwords in session records.

Acceptance gate: close/reopen the TMA or recreate the dApp JavaScript runtime and restore the same authorized connection without showing the Connect approval again.

### 60–75% — Telegram Mini App transport/return — PENDING

Target repo: `windvex/wisp-wallet-telegram`.

- Preserve request/session correlation across Telegram navigation.
- Implement Telegram-aware return behavior comparable in purpose to official OKX TMA return strategies.
- Treat return/deep links only as routing; never as proof of authorization.
- Validate Telegram `initData` where Telegram identity is used.
- Do not use `initDataUnsafe` as an authentication or wallet-session trust anchor.
- Ensure duplicate callbacks or reopened views cannot replay an already-consumed request.

Acceptance gate: connect/sign → Wisp → return to the originating TMA without losing the authorized Wisp connection.

### 75–90% — Trusted dApp and unlock policy — PENDING

Target repo: `windvex/wisp-wallet-telegram`.

- Define wallet-authoritative trusted-dApp policy separately from connection restore.
- Use a visible user grant such as “remember this dApp/session”; a dApp can never set itself trusted.
- Keep wallet lock/unlock timeout separate from connection lifetime.
- Low-risk trusted flows may avoid redundant connection approval and redundant password entry while the wallet remains unlocked.
- Sensitive actions always force appropriate wallet review/policy.
- No unrestricted arbitrary auto-signing.

Sensitive examples include permission/auth changes, code/ABI deployment, unknown/undecodable action data, and transactions outside configured wallet policy.

### 90–100% — Consumer and end-to-end release — PENDING

Targets: Wisp Wallet Telegram + WindSwap integration tests; WindSwap source should remain a clean WindStack consumer unless a genuine consumer bug is found.

- Consumer startup calls WindStack restore before deciding that the wallet is disconnected.
- If restore fails cleanly, show Connect.
- Swap remains single-action where applicable.
- Add Liquidity remains one ordered structured multi-action transaction.
- Verify session restore does not mutate or rebuild transaction actions.
- Verify account switch, permission switch, chain mismatch, expiry, revoke, logout, Telegram close/reopen, and hard reload.
- Verify no password/private-key/session secret leaks into dApp storage.
- Verify production deployment and `git pull --ff-only origin main` path.

100% means first connect is explicit, later valid connection restore is seamless, signing remains wallet-controlled, and no consumer-side compatibility workaround exists.

## WindStack 2.2.0 release gate

The WindStack commit containing this file must satisfy:

- coordinated `2.2.0` package versions and internal dependency pins;
- VexaniumProvider `1.1.0` canonical spec;
- build + typecheck;
- provider specification regression;
- generic session lifecycle regression;
- Wisp cold-session restore regression;
- existing single-action and WindSwap multi-action signing-request regressions;
- package/release guard;
- dependency audit gates.

No manual GitHub workflow is required for the VPS update. After this checkpoint is committed to `main`, a deployment host should only need:

```bash
cd /path/to/windstack-sdk
git pull --ff-only origin main
```

## Next implementation entry point

Do not continue by changing WindSwap.

Continue at the Wisp provider boundary in `windvex/wisp-wallet-telegram`, implementing the wallet-side handler and authoritative storage for `vex_restoreSession` according to this file and `VEXANIUM-PROVIDER-V1.md`.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
