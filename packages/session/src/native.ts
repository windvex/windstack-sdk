/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AntelopeClient, type Action, type Signer, type TransactResult } from "@windstack/antelope";

export type SessionChain = { id: string; url: string };
export type SessionIdentity = { actor: string; permission: string; publicKey?: string };
export type WalletLoginContext = { chain: SessionChain; appName?: string };
export type WalletLoginResult = { identity: SessionIdentity; signer: Signer };
export interface WalletPlugin { readonly id: string; login(context: WalletLoginContext): Promise<WalletLoginResult>; logout?(context: WalletLoginContext & { identity: SessionIdentity }): Promise<void> }
export interface SessionStorage { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> }
export class MemorySessionStorage implements SessionStorage { readonly #values = new Map<string, string>(); async get(key: string): Promise<string | null> { return this.#values.get(key) ?? null; } async set(key: string, value: string): Promise<void> { this.#values.set(key, value); } async remove(key: string): Promise<void> { this.#values.delete(key); } }

export class Session {
  readonly chain: SessionChain; readonly identity: SessionIdentity; readonly walletPlugin: WalletPlugin; readonly client: AntelopeClient; readonly signer: Signer;
  constructor(args: { chain: SessionChain; identity: SessionIdentity; walletPlugin: WalletPlugin; signer: Signer }) { this.chain = args.chain; this.identity = args.identity; this.walletPlugin = args.walletPlugin; this.signer = args.signer; this.client = new AntelopeClient({ endpoints: args.chain.url }); }
  get actor(): string { return this.identity.actor; }
  get permission(): string { return this.identity.permission; }
  get permissionLevel(): { actor: string; permission: string } { return { actor: this.actor, permission: this.permission }; }
  transact<T = Record<string, unknown>>(args: { actions: Action[]; broadcast?: boolean; expireSeconds?: number; signal?: AbortSignal }): Promise<TransactResult<T>> { return this.client.transact<T>({ ...args, signer: this.signer }); }
  contract(account: string) { return this.client.contract(account); }
  account(name = this.actor) { return this.client.account(name); }
}

export type SessionKitOptions = { chains: SessionChain[]; walletPlugins: WalletPlugin[]; appName?: string; storage?: SessionStorage; storageKey?: string };
export class SessionKit {
  readonly chains: readonly SessionChain[]; readonly walletPlugins: readonly WalletPlugin[]; readonly appName?: string; readonly storage: SessionStorage; readonly storageKey: string;
  #session: Session | null = null;
  constructor(options: SessionKitOptions) {
    if (!options.chains.length) throw new TypeError("SessionKit requires at least one chain");
    if (!options.walletPlugins.length) throw new TypeError("SessionKit requires at least one wallet plugin");
    this.chains = options.chains; this.walletPlugins = options.walletPlugins; this.appName = options.appName; this.storage = options.storage ?? new MemorySessionStorage(); this.storageKey = options.storageKey ?? "windstack:session";
  }
  getSession(): Session | null { return this.#session; }
  async login(options: { chainId?: string; walletPluginId?: string } = {}): Promise<Session> {
    const chain = options.chainId ? this.chains.find((item) => item.id === options.chainId) : this.chains[0];
    const plugin = options.walletPluginId ? this.walletPlugins.find((item) => item.id === options.walletPluginId) : this.walletPlugins[0];
    if (!chain) throw new TypeError(`Unknown chain: ${options.chainId}`); if (!plugin) throw new TypeError(`Unknown wallet plugin: ${options.walletPluginId}`);
    const result = await plugin.login({ chain, appName: this.appName });
    this.#session = new Session({ chain, identity: result.identity, walletPlugin: plugin, signer: result.signer });
    await this.storage.set(this.storageKey, JSON.stringify({ chainId: chain.id, walletPluginId: plugin.id, identity: result.identity }));
    return this.#session;
  }
  async logout(): Promise<void> {
    const session = this.#session;
    if (session?.walletPlugin.logout) await session.walletPlugin.logout({ chain: session.chain, appName: this.appName, identity: session.identity });
    this.#session = null; await this.storage.remove(this.storageKey);
  }
  async getStoredSession(): Promise<{ chainId: string; walletPluginId: string; identity: SessionIdentity } | null> {
    const raw = await this.storage.get(this.storageKey); if (!raw) return null;
    const value = JSON.parse(raw) as { chainId?: unknown; walletPluginId?: unknown; identity?: unknown };
    if (typeof value.chainId !== "string" || typeof value.walletPluginId !== "string" || typeof value.identity !== "object" || !value.identity) return null;
    return value as { chainId: string; walletPluginId: string; identity: SessionIdentity };
  }
}
