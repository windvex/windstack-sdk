# @windstack/wallet-plugin-wisp

## Overview

`@windstack/wallet-plugin-wisp` connects WindStack applications to Wisp Wallet on Vexanium Mainnet. It supports the injected Vexanium provider used by browser wallets and the Wisp Telegram handoff transport used by web applications that open Wisp as a Telegram Mini App.

The injected-wallet plugin selects the Wisp provider identified by `com.wisp.wallet` unless a provider or client is supplied explicitly. The Telegram transport keeps the same wallet-authoritative session model without exposing private keys or requiring application-specific compatibility helpers.

Connection restore and interactive connection are deliberately separate. Applications should try `restore()` during startup, finish that state transition, and only call `connect()` from an explicit user action when no valid session was restored. A persisted session pointer is never treated as a live connection before restore succeeds.

## Installation

```bash
npm install @windstack/wallet-plugin-wisp @windstack/vexanium
```

## Usage

### Browser provider

```ts
import { SessionManager } from "@windstack/session";
import { vexNative } from "@windstack/vexanium";
import { WispWalletPlugin } from "@windstack/wallet-plugin-wisp";

const sessionManager = new SessionManager({
  appName: "Example App",
  chains: [
    {
      id: vexNative.chainId,
      url: vexNative.rpcUrl,
      contracts: vexNative.contracts,
    },
  ],
  walletPlugins: [new WispWalletPlugin()],
});

// Startup: finish restore before rendering the disconnected/connect state.
const restoredSession = await sessionManager.restore();

if (restoredSession) {
  console.log("Restored", restoredSession.identity);
}

// User action only, for example inside a Connect Wallet button handler.
async function connectWisp() {
  return sessionManager.login();
}

async function transfer(session = restoredSession) {
  if (!session) throw new Error("Connect Wisp before transacting");

  const action = await session
    .account()
    .transfer("bob", "1.0000 VEX", "Example transfer");

  return session.transact({ actions: [action] });
}

// User disconnect action. Revokes the wallet session and clears local state.
async function disconnectWisp() {
  await sessionManager.logout();
}
```

Do not write `restore() ?? login()` during application bootstrap. A failed/empty restore means the application is disconnected; it does not mean the application has permission to open an interactive wallet connection automatically.

The plugin signs the canonical transaction resolved by the session and returns the wallet signatures to `@windstack/session`. Structured transaction data is retained for wallet review while the canonical serialized bytes remain the authoritative signing payload.

### Telegram transport

Use the WindStack-owned Telegram transport instead of implementing connect, polling, session persistence, VSR construction, restore, or disconnect logic inside the DApp.

```ts
import { createVexaniumClient } from "@windstack/vexanium";
import { createWispTelegramTransport } from "@windstack/wallet-plugin-wisp";

const vex = await createVexaniumClient({
  dapp: {
    name: "Example App",
    url: window.location.origin,
  },
});

const wisp = createWispTelegramTransport({
  apiUrl: "https://api.windcrypto.com",
  dapp: {
    name: "Example App",
    origin: window.location.origin,
    url: window.location.href,
    icon: `${window.location.origin}/icon.png`,
  },
});

// Startup: restore first and wait for the authoritative result.
const restored = await wisp.restore();
console.log("connected", wisp.connected());

if (restored) {
  console.log(restored.account.permissionLevel);
  console.log(await wisp.getSessionId());
  console.log(await wisp.getAccounts());
}

// User action only. Do not call this automatically because restore returned null.
async function connectWisp() {
  const session = await wisp.connect();
  console.log(session.account.permissionLevel);
  return session;
}

async function transfer() {
  return wisp.transact(vex, {
    actions: [
      {
        account: "vex.token",
        name: "transfer",
        data: {
          from: (await wisp.getAccounts())[0]?.actor,
          to: "bob",
          quantity: "1.0000 VEX",
          memo: "Example transfer",
        },
      },
    ],
  });
}

async function disconnectWisp() {
  await wisp.disconnect();
}
```

`connect()` is interactive and creates a new wallet authorization. It rejects when a live session is already connected, and it also rejects when a persisted pointer still needs `restore()` so an application cannot accidentally replace an unresolved session.

`restore()` is the startup/session-recovery operation. It asks Wisp to validate the exact persisted session against DApp origin, Vexanium chain, account, permission, expiry, and revocation state. When Wisp already knows the session, restore completes from the authoritative session registry without opening the wallet Mini App. If the session is expired, revoked, or mismatched, restore returns no active session and clears the stale pointer. It never falls back to `connect()`.

`connected()` and `getSession()` describe only the session validated in the current runtime. `getSessionId()` and `getAccounts()` likewise expose only the active restored/connected session. `getStoredSession()` is intentionally lower-level: it may return an opaque persisted pointer with `validatedAt: 0`, which is not proof that the wallet is currently connected.

`signSigningRequest()` and `transact()` require an active session in the current runtime. After a hard reload, call `restore()` before signing. They never promote a local storage pointer into a connected session implicitly.

`disconnect()` transitions the DApp to disconnected local state immediately using the captured opaque session pointer, then requests authoritative wallet-side revocation. A known already-invalid/revoked session is treated as disconnected. Other transport failures are surfaced to the application; the local runtime nevertheless remains disconnected and must not silently reuse the old pointer. `clearSession()` is deliberately lower level and only resets the local cache; applications should normally use `disconnect()`.

`getChain()` and `getCapabilities()` describe the transport's supported Vexanium scope. Telegram Mini Apps use Telegram's native link-opening API when available; non-Telegram browsers use the browser fallback.

`transact()` accepts one or more structured Vexanium actions, resolves them through the configured `VexaniumClient`, creates one canonical VSR, opens one Wisp signing handoff, and returns the wallet-broadcast transaction id. Multi-action transactions are never split into independent signatures.

For an existing VSR, use `signSigningRequest(vsr)` directly after a successful `connect()` or `restore()`. The Telegram transport binds every signing handoff to that session id, origin, chain, account, and permission.

### DApp identity manifest

For Telegram connections, DApp-provided `name`, `icon`, and `description` are hints only. Wisp does not treat those fields as authoritative identity.

A standard DApp must publish a public manifest at:

```text
https://your-dapp.example/wisp-wallet-manifest.json
```

Minimum manifest:

```json
{
  "url": "https://your-dapp.example",
  "name": "Example App",
  "iconUrl": "https://your-dapp.example/icon-180.png"
}
```

Optional fields are `description`, `termsOfUseUrl`, and `privacyPolicyUrl`. All URLs must use credential-free HTTPS, and the manifest `url` origin must exactly match the origin requesting the Wisp connection.

The manifest must be available through an unauthenticated public `GET` request and must be reachable by the Wisp wallet web runtime. Configure CORS so the wallet can fetch the JSON; do not require cookies, bearer tokens, Telegram `initData`, or other DApp-session credentials to read the manifest.

DApps that are already marked verified in Wisp's bundled registry use that wallet-owned registry entry as the identity anchor. A manifest can never mark itself verified or trusted. Trusted-session privileges remain wallet-owned policy.

This follows the same security purpose as the TON Connect app manifest: identity shown for connection approval is resolved independently from arbitrary labels inside a connect request. Wisp uses its own WindStack/Wisp wire protocol and does not claim TON Connect wire compatibility.

## Runtime

The package targets browser and Telegram Mini App consumers. Injected Wisp providers use the Vexanium provider bridge. External Wisp Telegram flows use the public Wisp handoff API plus Telegram-native link opening when the Telegram WebApp runtime is present.

Persistent restore does not depend on an old JavaScript runtime remaining alive. The consumer keeps an opaque session pointer, while Wisp validates authoritative session state. A valid restore can therefore complete after a hard reload or later runtime without reopening the wallet; an expired, revoked, or mismatched session fails closed.

A DApp should model at least these UI states:

```text
restoring -> connected
restoring -> disconnected
user connect -> connecting -> connected
connected -> signing/review -> connected
disconnecting -> disconnected
```

Do not show the Connect action until the startup restore attempt has settled. Do not treat connection as wallet unlock, and do not treat connection as transaction approval.

The runtime never stores private keys or wallet unlock secrets. Vault unlock and transaction approval remain wallet-owned even while a DApp connection is restored.

## Security model

A persistent DApp connection is separate from wallet unlock and transaction approval. Restoring a session does not unlock the vault and does not grant silent signing. Wisp remains responsible for secure unlock, review UI, signing policy, revocation, and session expiry.

Application-supplied display metadata is not an authorization source. Wisp resolves approval identity from its wallet-owned verified registry or from the independently fetched origin manifest described above. Wallet authorization is then bound to the wallet-issued session and exact DApp origin.

A chain other than Vexanium Mainnet is rejected. The package never stores private keys.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
