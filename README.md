# Wind Stack SDK

TypeScript SDK packages for Wind Stack, Wisp Wallet, Wind Explorer, and Vexanium dApps.

The Vexanium package defines a standard injected provider contract for dApps. Wallets such as Wisp Wallet implement `window.vexanium`; dApps consume it through `@windstack/vexanium`. The SDK does not inject, replace, or own wallet globals.

## Packages

| Package | Purpose |
|---|---|
| `@windstack/core` | Shared errors, events, dApp metadata, provider types, and runtime helpers. |
| `@windstack/vexanium` | Standard Vexanium provider client, discovery, session sync, VSR helpers, and WharfKit ABI cache helper. |
| `@windstack/session` | Unified session client and WharfKit SessionKit adapter. |
| `@windstack/evm` | EIP-1193 and EIP-6963 client helpers for EVM providers. |
| `@windstack/solana` | Solana provider client helpers. |

## Install

Install only what your dApp uses.

```bash
npm install @windstack/core @windstack/vexanium
```

For WharfKit SessionKit integration:

```bash
npm install @windstack/session @windstack/vexanium @wharfkit/session @wharfkit/antelope @wharfkit/signing-request
```

For multichain dApps:

```bash
npm install @windstack/core @windstack/evm @windstack/solana @windstack/vexanium @windstack/session
```

## Version

Current workspace release: `0.2.0`.

This release is a minor update from `0.1.0` because it adds Vexanium session sync, standard provider discovery, `vex_signDigest`, and `vex_signTransaction` support without changing the public package names.

## Vexanium provider standard

Wallets expose the Vexanium provider at:

```ts
window.vexanium
```

The SDK exposes one canonical provider guard:

```ts
import { isVexaniumProvider } from '@windstack/vexanium';

if (isVexaniumProvider(window.vexanium)) {
  const accounts = await window.vexanium.request({ method: 'vex_getAccounts' });
}
```

There is no brand-specific provider guard. Wisp Wallet is a compatible provider implementation; the SDK standard is `isVexaniumProvider()`.

### Canonical methods

| Method | Behavior |
|---|---|
| `vex_requestAccounts` | Request account access. Opens wallet approval only when the origin is not already authorized. |
| `vex_getAccounts` | Read authorized accounts for the current origin. Never opens approval. |
| `vex_getChain` | Return the active Vexanium chain id. |
| `vex_signingRequest` | Send a VSR to the wallet for review, signature, and optional broadcast. |
| `vex_signMessage` | Request a message signature for an authorized Vexanium account. |
| `vex_signDigest` | Request a digest signature for an authorized Vexanium account. |
| `vex_signTransaction` | Request a serialized or packed transaction signature. |
| `vex_disconnect` | Revoke the current dApp session/origin permission. |

### Canonical events

```txt
connect
disconnect
accountsChanged
chainChanged
message
```

`vex_requestAccounts` is the permission request path. `vex_getAccounts` is the silent restore/read path.

## Vexanium constants

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE } from '@windstack/vexanium';
```

```txt
VEXANIUM_MAINNET_CHAIN_ID = f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f
VEXANIUM_MAINNET_SCOPE    = antelope:f9f432b1851b5c179d2091a96f593aa
```

## Basic Vexanium usage

```ts
import {
  VEXANIUM_MAINNET_CHAIN_ID,
  createVexaniumClient,
} from '@windstack/vexanium';

const client = await createVexaniumClient({
  dapp: {
    name: 'Wind Explorer',
    url: 'https://explorer.windcrypto.com',
    icon: 'https://explorer.windcrypto.com/icon-128.png',
    description: 'Vexanium blockchain explorer.',
  },
});

let accounts = await client.getAccounts();

if (accounts.length === 0) {
  accounts = await client.connect({ chainId: VEXANIUM_MAINNET_CHAIN_ID });
}

console.log(accounts[0]);
console.log(client.getSession());
```

## VSR signing

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, createVsr } from '@windstack/vexanium';

const vsr = await createVsr({
  action: {
    account: 'vex.token',
    name: 'transfer',
    authorization: [
      { actor: 'alice', permission: 'active' },
    ],
    data: {
      from: 'alice',
      to: 'bob',
      quantity: '1.0000 VEX',
      memo: 'hello',
    },
  },
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  broadcast: true,
});

const result = await client.signVsr({ vsr, broadcast: true });
```

`createVsr()` delegates to `@wharfkit/signing-request`. The SDK does not reimplement Antelope ABI encoding, transaction serialization, or signing-request parsing.

## Revoke and disconnect sync

`createVexaniumClient()` keeps the local dApp session aligned with wallet state by default. It listens to provider events and silently re-checks `vex_getAccounts` on window focus and document visibility restore.

```ts
const unsubscribe = client.subscribeSession(({ accounts }) => {
  if (accounts.length === 0) {
    localStorage.removeItem('vexanium.wallet');
    queryClient.removeQueries({ queryKey: ['wallet'] });
  }
});

// Cleanup when your app shell unmounts.
unsubscribe();
client.destroy();
```

## Compatibility boundary

`@windstack/vexanium` is a dApp SDK, not a wallet runtime.

Safe behavior:

- Reads `window.vexanium`; never assigns or replaces it.
- Does not inject scripts, content scripts, iframes, or providers.
- Does not write `window.wispWallet`.
- Does not polyfill or touch `window.ethereum`.
- Does not persist wallet permission state in browser storage.
- Keeps only an in-memory dApp session mirror so React/TanStack UI can update when the wallet emits events.


## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
