# @windstack/core

## Overview

`@windstack/core` contains runtime-neutral provider errors, typed events, browser helpers, application metadata, exact decimal conversion, basis-point operations, and constant-product protocol math.

Provider errors use standard numeric JSON-RPC and EIP-1193 codes while preserving provider-supplied error data.

## Installation

```bash
npm install @windstack/core
```

## Usage

```ts
import { parseDecimal, quoteConstantProduct } from "@windstack/core";

const quote = quoteConstantProduct({
  reserveIn: 1_000_000n,
  reserveOut: 2_000_000n,
  amountIn: parseDecimal("10.0000", 4),
  feeBps: 30,
});

console.log(quote.amountOut);
```

All protocol-critical results use `bigint`. Precision conversion rejects discarded units by default; AMM and liquidity quotes use documented integer-floor semantics. Invalid precision, out-of-range basis points, disconnected routes, and duplicate pools are rejected.

## Security

Application metadata is display information only. Wallet permission state should be bound to an authoritative transport origin, such as the browser extension sender origin, instead of trusting an origin supplied by application content.

## Runtime

The package is browser-safe and contains no chain-signing implementation. It is designed to be shared by provider clients without requiring a blockchain runtime or private-key dependency.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
