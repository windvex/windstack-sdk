/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import {
  PrivateKey,
  PublicKey,
  Signature,
  hexToBytes,
  sha256Digest,
} from "../packages/crypto/dist/index.js";

const scalarOne = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 1 : 0));
const digest = sha256Digest(new TextEncoder().encode("WindStack deterministic signature vector"));
const otherDigest = sha256Digest(new TextEncoder().encode("different digest"));

for (const type of ["K1", "R1"]) {
  const privateKey = PrivateKey.fromBytes(type, scalarOne);
  const publicKey = privateKey.toPublicKey();
  const first = privateKey.signDigest(digest);
  const second = privateKey.signDigest(digest);
  assert.equal(first.toString(), second.toString(), `${type} signing must be deterministic`);
  assert.equal(first.verifyDigest(digest, publicKey), true);
  assert.equal(first.verifyDigest(otherDigest, publicKey), false);
  assert.equal(first.recoverDigest(digest).toString(), publicKey.toString());
  assert.equal(first.isCanonical(), true);
  assert.equal(PrivateKey.fromString(privateKey.toString()).toString(), privateKey.toString());
  assert.equal(PublicKey.fromString(publicKey.toString()).toString(), publicKey.toString());
  assert.equal(Signature.fromString(first.toString()).toString(), first.toString());
}

const k1 = PrivateKey.fromBytes("K1", scalarOne);
const r1 = PrivateKey.fromBytes("R1", scalarOne);
assert.equal(k1.signDigest(digest).verifyDigest(digest, r1.toPublicKey()), false);
assert.equal(PrivateKey.fromString(k1.toWif()).toString(), k1.toString());
assert.equal(
  PublicKey.fromString(k1.toPublicKey().toLegacyString()).toString(),
  k1.toPublicKey().toString(),
);
assert.equal(PrivateKey.generate("K1").toBytes().length, 32);
assert.equal(PrivateKey.generate("R1").toBytes().length, 32);

function corrupt(value) {
  const last = value.at(-1);
  return `${value.slice(0, -1)}${last === "1" ? "2" : "1"}`;
}

assert.throws(() => PrivateKey.fromBytes("K1", new Uint8Array(32)), /Invalid K1 private key/);
assert.throws(
  () => PrivateKey.fromBytes("K1", new Uint8Array(32).fill(0xff)),
  /Invalid K1 private key/,
);
assert.throws(() => PrivateKey.fromBytes("invalid", scalarOne), /Unsupported Antelope key type/);
assert.throws(() => PublicKey.fromBytes("K1", new Uint8Array(33)), /Invalid K1 public key/);
assert.throws(
  () => PublicKey.fromBytes("K1", Uint8Array.of(4, ...new Uint8Array(32))),
  /Invalid K1 public key/,
);
assert.throws(
  () => Signature.fromBytes("K1", Uint8Array.of(30, ...new Uint8Array(64))),
  /recovery header/,
);
assert.throws(
  () => Signature.fromBytes("K1", Uint8Array.of(31, ...new Uint8Array(64))),
  /compact signature/,
);
assert.throws(() => PrivateKey.fromString(corrupt(k1.toString())), /checksum/);
assert.throws(() => PrivateKey.fromString(corrupt(k1.toWif())), /checksum|Unsupported/);
assert.throws(() => PublicKey.fromString(corrupt(k1.toPublicKey().toString())), /checksum/);
assert.throws(() => Signature.fromString(corrupt(k1.signDigest(digest).toString())), /checksum/);
assert.throws(() => k1.signDigest(new Uint8Array(31)), /Digest must be 32 bytes/);
assert.throws(() => k1.signDigest("not bytes"), /Digest must be 32 bytes/);
assert.throws(() => hexToBytes("abc"), /Invalid hexadecimal/);

console.log("Crypto security tests passed");
