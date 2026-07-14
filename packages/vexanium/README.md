# @windstack/vexanium

Vexanium provider client, chain metadata, signing requests, and explorer helpers.

```bash
npm install @windstack/vexanium
```

The package uses the current WharfKit Antelope and Signing Request libraries. It does not define a second transaction serializer.

## Network Metadata

```ts
import { vexEvm, vexNative } from "@windstack/vexanium";
```

VEX Native:

- Chain ID: `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f`
- CAIP-2 scope: `antelope:f9f432b1851b5c179d2091a96f593aa`
- RPC/API base: `https://api.windcrypto.com`
- Token: `VEX`, precision 4

VEX EVM:

- Chain ID: `6736` (`0x1a50`)
- Native currency: `VEX`, 18 decimals
- JSON-RPC: `https://api.windcrypto.com/rpc`
- Indexed data API: `https://api.windcrypto.com/v3/evm`
- Live stats: `https://api.windcrypto.com/v3/evm/stats`
- Explorer: `https://explorer.windcrypto.com/evm`

Use `vexEvm.rpcUrl` with JSON-RPC clients and `wallet_addEthereumChain`. The indexed API remains a separate REST service.

## Connect

```ts
import { createVexaniumClient, vexNative } from "@windstack/vexanium";

const client = await createVexaniumClient({
  dapp: {
    name: "My App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

let accounts = await client.getAccounts();
if (accounts.length === 0) {
  accounts = await client.connect({ chainId: vexNative.chainId });
}
```

The client discovers providers announced on the page or exposed as `window.vexanium`. `providerInfo` is required, so the SDK never invents a wallet name for an unknown provider.

`getAccounts()` checks an existing permission without prompting. `connect()` requests permission and creates an in-memory session mirror. Provider events and browser focus/visibility changes keep that mirror in sync.

```ts
const unsubscribe = client.subscribeSession(({ session, reason }) => {
  updateWalletState(session, reason);
});

unsubscribe();
client.destroy();
```

## SessionKit

For a normal VEX Native dApp, use `@windstack/wallet-plugin-wisp`. SessionKit resolves the transaction and the plugin forwards the exact serialized bytes to the provider.

```bash
npm install @windstack/wallet-plugin-wisp @wharfkit/session
```

Direct exact-byte signing is also available:

```ts
const result = await client.signTransaction({
  chainId: vexNative.chainId,
  serializedTransaction: "00a1",
  account: "alice",
  permission: "active",
});
```

The client validates the full chain ID, serialized hex, Antelope names, and returned signatures before accepting the result.

## Vexanium Signing Requests

Use VSR for a request that must travel through a QR code, link, clipboard, or external wallet.

```ts
import { createSigningRequest, parseSigningRequest, vexNative } from "@windstack/vexanium";

const uri = await createSigningRequest({
  chainId: vexNative.chainId,
  broadcast: true,
  action: {
    account: "vex.token",
    name: "transfer",
    authorization: [{ actor: "alice", permission: "active" }],
    data: {
      from: "alice",
      to: "bob",
      quantity: "1.0000 VEX",
      memo: "",
    },
  },
}, { compress: true });

const request = parseSigningRequest(uri);
```

New requests are encoded as `vsr:`. When `compress: true` is used, the SDK supplies its built-in zlib implementation for both encoding and parsing. Existing `esr:` input is accepted because the payload is parsed by WharfKit's Signing Request implementation. A custom `options.zlib` provider can still be supplied for specialized runtimes.

## Utilities

```ts
import {
  buildExplorerAccountUrl,
  buildExplorerTxUrl,
  formatAsset,
  mapExplorerTransaction,
  parseAsset,
} from "@windstack/vexanium";

const asset = parseAsset("-1.2500 VEX");
const value = formatAsset(asset.amount, asset.precision, asset.symbol);
```

Explorer URL builders encode path segments. `mapExplorerTransaction` maps common node and indexer response shapes into the explorer view model while preserving the raw response. It does not decode, rebuild, or serialize an Antelope transaction.

## Provider Authors

The wallet contract, methods, errors, events, and security boundary are documented in the repository's `VEXANIUM-PROVIDER-V1.md` file.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
