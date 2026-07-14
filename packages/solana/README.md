# @windstack/solana

Provider client for the Solana interface exposed by Wisp-compatible wallets.

```bash
npm install @windstack/core @windstack/solana
```

```ts
import { createSolanaClient } from "@windstack/solana";

const client = await createSolanaClient();
const accounts = await client.connect();

const result = await client.signMessage(
  new TextEncoder().encode("Sign in to My App"),
  accounts[0]?.publicKey,
);
```

The client reads `window.solana`, forwards provider requests, normalizes account payloads, and preserves numeric provider error codes. It does not bundle a Solana transaction library.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
