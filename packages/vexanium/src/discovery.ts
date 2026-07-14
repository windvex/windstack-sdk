import { getRuntimeWindow } from "@windstack/core";
import {
  DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS,
  VEXANIUM_ANNOUNCE_PROVIDER_EVENT,
  VEXANIUM_PROVIDER_GLOBAL,
  VEXANIUM_REQUEST_PROVIDER_EVENT,
} from "./constants.js";
import { isVexaniumProviderInfo } from "./standard.js";
import { vexaniumInvalidParams } from "./errors.js";
import type { VexaniumProvider, VexaniumProviderDetail } from "./types.js";

function providerDetail(provider: VexaniumProvider): VexaniumProviderDetail {
  const info = Object.freeze({
    ...provider.providerInfo,
    chains: Object.freeze([...provider.providerInfo.chains]),
    capabilities: Object.freeze([...provider.providerInfo.capabilities]),
  });
  return Object.freeze({ info, provider });
}

function hasRequest(value: unknown): value is Pick<VexaniumProvider, "request"> {
  return typeof value === "object" && value !== null && typeof (value as { request?: unknown }).request === "function";
}

/** Runtime guard for the formal VexaniumProvider v1 contract. */
export function isVexaniumProvider(value: unknown): value is VexaniumProvider {
  if (!hasRequest(value)) return false;
  return isVexaniumProviderInfo((value as { providerInfo?: unknown }).providerInfo);
}

export function getInjectedVexaniumProvider(): VexaniumProvider | null {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;

  const provider = runtimeWindow[VEXANIUM_PROVIDER_GLOBAL] as unknown;
  return isVexaniumProvider(provider) ? provider : null;
}

export function requestVexaniumProviders(): void {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return;
  try {
    runtimeWindow.dispatchEvent(new Event(VEXANIUM_REQUEST_PROVIDER_EVENT));
  } catch {
    // Provider discovery is optional and must not break the dApp.
  }
}

/**
 * Wallet-author API. dApps should not call this.
 *
 * VexaniumProvider v1 requires providerInfo on the provider object itself.
 * Discovery never invents, defaults, or patches provider identity.
 */
export function announceVexaniumProvider(provider: VexaniumProvider): void {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow || !isVexaniumProvider(provider)) return;
  const detail = providerDetail(provider);
  runtimeWindow.dispatchEvent(new CustomEvent(VEXANIUM_ANNOUNCE_PROVIDER_EVENT, { detail }));
}

export async function discoverVexaniumProviders(
  timeoutMs = DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS,
): Promise<VexaniumProviderDetail[]> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw vexaniumInvalidParams("Provider discovery timeout must be a non-negative finite number", { timeoutMs });
  }
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return [];

  const discovered: VexaniumProviderDetail[] = [];
  const seen = new Set<VexaniumProvider>();
  const addProvider = (detail: VexaniumProviderDetail) => {
    if (!isVexaniumProvider(detail.provider) || seen.has(detail.provider)) return;
    if (detail.info.rdns !== detail.provider.providerInfo.rdns) return;
    seen.add(detail.provider);
    discovered.push(providerDetail(detail.provider));
  };

  const injected = getInjectedVexaniumProvider();
  if (injected) addProvider({ info: injected.providerInfo, provider: injected });

  await new Promise<void>((resolve) => {
    const onAnnounce = (event: CustomEvent<VexaniumProviderDetail>) => {
      if (event.detail) addProvider(event.detail);
    };

    runtimeWindow.addEventListener(VEXANIUM_ANNOUNCE_PROVIDER_EVENT, onAnnounce as EventListener);
    requestVexaniumProviders();
    setTimeout(() => {
      runtimeWindow.removeEventListener(VEXANIUM_ANNOUNCE_PROVIDER_EVENT, onAnnounce as EventListener);
      resolve();
    }, timeoutMs);
  });

  return discovered;
}

export type GetVexaniumProviderOptions = {
  timeoutMs?: number;
  /** Reverse-DNS wallet identifier, for example `com.wisp.wallet`. */
  rdns?: string;
};

export async function getVexaniumProvider(
  optionsOrTimeout: GetVexaniumProviderOptions | number = DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS,
): Promise<VexaniumProvider | null> {
  const options = typeof optionsOrTimeout === "number"
    ? { timeoutMs: optionsOrTimeout }
    : optionsOrTimeout;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS;
  const providers = await discoverVexaniumProviders(timeoutMs);

  if (options.rdns) {
    return providers.find(({ info }) => info.rdns === options.rdns)?.provider ?? null;
  }

  return providers[0]?.provider ?? null;
}
