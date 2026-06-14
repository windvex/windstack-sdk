import { getRuntimeWindow } from "@windstack/core";
import {
  DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS,
  VEXANIUM_ANNOUNCE_PROVIDER_EVENT,
  VEXANIUM_PROVIDER_GLOBAL,
  VEXANIUM_REQUEST_PROVIDER_EVENT,
  WISP_VEXANIUM_PROVIDER_INFO,
} from "./constants.js";
import type { VexaniumProvider, VexaniumProviderDetail, VexaniumProviderInfo } from "./types.js";

function hasRequest(value: unknown): value is Pick<VexaniumProvider, "request"> {
  return typeof value === "object" && value !== null && typeof (value as { request?: unknown }).request === "function";
}

export function isVexaniumProvider(value: unknown): value is VexaniumProvider {
  return hasRequest(value);
}

export function getInjectedVexaniumProvider(): VexaniumProvider | null {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;

  // Consumer-only read path. This must never mutate window.vexanium or window.wispWallet.
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
 * This helper intentionally announces through a custom event only; it does not write to
 * window.vexanium, window.wispWallet, or any other global. The wallet remains the owner
 * of its injected provider object.
 */
export function announceVexaniumProvider(provider: VexaniumProvider, info: Partial<VexaniumProviderInfo> = {}): void {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return;
  const detail: VexaniumProviderDetail = {
    info: { ...WISP_VEXANIUM_PROVIDER_INFO, ...info },
    provider,
  };
  runtimeWindow.dispatchEvent(new CustomEvent(VEXANIUM_ANNOUNCE_PROVIDER_EVENT, { detail }));
}

export async function discoverVexaniumProviders(timeoutMs = DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS): Promise<VexaniumProviderDetail[]> {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return [];

  const discovered: VexaniumProviderDetail[] = [];
  const seen = new Set<VexaniumProvider>();
  const addProvider = (detail: VexaniumProviderDetail) => {
    if (!isVexaniumProvider(detail.provider) || seen.has(detail.provider)) return;
    seen.add(detail.provider);
    discovered.push(detail);
  };

  const injected = getInjectedVexaniumProvider();
  if (injected) {
    addProvider({
      info: injected.providerInfo ?? WISP_VEXANIUM_PROVIDER_INFO,
      provider: injected,
    });
  }

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

export async function getVexaniumProvider(timeoutMs = DEFAULT_PROVIDER_DISCOVERY_TIMEOUT_MS): Promise<VexaniumProvider | null> {
  const providers = await discoverVexaniumProviders(timeoutMs);

  return providers[0]?.provider ?? getInjectedVexaniumProvider();
}
