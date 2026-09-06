# @windstack/crypto

Modern Antelope K1/R1 key and signature primitives for WindStack. Built from the Antelope key formats and Noble cryptography; no `elliptic`, `bn.js`, or Node crypto polyfill.

Created by **Gilang Ramadan**.

```bash
npm install @windstack/crypto
```

```ts
import { PrivateKey, sha256Digest } from "@windstack/crypto";

const key = PrivateKey.generate("K1");
const digest = sha256Digest(new TextEncoder().encode("hello"));
const signature = key.signDigest(digest);
console.log(signature.verifyDigest(digest, key.toPublicKey()));
```

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
