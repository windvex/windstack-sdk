import type { WispScope } from "@windstack/core";

export function isEVMScope(scope: WispScope): scope is `eip155:${number}` {
  return /^eip155:(?:0|[1-9]\d*)$/.test(scope);
}

export function isVexaniumScope(scope: WispScope): scope is `antelope:${string}` {
  return /^antelope:[0-9a-f]{32}$/.test(scope);
}

export function isSolanaScope(scope: WispScope): scope is Extract<WispScope, `solana:${string}`> {
  return /^solana:[a-zA-Z0-9_-]+$/.test(scope);
}

export function createSessionId(scopes: WispScope[]): string {
  const cryptoSource = globalThis.crypto;
  const randomPart = cryptoSource?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `wisp:${Date.now().toString(36)}:${scopes.join(",")}:${randomPart}`;
}
