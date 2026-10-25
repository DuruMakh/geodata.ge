import type { ClientMoneyBanksFact } from "../data/moneyBanks/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import type { ClientNationalGdpFact } from "./clientData";
import { MONEY_BANKS_LOAN_BREAKS, buildMoneyBanksModel, moneyBanksHasTotalRow, moneyBanksViewFacts, type MoneyBanksTopicId, type MoneyBanksState } from "./moneyBanks";
import { buildMoneyBanksAreaModel, moneyBanksAreaSlug, type MoneyBanksArea } from "./moneyBanksAreas";
import type { TopicState } from "./topicSeries";
import { SHEET_NAMES, neededSourceYears, sourcesForNeededYears, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const MILLION = 1_000_000;

type MoneyBanksWorkbookInput = {
  facts: readonly ClientMoneyBanksFact[]; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string;
  gdpFacts?: readonly ClientNationalGdpFact[]; gdpSources?: readonly WorkbookPublicSource[];
} & ({ section: MoneyBanksTopicId; state: MoneyBanksState } | { area: MoneyBanksArea; state: TopicState });

/**
 * A topic page's or a Loans by region area page's selection as a workbook. On % of GDP, `gdpFacts` are the national GDP
 * the shares divide by, and `gdpSources` (its Geostat files) join the NBG workbooks on the Sources sheet, as on the debt page.
 */
export function buildMoneyBanksWorkbookExportModel(input: MoneyBanksWorkbookInput, presentation: Presentation): WorkbookExportModel {
  const { labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `moneyBanks.${key}`);
  // An area page has one view, its amounts. Its all loans is its lari plus its foreign-currency loans, so it is a total row,
  // as M3 is on Money supply.
  const state: MoneyBanksState = "area" in input ? { ...input.state, view: "main" } : input.state;
  const model = "area" in input ? buildMoneyBanksAreaModel(input.area, input.facts, input.state) : buildMoneyBanksModel(input.section, input.facts, input.state, input.gdpFacts);
  const hasTotalRow = "area" in input || moneyBanksHasTotalRow(input.section);
  const stem = "area" in input ? `money-loans-region-${moneyBanksAreaSlug(input.area)}` : `money-${input.section}${state.view === "main" ? "" : `-${state.view}`}`;
  const pageTitle = input.title ?? t(`page.${"area" in input ? "regions" : input.section}.title`);
  const facts = moneyBanksViewFacts(state.view, input.facts, input.gdpFacts ?? []);
  const byCell = new Map(facts.map(f => [`${f.indicatorId}:${f.year}`, f]));
  const originals = sourcesForNeededYears(input.sources, neededSourceYears(model.selected, model.years, (series, year) => byCell.get(`${series.id}:${year}`)?.sourceId));
  const isAmount = model.unit === "gel";
  const isGdp = state.view === "gdp";
  const unitLabel = isGdp ? workbookMessage(locale, "workbook.percentGdp") : t(isAmount ? "unitMlnGel" : "unitPercent");
  const numberFormat = isAmount ? "#,##0.0" : "0.0";
  // Interest rates are the series shown to two decimals.
  const rowFormat = (decimals: number) => !isAmount && decimals === 2 ? "0.00" : undefined;
  const toExport = (value: number | null) => value === null ? null : isAmount ? value / MILLION : value;
  // On Who borrows and the area pages a year that opens a new basis (the register's loan breaks) says so after its status.
  const marksBreaks = "area" in input || input.section === "borrowers";
  const isBreak = (id: string, year: number) => marksBreaks && MONEY_BANKS_LOAN_BREAKS.some(entry => entry.year === year && entry.appliesTo.includes(id));
  const status = (id: string, year: number) => {
    const fact = byCell.get(`${id}:${year}`);
    if (!fact) return workbookMessage(locale, "workbook.unavailable");
    const text = t(`status.${fact.valueStatus}`);
    return isBreak(id, year) ? `${text} · ${t("status.break")}` : text;
  };
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  const view = state.view === "main" ? "" : ` · ${t(`tab.${state.view}`)}`;
  return {
    locale, filename: workbookFilename(`${stem}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${pageTitle}${view}`, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, toExport(series.valuesByYear[year])]));
        return {
          kind: series.reference && hasTotalRow ? "total" : "item", parentLabel: null, label: labels[series.id], change: null, valuesByYear: values,
          ...(rowFormat(series.decimals) ? { numberFormat: rowFormat(series.decimals) } : {}),
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("series"), isGdp ? workbookMessage(locale, "workbook.gdpHeader") : t(`amountHeader.${model.unit}`), workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labels[series.id], toExport(series.valuesByYear[year]), status(series.id, year)]),
      numericFormats: { 3: numberFormat },
      rowNumberFormats: Object.fromEntries(cells.flatMap(({ series }, index) => rowFormat(series.decimals) ? [[index, rowFormat(series.decimals)!]] : [])),
    },
    sources: withAbsoluteUrls([...originals, ...(isGdp ? input.gdpSources ?? [] : [])], input.siteOrigin),
  };
}
