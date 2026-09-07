# @windstack/core

## Overview

`@windstack/core` contains shared provider contracts, error types, event utilities, browser helpers, and application metadata utilities used across WindStack wallet-facing packages.

The exported `WISP_PROVIDER_CONTRACT` keeps provider identity, error codes, Vexanium provider identifiers, EVM chain identifiers, method names, capabilities, and discovery events consistent across packages.

## Installation

```bash
npm install @windstack/core
```

## Usage

```ts
import {
  WISP_PROVIDER_CONTRACT,
  WispEventEmitter,
  normalizeProviderError,
  resolveDappMetadata,
} from "@windstack/core";

const metadata = resolveDappMetadata({
  name: "My App",
  url: "https://app.example",
  icon: "https://app.example/icon.png",
});

console.log(WISP_PROVIDER_CONTRACT.vex.standard);
console.log(WISP_PROVIDER_CONTRACT.evm.chainIdHex);
```

`resolveDappMetadata()` combines explicit application metadata with safe values available from the current document. Provider error normalization preserves numeric wallet error codes, while `WispEventEmitter` supplies typed listener registration and cleanup for provider clients.

## Security

Application metadata is display information only. Wallet permission state should be bound to an authoritative transport origin, such as the browser extension sender origin, instead of trusting an origin supplied by application content.

## Runtime

The package is browser-safe and contains no chain-signing implementation. It is designed to be shared by provider clients without requiring a blockchain runtime or private-key dependency.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
