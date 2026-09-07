# @windstack/crypto

## Overview

`@windstack/crypto` provides generic Antelope K1 and R1 key handling. It supports private keys, public keys, recoverable signatures, canonical K1 signing, signature verification, public-key recovery, WIF, modern key encodings, and legacy `VEX` and `EOS` K1 encodings.

The public API is based on `Uint8Array`. Elliptic-curve and hashing primitives are provided by the Noble libraries.

## Installation

```bash
npm install @windstack/crypto
```

## Usage

```ts
import { PrivateKey, normalizePublicKey, publicKeysEqual, sha256Digest } from "@windstack/crypto";

const privateKey = PrivateKey.fromString("PVT_K1_...");
const publicKey = privateKey.toPublicKey();
const digest = sha256Digest(new TextEncoder().encode("WindStack"));
const signature = privateKey.signDigest(digest);

console.log(signature.toString());
console.log(signature.verifyDigest(digest, publicKey));
console.log(signature.recoverDigest(digest).equals(publicKey));
console.log(publicKey.toLegacyString("VEX"));
console.log(normalizePublicKey("VEX..."));
console.log(publicKeysEqual("VEX...", "PUB_K1_..."));
```

K1 signatures are deterministic, low-S, recoverable, and emitted in Antelope canonical compact form. Legacy prefixes are display encodings: equivalent `VEX…`, `EOS…`, and `PUB_K1_…` values normalize to the same curve and key bytes.

## Runtime

The package is ESM-first and requires Node.js 20.19 or newer when used directly in Node.js. Browser and React Native environments must provide secure platform randomness for key generation. Existing keys can be imported with `PrivateKey.fromString()` or `PrivateKey.fromBytes()`.

## Security

Private keys should be held by an appropriate secure storage or signing boundary. Digest signing accepts exactly 32 bytes, and application logs should never contain private-key material.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
