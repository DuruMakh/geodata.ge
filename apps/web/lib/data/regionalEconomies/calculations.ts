import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const DECIMAL_TEXT = /^-?(0|[1-9]\d*)(?:\.\d+)?$/;

function decimal(value: string, label: string) {
  if (typeof value !== "string" || !DECIMAL_TEXT.test(value)) {
    throw new Error(`Invalid decimal ${label}`);
  }
  const parsed = new D(value);
  if (!parsed.isFinite()) throw new Error(`Invalid decimal ${label}`);
  return parsed;
}

export function shareOfRegionGdpPercent(value: string, regionalGdp: string): string {
  const numerator = decimal(value, "numerator");
  const denominator = decimal(regionalGdp, "regional GDP");
  if (denominator.lte(0)) throw new Error("Share calculation requires positive regional GDP");
  return numerator.div(denominator).mul(100).toDecimalPlaces(20).toFixed();
}
