/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { PublicKey, Signature } from "@windstack/crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const NAME_CHARS = ".12345abcdefghijklmnopqrstuvwxyz";

export type AbiField = { name: string; type: string };
export type AbiStruct = { name: string; base: string; fields: AbiField[] };
export type AbiTypeDef = { new_type_name: string; type: string };
export type AbiAction = { name: string; type: string; ricardian_contract?: string };
export type AbiVariant = { name: string; types: string[] };
export type Abi = {
  version: string;
  types?: AbiTypeDef[];
  structs?: AbiStruct[];
  actions?: AbiAction[];
  tables?: Array<{ name: string; index_type: string; key_names?: string[]; key_types?: string[]; type: string }>;
  variants?: AbiVariant[];
};

export function bytesToHex(bytes: Uint8Array): string { return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""); }
export function hexToBytes(hex: string): Uint8Array {
  const value = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2) throw new TypeError("Invalid hex value");
  return Uint8Array.from(value.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

export function nameToBigInt(name: string): bigint {
  if (name.length > 13) throw new RangeError("Antelope name cannot exceed 13 characters");
  let value = 0n;
  for (let i = 0; i < 13; i += 1) {
    const char = i < name.length ? NAME_CHARS.indexOf(name[i]!) : 0;
    if (char < 0) throw new TypeError(`Invalid Antelope name character: ${name[i]}`);
    if (i === 12) {
      if (char > 15) throw new TypeError("The 13th Antelope name character must be .12345abcdefghij");
      value |= BigInt(char);
    } else {
      value |= BigInt(char) << BigInt(64 - 5 * (i + 1));
    }
  }
  return value;
}

export function bigIntToName(value: bigint): string {
  let tmp = BigInt.asUintN(64, value);
  const chars = new Array<string>(13).fill(".");
  for (let i = 0; i <= 12; i += 1) {
    const index = i === 0 ? Number(tmp & 0x0fn) : Number(tmp & 0x1fn);
    chars[12 - i] = NAME_CHARS[index]!;
    tmp >>= i === 0 ? 4n : 5n;
  }
  return chars.join("").replace(/\.+$/, "");
}

export class BinaryWriter {
  #bytes: number[] = [];
  writeByte(value: number): void { this.#bytes.push(value & 0xff); }
  writeUint16(value: number): void { this.writeByte(value); this.writeByte(value >>> 8); }
  writeUint32(value: number): void { for (let i = 0; i < 4; i += 1) this.writeByte(value >>> (8 * i)); }
  writeUint64(value: bigint): void { let v = BigInt.asUintN(64, value); for (let i = 0; i < 8; i += 1) { this.writeByte(Number(v & 0xffn)); v >>= 8n; } }
  writeInt64(value: bigint): void { this.writeUint64(BigInt.asUintN(64, value)); }
  writeVarUint(value: number): void { let v = value >>> 0; while (true) { if (v >>> 7) { this.writeByte(0x80 | (v & 0x7f)); v >>>= 7; } else { this.writeByte(v); break; } } }
  writeBytes(value: Uint8Array): void { for (const byte of value) this.writeByte(byte); }
  writeVarBytes(value: Uint8Array): void { this.writeVarUint(value.length); this.writeBytes(value); }
  writeString(value: string): void { this.writeVarBytes(encoder.encode(value)); }
  writeName(value: string): void { this.writeUint64(nameToBigInt(value)); }
  toBytes(): Uint8Array { return Uint8Array.from(this.#bytes); }
}

export class BinaryReader {
  readonly #bytes: Uint8Array; #offset = 0;
  constructor(bytes: Uint8Array) { this.#bytes = bytes; }
  get remaining(): number { return this.#bytes.length - this.#offset; }
  readByte(): number { if (this.remaining < 1) throw new RangeError("Unexpected end of ABI data"); return this.#bytes[this.#offset++]!; }
  readUint16(): number { return this.readByte() | (this.readByte() << 8); }
  readUint32(): number { return (this.readByte() | (this.readByte() << 8) | (this.readByte() << 16) | (this.readByte() << 24)) >>> 0; }
  readUint64(): bigint { let value = 0n; for (let i = 0n; i < 8n; i += 1n) value |= BigInt(this.readByte()) << (8n * i); return value; }
  readInt64(): bigint { return BigInt.asIntN(64, this.readUint64()); }
  readVarUint(): number { let value = 0; let bit = 0; while (true) { const byte = this.readByte(); value |= (byte & 0x7f) << bit; if (!(byte & 0x80)) return value >>> 0; bit += 7; if (bit > 35) throw new RangeError("varuint32 overflow"); } }
  readBytes(length: number): Uint8Array { if (this.remaining < length) throw new RangeError("Unexpected end of ABI data"); const out = this.#bytes.slice(this.#offset, this.#offset + length); this.#offset += length; return out; }
  readVarBytes(): Uint8Array { return this.readBytes(this.readVarUint()); }
  readString(): string { return decoder.decode(this.readVarBytes()); }
  readName(): string { return bigIntToName(this.readUint64()); }
}

function parseAsset(value: string): { amount: bigint; precision: number; symbol: string } {
  const match = /^(-?)(\d+)(?:\.(\d+))? ([A-Z]{1,7})$/.exec(value);
  if (!match) throw new TypeError(`Invalid asset: ${value}`);
  const fraction = match[3] ?? "";
  const amount = BigInt(`${match[1]}${match[2]}${fraction}`);
  return { amount, precision: fraction.length, symbol: match[4]! };
}
function symbolToBigInt(symbol: string, precision: number): bigint { let value = BigInt(precision); for (let i = 0; i < symbol.length; i += 1) value |= BigInt(symbol.charCodeAt(i)) << BigInt(8 * (i + 1)); return value; }
function symbolFromBigInt(raw: bigint): { precision: number; symbol: string } { const precision = Number(raw & 0xffn); let value = raw >> 8n; let symbol = ""; while (value > 0n) { symbol += String.fromCharCode(Number(value & 0xffn)); value >>= 8n; } return { precision, symbol }; }

export class AbiSerializer {
  readonly abi: Abi;
  readonly #aliases = new Map<string, string>();
  readonly #structs = new Map<string, AbiStruct>();
  readonly #variants = new Map<string, AbiVariant>();
  constructor(abi: Abi) {
    this.abi = abi;
    for (const type of abi.types ?? []) this.#aliases.set(type.new_type_name, type.type);
    for (const struct of abi.structs ?? []) this.#structs.set(struct.name, struct);
    for (const variant of abi.variants ?? []) this.#variants.set(variant.name, variant);
  }
  resolveType(type: string): string { let current = type; const seen = new Set<string>(); while (this.#aliases.has(current)) { if (seen.has(current)) throw new TypeError(`Cyclic ABI alias: ${type}`); seen.add(current); current = this.#aliases.get(current)!; } return current; }
  encode(type: string, value: unknown): Uint8Array { const writer = new BinaryWriter(); this.#encodeType(writer, type, value); return writer.toBytes(); }
  decode(type: string, bytes: Uint8Array): unknown { const reader = new BinaryReader(bytes); const value = this.#decodeType(reader, type); if (reader.remaining !== 0) throw new TypeError(`Unused ABI bytes: ${reader.remaining}`); return value; }
  encodeAction(name: string, value: unknown): Uint8Array { const action = this.abi.actions?.find((item) => item.name === name); if (!action) throw new TypeError(`Unknown ABI action: ${name}`); return this.encode(action.type, value); }
  decodeAction(name: string, bytes: Uint8Array): unknown { const action = this.abi.actions?.find((item) => item.name === name); if (!action) throw new TypeError(`Unknown ABI action: ${name}`); return this.decode(action.type, bytes); }
  #encodeType(writer: BinaryWriter, rawType: string, value: unknown): void {
    if (rawType.endsWith("[]")) { if (!Array.isArray(value)) throw new TypeError(`${rawType} expects an array`); writer.writeVarUint(value.length); for (const item of value) this.#encodeType(writer, rawType.slice(0, -2), item); return; }
    if (rawType.endsWith("?")) { if (value === null || value === undefined) { writer.writeByte(0); return; } writer.writeByte(1); this.#encodeType(writer, rawType.slice(0, -1), value); return; }
    if (rawType.endsWith("$")) { if (value !== null && value !== undefined) this.#encodeType(writer, rawType.slice(0, -1), value); return; }
    const type = this.resolveType(rawType);
    const struct = this.#structs.get(type);
    if (struct) { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(`${type} expects an object`); if (struct.base) this.#encodeType(writer, struct.base, value); const record = value as Record<string, unknown>; for (const field of struct.fields) this.#encodeType(writer, field.type, record[field.name]); return; }
    const variant = this.#variants.get(type);
    if (variant) { const pair = Array.isArray(value) ? value : [String((value as { type: string }).type), (value as { value: unknown }).value]; const index = variant.types.indexOf(String(pair[0])); if (index < 0) throw new TypeError(`Unknown ${type} variant: ${String(pair[0])}`); writer.writeVarUint(index); this.#encodeType(writer, variant.types[index]!, pair[1]); return; }
    switch (type) {
      case "bool": writer.writeByte(value ? 1 : 0); return;
      case "uint8": writer.writeByte(Number(value)); return;
      case "int8": writer.writeByte(Number(value)); return;
      case "uint16": case "int16": writer.writeUint16(Number(value)); return;
      case "uint32": case "int32": case "time_point_sec": writer.writeUint32(typeof value === "string" ? Math.floor(new Date(value).getTime() / 1000) : Number(value)); return;
      case "uint64": writer.writeUint64(BigInt(value as string | number | bigint)); return;
      case "int64": writer.writeInt64(BigInt(value as string | number | bigint)); return;
      case "varuint32": writer.writeVarUint(Number(value)); return;
      case "varint32": { const n = Number(value); writer.writeVarUint(((n << 1) ^ (n >> 31)) >>> 0); return; }
      case "name": writer.writeName(String(value)); return;
      case "string": writer.writeString(String(value)); return;
      case "bytes": writer.writeVarBytes(typeof value === "string" ? hexToBytes(value) : value as Uint8Array); return;
      case "checksum256": writer.writeBytes(typeof value === "string" ? hexToBytes(value) : value as Uint8Array); return;
      case "asset": { const asset = parseAsset(String(value)); writer.writeInt64(asset.amount); writer.writeUint64(symbolToBigInt(asset.symbol, asset.precision)); return; }
      case "symbol": { const match = /^(\d+),([A-Z]{1,7})$/.exec(String(value)); if (!match) throw new TypeError("symbol expects precision,CODE"); writer.writeUint64(symbolToBigInt(match[2]!, Number(match[1]))); return; }
      case "symbol_code": { let raw = 0n; const code = String(value); for (let i = 0; i < code.length; i += 1) raw |= BigInt(code.charCodeAt(i)) << BigInt(8 * i); writer.writeUint64(raw); return; }
      case "public_key": { const key = value instanceof PublicKey ? value : PublicKey.fromString(String(value)); writer.writeByte(key.type === "K1" ? 0 : 1); writer.writeBytes(key.toBytes()); return; }
      case "signature": { const sig = value instanceof Signature ? value : Signature.fromString(String(value)); writer.writeByte(sig.type === "K1" ? 0 : 1); writer.writeBytes(sig.toBytes()); return; }
      default: throw new TypeError(`Unsupported ABI type: ${type}`);
    }
  }
  #decodeType(reader: BinaryReader, rawType: string): unknown {
    if (rawType.endsWith("[]")) { const count = reader.readVarUint(); return Array.from({ length: count }, () => this.#decodeType(reader, rawType.slice(0, -2))); }
    if (rawType.endsWith("?")) return reader.readByte() ? this.#decodeType(reader, rawType.slice(0, -1)) : null;
    if (rawType.endsWith("$")) return reader.remaining ? this.#decodeType(reader, rawType.slice(0, -1)) : undefined;
    const type = this.resolveType(rawType);
    const struct = this.#structs.get(type);
    if (struct) { const out: Record<string, unknown> = {}; if (struct.base) Object.assign(out, this.#decodeType(reader, struct.base)); for (const field of struct.fields) out[field.name] = this.#decodeType(reader, field.type); return out; }
    const variant = this.#variants.get(type);
    if (variant) { const index = reader.readVarUint(); const selected = variant.types[index]; if (!selected) throw new TypeError(`Invalid ${type} variant index: ${index}`); return { type: selected, value: this.#decodeType(reader, selected) }; }
    switch (type) {
      case "bool": return reader.readByte() !== 0;
      case "uint8": return reader.readByte();
      case "int8": return (reader.readByte() << 24) >> 24;
      case "uint16": return reader.readUint16();
      case "int16": return (reader.readUint16() << 16) >> 16;
      case "uint32": return reader.readUint32();
      case "int32": return reader.readUint32() | 0;
      case "time_point_sec": return new Date(reader.readUint32() * 1000).toISOString();
      case "uint64": return reader.readUint64();
      case "int64": return reader.readInt64();
      case "varuint32": return reader.readVarUint();
      case "varint32": { const n = reader.readVarUint(); return (n >>> 1) ^ -(n & 1); }
      case "name": return reader.readName();
      case "string": return reader.readString();
      case "bytes": return bytesToHex(reader.readVarBytes());
      case "checksum256": return bytesToHex(reader.readBytes(32));
      case "asset": { const amount = reader.readInt64(); const { precision, symbol } = symbolFromBigInt(reader.readUint64()); const negative = amount < 0n; const digits = (negative ? -amount : amount).toString().padStart(precision + 1, "0"); const formatted = precision ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}` : digits; return `${negative ? "-" : ""}${formatted} ${symbol}`; }
      case "symbol": { const { precision, symbol } = symbolFromBigInt(reader.readUint64()); return `${precision},${symbol}`; }
      case "symbol_code": return symbolFromBigInt(reader.readUint64() << 8n).symbol;
      case "public_key": { const index = reader.readByte(); return PublicKey.fromBytes(index === 0 ? "K1" : "R1", reader.readBytes(33)).toString(); }
      case "signature": { const index = reader.readByte(); return Signature.fromBytes(index === 0 ? "K1" : "R1", reader.readBytes(65)).toString(); }
      default: throw new TypeError(`Unsupported ABI type: ${type}`);
    }
  }
}
