# @windstack/wallet-plugin-wisp

## Overview

`@windstack/wallet-plugin-wisp` connects `@windstack/session` applications to Wisp Wallet on Vexanium Mainnet. It supports wallet discovery, account authorization, chain validation, transaction signing, and session integration.

The plugin selects the Wisp provider identified by `com.wisp.wallet` unless a provider or client is supplied explicitly.

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

const session = await sessionManager.login();

const action = await session
  .account()
  .transfer("bob", "1.0000 VEX", "Example transfer");

await session.transact({
  actions: [action],
});
```

The plugin signs the canonical transaction resolved by the session and returns the wallet signatures to `@windstack/session`. Structured transaction data is retained for wallet review while the canonical serialized bytes remain the authoritative signing payload.

A chain other than Vexanium Mainnet is rejected during login and signing. Portable Vexanium Signing Requests are available through `@windstack/vexanium`.

## Runtime

The package targets browser applications with Wisp Wallet available through the Vexanium provider interface. It does not store private keys.

Applications should provide accurate dApp metadata. Wallet authorization is bound to the wallet/provider session rather than application-supplied display metadata.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
