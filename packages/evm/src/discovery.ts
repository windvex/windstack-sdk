import { getRuntimeWindow, invalidParams } from "@windstack/core";
import type { RuntimeWindow } from "@windstack/core";
import {
  DEFAULT_EVM_DISCOVERY_TIMEOUT_MS,
  EIP6963_ANNOUNCE_PROVIDER_EVENT,
  EIP6963_REQUEST_PROVIDER_EVENT,
  EVM_PROVIDER_GLOBAL,
  WISP_EVM_PROVIDER_RDNS,
} from "./constants.js";
import type {
  EIP1193Provider,
  EIP6963ProviderDetail,
  EIP6963ProviderInfo,
} from "./types.js";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RDNS_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

type ProviderRegistry = {
  details: EIP6963ProviderDetail[];
  providers: Set<EIP1193Provider>;
  uuids: Set<string>;
};

const providerRegistries = new WeakMap<RuntimeWindow, ProviderRegistry>();

function isEIP1193Provider(value: unknown): value is EIP1193Provider {
  if (typeof value !== "object" || value === null) return false;
  const provider = value as Partial<EIP1193Provider>;
  return (
    typeof provider.request === "function" &&
    typeof provider.on === "function" &&
    typeof provider.removeListener === "function"
  );
}

export function isEIP6963ProviderInfo(value: unknown): value is EIP6963ProviderInfo {
  if (typeof value !== "object" || value === null) return false;
  const info = value as Partial<EIP6963ProviderInfo>;
  return (
    typeof info.uuid === "string" &&
    UUID_V4_PATTERN.test(info.uuid) &&
    typeof info.name === "string" &&
    info.name.trim().length > 0 &&
    typeof info.icon === "string" &&
    info.icon.startsWith("data:image/") &&
    typeof info.rdns === "string" &&
    RDNS_PATTERN.test(info.rdns)
  );
}

export function isEIP6963ProviderDetail(value: unknown): value is EIP6963ProviderDetail {
  if (typeof value !== "object" || value === null) return false;
  const detail = value as Partial<EIP6963ProviderDetail>;
  return isEIP6963ProviderInfo(detail.info) && isEIP1193Provider(detail.provider);
}

function getProviderRegistry(runtimeWindow: RuntimeWindow): ProviderRegistry {
  const existing = providerRegistries.get(runtimeWindow);
  if (existing) return existing;

  const registry: ProviderRegistry = {
    details: [],
    providers: new Set(),
    uuids: new Set(),
  };

  runtimeWindow.addEventListener(EIP6963_ANNOUNCE_PROVIDER_EVENT, (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!isEIP6963ProviderDetail(detail)) return;
    if (registry.providers.has(detail.provider) || registry.uuids.has(detail.info.uuid)) return;

    const info = Object.freeze({ ...detail.info });
    registry.providers.add(detail.provider);
    registry.uuids.add(info.uuid);
    registry.details.push(Object.freeze({ info, provider: detail.provider }));
  });

  providerRegistries.set(runtimeWindow, registry);
  return registry;
}

function assertDiscoveryTimeout(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw invalidParams("EVM discovery timeout must be a non-negative finite number", { timeoutMs });
  }
}

export function getInjectedEVMProvider(): EIP1193Provider | null {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  const provider = runtimeWindow[EVM_PROVIDER_GLOBAL];
  return isEIP1193Provider(provider) ? provider : null;
}

export function requestEIP6963Providers(): void {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return;
  try {
    runtimeWindow.dispatchEvent(new Event(EIP6963_REQUEST_PROVIDER_EVENT));
  } catch {
    // Discovery is optional; a broken injected wallet must not stop the dApp.
  }
}

export async function discoverEVMProviders(
  timeoutMs = DEFAULT_EVM_DISCOVERY_TIMEOUT_MS,
): Promise<EIP6963ProviderDetail[]> {
  assertDiscoveryTimeout(timeoutMs);
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return [];

  const registry = getProviderRegistry(runtimeWindow);
  requestEIP6963Providers();
  if (timeoutMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  }
  return [...registry.details];
}

export async function getEVMProvider(
  timeoutMs = DEFAULT_EVM_DISCOVERY_TIMEOUT_MS,
): Promise<EIP1193Provider | null> {
  const providers = await discoverEVMProviders(timeoutMs);
  const wispProvider = providers.find(({ info }) => info.rdns === WISP_EVM_PROVIDER_RDNS)?.provider;
  return wispProvider ?? providers[0]?.provider ?? getInjectedEVMProvider();
}
