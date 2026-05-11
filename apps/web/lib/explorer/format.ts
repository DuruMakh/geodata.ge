const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentNumber = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});

export function formatGel(value: number | null): string {
  if (value === null) return "n/a";
  return `${compactNumber.format(value)} GEL`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "n/a";
  return percentNumber.format(value);
}

export function formatSignedPercent(value: number | null): string {
  if (value === null) return "n/a";
  const formatted = percentNumber.format(value);
  return value > 0 ? `+${formatted}` : formatted;
}

export function formatMeasureValue(value: number | null, measure: "nominal" | "percent_change" | "share_of_total" | "share_of_gdp"): string {
  if (measure === "nominal") return formatGel(value);
  return measure === "percent_change" ? formatSignedPercent(value) : formatPercent(value);
}
