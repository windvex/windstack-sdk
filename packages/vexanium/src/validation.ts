import { Bytes, Checksum256, Name } from "@wharfkit/antelope";
import type {
  VexaniumCaip2ChainId,
  VexaniumChainId,
  VexaniumFullChainId,
} from "./types.js";

const FULL_CHAIN_ID_PATTERN = /^[0-9a-f]{64}$/;
const CAIP2_CHAIN_ID_PATTERN = /^antelope:[0-9a-f]{32}$/;

export function isVexaniumFullChainId(value: unknown): value is VexaniumFullChainId {
  return typeof value === "string" && FULL_CHAIN_ID_PATTERN.test(value) && isChecksum256(value);
}

export function isVexaniumCaip2ChainId(value: unknown): value is VexaniumCaip2ChainId {
  return typeof value === "string" && CAIP2_CHAIN_ID_PATTERN.test(value);
}

export function isVexaniumChainId(value: unknown): value is VexaniumChainId {
  return isVexaniumFullChainId(value) || isVexaniumCaip2ChainId(value);
}

export function toVexaniumCaip2ChainId(chainId: VexaniumFullChainId): VexaniumCaip2ChainId {
  return `antelope:${chainId.slice(0, 32)}`;
}

export function sameVexaniumChain(left: VexaniumChainId, right: VexaniumChainId): boolean {
  if (left === right) return true;
  if (isVexaniumFullChainId(left) && isVexaniumCaip2ChainId(right)) {
    return toVexaniumCaip2ChainId(left) === right;
  }
  if (isVexaniumCaip2ChainId(left) && isVexaniumFullChainId(right)) {
    return left === toVexaniumCaip2ChainId(right);
  }
  return false;
}

export function isAntelopeName(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    return Name.from(value).toString() === value;
  } catch {
    return false;
  }
}

export function isHexBytes(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const bytes = Bytes.from(value);
    return bytes.length > 0 && bytes.hexString.toLowerCase() === value.toLowerCase();
  } catch {
    return false;
  }
}

export function isChecksum256(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return Checksum256.from(value).hexString.toLowerCase() === value.toLowerCase();
  } catch {
    return false;
  }
}
