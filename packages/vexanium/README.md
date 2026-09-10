# @windstack/vexanium

## Overview

`@windstack/vexanium` is the high-level Vexanium SDK surface for applications that need chain access, wallet connection, contract interaction, transaction signing, Vexanium Signing Requests, account data, explorer routes, and VEX EVM utilities.

The primary developer flow is intentionally small:

```text
install WindStack → configure Vexanium → connect wallet → interact with blockchain
```

Applications should not need to create their own ABI helpers, transaction serializers, provider adapters, signing-request compatibility layers, or multi-action decoders for normal Vexanium development.

VEX Native defaults:

- Chain ID: `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f`
- RPC/API: `https://api.windcrypto.com`
- System contract: `vexcore`
- Native token contract: `vex.token`
- Native symbol: `VEX`
- Precision: `4`

VEX EVM metadata is also included for chain ID `6736` (`0x1a50`).

## Installation

```bash
npm install @windstack/vexanium
```

## Usage

### Configure and connect

```ts
import { createVexaniumClient } from "@windstack/vexanium";

const vex = await createVexaniumClient({
  dapp: {
    name: "My App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

const account = await vex.connectOne();
console.log(account.permissionLevel);
```

The default RPC is the WindStack Vexanium endpoint. Applications can provide an alternate Vexanium RPC endpoint without changing the rest of the API:

```ts
const vex = await createVexaniumClient({
  rpcUrl: "https://my-vexanium-rpc.example",
});
```

The configured RPC is shared by contract ABI loading, account access, transaction preparation, VSR creation, and broadcasting.

### Interact with contracts

Structured action data is ABI-encoded automatically. When `authorization` is omitted, normal transaction actions use the connected wallet permission.

```ts
const result = await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "receiver",
        quantity: "1.0000 VEX",
        memo: "WindStack",
      },
    },
  ],
});

console.log(result.response);
```

`transact()` handles the complete normal transaction pipeline: ABI loading and caching, action encoding, authorization, TAPOS, canonical transaction serialization, wallet signing, and broadcasting.

#### Multi-action transactions

Multiple contracts use exactly the same API. There is no separate multi-action transaction helper.

```ts
await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "swapv2.wind",
        quantity: "2.0000 VEX",
        memo: "liquidity",
      },
    },
    {
      account: "token.wind",
      name: "transfer",
      data: {
        from: account.actor,
        to: "swapv2.wind",
        quantity: "3.00000000 WIND",
        memo: "liquidity",
      },
    },
  ],
});
```

The structured transaction remains available through the complete signing boundary so wallets can review every action without reconstructing the transaction from opaque bytes.

### Contract and account access

The same configured client exposes lower-level contract and account objects when an application needs direct reads or reusable action construction:

```ts
const token = vex.contract("vex.token");
const rows = await token.tableRows("accounts", account.actor);

const currentAccount = vex.account();
const balance = await currentAccount.getTokenBalance();
```

These APIs share the same RPC and ABI cache used by `transact()`.

### Vexanium Signing Request (VSR)

Portable wallet requests use the canonical `vsr:` scheme.

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
        to: "receiver",
        quantity: "1.0000 VEX",
        memo: "VSR",
      },
    },
    {
      account: "token.wind",
      name: "transfer",
      authorization: [{ actor: account.actor, permission: account.permission }],
      data: {
        from: account.actor,
        to: "receiver",
        quantity: "1.00000000 WIND",
        memo: "VSR",
      },
    },
  ],
});

const request = vex.parseSigningRequest(uri);
console.log(request.data.request.type); // action[]
```

`createSigningRequest()` uses the client's configured Vexanium chain, RPC, and ABI cache. `parseSigningRequest()` only accepts VSRs targeting Vexanium Mainnet. Single actions, multi-actions, and full transactions are represented by the native WindStack signing-request implementation.

A VSR can be handed to the connected wallet directly:

```ts
const signed = await vex.signSigningRequest({
  request: uri,
  broadcast: false,
});

console.log(signed.signatures);
```

### Existing wallet session

Applications can read or observe the current session without rebuilding wallet state themselves:

```ts
const accounts = await vex.getAccounts();

const unsubscribe = vex.subscribeSession(({ session, reason }) => {
  console.log(session, reason);
});

unsubscribe();
```

### Advanced exact signing

`signTransaction()` is an advanced escape hatch for applications that already have a canonical packed Vexanium transaction. Normal applications should prefer `transact()`.

WindStack validates the packed transaction, decodes it canonically, preserves its structured form for wallet review, and rejects a supplied structured transaction when it does not serialize back to the exact same bytes.

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

const accountUrl = buildExplorerAccountUrl("gvexa");
const transactionUrl = buildExplorerTxUrl("transaction-id");
```

## VEX EVM bridge primitives

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

Reserved bridge addresses are accepted only when their payload decodes to a canonical Vexanium account. Malformed offsets, invalid address payloads, truncated UTF-8, and oversized memos are rejected.

## VEX EVM contract actions

```ts
import { decodeVexEvmContractAction } from "@windstack/vexanium";

const action = decodeVexEvmContractAction(hyperionAction);
if (action.name === "evmtx") {
  console.log(action.event.rlpTransaction, action.event.protocolVersion);
}
```

Both `evmtx_v1` and `evmtx_v3` variants are supported. RLP bytes, event fields, account names, and uint64 values are validated before being returned.

## Runtime

The provider client targets browser applications with a compatible Vexanium wallet provider. RPC, metadata, VSR, decoding, and other utility surfaces can also be used where their runtime dependencies are available.

## Security

Wallet permissions are bound to the trusted provider/runtime session. Application display metadata is not used as an authorization boundary.

Packed transactions and VSR payloads are treated as untrusted input. WindStack applies canonical decoding, size limits, chain validation, ABI-aware action handling, and explicit wallet capability negotiation before signing.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
