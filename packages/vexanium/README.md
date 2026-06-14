# @windstack/vexanium

Standard Vexanium provider client, discovery helpers, session sync, and VSR utilities for Vexanium dApps.

This package is for dApps. Wallets such as Wisp Wallet implement the standard provider at `window.vexanium`; dApps use this package to connect, restore sessions, create VSR payloads, and request signatures.

## Install

```bash
npm install @windstack/core @windstack/vexanium
```

## Version

Current release: `0.2.0`.

## Provider model

```ts
window.vexanium
```

Methods:

| Method | Purpose |
|---|---|
| `vex_requestAccounts` | Request account permission from a Vexanium wallet. |
| `vex_getAccounts` | Read authorized accounts for the current origin without prompting. |
| `vex_getChain` | Read the active Vexanium chain id. |
| `vex_signingRequest` | Send a VSR for signature and optional broadcast. |
| `vex_signMessage` | Request a message signature. |
| `vex_signDigest` | Request a digest signature. |
| `vex_signTransaction` | Request a serialized or packed transaction signature. |
| `vex_disconnect` | Revoke the current dApp session/origin permission. |

Events:

```txt
connect
disconnect
accountsChanged
chainChanged
message
```

## Standard provider guard

Windstack exposes one canonical guard for all Vexanium-compatible wallets:

```ts
import { isVexaniumProvider } from '@windstack/vexanium';

if (isVexaniumProvider(window.vexanium)) {
  const accounts = await window.vexanium.request({ method: 'vex_getAccounts' });
}
```

There is no brand-specific provider guard. Wisp Wallet implements the same standard Vexanium provider shape as any future compatible wallet. Wallet identity belongs in provider metadata, not in a separate public guard.

## Vexanium mainnet

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE } from '@windstack/vexanium';
```

```txt
VEXANIUM_MAINNET_CHAIN_ID = f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f
VEXANIUM_MAINNET_SCOPE    = antelope:f9f432b1851b5c179d2091a96f593aa
```

## Connect and restore

Use `getAccounts()` on page load. It restores an existing approved session without showing an approval sheet.

```ts
import { VEXANIUM_MAINNET_CHAIN_ID, createVexaniumClient } from '@windstack/vexanium';

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

## Sign messages, digests, and transactions

```ts
await client.signMessage('hello', 'alice@active');
await client.signDigest('0x0123456789abcdef', 'alice@active');
await client.signTransaction({
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  serializedTransaction: '...',
  account: 'alice@active',
});
```

## Create a VSR

VSR means Vexanium Signing Request. It is the public Vexanium wallet signing-request name for a request created with `@wharfkit/signing-request`.

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

If the dApp has an active session, `signVsr()` sends the stored `sessionId`. The wallet reads dApp metadata from the approved session and shows only the transaction approval.

## Revoke/disconnect sync

`createVexaniumClient()` keeps the SDK session aligned with provider state by default. It listens to provider events and silently re-checks `vex_getAccounts` when the browser window regains focus or the document becomes visible again.

```ts
const client = await createVexaniumClient({ dapp });

const unsubscribe = client.subscribeSession(({ accounts, session, reason }) => {
  if (accounts.length === 0) {
    localStorage.removeItem('vexanium.wallet');
    queryClient.removeQueries({ queryKey: ['wallet'] });
    return;
  }

  console.log('Vexanium session updated', reason, session);
});

unsubscribe();
client.destroy();
```

Low-level events are also normalized by the client:

```ts
client.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    // Wallet disconnected or origin permission revoked.
  }
});

client.on('disconnect', () => {
  // Clear dApp wallet state.
});
```

You can opt out of automatic sync when you need a manually controlled lifecycle:

```ts
const client = await createVexaniumClient({ dapp, autoSync: false });
await client.syncAccounts();
```

## ABI cache

```ts
import { createAbiCache } from '@windstack/vexanium';

const abiProvider = createAbiCache(apiClient);
```

This is a thin helper over `@wharfkit/abicache`. Import WharfKit primitives directly when your dApp needs `APIClient`, `Action`, `Transaction`, `PermissionLevel`, or `SigningRequest`.

## Provider compatibility boundary

`@windstack/vexanium` is a dApp SDK, not a wallet runtime. It must not compete with any wallet for ownership of injected globals.


## Scope

This package does not define a custom Antelope transaction format. It uses WharfKit for signing requests, Antelope types, ABI lookup, and serialization.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
