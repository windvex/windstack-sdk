# @windstack/antelope

## Overview

`@windstack/antelope` provides chain-neutral Antelope transaction primitives, including verified RPC access, ABI-aware contract and account clients, TAPOS preparation, canonical transaction serialization, transaction digests and IDs, required-key resolution, pluggable signers, keosd support, and broadcasting.

A client can be bound to an expected chain ID. When configured, signing is rejected if the RPC endpoint reports a different chain.

## Installation

```bash
npm install @windstack/antelope
```

## Usage

### Chain-bound client

```ts
import {
  AntelopeClient,
  PrivateKey,
  PrivateKeySigner,
} from "@windstack/antelope";

const client = new AntelopeClient({
  endpoints: ["https://node.example"],
  chainId: "00".repeat(32),
  contracts: {
    system: "system.cntr",
    token: "token.cntr",
  },
});

const signer = new PrivateKeySigner([
  PrivateKey.fromString("PVT_K1_..."),
]);

const transfer = await client
  .account("alice")
  .transfer("bob", "1.0000 TKN", "Example transfer");

const result = await client.transact({
  actions: [transfer],
  signer,
});

console.log(result.response);
```

### Custom signer

Wallets, hardware signers, secure-storage integrations, and remote signers can implement the exported `Signer` interface.

A signer receives the chain ID, structured transaction, serialized transaction bytes, signing digest, and required public keys.

```ts
import type { Signer } from "@windstack/antelope";

const signer: Signer = {
  async getAvailableKeys() {
    return ["PUB_K1_..."];
  },
  async sign(request) {
    return secureSigner.sign(request.digest, request.requiredKeys);
  },
};
```

`PrivateKeySigner` is intended for environments where application-managed private keys are appropriate. For portable chain-neutral key representation, prefer modern `PUB_K1_...` public-key strings; legacy display prefixes can be configured when required by a chain or integration.

### keosd

HTTP and Unix-socket keosd transports are available for Node.js environments. Unix-socket support is exported separately from the browser entrypoint:

```ts
import { KeosdSigner } from "@windstack/antelope";
import { KeosdUnixTransport } from "@windstack/antelope/node";

const signer = new KeosdSigner({
  walletName: "default",
  transport: new KeosdUnixTransport({ socketPath: "/run/keosd.sock" }),
});
```

## Security

When a chain ID is configured, it is checked before signing. Signatures returned by a signer are parsed, recovered, and matched against the keys requested by the node before broadcast.

Use `broadcast: false` when signed transaction data is required without submitting it to the network.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Transaction construction uses Web-standard byte APIs and does not require Node.js `Buffer`.

Read operations can use multiple RPC endpoints. Transaction broadcast is not automatically retried when submission status is uncertain.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
