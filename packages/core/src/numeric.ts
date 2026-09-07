export type IntegerInput = bigint | number | string;
export type RoundingMode = "reject" | "down" | "up" | "half-up";

export const BASIS_POINTS = 10_000n;
export const MAX_DECIMAL_PRECISION = 255;

function assertPrecision(value: number, label = "precision"): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_DECIMAL_PRECISION) {
    throw new RangeError(`${label} must be an integer between 0 and ${MAX_DECIMAL_PRECISION}`);
  }
  return value;
}

function assertRoundingMode(value: RoundingMode): RoundingMode {
  if (!["reject", "down", "up", "half-up"].includes(value)) {
    throw new TypeError("Unsupported rounding mode");
  }
  return value;
}

export function integer(value: IntegerInput, label = "value"): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        `${label} must use bigint or a decimal string outside the safe integer range`,
      );
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (!/^-?(?:0|[1-9]\d*)$/.test(value)) {
      throw new TypeError(`${label} must be a canonical integer`);
    }
    return BigInt(value);
  }
  throw new TypeError(`${label} must be an integer-compatible value`);
}

export function powerOfTen(precision: number): bigint {
  return 10n ** BigInt(assertPrecision(precision));
}

export type ParseDecimalOptions = {
  signed?: boolean;
  rounding?: RoundingMode;
};

/** Parse ordinary decimal notation to exact integer units. Exponents and non-finite values are rejected. */
export function parseDecimal(
  input: string,
  precision: number,
  options: ParseDecimalOptions = {},
): bigint {
  const decimals = assertPrecision(precision);
  const rounding = assertRoundingMode(options.rounding ?? "reject");
  if (typeof input !== "string") throw new TypeError("Decimal input must be a string");
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(input);
  if (!match) throw new TypeError(`Invalid decimal value: ${input}`);
  if (match[1] && options.signed !== true) throw new RangeError("Decimal value cannot be negative");

  const fraction = match[3] ?? "";
  if (match[1] && match[2] === "0" && !/[^0]/.test(fraction)) {
    throw new TypeError("Decimal value cannot use negative zero");
  }
  const retained = fraction.slice(0, decimals).padEnd(decimals, "0");
  const discarded = fraction.slice(decimals);
  let units = BigInt(match[2]!) * powerOfTen(decimals) + BigInt(retained || "0");
  if (/[^0]/.test(discarded)) {
    if (rounding === "reject") {
      throw new RangeError(`Decimal value exceeds ${decimals} fractional digits`);
    }
    if (rounding === "up" || (rounding === "half-up" && discarded[0]! >= "5")) units += 1n;
  }
  return match[1] ? -units : units;
}

export type FormatDecimalOptions = {
  trimTrailingZeros?: boolean;
  minFractionDigits?: number;
};

export function formatDecimal(
  value: IntegerInput,
  precision: number,
  options: FormatDecimalOptions = {},
): string {
  const decimals = assertPrecision(precision);
  const minimum = options.minFractionDigits ?? (options.trimTrailingZeros ? 0 : decimals);
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > decimals) {
    throw new RangeError("minFractionDigits must be between zero and precision");
  }
  const units = integer(value);
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(decimals + 1, "0");
  let fraction = decimals ? digits.slice(-decimals) : "";
  if (options.trimTrailingZeros) {
    while (fraction.length > minimum && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  }
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function divideRounded(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  assertRoundingMode(mode);
  if (denominator <= 0n) throw new RangeError("denominator must be positive");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n || mode === "down") return quotient;
  if (mode === "reject") throw new RangeError("Integer conversion would lose precision");
  const sign = numerator < 0n ? -1n : 1n;
  if (mode === "up") return quotient + sign;
  return remainder * sign * 2n >= denominator ? quotient + sign : quotient;
}

export function convertPrecision(
  value: IntegerInput,
  fromPrecision: number,
  toPrecision: number,
  rounding: RoundingMode = "reject",
): bigint {
  const source = assertPrecision(fromPrecision, "fromPrecision");
  const target = assertPrecision(toPrecision, "toPrecision");
  const units = integer(value);
  if (source === target) return units;
  if (target > source) return units * powerOfTen(target - source);
  return divideRounded(units, powerOfTen(source - target), rounding);
}

export function assertBasisPoints(value: number | bigint, label = "basis points"): bigint {
  const bps = integer(value, label);
  if (bps < 0n || bps > BASIS_POINTS) {
    throw new RangeError(`${label} must be between 0 and 10000`);
  }
  return bps;
}

export function multiplyBasisPoints(
  value: IntegerInput,
  basisPoints: number | bigint,
  rounding: RoundingMode = "down",
): bigint {
  return divideRounded(integer(value) * assertBasisPoints(basisPoints), BASIS_POINTS, rounding);
}

/** Apply a minimum-received slippage tolerance, rounding conservatively down. */
export function subtractBasisPoints(value: IntegerInput, basisPoints: number | bigint): bigint {
  const units = integer(value);
  return (units * (BASIS_POINTS - assertBasisPoints(basisPoints))) / BASIS_POINTS;
}

export function ratioToBasisPoints(
  numerator: IntegerInput,
  denominator: IntegerInput,
  rounding: RoundingMode = "down",
): bigint {
  const divisor = integer(denominator, "denominator");
  if (divisor <= 0n) throw new RangeError("denominator must be positive");
  return divideRounded(integer(numerator, "numerator") * BASIS_POINTS, divisor, rounding);
}
