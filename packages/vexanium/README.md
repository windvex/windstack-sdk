# @windstack/vexanium

## Overview

`@windstack/vexanium` contains behavior that is specific to Vexanium: network metadata, browser wallet-provider access, Signing Requests, session observation, explorer routes, and VEX EVM bridge decoding.

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

### Antelope client and local signer

```ts
import { PrivateKey } from "@windstack/antelope";
import {
  VEXANIUM_ANTELOPE_MAINNET,
  createVexaniumAntelopeClient,
  createVexaniumPrivateKeySigner,
} from "@windstack/vexanium/antelope";

const client = createVexaniumAntelopeClient();
const signer = createVexaniumPrivateKeySigner([
  PrivateKey.fromString("PVT_K1_..."),
]);

console.log(VEXANIUM_ANTELOPE_MAINNET.nativeToken.symbol); // VEX
```

The signer announces K1 public keys with the native `VEX` prefix. Equivalent `VEX…`, `EOS…`, and `PUB_K1_…` inputs are matched by their key bytes.

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

### Explorer routes

```ts
import {
  buildExplorerAccountUrl,
  buildExplorerTxUrl,
} from "@windstack/vexanium";

const accountUrl = buildExplorerAccountUrl("gvexa");
const transactionUrl = buildExplorerTxUrl("transaction-id");
```

Exact asset parsing and formatting are available from `@windstack/abi`; exact decimal utilities are available from `@windstack/core`.

### VEX EVM bridge primitives

```ts
import {
  decodeVexEvmBridgeTransferCalldata,
  nativeAccountToReservedEvmAddress,
  reservedEvmAddressToNativeAccount,
} from "@windstack/vexanium";

const address = nativeAccountToReservedEvmAddress("alice");
const account = reservedEvmAddressToNativeAccount(address);
const transfer = decodeVexEvmBridgeTransferCalldata(calldata);
```

Reserved addresses are accepted only when their `0xbbbb…` suffix decodes to a canonical Vexanium account. Prefix-only matches, malformed ABI offsets, truncated UTF-8, and oversized memos are rejected.

### VEX EVM contract actions

Decoded `vex.evm::evmtx` and `vex.evm::pushtx` data can be normalized without losing uint64 values:

```ts
import { decodeVexEvmContractAction } from "@windstack/vexanium";

const action = decodeVexEvmContractAction(hyperionAction);
if (action.name === "evmtx") {
  console.log(action.event.rlpTransaction, action.event.protocolVersion);
}
```

Both `evmtx_v1` and `evmtx_v3` variants are supported. RLP bytes, event fields, account names, and uint64 values are validated before being returned. Other `vex.evm` actions can be decoded from their current on-chain ABI with `AbiSerializer` from `@windstack/abi`.

## Runtime

The provider client targets browser applications with a compatible Vexanium wallet provider. Network metadata and utility functions can also be used in server-side applications.

Application metadata is display information. Wallet permissions must be bound to a trusted runtime or transport origin rather than an origin supplied by application content.

For transaction construction, ABI serialization, RPC, contract actions, account operations, and signing, use the dedicated `@windstack/antelope` package family.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
