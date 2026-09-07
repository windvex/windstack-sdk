# @windstack/abi

## Overview

`@windstack/abi` serializes and deserializes Antelope ABI values without requiring Node.js buffer APIs. It supports ABI aliases, structs and inheritance, arrays, optional values, binary extensions, variants, action types, table types, names, assets, symbols, keys, signatures, timestamps, checksums, integer types, floating-point values, and raw bytes.

The package also exposes exact `parseAsset()`, `formatAsset()`, `parseExtendedAsset()`, `tokenIdentityFromAsset()`, and `convertAssetPrecision()` helpers. Asset amounts are bigint units constrained to the Antelope `±(2^62−1)` range; unsafe JavaScript numbers are rejected.

## Installation

```bash
npm install @windstack/abi
```

## Usage

A serializer can be created from an ABI returned by an Antelope RPC endpoint:

```ts
import { AbiSerializer } from "@windstack/abi";
import { RpcClient } from "@windstack/rpc";

const rpc = new RpcClient({ endpoints: "https://node.example" });
const { abi } = await rpc.getAbi("token.cntrct");
const serializer = new AbiSerializer(abi);

const bytes = serializer.encodeAction("transfer", {
  from: "alice",
  to: "bob",
  quantity: "1.0000 TKN",
  memo: "example",
});

const decoded = serializer.decodeAction("transfer", bytes);
```

```ts
import { convertAssetPrecision, parseExtendedAsset, tokenIdentityFromAsset } from "@windstack/abi";

const extended = parseExtendedAsset("1.2500 TKN@token.cntrct");
const token = tokenIdentityFromAsset(extended);
const wholeUnits = convertAssetPrecision(extended.quantity.amount, 4, 0, "reject");
```

Numeric values are range-checked before encoding. Fixed-size checksums, public keys, signatures, names, symbols, and optional markers are validated before they are accepted.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses `Uint8Array`, `DataView`, `TextEncoder`, and `TextDecoder`, making the serializer suitable for browser and React Native environments that provide these Web APIs.

`float128` values are represented as their exact 16-byte binary form because JavaScript does not provide a native IEEE-754 binary128 number type.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
