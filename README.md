# WindStack SDK

Modern TypeScript SDKs for Antelope/Vexanium, Wisp Wallet, EVM, and Solana.

**Created by Gilang Ramadan** · Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI · MIT.

## Native Antelope v1

The new Antelope stack is built from protocol specifications and Web-standard APIs; it is **not a WharfKit fork**.

| Package | Purpose |
| --- | --- |
| `@windstack/crypto` | K1/R1 private keys, public keys, recoverable signatures, Antelope encodings |
| `@windstack/abi` | ABI binary codec, names/assets/symbols, structs, aliases, variants |
| `@windstack/rpc` | Typed nodeos RPC with timeout/failover/AbortSignal |
| `@windstack/contract` | ABI-aware actions, tables and ABI cache |
| `@windstack/account` | Account, token balance and system-action helpers |
| `@windstack/antelope` | TAPOS, transaction serialization, digest, signing, broadcast, unified client |
| `@windstack/session` | Native SessionKit-style wallet/session orchestration |

The v1 native package graph does not depend on `@wharfkit/*`, `elliptic`, `bn.js`, `crypto-browserify`, or Node Buffer APIs. Crypto primitives use current Noble packages (`@noble/curves` and `@noble/hashes`). Noble v2 is ESM-only, so Node.js **20.19+** is required when running directly on Node.

```bash
npm install @windstack/antelope @windstack/session
```

```ts
import { AntelopeClient } from "@windstack/antelope";

const client = new AntelopeClient({ endpoints: ["https://api.windcrypto.com"] });
const token = client.contract("vex.token");
const action = await token.action("transfer", {
  from: "alice",
  to: "bob",
  quantity: "1.0000 VEX",
  memo: "WindStack",
}, ["alice@active"]);
```

## Existing packages

`@windstack/core`, `@windstack/evm`, `@windstack/solana`, `@windstack/vexanium`, and `@windstack/wallet-plugin-wisp` remain in this monorepo for compatibility. The legacy Vexanium/WharfKit integration is not a dependency of the seven native Antelope v1 packages above.

## Development

```bash
npm install
npm run validate:native
npm run validate
```

## Publish native packages from VPS

Authenticate to npm first (`npm whoami`). Then:

```bash
npm install
npm run release:dry-run
npm run release:npm
```

`release:npm` publishes only the seven native packages, in dependency order.

## License

MIT. Created by Gilang Ramadan; copyright PT WIND KRIPTOGRAFI TEKNOLOGI.
