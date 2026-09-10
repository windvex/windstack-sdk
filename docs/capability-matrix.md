# WindStack Supported Capabilities

## Overview

WindStack provides a high-level Vexanium client together with independently installable packages for applications that need direct access to lower-level blockchain primitives.

| Package | Supported capabilities |
| --- | --- |
| `@windstack/vexanium` | Vexanium client, wallet connection, structured and multi-action transactions, VSR, account and contract access, explorer routes, bridge utilities, and VEX EVM metadata/action decoding |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet discovery, account authorization, Vexanium transaction signing, and session integration |
| `@windstack/session` | Wallet plugins, login, restore, persistence, logout, and transaction orchestration |
| `@windstack/antelope` | TAPOS, transaction preparation, canonical serialization/deserialization, digest and ID calculation, signers, required keys, broadcast, and keosd |
| `@windstack/contract` | ABI loading and caching, structured action serialization, contract access, and table queries |
| `@windstack/account` | Token balances and transfers, resources, RAM, voting, producers, account creation, and permissions |
| `@windstack/abi` | ABI codec, names, assets, extended assets, token identity, and checked precision conversion |
| `@windstack/rpc` | Typed chain RPC, endpoint verification and failover, cancellation, Spring transaction state, Hyperion history, and transaction submission |
| `@windstack/signing-request` | VSR encoding, parsing, compression, callbacks, action inspection, ABI-aware decoding, resolution, transactions, identity requests, and verification |
| `@windstack/crypto` | K1/R1 keys, canonical signatures, verification, recovery, WIF, and supported modern/legacy key encodings |
| `@windstack/core` | Provider errors and events, exact decimal and basis-point operations, AMM quotes, routes, and liquidity math |
| `@windstack/evm` | Generic EVM JSON-RPC, EIP-1193 wallet access, EIP-6963 discovery, and address/chain utilities |
| `@windstack/solana` | Generic Solana browser-wallet provider access, account normalization, requests, and message signing |

## Vexanium client

The main Vexanium application API is `createVexaniumClient()` from `@windstack/vexanium`.

```ts
const account = await vex.connectOne();

await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "bob",
        quantity: "1.0000 VEX",
        memo: "Example transfer",
      },
    },
  ],
});
```

`transact()` supports ABI-aware structured actions, wallet authorization, TAPOS preparation, canonical transaction serialization, signing, and optional broadcast.

## Multi-action transactions

Multiple actions can be supplied in one transaction. Action order and authorization are preserved, and wallets receive both canonical serialized bytes and the corresponding structured transaction for review.

## Vexanium Signing Request

Vexanium Signing Requests use the `vsr:` URI scheme.

```text
client.createSigningRequest → vsr: URI → client.parseSigningRequest / client.signSigningRequest
```

Client-bound VSR operations use the configured Vexanium RPC and ABI cache and are restricted to the configured Vexanium chain.

## Vexanium Mainnet

| Setting | Value |
| --- | --- |
| Chain ID | `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f` |
| RPC | `https://api.windcrypto.com` |
| System contract | `vexcore` |
| Native token contract | `vex.token` |
| Native symbol | `VEX` |
| Precision | `4` |
| VEX EVM chain ID | `6736` (`0x1a50`) |

## Runtime

WindStack targets modern ESM environments. Packages used directly in Node.js require Node.js 20.19 or newer. Browser and React Native packages use standard Web APIs where applicable.

## Documentation audiences

- Application developers: start with `README.md` and `packages/vexanium/README.md`.
- Package users: use the README shipped with the package being installed.
- Wallet/provider implementers: use `VEXANIUM-PROVIDER-V1.md` for the provider wire contract and security requirements.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
