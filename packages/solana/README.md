# @windstack/solana

## Overview

`@windstack/solana` provides a client for compatible Solana browser-wallet providers. It supports account access, provider requests, message signing, disconnect handling, account normalization, and provider error preservation.

The package focuses on wallet-provider communication and does not bundle a Solana transaction library.

## Installation

```bash
npm install @windstack/core @windstack/solana
```

## Usage

```ts
import { createSolanaClient } from "@windstack/solana";

const client = await createSolanaClient();
const accounts = await client.connect();

const result = await client.signMessage(
  new TextEncoder().encode("Sign in to My App"),
  accounts[0]?.publicKey,
);

console.log(result);
```

The client reads the wallet provider exposed in the browser, forwards requests, normalizes account payloads, and preserves numeric provider error codes so applications can handle wallet responses consistently.

## Runtime

The package targets browser environments that expose a compatible Solana wallet provider. It does not manage private keys and does not include a Solana transaction serializer.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
