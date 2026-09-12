# Wisp Persistent Session — SSOT Checkpoint

## Overview

This file is the single source of truth for the Wisp persistent-session rollout across WindStack, Wisp Wallet Telegram, Telegram Mini Apps, and consumer DApps such as WindSwap.

Baseline before this work: `windvex/windstack-sdk` `main` at `bbd69a8` (`2.1.1`).

Current WindStack SDK implementation phase: **95%**. The generic session/provider/Telegram transport is implemented and covered by regression tests; publication of the coordinated `2.2.0` package set remains outside the source changes.

Current end-to-end rollout: **92%**. Wallet-authoritative restore/revocation, wallet-fetched DApp identity, trusted-session policy, Telegram request/return routing, Telegram-user session binding, biometric pre-unlock, and one-VSR multi-action signing are implemented. Remaining work is real-device TMA-to-TMA verification, WindStack `2.2.0` publication, clean WindSwap migration to the released consumer API, and production E2E.

Created by **Gilang Ramadan**.

## Non-negotiable architecture

Persistent connection, DApp identity/trust, wallet vault unlock, and transaction signing approval are separate states.

- WindStack owns the generic connection/session protocol and consumer API.
- Wisp Wallet owns authoritative authorization, expiry, revocation, vault state, DApp identity policy, and signing policy.
- A DApp persists only an opaque wallet-issued session identifier plus public connection metadata.
- A DApp never receives a wallet password, PIN, decrypted private key, or signing key.
- Restore is non-interactive. It must never silently fall back to a new account authorization for a known expired/revoked/mismatched session.
- A revoked, expired, origin-mismatched, account-mismatched, permission-mismatched, chain-mismatched, or Telegram-owner-mismatched known session fails closed.
- A pre-registry legacy session may use one migration handoff so the wallet can prove that it still owns the historical session.
- Restoring a connection does not unlock the wallet and never implies silent transaction signing.
- Disconnect means authoritative remote revocation, not merely deleting localStorage.
- Return/deep-link state is routing only and is never authorization proof.
- Multi-action Vexanium transactions remain one ordered canonical structured transaction, one VSR/review request, one approval/signing flow, and one broadcast.
- WindSwap and other consumers must not add Wisp-specific compatibility, ABI-rebuild, transaction-rebuild, polling, or session-reconstruction helpers.

## Official reference baseline

The design follows official platform semantics, not reverse-engineered behavior:

- TON Connect SDK: `restoreConnection()` is intended to run immediately on application load; successful restoration reuses the existing wallet session without a new connect prompt.
- TON Connect protocol/core concepts: a DApp and wallet retain corresponding session state; unknown/revoked sessions cannot be restored; DApp disconnect sends a wallet-side disconnect request in addition to clearing local connection state.
- TON Connect manifest: the wallet fetches public DApp identity metadata before connect so name/icon/policy information does not come only from an arbitrary connect payload.
- Telegram Mini Apps: server-side trust uses validated `initData`; `initDataUnsafe` is not an authentication boundary. Telegram also defines native Mini App link/open/close behavior including `return_back`.
- OKX Universal Connect: a successful connection exposes a session identifier plus accounts/chains/method scope, while Telegram return/deep-link configuration such as `tg://resolve` is transport rather than authorization.

The Wisp wire format remains a WindStack/Wisp protocol. This file does **not** claim TON Connect, WalletConnect, or OKX wire compatibility. The official systems are architectural references for lifecycle, scope, transport, identity, and revocation semantics.

## Target architecture

```text
WindSwap / DApp
    |
    v
WindStack consumer/session layer
    connect / restore / disconnect
    sessionId / accounts / chain / capabilities
    |
    v
Wisp Telegram transport
    launch / request-response routing / return
    |
    v
Wisp authoritative session policy
    origin + chain + account + permission + expiry + revoke + Telegram owner
```

The expected lifecycle is:

```text
FIRST CONNECT
DApp -> connect() -> wallet resolves trusted registry/public manifest identity
     -> Wisp approval -> wallet-issued session -> return to DApp

NEXT RUNTIME / NEXT DAY
DApp -> restore() -> authoritative validation -> connected immediately
(no Connect prompt when the session is still valid)

TRANSACTION
DApp actions[1..N] -> one structured transaction -> one VSR -> Wisp review
-> explicit approval -> one signing/broadcast result

DISCONNECT
DApp -> disconnect() -> authoritative wallet revoke -> local pointer cleanup
```

## 0–100% rollout

### 0–10% — Reference and threat model — DONE

- Verified official TON Connect restore, manifest, disconnect, and session-state semantics.
- Verified official Telegram Mini App trust and return boundaries.
- Verified official OKX Telegram redirect and session-scope patterns.
- Defined connection restore as separate from trust, unlock, and signing approval.

### 10–20% — Vexanium provider protocol — DONE

- VexaniumProvider `1.1.0` adds explicit `vex_restoreSession`.
- Restore requires a wallet-issued opaque `sessionId` and is non-interactive.
- Restore returns the previously authorized chain/account/session or fails.
- Old v1 providers remain major-version compatible; absent restore support is treated as unavailable, never emulated with interactive connect.

### 20–30% — WindStack durable generic session state — DONE

- `@windstack/session` persists optional `walletSessionId` and propagates it through login, restore, logout, and runtime `Session`.
- Identity/session mismatch clears stale state and fails closed.
- Cold logout invokes wallet-plugin logout with the stored identity/session ID even if the JavaScript runtime never restored an in-memory `Session` first.
- Generic session storage never contains private keys.

### 30–40% — Injected Wisp provider cold restore — DONE

- `WispWalletPlugin` records and restores the authoritative Wisp session ID.
- Restore is a first-class Vexanium client/provider operation rather than a consumer compatibility helper.
- Signing and disconnect remain bound to the restored session ID.
- Revoked/unsupported sessions return non-restorable instead of silently opening Connect.

### 40–60% — Wisp Wallet authoritative session registry — DONE

- Approved Telegram DApp connections receive cryptographically random opaque wallet session IDs.
- Wallet-side local session records bind immutable origin, chain, actor, permission, expiry, open/revoked state, and counters.
- The Wisp backend maintains a versioned durable authoritative Telegram session registry for cross-runtime validation.
- Registry entries bind exact origin, VEX Native chain ID, actor, permission, expiry, Telegram wallet user correlation, and revocation state.
- A registered session-bound Telegram handoff cannot be opened, updated, or revoked by a different authenticated Telegram user.
- Store writes are serialized and atomic; old checkpoint v1 rows migrate safely to the v2 schema.
- Known expired/revoked/mismatched sessions return immediate failure without reopening Wisp.
- Expired/revoked session tombstones are retained for a bounded period so a known invalid session cannot be mistaken for an unregistered legacy session.
- Wallet-side Settings disconnect revokes the authoritative registry before deleting local state.
- VEX DApp session chain/account/permission binding cannot be mutated or locally reactivated after revoke.

### 60–72% — WindStack Telegram transport — DONE

`createWispTelegramTransport()` owns the reusable external-Wisp flow:

- `connect()`
- `restore()`
- `disconnect()`
- `getAccounts()`
- `getChain()`
- `getCapabilities()`
- `getSession()` / persisted opaque `sessionId`
- `signSigningRequest()`
- `transact()`

Behavior:

- Only opaque session pointer + public scope/expiry metadata is stored by the DApp.
- A known valid registry session restores immediately from the authoritative result without opening Wisp Telegram.
- A known expired/revoked/mismatched session clears stale consumer state and does not fall back to interactive Connect.
- `disconnect()` revokes Wisp authorization before clearing the consumer pointer; `clearSession()` is explicitly local-only.
- Telegram environments use Telegram-native link opening when available; ordinary browsers use the browser fallback.
- Session-bound sign responses must return the same session ID and signer permission.

### 72–82% — Telegram return and request routing — IMPLEMENTED; FINAL DEVICE VERIFICATION PENDING

- Handoff requests/results use bounded opaque correlation IDs and terminal-state protection.
- Telegram identity-sensitive resolve/complete endpoints require server-validated Telegram `initData` through the existing API authentication boundary.
- Session-bound handoffs are additionally checked against the Telegram user recorded on the authoritative session.
- DApp launches identified by the `dapp_` start parameter use Telegram `WebApp.close({ return_back: true })` where Bot API 7.6+ is available.
- The return policy is centralized in the Telegram boundary so locked and already-unlocked Wisp flows cannot drift.
- Older Telegram clients fall back to normal close.
- Return/start parameters remain routing hints only; they are never accepted as session proof.
- Final production-device verification is still required for the exact WindSwap-TMA -> Wisp-TMA -> WindSwap-TMA UX. If that topology requires an explicit Telegram Mini App return identity, it must use the real DApp bot/Mini-App identity at the transport layer only.

### 82–90% — Wallet-owned DApp identity and trusted policy — DONE

- Trusted status is wallet-derived, not DApp-declared.
- Verified/active VEX Native DApps in Wisp's bundled registry use that wallet-owned entry as the identity/security anchor.
- Standard DApps must expose `https://<origin>/wisp-wallet-manifest.json`.
- Wisp fetches the standard DApp manifest independently before showing connect approval.
- Manifest `url` must have the exact requesting origin; manifest URLs use credential-free HTTPS.
- Manifest `name`, `iconUrl`, optional description/terms/privacy are display identity only and cannot self-grant verified/trusted status.
- Session-bound signing reuses the already approved session identity instead of trusting fresh DApp-supplied name/icon data.
- Mutable remote registry/cache data may enrich catalog display but cannot grant trusted privileges by itself.
- Trusted connection lifetime is separate from vault unlock lifetime.
- Verified DApps can use durable 1-day / 7-day / 30-day connection grants (default 7 days); standard DApps remain 1/6/24 hours.
- Restore/disconnect never unlock the vault.
- Only verified connect and verified session-bound sign can trigger biometric pre-unlock when biometrics are already enabled.
- Every transaction still reaches the normal review/signing policy; trusted never means arbitrary auto-sign.

### 90–95% — Transaction/session integrity regressions — DONE

- Telegram sign request carries the real wallet session ID through review and counters.
- Wisp revalidates exact session origin/chain/account/permission immediately before signing.
- Completion returns exact session ID, chain, expiry, and transaction ID.
- Multi-action transport regression proves three actions create exactly one VSR and exactly one Telegram signing handoff.
- Generic SessionManager regression covers cold restore, mismatch cleanup, revoke cleanup, storage rollback, logout failure cleanup, and cold logout remote revoke.
- Server regressions cover immediate restore, authoritative disconnect, binding mismatch, malformed session IDs, legacy migration, expired-session fail-closed tombstones, and rejection when a different Telegram user opens a session-bound signing handoff.

### 95–100% — Release, real-device E2E, and clean consumer migration — PENDING

Remaining work must stay narrow:

1. **Final TMA-to-TMA return verification.** Verify on a real Telegram client that current native launch + `return_back` returns exactly to the originating WindSwap TMA. If an explicit `tg://resolve`/TMA return target is required, configure the real WindSwap Mini App identity at the transport layer only.
2. **Publish WindStack `2.2.0`.** Source/version metadata is prepared, but GitHub tag/release and installable package publication must exist before consumers switch.
3. **Migrate WindSwap.** Remove copied Telegram handoff/session polling from WindSwap and consume the released WindStack transport directly. Do not add serializer, ABI, transaction, session, or compatibility helpers to WindSwap.
4. **Production E2E.** Verify connect -> return -> hard close/reopen -> silent restore -> Add Liquidity multi-action -> review all actions -> approve -> one broadcast -> disconnect/revoke -> restore fails cleanly.

100% means first connect is explicit, later valid connection restore is seamless, disconnect is authoritative, signing remains wallet-controlled, DApp identity is wallet-verified, the Telegram session owner is enforced, multi-action remains one transaction, and no consumer-side compatibility workaround exists.

## WindStack 2.2.0 release gate

Before publication, main must satisfy:

- coordinated `2.2.0` package versions/internal pins;
- VexaniumProvider `1.1.0` canonical spec;
- format + lint + release metadata checks;
- build + typecheck;
- Node.js 20/22/24 build/regression compatibility;
- provider/session/Telegram transport regressions;
- single-action and WindSwap multi-action signing-request regressions;
- package tarball/release dry-run checks;
- dependency audits.

## Deployment path

No consumer workaround is required on a deployment host. Source repos update with fast-forward pulls:

```bash
cd /path/to/windstack-sdk
git pull --ff-only origin main

cd /path/to/wisp-wallet-telegram
git pull --ff-only origin main
```

Do not update WindSwap to an unpublished WindStack version through a Git commit URL or local compatibility package. Wait until `2.2.0` is installable, then migrate WindSwap to the official package API.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
