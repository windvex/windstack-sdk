/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AbiSerializer, bytesToHex, type Abi } from "@windstack/abi";
import { RpcClient, type TableRowsRequest, type TableRowsResponse } from "@windstack/rpc";

export type PermissionLevel = { actor: string; permission: string };
export type ContractAction = { account: string; name: string; authorization: PermissionLevel[]; data: string };
export type AuthorizationInput = PermissionLevel | `${string}@${string}`;

export class AbiCache {
  readonly #entries = new Map<string, { abi: Abi; expiresAt: number }>();
  constructor(readonly ttlMs = 5 * 60_000) {}
  get(account: string): Abi | undefined { const entry = this.#entries.get(account); if (!entry || entry.expiresAt < Date.now()) { this.#entries.delete(account); return undefined; } return entry.abi; }
  set(account: string, abi: Abi): void { this.#entries.set(account, { abi, expiresAt: Date.now() + this.ttlMs }); }
  delete(account: string): void { this.#entries.delete(account); }
  clear(): void { this.#entries.clear(); }
}

function normalizeAuthorization(input: AuthorizationInput[]): PermissionLevel[] {
  return input.map((item) => typeof item === "string" ? (() => { const [actor, permission = "active"] = item.split("@"); if (!actor) throw new TypeError("Authorization actor is required"); return { actor, permission }; })() : item);
}

export class Contract {
  readonly account: string; readonly rpc: RpcClient; readonly abiCache: AbiCache;
  constructor(account: string, rpc: RpcClient, abiCache = new AbiCache()) { this.account = account; this.rpc = rpc; this.abiCache = abiCache; }
  async getAbi(force = false, signal?: AbortSignal): Promise<Abi> {
    if (!force) { const cached = this.abiCache.get(this.account); if (cached) return cached; }
    const result = await this.rpc.getAbi(this.account, signal);
    if (!result.abi || typeof result.abi !== "object") throw new TypeError(`RPC returned no ABI for ${this.account}`);
    const abi = result.abi as Abi; this.abiCache.set(this.account, abi); return abi;
  }
  async action(name: string, data: unknown, authorization: AuthorizationInput[] = [], signal?: AbortSignal): Promise<ContractAction> {
    const serializer = new AbiSerializer(await this.getAbi(false, signal));
    return { account: this.account, name, authorization: normalizeAuthorization(authorization), data: bytesToHex(serializer.encodeAction(name, data)) };
  }
  tableRows<T = Record<string, unknown>>(table: string, scope: string = this.account, options: Omit<TableRowsRequest, "code" | "scope" | "table"> = {}, signal?: AbortSignal): Promise<TableRowsResponse<T>> {
    return this.rpc.getTableRows<T>({ code: this.account, scope, table, ...options }, signal);
  }
}
