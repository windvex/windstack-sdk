# WindStack SDK

[![Build](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml/badge.svg)](https://github.com/windvex/windstack-sdk/actions/workflows/validate.yml)

WindStack is a modern TypeScript SDK that makes Vexanium application development direct and predictable.

The intended developer flow is:

```text
install WindStack → configure Vexanium → connect wallet → interact with blockchain
```

Not:

```text
install SDK → build compatibility layer → build ABI helper → build transaction helper → build provider adapter → interact with blockchain
```

WindStack keeps the protocol machinery inside the SDK: RPC access, ABI loading and caching, contract actions, account operations, TAPOS, canonical transaction serialization, wallet capability negotiation, exact signing, multi-action review data, Vexanium Signing Requests, and broadcasting.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.

## Install

For normal Vexanium applications:

```bash
npm install @windstack/vexanium
```

Additional packages expose lower-level protocol primitives for applications that need them, but they are not required to build a normal wallet-connected Vexanium application.

## Quick start

```ts
import { createVexaniumClient } from "@windstack/vexanium";

const vex = await createVexaniumClient({
  dapp: {
    name: "My App",
    url: "https://app.example",
    icon: "https://app.example/icon.png",
  },
});

const account = await vex.connectOne();

await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "receiver",
        quantity: "1.0000 VEX",
        memo: "WindStack",
      },
    },
  ],
});
```

WindStack automatically loads the contract ABI, encodes structured action data, applies the connected wallet permission, prepares TAPOS, serializes the canonical transaction, sends the structured transaction and exact bytes to the wallet, validates the signing boundary, and broadcasts the result.

## Multi-action transactions

Multi-action is a first-class transaction shape. No extra compatibility or transaction helper is required.

```ts
await vex.transact({
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      data: {
        from: account.actor,
        to: "swapv2.wind",
        quantity: "2.0000 VEX",
        memo: "liquidity",
      },
    },
    {
      account: "token.wind",
      name: "transfer",
      data: {
        from: account.actor,
        to: "swapv2.wind",
        quantity: "3.00000000 WIND",
        memo: "liquidity",
      },
    },
  ],
});
```

The structured transaction is preserved through the signing boundary so a wallet can inspect every action without reconstructing the request from opaque packed bytes.

## Vexanium Signing Request

Portable signing flows use VSR and the `vsr:` URI scheme.

```ts
const uri = await vex.createSigningRequest({
  broadcast: true,
  actions: [
    {
      account: "vex.token",
      name: "transfer",
      authorization: [{ actor: account.actor, permission: account.permission }],
      data: {
        from: account.actor,
        to: "receiver",
        quantity: "1.0000 VEX",
        memo: "VSR",
      },
    },
  ],
});

const request = vex.parseSigningRequest(uri);
```

Client-bound VSR creation uses the same configured Vexanium RPC and ABI cache as normal contract interaction. Vexanium-facing signing requests are restricted to the configured Vexanium chain.

## Configure RPC

WindStack ships with the Vexanium Mainnet defaults. An application may provide another trusted Vexanium RPC endpoint while keeping the same client API:

```ts
const vex = await createVexaniumClient({
  rpcUrl: "https://my-vexanium-rpc.example",
});
```

The RPC configuration is shared across account access, contracts, ABI loading, transaction preparation, VSR creation, and broadcasting.

## Vexanium Mainnet

| Setting | Value |
| --- | --- |
| Chain ID | `f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f` |
| RPC | `https://api.windcrypto.com` |
| System contract | `vexcore` |
| Native token contract | `vex.token` |
| Native symbol and precision | `VEX`, `4` |
| VEX EVM chain ID | `6736` (`0x1a50`) |

## Package architecture

WindStack is modular internally so applications can use lower-level primitives when required without duplicating implementation outside the SDK.

| Package | Purpose |
| --- | --- |
| `@windstack/vexanium` | Primary Vexanium application client, chain presets, provider protocol, VSR, explorer and VEX EVM integration |
| `@windstack/wallet-plugin-wisp` | Wisp Wallet integration for the generic session layer |
| `@windstack/session` | Runtime-neutral wallet/session orchestration |
| `@windstack/antelope` | Transaction, TAPOS, signing and Vexanium-compatible chain primitives |
| `@windstack/contract` | ABI-aware contract actions and shared ABI caching |
| `@windstack/account` | Token, resource, governance, account and permission operations |
| `@windstack/abi` | Binary ABI codec, names, exact assets and action serialization |
| `@windstack/rpc` | Typed chain RPC, endpoint verification, failover, finality and history APIs |
| `@windstack/crypto` | K1/R1 keys, signatures, recovery and cryptographic primitives |
| `@windstack/core` | Shared provider, numeric and protocol utilities |
| `@windstack/signing-request` | Native VSR encoding, parsing, resolution, inspection and callbacks |
| `@windstack/evm` | Generic EVM primitives used by VEX EVM integration |

The package boundaries are implementation choices, not steps that normal application developers must manually assemble.

## Reliability and security

WindStack validates chain identity, canonical transaction encoding, packed transaction bounds, wallet capabilities, signatures, ABI payloads, large integer representations, checksums, bridge calldata, and finality states at the relevant boundaries.

Read failover verifies endpoints against the configured chain. Broadcast calls are not automatically retried. Multi-action order and authorization data are preserved. Context-free data remains part of the exact signing boundary.

## Runtime

WindStack is ESM-first and targets current maintained JavaScript runtimes. Browser-facing packages use Web APIs. Node-specific keosd transport remains isolated from browser entrypoints.

## Documentation

- [Release changes](CHANGELOG.md)
- [Supported capabilities](docs/capability-matrix.md)
- [VexaniumProvider v1](VEXANIUM-PROVIDER-V1.md)
- Package-level API guides under `packages/*/README.md`

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
