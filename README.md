# Wind Stack SDK

TypeScript packages used by Wind Stack applications and Wisp Wallet integrations.

The SDK keeps each chain integration separate. VEX Native applications use WharfKit SessionKit and the Wisp wallet plugin. EVM applications use the standard EIP-1193 provider interface, with EIP-6963 discovery when a wallet supports it.

## Packages

| Package | Use it for |
| --- | --- |
| `@windstack/core` | Provider contract, errors, events, dApp metadata, and shared types |
| `@windstack/evm` | EIP-1193 requests and EIP-6963 wallet discovery |
| `@windstack/solana` | Wisp-compatible Solana provider requests |
| `@windstack/vexanium` | Vexanium provider access, chain metadata, VSR, and explorer helpers |
| `@windstack/wallet-plugin-wisp` | Wisp integration for WharfKit SessionKit |
| `@windstack/session` | An optional facade for apps that need more than one chain family |

All published packages are ESM and require Node.js 18 or newer.

## VEX Native

Install the Vexanium package, the wallet plugin, and WharfKit:

```bash
npm install @windstack/vexanium @windstack/wallet-plugin-wisp \
  @wharfkit/session @wharfkit/antelope @wharfkit/signing-request
```

```ts
import { SessionKit } from "@wharfkit/session";
import { WispWalletPlugin } from "@windstack/wallet-plugin-wisp";
import { vexNative } from "@windstack/vexanium";

const sessionKit = new SessionKit({
  appName: "My Vexanium App",
  chains: [{ id: vexNative.chainId, url: vexNative.rpcUrl }],
  walletPlugins: [new WispWalletPlugin()],
});

const { session } = await sessionKit.login();

await session.transact({
  action: {
    account: "vex.token",
    name: "transfer",
    authorization: [session.permissionLevel],
    data: {
      from: session.actor,
      to: "receiver",
      quantity: "1.0000 VEX",
      memo: "",
    },
  },
});
```

SessionKit resolves the signer, ABI data, TAPOS, and transaction. `WispWalletPlugin` sends the resulting serialized bytes to `vex_signTransaction` without rebuilding the transaction.

### Direct provider access

Use the lower-level client when SessionKit is not responsible for the flow:

```ts
import { createVexaniumClient, vexNative } from "@windstack/vexanium";

const client = await createVexaniumClient({
  dapp: {
    name: "My Vexanium App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

let accounts = await client.getAccounts();
if (accounts.length === 0) {
  accounts = await client.connect({ chainId: vexNative.chainId });
}
```

`getAccounts()` is a silent read. `connect()` may open the wallet approval screen.

### Portable requests

Vexanium Signing Requests use the `vsr:` URI scheme. The payload is handled by WharfKit's Signing Request library. Existing `esr:` input is validated by WharfKit and forwarded without rewriting the URI or encoded transaction.

```ts
import { createSigningRequest, vexNative } from "@windstack/vexanium";

const request = await createSigningRequest({
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
});
```

Use VSR for QR codes, links, and other portable requests. Do not wrap a transaction that SessionKit has already resolved; the wallet plugin signs those exact bytes directly.

## VEX EVM

VEX EVM uses chain ID `6736` (`0x1a50`) and 18 decimals for its native VEX balance. Its public JSON-RPC endpoint is `https://api.windcrypto.com/rpc`, and its explorer starts at `https://explorer.windcrypto.com/evm`. Indexed EVM data is available at `https://api.windcrypto.com/v3/evm`, including the live stats endpoint at `https://api.windcrypto.com/v3/evm/stats`.

Use `vexEvm.rpcUrl` for JSON-RPC and `wallet_addEthereumChain`. The REST stats endpoint is for indexed network statistics, not provider requests.

For an injected EVM wallet:

```ts
import { createEVMClient } from "@windstack/evm";

const client = await createEVMClient();
const accounts = await client.connect();
const chainId = await client.getChainId();

if (chainId !== "0x1a50") {
  await client.switchChain("0x1a50");
}
```

## Provider Contract

Vexanium wallets expose `window.vexanium` and identify themselves through `providerInfo`. The SDK checks the provider shape, negotiates protocol version `1.x`, and verifies declared capabilities before connect or signing calls.

`WISP_PROVIDER_CONTRACT` from `@windstack/core` is the runtime single source for shared Wisp/Vexanium and EVM provider identity, methods, events, capabilities, and chain identifiers. The EVM and Vexanium packages derive their exported constants from that object.

The matching machine-readable specification is stored at [`specs/wisp-provider-contract.json`](./specs/wisp-provider-contract.json). Validation fails if the JSON specification, core export, or package constants drift apart. Wisp Wallet independently synchronizes its local runtime contract from this specification.

The full Vexanium wallet-facing contract is documented in [VEXANIUM-PROVIDER-V1.md](./VEXANIUM-PROVIDER-V1.md).

## Development

```bash
npm ci
npm run validate
```

`validate` runs a clean TypeScript build, provider/signing regression tests, canonical provider specification checks, and an npm package dry run for every workspace.

WharfKit is kept at its latest published package versions. npm currently reports a low-severity advisory in WharfKit's transitive `elliptic` dependency; there is no patched WharfKit release to upgrade to. The suggested npm remediation is an incompatible downgrade and is intentionally not applied.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
