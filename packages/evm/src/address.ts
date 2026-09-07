const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && ADDRESS_PATTERN.test(value);
}

/** Normalize an address to lowercase. This does not claim EIP-55 checksum validation. */
export function normalizeEvmAddress(value: string): `0x${string}` {
  if (!isEvmAddress(value)) throw new TypeError("EVM address must contain exactly 20 bytes");
  return value.toLowerCase() as `0x${string}`;
}

export function isEvmTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export function normalizeEvmTransactionHash(value: string): `0x${string}` {
  if (!isEvmTransactionHash(value))
    throw new TypeError("EVM transaction hash must contain exactly 32 bytes");
  return value.toLowerCase() as `0x${string}`;
}

export function formatEvmAddress(value: string, visibleBytes = 4): string {
  const address = normalizeEvmAddress(value);
  if (!Number.isInteger(visibleBytes) || visibleBytes < 1 || visibleBytes > 9) {
    throw new RangeError("visibleBytes must be between 1 and 9");
  }
  const chars = visibleBytes * 2;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function normalizeEvmChainId(value: string | number | bigint): `0x${string}` {
  let chainId: bigint;
  try {
    if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("unsafe");
    if (typeof value === "string" && !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value))
      throw new Error("invalid");
    chainId = BigInt(value);
  } catch {
    throw new TypeError("EVM chain ID must be a non-negative integer");
  }
  if (chainId < 0n || chainId > (1n << 256n) - 1n)
    throw new RangeError("EVM chain ID must fit in uint256");
  return `0x${chainId.toString(16)}`;
}

export function evmChainIdsEqual(
  left: string | number | bigint,
  right: string | number | bigint,
): boolean {
  return normalizeEvmChainId(left) === normalizeEvmChainId(right);
}
