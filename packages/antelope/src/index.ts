/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AccountClient } from "@windstack/account";
import { BinaryWriter, hexToBytes, bytesToHex } from "@windstack/abi";
import { AbiCache, Contract, type ContractAction } from "@windstack/contract";
import { PrivateKey, PublicKey, Signature, concatBytes, hexToBytes as cryptoHexToBytes, sha256Digest } from "@windstack/crypto";
import { RpcClient, type GetBlockResponse, type RpcClientOptions } from "@windstack/rpc";

export * from "@windstack/account";
export * from "@windstack/abi";
export * from "@windstack/contract";
export { PrivateKey, PublicKey, Signature, concatBytes, sha256Digest } from "@windstack/crypto";
export type { KeyType } from "@windstack/crypto";
export * from "@windstack/rpc";

export type Action = ContractAction;
export type Transaction = {
  expiration: string;
  ref_block_num: number;
  ref_block_prefix: number;
  max_net_usage_words: number;
  max_cpu_usage_ms: number;
  delay_sec: number;
  context_free_actions: Action[];
  actions: Action[];
  transaction_extensions: Array<[number, string]>;
};
export type Signer = { getAvailableKeys(): Promise<string[]>; signDigest(digest: Uint8Array, requiredKeys: string[]): Promise<Array<string | Signature>> };
export type TransactArgs = { actions: Action[]; signer: Signer; broadcast?: boolean; expireSeconds?: number; signal?: AbortSignal };
export type TransactResult<T = Record<string, unknown>> = { transaction: Transaction; serializedTransaction: Uint8Array; signatures: string[]; response?: T };

function blockPrefix(block: GetBlockResponse): number {
  if (typeof block.ref_block_prefix === "number") return block.ref_block_prefix >>> 0;
  const bytes = cryptoHexToBytes(block.id);
  if (bytes.length !== 32) throw new TypeError("Invalid block id");
  return new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true);
}
function timestampSeconds(value: string): number { const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`; const ms = Date.parse(normalized); if (!Number.isFinite(ms)) throw new TypeError(`Invalid block timestamp: ${value}`); return Math.floor(ms / 1000); }
function transactionForRpc(transaction: Transaction): Record<string, unknown> { return { ...transaction, context_free_actions: transaction.context_free_actions, actions: transaction.actions, transaction_extensions: transaction.transaction_extensions }; }
function writeAction(writer: BinaryWriter, action: Action): void {
  writer.writeName(action.account); writer.writeName(action.name); writer.writeVarUint(action.authorization.length);
  for (const permission of action.authorization) { writer.writeName(permission.actor); writer.writeName(permission.permission); }
  writer.writeVarBytes(hexToBytes(action.data));
}
export function serializeTransaction(transaction: Transaction): Uint8Array {
  const writer = new BinaryWriter();
  writer.writeUint32(Math.floor(Date.parse(transaction.expiration.endsWith("Z") ? transaction.expiration : `${transaction.expiration}Z`) / 1000));
  writer.writeUint16(transaction.ref_block_num); writer.writeUint32(transaction.ref_block_prefix); writer.writeVarUint(transaction.max_net_usage_words); writer.writeByte(transaction.max_cpu_usage_ms); writer.writeVarUint(transaction.delay_sec);
  writer.writeVarUint(transaction.context_free_actions.length); for (const action of transaction.context_free_actions) writeAction(writer, action);
  writer.writeVarUint(transaction.actions.length); for (const action of transaction.actions) writeAction(writer, action);
  writer.writeVarUint(transaction.transaction_extensions.length); for (const [type, data] of transaction.transaction_extensions) { writer.writeUint16(type); writer.writeVarBytes(hexToBytes(data)); }
  return writer.toBytes();
}
export function transactionDigest(chainId: string, serializedTransaction: Uint8Array, contextFreeDataHash = new Uint8Array(32)): Uint8Array {
  const id = cryptoHexToBytes(chainId); if (id.length !== 32) throw new TypeError("Antelope chain id must be 32 bytes");
  return sha256Digest(concatBytes(id, serializedTransaction, contextFreeDataHash));
}

export class PrivateKeySigner implements Signer {
  readonly #keys: PrivateKey[];
  constructor(keys: PrivateKey[]) { if (!keys.length) throw new TypeError("At least one private key is required"); this.#keys = [...keys]; }
  async getAvailableKeys(): Promise<string[]> { return this.#keys.map((key) => key.toPublicKey().toString()); }
  async signDigest(digest: Uint8Array, requiredKeys: string[]): Promise<Signature[]> {
    const wanted = new Set(requiredKeys.map((key) => PublicKey.fromString(key).toString()));
    return this.#keys.filter((key) => wanted.has(key.toPublicKey().toString())).map((key) => key.signDigest(digest));
  }
}

export type AntelopeClientOptions = RpcClientOptions & { abiCache?: AbiCache };
export class AntelopeClient {
  readonly rpc: RpcClient; readonly abiCache: AbiCache;
  constructor(options: AntelopeClientOptions) { this.rpc = new RpcClient(options); this.abiCache = options.abiCache ?? new AbiCache(); }
  contract(account: string): Contract { return new Contract(account, this.rpc, this.abiCache); }
  account(name: string): AccountClient { return new AccountClient(name, this.rpc, this.abiCache); }
  async transact<T = Record<string, unknown>>(args: TransactArgs): Promise<TransactResult<T>> {
    if (!args.actions.length) throw new TypeError("Transaction must include at least one action");
    const info = await this.rpc.getInfo(args.signal);
    const block = await this.rpc.getBlock(info.last_irreversible_block_num, args.signal);
    const expiration = new Date((timestampSeconds(block.timestamp) + (args.expireSeconds ?? 120)) * 1000).toISOString().replace(/\.000Z$/, "");
    const transaction: Transaction = { expiration, ref_block_num: block.block_num & 0xffff, ref_block_prefix: blockPrefix(block), max_net_usage_words: 0, max_cpu_usage_ms: 0, delay_sec: 0, context_free_actions: [], actions: args.actions, transaction_extensions: [] };
    const serializedTransaction = serializeTransaction(transaction);
    const availableKeys = await args.signer.getAvailableKeys();
    const { required_keys: requiredKeys } = await this.rpc.getRequiredKeys(transactionForRpc(transaction), availableKeys, args.signal);
    const digest = transactionDigest(info.chain_id, serializedTransaction);
    const signed = await args.signer.signDigest(digest, requiredKeys);
    const signatures = signed.map((signature) => typeof signature === "string" ? signature : signature.toString());
    if (signatures.length !== requiredKeys.length) throw new Error(`Signer returned ${signatures.length} signatures for ${requiredKeys.length} required keys`);
    if (args.broadcast === false) return { transaction, serializedTransaction, signatures };
    const response = await this.rpc.pushTransaction<T>({ signatures, compression: 0, packed_context_free_data: "", packed_trx: bytesToHex(serializedTransaction) }, args.signal);
    return { transaction, serializedTransaction, signatures, response };
  }
}
