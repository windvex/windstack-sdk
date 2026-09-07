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
const BLOCK_TIMESTAMP_EPOCH_MS = Date.UTC(2000, 0, 1);

export type AbiField = { name: string; type: string };
export type AbiStruct = { name: string; base?: string; fields: AbiField[] };
export type AbiTypeDef = { new_type_name: string; type: string };
export type AbiAction = { name: string; type: string; ricardian_contract?: string };
export type AbiVariant = { name: string; types: string[] };
export type AbiTable = {
  name: string;
  index_type: string;
  key_names?: string[];
  key_types?: string[];
  type: string;
};
export type Abi = {
  version: string;
  types?: AbiTypeDef[];
  structs?: AbiStruct[];
  actions?: AbiAction[];
  tables?: AbiTable[];
  variants?: AbiVariant[];
  [key: string]: unknown;
};

function assertInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function assertBigIntRange(value: bigint, bits: number, signed: boolean, label: string): bigint {
  const width = BigInt(bits);
  const min = signed ? -(1n << (width - 1n)) : 0n;
  const max = signed ? (1n << (width - 1n)) - 1n : (1n << width) - 1n;
  if (value < min || value > max) {
    throw new RangeError(`${label} is outside the ${signed ? "signed" : "unsigned"} ${bits}-bit range`);
  }
  return value;
}

function toBigInt(value: unknown, label: string): bigint {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    throw new TypeError(`${label} expects an integer-compatible value`);
  }
}

function toNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} expects a finite number`);
  return number;
}

function assertHexBytes(value: unknown, bytes: number, label: string): Uint8Array {
  const data = typeof value === "string" ? hexToBytes(value) : value;
  if (!(data instanceof Uint8Array) || data.length !== bytes) {
    throw new TypeError(`${label} must be exactly ${bytes} bytes`);
  }
  return data;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const value = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) {
    throw new TypeError("Invalid hexadecimal value");
  }
  return Uint8Array.from(value.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

export function nameToBigInt(name: string): bigint {
  if (typeof name !== "string" || name.length > 13) {
    throw new RangeError("Antelope name cannot exceed 13 characters");
  }
  let value = 0n;
  for (let index = 0; index < 13; index += 1) {
    const char = index < name.length ? NAME_CHARS.indexOf(name[index]!) : 0;
    if (char < 0) throw new TypeError(`Invalid Antelope name character: ${name[index]}`);
    if (index === 12) {
      if (char > 15) {
        throw new TypeError("The 13th Antelope name character must be .12345abcdefghij");
      }
      value |= BigInt(char);
    } else {
      value |= BigInt(char) << BigInt(64 - 5 * (index + 1));
    }
  }
  return value;
}

export function bigIntToName(value: bigint): string {
  let current = BigInt.asUintN(64, value);
  const chars = new Array<string>(13).fill(".");
  for (let index = 0; index <= 12; index += 1) {
    const charIndex = index === 0 ? Number(current & 0x0fn) : Number(current & 0x1fn);
    chars[12 - index] = NAME_CHARS[charIndex]!;
    current >>= index === 0 ? 4n : 5n;
  }
  return chars.join("").replace(/\.+$/, "");
}

export class BinaryWriter {
  #bytes: number[] = [];

  writeByte(value: number): void {
    this.#bytes.push(assertInteger(value, 0, 0xff, "byte"));
  }

  writeUint16(value: number): void {
    const checked = assertInteger(value, 0, 0xffff, "uint16");
    this.writeByte(checked & 0xff);
    this.writeByte((checked >>> 8) & 0xff);
  }

  writeInt16(value: number): void {
    const checked = assertInteger(value, -0x8000, 0x7fff, "int16");
    this.writeUint16(checked & 0xffff);
  }

  writeUint32(value: number): void {
    const checked = assertInteger(value, 0, 0xffffffff, "uint32");
    for (let index = 0; index < 4; index += 1) this.writeByte((checked >>> (8 * index)) & 0xff);
  }

  writeInt32(value: number): void {
    const checked = assertInteger(value, -0x80000000, 0x7fffffff, "int32");
    this.writeUint32(checked >>> 0);
  }

  writeUint64(value: bigint): void {
    let current = assertBigIntRange(value, 64, false, "uint64");
    for (let index = 0; index < 8; index += 1) {
      this.writeByte(Number(current & 0xffn));
      current >>= 8n;
    }
  }

  writeInt64(value: bigint): void {
    const checked = assertBigIntRange(value, 64, true, "int64");
    this.writeUint64(BigInt.asUintN(64, checked));
  }

  writeUint128(value: bigint): void {
    let current = assertBigIntRange(value, 128, false, "uint128");
    for (let index = 0; index < 16; index += 1) {
      this.writeByte(Number(current & 0xffn));
      current >>= 8n;
    }
  }

  writeInt128(value: bigint): void {
    const checked = assertBigIntRange(value, 128, true, "int128");
    this.writeUint128(BigInt.asUintN(128, checked));
  }

  writeFloat32(value: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, value, true);
    this.writeBytes(bytes);
  }

  writeFloat64(value: number): void {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, value, true);
    this.writeBytes(bytes);
  }

  writeVarUint(value: number): void {
    let current = assertInteger(value, 0, 0xffffffff, "varuint32") >>> 0;
    while (true) {
      if (current >>> 7) {
        this.writeByte(0x80 | (current & 0x7f));
        current >>>= 7;
      } else {
        this.writeByte(current);
        return;
      }
    }
  }

  writeVarInt(value: number): void {
    const checked = assertInteger(value, -0x80000000, 0x7fffffff, "varint32");
    this.writeVarUint(((checked << 1) ^ (checked >> 31)) >>> 0);
  }

  writeBytes(value: Uint8Array): void {
    if (!(value instanceof Uint8Array)) throw new TypeError("Expected Uint8Array");
    for (const byte of value) this.#bytes.push(byte);
  }

  writeVarBytes(value: Uint8Array): void {
    this.writeVarUint(value.length);
    this.writeBytes(value);
  }

  writeString(value: string): void {
    this.writeVarBytes(encoder.encode(value));
  }

  writeName(value: string): void {
    this.writeUint64(nameToBigInt(value));
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }
}

export class BinaryReader {
  readonly #bytes: Uint8Array;
  #offset = 0;

  constructor(bytes: Uint8Array) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("BinaryReader expects Uint8Array");
    this.#bytes = bytes;
  }

  get remaining(): number {
    return this.#bytes.length - this.#offset;
  }

  readByte(): number {
    if (this.remaining < 1) throw new RangeError("Unexpected end of ABI data");
    return this.#bytes[this.#offset++]!;
  }

  readUint16(): number {
    return this.readByte() | (this.readByte() << 8);
  }

  readInt16(): number {
    return (this.readUint16() << 16) >> 16;
  }

  readUint32(): number {
    return (
      this.readByte() |
      (this.readByte() << 8) |
      (this.readByte() << 16) |
      (this.readByte() << 24)
    ) >>> 0;
  }

  readInt32(): number {
    return this.readUint32() | 0;
  }

  readUint64(): bigint {
    let value = 0n;
    for (let index = 0n; index < 8n; index += 1n) {
      value |= BigInt(this.readByte()) << (8n * index);
    }
    return value;
  }

  readInt64(): bigint {
    return BigInt.asIntN(64, this.readUint64());
  }

  readUint128(): bigint {
    let value = 0n;
    for (let index = 0n; index < 16n; index += 1n) {
      value |= BigInt(this.readByte()) << (8n * index);
    }
    return value;
  }

  readInt128(): bigint {
    return BigInt.asIntN(128, this.readUint128());
  }

  readFloat32(): number {
    const bytes = this.readBytes(4);
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, true);
  }

  readFloat64(): number {
    const bytes = this.readBytes(8);
    return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
  }

  readVarUint(): number {
    let value = 0;
    let bit = 0;
    while (true) {
      const byte = this.readByte();
      if (bit === 28 && (byte & 0xf0) !== 0) throw new RangeError("varuint32 overflow");
      value |= (byte & 0x7f) << bit;
      if ((byte & 0x80) === 0) return value >>> 0;
      bit += 7;
      if (bit > 28) throw new RangeError("varuint32 overflow");
    }
  }

  readVarInt(): number {
    const value = this.readVarUint();
    return (value >>> 1) ^ -(value & 1);
  }

  readBytes(length: number): Uint8Array {
    assertInteger(length, 0, this.remaining, "byte length");
    const out = this.#bytes.slice(this.#offset, this.#offset + length);
    this.#offset += length;
    return out;
  }

  readVarBytes(): Uint8Array {
    return this.readBytes(this.readVarUint());
  }

  readString(): string {
    return decoder.decode(this.readVarBytes());
  }

  readName(): string {
    return bigIntToName(this.readUint64());
  }
}

function parseAsset(value: string): { amount: bigint; precision: number; symbol: string } {
  const match = /^(-?)(\d+)(?:\.(\d+))? ([A-Z]{1,7})$/.exec(value);
  if (!match) throw new TypeError(`Invalid asset: ${value}`);
  const fraction = match[3] ?? "";
  const amount = BigInt(`${match[1]}${match[2]}${fraction}`);
  assertBigIntRange(amount, 64, true, "asset amount");
  return { amount, precision: fraction.length, symbol: match[4]! };
}

function validateSymbol(symbol: string): string {
  if (!/^[A-Z]{1,7}$/.test(symbol)) throw new TypeError(`Invalid Antelope symbol: ${symbol}`);
  return symbol;
}

function symbolToBigInt(symbol: string, precision: number): bigint {
  validateSymbol(symbol);
  assertInteger(precision, 0, 18, "symbol precision");
  let value = BigInt(precision);
  for (let index = 0; index < symbol.length; index += 1) {
    value |= BigInt(symbol.charCodeAt(index)) << BigInt(8 * (index + 1));
  }
  return value;
}

function symbolFromBigInt(raw: bigint): { precision: number; symbol: string } {
  const precision = Number(raw & 0xffn);
  let value = raw >> 8n;
  let symbol = "";
  while (value > 0n) {
    const code = Number(value & 0xffn);
    if (code === 0 || code < 65 || code > 90) throw new TypeError("Invalid encoded Antelope symbol");
    symbol += String.fromCharCode(code);
    value >>= 8n;
  }
  validateSymbol(symbol);
  return { precision, symbol };
}

function timePointToMicros(value: unknown): bigint {
  if (typeof value === "bigint" || typeof value === "number") {
    return assertBigIntRange(toBigInt(value, "time_point"), 64, true, "time_point");
  }
  if (typeof value !== "string") throw new TypeError("time_point expects an ISO timestamp or microseconds");
  if (/^-?\d+$/.test(value)) return assertBigIntRange(BigInt(value), 64, true, "time_point");
  const match = /^(.+T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) throw new TypeError(`Invalid time_point: ${value}`);
  const baseMs = Date.parse(`${match[1]}${match[3] ?? "Z"}`);
  if (!Number.isFinite(baseMs)) throw new TypeError(`Invalid time_point: ${value}`);
  const micros = BigInt((match[2] ?? "").padEnd(6, "0") || "0");
  return BigInt(baseMs) * 1000n + micros;
}

function microsToTimePoint(value: bigint): string {
  const milliseconds = value / 1000n;
  const remainder = value % 1000n;
  const date = new Date(Number(milliseconds));
  if (!Number.isFinite(date.getTime())) return value.toString();
  const iso = date.toISOString();
  const millisecondFraction = BigInt(iso.slice(20, 23)) * 1000n + remainder;
  return iso.replace(/\.\d{3}Z$/, `.${millisecondFraction.toString().padStart(6, "0")}Z`);
}

function blockTimestampToSlot(value: unknown): number {
  if (typeof value === "number") return assertInteger(value, 0, 0xffffffff, "block_timestamp_type");
  if (typeof value !== "string") throw new TypeError("block_timestamp_type expects an ISO timestamp or slot number");
  if (/^\d+$/.test(value)) return assertInteger(Number(value), 0, 0xffffffff, "block_timestamp_type");
  const timestamp = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(timestamp) || timestamp < BLOCK_TIMESTAMP_EPOCH_MS) {
    throw new TypeError(`Invalid block_timestamp_type: ${value}`);
  }
  return assertInteger(Math.floor((timestamp - BLOCK_TIMESTAMP_EPOCH_MS) / 500), 0, 0xffffffff, "block_timestamp_type");
}

function decodeAsset(reader: BinaryReader): string {
  const amount = reader.readInt64();
  const { precision, symbol } = symbolFromBigInt(reader.readUint64());
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(precision + 1, "0");
  const formatted = precision
    ? `${digits.slice(0, -precision)}.${digits.slice(-precision)}`
    : digits;
  return `${negative ? "-" : ""}${formatted} ${symbol}`;
}

function encodeExtendedAsset(writer: BinaryWriter, value: unknown): void {
  let quantity: unknown;
  let contract: unknown;
  if (typeof value === "string") {
    const separator = value.lastIndexOf("@");
    if (separator < 1) throw new TypeError("extended_asset expects quantity@contract");
    quantity = value.slice(0, separator);
    contract = value.slice(separator + 1);
  } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    quantity = record.quantity;
    contract = record.contract;
  } else {
    throw new TypeError("extended_asset expects { quantity, contract } or quantity@contract");
  }
  const asset = parseAsset(String(quantity));
  writer.writeInt64(asset.amount);
  writer.writeUint64(symbolToBigInt(asset.symbol, asset.precision));
  writer.writeName(String(contract));
}

export class AbiSerializer {
  readonly abi: Abi;
  readonly #aliases = new Map<string, string>();
  readonly #structs = new Map<string, AbiStruct>();
  readonly #variants = new Map<string, AbiVariant>();

  constructor(abi: Abi) {
    if (!abi || typeof abi !== "object" || typeof abi.version !== "string") {
      throw new TypeError("A valid Antelope ABI is required");
    }
    this.abi = abi;
    for (const type of abi.types ?? []) this.#aliases.set(type.new_type_name, type.type);
    for (const struct of abi.structs ?? []) this.#structs.set(struct.name, struct);
    for (const variant of abi.variants ?? []) this.#variants.set(variant.name, variant);
  }

  resolveType(type: string): string {
    let current = type;
    const seen = new Set<string>();
    while (this.#aliases.has(current)) {
      if (seen.has(current)) throw new TypeError(`Cyclic ABI alias: ${type}`);
      seen.add(current);
      current = this.#aliases.get(current)!;
    }
    return current;
  }

  getActionType(name: string): string {
    const action = this.abi.actions?.find((item) => item.name === name);
    if (!action) throw new TypeError(`Unknown ABI action: ${name}`);
    return action.type;
  }

  getTableType(name: string): string {
    const table = this.abi.tables?.find((item) => item.name === name);
    if (!table) throw new TypeError(`Unknown ABI table: ${name}`);
    return table.type;
  }

  encode(type: string, value: unknown): Uint8Array {
    const writer = new BinaryWriter();
    this.#encodeType(writer, type, value);
    return writer.toBytes();
  }

  decode(type: string, bytes: Uint8Array): unknown {
    const reader = new BinaryReader(bytes);
    const value = this.#decodeType(reader, type);
    if (reader.remaining !== 0) throw new TypeError(`Unused ABI bytes: ${reader.remaining}`);
    return value;
  }

  encodeAction(name: string, value: unknown): Uint8Array {
    return this.encode(this.getActionType(name), value);
  }

  decodeAction(name: string, bytes: Uint8Array): unknown {
    return this.decode(this.getActionType(name), bytes);
  }

  #encodeType(writer: BinaryWriter, rawType: string, value: unknown): void {
    if (rawType.endsWith("[]")) {
      if (!Array.isArray(value)) throw new TypeError(`${rawType} expects an array`);
      writer.writeVarUint(value.length);
      for (const item of value) this.#encodeType(writer, rawType.slice(0, -2), item);
      return;
    }
    if (rawType.endsWith("?")) {
      if (value === null || value === undefined) {
        writer.writeByte(0);
        return;
      }
      writer.writeByte(1);
      this.#encodeType(writer, rawType.slice(0, -1), value);
      return;
    }
    if (rawType.endsWith("$")) {
      if (value !== null && value !== undefined) this.#encodeType(writer, rawType.slice(0, -1), value);
      return;
    }

    const type = this.resolveType(rawType);
    const struct = this.#structs.get(type);
    if (struct) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError(`${type} expects an object`);
      }
      if (struct.base) this.#encodeType(writer, struct.base, value);
      const record = value as Record<string, unknown>;
      for (const field of struct.fields) this.#encodeType(writer, field.type, record[field.name]);
      return;
    }

    const variant = this.#variants.get(type);
    if (variant) {
      if (value === null || value === undefined) throw new TypeError(`${type} expects a variant value`);
      const pair = Array.isArray(value)
        ? value
        : [String((value as { type: string }).type), (value as { value: unknown }).value];
      const index = variant.types.indexOf(String(pair[0]));
      if (index < 0) throw new TypeError(`Unknown ${type} variant: ${String(pair[0])}`);
      writer.writeVarUint(index);
      this.#encodeType(writer, variant.types[index]!, pair[1]);
      return;
    }

    switch (type) {
      case "bool":
        if (typeof value !== "boolean") throw new TypeError("bool expects true or false");
        writer.writeByte(value ? 1 : 0);
        return;
      case "uint8":
        writer.writeByte(assertInteger(toNumber(value, type), 0, 0xff, type));
        return;
      case "int8": {
        const checked = assertInteger(toNumber(value, type), -0x80, 0x7f, type);
        writer.writeByte(checked & 0xff);
        return;
      }
      case "uint16":
        writer.writeUint16(assertInteger(toNumber(value, type), 0, 0xffff, type));
        return;
      case "int16":
        writer.writeInt16(assertInteger(toNumber(value, type), -0x8000, 0x7fff, type));
        return;
      case "uint32":
        writer.writeUint32(assertInteger(toNumber(value, type), 0, 0xffffffff, type));
        return;
      case "int32":
        writer.writeInt32(assertInteger(toNumber(value, type), -0x80000000, 0x7fffffff, type));
        return;
      case "uint64":
        writer.writeUint64(assertBigIntRange(toBigInt(value, type), 64, false, type));
        return;
      case "int64":
        writer.writeInt64(assertBigIntRange(toBigInt(value, type), 64, true, type));
        return;
      case "uint128":
        writer.writeUint128(assertBigIntRange(toBigInt(value, type), 128, false, type));
        return;
      case "int128":
        writer.writeInt128(assertBigIntRange(toBigInt(value, type), 128, true, type));
        return;
      case "varuint32":
      case "varuint":
        writer.writeVarUint(toNumber(value, type));
        return;
      case "varint32":
      case "varint":
        writer.writeVarInt(toNumber(value, type));
        return;
      case "float32":
        writer.writeFloat32(toNumber(value, type));
        return;
      case "float64":
        writer.writeFloat64(toNumber(value, type));
        return;
      case "float128":
        writer.writeBytes(assertHexBytes(value, 16, type));
        return;
      case "name":
        writer.writeName(String(value));
        return;
      case "string":
        if (typeof value !== "string") throw new TypeError("string expects a string value");
        writer.writeString(value);
        return;
      case "bytes":
        writer.writeVarBytes(typeof value === "string" ? hexToBytes(value) : assertHexBytes(value, (value as Uint8Array).length, type));
        return;
      case "checksum160":
        writer.writeBytes(assertHexBytes(value, 20, type));
        return;
      case "checksum256":
        writer.writeBytes(assertHexBytes(value, 32, type));
        return;
      case "checksum512":
        writer.writeBytes(assertHexBytes(value, 64, type));
        return;
      case "asset": {
        const asset = parseAsset(String(value));
        writer.writeInt64(asset.amount);
        writer.writeUint64(symbolToBigInt(asset.symbol, asset.precision));
        return;
      }
      case "extended_asset":
        encodeExtendedAsset(writer, value);
        return;
      case "symbol": {
        const match = /^(\d+),([A-Z]{1,7})$/.exec(String(value));
        if (!match) throw new TypeError("symbol expects precision,CODE");
        writer.writeUint64(symbolToBigInt(match[2]!, Number(match[1])));
        return;
      }
      case "symbol_code": {
        const code = validateSymbol(String(value));
        let raw = 0n;
        for (let index = 0; index < code.length; index += 1) {
          raw |= BigInt(code.charCodeAt(index)) << BigInt(8 * index);
        }
        writer.writeUint64(raw);
        return;
      }
      case "time_point":
        writer.writeInt64(timePointToMicros(value));
        return;
      case "time_point_sec": {
        const seconds = typeof value === "string"
          ? Math.floor(Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`) / 1000)
          : toNumber(value, type);
        writer.writeUint32(assertInteger(seconds, 0, 0xffffffff, type));
        return;
      }
      case "block_timestamp_type":
        writer.writeUint32(blockTimestampToSlot(value));
        return;
      case "public_key":
      case "publickey": {
        const key = value instanceof PublicKey ? value : PublicKey.fromString(String(value));
        writer.writeByte(key.type === "K1" ? 0 : 1);
        writer.writeBytes(key.toBytes());
        return;
      }
      case "signature": {
        const signature = value instanceof Signature ? value : Signature.fromString(String(value));
        writer.writeByte(signature.type === "K1" ? 0 : 1);
        writer.writeBytes(signature.toBytes());
        return;
      }
      default:
        throw new TypeError(`Unsupported ABI type: ${type}`);
    }
  }

  #decodeType(reader: BinaryReader, rawType: string): unknown {
    if (rawType.endsWith("[]")) {
      const count = reader.readVarUint();
      return Array.from({ length: count }, () => this.#decodeType(reader, rawType.slice(0, -2)));
    }
    if (rawType.endsWith("?")) {
      const present = reader.readByte();
      if (present !== 0 && present !== 1) throw new TypeError(`Invalid optional marker: ${present}`);
      return present ? this.#decodeType(reader, rawType.slice(0, -1)) : null;
    }
    if (rawType.endsWith("$")) {
      return reader.remaining ? this.#decodeType(reader, rawType.slice(0, -1)) : undefined;
    }

    const type = this.resolveType(rawType);
    const struct = this.#structs.get(type);
    if (struct) {
      const out: Record<string, unknown> = {};
      if (struct.base) {
        const base = this.#decodeType(reader, struct.base);
        if (typeof base !== "object" || base === null || Array.isArray(base)) {
          throw new TypeError(`ABI base struct ${struct.base} did not decode to an object`);
        }
        Object.assign(out, base);
      }
      for (const field of struct.fields) out[field.name] = this.#decodeType(reader, field.type);
      return out;
    }

    const variant = this.#variants.get(type);
    if (variant) {
      const index = reader.readVarUint();
      const selected = variant.types[index];
      if (!selected) throw new TypeError(`Invalid ${type} variant index: ${index}`);
      return { type: selected, value: this.#decodeType(reader, selected) };
    }

    switch (type) {
      case "bool": {
        const value = reader.readByte();
        if (value !== 0 && value !== 1) throw new TypeError(`Invalid bool value: ${value}`);
        return value === 1;
      }
      case "uint8":
        return reader.readByte();
      case "int8":
        return (reader.readByte() << 24) >> 24;
      case "uint16":
        return reader.readUint16();
      case "int16":
        return reader.readInt16();
      case "uint32":
        return reader.readUint32();
      case "int32":
        return reader.readInt32();
      case "uint64":
        return reader.readUint64();
      case "int64":
        return reader.readInt64();
      case "uint128":
        return reader.readUint128();
      case "int128":
        return reader.readInt128();
      case "varuint32":
      case "varuint":
        return reader.readVarUint();
      case "varint32":
      case "varint":
        return reader.readVarInt();
      case "float32":
        return reader.readFloat32();
      case "float64":
        return reader.readFloat64();
      case "float128":
        return bytesToHex(reader.readBytes(16));
      case "name":
        return reader.readName();
      case "string":
        return reader.readString();
      case "bytes":
        return bytesToHex(reader.readVarBytes());
      case "checksum160":
        return bytesToHex(reader.readBytes(20));
      case "checksum256":
        return bytesToHex(reader.readBytes(32));
      case "checksum512":
        return bytesToHex(reader.readBytes(64));
      case "asset":
        return decodeAsset(reader);
      case "extended_asset":
        return { quantity: decodeAsset(reader), contract: reader.readName() };
      case "symbol": {
        const { precision, symbol } = symbolFromBigInt(reader.readUint64());
        return `${precision},${symbol}`;
      }
      case "symbol_code": {
        let raw = reader.readUint64();
        let code = "";
        while (raw > 0n) {
          const char = Number(raw & 0xffn);
          if (char < 65 || char > 90) throw new TypeError("Invalid encoded symbol_code");
          code += String.fromCharCode(char);
          raw >>= 8n;
        }
        return validateSymbol(code);
      }
      case "time_point":
        return microsToTimePoint(reader.readInt64());
      case "time_point_sec":
        return new Date(reader.readUint32() * 1000).toISOString();
      case "block_timestamp_type":
        return new Date(BLOCK_TIMESTAMP_EPOCH_MS + reader.readUint32() * 500).toISOString();
      case "public_key":
      case "publickey": {
        const keyType = reader.readByte();
        if (keyType !== 0 && keyType !== 1) throw new TypeError(`Unsupported public-key type: ${keyType}`);
        return PublicKey.fromBytes(keyType === 0 ? "K1" : "R1", reader.readBytes(33)).toString();
      }
      case "signature": {
        const keyType = reader.readByte();
        if (keyType !== 0 && keyType !== 1) throw new TypeError(`Unsupported signature type: ${keyType}`);
        return Signature.fromBytes(keyType === 0 ? "K1" : "R1", reader.readBytes(65)).toString();
      }
      default:
        throw new TypeError(`Unsupported ABI type: ${type}`);
    }
  }
}
