# @windstack/signing-request

## Overview

`@windstack/signing-request` creates, parses, resolves, signs, and verifies portable signing requests for Vexanium and compatible Antelope applications. It supports single actions, multiple actions, full transactions, identity requests, callbacks, request signatures, compression, full chain IDs, multi-chain requests, and ABI-aware placeholder resolution.

Vexanium applications can use the canonical `vsr:` scheme. Existing `esr:` requests are accepted for protocol interoperability.

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

const uri = request.encode(true, false, "vsr");
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

## Request Types

The package supports action, action-list, transaction, and identity requests. Identity requests produce an off-chain proof transaction and require a callback. Multi-chain requests use chain alias `0` and require the signer to select an explicit chain during resolution.

Callbacks are returned as structured data. The package does not open callback URLs, send callback requests, broadcast transactions, access private keys automatically, or approve requests on behalf of a wallet.

## Vexanium

Use the full Vexanium Mainnet chain ID for newly created VSR requests:

```text
f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f
```

The Vexanium system contract is `vexcore`. The native VEX token contract is `vex.token`, with symbol `VEX` and precision `4`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide the Web APIs required by the selected WindStack packages. Raw-deflate compression is provided through `pako` and does not require a Node.js compression polyfill.

## Security

Signing-request URIs are untrusted input. Parsing and resolution do not trigger signing, broadcasting, callbacks, or wallet permissions. Compressed payloads are decoded with a bounded output limit, unsupported protocol versions and flags are rejected, and structured action data is resolved through the contract ABI rather than by replacing arbitrary strings.

Request signatures prove that request bytes were signed by a supplied public key; applications that need account-level authority verification must additionally verify that the key is authorized for the claimed Vexanium account permission.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
