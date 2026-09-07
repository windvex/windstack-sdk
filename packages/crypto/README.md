# @windstack/crypto

## Overview

`@windstack/crypto` provides Antelope-compatible K1 and R1 key handling for WindStack applications. It supports private keys, public keys, recoverable signatures, signature verification, public-key recovery, modern Antelope encodings, legacy EOS public keys, and legacy K1 WIF private keys.

The package uses Noble curve and hash primitives while keeping the public API based on `Uint8Array` and Antelope key formats.

## Installation

```bash
npm install @windstack/crypto
```

## Usage

```ts
import { PrivateKey, sha256Digest } from "@windstack/crypto";

const privateKey = PrivateKey.fromString("PVT_K1_...");
const publicKey = privateKey.toPublicKey();
const digest = sha256Digest(new TextEncoder().encode("WindStack"));
const signature = privateKey.signDigest(digest);

console.log(signature.toString());
console.log(signature.verifyDigest(digest, publicKey));
console.log(signature.recoverDigest(digest).equals(publicKey));
```

K1 signatures are emitted in the canonical compact form required by Antelope-compatible chains. K1 public keys can also be converted to the legacy `EOS...` representation when interacting with older node software.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide the secure randomness required by key generation. Existing keys can be imported with `PrivateKey.fromString()` or `PrivateKey.fromBytes()`.

Private keys should be stored and used through an appropriate secure storage or signing boundary. Application logs should never contain private-key material.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
