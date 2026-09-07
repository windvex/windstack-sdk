# @windstack/antelope

## Overview

`@windstack/antelope` is a chain-neutral Antelope transaction toolkit. It combines verified RPC access, ABI serialization, contract and account helpers, TAPOS, transaction serialization/digest/id, required-key resolution, pluggable signers, keosd, and transaction broadcast.

A client can be bound to an expected chain ID. When configured, signing stops if the RPC endpoint reports a different chain, preventing a transaction from being signed against an unintended network.

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
  contracts: { system: "eosio", token: "eosio.token" },
});
const signer = new PrivateKeySigner([
  PrivateKey.fromString("PVT_K1_..."),
]);

const transfer = await client
  .account("alice")
  .transfer("bob", "1.0000 SYS", "example");

const result = await client.transact({
  actions: [transfer],
  signer,
});

console.log(result.response);
```

### Custom signer

`PrivateKeySigner` is suitable only when application-managed keys are appropriate. Wallets, hardware signers, secure-storage integrations, and remote signers can implement the exported `Signer` interface.

A signer receives the chain ID, resolved transaction, serialized transaction bytes, signing digest, and required public keys in a single request.

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

`PrivateKeySigner` defaults to legacy `EOS` display strings and accepts a custom legacy prefix. Required keys returned in a configured legacy form or as `PUB_K1` are normalized before matching.

HTTP keosd is browser-safe and loopback-only by default. Unix sockets are isolated from the browser entrypoint:

```ts
import { KeosdSigner } from "@windstack/antelope";
import { KeosdUnixTransport } from "@windstack/antelope/node";

const signer = new KeosdSigner({
  walletName: "default",
  transport: new KeosdUnixTransport({ socketPath: "/run/keosd.sock" }),
});
```

## Security

The configured chain ID is checked before signing. Signer output is parsed, counted, recovered, and matched to the keys requested by the node before broadcast. Use `broadcast: false` when an application needs signed bytes without submission.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses Web-standard byte and networking APIs and does not require Node.js `Buffer` for transaction construction or signing.

The client accepts one or more RPC endpoints for read operations and required-key resolution. Transaction broadcast is not retried automatically when the outcome of a submitted transaction is uncertain.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
