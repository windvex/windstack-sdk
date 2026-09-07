/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const LOOKUP = new Int16Array(128).fill(-1);
for (let index = 0; index < BASE64URL.length; index += 1) {
  LOOKUP[BASE64URL.charCodeAt(index)] = index;
}

export function encodeBase64Url(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("Base64url input must be Uint8Array");
  let output = "";
  let index = 0;
  for (; index + 2 < bytes.length; index += 3) {
    const value = (bytes[index]! << 16) | (bytes[index + 1]! << 8) | bytes[index + 2]!;
    output +=
      BASE64URL[(value >>> 18) & 63]! +
      BASE64URL[(value >>> 12) & 63]! +
      BASE64URL[(value >>> 6) & 63]! +
      BASE64URL[value & 63]!;
  }
  const remaining = bytes.length - index;
  if (remaining === 1) {
    const value = bytes[index]!;
    output += BASE64URL[value >>> 2]! + BASE64URL[(value & 3) << 4]!;
  } else if (remaining === 2) {
    const value = (bytes[index]! << 8) | bytes[index + 1]!;
    output +=
      BASE64URL[(value >>> 10) & 63]! +
      BASE64URL[(value >>> 4) & 63]! +
      BASE64URL[(value & 15) << 2]!;
  }
  return output;
}

export function decodeBase64Url(value: string, maxBytes = 2 * 1024 * 1024): Uint8Array {
  if (typeof value !== "string" || !value.length) throw new TypeError("Base64url input is empty");
  if (value.length % 4 === 1) throw new TypeError("Invalid base64url length");
  const estimatedBytes = Math.floor((value.length * 3) / 4);
  if (estimatedBytes > maxBytes) throw new RangeError("Signing-request payload is too large");

  const output = new Uint8Array(estimatedBytes);
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = decodeCharacter(value, index);
    const b = decodeCharacter(value, index + 1);
    const hasC = index + 2 < value.length;
    const hasD = index + 3 < value.length;
    const c = hasC ? decodeCharacter(value, index + 2) : 0;
    const d = hasD ? decodeCharacter(value, index + 3) : 0;

    output[outputIndex++] = (a << 2) | (b >>> 4);
    if (hasC) output[outputIndex++] = ((b & 15) << 4) | (c >>> 2);
    if (hasD) output[outputIndex++] = ((c & 3) << 6) | d;
  }
  return output.slice(0, outputIndex);
}

function decodeCharacter(value: string, index: number): number {
  const code = value.charCodeAt(index);
  if (code >= LOOKUP.length || LOOKUP[code] === -1) {
    throw new TypeError(`Invalid base64url character at offset ${index}`);
  }
  return LOOKUP[code]!;
}
