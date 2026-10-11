import type { ClientMoneyBanksFact } from "../data/moneyBanks/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { buildMoneyBanksModel, type MoneyBanksSectionId, type MoneyBanksState } from "./moneyBanks";
import { SHEET_NAMES, mergeSourcesByHref, withAbsoluteUrls, workbookFilename, type WorkbookExportModel, type WorkbookPublicSource } from "./workbookModel";

const MILLION = 1_000_000;

export function buildMoneyBanksWorkbookExportModel(input: { section: MoneyBanksSectionId; facts: readonly ClientMoneyBanksFact[]; state: MoneyBanksState; labels: Readonly<Record<string, string>>; sources: readonly (WorkbookPublicSource & { sourceId: string })[]; siteOrigin: string; title?: string }, presentation: Presentation): WorkbookExportModel {
  const { section, facts, state, labels } = input, { locale, messages } = presentation;
  const t = (key: string) => message(messages, `moneyBanks.${key}`);
  const model = buildMoneyBanksModel(section, facts, state);
  const byCell = new Map(facts.map(f => [`${f.indicatorId}:${f.year}`, f]));
  const neededYears = new Map<string, Set<number>>();
  for (const series of model.selected) for (const year of model.years) {
    const fact = byCell.get(`${series.id}:${year}`);
    if (fact) neededYears.set(fact.sourceId, (neededYears.get(fact.sourceId) ?? new Set<number>()).add(year));
  }
  const originals = mergeSourcesByHref(input.sources, source => source.years.filter(year => neededYears.get(source.sourceId)?.has(year)));
  const isAmount = model.unit === "gel";
  const unitLabel = t(isAmount ? "unitMlnGel" : "unitPercent");
  const numberFormat = isAmount ? "#,##0.0" : "0.0";
  // The National Bank rate is the one series shown to two decimals.
  const rowFormat = (decimals: number) => !isAmount && decimals === 2 ? "0.00" : undefined;
  const toExport = (value: number | null) => value === null ? null : isAmount ? value / MILLION : value;
  const status = (id: string, year: number) => {
    const fact = byCell.get(`${id}:${year}`);
    return fact ? t(`status.${fact.valueStatus}`) : workbookMessage(locale, "workbook.unavailable");
  };
  const cells = model.years.flatMap(year => model.selected.map(series => ({ year, series })));
  const view = state.view === "main" ? "" : ` · ${t(`tab.${state.view}`)}`;
  return {
    locale, filename: workbookFilename(`money-${section}${state.view === "main" ? "" : `-${state.view}`}-${model.range.start}-${model.range.end}`, locale), sheetNames: SHEET_NAMES[locale],
    readable: {
      title: `${input.title ?? t(`page.${section}.title`)}${view}`, subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel, amountDecimals: 1, years: model.years, showChangeColumn: false, numberFormat,
      rows: model.selected.map(series => {
        const values = Object.fromEntries(model.years.map(year => [year, toExport(series.valuesByYear[year])]));
        return {
          kind: series.reference ? "total" : "item", parentLabel: null, label: labels[series.id], change: null, valuesByYear: values,
          ...(rowFormat(series.decimals) ? { numberFormat: rowFormat(series.decimals) } : {}),
          basisByYear: Object.fromEntries(model.years.map(year => [year, values[year] === null ? null : "actual"])),
        };
      }),
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("series"), t(`amountHeader.${model.unit}`), workbookMessage(locale, "workbook.status")],
      rows: cells.map(({ year, series }) => [year, labels[series.id], toExport(series.valuesByYear[year]), status(series.id, year)]),
      numericFormats: { 3: numberFormat },
      rowNumberFormats: Object.fromEntries(cells.flatMap(({ series }, index) => rowFormat(series.decimals) ? [[index, rowFormat(series.decimals)!]] : [])),
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
