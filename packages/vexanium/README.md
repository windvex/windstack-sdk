# @windstack/vexanium

## Overview

`@windstack/vexanium` is the high-level WindStack package for Vexanium applications. It provides wallet connection, account and contract access, ABI-aware transactions, Vexanium Signing Requests (VSR), explorer routes, chain metadata, and VEX EVM utilities.

VEX Native defaults:

- Chain ID: `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f`
- RPC/API: `https://api.windcrypto.com`
- System contract: `vexcore`
- Native token contract: `vex.token`
- Native symbol: `VEX`
- Precision: `4`

VEX EVM metadata is included for chain ID `6736` (`0x1a50`).

## Installation

```bash
npm install @windstack/vexanium
```

## Configure and connect

```ts
import { createVexaniumClient } from "@windstack/vexanium";

const vex = await createVexaniumClient({
  dapp: {
    name: "Example App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

const account = await vex.connectOne();
console.log(account.permissionLevel);
```

A trusted alternate Vexanium RPC endpoint can be supplied when needed:

```ts
const vex = await createVexaniumClient({
  rpcUrl: "https://my-vexanium-rpc.example",
});
```

The configured RPC is shared by account access, contract ABI loading, transaction preparation, VSR creation, and broadcasting.

## Transactions

Structured action data is ABI-encoded automatically. When `authorization` is omitted, transaction actions use the connected wallet permission.

```ts
const result = await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "Example transfer",
      },
    },
  ],
});

console.log(result.response);
```

`transact()` handles ABI loading, action encoding, authorization, TAPOS, canonical transaction serialization, wallet signing, and optional broadcast.

### Multi-action transactions

Pass multiple actions in the same transaction:

```ts
await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "First action",
      },
    },
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "0.5000 VEX",
        memo: "Second action",
      },
    },
  ],
});
```

The canonical serialized transaction and its matching structured representation are preserved through wallet signing so each action can be reviewed before approval.

## Contract and account access

```ts
const token = vex.contract("vex.token");
const rows = await token.tableRows("accounts", account.actor);

const currentAccount = vex.account();
const balance = await currentAccount.getTokenBalance();
```

Contract and account APIs use the same RPC and ABI cache as `transact()`.

## Vexanium Signing Request (VSR)

Portable wallet requests use the `vsr:` scheme.

```ts
const uri = await vex.createSigningRequest({
  broadcast: true,
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      authorization: [{ actor: account.actor, permission: account.permission }],
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "VSR example",
      },
    },
  ],
});

const request = vex.parseSigningRequest(uri);
```

Client-bound VSR uses the configured Vexanium chain, RPC, and ABI cache. Vexanium-facing VSR operations are restricted to the configured Vexanium chain.

A VSR can also be sent to the connected wallet:

```ts
const signed = await vex.signSigningRequest({
  request: uri,
  broadcast: false,
});

console.log(signed.signatures);
```

## Session access

```ts
const accounts = await vex.getAccounts();

const unsubscribe = vex.subscribeSession(({ session, reason }) => {
  console.log(session, reason);
});

unsubscribe();
```

## Exact transaction signing

`signTransaction()` is available for applications that already have a canonical packed Vexanium transaction. For ordinary structured transactions, prefer `transact()`.

When both packed bytes and a structured transaction are supplied, WindStack verifies that the structured form serializes to exactly the same bytes before signing.

## Network metadata

```ts
import { vexEvm, vexNative } from "@windstack/vexanium";

console.log(vexNative.chainId);
console.log(vexNative.contracts.system); // vexcore
console.log(vexNative.contracts.token); // vex.token
console.log(vexNative.token.symbol); // VEX
console.log(vexEvm.chainId); // 6736
```

## Explorer routes

```ts
import { buildExplorerAccountUrl, buildExplorerTxUrl } from "@windstack/vexanium";

const accountUrl = buildExplorerAccountUrl("alice");
const transactionUrl = buildExplorerTxUrl("transaction-id");
```

## VEX EVM bridge utilities

```ts
import {
  decodeVexEvmBridgeTransferCalldata,
  nativeAccountToReservedEvmAddress,
  reservedEvmAddressToNativeAccount,
} from "@windstack/vexanium";

const address = nativeAccountToReservedEvmAddress("alice");
const nativeAccount = reservedEvmAddressToNativeAccount(address);
const transfer = decodeVexEvmBridgeTransferCalldata(calldata);
```

Reserved bridge addresses are accepted only when their payload decodes to a canonical Vexanium account.

## VEX EVM contract actions

```ts
import { decodeVexEvmContractAction } from "@windstack/vexanium";

const action = decodeVexEvmContractAction(hyperionAction);
if (action.name === "evmtx") {
  console.log(action.event.rlpTransaction, action.event.protocolVersion);
}
```

Both `evmtx_v1` and `evmtx_v3` variants are supported.

## Runtime

Wallet connection targets browser environments with a compatible Vexanium provider. RPC, metadata, VSR, decoding, and other utility APIs can be used wherever their runtime requirements are available.

## Security

Wallet permissions are bound to the provider session. Application metadata is display information and is not an authorization boundary.

Packed transactions and VSR payloads are treated as untrusted input and validated for chain identity, encoding, size, ABI data, and wallet capabilities before signing.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
