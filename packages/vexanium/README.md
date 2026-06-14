# @windstack/vexanium

Vexanium provider client, discovery helpers, and VSR utilities for Wisp Wallet-compatible dApps.

This package is for dApps. Wisp Wallet implements the provider at `window.vexanium`; dApps use this package to connect, restore sessions, create VSR payloads, and request signatures.

## Install

```bash
npm install @windstack/core @windstack/vexanium
```

## Provider model

```ts
window.vexanium
```

Methods:

| Method | Purpose |
|---|---|
| `vex_requestAccounts` | Request account permission from Wisp Wallet. |
| `vex_getAccounts` | Read authorized accounts for the current origin without a prompt. |
| `vex_getChain` | Read the active Vexanium chain id. |
| `vex_signingRequest` | Send a VSR for signature and optional broadcast. |
| `vex_signMessage` | Request a message signature. |
| `vex_disconnect` | Revoke the current dApp session. |

Events:

```txt
connect
disconnect
accountsChanged
chainChanged
message
```

## Vexanium mainnet

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE } from '@windstack/vexanium';
```

```txt
VEXANIUM_MAINNET_CHAIN_ID = f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f
VEXANIUM_MAINNET_SCOPE    = antelope:f9f432b1851b5c179d2091a96f593aa
```

## Connect and restore

Use `getAccounts()` on page load. It behaves like the read path in EVM wallets: it restores an existing approved session without showing an approval sheet.

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, createVexaniumClient } from '@windstack/vexanium';

const client = await createVexaniumClient({
  dapp: {
    name: 'Wind Explorer — Vexanium Blockchain',
    url: 'https://explorer.windcrypto.com',
    icon: 'https://explorer.windcrypto.com/icon-128.png',
    description: 'Explore Vexanium: blocks, transactions, accounts, contracts, and analytics — all in one sleek explorer.',
  },
});

let accounts = await client.getAccounts();

if (accounts.length === 0) {
  accounts = await client.connect({ chainId: VEXANIUM_MAINNET_CHAIN_ID });
}

console.log(accounts[0]);
console.log(client.getSession());
```

## Create a VSR

VSR means Vexanium Signing Request. It is the public Wisp Wallet/Vexanium name for a signing request created with `@wharfkit/signing-request`.

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, createVsr } from '@windstack/vexanium';

const vsr = await createVsr({
  action: {
    account: 'vex.token',
    name: 'transfer',
    authorization: [
      {
        actor: 'alice',
        permission: 'active',
      },
    ],
    data: {
      from: 'alice',
      to: 'bob',
      quantity: '1.0000 VEX',
      memo: '',
    },
  },
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  broadcast: true,
});
```

## Sign a VSR

```ts
const result = await client.signVsr({
  vsr,
  broadcast: true,
});

console.log(result.transactionId);
console.log(result.signatures);
```

If the dApp has an active session, `signVsr()` sends the stored `sessionId`. Wisp Wallet reads the dApp metadata from the approved session and shows only the transaction approval.

## ABI cache

```ts
import { createAbiCache } from '@windstack/vexanium';

const abiProvider = createAbiCache(apiClient);
```

This is a thin helper over `@wharfkit/abicache`. Import WharfKit primitives directly when your dApp needs `APIClient`, `Action`, `Transaction`, `PermissionLevel`, or `SigningRequest`.

## Scope

This package does not define a custom Antelope transaction format. It uses WharfKit for signing requests, Antelope types, ABI lookup, and serialization.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
