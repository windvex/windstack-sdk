# @windstack/signing-request

## Overview

`@windstack/signing-request` creates, parses, resolves, signs, verifies, and inspects Vexanium Signing Requests (VSR). It supports single actions, multiple actions, full transactions, identity requests, callbacks, request signatures, compression, full chain IDs, multi-chain requests, and ABI-aware placeholder resolution.

VSR uses the canonical `vsr:` URI scheme. Normal fixed-chain action, multi-action, and transaction requests use the minimal compatible protocol revision; features that require revision 3 select it automatically.

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
        to: "receiver",
        quantity: "1.0000 VEX",
        memo: "WindStack",
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
  actor: "myaccount",
  permission: "active",
});

console.log(resolved.serializedTransaction);
console.log(resolved.digest);
```

## Action inspection

Applications and wallets do not need separate parsing branches for `action`, `action[]`, and full transaction requests. WindStack exposes one action inspection path for all executable request forms:

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

`decodeSigningRequestActions` loads each required contract ABI once per inspection pass, decodes every action independently, preserves authorization data and action order, and supports multi-contract multi-action requests. Context-free actions can be included with `{ includeContextFree: true }`.

## Request types

The package supports action, action-list, transaction, and identity requests. Identity requests produce an off-chain proof transaction and require a callback. Multi-chain requests use chain alias `0` and require the signer to select an explicit chain during resolution. Nonzero aliases are resolved only through an explicit application-provided alias resolver; WindStack does not hardcode unrelated chains.

Callbacks are returned as structured data. The package does not open callback URLs, send callback requests, broadcast transactions, access private keys automatically, or approve requests on behalf of a wallet.

## Vexanium

Use the full Vexanium Mainnet chain ID for VSR requests:

```text
f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f
```

The Vexanium system contract is `vexcore`. The native VEX token contract is `vex.token`, with symbol `VEX` and precision `4`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide the Web APIs required by the selected WindStack packages. Raw-deflate compression is provided through `pako` and does not require a Node.js compression polyfill.

## Security

VSR URIs are untrusted input. Parsing and resolution do not trigger signing, broadcasting, callbacks, or wallet permissions. Compressed payloads are decoded with a bounded output limit, unsupported protocol versions and flags are rejected, and structured action data is resolved through the contract ABI rather than by replacing arbitrary strings.

Request signatures prove that request bytes were signed by a supplied public key; applications that need account-level authority verification must additionally verify that the key is authorized for the claimed account permission.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
