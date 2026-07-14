# @windstack/session

Optional application-level session facade for EVM, Solana, and Vexanium providers.

Use this package only when one application needs a common `connect`, `invoke`, and `disconnect` interface across chain families. A VEX Native-only app should use WharfKit SessionKit with `@windstack/wallet-plugin-wisp` instead.

```bash
npm install @windstack/session
```

```ts
import { createWispSessionClient } from "@windstack/session";

const client = await createWispSessionClient({
  dapp: { name: "My App", url: "https://app.example" },
});

const session = await client.connect([
  "eip155:6736",
  "antelope:f9f432b1851b5c179d2091a96f593aa",
]);

await client.invoke({
  scope: "eip155:6736",
  request: { method: "eth_chainId" },
});
```

A session accepts at most one scope per chain family. The EVM scope must match the provider's active chain; the facade will not report an account as authorized on a different chain.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
