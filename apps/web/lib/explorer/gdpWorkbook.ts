import type { ClientGdpObservation, SourceIdRanges } from "../servedRows";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { buildGdpOverviewModel, type GdpState } from "./gdpOverview";
import {
  SHEET_NAMES,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  withAbsoluteUrls,
  workbookFilename,
} from "./workbookModel";

// The World Bank indicator-metadata file is its own manifest row and keeps its
// own id; it documents both World Bank series, so a selection resting on either
// one cites it too.
const DOCUMENTED_BY: Readonly<Record<string, readonly string[]>> = {
  "source.wb_gdp_metadata": ["source.wb_gdp_real_usd_2015", "source.wb_gdp_real_growth_percent"],
};

/** The page's sources a selection rests on: those its facts cite, plus the files that document them. */
export function gdpSelectionSources<T extends { sourceId: string }>(sources: readonly T[], sourceIds: readonly string[]): T[] {
  return sources.filter((source) =>
    sourceIds.includes(source.sourceId) || (DOCUMENTED_BY[source.sourceId] ?? []).some((id) => sourceIds.includes(id)));
}

export function gdpDisplay(state: GdpState, presentation: Presentation) {
  const t = (key: string) => message(presentation.messages, `gdp.${key}`);
  const growth = state.indicator === "growth",
    capita = state.indicator === "per_capita";
  const currency = state.indicator === "real" ? "usd" : state.currency;
  const unit = {
    divisor: capita ? 1 : 1e9,
    label: capita ? t(currency) : t("bn"),
    // Per person in whole units, as the latest-value line prints it (U10-14).
    decimals: capita ? 0 : 1,
  };
  const fullUnitLabel = growth
    ? t("percent")
    : state.indicator === "real"
      ? `${t("bn")} · ${t("constant")}`
      : capita
        ? `${t(currency)} ${t("perPerson")} · ${t("current")}`
        : `${t("bn")} ${t(currency)} · ${t("current")}`;
  const baseUnit = growth
    ? t("percent")
    : state.indicator === "real"
      ? t("constant")
      : capita
        ? `${t(currency)} ${t("perPerson")}`
        : t(currency);
  return { label: t(state.indicator), unit, fullUnitLabel, baseUnit, growth };
}
export function buildGdpWorkbookExportModel(
  facts: ClientGdpObservation[],
  state: GdpState,
  presentation: Presentation,
  sources: WorkbookPublicSource[],
  siteOrigin: string,
  sourceIdRanges: SourceIdRanges,
): WorkbookExportModel {
  const m = buildGdpOverviewModel(facts, state, sourceIdRanges),
    d = gdpDisplay(state, presentation);
  const t = (key: string) => message(presentation.messages, `gdp.${key}`);
  const activeSources = sources
    .map((s) => ({ ...s, years: s.years.filter((y) => m.years.includes(y)) }))
    .filter((s) => s.years.length);
  return {
    locale: presentation.locale,
    filename: workbookFilename(
      `gdp-${state.indicator}-${state.indicator === "real" ? "usd" : state.indicator === "growth" ? "percent" : state.currency}-${m.range.start}-${m.range.end}`,
      presentation.locale,
    ),
    sheetNames: SHEET_NAMES[presentation.locale],
    readable: {
      title: d.label,
      subtitle: `${m.range.start}–${m.range.end} · ${d.fullUnitLabel}${m.preliminaryYears.length ? ` · ${t("preliminary")}: ${m.preliminaryYears.join(", ")}` : ""}`,
      unitLabel: d.fullUnitLabel,
      showChangeColumn: false,
      years: m.years,
      rows: [
        {
          kind: "item",
          parentLabel: null,
          label: d.label,
          change: null,
          valuesByYear: Object.fromEntries(
            m.points.map((p) => [
              p.year,
              d.growth ? p.value : p.value / d.unit.divisor,
            ]),
          ),
          basisByYear: Object.fromEntries(
            m.points.map((p) => [p.year, p.status]),
          ),
        },
      ],
    },
    analysis: {
      headers: [t("year"), `${t("value")} (${d.baseUnit})`, t("status")],
      rows: m.points.map((p) => [p.year, p.value, t(p.status)]),
      numericFormats: { 2: d.growth ? "0.0%" : "#,##0.00" },
    },
    sources: withAbsoluteUrls(activeSources, siteOrigin),
  };
}
