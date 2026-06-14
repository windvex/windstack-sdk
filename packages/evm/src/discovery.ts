import { getRuntimeWindow } from "@windstack/core";
import {
  DEFAULT_EVM_DISCOVERY_TIMEOUT_MS,
  EIP6963_ANNOUNCE_PROVIDER_EVENT,
  EIP6963_REQUEST_PROVIDER_EVENT,
  EVM_PROVIDER_GLOBAL,
  WISP_EVM_PROVIDER_RDNS,
} from "./constants.js";
import type { EIP1193Provider, EIP6963ProviderDetail } from "./types.js";

export function getInjectedEVMProvider(): EIP1193Provider | null {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  const provider = runtimeWindow[EVM_PROVIDER_GLOBAL] as EIP1193Provider | undefined;
  if (provider?.request) return provider;
  return null;
}

export function requestEIP6963Providers(): void {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return;
  try {
    runtimeWindow.dispatchEvent(new Event(EIP6963_REQUEST_PROVIDER_EVENT));
  } catch {
    // Provider discovery is optional and must not break the dApp.
  }
}

export async function discoverEVMProviders(timeoutMs = DEFAULT_EVM_DISCOVERY_TIMEOUT_MS): Promise<EIP6963ProviderDetail[]> {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return [];

  const discovered: EIP6963ProviderDetail[] = [];
  const seen = new Set<EIP1193Provider>();
  const addProvider = (detail: EIP6963ProviderDetail) => {
    if (!detail.provider?.request || seen.has(detail.provider)) return;
    seen.add(detail.provider);
    discovered.push(detail);
  };

  await new Promise<void>((resolve) => {
    const onAnnounce = (event: CustomEvent<EIP6963ProviderDetail>) => {
      if (event.detail) addProvider(event.detail);
    };

    runtimeWindow.addEventListener(EIP6963_ANNOUNCE_PROVIDER_EVENT, onAnnounce as EventListener);
    requestEIP6963Providers();
    setTimeout(() => {
      runtimeWindow.removeEventListener(EIP6963_ANNOUNCE_PROVIDER_EVENT, onAnnounce as EventListener);
      resolve();
    }, timeoutMs);
  });

  const injected = getInjectedEVMProvider();
  if (injected && !seen.has(injected)) {
    addProvider({ info: { name: "Injected EVM Provider", rdns: "injected.evm" }, provider: injected });
  }

  return discovered;
}

export async function getEVMProvider(timeoutMs = DEFAULT_EVM_DISCOVERY_TIMEOUT_MS): Promise<EIP1193Provider | null> {
  const providers = await discoverEVMProviders(timeoutMs);
  const wispProvider = providers.find((entry) => entry.info.rdns === WISP_EVM_PROVIDER_RDNS)?.provider;
  return wispProvider ?? providers[0]?.provider ?? getInjectedEVMProvider();
}
