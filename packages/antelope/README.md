# @windstack/antelope

## Overview

`@windstack/antelope` is the high-level transaction client for WindStack Antelope applications. It combines RPC access, ABI serialization, contract access, account helpers, TAPOS construction, transaction serialization, signing-digest calculation, required-key resolution, pluggable signers, and transaction broadcast.

A client can be bound to an expected chain ID. When configured, signing stops if the RPC endpoint reports a different chain, preventing transactions from being signed against an unintended network.

## Installation

```bash
npm install @windstack/antelope
```

## Usage

```ts
import {
  AntelopeClient,
  PrivateKey,
  PrivateKeySigner,
} from "@windstack/antelope";

const client = new AntelopeClient({
  endpoints: ["https://api.windcrypto.com"],
  chainId: "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
  contracts: {
    system: "vexcore",
    token: "vex.token",
  },
});

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
```

`PrivateKeySigner` is intended for environments where application-managed keys are appropriate. Wallets, hardware signers, remote signers, and secure-storage integrations can implement the exported `Signer` interface and receive the chain ID, transaction, serialized bytes, digest, and required keys in one signing request.

K1 available keys use the legacy `EOS...` representation by default for broad compatibility with older Antelope node software. Applications that require modern K1 public-key strings can set `k1PublicKeyFormat: "modern"` on `PrivateKeySigner`.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses Web-standard byte and networking APIs and does not require Node.js `Buffer` for the Antelope transaction path.

The high-level client accepts one or more RPC endpoints. Transaction broadcast is intentionally not retried automatically when the response is uncertain.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
