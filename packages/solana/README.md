# @windstack/solana

Solana provider client helpers for Wisp Wallet-compatible dApps.

## Install

```bash
npm install @windstack/core @windstack/solana
```

## Usage

```ts
import { createSolanaClient } from '@windstack/solana';

const client = await createSolanaClient();
const accounts = await client.connect();

const signature = await client.signMessage(new TextEncoder().encode('hello'));
```

## Notes

- This package is chain-specific and does not depend on Vexanium, VSR, EVM providers, or WharfKit.
- Use `@windstack/session` when your dApp needs a single session layer across multiple chains.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
