/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  AbiSerializer,
  bytesToHex,
  hexToBytes,
  nameToBigInt,
  type Abi,
  type AbiStruct,
  type AbiVariant,
} from "@windstack/abi";
import { serializeTransaction, transactionDigest, type Transaction } from "@windstack/antelope";
import type { RpcClient } from "@windstack/rpc";
import {
  SIGNING_REQUEST_PLACEHOLDER_ACTOR,
  SIGNING_REQUEST_PLACEHOLDER_PERMISSION,
  type SigningRequest,
} from "./request.js";
import { SIGNING_REQUEST_ABI, SIGNING_REQUEST_ABI_V2 } from "./schema.js";
import type {
  ResolvedSigningRequest,
  SigningRequestAbiProvider,
  SigningRequestAction,
  SigningRequestChain,
  SigningRequestIdentity,
  SigningRequestPermissionLevel,
  SigningRequestResolveOptions,
  SigningRequestTapos,
  SigningRequestTransaction,
} from "./types.js";

const requestSerializer = new AbiSerializer(SIGNING_REQUEST_ABI);
const requestSerializerV2 = new AbiSerializer(SIGNING_REQUEST_ABI_V2);
const MAX_PLACEHOLDER_DEPTH = 100;

function validateName(value: string, label: string): string {
  if (!value) throw new TypeError(`${label} is required`);
  nameToBigInt(value);
  return value;
}

function validateChainId(value: string, label: string): string {
  const chainId = value.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(chainId)) {
    throw new TypeError(`${label} must be a 64-character chain id`);
  }
  return chainId;
}

function resolveSelector(
  selector: SigningRequestChain,
  aliasResolver?: (alias: number) => string | undefined,
): string {
  if (selector.type === "chain_id") {
    return validateChainId(selector.value, "Signing-request chain id");
  }
  if (selector.value === 0) {
    throw new TypeError("Chain alias 0 does not identify a concrete chain");
  }
  const resolved = aliasResolver?.(selector.value);
  if (!resolved) throw new TypeError(`Unknown signing-request chain alias: ${selector.value}`);
  return validateChainId(resolved, "Resolved chain id");
}

function resolveChainId(request: SigningRequest, options: SigningRequestResolveOptions): string {
  const selector = request.data.chainId;
  if (selector.type === "chain_id") {
    const fixed = resolveSelector(selector, options.chainAliasResolver);
    if (
      options.selectedChainId &&
      validateChainId(options.selectedChainId, "Selected chain id") !== fixed
    ) {
      throw new TypeError("Selected chain does not match the signing request");
    }
    return fixed;
  }

  if (selector.value === 0) {
    if (!options.selectedChainId) {
      throw new TypeError("Multi-chain signing request requires selectedChainId");
    }
    const selected = validateChainId(options.selectedChainId, "Selected chain id");
    const allowed = request.getAllowedChains();
    if (allowed.length > 0) {
      const allowedIds = allowed.map((chain) => resolveSelector(chain, options.chainAliasResolver));
      if (!allowedIds.includes(selected)) {
        throw new TypeError("Selected chain is not allowed by this multi-chain signing request");
      }
    }
    return selected;
  }

  const fixed = resolveSelector(selector, options.chainAliasResolver);
  if (
    options.selectedChainId &&
    validateChainId(options.selectedChainId, "Selected chain id") !== fixed
  ) {
    throw new TypeError("Selected chain does not match the signing request alias");
  }
  return fixed;
}

class AbiPlaceholderResolver {
  readonly #aliases = new Map<string, string>();
  readonly #structs = new Map<string, AbiStruct>();
  readonly #variants = new Map<string, AbiVariant>();

  constructor(
    abi: Abi,
    readonly actor: string,
    readonly permission: string,
  ) {
    for (const alias of abi.types ?? []) this.#aliases.set(alias.new_type_name, alias.type);
    for (const struct of abi.structs ?? []) this.#structs.set(struct.name, struct);
    for (const variant of abi.variants ?? []) this.#variants.set(variant.name, variant);
  }

  replace(type: string, value: unknown, depth = 0): unknown {
    if (depth > MAX_PLACEHOLDER_DEPTH) {
      throw new RangeError("Signing-request placeholder nesting exceeds 100 levels");
    }
    if (value === null || value === undefined) return value;
    if (type.endsWith("[]")) {
      if (!Array.isArray(value)) return value;
      return value.map((item) => this.replace(type.slice(0, -2), item, depth + 1));
    }
    if (type.endsWith("?") || type.endsWith("$")) {
      return this.replace(type.slice(0, -1), value, depth + 1);
    }

    const resolvedType = this.#resolveAlias(type);
    if (resolvedType === "name") {
      if (value === SIGNING_REQUEST_PLACEHOLDER_ACTOR) return this.actor;
      if (value === SIGNING_REQUEST_PLACEHOLDER_PERMISSION) return this.permission;
      return value;
    }

    const struct = this.#structs.get(resolvedType);
    if (struct && typeof value === "object" && !Array.isArray(value)) {
      const output = { ...(value as Record<string, unknown>) };
      if (struct.base) {
        const base = this.replace(struct.base, output, depth + 1);
        if (base && typeof base === "object" && !Array.isArray(base)) {
          Object.assign(output, base);
        }
      }
      for (const field of struct.fields) {
        output[field.name] = this.replace(field.type, output[field.name], depth + 1);
      }
      return output;
    }

    const variant = this.#variants.get(resolvedType);
    if (variant && typeof value === "object") {
      if (Array.isArray(value) && value.length === 2) {
        const selected = String(value[0]);
        return [selected, this.replace(selected, value[1], depth + 1)];
      }
      const record = value as { type?: unknown; value?: unknown };
      if (typeof record.type === "string") {
        return {
          type: record.type,
          value: this.replace(record.type, record.value, depth + 1),
        };
      }
    }
    return value;
  }

  #resolveAlias(type: string): string {
    let current = type;
    const seen = new Set<string>();
    while (this.#aliases.has(current)) {
      if (seen.has(current)) throw new TypeError(`Cyclic ABI alias while resolving ${type}`);
      seen.add(current);
      current = this.#aliases.get(current)!;
    }
    return current;
  }
}

function resolvePermissionLevel(
  value: SigningRequestPermissionLevel,
  signer: SigningRequestPermissionLevel,
): SigningRequestPermissionLevel {
  return {
    actor: value.actor === SIGNING_REQUEST_PLACEHOLDER_ACTOR ? signer.actor : value.actor,
    permission:
      value.permission === SIGNING_REQUEST_PLACEHOLDER_PERMISSION ||
      value.permission === SIGNING_REQUEST_PLACEHOLDER_ACTOR
        ? signer.permission
        : value.permission,
  };
}

function createDeduplicatedAbiProvider(
  abiProvider: SigningRequestAbiProvider,
): SigningRequestAbiProvider {
  const pending = new Map<string, Promise<Abi>>();
  return {
    getAbi(account, signal) {
      const existing = pending.get(account);
      if (existing) return existing;
      const request = abiProvider.getAbi(account, signal);
      pending.set(account, request);
      return request;
    },
  };
}

async function resolveAction(
  action: SigningRequestAction,
  signer: SigningRequestPermissionLevel,
  abiProvider: SigningRequestAbiProvider,
  signal?: AbortSignal,
): Promise<SigningRequestAction> {
  const abi = await abiProvider.getAbi(action.account, signal);
  const serializer = new AbiSerializer(abi);
  const decoded = serializer.decodeAction(action.name, hexToBytes(action.data));
  const actionType = serializer.getActionType(action.name);
  const replaced = new AbiPlaceholderResolver(abi, signer.actor, signer.permission).replace(
    actionType,
    decoded,
  );
  return {
    account: action.account,
    name: action.name,
    authorization: action.authorization.map((level) => resolvePermissionLevel(level, signer)),
    data: bytesToHex(serializer.encodeAction(action.name, replaced)),
  };
}

function actionResolutionError(
  action: SigningRequestAction,
  index: number,
  total: number,
  scope: string,
  cause: unknown,
): Error {
  const reason =
    cause instanceof Error ? cause.message : String(cause || "Unknown action resolution error");
  return new Error(
    `Unable to resolve ${action.account}::${action.name} in ${scope}: action ${index + 1}/${total}; ${reason}`,
    { cause },
  );
}

async function resolveActionsInOrder(
  actions: readonly SigningRequestAction[],
  signer: SigningRequestPermissionLevel,
  abiProvider: SigningRequestAbiProvider,
  signal: AbortSignal | undefined,
  scope: string,
): Promise<SigningRequestAction[]> {
  const resolved: SigningRequestAction[] = [];
  for (const [index, action] of actions.entries()) {
    try {
      resolved.push(await resolveAction(action, signer, abiProvider, signal));
    } catch (error) {
      throw actionResolutionError(action, index, actions.length, scope, error);
    }
  }
  return resolved;
}

function hasNullHeader(transaction: SigningRequestTransaction): boolean {
  const expiration = Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(transaction.expiration)
      ? transaction.expiration
      : `${transaction.expiration}Z`,
  );
  return expiration === 0 && transaction.ref_block_num === 0 && transaction.ref_block_prefix === 0;
}

function applyTapos(
  transaction: SigningRequestTransaction,
  tapos: SigningRequestTapos,
): SigningRequestTransaction {
  return {
    ...transaction,
    expiration: tapos.expiration,
    ref_block_num: tapos.refBlockNum & 0xffff,
    ref_block_prefix: tapos.refBlockPrefix >>> 0,
  };
}

function toNativeTransaction(transaction: SigningRequestTransaction): Transaction {
  return {
    ...transaction,
    transaction_extensions: transaction.transaction_extensions.map((extension) => [
      extension.type,
      extension.data,
    ]),
  };
}

function createIdentityTransaction(
  version: number,
  identity: SigningRequestIdentity,
  signer: SigningRequestPermissionLevel,
  tapos: SigningRequestTapos | undefined,
): SigningRequestTransaction {
  if (version > 2 && !tapos) {
    throw new TypeError("Revision 3 identity proof resolution requires an expiration context");
  }
  if (
    identity.permission &&
    (identity.permission.actor !== signer.actor ||
      identity.permission.permission !== signer.permission)
  ) {
    throw new TypeError(
      "Selected signer does not match the permission requested by the identity request",
    );
  }
  const serializer = version === 2 ? requestSerializerV2 : requestSerializer;
  const identityValue =
    version === 2
      ? { permission: signer }
      : {
          scope: validateName(identity.scope ?? "", "Identity scope"),
          permission: signer,
        };
  const data = bytesToHex(serializer.encode("identity", identityValue));
  return {
    expiration: version === 2 ? "1970-01-01T00:00:00" : tapos!.expiration,
    ref_block_num: 0,
    ref_block_prefix: 0,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: [
      {
        account: "",
        name: "identity",
        authorization: [signer],
        data,
      },
    ],
    transaction_extensions: [],
  };
}

export async function resolveSigningRequest(
  request: SigningRequest,
  options: SigningRequestResolveOptions,
): Promise<ResolvedSigningRequest> {
  const signer = {
    actor: validateName(options.actor, "Signer actor"),
    permission: validateName(options.permission, "Signer permission"),
  };
  const chainId = resolveChainId(request, options);
  const requestData = request.getData();
  const payload = requestData.request;
  const abiProvider = createDeduplicatedAbiProvider(options.abiProvider);
  let transaction: SigningRequestTransaction;

  if (payload.type === "identity") {
    transaction = createIdentityTransaction(request.version, payload.value, signer, options.tapos);
  } else if (payload.type === "action" || payload.type === "action[]") {
    const actions = payload.type === "action" ? [payload.value] : payload.value;
    transaction = {
      expiration: "1970-01-01T00:00:00",
      ref_block_num: 0,
      ref_block_prefix: 0,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: await resolveActionsInOrder(
        actions,
        signer,
        abiProvider,
        options.signal,
        "signing-request actions",
      ),
      transaction_extensions: [],
    };
  } else {
    const source = payload.value;
    transaction = {
      ...source,
      context_free_actions: await resolveActionsInOrder(
        source.context_free_actions,
        signer,
        abiProvider,
        options.signal,
        "transaction context-free actions",
      ),
      actions: await resolveActionsInOrder(
        source.actions,
        signer,
        abiProvider,
        options.signal,
        "transaction actions",
      ),
      transaction_extensions: source.transaction_extensions.map((extension) => ({ ...extension })),
    };
  }

  if (!request.isIdentity && hasNullHeader(transaction)) {
    if (!options.tapos) {
      throw new TypeError("Signing request with a null transaction header requires TAPOS");
    }
    transaction = applyTapos(transaction, options.tapos);
  }

  const serializedTransaction = serializeTransaction(toNativeTransaction(transaction));
  const digest = transactionDigest(chainId, serializedTransaction);
  return {
    chainId,
    signer,
    transaction,
    serializedTransaction,
    digest,
    request: request.sourceUri ?? request.encode(false, false, "vsr"),
    broadcast: request.isBroadcast,
    background: request.isBackground,
    callback: requestData.callback,
    isIdentity: request.isIdentity,
    referenceBlockId: options.tapos?.refBlockId,
  };
}

function blockPrefix(blockId: string): number {
  const bytes = hexToBytes(blockId);
  if (bytes.length !== 32) throw new TypeError("Invalid reference block id");
  return new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true);
}

function timestampSeconds(value: string): number {
  const milliseconds = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`Invalid chain timestamp: ${value}`);
  return Math.floor(milliseconds / 1000);
}

export class RpcSigningRequestAbiProvider implements SigningRequestAbiProvider {
  readonly #cache = new Map<string, Abi>();
  readonly #pending = new Map<string, Promise<Abi>>();

  constructor(readonly rpc: RpcClient) {}

  async getAbi(account: string, signal?: AbortSignal): Promise<Abi> {
    const cached = this.#cache.get(account);
    if (cached) return cached;
    const pending = this.#pending.get(account);
    if (pending) return pending;

    const request = this.rpc
      .getAbi(account, signal)
      .then((result) => {
        if (!result.abi || typeof result.abi !== "object") {
          throw new TypeError(`RPC returned no ABI for ${account}`);
        }
        const abi = result.abi as Abi;
        new AbiSerializer(abi);
        this.#cache.set(account, abi);
        return abi;
      })
      .finally(() => {
        this.#pending.delete(account);
      });
    this.#pending.set(account, request);
    return request;
  }

  delete(account: string): void {
    this.#cache.delete(account);
    this.#pending.delete(account);
  }

  clear(): void {
    this.#cache.clear();
    this.#pending.clear();
  }
}

export async function resolveSigningRequestWithRpc(
  request: SigningRequest,
  args: Omit<SigningRequestResolveOptions, "tapos" | "selectedChainId"> & {
    rpc: RpcClient;
    expireSeconds?: number;
  },
): Promise<ResolvedSigningRequest> {
  const { rpc, expireSeconds: requestedExpireSeconds = 120, ...resolveOptions } = args;
  if (
    !Number.isInteger(requestedExpireSeconds) ||
    requestedExpireSeconds < 1 ||
    requestedExpireSeconds > 3600
  ) {
    throw new RangeError("expireSeconds must be an integer between 1 and 3600");
  }
  const info = await rpc.getInfo(resolveOptions.signal);
  const chainId = validateChainId(info.chain_id, "RPC chain id");
  const block = await rpc.getBlock(info.last_irreversible_block_num, resolveOptions.signal);
  const tapos: SigningRequestTapos = {
    expiration: new Date((timestampSeconds(info.head_block_time) + requestedExpireSeconds) * 1000)
      .toISOString()
      .replace(/\.000Z$/, ""),
    refBlockNum: block.block_num,
    refBlockPrefix:
      typeof block.ref_block_prefix === "number"
        ? block.ref_block_prefix >>> 0
        : blockPrefix(block.id),
    refBlockId: block.id,
  };
  return resolveSigningRequest(request, {
    ...resolveOptions,
    selectedChainId: chainId,
    tapos,
  });
}
