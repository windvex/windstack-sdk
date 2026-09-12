# @windstack/wallet-plugin-wisp

## Overview

`@windstack/wallet-plugin-wisp` connects WindStack applications to Wisp Wallet on Vexanium Mainnet. It supports the injected Vexanium provider used by browser wallets and the Wisp Telegram handoff transport used by web applications that open Wisp as a Telegram Mini App.

The injected-wallet plugin selects the Wisp provider identified by `com.wisp.wallet` unless a provider or client is supplied explicitly. The Telegram transport keeps the same wallet-authoritative session model without exposing private keys or requiring application-specific compatibility helpers.

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

const session = (await sessionManager.restore()) ?? (await sessionManager.login());

const action = await session
  .account()
  .transfer("bob", "1.0000 VEX", "Example transfer");

await session.transact({
  actions: [action],
});

// Revokes the wallet session before removing the local session pointer.
await sessionManager.logout();
```

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

const session = (await wisp.restore()) ?? (await wisp.connect());
console.log(session.account.permissionLevel);
console.log(session.accounts, session.chainId, session.capabilities);

const result = await wisp.transact(vex, {
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: session.account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "Example transfer",
      },
    },
  ],
});

console.log(result.transactionId);

// Revokes the Wisp-authoritative session before clearing local storage.
await wisp.disconnect();
```

`connect()` stores only the opaque wallet session id and public account/session metadata. `restore()` asks Wisp to revalidate that exact session against the DApp origin, Vexanium chain, account, permission, expiry, and revocation state. When Wisp already knows the session, restore completes from the authoritative session registry without opening the wallet Mini App. Local storage is only a pointer and is never treated as proof that authorization is still valid.

`disconnect()` revokes the Wisp-authoritative session first and only then clears the local pointer. `clearSession()` is deliberately lower level and only resets the local cache; applications should normally use `disconnect()`.

`getAccounts()`, `getChain()`, and `getCapabilities()` expose the current connection scope without application-specific adapters. Telegram Mini Apps use Telegram's native link-opening API when available; non-Telegram browsers use the browser fallback.

`transact()` accepts one or more structured Vexanium actions, resolves them through the configured `VexaniumClient`, creates one canonical VSR, opens one Wisp signing handoff, and returns the wallet-broadcast transaction id. Multi-action transactions are never split into independent signatures.

For an existing VSR, use `signSigningRequest(vsr)` directly. The Telegram transport requires an active wallet session and binds every signing handoff to that session id, origin, chain, account, and permission.

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

Optional fields are `description`, `termsOfUseUrl`, and `privacyPolicyUrl`. All URLs must use credential-free HTTPS, and the manifest `url` origin must exactly match the origin requesting the Wisp connection. The wallet fetches and validates this manifest independently before presenting a standard DApp connection.

DApps that are already marked verified in Wisp's bundled registry use that wallet-owned registry entry as the identity anchor. A manifest can never mark itself verified or trusted. Trusted-session privileges remain wallet-owned policy.

This follows the same security purpose as the TON Connect app manifest: the DApp cannot freely substitute the name/icon displayed by the wallet at approval time.

## Runtime

The package targets browser and Telegram Mini App consumers. Injected Wisp providers use the Vexanium provider bridge. External Wisp Telegram flows use the public Wisp handoff API plus Telegram-native link opening when the Telegram WebApp runtime is present.

Persistent restore does not depend on an old JavaScript runtime remaining alive. The consumer keeps an opaque session pointer, while Wisp validates authoritative session state. A valid restore can therefore complete after a hard reload or later runtime without reopening the wallet; an expired, revoked, or mismatched session fails closed.

The runtime never stores private keys or wallet unlock secrets. Vault unlock and transaction approval remain wallet-owned even while a DApp connection is restored.

## Security model

A persistent DApp connection is separate from wallet unlock and transaction approval. Restoring a session does not unlock the vault and does not grant silent signing. Wisp remains responsible for secure unlock, review UI, signing policy, revocation, and session expiry.

Application-supplied display metadata is not an authorization source. Wisp resolves approval identity from its wallet-owned verified registry or from the independently fetched origin manifest described above. Wallet authorization is then bound to the wallet-issued session and exact DApp origin.

A chain other than Vexanium Mainnet is rejected. The package never stores private keys.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
