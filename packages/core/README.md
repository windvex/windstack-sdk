# @windstack/core

Shared TypeScript foundation for Wind Stack SDK packages.

This package contains provider-safe primitives used by `@windstack/evm`, `@windstack/solana`, `@windstack/vexanium`, and `@windstack/session`.

## Install

```bash
npm install @windstack/core
```

## Exports

```ts
import {
  WISP_ERROR_CODES,
  WispEventEmitter,
  WispProviderError,
  normalizeProviderError,
  readDappMetadataFromDocument,
  resolveDappMetadata,
  sameDappOrigin,
} from '@windstack/core';
```

Types:

```ts
import type {
  DappMetadata,
  DappMetadataInput,
  ProviderDetail,
  ProviderInfo,
  RequestArguments,
  WispClientOptions,
  WispProviderLike,
  WispSession,
} from '@windstack/core';
```

## dApp metadata

Use `resolveDappMetadata()` before requesting wallet access. Explicit values take priority, then the browser document is used when available.

```ts
const dapp = resolveDappMetadata({
  name: 'Wind Explorer — Vexanium Blockchain',
  url: 'https://explorer.windcrypto.com',
  icon: 'https://explorer.windcrypto.com/icon-128.png',
  description: 'Explore Vexanium: blocks, transactions, accounts, contracts, and analytics — all in one sleek explorer.',
});
```

The returned metadata always includes `name`, `url`, and `origin`.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
