import {
  BASIS_POINTS,
  assertBasisPoints,
  integer,
  subtractBasisPoints,
  type IntegerInput,
} from "./numeric.js";

export type ConstantProductQuote = Readonly<{
  amountIn: bigint;
  amountInAfterFee: bigint;
  amountOut: bigint;
  noFeeAmountOut: bigint;
  feeAmount: bigint;
  feeBps: bigint;
  priceImpactBps: bigint;
}>;

export type ConstantProductQuoteInput = {
  reserveIn: IntegerInput;
  reserveOut: IntegerInput;
  amountIn: IntegerInput;
  feeBps?: number | bigint;
};

/** Exact x*y=k quote with integer-floor semantics suitable for protocol-critical calculations. */
export function quoteConstantProduct(input: ConstantProductQuoteInput): ConstantProductQuote {
  const reserveIn = integer(input.reserveIn, "reserveIn");
  const reserveOut = integer(input.reserveOut, "reserveOut");
  const amountIn = integer(input.amountIn, "amountIn");
  const feeBps = assertBasisPoints(input.feeBps ?? 0, "feeBps");
  if (reserveIn <= 0n || reserveOut <= 0n) throw new RangeError("Reserves must be positive");
  if (amountIn <= 0n) throw new RangeError("amountIn must be positive");

  const amountInAfterFee = (amountIn * (BASIS_POINTS - feeBps)) / BASIS_POINTS;
  if (amountInAfterFee <= 0n) throw new RangeError("amountIn is too small after fees");
  const amountOut = (reserveOut * amountInAfterFee) / (reserveIn + amountInAfterFee);
  const noFeeAmountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
  if (amountOut <= 0n || amountOut >= reserveOut)
    throw new RangeError("Quote has no usable output");

  const executionToSpotBps = (amountOut * reserveIn * BASIS_POINTS) / (amountIn * reserveOut);
  const priceImpactBps =
    executionToSpotBps >= BASIS_POINTS ? 0n : BASIS_POINTS - executionToSpotBps;
  return Object.freeze({
    amountIn,
    amountInAfterFee,
    amountOut,
    noFeeAmountOut,
    feeAmount: amountIn - amountInAfterFee,
    feeBps,
    priceImpactBps,
  });
}

export function quoteConstantProductMinimum(
  quote: Pick<ConstantProductQuote, "amountOut">,
  slippageBps: number | bigint,
): bigint {
  return subtractBasisPoints(quote.amountOut, slippageBps);
}

export type ConstantProductHop<TPoolId = string, TTokenId = string> = {
  poolId: TPoolId;
  tokenIn: TTokenId;
  tokenOut: TTokenId;
  reserveIn: IntegerInput;
  reserveOut: IntegerInput;
  feeBps?: number | bigint;
};

export type ConstantProductRouteQuote<TPoolId = string, TTokenId = string> = Readonly<{
  amountIn: bigint;
  amountOut: bigint;
  minimumAmountOut: bigint;
  hops: readonly Readonly<{
    poolId: TPoolId;
    tokenIn: TTokenId;
    tokenOut: TTokenId;
    quote: ConstantProductQuote;
  }>[];
}>;

export function quoteConstantProductRoute<TPoolId = string, TTokenId = string>(input: {
  amountIn: IntegerInput;
  hops: readonly ConstantProductHop<TPoolId, TTokenId>[];
  slippageBps?: number | bigint;
  maxHops?: number;
}): ConstantProductRouteQuote<TPoolId, TTokenId> {
  const amountIn = integer(input.amountIn, "amountIn");
  const maxHops = input.maxHops ?? 4;
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 16)
    throw new RangeError("maxHops must be between 1 and 16");
  if (!input.hops.length || input.hops.length > maxHops)
    throw new RangeError(`Route must contain between 1 and ${maxHops} hops`);
  const poolIds = new Set<unknown>();
  let current = amountIn;
  let expectedToken: TTokenId | undefined;
  const hops = input.hops.map((hop) => {
    if (poolIds.has(hop.poolId)) throw new TypeError("Route cannot reuse a pool");
    if (expectedToken !== undefined && hop.tokenIn !== expectedToken)
      throw new TypeError("Route token continuity mismatch");
    poolIds.add(hop.poolId);
    const quote = quoteConstantProduct({ ...hop, amountIn: current });
    current = quote.amountOut;
    expectedToken = hop.tokenOut;
    return Object.freeze({
      poolId: hop.poolId,
      tokenIn: hop.tokenIn,
      tokenOut: hop.tokenOut,
      quote,
    });
  });
  return Object.freeze({
    amountIn,
    amountOut: current,
    minimumAmountOut: subtractBasisPoints(current, input.slippageBps ?? 0),
    hops: Object.freeze(hops),
  });
}

export function quoteProportionalWithdrawal(input: {
  liquidity: IntegerInput;
  totalLiquidity: IntegerInput;
  reserves: readonly IntegerInput[];
}): readonly bigint[] {
  const liquidity = integer(input.liquidity, "liquidity");
  const total = integer(input.totalLiquidity, "totalLiquidity");
  if (liquidity <= 0n || total <= 0n || liquidity > total)
    throw new RangeError("Liquidity must be positive and cannot exceed totalLiquidity");
  if (input.reserves.length < 2) throw new RangeError("At least two reserves are required");
  return Object.freeze(
    input.reserves.map((value) => {
      const reserve = integer(value, "reserve");
      if (reserve < 0n) throw new RangeError("Reserves cannot be negative");
      return (reserve * liquidity) / total;
    }),
  );
}

export function quoteProportionalDeposit(input: {
  amount: IntegerInput;
  sourceReserve: IntegerInput;
  otherReserves: readonly IntegerInput[];
}): readonly bigint[] {
  const amount = integer(input.amount, "amount");
  const source = integer(input.sourceReserve, "sourceReserve");
  if (amount <= 0n || source <= 0n)
    throw new RangeError("Amount and source reserve must be positive");
  return Object.freeze(
    input.otherReserves.map((value) => {
      const reserve = integer(value, "reserve");
      if (reserve <= 0n) throw new RangeError("Reserves must be positive");
      return (amount * reserve) / source;
    }),
  );
}
