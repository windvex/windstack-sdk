# @windstack/core

Shared provider types and browser-safe utilities for the Wind Stack SDK.

```bash
npm install @windstack/core
```

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

`normalizeProviderError()` preserves numeric provider error codes. `WispEventEmitter` provides typed `on`, `off`, `once`, and listener cleanup methods for SDK packages.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
