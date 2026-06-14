# @windstack/evm

EVM provider client helpers for Wisp Wallet-compatible dApps.

The client works with EIP-1193 providers and uses EIP-6963 discovery when available. It prefers a provider with `rdns: "com.wisp.wallet"`, then falls back to injected providers.

## Install

```bash
npm install @windstack/core @windstack/evm
```

## Usage

```ts
import { createEVMClient } from '@windstack/evm';

const client = await createEVMClient();

const accounts = await client.requestAccounts();
const chainId = await client.getChainId();

await client.switchChain('0x1');
```

## Notes

- EVM uses `window.ethereum` and standard EVM JSON-RPC methods.
- This package is independent from Vexanium, VSR, and WharfKit.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
