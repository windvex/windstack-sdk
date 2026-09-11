# VexaniumProvider v1

## Audience

This document is the interoperability specification for wallet and provider implementers. Application developers normally use `@windstack/vexanium` and do not need to implement this protocol directly.

## Overview

`VexaniumProvider` defines the browser-facing contract between a Vexanium application and a compatible wallet. It standardizes provider identity, capability negotiation, account access, wallet-authoritative session restore, exact transaction signing, Vexanium Signing Requests, events, errors, discovery, and the security boundary used for wallet permissions.

Protocol identifier: `VexaniumProvider`

Protocol version: `1.1.0`

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

`providerInfo` is required and contains provider identity and supported Vexanium capabilities:

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

Protocol `1.1.0` adds explicit non-interactive `vex_restoreSession`. A v1 client may remain compatible with a `1.0.x` provider, but cold session restore is unavailable unless the provider advertises `vex_restoreSession` in its negotiated methods.

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

Capabilities may be requested incrementally. A client that has already negotiated account/session capabilities may negotiate an additional signing capability later without rebuilding the wallet session.

## Capability negotiation

Request:

```ts
provider.request({
  method: "vex_getCapabilities",
  params: {
    standard: "VexaniumProvider",
    version: "1.1.0",
    requiredCapabilities: ["vex.accounts", "vex.sessions"],
  },
});
```

Response:

```ts
{
  standard: "VexaniumProvider",
  version: "1.1.0",
  capabilities: VexaniumCapability[],
  chains: string[],
  methods: string[],
}
```

The client rejects an incompatible major version, undeclared chain/capability, or missing required capability before the affected operation continues. A feature introduced in a compatible minor version must also verify that its required method appears in `methods`.

## Account access

`vex_requestAccounts` is the interactive authorization request. It is the only account method that may create a new wallet authorization session.

Request:

```ts
{
  standard: "VexaniumProvider",
  version: "1.1.0",
  dapp: DappMetadata,
  chainId?: string,
  requiredCapabilities?: VexaniumCapability[],
}
```

Response:

```ts
{
  standard: "VexaniumProvider",
  version: "1.1.0",
  sessionId: string,
  chainId: string,
  accounts: VexaniumAccount[],
  capabilities: VexaniumCapability[],
}
```

`sessionId` is required and is an opaque identifier issued by the wallet. It is not a signing secret. `chainId` in a response is the complete 64-character Vexanium chain ID. A request may use either the complete chain ID or the Vexanium CAIP-2 scope. Clients compare supported forms against the configured Vexanium chain.

`vex_getAccounts` is a non-interactive read/synchronization path for the provider's current runtime session and returns:

```ts
{
  sessionId: string,
  chainId: string,
  accounts: VexaniumAccount[],
}
```

A fresh application runtime must not infer that an old session is valid merely because a local `sessionId` exists. Cold restore uses `vex_restoreSession`.

## Session restore

`vex_restoreSession` restores a wallet-authoritative session without interactive approval.

Request:

```ts
{
  standard: "VexaniumProvider",
  version: "1.1.0",
  sessionId: string,
  chainId: string,
  dapp: DappMetadata,
}
```

A successful response uses the same canonical connection response shape as `vex_requestAccounts` and must return the same `sessionId` and chain:

```ts
{
  standard: "VexaniumProvider",
  version: "1.1.0",
  sessionId: string,
  chainId: string,
  accounts: VexaniumAccount[],
  capabilities: VexaniumCapability[],
}
```

The provider must bind restore to wallet-owned authorization state and an authoritative runtime or transport origin. `DappMetadata` is display metadata and cannot establish authorization.

Restore is strictly non-interactive. A provider must never create a new session, change the authorized account, permission, or chain, or fall back to `vex_requestAccounts` when restore fails. Unknown, expired, revoked, origin-mismatched, or otherwise invalid sessions fail with `UNAUTHORIZED`, `DISCONNECTED`, or another applicable provider error.

Disconnect or wallet-side revocation invalidates the session for future restore. A client that receives a revoked/unknown-session failure must clear its local opaque session reference.

## Exact transaction signing

`vex_signTransaction` signs the exact canonical Vexanium transaction supplied by WindStack.

```ts
{
  serializedTransaction: string;
  serializedContextFreeData?: string;
  transaction?: Transaction;
  chainId: string;
  account: string;
  permission: string;
  sessionId?: string;
}
```

`serializedTransaction` is the authoritative byte representation and contains non-empty, even-length hexadecimal bytes. `transaction` is the canonical structured representation of those exact bytes and is intended for wallet review, policy checks, and action inspection.

`serializedContextFreeData` is the canonical packed context-free-data byte representation. An empty or omitted value means no context-free data. Wallets that compute or verify the transaction signing digest must include this value according to the Vexanium transaction digest rules.

If `transaction` is present, the wallet must verify that serializing it produces exactly `serializedTransaction` before approval or signing. A wallet must never display one transaction structure to the user and sign different bytes.

`account` and `permission` must be valid Vexanium account/permission names. A successful response contains at least one valid signature:

```ts
{
  signatures: string[];
  signer?: string;
  signerPermission?: string;
}
```

When `signer` or `signerPermission` is returned, it must match the requested wallet permission.

A restored connection does not grant silent signing. Transaction review, vault unlock, risk policy, and signing approval remain wallet responsibilities and are separate from connection restore.

## Vexanium Signing Requests

`vex_signingRequest` handles portable Vexanium requests transported through QR codes, deep links, clipboard flows, or wallet bridges.

The Vexanium URI scheme is exclusively:

```text
vsr:...
```

A `VexaniumProvider` v1 implementation must treat other signing-request URI schemes as invalid input. Newly created and accepted provider-level signing requests target the configured Vexanium chain.

A successful response contains `signatures: string[]` and `broadcast: boolean`. Empty or malformed signature lists are rejected.

Wallets can use WindStack's signing-request inspection API to enumerate and ABI-decode single actions, action arrays, and full transactions. Multi-action order and authorization data must be preserved.

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

`DappMetadata` is display metadata only. Wallet permission state must bind to an authoritative runtime or transport origin, such as the browser extension sender origin or an authenticated wallet bridge. A wallet must not use an origin supplied by application content as the permission boundary.

A dApp may persist the opaque wallet `sessionId` needed for restore, but it must never receive or persist a wallet password, PIN, decrypted private key, or signing secret. Wallet-side session records remain authoritative and revocable.

Persistent connection, trusted-dApp policy, vault unlock state, and transaction signing approval are separate states. Restoring a connection must not silently unlock the wallet or authorize arbitrary transaction signing.

Exact transaction signing must preserve the canonical bytes approved by the application. Structured transaction review data must be verified against the authoritative serialized bytes before it is trusted for display or policy decisions.

VSR input and packed transactions are untrusted input. Implementations must enforce supported chain, payload bounds, canonical transaction encoding, provider capability checks, and explicit user approval policies before signing.

## Runtime

The specification does not require a specific UI framework, storage implementation, or signing backend. Implementations may use browser extensions, mobile wallet bridges, Telegram Mini Apps, embedded providers, or other trusted transports as long as the observable provider contract remains compatible.

Transport return/deep-link behavior is not authorization. A Telegram or browser return URL only routes the user back to the dApp and must not be treated as proof that a wallet session is valid.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
