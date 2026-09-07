# @windstack/vexanium

## Overview

`@windstack/vexanium` provides Vexanium network metadata, browser wallet-provider access, Vexanium Signing Requests, session observation, asset helpers, and Wind Explorer URL utilities.

VEX Native configuration exposed by this package uses:

- Chain ID: `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f`
- RPC and API: `https://api.windcrypto.com`
- System contract: `vexcore`
- Native token contract: `vex.token`
- Native symbol: `VEX`
- Precision: `4`

The package also exposes VEX EVM metadata for chain ID `6736` (`0x1a50`) and the WindStack EVM endpoints.

## Installation

```bash
npm install @windstack/vexanium
```

## Usage

### Network metadata

```ts
import { vexEvm, vexNative } from "@windstack/vexanium";

console.log(vexNative.chainId);
console.log(vexNative.contracts.system); // vexcore
console.log(vexNative.contracts.token); // vex.token
console.log(vexNative.token.symbol); // VEX
console.log(vexEvm.chainId); // 6736
```

### Wallet connection

```ts
import { createVexaniumClient, vexNative } from "@windstack/vexanium";

const client = await createVexaniumClient({
  dapp: {
    name: "My App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

let accounts = await client.getAccounts();
if (accounts.length === 0) {
  accounts = await client.connect({ chainId: vexNative.chainId });
}
```

`getAccounts()` reads an existing wallet permission without opening a connection prompt. `connect()` requests wallet authorization for the selected Vexanium chain. Provider events and browser visibility changes keep the local session view synchronized with the wallet.

```ts
const unsubscribe = client.subscribeSession(({ session, reason }) => {
  console.log(session, reason);
});

unsubscribe();
client.destroy();
```

### Exact transaction signing

Applications that already have serialized Vexanium transaction bytes can request signatures without rebuilding the transaction:

```ts
const result = await client.signTransaction({
  chainId: vexNative.chainId,
  serializedTransaction: "00a1",
  account: "alice",
  permission: "active",
});

console.log(result.signatures);
```

The client validates the full Vexanium chain ID, serialized hexadecimal payload, account and permission names, and returned signatures before accepting a result.

### Vexanium Signing Requests

VSR is available for portable requests that need to move through QR codes, links, the clipboard, or an external wallet flow.

```ts
import {
  createSigningRequest,
  parseSigningRequest,
  vexNative,
} from "@windstack/vexanium";

const uri = await createSigningRequest({
  chainId: vexNative.chainId,
  broadcast: true,
  action: {
    account: "vex.token",
    name: "transfer",
    authorization: [{ actor: "alice", permission: "active" }],
    data: {
      from: "alice",
      to: "bob",
      quantity: "1.0000 VEX",
      memo: "WindStack",
    },
  },
});

const request = parseSigningRequest(uri);
```

### Explorer and asset utilities

```ts
import {
  buildExplorerAccountUrl,
  buildExplorerTxUrl,
  formatAsset,
  parseAsset,
} from "@windstack/vexanium";

const asset = parseAsset("1.2500 VEX");
const value = formatAsset(asset.amount, asset.precision, asset.symbol);
const accountUrl = buildExplorerAccountUrl("gvexa");
const transactionUrl = buildExplorerTxUrl("transaction-id");
```

## Runtime

The provider client targets browser applications with a compatible Vexanium wallet provider. Network metadata and utility functions can also be used in server-side applications.

Application metadata is display information. Wallet permissions must be bound to a trusted runtime or transport origin rather than an origin supplied by application content.

For transaction construction, ABI serialization, RPC, contract actions, account operations, and signing, use the dedicated `@windstack/antelope` package family.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
