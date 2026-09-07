/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";

export type KeyType = "K1" | "R1";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const encoder = new TextEncoder();

function curveFor(type: KeyType) {
  return type === "K1" ? secp256k1 : p256;
}

function assertBytes(value: Uint8Array, length: number, label: string): void {
  if (!(value instanceof Uint8Array) || value.length !== length) {
    throw new TypeError(`${label} must be ${length} bytes`);
  }
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index]! ^ b[index]!;
  }
  return diff === 0;
}

function uint32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function isCanonicalCompact(compact: Uint8Array): boolean {
  if (compact.length !== 64) return false;
  const r0 = compact[0]!;
  const r1 = compact[1]!;
  const s0 = compact[32]!;
  const s1 = compact[33]!;
  return (
    (r0 & 0x80) === 0 &&
    !(r0 === 0 && (r1 & 0x80) === 0) &&
    (s0 & 0x80) === 0 &&
    !(s0 === 0 && (s1 & 0x80) === 0)
  );
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-f]*$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new TypeError("Invalid hexadecimal value");
  }
  return Uint8Array.from(normalized.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

export function sha256Digest(data: Uint8Array): Uint8Array {
  return sha256(data);
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = "";
  while (value > 0n) {
    const mod = Number(value % 58n);
    out = BASE58[mod]! + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return out;
}

function base58Decode(value: string): Uint8Array {
  if (!value) throw new TypeError("Base58 value cannot be empty");
  let number = 0n;
  for (const char of value) {
    const index = BASE58.indexOf(char);
    if (index < 0) throw new TypeError(`Invalid base58 character: ${char}`);
    number = number * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (number > 0n) {
    bytes.unshift(Number(number & 0xffn));
    number >>= 8n;
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function ripemdChecksum(data: Uint8Array, suffix?: string): Uint8Array {
  const payload = suffix ? concatBytes(data, encoder.encode(suffix)) : data;
  return ripemd160(payload).slice(0, 4);
}

function encodeModern(data: Uint8Array, type: KeyType): string {
  return base58Encode(concatBytes(data, ripemdChecksum(data, type)));
}

function decodeModern(value: string, type: KeyType): Uint8Array {
  const decoded = base58Decode(value);
  if (decoded.length < 5) throw new TypeError("Invalid Antelope encoded value");
  const data = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  if (!equalBytes(checksum, ripemdChecksum(data, type))) {
    throw new TypeError("Antelope checksum mismatch");
  }
  return data;
}

export class PublicKey {
  readonly type: KeyType;
  readonly #data: Uint8Array;

  private constructor(type: KeyType, data: Uint8Array) {
    assertBytes(data, 33, "Public key");
    if (!curveFor(type).utils.isValidPublicKey(data)) {
      throw new TypeError(`Invalid ${type} public key`);
    }
    this.type = type;
    this.#data = data.slice();
  }

  static fromBytes(type: KeyType, data: Uint8Array): PublicKey {
    return new PublicKey(type, data);
  }

  static fromString(value: string): PublicKey {
    const modern = /^PUB_(K1|R1)_(.+)$/.exec(value);
    if (modern) {
      const type = modern[1] as KeyType;
      return new PublicKey(type, decodeModern(modern[2]!, type));
    }
    if (value.startsWith("EOS")) {
      const decoded = base58Decode(value.slice(3));
      if (decoded.length !== 37) throw new TypeError("Invalid legacy EOS public key length");
      const data = decoded.slice(0, -4);
      if (!equalBytes(decoded.slice(-4), ripemdChecksum(data))) {
        throw new TypeError("Legacy EOS public-key checksum mismatch");
      }
      return new PublicKey("K1", data);
    }
    throw new TypeError("Unsupported Antelope public-key format");
  }

  toBytes(): Uint8Array {
    return this.#data.slice();
  }

  toString(): string {
    return `PUB_${this.type}_${encodeModern(this.#data, this.type)}`;
  }

  toLegacyString(): string {
    if (this.type !== "K1") throw new TypeError("Legacy EOS public keys only support K1");
    return `EOS${base58Encode(concatBytes(this.#data, ripemdChecksum(this.#data)))}`;
  }

  equals(other: PublicKey): boolean {
    return this.type === other.type && equalBytes(this.#data, other.#data);
  }

  verifyDigest(digest: Uint8Array, signature: Signature): boolean {
    return signature.verifyDigest(digest, this);
  }
}

export class Signature {
  readonly type: KeyType;
  readonly #data: Uint8Array;

  private constructor(type: KeyType, data: Uint8Array) {
    assertBytes(data, 65, "Signature");
    if (data[0]! < 31 || data[0]! > 34) {
      throw new TypeError("Invalid Antelope recovery header");
    }
    this.type = type;
    this.#data = data.slice();
  }

  static fromBytes(type: KeyType, data: Uint8Array): Signature {
    return new Signature(type, data);
  }

  static fromString(value: string): Signature {
    const match = /^SIG_(K1|R1)_(.+)$/.exec(value);
    if (!match) throw new TypeError("Unsupported Antelope signature format");
    const type = match[1] as KeyType;
    return new Signature(type, decodeModern(match[2]!, type));
  }

  toBytes(): Uint8Array {
    return this.#data.slice();
  }

  toString(): string {
    return `SIG_${this.type}_${encodeModern(this.#data, this.type)}`;
  }

  isCanonical(): boolean {
    return this.type !== "K1" || isCanonicalCompact(this.#data.slice(1));
  }

  verifyDigest(digest: Uint8Array, publicKey: PublicKey): boolean {
    assertBytes(digest, 32, "Digest");
    if (publicKey.type !== this.type) return false;
    try {
      return curveFor(this.type).verify(this.#data.slice(1), digest, publicKey.toBytes(), {
        prehash: false,
        lowS: true,
        format: "compact",
      });
    } catch {
      return false;
    }
  }

  recoverDigest(digest: Uint8Array): PublicKey {
    assertBytes(digest, 32, "Digest");
    const recovered = this.#data.slice();
    recovered[0] = recovered[0]! - 31;
    return PublicKey.fromBytes(
      this.type,
      curveFor(this.type).recoverPublicKey(recovered, digest, { prehash: false }),
    );
  }
}

export class PrivateKey {
  readonly type: KeyType;
  readonly #data: Uint8Array;

  private constructor(type: KeyType, data: Uint8Array) {
    assertBytes(data, 32, "Private key");
    if (!curveFor(type).utils.isValidSecretKey(data)) {
      throw new TypeError(`Invalid ${type} private key`);
    }
    this.type = type;
    this.#data = data.slice();
  }

  static fromBytes(type: KeyType, data: Uint8Array): PrivateKey {
    return new PrivateKey(type, data);
  }

  static generate(type: KeyType = "K1"): PrivateKey {
    return new PrivateKey(type, curveFor(type).keygen().secretKey);
  }

  static fromString(value: string): PrivateKey {
    const modern = /^PVT_(K1|R1)_(.+)$/.exec(value);
    if (modern) {
      const type = modern[1] as KeyType;
      return new PrivateKey(type, decodeModern(modern[2]!, type));
    }

    const decoded = base58Decode(value);
    if (decoded.length === 37 && decoded[0] === 0x80) {
      const payload = decoded.slice(0, -4);
      const checksum = sha256(sha256(payload)).slice(0, 4);
      if (!equalBytes(decoded.slice(-4), checksum)) {
        throw new TypeError("Legacy WIF checksum mismatch");
      }
      return new PrivateKey("K1", payload.slice(1));
    }
    throw new TypeError("Unsupported Antelope private-key format");
  }

  toBytes(): Uint8Array {
    return this.#data.slice();
  }

  toString(): string {
    return `PVT_${this.type}_${encodeModern(this.#data, this.type)}`;
  }

  toWif(): string {
    if (this.type !== "K1") throw new TypeError("Legacy WIF only supports K1");
    const payload = concatBytes(Uint8Array.of(0x80), this.#data);
    return base58Encode(concatBytes(payload, sha256(sha256(payload)).slice(0, 4)));
  }

  toPublicKey(): PublicKey {
    return PublicKey.fromBytes(this.type, curveFor(this.type).getPublicKey(this.#data, true));
  }

  signDigest(digest: Uint8Array): Signature {
    assertBytes(digest, 32, "Digest");
    const curve = curveFor(this.type);

    for (let attempt = 0; attempt < 1024; attempt += 1) {
      const options = {
        prehash: false,
        lowS: true,
        format: "recovered" as const,
        ...(attempt === 0
          ? {}
          : { extraEntropy: sha256(concatBytes(digest, uint32Bytes(attempt))) }),
      };
      const recovered = curve.sign(digest, this.#data, options);
      if (this.type === "K1" && !isCanonicalCompact(recovered.slice(1))) continue;
      const antelope = recovered.slice();
      antelope[0] = antelope[0]! + 31;
      return Signature.fromBytes(this.type, antelope);
    }

    throw new Error("Unable to produce a canonical Antelope signature");
  }
}
