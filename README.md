# Wind Stack SDK

TypeScript packages for connecting dApps to Wisp Wallet across EVM, Solana, and Vexanium.

The Vexanium package follows an EVM-style provider model while keeping transactions Antelope-native through WharfKit. dApps interact with `window.vexanium` and `vex_*` methods. VSR, Vexanium Signing Request, is the Wisp Wallet-facing request format backed by `@wharfkit/signing-request`.

## Packages

| Package | Purpose |
|---|---|
| `@windstack/core` | Shared errors, events, dApp metadata, provider types, and runtime helpers. |
| `@windstack/evm` | EIP-1193 and EIP-6963 client helpers for EVM providers. |
| `@windstack/solana` | Solana provider client helpers. |
| `@windstack/vexanium` | Vexanium provider discovery, session-aware client, VSR helpers, and WharfKit ABI cache helper. |
| `@windstack/session` | Unified multichain session client and WharfKit SessionKit adapter. |

## Install

Install only the packages your dApp needs.

```bash
npm install @windstack/core @windstack/vexanium
```

For a WharfKit SessionKit integration:

```bash
npm install @windstack/session @windstack/vexanium @wharfkit/session @wharfkit/antelope @wharfkit/signing-request
```

For multichain dApps:

```bash
npm install @windstack/core @windstack/evm @windstack/solana @windstack/vexanium @windstack/session
```

## Vexanium provider contract

Wisp Wallet exposes the Vexanium provider at:

```ts
window.vexanium
```

Canonical methods:

| Method | Behavior |
|---|---|
| `vex_requestAccounts` | Requests account access. Opens a wallet approval only when the origin is not already authorized. |
| `vex_getAccounts` | Reads authorized accounts for the current origin. Never opens an approval prompt. |
| `vex_getChain` | Returns the active Vexanium chain id. |
| `vex_signingRequest` | Sends a VSR to Wisp Wallet for review, signature, and optional broadcast. |
| `vex_signMessage` | Requests a message signature for an authorized Vexanium account. |
| `vex_disconnect` | Revokes the current dApp session. |

Canonical events:

```txt
connect
disconnect
accountsChanged
chainChanged
message
```

The session behavior mirrors common EVM wallet behavior: `vex_requestAccounts` is the permission request, while `vex_getAccounts` is the silent restore/read path.

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
    name: 'Wind Explorer — Vexanium Blockchain',
    url: 'https://explorer.windcrypto.com',
    icon: 'https://explorer.windcrypto.com/icon-128.png',
    description: 'Explore Vexanium: blocks, transactions, accounts, contracts, and analytics — all in one sleek explorer.',
  },
});

const accounts = await client.getAccounts();

if (accounts.length === 0) {
  await client.connect({ chainId: VEXANIUM_MAINNET_CHAIN_ID });
}

const session = client.getSession();
```

### Create and sign a VSR

```ts
import { createVsr } from '@windstack/vexanium';

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
      memo: 'hello',
    },
  },
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  broadcast: true,
});

const result = await client.signVsr({
  vsr,
  broadcast: true,
});
```

`createVsr()` delegates to `@wharfkit/signing-request`. The SDK does not define a custom Antelope transaction format and does not reimplement ABI encoding, transaction serialization, or signing-request parsing.

## dApp metadata and sessions

Metadata is resolved during connect/login and stored in the wallet session:

```ts
type DappMetadata = {
  name: string;
  url: string;
  origin: string;
  icon?: string;
  icons?: string[];
  description?: string;
};
```

When a session exists, later signature requests use the session id. Full metadata is not sent again unless the dApp intentionally sends a refresh snapshot with the same origin.

Recommended startup flow:

```ts
const client = await createVexaniumClient({ dapp });
const accounts = await client.getAccounts();

if (accounts.length > 0) {
  // Restore connected UI.
} else {
  // Show Connect button.
}
```

## EVM

```ts
import { createEVMClient } from '@windstack/evm';

const evm = await createEVMClient();
const accounts = await evm.requestAccounts();
```

`@windstack/evm` prefers an EIP-6963 provider with `rdns: "com.wisp.wallet"` when one is announced, then falls back to injected providers.

## Solana

```ts
import { createSolanaClient } from '@windstack/solana';

const solana = createSolanaClient();
const accounts = await solana.connect();
```

## WharfKit SessionKit adapter

```ts
import { SessionKit } from '@wharfkit/session';
import { WispSessionPlugin } from '@windstack/session';

const sessionKit = new SessionKit({
  appName: 'Wind Explorer',
  chains: [vexaniumChain],
  walletPlugins: [new WispSessionPlugin()],
});
```

`@windstack/session` is an adapter. It uses WharfKit and does not replace SessionKit.

## License

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
