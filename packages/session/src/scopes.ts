import type { WispScope } from "@windstack/core";

export function isEVMScope(scope: WispScope): scope is `eip155:${number}` {
  return scope.startsWith("eip155:");
}

export function isVexaniumScope(scope: WispScope): scope is `antelope:${string}` {
  return scope.startsWith("antelope:");
}

export function isSolanaScope(scope: WispScope): scope is Extract<WispScope, `solana:${string}`> {
  return scope.startsWith("solana:");
}

export function createSessionId(scopes: WispScope[]): string {
  const cryptoSource = globalThis.crypto;
  const randomPart = cryptoSource?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `wisp:${Date.now().toString(36)}:${scopes.join(",")}:${randomPart}`;
}
