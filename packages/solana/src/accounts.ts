import { invalidParams } from "@windstack/core";
import { DEFAULT_SOLANA_SCOPE } from "./constants.js";
import type { SolanaAccount, SolanaScope } from "./types.js";

const SOLANA_PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOLANA_SCOPE_PATTERN = /^solana:[a-zA-Z0-9_-]+$/;

export function isSolanaPublicKey(value: unknown): value is string {
  return typeof value === "string" && SOLANA_PUBLIC_KEY_PATTERN.test(value);
}

export function isSolanaScope(value: unknown): value is SolanaScope {
  return typeof value === "string" && SOLANA_SCOPE_PATTERN.test(value);
}

export function normalizeSolanaAccount(value: unknown, fallbackScope: SolanaScope = DEFAULT_SOLANA_SCOPE): SolanaAccount {
  if (!isSolanaScope(fallbackScope)) throw invalidParams("Invalid fallback Solana scope", fallbackScope);
  if (typeof value === "string" && isSolanaPublicKey(value)) {
    return { scope: fallbackScope, publicKey: value };
  }
  if (typeof value === "object" && value !== null) {
    const source = value as Partial<SolanaAccount> & { address?: string };
    const publicKey = source.publicKey ?? source.address;
    const scope = source.scope ?? fallbackScope;
    if (isSolanaPublicKey(publicKey) && isSolanaScope(scope)) {
      return {
        scope,
        publicKey,
        label: typeof source.label === "string" ? source.label : undefined,
      };
    }
  }
  throw invalidParams("Invalid Solana account payload", value);
}

export function normalizeSolanaAccounts(value: unknown, fallbackScope: SolanaScope = DEFAULT_SOLANA_SCOPE): SolanaAccount[] {
  if (!Array.isArray(value)) throw invalidParams("Invalid Solana accounts payload", value);
  return value.map((account) => normalizeSolanaAccount(account, fallbackScope));
}
