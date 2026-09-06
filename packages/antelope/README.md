# @windstack/antelope

The WindStack native Antelope SDK. It builds TAPOS transactions, serializes canonical Antelope transaction bytes, calculates signing digests, resolves required keys, signs through a pluggable signer, broadcasts to nodeos, and exposes RPC/contract/account helpers.

It is built from Antelope protocol formats, not cloned from WharfKit. The new dependency graph has no `@wharfkit/*`, `elliptic`, or `bn.js`.

Created by **Gilang Ramadan**.

```ts
import { AntelopeClient, PrivateKey, PrivateKeySigner } from "@windstack/antelope";

const client = new AntelopeClient({ endpoints: "https://api.example" });
const signer = new PrivateKeySigner([PrivateKey.fromString("PVT_K1_...")]);
const token = client.contract("vex.token");
const action = await token.action("transfer", { from: "alice", to: "bob", quantity: "1.0000 VEX", memo: "" }, ["alice@active"]);
await client.transact({ actions: [action], signer });
```

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
