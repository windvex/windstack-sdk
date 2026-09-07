# @windstack/wallet-plugin-wisp

## Overview

`@windstack/wallet-plugin-wisp` connects `@windstack/session` applications to Wisp Wallet on Vexanium Mainnet. It handles wallet discovery, account authorization, exact transaction signing, chain validation, and signer integration.

The plugin is restricted to Vexanium Mainnet and selects the Wisp provider identified by `com.wisp.wallet` unless a provider or client is supplied explicitly.

## Installation

```bash
npm install @windstack/wallet-plugin-wisp
```

## Usage

```ts
import { SessionManager } from "@windstack/session";
import { vexNative } from "@windstack/vexanium";
import { WispWalletPlugin } from "@windstack/wallet-plugin-wisp";

const sessionManager = new SessionManager({
  appName: "My Vexanium App",
  chains: [{
    id: vexNative.chainId,
    url: vexNative.rpcUrl,
    contracts: vexNative.contracts,
  }],
  walletPlugins: [new WispWalletPlugin()],
});

const session = await sessionManager.login();

const action = await session
  .account()
  .transfer("receiver", "1.0000 VEX", "WindStack");

await session.transact({
  actions: [action],
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
