# VexaniumProvider v1

Protocol identifier: `VexaniumProvider`

Protocol version: `1.0.0`

SDK release implementing this contract: `0.6.0`

This document defines the wire contract between a dApp and an injected Vexanium wallet. Antelope transaction encoding and signing-request payloads remain defined by WharfKit and the Antelope protocol.

## 1. Provider object

A compatible wallet provider MUST expose:

```ts
interface VexaniumProvider {
  providerInfo: VexaniumProviderInfo;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, handler: (payload: unknown) => void): void;
  off?(event: string, handler: (payload: unknown) => void): void;
  removeListener?(event: string, handler: (payload: unknown) => void): void;
}
```

`providerInfo` is mandatory and MUST include:

```ts
{
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

A dApp MUST NOT invent missing provider identity. Discovery ignores providers that do not satisfy the v1 shape.

## 2. Version compatibility

The SDK and wallet negotiate semantic protocol versions through `vex_getCapabilities`.

For protocol v1, compatible implementations MUST share major version `1`. A `2.x` provider is not implicitly compatible with a `1.x` SDK.

## 3. Capabilities

Defined v1 capability identifiers:

```txt
vex.accounts
vex.sessions
vex.signTransaction
vex.signingRequest
vex.signMessage
vex.signDigest
vex.events
```

A provider MUST declare static capabilities in `providerInfo.capabilities` and return negotiated capabilities from `vex_getCapabilities`.

## 4. Capability negotiation

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

The SDK rejects incompatible major versions and missing required capabilities before connect/sign flows continue.

## 5. Connect

`vex_requestAccounts` is the interactive permission request.

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

The response is not an array and `sessionId` is mandatory.

`chainId` in a response MUST be the 64-character Antelope chain ID. A request MAY use either that full ID or its `antelope:<32 hex characters>` CAIP-2 form. Wallets and clients MUST compare those two forms as the same chain when their prefixes match.

`vex_getAccounts` is the silent restore/read path and returns:

```ts
{
  sessionId: string,
  chainId: string,
  accounts: VexaniumAccount[],
}
```

## 6. Signing paths

### Connected dApp / SessionKit

`vex_signTransaction` signs the exact serialized Antelope transaction bytes resolved by SessionKit.

```ts
{
  serializedTransaction: string;
  chainId: string;
  account: string;
  permission: string;
  sessionId?: string;
}
```

A wallet MUST NOT silently rebuild or mutate the transaction before signing.

`serializedTransaction` MUST contain non-empty, even-length hexadecimal bytes. `account` and `permission` MUST be valid Antelope names. A successful response contains at least one valid Antelope signature:

```ts
{
  signatures: string[];
  signer?: string;
  signerPermission?: string;
}
```

### Portable Vexanium Signing Request

`vex_signingRequest` is used for QR, deep-link, clipboard, or external wallet transport.

Canonical Vexanium URI scheme:

```txt
vsr://...
```

The payload format is compatible with WharfKit SigningRequest / ESR Revision 3. `esr://...` is accepted as interoperability input. The client validates either scheme with WharfKit and forwards the original URI without decoding, re-encoding, or replacing its scheme.

A signing-request response MUST include `signatures: string[]` and `broadcast: boolean`. A client MUST reject an empty or malformed signature list.

## 7. Standard errors

```txt
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

Errors MUST expose a numeric `code` and human-readable `message`. Optional `data` may provide structured context.

## 8. Events

```txt
connect
accountsChanged
disconnect
chainChanged
message
```

`connect` uses the canonical connect response shape. `accountsChanged` uses the canonical accounts response shape.

## 9. Security boundary

`DappMetadata` is display metadata only. Wallet permission state MUST bind to an authoritative transport/runtime origin, such as the browser extension sender origin. A wallet MUST NOT trust a dApp-supplied `origin` field as the permission boundary.

## 10. Discovery

A provider may be discovered through `window.vexanium` or Vexanium provider announcement events. A discovered provider MUST expose valid mandatory `providerInfo`; the SDK does not invent provider metadata.

Discovery uses these window events:

```txt
vexanium:requestProvider
vexanium:announceProvider
```
