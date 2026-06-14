import { getRuntimeWindow } from "@windstack/core";
import { SOLANA_PROVIDER_GLOBAL } from "./constants.js";
import type { SolanaProvider } from "./types.js";

export function getInjectedSolanaProvider(): SolanaProvider | null {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  const provider = runtimeWindow[SOLANA_PROVIDER_GLOBAL] as SolanaProvider | undefined;
  if (provider?.request) return provider;
  return null;
}
