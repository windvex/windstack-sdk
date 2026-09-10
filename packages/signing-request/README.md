# @windstack/signing-request

## Overview

`@windstack/signing-request` creates, parses, resolves, signs, verifies, and inspects Vexanium Signing Requests (VSR). It supports single actions, multiple actions, full transactions, identity requests, callbacks, request signatures, compression, full chain IDs, multi-chain requests, and ABI-aware placeholder resolution.

VSR uses the canonical `vsr:` URI scheme. Protocol revisions are selected automatically according to the features used by the request.

## Installation

```bash
npm install @windstack/signing-request
```

## Usage

```ts
import {
  RpcSigningRequestAbiProvider,
  createSigningRequest,
} from "@windstack/signing-request";
import { RpcClient } from "@windstack/rpc";

const rpc = new RpcClient({ endpoints: "https://api.windcrypto.com" });
const abiProvider = new RpcSigningRequestAbiProvider(rpc);

const request = await createSigningRequest(
  {
    chainId: "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
    action: {
      account: "vex.token",
      name: "transfer",
      authorization: [
        { actor: "............1", permission: "............2" },
      ],
      data: {
        from: "............1",
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "VSR example",
      },
    },
    callback: "https://app.example/signed?tx={{tx}}",
  },
  { abiProvider },
);

const uri = request.encode(true, true, "vsr");
```

A wallet resolves actor and permission placeholders against the selected signer before signing:

```ts
import {
  SigningRequest,
  resolveSigningRequestWithRpc,
} from "@windstack/signing-request";

const parsed = SigningRequest.from(uri);
const resolved = await resolveSigningRequestWithRpc(parsed, {
  rpc,
  abiProvider,
  actor: "alice",
  permission: "active",
});

console.log(resolved.serializedTransaction);
console.log(resolved.digest);
```

## Action inspection

Use the inspection APIs to enumerate or ABI-decode executable actions from a request:

```ts
import {
  decodeSigningRequestActions,
  getSigningRequestActions,
} from "@windstack/signing-request";

const actions = getSigningRequestActions(parsed);
const decoded = await decodeSigningRequestActions(parsed, abiProvider);

for (const action of decoded) {
  console.log(action.account, action.name, action.data);
}
```

`decodeSigningRequestActions()` preserves action order and authorization data and supports single-action, multi-action, and full-transaction requests. Context-free actions can be included with `{ includeContextFree: true }`.

## Request types

The package supports action, action-list, transaction, and identity requests. Identity requests produce an off-chain proof transaction and require a callback.

Multi-chain requests use chain alias `0` and require an explicit chain during resolution. Nonzero aliases require an application-provided alias resolver.

Callbacks are returned as structured data. Parsing a request does not automatically open callback URLs, broadcast transactions, or approve wallet permissions.

## Vexanium

Use the full Vexanium Mainnet chain ID for VSR requests:

```text
f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f
```

The Vexanium system contract is `vexcore`. The native VEX token contract is `vex.token`, with symbol `VEX` and precision `4`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide the Web APIs required by the selected WindStack packages. Raw-deflate compression is provided through `pako`.

## Security

VSR URIs are untrusted input. Parsing and resolution enforce supported protocol versions, flags, payload bounds, chain constraints, and ABI-aware structured data handling.

Request signatures prove that request bytes were signed by a supplied public key. Applications that require account-level authority verification must also verify that the key is authorized for the claimed account permission.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
