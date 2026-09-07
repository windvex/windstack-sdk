# @windstack/evm

## Overview

`@windstack/evm` provides generic address and chain-ID normalization, a chain-verified HTTP JSON-RPC client, EIP-1193 wallet access, and EIP-6963 provider discovery.

The client uses announced EIP-6963 providers and can fall back to `window.ethereum`. A particular wallet is preferred only when `preferredRdns` is explicitly configured.

## Installation

```bash
npm install @windstack/core @windstack/evm
```

## Usage

```ts
import { EvmRpcClient, createEVMClient, normalizeEvmAddress } from "@windstack/evm";

const client = await createEVMClient();
const accounts = await client.connect();
const chainId = await client.getChainId();
const address = normalizeEvmAddress(accounts[0]);

const rpc = new EvmRpcClient({
  endpoints: ["https://rpc.example", "https://backup.example"],
  expectedChainId: chainId,
  maxResponseBytes: 4 * 1024 * 1024,
});
const blockNumber = await rpc.request("eth_blockNumber", [], { retry: "safe" });

client.on("accountsChanged", (nextAccounts) => {
  console.log(nextAccounts);
});

await client.switchChain("0x1a50");
```

Chain-specific metadata belongs in a chain package. For example, VEX EVM metadata is exported by `@windstack/vexanium` and can be registered with EIP-3085:

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
