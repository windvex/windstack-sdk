# @windstack/session

WindStack native Antelope session orchestration. It provides a small SessionKit-style abstraction over `@windstack/antelope` without WharfKit.

Created by **Gilang Ramadan**.

```ts
import { SessionKit } from "@windstack/session";

const kit = new SessionKit({ chains: [{ id: "...", url: "https://api.example" }], walletPlugins: [myWalletPlugin] });
const session = await kit.login();
await session.transact({ actions: [action] });
```

MIT © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
