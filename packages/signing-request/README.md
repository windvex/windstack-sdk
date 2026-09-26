# @windstack/signing-request

## Overview

`@windstack/signing-request` provides chain-neutral Antelope signing-request primitives. It creates, parses, resolves, signs, verifies, and inspects requests containing actions, action lists, full transactions, identity requests, callbacks, request signatures, compression, full chain IDs, and multi-chain selectors.

The generic package defaults to the standard `esr:` URI scheme. It can also parse and encode `vsr:` when a chain-specific integration requires it. Vexanium applications should normally use the convenience APIs from `@windstack/vexanium`, which enforce the Vexanium Mainnet chain and canonical `vsr:` scheme.

## Installation

```bash
npm install @windstack/signing-request @windstack/rpc
```

## Usage

### Generic Antelope

```ts
import { RpcSigningRequestAbiProvider, createSigningRequest } from "@windstack/signing-request";
import { RpcClient } from "@windstack/rpc";

const rpc = new RpcClient({ endpoints: "https://your-antelope-rpc.example" });
const abiProvider = new RpcSigningRequestAbiProvider(rpc);

const request = await createSigningRequest(
  {
    chainId: "1212121212121212121212121212121212121212121212121212121212121212",
    action: {
      account: "sample.token",
      name: "transfer",
      authorization: [{ actor: "............1", permission: "............2" }],
      data: {
        from: "............1",
        to: "receiver",
        quantity: "1.0000 TST",
        memo: "Example transfer",
      },
    },
    broadcast: true,
  },
  { abiProvider },
);

const uri = request.encode(true, true);
```

`encode()` defaults to `esr:`. Supply `"vsr"` explicitly only when the chain integration defines that scheme.

## Resolution and inspection

```ts
import {
  SigningRequest,
  decodeSigningRequestActions,
  resolveSigningRequestWithRpc,
} from "@windstack/signing-request";

const parsed = SigningRequest.from(uri);
const decoded = await decodeSigningRequestActions(parsed, abiProvider);

const resolved = await resolveSigningRequestWithRpc(parsed, {
  rpc,
  abiProvider,
  actor: "alice",
  permission: "active",
});

console.log(decoded);
console.log(resolved.serializedTransaction);
console.log(resolved.digest);
```

Parsing a request never opens a callback URL, broadcasts a transaction, approves a wallet permission, or selects a signer automatically.

## Vexanium

For Vexanium, prefer `@windstack/vexanium`:

```ts
import { createSigningRequest } from "@windstack/vexanium";

const vsr = await createSigningRequest({
  action: {
    account: "vex.token",
    name: "transfer",
    authorization: [{ actor: "............1", permission: "............2" }],
    data: {
      from: "............1",
      to: "receiver",
      quantity: "1.0000 VEX",
      memo: "Example transfer",
    },
  },
});
```

That wrapper owns Vexanium-specific chain validation, RPC defaults, and the canonical `vsr:` scheme. The generic package does not own Vexanium presets.

## Security

Signing-request URIs are untrusted input. Parsing and resolution enforce protocol versions, flags, payload-size limits, chain selectors, and ABI-aware structured data handling. Request signatures prove that request bytes were signed by a supplied public key; applications requiring account-level authority must separately verify that key against the claimed account permission.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide the Web APIs required by the selected WindStack packages.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
