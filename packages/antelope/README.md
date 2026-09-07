# @windstack/antelope

## Overview

`@windstack/antelope` is the high-level transaction client for WindStack applications. It combines Vexanium-compatible RPC access, ABI serialization, contract access, account helpers, TAPOS construction, canonical transaction serialization, signing-digest calculation, required-key resolution, pluggable signers, and transaction broadcast.

A client can be bound to an expected chain ID. When configured, signing stops if the RPC endpoint reports a different chain, preventing a transaction from being signed against an unintended network.

Vexanium Mainnet is available through the `@windstack/antelope/vexanium` entrypoint with the canonical chain ID, RPC endpoint, `vexcore` system contract, `vex.token` native token contract, `VEX` symbol, and precision `4` already configured.

## Installation

```bash
npm install @windstack/antelope
```

## Usage

### Vexanium Mainnet

```ts
import {
  VEXANIUM_MAINNET,
  createVexaniumClient,
} from "@windstack/antelope/vexanium";
import {
  PrivateKey,
  PrivateKeySigner,
} from "@windstack/antelope";

const client = createVexaniumClient();

console.log(VEXANIUM_MAINNET.contracts.system); // vexcore
console.log(VEXANIUM_MAINNET.contracts.token); // vex.token
console.log(VEXANIUM_MAINNET.nativeToken.symbol); // VEX

const signer = new PrivateKeySigner([
  PrivateKey.fromString("PVT_K1_..."),
]);

const transfer = await client
  .account("alice")
  .transfer("bob", "1.0000 VEX", "WindStack");

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

The built-in K1 signer uses the compatibility public-key representation expected by older Vexanium node software when resolving required keys. Applications can request current K1 public-key strings with `k1PublicKeyFormat: "modern"`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses Web-standard byte and networking APIs and does not require Node.js `Buffer` for transaction construction or signing.

The client accepts one or more RPC endpoints for read operations and required-key resolution. Transaction broadcast is not retried automatically when the outcome of a submitted transaction is uncertain.

Vexanium production ABI compatibility is checked as part of the repository release validation against `vexcore` and `vex.token`.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
