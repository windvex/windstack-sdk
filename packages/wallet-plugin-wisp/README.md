# @windstack/wallet-plugin-wisp

## Overview

`@windstack/wallet-plugin-wisp` connects SessionKit applications to Wisp Wallet on Vexanium Mainnet. It handles wallet discovery, account authorization, exact transaction signing, chain validation, and conversion of wallet signatures into the format expected by the connected session.

The plugin is restricted to Vexanium Mainnet and selects the Wisp provider identified by `com.wisp.wallet` unless a provider or client is supplied explicitly.

## Installation

```bash
npm install @windstack/wallet-plugin-wisp
```

## Usage

```ts
import { SessionKit } from "@wharfkit/session";
import { WispWalletPlugin } from "@windstack/wallet-plugin-wisp";
import { vexNative } from "@windstack/vexanium";

const sessionKit = new SessionKit({
  appName: "My Vexanium App",
  chains: [{ id: vexNative.chainId, url: vexNative.rpcUrl }],
  walletPlugins: [new WispWalletPlugin()],
});

const { session } = await sessionKit.login();

await session.transact({
  action: {
    account: "vex.token",
    name: "transfer",
    authorization: [session.permissionLevel],
    data: {
      from: session.actor,
      to: "receiver",
      quantity: "1.0000 VEX",
      memo: "WindStack",
    },
  },
});
```

The session resolves the Vexanium transaction before signing. The plugin forwards the exact serialized transaction bytes to Wisp through the Vexanium provider and returns the resulting signatures to the session.

A different chain ID is rejected during both login and signing. Portable Vexanium Signing Requests are handled separately by `@windstack/vexanium`.

## Runtime

The package targets browser applications with Wisp Wallet available through the Vexanium provider interface. It does not store private keys and does not rebuild transactions after the session has resolved them.

Applications should provide accurate dApp metadata and must treat wallet authorization as origin-bound permission state.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
