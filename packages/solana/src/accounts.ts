import { invalidParams } from "@windstack/core";
import { DEFAULT_SOLANA_SCOPE } from "./constants.js";
import type { SolanaAccount, SolanaScope } from "./types.js";

export function normalizeSolanaAccount(value: unknown, fallbackScope: SolanaScope = DEFAULT_SOLANA_SCOPE): SolanaAccount {
  if (typeof value === "string") return { scope: fallbackScope, publicKey: value };
  if (typeof value === "object" && value !== null) {
    const source = value as Partial<SolanaAccount> & { address?: string };
    const publicKey = source.publicKey ?? source.address;
    if (publicKey) return { scope: source.scope ?? fallbackScope, publicKey, label: source.label };
  }
  throw invalidParams("Invalid Solana account payload", value);
}

export function normalizeSolanaAccounts(value: unknown, fallbackScope: SolanaScope = DEFAULT_SOLANA_SCOPE): SolanaAccount[] {
  if (!Array.isArray(value)) return [];
  return value.map((account) => normalizeSolanaAccount(account, fallbackScope));
}
