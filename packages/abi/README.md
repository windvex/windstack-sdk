# @windstack/abi

## Overview

`@windstack/abi` serializes and deserializes Antelope ABI values without requiring Node.js buffer APIs. It supports ABI aliases, structs and inheritance, arrays, optional values, binary extensions, variants, action types, table types, names, assets, symbols, keys, signatures, timestamps, checksums, integer types, floating-point values, and raw bytes.

The package also exposes `BinaryWriter`, `BinaryReader`, `nameToBigInt()`, `bigIntToName()`, `hexToBytes()`, and `bytesToHex()` for applications that need direct access to Antelope binary primitives.

## Installation

```bash
npm install @windstack/abi
```

## Usage

```ts
import { AbiSerializer } from "@windstack/abi";

const abi = {
  version: "eosio::abi/1.2",
  structs: [
    {
      name: "transfer",
      base: "",
      fields: [
        { name: "from", type: "name" },
        { name: "to", type: "name" },
        { name: "quantity", type: "asset" },
        { name: "memo", type: "string" },
      ],
    },
  ],
  actions: [{ name: "transfer", type: "transfer" }],
};

const serializer = new AbiSerializer(abi);
const bytes = serializer.encodeAction("transfer", {
  from: "alice",
  to: "bob",
  quantity: "1.0000 VEX",
  memo: "WindStack",
});

const decoded = serializer.decodeAction("transfer", bytes);
```

Numeric values are range-checked before encoding. Fixed-size checksums, public keys, signatures, names, symbols, and optional markers are validated before they are accepted.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. It uses `Uint8Array`, `DataView`, `TextEncoder`, and `TextDecoder`, making the serializer suitable for browser and React Native environments that provide these Web APIs.

`float128` values are represented as their exact 16-byte binary form because JavaScript does not provide a native IEEE-754 binary128 number type.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
