/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { resolveDappMetadata, type DappMetadataInput } from "@windstack/core";
import {
  MemorySessionStorage,
  SessionManager,
  type Session,
  type SessionStorage,
} from "@windstack/session";
import {
  createVexaniumClient,
  vexNative,
  type VexaniumAccount,
  type VexaniumClient,
  type VexaniumProvider,
} from "@windstack/vexanium";
import {
  installWispEmbeddedProviders,
  type WispEmbeddedProviders,
  type WispEmbeddedProvidersOptions,
} from "./embedded.js";
import { WISP_PROVIDER_RDNS } from "./identity.js";
import {
  createWispTelegramTransport,
  type WispTelegramSession,
  type WispTelegramTransport,
  type WispTelegramTransportOptions,
} from "./WispTelegramTransport.js";
import { WispWalletPlugin } from "./WispWalletPlugin.js";

export type WispConnectorRoute = "provider" | "telegram";
export type WispConnectorTransport = "injected" | "embedded" | "telegram";
export type WispConnectorStatus =
  | "idle"
  | "connecting"
  | "restoring"
  | "connected"
  | "disconnecting"
  | "error";

export type WispConnectorSnapshot = Readonly<{
  status: WispConnectorStatus;
  transport: WispConnectorTransport | null;
  account: VexaniumAccount | null;
  sessionId: string | null;
  error: Error | null;
}>;

export type WispConnectorConnectOptions = {
  /**
   * Force one route. When omitted, Wisp provider discovery is preferred and
   * Telegram is used only when no Wisp provider is available.
   */
  transport?: WispConnectorRoute;
};

export type WispConnectorOptions = {
  appName?: string;
  dapp?: DappMetadataInput;
  /** Explicit Wisp Vexanium provider. Omit to use canonical RDNS discovery. */
  provider?: VexaniumProvider;
  discoveryTimeoutMs?: number;
  rpcUrl?: string | readonly string[];
  /**
   * Install the canonical embedded-provider bootstrap. When Vexanium is enabled,
   * the connector uses that exact frame provider instead of injected discovery.
   */
  embedded?: WispEmbeddedProvidersOptions;
  /** Wisp Telegram configuration or an already-created transport. */
  telegram?: WispTelegramTransportOptions | WispTelegramTransport;
  /** Session storage for provider-backed sessions. Browser localStorage is used when available. */
  sessionStorage?: SessionStorage;
  sessionStorageKey?: string;
};

export type WispConnector = Readonly<{
  getSnapshot(): WispConnectorSnapshot;
  subscribe(listener: () => void): () => void;
  connect(options?: WispConnectorConnectOptions): Promise<WispConnectorSnapshot>;
  restore(): Promise<WispConnectorSnapshot>;
  disconnect(): Promise<void>;
  getProviderClient(): Promise<VexaniumClient>;
  getProviderSession(): Session | null;
  getTelegramSession(): WispTelegramSession | null;
  getEmbeddedProviders(): WispEmbeddedProviders | null;
  destroy(): void;
}>;

type ProviderRuntime = {
  source: "injected" | "embedded";
  client: VexaniumClient;
  manager: SessionManager;
  unsubscribeSession: () => void;
};

function runtimeSessionStorage(): SessionStorage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    return {
      get: async (key) => storage.getItem(key),
      set: async (key, value) => storage.setItem(key, value),
      remove: async (key) => storage.removeItem(key),
    };
  } catch {
    return null;
  }
}

function isTelegramTransport(
  value: WispTelegramTransportOptions | WispTelegramTransport,
): value is WispTelegramTransport {
  const candidate = value as Partial<WispTelegramTransport>;
  return (
    typeof candidate.connect === "function" &&
    typeof candidate.restore === "function" &&
    typeof candidate.disconnect === "function" &&
    typeof candidate.getSession === "function"
  );
}

function connectorError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error || "Wisp connector request failed"));
}

function providerAccount(session: Session): VexaniumAccount {
  return {
    actor: session.identity.actor,
    permission: session.identity.permission,
    permissionLevel: `${session.identity.actor}@${session.identity.permission}`,
    chainId: session.chain.id,
    ...(session.identity.publicKey ? { publicKey: session.identity.publicKey } : {}),
  };
}

export function createWispConnector(options: WispConnectorOptions = {}): WispConnector {
  if (options.provider && options.embedded && options.embedded.vexanium !== false) {
    throw new TypeError(
      "Configure either an explicit Wisp provider or embedded Vexanium bootstrap, not both",
    );
  }

  const metadata = resolveDappMetadata(options.dapp);
  const listeners = new Set<() => void>();
  const storage = options.sessionStorage ?? runtimeSessionStorage() ?? new MemorySessionStorage();

  let snapshot: WispConnectorSnapshot = Object.freeze({
    status: "idle",
    transport: null,
    account: null,
    sessionId: null,
    error: null,
  });
  let providerRuntimePromise: Promise<ProviderRuntime> | null = null;
  let providerRuntime: ProviderRuntime | null = null;
  let embeddedProviders: WispEmbeddedProviders | null = null;
  let telegramTransport: WispTelegramTransport | null = null;
  let activeOperation: AbortController | null = null;
  let destroyed = false;

  const publish = (next: WispConnectorSnapshot) => {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Consumer subscriptions cannot break wallet state transitions.
      }
    }
  };

  const begin = (
    status: Extract<WispConnectorStatus, "connecting" | "restoring" | "disconnecting">,
  ) => {
    if (destroyed) throw new Error("Wisp connector has been destroyed");
    if (
      snapshot.status === "connecting" ||
      snapshot.status === "restoring" ||
      snapshot.status === "disconnecting"
    ) {
      throw new Error("A Wisp connector operation is already in progress");
    }
    const controller = new AbortController();
    activeOperation = controller;
    publish({ ...snapshot, status, error: null });
    return controller;
  };

  const finish = (controller: AbortController) => {
    if (activeOperation === controller) activeOperation = null;
  };

  const assertActive = (signal: AbortSignal) => {
    if (destroyed || signal.aborted) {
      throw new DOMException("Wisp connector request cancelled", "AbortError");
    }
  };

  const fail = (error: unknown) => {
    const normalized = connectorError(error);
    if (!destroyed) publish({ ...snapshot, status: "error", error: normalized });
    return normalized;
  };

  const setProviderSession = (session: Session, source: "injected" | "embedded") => {
    publish({
      status: "connected",
      transport: source,
      account: providerAccount(session),
      sessionId: session.walletSessionId ?? null,
      error: null,
    });
    return snapshot;
  };

  const setTelegramSession = (session: WispTelegramSession) => {
    publish({
      status: "connected",
      transport: "telegram",
      account: session.account,
      sessionId: session.sessionId,
      error: null,
    });
    return snapshot;
  };

  const setIdle = () => {
    publish({
      status: "idle",
      transport: null,
      account: null,
      sessionId: null,
      error: null,
    });
  };

  const ensureTelegramTransport = (): WispTelegramTransport | null => {
    if (!options.telegram) return null;
    telegramTransport ??= isTelegramTransport(options.telegram)
      ? options.telegram
      : createWispTelegramTransport(options.telegram);
    return telegramTransport;
  };

  const ensureProviderRuntime = async (): Promise<ProviderRuntime> => {
    if (providerRuntime) return providerRuntime;
    providerRuntimePromise ??= (async () => {
      let provider = options.provider;
      let source: ProviderRuntime["source"] = "injected";

      if (!provider && options.embedded && options.embedded.vexanium !== false) {
        embeddedProviders ??= installWispEmbeddedProviders(options.embedded);
        provider = embeddedProviders.vexanium ?? undefined;
        source = "embedded";
      }

      const client = await createVexaniumClient({
        ...(provider ? { provider } : { providerRdns: WISP_PROVIDER_RDNS }),
        dapp: options.dapp,
        rpcUrl: options.rpcUrl ?? vexNative.rpcUrl,
        discoveryTimeoutMs: options.discoveryTimeoutMs,
      });
      const plugin = new WispWalletPlugin({ client, dapp: options.dapp });
      const manager = new SessionManager({
        chains: [
          {
            id: vexNative.chainId,
            url: options.rpcUrl ?? vexNative.rpcUrl,
            contracts: {
              system: vexNative.contracts.system,
              token: vexNative.contracts.token,
            },
          },
        ],
        walletPlugins: [plugin],
        appName: options.appName ?? metadata.name,
        storage,
        storageKey: options.sessionStorageKey ?? "windstack:wisp-connector:provider",
      });
      const runtime: ProviderRuntime = {
        source,
        client,
        manager,
        unsubscribeSession: () => undefined,
      };
      runtime.unsubscribeSession = client.subscribeSession(({ session, accounts }) => {
        if (destroyed || snapshot.status !== "connected" || snapshot.transport !== runtime.source) {
          return;
        }

        const managed = runtime.manager.getSession();
        const account = managed
          ? accounts.find(
              (item) =>
                item.actor === managed.identity.actor &&
                item.permission === managed.identity.permission,
            )
          : undefined;
        const sameSession = Boolean(
          managed &&
            account &&
            session &&
            session?.walletSessionId === managed.walletSessionId &&
            session.chainId === managed.chain.id,
        );

        if (sameSession && session && account) {
          publish({ ...snapshot, account, sessionId: session.walletSessionId ?? null });
          return;
        }

        setIdle();
        void runtime.manager.logout().catch((error) => {
          if (!destroyed) fail(error);
        });
      });
      return runtime;
    })();

    try {
      providerRuntime = await providerRuntimePromise;
      if (destroyed) {
        providerRuntime.client.destroy();
        providerRuntime = null;
        throw new DOMException("Wisp connector request cancelled", "AbortError");
      }
      return providerRuntime;
    } catch (error) {
      providerRuntimePromise = null;
      throw error;
    }
  };

  const connectProvider = async (signal: AbortSignal): Promise<WispConnectorSnapshot | null> => {
    const runtime = await ensureProviderRuntime();
    assertActive(signal);
    if (!runtime.client.isAvailable()) return null;
    const session = await runtime.manager.login();
    if (destroyed || signal.aborted) {
      await runtime.manager.logout().catch(() => undefined);
      assertActive(signal);
    }
    return setProviderSession(session, runtime.source);
  };

  const connectTelegram = async (signal: AbortSignal): Promise<WispConnectorSnapshot> => {
    const telegram = ensureTelegramTransport();
    if (!telegram) throw new Error("Wisp Telegram transport is not configured");
    const session = await telegram.connect(signal);
    assertActive(signal);
    return setTelegramSession(session);
  };

  const connect = async (
    connectOptions: WispConnectorConnectOptions = {},
  ): Promise<WispConnectorSnapshot> => {
    if (snapshot.status === "connected") return snapshot;
    const controller = begin("connecting");
    try {
      if (connectOptions.transport === "telegram") {
        return await connectTelegram(controller.signal);
      }

      const providerSnapshot = await connectProvider(controller.signal);
      if (providerSnapshot) return providerSnapshot;
      if (connectOptions.transport === "provider") {
        throw new Error("No Wisp provider is available");
      }
      if (options.telegram) return await connectTelegram(controller.signal);
      throw new Error("No Wisp provider is available and Telegram fallback is not configured");
    } catch (error) {
      throw fail(error);
    } finally {
      finish(controller);
    }
  };

  const restore = async (): Promise<WispConnectorSnapshot> => {
    if (snapshot.status === "connected") return snapshot;
    const controller = begin("restoring");
    try {
      const runtime = await ensureProviderRuntime();
      assertActive(controller.signal);
      if (runtime.client.isAvailable()) {
        const providerSession = await runtime.manager.restore();
        assertActive(controller.signal);
        if (providerSession) return setProviderSession(providerSession, runtime.source);
      }

      const telegram = ensureTelegramTransport();
      if (telegram) {
        const telegramSession = await telegram.restore(controller.signal);
        assertActive(controller.signal);
        if (telegramSession) return setTelegramSession(telegramSession);
      }

      setIdle();
      return snapshot;
    } catch (error) {
      throw fail(error);
    } finally {
      finish(controller);
    }
  };

  const disconnect = async (): Promise<void> => {
    if (snapshot.status !== "connected") {
      setIdle();
      return;
    }

    const activeTransport = snapshot.transport;
    const controller = begin("disconnecting");
    try {
      if (activeTransport === "telegram") {
        const telegram = ensureTelegramTransport();
        if (telegram) await telegram.disconnect(controller.signal);
      } else if (providerRuntime) {
        await providerRuntime.manager.logout();
      }
      assertActive(controller.signal);
      setIdle();
    } catch (error) {
      throw fail(error);
    } finally {
      finish(controller);
    }
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (typeof listener !== "function")
        throw new TypeError("Wisp connector listener is required");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect,
    restore,
    disconnect,
    async getProviderClient() {
      return (await ensureProviderRuntime()).client;
    },
    getProviderSession: () => providerRuntime?.manager.getSession() ?? null,
    getTelegramSession: () => telegramTransport?.getSession() ?? null,
    getEmbeddedProviders: () => embeddedProviders,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      activeOperation?.abort();
      activeOperation = null;
      providerRuntime?.client.destroy();
      providerRuntime?.unsubscribeSession();
      embeddedProviders?.destroy();
      listeners.clear();
      providerRuntime = null;
      providerRuntimePromise = null;
      embeddedProviders = null;
      telegramTransport = null;
      snapshot = Object.freeze({
        status: "idle",
        transport: null,
        account: null,
        sessionId: null,
        error: null,
      });
    },
  });
}
