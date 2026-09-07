export type VexAsset = {
  amount: bigint;
  precision: number;
  symbol: string;
  value: string;
};

export function parseAsset(asset: string): VexAsset {
  const trimmed = asset.trim();
  try {
    return { ...parseAbiAsset(trimmed) };
  } catch {
    throw new Error(`Invalid Vexanium asset: ${asset}`);
  }
}

export function formatAsset(
  amount: bigint | number | string,
  precision: number,
  symbol: string,
): string {
  return formatAbiAsset(amount, precision, symbol);
}

export function assetToNumber(asset: VexAsset): number {
  return Number(asset.amount) / 10 ** asset.precision;
}
import { formatAsset as formatAbiAsset, parseAsset as parseAbiAsset } from "@windstack/abi";
