# VexaniumProvider v1

## Overview

`VexaniumProvider` defines the browser-facing contract between a Vexanium dApp and a compatible wallet provider. It standardizes provider identity, capability negotiation, account access, exact transaction signing, portable signing requests, events, errors, discovery, and the security boundary used for wallet permissions.

Protocol identifier: `VexaniumProvider`

Protocol version: `1.0.0`

Created by **Gilang Ramadan**.

## Provider object

A compatible provider exposes the following interface:

```ts
interface VexaniumProvider {
  providerInfo: VexaniumProviderInfo;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, handler: (payload: unknown) => void): void;
  off?(event: string, handler: (payload: unknown) => void): void;
  removeListener?(event: string, handler: (payload: unknown) => void): void;
}
```

`providerInfo` is required and contains the provider identity and supported Vexanium capabilities:

```ts
interface VexaniumProviderInfo {
  uuid: string;
  name: string;
  rdns: string;
  icon?: string;
  standard: "VexaniumProvider";
  version: string;
  chains: string[];
  capabilities: VexaniumCapability[];
}
```

A client must not invent missing provider identity. Providers that do not expose the required v1 shape are ignored during discovery.

## Version compatibility

The client and wallet negotiate semantic protocol versions through `vex_getCapabilities`.

Implementations of protocol v1 must share major version `1`. A provider using another major version is not considered compatible unless a future specification explicitly defines that compatibility.

## Capabilities

Protocol v1 defines these capability identifiers:

```text
vex.accounts
vex.sessions
vex.signTransaction
vex.signingRequest
vex.signMessage
vex.signDigest
vex.events
```

A provider declares its static capabilities in `providerInfo.capabilities` and returns the negotiated set from `vex_getCapabilities`.

## Capability negotiation

Request:

```ts
provider.request({
  method: "vex_getCapabilities",
  params: {
    standard: "VexaniumProvider",
    version: "1.0.0",
    requiredCapabilities: ["vex.accounts", "vex.sessions"],
  },
});
```

Response:

```ts
{
  standard: "VexaniumProvider",
  version: "1.0.0",
  capabilities: VexaniumCapability[],
  chains: string[],
  methods: string[],
}
```

The client rejects an incompatible major version or a missing required capability before account or signing flows continue.

## Account access

`vex_requestAccounts` is the interactive authorization request.

Request:

```ts
{
  standard: "VexaniumProvider",
  version: "1.0.0",
  dapp: DappMetadata,
  chainId?: string,
  requiredCapabilities?: VexaniumCapability[],
}
```

Response:

```ts
{
  standard: "VexaniumProvider",
  version: "1.0.0",
  sessionId: string,
  chainId: string,
  accounts: VexaniumAccount[],
  capabilities: VexaniumCapability[],
}
```

`sessionId` is required. `chainId` in a response is the complete 64-character Vexanium chain ID. A request may use either the complete chain ID or its `antelope:<32 hex characters>` CAIP-2 scope. Clients compare the two forms by their shared chain prefix.

`vex_getAccounts` is the non-interactive restore/read path and returns:

```ts
{
  sessionId: string,
  chainId: string,
  accounts: VexaniumAccount[],
}
```

## Exact transaction signing

`vex_signTransaction` signs the exact serialized Vexanium transaction supplied by the application or session layer.

```ts
{
  serializedTransaction: string;
  transaction?: Transaction;
  chainId: string;
  account: string;
  permission: string;
  sessionId?: string;
}
```

`serializedTransaction` is the authoritative byte representation and contains non-empty, even-length hexadecimal bytes. `transaction` is the canonical structured representation of those same bytes and is intended for wallet review, policy checks, and action inspection. WindStack session signers preserve this structure through the provider boundary instead of forcing wallets to reconstruct multi-action transactions from opaque bytes.

If `transaction` is present, a wallet must verify that serializing it produces exactly `serializedTransaction` before approval or signing. Wallets may also decode the packed bytes with `deserializeTransaction` and compare the result. A wallet must never display one structure to the user and sign different bytes.

`account` and `permission` must be valid Antelope names. A successful response contains at least one valid signature:

```ts
{
  signatures: string[];
  signer?: string;
  signerPermission?: string;
}
```

## Vexanium Signing Requests

`vex_signingRequest` is used for a request transported through a QR code, deep link, clipboard, or external wallet flow.

The canonical Vexanium URI scheme is:

```text
vsr://...
```

The payload follows the compatible Antelope signing-request format used by existing ecosystem tooling. Compatible input using the established alternate URI scheme may be accepted for interoperability, while newly created Vexanium requests use `vsr:`.

A successful signing-request response contains `signatures: string[]` and `broadcast: boolean`. Empty or malformed signature lists are rejected.

Wallets can use the WindStack signing-request inspection API to enumerate and ABI-decode single actions, action arrays, and full-transaction requests through one code path.

## Errors

Protocol v1 defines these provider error codes:

```text
4001    USER_REJECTED
4100    UNAUTHORIZED
4200    UNSUPPORTED_METHOD
4900    DISCONNECTED
4901    CHAIN_DISCONNECTED
-32002  REQUEST_PENDING
-32004  UNSUPPORTED_CHAIN
-32005  UNSUPPORTED_CAPABILITY
-32006  INCOMPATIBLE_VERSION
-32600  INVALID_REQUEST
-32601  METHOD_NOT_FOUND
-32602  INVALID_PARAMS
-32603  INTERNAL_ERROR
```

Errors expose a numeric `code` and a human-readable `message`. Optional `data` may carry structured context.

## Events

Compatible providers may emit:

```text
connect
accountsChanged
disconnect
chainChanged
message
```

`connect` uses the canonical connection response shape. `accountsChanged` uses the canonical accounts response shape.

## Discovery

A provider may be exposed through `window.vexanium` or provider announcement events. Discovery uses:

```text
vexanium:requestProvider
vexanium:announceProvider
```

A discovered provider must expose valid mandatory `providerInfo` before it is accepted.

## Security

`DappMetadata` is display metadata only. Wallet permission state must bind to an authoritative runtime or transport origin, such as the browser extension sender origin. A wallet must not use an origin supplied by application content as the permission boundary.

Exact transaction signing must preserve the bytes approved by the application and must not substitute a rebuilt transaction after user approval. Structured transaction review data must be verified against the authoritative serialized bytes before it is trusted for display or policy decisions.

## Runtime

The specification is transport-oriented and does not require a specific UI framework, storage implementation, or signing backend. Implementations may use browser extensions, mobile wallet bridges, embedded providers, or other trusted transports as long as the observable provider contract remains compatible.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.