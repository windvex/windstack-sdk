/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AccountClient, type AccountClientOptions } from "@windstack/account";
import { BinaryReader, BinaryWriter, bytesToHex, hexToBytes } from "@windstack/abi";
import { AbiCache, Contract, type ContractAction } from "@windstack/contract";
import {
  type PrivateKey,
  PublicKey,
  Signature,
  concatBytes,
  hexToBytes as cryptoHexToBytes,
  sha256Digest,
} from "@windstack/crypto";
import { RpcClient, type GetBlockResponse, type RpcClientOptions } from "@windstack/rpc";

export * from "@windstack/account";
export * from "@windstack/abi";
export * from "@windstack/contract";
export { PrivateKey, PublicKey, Signature, concatBytes, sha256Digest } from "@windstack/crypto";
export type { KeyType } from "@windstack/crypto";
export * from "@windstack/rpc";
export { KeosdError, KeosdHttpTransport, KeosdSigner } from "./keosd.js";
export type { KeosdHttpTransportOptions, KeosdSignerOptions, KeosdTransport } from "./keosd.js";

export type Action = ContractAction;
export type TransactionExtension = [number, string];
export type Transaction = {
  expiration: string;
  ref_block_num: number;
  ref_block_prefix: number;
  max_net_usage_words: number;
  max_cpu_usage_ms: number;
  delay_sec: number;
  context_free_actions: Action[];
  actions: Action[];
  transaction_extensions: TransactionExtension[];
};
export type DeserializeTransactionOptions = {
  maxBytes?: number;
  maxContextFreeActions?: number;
  maxActions?: number;
  maxAuthorizationsPerAction?: number;
  maxExtensions?: number;
  requireCanonical?: boolean;
};
export type PrepareTransactionArgs = {
  actions: Action[];
  contextFreeActions?: Action[];
  contextFreeData?: Uint8Array[];
  transactionExtensions?: TransactionExtension[];
  expireSeconds?: number;
  signal?: AbortSignal;
};
export type PreparedTransaction = {
  chainId: string;
  transaction: Transaction;
  serializedTransaction: Uint8Array;
  serializedContextFreeData: Uint8Array;
  digest: Uint8Array;
};
export type SignRequest = PreparedTransaction & {
  requiredKeys: readonly string[];
};
export interface Signer {
  getAvailableKeys(signal?: AbortSignal): Promise<readonly string[]>;
  sign(request: SignRequest, signal?: AbortSignal): Promise<readonly (string | Signature)[]>;
}
export type TransactArgs = PrepareTransactionArgs & {
  signer: Signer;
  broadcast?: boolean;
};
export type TransactResult<T = Record<string, unknown>> = {
  transaction: Transaction;
  serializedTransaction: Uint8Array;
  serializedContextFreeData: Uint8Array;
  signatures: string[];
  response?: T;
};
export type ChainContracts = {
  token?: string;
  system?: string;
};

export type Tapos = Readonly<{
  refBlockNum: number;
  refBlockPrefix: number;
  blockNum: number;
  blockId: string;
}>;

const DEFAULT_MAX_TRANSACTION_BYTES = 1024 * 1024;
const DEFAULT_MAX_CONTEXT_FREE_ACTIONS = 1024;
const DEFAULT_MAX_ACTIONS = 10_000;
const DEFAULT_MAX_AUTHORIZATIONS_PER_ACTION = 1024;
const DEFAULT_MAX_TRANSACTION_EXTENSIONS = 1024;

export function taposFromBlock(
  block: Pick<GetBlockResponse, "id" | "block_num" | "ref_block_prefix">,
): Tapos {
  if (!Number.isInteger(block.block_num) || block.block_num < 0 || block.block_num > 0xffffffff)
    throw new TypeError("Invalid TAPOS block number");
  if (!/^[0-9a-f]{64}$/i.test(block.id)) throw new TypeError("Invalid TAPOS block id");
  let refBlockPrefix: number;
  if (typeof block.ref_block_prefix === "number") {
    refBlockPrefix = assertUint(block.ref_block_prefix, 0xffffffff, "ref_block_prefix");
  } else {
    const bytes = cryptoHexToBytes(block.id);
    refBlockPrefix = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true);
  }
  return Object.freeze({
    refBlockNum: block.block_num & 0xffff,
    refBlockPrefix,
    blockNum: block.block_num,
    blockId: block.id.toLowerCase(),
  });
}

function timestampSeconds(value: string): number {
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`Invalid block timestamp: ${value}`);
  return Math.floor(milliseconds / 1000);
}

function assertUint(value: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function assertPositiveLimit(value: number | undefined, fallback: number, label: string): number {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return limit;
}

function assertCollectionCount(count: number, max: number, label: string): number {
  if (count > max) throw new RangeError(`${label} exceeds configured limit of ${max}`);
  return count;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function transactionForRpc(transaction: Transaction): Record<string, unknown> {
  return {
    expiration: transaction.expiration,
    ref_block_num: transaction.ref_block_num,
    ref_block_prefix: transaction.ref_block_prefix,
    max_net_usage_words: transaction.max_net_usage_words,
    max_cpu_usage_ms: transaction.max_cpu_usage_ms,
    delay_sec: transaction.delay_sec,
    context_free_actions: transaction.context_free_actions,
    actions: transaction.actions,
    transaction_extensions: transaction.transaction_extensions,
  };
}

function writeAction(writer: BinaryWriter, action: Action): void {
  writer.writeName(action.account);
  writer.writeName(action.name);
  writer.writeVarUint(action.authorization.length);
  for (const permission of action.authorization) {
    writer.writeName(permission.actor);
    writer.writeName(permission.permission);
  }
  writer.writeVarBytes(hexToBytes(action.data));
}

export function serializeTransaction(transaction: Transaction): Uint8Array {
  const expirationSeconds = timestampSeconds(transaction.expiration);
  const writer = new BinaryWriter();
  writer.writeUint32(assertUint(expirationSeconds, 0xffffffff, "expiration"));
  writer.writeUint16(assertUint(transaction.ref_block_num, 0xffff, "ref_block_num"));
  writer.writeUint32(assertUint(transaction.ref_block_prefix, 0xffffffff, "ref_block_prefix"));
  writer.writeVarUint(
    assertUint(transaction.max_net_usage_words, 0xffffffff, "max_net_usage_words"),
  );
  writer.writeByte(assertUint(transaction.max_cpu_usage_ms, 0xff, "max_cpu_usage_ms"));
  writer.writeVarUint(assertUint(transaction.delay_sec, 0xffffffff, "delay_sec"));
  writer.writeVarUint(transaction.context_free_actions.length);
  for (const action of transaction.context_free_actions) writeAction(writer, action);
  writer.writeVarUint(transaction.actions.length);
  for (const action of transaction.actions) writeAction(writer, action);
  writer.writeVarUint(transaction.transaction_extensions.length);
  for (const [type, data] of transaction.transaction_extensions) {
    writer.writeUint16(assertUint(type, 0xffff, "transaction extension type"));
    writer.writeVarBytes(hexToBytes(data));
  }
  return writer.toBytes();
}

function readAction(
  reader: BinaryReader,
  maxAuthorizationsPerAction: number,
  label: string,
): Action {
  const account = reader.readName();
  const name = reader.readName();
  const authorizationCount = assertCollectionCount(
    reader.readVarUint(),
    maxAuthorizationsPerAction,
    `${label} authorization count`,
  );
  const authorization = Array.from({ length: authorizationCount }, () => ({
    actor: reader.readName(),
    permission: reader.readName(),
  }));
  const data = bytesToHex(reader.readVarBytes());
  return { account, name, authorization, data };
}

/** Decode canonical Antelope packed transaction bytes. */
export function deserializeTransaction(
  input: Uint8Array | string,
  options: DeserializeTransactionOptions = {},
): Transaction {
  const bytes = typeof input === "string" ? hexToBytes(input) : input;
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("Serialized transaction must be Uint8Array or hexadecimal");
  }
  const maxBytes = assertPositiveLimit(options.maxBytes, DEFAULT_MAX_TRANSACTION_BYTES, "maxBytes");
  if (bytes.length === 0) throw new TypeError("Serialized transaction cannot be empty");
  if (bytes.length > maxBytes) {
    throw new RangeError(`Serialized transaction exceeds configured limit of ${maxBytes} bytes`);
  }

  const maxContextFreeActions = assertPositiveLimit(
    options.maxContextFreeActions,
    DEFAULT_MAX_CONTEXT_FREE_ACTIONS,
    "maxContextFreeActions",
  );
  const maxActions = assertPositiveLimit(options.maxActions, DEFAULT_MAX_ACTIONS, "maxActions");
  const maxAuthorizationsPerAction = assertPositiveLimit(
    options.maxAuthorizationsPerAction,
    DEFAULT_MAX_AUTHORIZATIONS_PER_ACTION,
    "maxAuthorizationsPerAction",
  );
  const maxExtensions = assertPositiveLimit(
    options.maxExtensions,
    DEFAULT_MAX_TRANSACTION_EXTENSIONS,
    "maxExtensions",
  );

  const reader = new BinaryReader(bytes);
  const expiration = new Date(reader.readUint32() * 1000).toISOString().replace(/\.000Z$/, "");
  const ref_block_num = reader.readUint16();
  const ref_block_prefix = reader.readUint32();
  const max_net_usage_words = reader.readVarUint();
  const max_cpu_usage_ms = reader.readByte();
  const delay_sec = reader.readVarUint();

  const contextFreeActionCount = assertCollectionCount(
    reader.readVarUint(),
    maxContextFreeActions,
    "Context-free action count",
  );
  const context_free_actions = Array.from({ length: contextFreeActionCount }, (_, index) =>
    readAction(reader, maxAuthorizationsPerAction, `Context-free action ${index}`),
  );

  const actionCount = assertCollectionCount(
    reader.readVarUint(),
    maxActions,
    "Transaction action count",
  );
  const actions = Array.from({ length: actionCount }, (_, index) =>
    readAction(reader, maxAuthorizationsPerAction, `Action ${index}`),
  );

  const extensionCount = assertCollectionCount(
    reader.readVarUint(),
    maxExtensions,
    "Transaction extension count",
  );
  const transaction_extensions = Array.from(
    { length: extensionCount },
    (): TransactionExtension => [reader.readUint16(), bytesToHex(reader.readVarBytes())],
  );

  if (reader.remaining !== 0) {
    throw new TypeError(`Unused packed transaction bytes: ${reader.remaining}`);
  }

  const transaction: Transaction = {
    expiration,
    ref_block_num,
    ref_block_prefix,
    max_net_usage_words,
    max_cpu_usage_ms,
    delay_sec,
    context_free_actions,
    actions,
    transaction_extensions,
  };

  if (options.requireCanonical !== false && !equalBytes(serializeTransaction(transaction), bytes)) {
    throw new TypeError("Serialized transaction is not canonically encoded");
  }
  return transaction;
}

export function serializeContextFreeData(items: Uint8Array[]): Uint8Array {
  if (!Array.isArray(items)) throw new TypeError("Context-free data must be an array");
  const writer = new BinaryWriter();
  writer.writeVarUint(items.length);
  for (const item of items) {
    if (!(item instanceof Uint8Array)) {
      throw new TypeError("Each context-free data item must be Uint8Array");
    }
    writer.writeVarBytes(item);
  }
  return writer.toBytes();
}

export function transactionDigest(
  chainId: string,
  serializedTransaction: Uint8Array,
  contextFreeDataHash: Uint8Array = new Uint8Array(32),
): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(chainId)) {
    throw new TypeError("Antelope chain id must be exactly 64 hexadecimal characters");
  }
  if (!(serializedTransaction instanceof Uint8Array)) {
    throw new TypeError("Serialized transaction must be Uint8Array");
  }
  if (!(contextFreeDataHash instanceof Uint8Array) || contextFreeDataHash.length !== 32) {
    throw new TypeError("Context-free data hash must be 32 bytes");
  }
  return sha256Digest(
    concatBytes(cryptoHexToBytes(chainId), serializedTransaction, contextFreeDataHash),
  );
}

/** Antelope transaction id: SHA-256 of the serialized transaction, excluding signatures. */
export function transactionId(serializedTransaction: Uint8Array): string {
  if (!(serializedTransaction instanceof Uint8Array)) {
    throw new TypeError("Serialized transaction must be Uint8Array");
  }
  return bytesToHex(sha256Digest(serializedTransaction));
}

export type PrivateKeySignerOptions = {
  k1PublicKeyFormat?: "legacy" | "modern";
  /** Network-specific prefix for legacy K1 public keys. Defaults to `EOS`. */
  legacyPublicKeyPrefix?: string;
};

export class PrivateKeySigner implements Signer {
  readonly #keys: PrivateKey[];
  readonly #k1PublicKeyFormat: "legacy" | "modern";
  readonly #legacyPublicKeyPrefix: string;

  constructor(keys: PrivateKey[], options: PrivateKeySignerOptions = {}) {
    if (!keys.length) throw new TypeError("At least one private key is required");
    const publicKeys = keys.map((key) => key.toPublicKey().toString());
    if (new Set(publicKeys).size !== publicKeys.length) {
      throw new TypeError("PrivateKeySigner cannot contain duplicate keys");
    }
    this.#keys = [...keys];
    this.#k1PublicKeyFormat = options.k1PublicKeyFormat ?? "legacy";
    this.#legacyPublicKeyPrefix = options.legacyPublicKeyPrefix ?? "EOS";
    if (this.#k1PublicKeyFormat === "legacy") {
      for (const key of this.#keys) {
        if (key.type === "K1") key.toPublicKey().toLegacyString(this.#legacyPublicKeyPrefix);
      }
    }
  }

  async getAvailableKeys(): Promise<string[]> {
    return this.#keys.map((key) => {
      const publicKey = key.toPublicKey();
      return key.type === "K1" && this.#k1PublicKeyFormat === "legacy"
        ? publicKey.toLegacyString(this.#legacyPublicKeyPrefix)
        : publicKey.toString();
    });
  }

  async sign(request: SignRequest): Promise<Signature[]> {
    const keyMap = new Map(this.#keys.map((key) => [key.toPublicKey().toString(), key] as const));
    return request.requiredKeys.map((requiredKey) => {
      const normalized = PublicKey.fromString(requiredKey).toString();
      const key = keyMap.get(normalized);
      if (!key) throw new Error(`No private key available for required key ${requiredKey}`);
      return key.signDigest(request.digest);
    });
  }
}

export type AntelopeClientOptions = RpcClientOptions & {
  abiCache?: AbiCache;
  chainId?: string;
  contracts?: ChainContracts;
};

export class AntelopeClient {
  readonly rpc: RpcClient;
  readonly abiCache: AbiCache;
  readonly chainId?: string;
  readonly contracts: Readonly<ChainContracts>;

  constructor(options: AntelopeClientOptions) {
    if (options.chainId && !/^[0-9a-f]{64}$/i.test(options.chainId)) {
      throw new TypeError("Configured Antelope chain id must be exactly 64 hexadecimal characters");
    }
    this.rpc = new RpcClient({ ...options, expectedChainId: options.chainId });
    this.abiCache = options.abiCache ?? new AbiCache();
    this.chainId = options.chainId?.toLowerCase();
    this.contracts = Object.freeze({ ...(options.contracts ?? {}) });
  }

  contract(account: string): Contract {
    return new Contract(account, this.rpc, this.abiCache);
  }

  account(name: string): AccountClient {
    const options: AccountClientOptions = {
      tokenContract: this.contracts.token,
      systemContract: this.contracts.system,
    };
    return new AccountClient(name, this.rpc, this.abiCache, options);
  }

  async prepareTransaction(args: PrepareTransactionArgs): Promise<PreparedTransaction> {
    const contextFreeActions = args.contextFreeActions ?? [];
    if (!args.actions.length && !contextFreeActions.length) {
      throw new TypeError("Transaction must include at least one action");
    }
    const expireSeconds = args.expireSeconds ?? 120;
    if (!Number.isInteger(expireSeconds) || expireSeconds < 1 || expireSeconds > 3600) {
      throw new RangeError("expireSeconds must be an integer between 1 and 3600");
    }

    const info = await this.rpc.getInfo(args.signal);
    const actualChainId = info.chain_id.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(actualChainId)) {
      throw new TypeError("RPC returned an invalid Antelope chain id");
    }
    if (this.chainId && actualChainId !== this.chainId) {
      throw new Error(`RPC chain mismatch: expected ${this.chainId}, received ${actualChainId}`);
    }

    const block = await this.rpc.getBlock(info.last_irreversible_block_num, args.signal);
    const tapos = taposFromBlock(block);
    const expiration = new Date((timestampSeconds(info.head_block_time) + expireSeconds) * 1000)
      .toISOString()
      .replace(/\.000Z$/, "");
    const transaction: Transaction = {
      expiration,
      ref_block_num: tapos.refBlockNum,
      ref_block_prefix: tapos.refBlockPrefix,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: contextFreeActions,
      actions: args.actions,
      transaction_extensions: args.transactionExtensions ?? [],
    };

    const serializedTransaction = serializeTransaction(transaction);
    const contextFreeData = args.contextFreeData ?? [];
    const serializedContextFreeData = contextFreeData.length
      ? serializeContextFreeData(contextFreeData)
      : new Uint8Array();
    const contextFreeDataHash = serializedContextFreeData.length
      ? sha256Digest(serializedContextFreeData)
      : new Uint8Array(32);
    const digest = transactionDigest(actualChainId, serializedTransaction, contextFreeDataHash);

    return {
      chainId: actualChainId,
      transaction,
      serializedTransaction,
      serializedContextFreeData,
      digest,
    };
  }

  async transact<T = Record<string, unknown>>(args: TransactArgs): Promise<TransactResult<T>> {
    const prepared = await this.prepareTransaction(args);
    const { transaction, serializedTransaction, serializedContextFreeData, digest } = prepared;

    const availableKeys = [...new Set(await args.signer.getAvailableKeys(args.signal))];
    if (!availableKeys.length) throw new Error("Signer returned no available keys");
    for (const key of availableKeys) PublicKey.fromString(key);

    const { required_keys: requiredKeys } = await this.rpc.getRequiredKeys(
      transactionForRpc(transaction),
      availableKeys,
      args.signal,
    );
    if (!Array.isArray(requiredKeys)) throw new TypeError("RPC returned invalid required keys");
    const normalizedRequiredKeys = requiredKeys.map((key) => PublicKey.fromString(key).toString());
    if (new Set(normalizedRequiredKeys).size !== normalizedRequiredKeys.length) {
      throw new TypeError("RPC returned duplicate required keys");
    }

    const signed = await args.signer.sign(
      {
        ...prepared,
        requiredKeys,
      },
      args.signal,
    );
    if (!Array.isArray(signed)) throw new TypeError("Signer returned an invalid signature list");
    const parsedSignatures = signed.map((value) => {
      if (typeof value === "string") return Signature.fromString(value);
      if (!(value instanceof Signature)) {
        throw new TypeError("Signer returned an invalid signature value");
      }
      return value;
    });
    if (parsedSignatures.length !== requiredKeys.length) {
      throw new Error(
        `Signer returned ${parsedSignatures.length} signatures for ${requiredKeys.length} required keys`,
      );
    }

    const recoveredKeys = parsedSignatures.map((signature) =>
      signature.recoverDigest(digest).toString(),
    );
    const requiredSet = new Set(normalizedRequiredKeys);
    if (
      new Set(recoveredKeys).size !== recoveredKeys.length ||
      recoveredKeys.some((key) => !requiredSet.has(key))
    ) {
      throw new Error("Signer returned a signature that does not match the required keys");
    }

    const signatures = parsedSignatures.map((signature) => signature.toString());
    if (args.broadcast === false) {
      return {
        transaction,
        serializedTransaction,
        serializedContextFreeData,
        signatures,
      };
    }

    const response = await this.rpc.pushTransaction<T>(
      {
        signatures,
        compression: 0,
        packed_context_free_data: bytesToHex(serializedContextFreeData),
        packed_trx: bytesToHex(serializedTransaction),
      },
      args.signal,
    );
    return {
      transaction,
      serializedTransaction,
      serializedContextFreeData,
      signatures,
      response,
    };
  }
}
