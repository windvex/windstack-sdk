# @windstack/session

Unified Wind Stack session layer for dApps that need one client across EVM, Solana, and Vexanium.

It also provides `WispSessionPlugin` for WharfKit SessionKit. The plugin is an adapter; it does not replace WharfKit.

## Install

For multichain direct usage:

```bash
npm install @windstack/session @windstack/evm @windstack/solana @windstack/vexanium
```

For WharfKit SessionKit:

```bash
npm install @windstack/session @windstack/vexanium @wharfkit/session @wharfkit/antelope @wharfkit/signing-request
```

`@wharfkit/session`, `@wharfkit/antelope`, and `@wharfkit/signing-request` are peer dependencies because this package plugs into SessionKit.

## Multichain client

```ts
import { createWispSessionClient } from '@windstack/session';

const client = await createWispSessionClient({
  dapp: {
    name: 'Wind Explorer — Vexanium Blockchain',
    url: 'https://explorer.windcrypto.com',
    icon: 'https://explorer.windcrypto.com/icon-128.png',
    description: 'Explore Vexanium: blocks, transactions, accounts, contracts, and analytics — all in one sleek explorer.',
  },
});

await client.connect(['eip155:1', 'antelope:f9f432b1851b5c179d2091a96f593aa']);
```

## WharfKit SessionKit plugin

```ts
import { SessionKit } from '@wharfkit/session';
import { WispSessionPlugin } from '@windstack/session';

const sessionKit = new SessionKit({
  appName: 'Wind Explorer',
  chains: [vexaniumChain],
  walletPlugins: [new WispSessionPlugin()],
});
```

## Vexanium signing behavior

Vexanium signing uses VSR through `@windstack/vexanium`. VSR is backed by `@wharfkit/signing-request`, so the transaction model remains Antelope-native.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
