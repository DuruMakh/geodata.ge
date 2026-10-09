import { beforeAll, describe, expect, it } from "vitest";
import { REAL_GDP_SUMMARY_PERIODS } from "../../components/gdp/gdp-summary";
import { loadGdpOverviewFacts } from "../../lib/data/gdpOverview/importGdpOverview";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Messages } from "../../lib/i18n/types";

// The four GDP summaries are reviewed editorial copy (spec 2026-09-10 §213, §217),
// so this test does not generate prose. It recomputes every figure they quote from
// the canonical CSV, and fails when the data moves under the text.

type Series = Map<number, number>;

let facts: Awaited<ReturnType<typeof loadGdpOverviewFacts>>;
const messagesByLocale = new Map<Locale, Messages>();

beforeAll(async () => {
  facts = await loadGdpOverviewFacts();
  for (const locale of ["ka", "en"] as const) messagesByLocale.set(locale, await getMessages(locale, ["gdp"]));
});

const seriesOf = (seriesId: string): Series =>
  new Map(facts.filter((fact) => fact.seriesId === seriesId).map((fact) => [fact.year, Number(fact.value)]));
const at = (series: Series, year: number): number => {
  const value = series.get(year);
  if (value === undefined) throw new Error(`No observation for ${year}`);
  return value;
};
const yearsOf = (series: Series): number[] => [...series.keys()].sort((left, right) => left - right);
const changePct = (series: Series, from: number, to: number) => (at(series, to) / at(series, from) - 1) * 100;
const cagrPct = (series: Series, from: number, to: number) => ((at(series, to) / at(series, from)) ** (1 / (to - from)) - 1) * 100;

// One number format in both languages (DESIGN §11): comma thousands, decimal point.
// The Georgian prose used to quote "104,6" and "28 235" while every chart, table
// and KPI printed "104.6" and "28,235".
function num(value: number, decimals: number, _locale: Locale): string {
  const [integer, fraction] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function claimsFor(locale: Locale): Array<{ key: string; figures: string[] }> {
  const real = seriesOf("real_usd_2015");
  const growth = seriesOf("real_growth_percent");
  const nominalGel = seriesOf("nominal_gel");
  const nominalUsd = seriesOf("nominal_usd");
  const perCapitaGel = seriesOf("per_capita_gel");
  const perCapitaUsd = seriesOf("per_capita_usd");

  const realYears = yearsOf(real);
  const last = realYears.at(-1)!;
  const bn = (series: Series, year: number) => num(at(series, year) / 1e9, 1, locale);
  const pct = (value: number) => `${num(value, 1, locale)}%`;
  const whole = (series: Series, year: number) => num(at(series, year), 0, locale);

  const sovietYears = realYears.filter((year) => year <= 1991);
  const peakYear = sovietYears.reduce((best, year) => (at(real, year) > at(real, best) ? year : best), sovietYears[0]!);
  const exceedYear = realYears.find((year) => year > peakYear && at(real, year) > at(real, peakYear))!;
  const recentGrowthYears = yearsOf(growth).filter((year) => year >= 2000);
  const maxGrowthYear = recentGrowthYears.reduce((best, year) => (at(growth, year) > at(growth, best) ? year : best), recentGrowthYears[0]!);
  const contractionYears = recentGrowthYears.filter((year) => at(growth, year) < 0);
  const [, secondPeriod, lastPeriod] = REAL_GDP_SUMMARY_PERIODS;

  // The real table has one row per period; the growth table reuses rows 1 and 2.
  const periodClaims = REAL_GDP_SUMMARY_PERIODS.flatMap(([from, to], index) => [
    { key: `gdp.summary.total${index}`, figures: [pct(changePct(real, from, to))] },
    { key: `gdp.summary.annual${index}`, figures: [pct(cagrPct(real, from, to))] },
  ]);

  return [
    { key: "gdp.nominalSummary.recent", figures: [bn(nominalGel, last), bn(nominalUsd, last), pct(changePct(nominalGel, last - 1, last))] },
    { key: "gdp.nominalSummary.periods", figures: [pct(changePct(nominalGel, last - 5, last)), bn(nominalGel, last - 5), bn(nominalGel, last), pct(changePct(nominalGel, last - 10, last))] },
    { key: "gdp.nominalSummary.note", figures: [] },
    { key: "gdp.growthSummary.recent", figures: [pct(at(growth, last)), pct(at(growth, last - 1)), num(at(growth, last - 1) - at(growth, last), 1, locale)] },
    { key: "gdp.growthSummary.comparison", figures: [String(lastPeriod![1] - lastPeriod![0]), String(secondPeriod![1] - secondPeriod![0])] },
    { key: "gdp.growthSummary.context", figures: [pct(at(growth, maxGrowthYear)), ...contractionYears.map((year) => pct(at(growth, year)))] },
    { key: "gdp.growthSummary.note", figures: [] },
    { key: "gdp.per_capitaSummary.recent", figures: [whole(perCapitaGel, last), whole(perCapitaUsd, last), pct(changePct(perCapitaGel, last - 1, last)), pct(changePct(perCapitaUsd, last - 1, last))] },
    { key: "gdp.per_capitaSummary.periods", figures: [pct(changePct(perCapitaGel, last - 5, last)), whole(perCapitaGel, last - 5), whole(perCapitaGel, last), pct(changePct(perCapitaGel, last - 10, last)), pct(changePct(perCapitaUsd, last - 5, last)), pct(changePct(perCapitaUsd, last - 10, last))] },
    { key: "gdp.per_capitaSummary.note", figures: [] },
    { key: "gdp.summary.recent", figures: [bn(real, last), pct(changePct(real, last - 5, last)), pct(changePct(real, last - 10, last))] },
    ...periodClaims,
    { key: "gdp.summary.peak", figures: [bn(real, peakYear), bn(real, exceedYear - 1), bn(real, exceedYear), String(exceedYear - peakYear)] },
    { key: "gdp.summary.sovietGrowth", figures: [pct(cagrPct(real, sovietYears[0]!, 1990))] },
    { key: "gdp.summary.note", figures: [] },
    // Coverage sentences quote the first and last year of their own series. A
    // key may appear twice: the assertion loop checks each entry's figures, and
    // the completeness loop unions them per key.
    { key: "gdp.summary.intro", figures: ["2015"] }, // fixed-price basis, not an observation year
    { key: "gdp.nominalSummary.recent", figures: [String(last)] },
    { key: "gdp.per_capitaSummary.recent", figures: [String(last)] },
    { key: "gdp.growthSummary.recent", figures: [String(last), String(last - 1)] },
    ...["gdp.nominalSummary.periods", "gdp.per_capitaSummary.periods"].map((key) => ({
      key, figures: [String(last - 5), String(last), String(last - 10), String(last)],
    })),
    {
      key: "gdp.summary.recent",
      figures: [String(last), String(realYears[0]), String(last), String(last - 5), String(last), String(last - 10), String(last), String(last - 5)],
    },
    { key: "gdp.summary.sovietGrowth", figures: [String(sovietYears[0]), "1990", String(peakYear)] },
    { key: "gdp.nominalSummary.note", figures: ["2010"] }, // reviewed accounting-method boundary
    { key: "gdp.per_capitaSummary.note", figures: ["2010"] },
    { key: "gdp.nominalSummary.note", figures: [String(yearsOf(nominalGel)[0]), String(last)] },
    { key: "gdp.growthSummary.note", figures: [String(yearsOf(growth)[0]), String(last)] },
    { key: "gdp.per_capitaSummary.note", figures: [String(yearsOf(perCapitaGel)[0]), String(last)] },
    { key: "gdp.summary.peak", figures: [String(peakYear), String(exceedYear - 1), String(exceedYear)] },
    { key: "gdp.growthSummary.context", figures: [String(recentGrowthYears[0]), String(last), String(maxGrowthYear), ...contractionYears.map(String)] },
  ];
}

const figurePattern = /(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)%?/g;
const tokenPattern = { en: figurePattern, ka: figurePattern } as const;

function assertSummaryFigures(messages: Messages, locale: Locale): void {
  const claims = claimsFor(locale);

  for (const claim of claims) {
    const value = messages[claim.key];
    expect(value, claim.key).toBeTypeOf("string");
    const tokens: string[] = [...(value!.match(tokenPattern[locale]) ?? [])];
    let cursor = 0;
    for (const figure of claim.figures) {
      const index = tokens.indexOf(figure, cursor);
      expect(index, `${claim.key} should quote ${figure} after its preceding figures`).toBeGreaterThanOrEqual(cursor);
      cursor = index + 1;
    }
  }

  // Completeness: no unlisted number may hide in the reviewed copy.
  for (const key of Object.keys(messages).filter((key) => /^gdp\.(?:summary|nominalSummary|growthSummary|per_capitaSummary)\./.test(key))) {
    const allowed = new Set(claims.filter((claim) => claim.key === key).flatMap((claim) => claim.figures));
    const tokens = messages[key]!.match(tokenPattern[locale]) ?? [];
    for (const token of tokens) {
      expect(allowed.has(token), `${key} quotes an unchecked figure: ${token}`).toBe(true);
    }
  }

  const growth = seriesOf("real_growth_percent");
  const last = yearsOf(growth).at(-1)!;
  const latestGrowth = at(growth, last);
  const latestFigure = `${num(latestGrowth, 1, locale)}%`;
  const directionClaim =
    latestGrowth >= 0
      ? locale === "en"
        ? `grew by ${latestFigure}`
        : `${latestFigure}-ით გაიზარდა`
      : locale === "en"
        ? `contracted by ${latestFigure}`
        : `${latestFigure}-ით შემცირდა`;
  expect(messages["gdp.growthSummary.recent"], `latest growth wording should say ${directionClaim}`).toContain(directionClaim);
}

describe.each(["ka", "en"] as const)("GDP summary figures: %s", (locale) => {
  it("quotes only figures the canonical CSV reproduces", () => {
    assertSummaryFigures(messagesByLocale.get(locale)!, locale);
  });

  it("rejects swapped valid years and values", () => {
    const messages = messagesByLocale.get(locale)!;
    const original = messages["gdp.growthSummary.recent"]!;
    const [currentValue, previousValue] = ["7.5%", "9.7%"];
    const swappedValues = original
      .replace(currentValue, "__CURRENT__")
      .replace(previousValue, currentValue)
      .replace("__CURRENT__", previousValue);
    const swappedYears = original.replace("2025", "__CURRENT__").replace("2024", "2025").replace("__CURRENT__", "2024");

    expect(() => assertSummaryFigures({ ...messages, "gdp.growthSummary.recent": swappedValues }, locale)).toThrow();
    expect(() => assertSummaryFigures({ ...messages, "gdp.growthSummary.recent": swappedYears }, locale)).toThrow();
  });

  it("rejects wording that reverses the latest growth direction", () => {
    const messages = messagesByLocale.get(locale)!;
    const original = messages["gdp.growthSummary.recent"]!;
    const reversed = locale === "en" ? original.replace("grew", "contracted") : original.replace("გაიზარდა", "შემცირდა");

    expect(() => assertSummaryFigures({ ...messages, "gdp.growthSummary.recent": reversed }, locale)).toThrow();
  });

  it("states data facts that still hold", () => {
    const real = seriesOf("real_usd_2015");
    const growth = seriesOf("real_growth_percent");
    const realYears = yearsOf(real);
    const last = realYears.at(-1)!;

    // "the highest level in the displayed series"
    expect(at(real, last)).toBe(Math.max(...realYears.map((year) => at(real, year))));
    // "the economy contracted in only two years" since 2000
    expect(yearsOf(growth).filter((year) => year >= 2000 && at(growth, year) < 0)).toHaveLength(2);
    // "the starting year, 2020, was a year of economic contraction"
    expect(at(growth, last - 5)).toBeLessThan(0);
    // The 2025 Geostat series are preliminary, as the nominal and per-capita copy says.
    expect(facts.some((fact) => fact.seriesId === "nominal_gel" && fact.year === last && fact.status === "preliminary")).toBe(true);
  });
});
