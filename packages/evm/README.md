# @windstack/evm

## Overview

`@windstack/evm` provides a browser client for EIP-1193 wallet providers with EIP-6963 provider discovery. It supports account access, chain queries, chain switching, chain registration, request forwarding, provider events, and VEX EVM network identifiers.

The client prefers announced EIP-6963 providers and can use `window.ethereum` when no announced provider is available.

## Installation

```bash
npm install @windstack/core @windstack/evm
```

## Usage

```ts
import { createEVMClient } from "@windstack/evm";

const client = await createEVMClient();
const accounts = await client.connect();
const chainId = await client.getChainId();

client.on("accountsChanged", (nextAccounts) => {
  console.log(nextAccounts);
});

await client.switchChain("0x1a50");
```

VEX EVM can be registered with standard EIP-3085 chain metadata:

```ts
await client.addChain({
  chainId: "0x1a50",
  chainName: "VEX EVM",
  nativeCurrency: {
    name: "Vexanium",
    symbol: "VEX",
    decimals: 18,
  },
  rpcUrls: ["https://api.windcrypto.com/rpc"],
});
```

## Security

Chain identifiers must use canonical `0x`-prefixed hexadecimal values. Applications should verify the chain ID returned by a newly supplied RPC endpoint before presenting that endpoint to users or requesting wallet registration.

## Runtime

The package targets browser environments with wallet providers. It forwards requests to the selected EIP-1193 provider and does not contain private-key storage or transaction-signing code of its own.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
