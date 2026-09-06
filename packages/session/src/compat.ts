/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */

export type LegacyWispScope = `eip155:${number}` | `antelope:${string}` | `solana:${string}`;
export type LegacyRequestArguments<TParams = unknown> = { method: string; params?: TParams };
export type LegacySessionAccount = { scope: LegacyWispScope; address: string; label?: string };
export type LegacyWispSession = {
  id: string;
  dapp?: unknown;
  origin?: string;
  scopes: LegacyWispScope[];
  accounts: LegacySessionAccount[];
  createdAt: number;
  updatedAt: number;
};

type EVMCompatClient = {
  connect(): Promise<string[]>;
  getChainId(): Promise<string>;
  request<TResult = unknown, TParams = unknown>(args: LegacyRequestArguments<TParams>): Promise<TResult>;
  disconnect?: () => Promise<void>;
};
type SolanaCompatClient = {
  connect(): Promise<Array<{ publicKey: string; label?: string }>>;
  request<TResult = unknown, TParams = unknown>(args: LegacyRequestArguments<TParams>): Promise<TResult>;
  disconnect(): Promise<void>;
};
type VexaniumCompatClient = {
  connect(args: { chainId: string; dapp?: unknown }): Promise<Array<{ permissionLevel: string; label?: string }>>;
  getSession(): { chainId: string; walletSessionId?: string } | null;
  request<TResult = unknown, TParams = unknown>(args: LegacyRequestArguments<TParams>): Promise<TResult>;
  disconnect(): Promise<void>;
};
export type LegacyWispSessionClientOptions = {
  dapp?: unknown;
  evm?: EVMCompatClient;
  solana?: SolanaCompatClient;
  vexanium?: VexaniumCompatClient;
};
export type LegacyWispInvokeArgs<TParams = unknown> = { scope: LegacyWispScope; request: LegacyRequestArguments<TParams> };

function providerError(code: number, message: string): Error & { code: number } {
  return Object.assign(new Error(message), { code });
}
function evmScopeFromHexChainId(chainId: string): `eip155:${number}` {
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(chainId)) throw providerError(-32603, `Provider returned invalid EVM chain ID: ${chainId}`);
  return `eip155:${BigInt(chainId).toString()}` as `eip155:${number}`;
}
function cloneSession(session: LegacyWispSession | null): LegacyWispSession | null {
  return session ? { ...session, scopes: [...session.scopes], accounts: session.accounts.map((account) => ({ ...account })) } : null;
}

export function isEVMScope(scope: string): scope is `eip155:${number}` { return /^eip155:(?:0|[1-9]\d*)$/.test(scope); }
export function isVexaniumScope(scope: string): scope is `antelope:${string}` { return /^antelope:[0-9a-f]{32}$/.test(scope); }
export function isSolanaScope(scope: string): scope is `solana:${string}` { return /^solana:[a-zA-Z0-9_-]+$/.test(scope); }
export function createSessionId(scopes: string[]): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `wisp:${Date.now().toString(36)}:${scopes.join(",")}:${randomPart}`;
}

export async function createWispSessionClient(options: LegacyWispSessionClientOptions = {}) {
  let evm = options.evm;
  let solana = options.solana;
  let vexanium = options.vexanium;
  let session: LegacyWispSession | null = null;

  const getEVM = async (): Promise<EVMCompatClient> => {
    if (!evm) { const module = await import("@windstack/evm"); evm = await module.createEVMClient() as EVMCompatClient; }
    return evm;
  };
  const getSolana = async (): Promise<SolanaCompatClient> => {
    if (!solana) { const module = await import("@windstack/solana"); solana = await module.createSolanaClient() as SolanaCompatClient; }
    return solana;
  };
  const getVexanium = async (): Promise<VexaniumCompatClient> => {
    if (!vexanium) { const module = await import("@windstack/vexanium"); vexanium = await module.createVexaniumClient({ dapp: options.dapp as never }) as VexaniumCompatClient; }
    return vexanium;
  };
  const disconnectAll = async (): Promise<void> => {
    await Promise.allSettled([evm?.disconnect?.(), solana?.disconnect(), vexanium?.disconnect()].filter(Boolean) as Promise<unknown>[]);
  };

  return {
    async connect(scopes: LegacyWispScope[]): Promise<LegacyWispSession> {
      const unique = [...new Set(scopes)];
      if (!unique.length || !unique.every((scope) => isEVMScope(scope) || isSolanaScope(scope) || isVexaniumScope(scope))) throw providerError(-32602, "One or more wallet scopes are invalid");
      if (session) throw providerError(-32002, "A Wisp session is already active");
      const accounts: LegacySessionAccount[] = [];
      try {
        const evmScope = unique.find(isEVMScope);
        if (evmScope) {
          const client = await getEVM();
          const connected = await client.connect();
          const activeScope = evmScopeFromHexChainId(await client.getChainId());
          if (activeScope !== evmScope) throw providerError(-32602, `EVM provider is connected to ${activeScope}, not requested scope ${evmScope}`);
          for (const address of connected) accounts.push({ scope: evmScope, address });
        }
        const solanaScope = unique.find(isSolanaScope);
        if (solanaScope) for (const account of await (await getSolana()).connect()) accounts.push({ scope: solanaScope, address: account.publicKey, label: account.label });
        const vexScope = unique.find(isVexaniumScope);
        if (vexScope) {
          const client = await getVexanium();
          const connected = await client.connect({ chainId: vexScope, dapp: options.dapp });
          const active = client.getSession()?.chainId;
          if (!active || !(active === vexScope || active.endsWith(vexScope.slice("antelope:".length)))) throw providerError(-32603, "Vexanium provider returned the wrong chain");
          for (const account of connected) accounts.push({ scope: vexScope, address: account.permissionLevel, label: account.label });
        }
      } catch (error) { await disconnectAll(); throw error; }
      if (!accounts.length) { await disconnectAll(); throw providerError(4100, "No wallet accounts were authorized"); }
      const now = Date.now();
      session = { id: createSessionId(unique), dapp: options.dapp, origin: typeof globalThis.location?.origin === "string" ? globalThis.location.origin : undefined, scopes: unique, accounts, createdAt: now, updatedAt: now };
      return cloneSession(session)!;
    },
    getSession(): LegacyWispSession | null { return cloneSession(session); },
    async invoke<TResult = unknown, TParams = unknown>(args: LegacyWispInvokeArgs<TParams>): Promise<TResult> {
      if (!session || !session.scopes.includes(args.scope)) throw providerError(-32602, "No active session for requested scope");
      if (isEVMScope(args.scope)) return (await getEVM()).request<TResult, TParams>(args.request);
      if (isSolanaScope(args.scope)) return (await getSolana()).request<TResult, TParams>(args.request);
      if (isVexaniumScope(args.scope)) return (await getVexanium()).request<TResult, TParams>(args.request);
      throw providerError(-32602, `Unsupported scope: ${args.scope}`);
    },
    async disconnect(): Promise<void> { await disconnectAll(); session = null; },
  };
}
