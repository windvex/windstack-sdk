/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AbiSerializer, bytesToHex, nameToBigInt, type Abi } from "@windstack/abi";
import type { RpcClient, TableRowsRequest, TableRowsResponse } from "@windstack/rpc";

export type PermissionLevel = { actor: string; permission: string };
export type ContractAction = {
  account: string;
  name: string;
  authorization: PermissionLevel[];
  data: string;
};
export type AuthorizationInput = PermissionLevel | `${string}@${string}`;
export type TableScope = string | number | bigint;

function validateName(value: string, label: string): string {
  if (!value) throw new TypeError(`${label} is required`);
  nameToBigInt(value);
  return value;
}

function normalizeTableScope(value: TableScope): string {
  if (typeof value === "bigint") {
    if (value < 0n || value > 0xffffffffffffffffn) {
      throw new RangeError("Table scope integer must fit in uint64");
    }
    return value.toString();
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError("Numeric table scope must be a non-negative safe integer");
    }
    return String(value);
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("Table scope must be a non-empty string or non-negative integer");
  }
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const integer = BigInt(normalized);
    if (integer > 0xffffffffffffffffn) {
      throw new RangeError("Table scope integer must fit in uint64");
    }
    return integer.toString();
  }
  if (/^[A-Z]{1,7}$/.test(normalized)) return normalized;
  try {
    nameToBigInt(normalized);
  } catch {
    throw new TypeError("Table scope must be name-like, symbol-like, or a uint64 value");
  }
  return normalized;
}

export class AbiCache {
  readonly #entries = new Map<string, { abi: Abi; expiresAt: number }>();
  readonly #pending = new Map<string, Promise<Abi>>();

  constructor(readonly ttlMs = 5 * 60_000) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0)
      throw new RangeError("ABI cache TTL must be non-negative");
  }

  get(account: string): Abi | undefined {
    const entry = this.#entries.get(account);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.#entries.delete(account);
      return undefined;
    }
    return entry.abi;
  }

  set(account: string, abi: Abi): void {
    this.#entries.set(account, { abi, expiresAt: Date.now() + this.ttlMs });
  }

  delete(account: string): void {
    this.#entries.delete(account);
  }

  clear(): void {
    this.#entries.clear();
  }

  async getOrLoad(account: string, loader: () => Promise<Abi>): Promise<Abi> {
    const cached = this.get(account);
    if (cached) return cached;
    const pending = this.#pending.get(account);
    if (pending) return pending;
    const request = loader()
      .then((abi) => {
        this.set(account, abi);
        return abi;
      })
      .finally(() => {
        this.#pending.delete(account);
      });
    this.#pending.set(account, request);
    return request;
  }
}

function normalizeAuthorization(input: AuthorizationInput[]): PermissionLevel[] {
  return input.map((item) => {
    const value =
      typeof item === "string"
        ? (() => {
            const separator = item.indexOf("@");
            const actor = separator >= 0 ? item.slice(0, separator) : item;
            const permission = separator >= 0 ? item.slice(separator + 1) : "active";
            return { actor, permission };
          })()
        : item;
    return {
      actor: validateName(value.actor, "Authorization actor"),
      permission: validateName(value.permission, "Authorization permission"),
    };
  });
}

export class Contract {
  readonly account: string;
  readonly rpc: RpcClient;
  readonly abiCache: AbiCache;

  constructor(account: string, rpc: RpcClient, abiCache = new AbiCache()) {
    this.account = validateName(account, "Contract account");
    this.rpc = rpc;
    this.abiCache = abiCache;
  }

  async getAbi(force = false, signal?: AbortSignal): Promise<Abi> {
    if (!force) {
      const cached = this.abiCache.get(this.account);
      if (cached) return cached;
    }

    const load = async (): Promise<Abi> => {
      const result = await this.rpc.getAbi(this.account, signal);
      if (!result.abi || typeof result.abi !== "object") {
        throw new TypeError(`RPC returned no ABI for ${this.account}`);
      }
      const abi = result.abi as Abi;
      new AbiSerializer(abi);
      return abi;
    };

    if (force) {
      const abi = await load();
      this.abiCache.set(this.account, abi);
      return abi;
    }
    return this.abiCache.getOrLoad(this.account, load);
  }

  refreshAbi(signal?: AbortSignal): Promise<Abi> {
    return this.getAbi(true, signal);
  }

  deleteAbi(): void {
    this.abiCache.delete(this.account);
  }

  async action(
    name: string,
    data: unknown,
    authorization: AuthorizationInput[] = [],
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    validateName(name, "Action name");
    const serializer = new AbiSerializer(await this.getAbi(false, signal));
    return {
      account: this.account,
      name,
      authorization: normalizeAuthorization(authorization),
      data: bytesToHex(serializer.encodeAction(name, data)),
    };
  }

  tableRows<T = Record<string, unknown>>(
    table: string,
    scope: TableScope = this.account,
    options: Omit<TableRowsRequest, "code" | "scope" | "table"> = {},
    signal?: AbortSignal,
  ): Promise<TableRowsResponse<T>> {
    validateName(table, "Table name");
    return this.rpc.getTableRows<T>(
      {
        code: this.account,
        scope: normalizeTableScope(scope),
        table,
        ...options,
      },
      signal,
    );
  }
}

export class ContractKit {
  readonly rpc: RpcClient;
  readonly abiCache: AbiCache;

  constructor(rpc: RpcClient, options: { abiCache?: AbiCache } = {}) {
    this.rpc = rpc;
    this.abiCache = options.abiCache ?? new AbiCache();
  }

  contract(account: string): Contract {
    return new Contract(account, this.rpc, this.abiCache);
  }

  async load(account: string, signal?: AbortSignal): Promise<Contract> {
    const contract = this.contract(account);
    await contract.getAbi(false, signal);
    return contract;
  }
}
