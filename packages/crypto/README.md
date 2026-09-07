# @windstack/crypto

## Overview

`@windstack/crypto` provides K1 and R1 key handling for WindStack and Vexanium applications. It supports private keys, public keys, recoverable signatures, signature verification, public-key recovery, current Antelope key encodings, and compatibility with older K1 key encodings used by existing Vexanium accounts and node software.

The public API is based on `Uint8Array`. Elliptic-curve and hashing primitives are provided by the Noble libraries.

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

K1 signatures are emitted in the canonical compact form required by Vexanium-compatible transaction signing. Existing K1 private and public keys can be imported through the compatibility parsers without changing their key material.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide secure platform randomness for key generation. Existing keys can be imported with `PrivateKey.fromString()` or `PrivateKey.fromBytes()`.

## Security

Private keys should be held by an appropriate secure storage or signing boundary. Digest signing accepts exactly 32 bytes, and application logs should never contain private-key material.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
