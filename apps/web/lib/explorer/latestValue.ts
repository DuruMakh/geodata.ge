import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { formatInUnit, formatShare, UNIT_BN } from "./format";
import type { GdpState } from "./gdpOverview";

// The one-line latest value under an explorer title (owner decision D2,
// 2026-10-07), the pattern the sectors and regional-economy pages already use:
// "{measure} · {period}: {value}". It always states the latest loaded
// observation of the active indicator, never the reader's range selection.

/** The latest period and its value in a period → value series, or null when empty. */
export function latestEntry<K extends number>(values: ReadonlyMap<K, number> | undefined): { period: K; value: number } | null {
  let latest: { period: K; value: number } | null = null;
  for (const [period, value] of values ?? []) {
    if (latest === null || period > latest.period) latest = { period, value };
  }
  return latest;
}

/** GDP in the overview's own units: "27.1 მლრდ აშშ დოლარი", "28,235 ₾", "+7.5%". `value` is a fraction for growth. */
export function formatGdpLatestValue(state: Pick<GdpState, "indicator" | "currency">, value: number, messages: Messages): string {
  const t = (key: string) => message(messages, `gdp.${key}`);
  if (state.indicator === "growth") return formatShare(value, true);
  const currency = t(state.indicator === "real" ? "usd" : state.currency);
  // Same grouping, decimal point and minus as the chart axis and table (DESIGN §11).
  if (state.indicator === "per_capita") return `${formatInUnit(value, { divisor: 1, label: "", decimals: 0 })} ${currency}`;
  return `${formatInUnit(value, UNIT_BN)} ${t("bn")} ${currency}`;
}
