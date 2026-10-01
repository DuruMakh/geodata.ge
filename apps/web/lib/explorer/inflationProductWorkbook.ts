import { makePeriod, periodFromKey, periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { periodLabel } from "./inflationLabels";
import { monthlyWorkbookSources, pickLocaleEditions, type InflationWorkbookSource } from "./inflationWorkbook";
import { productAnnual, productAnnualIndex, productCumulative, rankProducts, type ProductIndex } from "./inflationProducts";
import type { ProductState } from "./inflationProductState";
import { SHEET_NAMES, type WorkbookExportModel, type WorkbookReadableRow, workbookFilename } from "./workbookModel";

const ANNUAL_SOURCE = "source.geostat_product_yoy";
const MONTHLY_SOURCE = "source.geostat_product_mom";

export function buildInflationProductWorkbookExportModel(input: {
  index: ProductIndex;
  state: ProductState;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, state, presentation, sources, siteOrigin } = input;
  const { locale, messages } = presentation;
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `inflation.${key}`, values);
  const end = Math.min(makePeriod(state.range.endYear, 12), index.latestPeriod);
  const latestLabel = periodLabel(messages, index.latestPeriod, "long");
  const endLabel = periodLabel(messages, end, "long");
  const years = Array.from({ length: state.range.endYear - state.range.startYear + 1 }, (_, offset) => state.range.startYear + offset);
  const sourceYears = [...new Set([...years, periodYear(index.latestPeriod)])].sort((a, b) => a - b);
  const sortedIds = rankProducts(index);

  const rows: WorkbookReadableRow[] = sortedIds.map((id) => {
    const product = index.productById.get(id)!;
    const name = locale === "ka" ? product.labelKa : product.labelEn;
    const otherName = locale === "ka" ? product.labelEn : product.labelKa;
    const annual = productAnnual(index, id, index.latestPeriod);
    const cumulative = productCumulative(index, id, state.range.startYear, end);
    const missing = cumulative.reason === "late_start" ? t("productsLateStart", { period: product.firstPeriod }) :
      cumulative.reason === "missing_month" && cumulative.missingPeriod !== null ?
        t("productsMissingMonth", { period: periodKey(cumulative.missingPeriod) }) : null;
    return {
      kind: "item", parentLabel: null, label: `${name} / ${otherName}${missing ? ` — ${missing}` : ""}`,
      valuesByYear: { 1: annual === null ? null : annual / 100, 2: cumulative.value === null ? null : cumulative.value / 100 },
      basisByYear: { 1: annual === null ? "not_available" : "published", 2: cumulative.value === null ? "not_available" : "published" },
      change: null,
    };
  });

  const analysisRows: WorkbookExportModel["analysis"]["rows"] = [];
  for (const id of state.selected) {
    const product = index.productById.get(id);
    if (!product) continue;
    const name = locale === "ka" ? product.labelKa : product.labelEn;
    const firstPeriod = periodFromKey(product.firstPeriod);
    const cumulativeResult = productCumulative(index, id, state.range.startYear, end);
    const cumulativeComplete = cumulativeResult.value !== null;
    const cumulativeIssue = cumulativeResult.reason === "late_start" ? t("productsLateStart", { period: product.firstPeriod }) :
      cumulativeResult.reason === "missing_month" && cumulativeResult.missingPeriod !== null ?
        t("productsMissingMonth", { period: periodKey(cumulativeResult.missingPeriod) }) : t("productsUnavailable");
    for (let period = makePeriod(state.range.startYear, 1); period <= end; period += 1) {
      const annualIndex = productAnnualIndex(index, id, period);
      const annual = productAnnual(index, id, period);
      const cumulative = cumulativeComplete ? productCumulative(index, id, state.range.startYear, period).value : null;
      analysisRows.push([
        periodYear(period), periodMonth(period), name, annualIndex,
        annual === null ? null : annual / 100,
        cumulative === null ? null : cumulative / 100,
        annual === null ? period < firstPeriod ? t("productsLateStart", { period: product.firstPeriod }) : t("productsNotPublished") : t("published"),
        cumulative === null ? cumulativeIssue : t("productsDerived"),
      ]);
    }
  }

  const chosen = pickLocaleEditions(sources, [ANNUAL_SOURCE, MONTHLY_SOURCE], locale);
  if (chosen.length !== 2) throw new Error("Product workbook lacks one or more reviewed Geostat source editions");

  return {
    locale,
    filename: workbookFilename(`inflation-products-${state.range.startYear}-${periodKey(end)}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t("productsWorkbookTitle"),
      subtitle: t("productsWorkbookSubtitle", { latest: latestLabel, start: state.range.startYear, end: endLabel }),
      unitLabel: t("productsWorkbookUnit"),
      numberFormat: "0.0%",
      showChangeColumn: false,
      years: [1, 2],
      headerLabels: {
        category: t("productsProductColumn"),
        columns: [t("productsAnnualColumn", { period: latestLabel }), t("productsCumulativeColumn", { start: state.range.startYear, end: endLabel })],
      },
      rows,
    },
    analysis: {
      headers: [t("year"), t("month"), t("productsProductColumn"), t("productsAnnualIndexColumn"),
        t("productsAnnualDataColumn"), t("productsCumulativeDataColumn"), t("productsAnnualStatus"), t("productsCumulativeStatus")],
      rows: analysisRows,
      numericFormats: { 4: "0.0000", 5: "0.0%", 6: "0.0%" },
    },
    sources: monthlyWorkbookSources(chosen, sourceYears, siteOrigin),
    sourceYears,
  };
}
