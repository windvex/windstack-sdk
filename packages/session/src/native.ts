/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  AntelopeClient,
  PublicKey,
  nameToBigInt,
  type Action,
  type ChainContracts,
  type Signer,
  type TransactResult,
} from "@windstack/antelope";

export type SessionChain = {
  id: string;
  url: string | readonly string[];
  contracts?: Readonly<ChainContracts>;
};
export type SessionIdentity = { actor: string; permission: string; publicKey?: string };
export type WalletLoginContext = { chain: SessionChain; appName?: string };
export type WalletLoginResult = {
  identity: SessionIdentity;
  signer: Signer;
  /** Opaque wallet-issued session id. Never contains private key material. */
  walletSessionId?: string;
};
export type WalletSessionContext = WalletLoginContext & {
  identity: SessionIdentity;
  walletSessionId?: string;
};
export interface WalletPlugin {
  readonly id: string;
  login(context: WalletLoginContext): Promise<WalletLoginResult>;
  restore?(context: WalletSessionContext): Promise<WalletLoginResult | null>;
  logout?(context: WalletSessionContext): Promise<void>;
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

function validateNonEmptyName(value: string, label: string): string {
  if (typeof value !== "string" || !value) throw new TypeError(`${label} is required`);
  nameToBigInt(value);
  return value;
}

function validateIdentity(identity: SessionIdentity): SessionIdentity {
  if (!identity || typeof identity !== "object") throw new TypeError("Wallet returned no identity");
  const actor = validateNonEmptyName(identity.actor, "Wallet identity actor");
  const permission = validateNonEmptyName(identity.permission, "Wallet identity permission");
  if (identity.publicKey !== undefined && typeof identity.publicKey !== "string") {
    throw new TypeError("Wallet identity publicKey must be a string");
  }
  if (identity.publicKey !== undefined) PublicKey.fromString(identity.publicKey);
  return Object.freeze({ ...identity, actor, permission });
}

function hasAsciiControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function validateWalletSessionId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    value !== value.trim() ||
    hasAsciiControlCharacter(value)
  ) {
    throw new TypeError("Wallet session id must be a non-empty opaque string");
  }
  return value;
}

function validateSigner(signer: Signer): Signer {
  if (
    !signer ||
    typeof signer !== "object" ||
    typeof signer.getAvailableKeys !== "function" ||
    typeof signer.sign !== "function"
  ) {
    throw new TypeError("Wallet returned an invalid signer");
  }
  return signer;
}

function identitiesMatch(expected: SessionIdentity, actual: SessionIdentity): boolean {
  if (expected.actor !== actual.actor || expected.permission !== actual.permission) return false;
  if (expected.publicKey === undefined) return true;
  if (actual.publicKey === undefined) return false;
  return PublicKey.fromString(expected.publicKey).equals(PublicKey.fromString(actual.publicKey));
}

function validateChain(chain: SessionChain): SessionChain {
  if (!/^[0-9a-f]{64}$/i.test(chain.id)) {
    throw new TypeError("Session chain id must be a 64-character Antelope chain id");
  }
  const urls = Array.isArray(chain.url) ? chain.url : [chain.url];
  if (
    !urls.length ||
    urls.some((url) => typeof url !== "string" || !/^https?:\/\/[^\s]+$/i.test(url.trim()))
  ) {
    throw new TypeError("Session chain requires at least one HTTP(S) RPC URL");
  }
  const contracts = chain.contracts
    ? Object.freeze({
        ...(chain.contracts.system
          ? { system: validateNonEmptyName(chain.contracts.system, "System contract") }
          : {}),
        ...(chain.contracts.token
          ? { token: validateNonEmptyName(chain.contracts.token, "Token contract") }
          : {}),
      })
    : undefined;
  return Object.freeze({
    ...chain,
    id: chain.id.toLowerCase(),
    url: Array.isArray(chain.url) ? Object.freeze([...chain.url]) : chain.url,
    contracts,
  });
}

function validatePlugin(plugin: WalletPlugin): WalletPlugin {
  if (
    !plugin ||
    typeof plugin !== "object" ||
    typeof plugin.id !== "string" ||
    !plugin.id.trim() ||
    plugin.id !== plugin.id.trim() ||
    typeof plugin.login !== "function"
  ) {
    throw new TypeError("Wallet plugins require a non-empty stable id and login function");
  }
  return plugin;
}

export class Session {
  readonly chain: SessionChain;
  readonly identity: SessionIdentity;
  readonly walletPlugin: WalletPlugin;
  readonly walletSessionId?: string;
  readonly client: AntelopeClient;
  readonly signer: Signer;

  constructor(args: {
    chain: SessionChain;
    identity: SessionIdentity;
    walletPlugin: WalletPlugin;
    walletSessionId?: string;
    signer: Signer;
  }) {
    this.chain = validateChain(args.chain);
    this.identity = validateIdentity(args.identity);
    this.walletPlugin = validatePlugin(args.walletPlugin);
    this.walletSessionId = validateWalletSessionId(args.walletSessionId);
    this.signer = validateSigner(args.signer);
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

export type SessionManagerOptions = {
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
  walletSessionId?: string;
};

export class SessionManager {
  readonly chains: readonly SessionChain[];
  readonly walletPlugins: readonly WalletPlugin[];
  readonly appName?: string;
  readonly storage: SessionStorage;
  readonly storageKey: string;
  #session: Session | null = null;
  #loginPending = false;
  #restorePending = false;

  constructor(options: SessionManagerOptions) {
    if (!options.chains.length) throw new TypeError("SessionManager requires at least one chain");
    if (!options.walletPlugins.length)
      throw new TypeError("SessionManager requires at least one wallet plugin");
    const chains = options.chains.map(validateChain);
    const plugins = options.walletPlugins.map(validatePlugin);
    const chainIds = new Set(chains.map((chain) => chain.id));
    if (chainIds.size !== chains.length)
      throw new TypeError("SessionManager chain ids must be unique");
    const pluginIds = new Set(plugins.map((plugin) => plugin.id));
    if (pluginIds.size !== plugins.length) {
      throw new TypeError("SessionManager wallet plugin ids must be unique");
    }
    if (options.storageKey !== undefined && !options.storageKey.trim()) {
      throw new TypeError("Session storage key must be non-empty");
    }
    this.chains = Object.freeze(chains);
    this.walletPlugins = Object.freeze(plugins);
    this.appName = options.appName;
    this.storage = options.storage ?? new MemorySessionStorage();
    this.storageKey = options.storageKey ?? "windstack:session";
  }

  getSession(): Session | null {
    return this.#session;
  }

  async login(options: { chainId?: string; walletPluginId?: string } = {}): Promise<Session> {
    if (this.#session || this.#loginPending || this.#restorePending) {
      throw new Error("A wallet session is already active; logout before starting another session");
    }
    const requestedChainId = options.chainId?.toLowerCase();
    const chain = requestedChainId
      ? this.chains.find((item) => item.id === requestedChainId)
      : this.chains[0];
    const plugin = options.walletPluginId
      ? this.walletPlugins.find((item) => item.id === options.walletPluginId)
      : this.walletPlugins[0];
    if (!chain) throw new TypeError(`Unknown chain: ${options.chainId}`);
    if (!plugin) throw new TypeError(`Unknown wallet plugin: ${options.walletPluginId}`);

    this.#loginPending = true;
    try {
      const result = await plugin.login({ chain, appName: this.appName });
      const identity = validateIdentity(result.identity);
      const walletSessionId = validateWalletSessionId(result.walletSessionId);
      const session = new Session({
        chain,
        identity,
        walletPlugin: plugin,
        walletSessionId,
        signer: validateSigner(result.signer),
      });
      try {
        await this.storage.set(
          this.storageKey,
          JSON.stringify({
            chainId: chain.id,
            walletPluginId: plugin.id,
            identity: session.identity,
            walletSessionId: session.walletSessionId,
          }),
        );
      } catch (error) {
        if (plugin.logout) {
          await plugin
            .logout({
              chain,
              appName: this.appName,
              identity: session.identity,
              walletSessionId: session.walletSessionId,
            })
            .catch(() => undefined);
        }
        throw error;
      }
      this.#session = session;
      return session;
    } finally {
      this.#loginPending = false;
    }
  }

  async restore(): Promise<Session | null> {
    if (this.#session) return this.#session;
    if (this.#loginPending || this.#restorePending) {
      throw new Error("A wallet session operation is already in progress");
    }
    this.#restorePending = true;
    try {
      const stored = await this.getStoredSession();
      if (!stored) return null;
      const chain = this.chains.find((item) => item.id === stored.chainId.toLowerCase());
      const plugin = this.walletPlugins.find((item) => item.id === stored.walletPluginId);
      if (!chain || !plugin?.restore) {
        await this.storage.remove(this.storageKey);
        return null;
      }
      const result = await plugin.restore({
        chain,
        appName: this.appName,
        identity: stored.identity,
        walletSessionId: stored.walletSessionId,
      });
      if (!result) {
        await this.storage.remove(this.storageKey);
        return null;
      }
      const restoredIdentity = validateIdentity(result.identity);
      if (!identitiesMatch(stored.identity, restoredIdentity)) {
        await this.storage.remove(this.storageKey).catch(() => undefined);
        throw new Error("Wallet restored an identity that does not match the stored session");
      }
      const restoredWalletSessionId = validateWalletSessionId(result.walletSessionId);
      if (
        stored.walletSessionId !== undefined &&
        restoredWalletSessionId !== stored.walletSessionId
      ) {
        await this.storage.remove(this.storageKey).catch(() => undefined);
        throw new Error("Wallet restored a session id that does not match the stored session");
      }
      const session = new Session({
        chain,
        identity: restoredIdentity,
        walletPlugin: plugin,
        walletSessionId: restoredWalletSessionId ?? stored.walletSessionId,
        signer: validateSigner(result.signer),
      });
      try {
        await this.storage.set(
          this.storageKey,
          JSON.stringify({
            chainId: chain.id,
            walletPluginId: plugin.id,
            identity: session.identity,
            walletSessionId: session.walletSessionId,
          }),
        );
      } catch (error) {
        if (plugin.logout) {
          await plugin
            .logout({
              chain,
              appName: this.appName,
              identity: session.identity,
              walletSessionId: session.walletSessionId,
            })
            .catch(() => undefined);
        }
        throw error;
      }
      this.#session = session;
      return session;
    } finally {
      this.#restorePending = false;
    }
  }

  async logout(): Promise<void> {
    if (this.#loginPending || this.#restorePending) {
      throw new Error("Cannot logout while a wallet session operation is in progress");
    }
    const session = this.#session;
    let logoutError: unknown;
    try {
      if (session?.walletPlugin.logout) {
        await session.walletPlugin.logout({
          chain: session.chain,
          appName: this.appName,
          identity: session.identity,
          walletSessionId: session.walletSessionId,
        });
      }
    } catch (error) {
      logoutError = error;
    }

    this.#session = null;
    let storageError: unknown;
    try {
      await this.storage.remove(this.storageKey);
    } catch (error) {
      storageError = error;
    }

    if (logoutError && storageError) {
      throw new AggregateError(
        [logoutError, storageError],
        "Wallet logout and session cleanup failed",
      );
    }
    if (logoutError) throw logoutError;
    if (storageError) throw storageError;
  }

  async getStoredSession(): Promise<StoredSession | null> {
    const raw = await this.storage.get(this.storageKey);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<StoredSession>;
      if (
        typeof value.chainId !== "string" ||
        !/^[0-9a-f]{64}$/i.test(value.chainId) ||
        typeof value.walletPluginId !== "string" ||
        !value.walletPluginId.trim() ||
        typeof value.identity !== "object" ||
        !value.identity
      ) {
        await this.storage.remove(this.storageKey).catch(() => undefined);
        return null;
      }
      return {
        chainId: value.chainId.toLowerCase(),
        walletPluginId: value.walletPluginId,
        identity: validateIdentity(value.identity),
        walletSessionId: validateWalletSessionId(value.walletSessionId),
      };
    } catch {
      await this.storage.remove(this.storageKey).catch(() => undefined);
      return null;
    }
  }
}
