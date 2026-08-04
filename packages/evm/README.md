# @windstack/evm

Small EIP-1193 client with EIP-6963 discovery for browser wallets.

```bash
npm install @windstack/core @windstack/evm
```

```ts
import { createEVMClient } from "@windstack/evm";

const client = await createEVMClient();
const accounts = await client.connect();
const chainId = await client.getChainId();

client.on("accountsChanged", (nextAccounts) => {
  // Update application state.
});
```

`connect()` calls `eth_requestAccounts`. `getAccounts()` calls the silent `eth_accounts` method.
`EVM_METHODS` exposes the canonical MetaMask-compatible method names implemented by Wisp, while `VEX_EVM_CHAIN_ID`, `VEX_EVM_CHAIN_ID_HEX`, and `VEX_EVM_SCOPE` expose the VEX EVM network identifiers.

## Chain requests

```ts
await client.switchChain("0x1a50");

await client.addChain({
  chainId: "0x1a50",
  chainName: "VEX EVM",
  nativeCurrency: { name: "Vexanium", symbol: "VEX", decimals: 18 },
  rpcUrls: ["https://rpc.example"],
});
```

Chain IDs must be canonical `0x`-prefixed hexadecimal values. Chain metadata URLs must use HTTPS. Always verify an RPC endpoint's `eth_chainId` response before presenting it to users.

EIP-6963 announcements are retained for the lifetime of the page, as required by the specification. `window.ethereum` is only used as a fallback when no announced provider is available.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
