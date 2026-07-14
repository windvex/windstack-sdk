import { Asset } from "@wharfkit/antelope";

export type VexAsset = {
  amount: bigint;
  precision: number;
  symbol: string;
  value: string;
};

export function parseAsset(asset: string): VexAsset {
  const trimmed = asset.trim();
  try {
    const parsed = Asset.from(trimmed);
    if (parsed.toString() !== trimmed) {
      throw new Error("Asset is not canonically encoded");
    }
    return {
      amount: BigInt(parsed.units.toString()),
      precision: parsed.symbol.precision,
      symbol: parsed.symbol.name,
      value: parsed.toString(),
    };
  } catch {
    throw new Error(`Invalid Vexanium asset: ${asset}`);
  }
}

export function formatAsset(amount: bigint | number | string, precision: number, symbol: string): string {
  return Asset.fromUnits(
    BigInt(amount).toString(),
    Asset.Symbol.fromParts(symbol, precision),
  ).toString();
}

export function assetToNumber(asset: VexAsset): number {
  return Number(asset.amount) / 10 ** asset.precision;
}
