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

const session = await sessionManager.restore() ?? await sessionManager.login();

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

## Security model

A persistent DApp connection is separate from wallet unlock and transaction approval. Restoring a session does not unlock the vault and does not grant silent signing. Wisp remains responsible for secure unlock, review UI, signing policy, revocation, and session expiry.

Applications should provide accurate DApp metadata, but display metadata is not an authorization source. Wallet authorization is bound to the wallet-issued session and exact DApp origin.

A chain other than Vexanium Mainnet is rejected. The package never stores private keys.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
