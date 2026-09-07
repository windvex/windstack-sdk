import { bigIntToName, nameToBigInt } from "@windstack/abi";
import { normalizeEvmAddress } from "@windstack/evm";

export const VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX = "0xbbbbbbbbbbbbbbbbbbbbbbbb" as const;
export const VEX_EVM_BRIDGE_TRANSFER_SELECTOR = "0x73761828" as const;

export type VexEvmAddressClassification =
  | Readonly<{ type: "evm"; address: `0x${string}` }>
  | Readonly<{ type: "reserved-native-bridge"; address: `0x${string}`; account: string }>;

function canonicalAccount(name: string): string {
  if (typeof name !== "string" || !name || name.length > 12 || name.endsWith("."))
    throw new TypeError("A canonical Antelope account name is required");
  const encoded = nameToBigInt(name);
  if (bigIntToName(encoded) !== name)
    throw new TypeError("A canonical Antelope account name is required");
  return name;
}

export function nativeAccountToReservedEvmAddress(account: string): `0x${string}` {
  const suffix = nameToBigInt(canonicalAccount(account)).toString(16).padStart(16, "0");
  return `${VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX}${suffix}`;
}

export function hasReservedNativeBridgePrefix(address: unknown): boolean {
  if (typeof address !== "string") return false;
  try {
    return normalizeEvmAddress(address).startsWith(VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX);
  } catch {
    return false;
  }
}

export function reservedEvmAddressToNativeAccount(address: string): string {
  const normalized = normalizeEvmAddress(address);
  if (!normalized.startsWith(VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX))
    throw new TypeError("Address does not use the VEX EVM native bridge prefix");
  const account = bigIntToName(BigInt(`0x${normalized.slice(-16)}`));
  return canonicalAccount(account);
}

export function isReservedNativeBridgeAddress(address: unknown): address is `0x${string}` {
  if (typeof address !== "string") return false;
  try {
    reservedEvmAddressToNativeAccount(address);
    return true;
  } catch {
    return false;
  }
}

export function classifyVexEvmAddress(address: string): VexEvmAddressClassification {
  const normalized = normalizeEvmAddress(address);
  try {
    return Object.freeze({
      type: "reserved-native-bridge",
      address: normalized,
      account: reservedEvmAddressToNativeAccount(normalized),
    });
  } catch {
    return Object.freeze({ type: "evm", address: normalized });
  }
}

function word(body: string, index: number): string {
  const result = body.slice(index * 64, (index + 1) * 64);
  if (result.length !== 64 || !/^[0-9a-f]{64}$/.test(result))
    throw new TypeError("Malformed bridge calldata word");
  return result;
}

function safeWordNumber(value: string, label: string): number {
  const integer = BigInt(`0x${value}`);
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label} is too large`);
  return Number(integer);
}

function decodeUtf8(body: string, offsetWord: string): string {
  const offset = safeWordNumber(offsetWord, "Bridge calldata offset");
  if (offset !== 96) throw new TypeError("Bridge calldata uses a non-canonical memo offset");
  const lengthOffset = offset * 2;
  const length = safeWordNumber(body.slice(lengthOffset, lengthOffset + 64), "Bridge memo length");
  if (length > 4096) throw new RangeError("Bridge memo exceeds 4096 bytes");
  const start = lengthOffset + 64;
  const hex = body.slice(start, start + length * 2);
  if (hex.length !== length * 2 || !/^[0-9a-f]*$/.test(hex))
    throw new TypeError("Bridge calldata memo is truncated");
  const paddedEnd = start + Math.ceil(length / 32) * 64;
  if (body.length !== paddedEnd || !/^0*$/.test(body.slice(start + length * 2, paddedEnd)))
    throw new TypeError("Bridge calldata has non-canonical padding or trailing data");
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(hex.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []),
  );
}

export type VexEvmBridgeTransfer = Readonly<{
  amount: bigint;
  memo: string;
  nativeAccount: string;
  rawTarget: `0x${string}`;
  reservedTarget: `0x${string}`;
}>;

/** Decode `bridgeTransfer(address,uint256,string)` calldata used by the native VEX bridge. */
export function decodeVexEvmBridgeTransferCalldata(calldata: string): VexEvmBridgeTransfer {
  if (typeof calldata !== "string" || !/^0x[0-9a-fA-F]*$/.test(calldata))
    throw new TypeError("Bridge calldata must be 0x-prefixed hexadecimal bytes");
  const normalized = calldata.toLowerCase();
  if (!normalized.startsWith(VEX_EVM_BRIDGE_TRANSFER_SELECTOR))
    throw new TypeError("Unsupported VEX EVM bridge function selector");
  const body = normalized.slice(10);
  if (body.length < 256 || body.length % 64 !== 0)
    throw new TypeError("Malformed bridge calldata length");
  const targetWord = word(body, 0);
  if (!/^0{24}/.test(targetWord))
    throw new TypeError("Bridge target address has non-zero ABI padding");
  const rawTarget = normalizeEvmAddress(`0x${targetWord.slice(-40)}`);
  const amount = BigInt(`0x${word(body, 1)}`);
  const memo = decodeUtf8(body, word(body, 2));
  const packedTarget = /^0{48}[0-9a-f]{16}$/.test(targetWord)
    ? (`${VEX_EVM_RESERVED_NATIVE_BRIDGE_PREFIX}${targetWord.slice(-16)}` as `0x${string}`)
    : undefined;
  const reservedTarget = isReservedNativeBridgeAddress(rawTarget) ? rawTarget : packedTarget;
  if (!reservedTarget || !isReservedNativeBridgeAddress(reservedTarget))
    throw new TypeError("Bridge target does not encode a native Vexanium account");
  return Object.freeze({
    amount,
    memo,
    nativeAccount: reservedEvmAddressToNativeAccount(reservedTarget),
    rawTarget,
    reservedTarget,
  });
}
