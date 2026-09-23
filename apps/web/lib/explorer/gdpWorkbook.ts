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

export function gdpDisplay(state: GdpState, presentation: Presentation) {
  const t = (key: string) => message(presentation.messages, `gdp.${key}`);
  const growth = state.indicator === "growth",
    capita = state.indicator === "per_capita";
  const currency = state.indicator === "real" ? "usd" : state.currency;
  const unit = {
    divisor: capita ? 1 : 1e9,
    label: capita ? t(currency) : t("bn"),
    decimals: 1,
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
