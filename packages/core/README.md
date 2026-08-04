# @windstack/core

Shared provider types and browser-safe utilities for the Wind Stack SDK.

```bash
npm install @windstack/core
```

## Provider contract

`WISP_PROVIDER_CONTRACT` is the runtime single source used by the WindStack EVM
and Vexanium packages for provider identity, method names, discovery events,
chain identifiers, protocol version, capabilities, and provider error codes.

```ts
import { WISP_PROVIDER_CONTRACT } from "@windstack/core";

console.log(WISP_PROVIDER_CONTRACT.vex.standard); // VexaniumProvider
console.log(WISP_PROVIDER_CONTRACT.evm.chainIdHex); // 0x1a50
console.log(WISP_PROVIDER_CONTRACT.errors.userRejected); // 4001
```

The machine-readable repository specification at
`specs/wisp-provider-contract.json` is regression-tested against this export.
Wisp Wallet synchronizes its provider runtime from that specification.

## dApp metadata

`resolveDappMetadata()` combines explicit values with the current document title, description, URL, and icons. URLs are restricted to safe web/image schemes.

```ts
import { resolveDappMetadata } from "@windstack/core";

const metadata = resolveDappMetadata({
  name: "My App",
  url: "https://app.example",
  icon: "https://app.example/icon.png",
});
```

Metadata is only for display. A wallet must derive the trusted origin from its transport, such as the browser extension sender, rather than accepting an origin supplied by a dApp.

## Errors and events

```ts
import {
  WispEventEmitter,
  WispProviderError,
  normalizeProviderError,
} from "@windstack/core";
```

`WISP_ERROR_CODES` is derived from the provider contract. `normalizeProviderError()` preserves numeric provider error codes. `WispEventEmitter` provides typed `on`, `off`, `once`, and listener cleanup methods for SDK packages.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
