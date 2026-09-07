# @windstack/session

## Overview

`@windstack/session` provides wallet-session orchestration for Antelope applications. It connects wallet plugins to `@windstack/antelope`, binds sessions to a full chain ID, persists session identity, supports wallet-assisted restore, exposes account and contract helpers, and routes transactions through the signer returned by the selected wallet plugin.

Applications can provide their own storage adapter for browser storage, React Native secure storage, database-backed sessions, or another persistence layer.

## Installation

```bash
npm install @windstack/session
```

## Usage

```ts
import { SessionKit } from "@windstack/session";

const sessionKit = new SessionKit({
  appName: "My Vexanium App",
  chains: [
    {
      id: "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
      url: "https://api.windcrypto.com",
      contracts: {
        system: "vexcore",
        token: "vex.token",
      },
    },
  ],
  walletPlugins: [myWalletPlugin],
  storage: mySessionStorage,
});

const session = await sessionKit.login();
const transfer = await session
  .account()
  .transfer("bob", "1.0000 VEX", "WindStack");

await session.transact({ actions: [transfer] });
```

A wallet plugin implements `login()` and returns a validated identity plus an Antelope `Signer`. Plugins can optionally implement `restore()` and `logout()` to reconnect an existing wallet session and release wallet-side state.

Stored session data contains identity and routing information, not private keys. Invalid or malformed stored data is ignored instead of being treated as a valid session.

## Security

Chain IDs, identities, plugin IDs, and signer interfaces are validated before a session becomes active. If persistence fails after wallet login, the plugin is logged out as a rollback. Logout clears local state even when wallet-side logout fails.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native applications can provide storage implementations appropriate for their security model.

Each session constructs an Antelope client bound to the configured chain ID, so an endpoint that reports another chain is rejected before signing.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
