/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  AntelopeClient,
  nameToBigInt,
  type Action,
  type ChainContracts,
  type Signer,
  type TransactResult,
} from "@windstack/antelope";

export type SessionChain = {
  id: string;
  url: string | string[];
  contracts?: ChainContracts;
};
export type SessionIdentity = { actor: string; permission: string; publicKey?: string };
export type WalletLoginContext = { chain: SessionChain; appName?: string };
export type WalletLoginResult = { identity: SessionIdentity; signer: Signer };
export interface WalletPlugin {
  readonly id: string;
  login(context: WalletLoginContext): Promise<WalletLoginResult>;
  restore?(
    context: WalletLoginContext & { identity: SessionIdentity },
  ): Promise<WalletLoginResult | null>;
  logout?(context: WalletLoginContext & { identity: SessionIdentity }): Promise<void>;
}
export interface SessionStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemorySessionStorage implements SessionStorage {
  readonly #values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.#values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.#values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.#values.delete(key);
  }
}

function validateIdentity(identity: SessionIdentity): SessionIdentity {
  if (!identity || typeof identity !== "object") throw new TypeError("Wallet returned no identity");
  nameToBigInt(identity.actor);
  nameToBigInt(identity.permission);
  if (identity.publicKey !== undefined && typeof identity.publicKey !== "string") {
    throw new TypeError("Wallet identity publicKey must be a string");
  }
  return { ...identity };
}

function validateChain(chain: SessionChain): SessionChain {
  if (!/^[0-9a-f]{64}$/i.test(chain.id)) {
    throw new TypeError("Session chain id must be a 64-character Antelope chain id");
  }
  const urls = Array.isArray(chain.url) ? chain.url : [chain.url];
  if (!urls.length || urls.some((url) => typeof url !== "string" || !url.trim())) {
    throw new TypeError("Session chain requires at least one RPC URL");
  }
  return { ...chain, id: chain.id.toLowerCase(), url: Array.isArray(chain.url) ? [...chain.url] : chain.url };
}

export class Session {
  readonly chain: SessionChain;
  readonly identity: SessionIdentity;
  readonly walletPlugin: WalletPlugin;
  readonly client: AntelopeClient;
  readonly signer: Signer;

  constructor(args: {
    chain: SessionChain;
    identity: SessionIdentity;
    walletPlugin: WalletPlugin;
    signer: Signer;
  }) {
    this.chain = validateChain(args.chain);
    this.identity = validateIdentity(args.identity);
    this.walletPlugin = args.walletPlugin;
    this.signer = args.signer;
    this.client = new AntelopeClient({
      endpoints: this.chain.url,
      chainId: this.chain.id,
      contracts: this.chain.contracts,
    });
  }

  get actor(): string {
    return this.identity.actor;
  }

  get permission(): string {
    return this.identity.permission;
  }

  get permissionLevel(): { actor: string; permission: string } {
    return { actor: this.actor, permission: this.permission };
  }

  transact<T = Record<string, unknown>>(args: {
    actions: Action[];
    broadcast?: boolean;
    expireSeconds?: number;
    signal?: AbortSignal;
  }): Promise<TransactResult<T>> {
    return this.client.transact<T>({ ...args, signer: this.signer });
  }

  contract(account: string) {
    return this.client.contract(account);
  }

  account(name = this.actor) {
    return this.client.account(name);
  }
}

export type SessionKitOptions = {
  chains: SessionChain[];
  walletPlugins: WalletPlugin[];
  appName?: string;
  storage?: SessionStorage;
  storageKey?: string;
};

type StoredSession = {
  chainId: string;
  walletPluginId: string;
  identity: SessionIdentity;
};

export class SessionKit {
  readonly chains: readonly SessionChain[];
  readonly walletPlugins: readonly WalletPlugin[];
  readonly appName?: string;
  readonly storage: SessionStorage;
  readonly storageKey: string;
  #session: Session | null = null;

  constructor(options: SessionKitOptions) {
    if (!options.chains.length) throw new TypeError("SessionKit requires at least one chain");
    if (!options.walletPlugins.length) throw new TypeError("SessionKit requires at least one wallet plugin");
    const chains = options.chains.map(validateChain);
    const chainIds = new Set(chains.map((chain) => chain.id));
    if (chainIds.size !== chains.length) throw new TypeError("SessionKit chain ids must be unique");
    const pluginIds = new Set(options.walletPlugins.map((plugin) => plugin.id));
    if (pluginIds.size !== options.walletPlugins.length || pluginIds.has("")) {
      throw new TypeError("SessionKit wallet plugin ids must be non-empty and unique");
    }
    this.chains = chains;
    this.walletPlugins = [...options.walletPlugins];
    this.appName = options.appName;
    this.storage = options.storage ?? new MemorySessionStorage();
    this.storageKey = options.storageKey ?? "windstack:session";
  }

  getSession(): Session | null {
    return this.#session;
  }

  async login(options: { chainId?: string; walletPluginId?: string } = {}): Promise<Session> {
    const requestedChainId = options.chainId?.toLowerCase();
    const chain = requestedChainId
      ? this.chains.find((item) => item.id === requestedChainId)
      : this.chains[0];
    const plugin = options.walletPluginId
      ? this.walletPlugins.find((item) => item.id === options.walletPluginId)
      : this.walletPlugins[0];
    if (!chain) throw new TypeError(`Unknown chain: ${options.chainId}`);
    if (!plugin) throw new TypeError(`Unknown wallet plugin: ${options.walletPluginId}`);

    const result = await plugin.login({ chain, appName: this.appName });
    const session = new Session({
      chain,
      identity: validateIdentity(result.identity),
      walletPlugin: plugin,
      signer: result.signer,
    });
    await this.storage.set(
      this.storageKey,
      JSON.stringify({ chainId: chain.id, walletPluginId: plugin.id, identity: session.identity }),
    );
    this.#session = session;
    return session;
  }

  async restore(): Promise<Session | null> {
    const stored = await this.getStoredSession();
    if (!stored) return null;
    const chain = this.chains.find((item) => item.id === stored.chainId.toLowerCase());
    const plugin = this.walletPlugins.find((item) => item.id === stored.walletPluginId);
    if (!chain || !plugin?.restore) return null;
    const result = await plugin.restore({
      chain,
      appName: this.appName,
      identity: stored.identity,
    });
    if (!result) return null;
    const session = new Session({
      chain,
      identity: validateIdentity(result.identity),
      walletPlugin: plugin,
      signer: result.signer,
    });
    this.#session = session;
    return session;
  }

  async logout(): Promise<void> {
    const session = this.#session;
    try {
      if (session?.walletPlugin.logout) {
        await session.walletPlugin.logout({
          chain: session.chain,
          appName: this.appName,
          identity: session.identity,
        });
      }
    } finally {
      this.#session = null;
      await this.storage.remove(this.storageKey);
    }
  }

  async getStoredSession(): Promise<StoredSession | null> {
    const raw = await this.storage.get(this.storageKey);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<StoredSession>;
      if (
        typeof value.chainId !== "string" ||
        typeof value.walletPluginId !== "string" ||
        typeof value.identity !== "object" ||
        !value.identity
      ) {
        return null;
      }
      return {
        chainId: value.chainId,
        walletPluginId: value.walletPluginId,
        identity: validateIdentity(value.identity),
      };
    } catch {
      return null;
    }
  }
}
