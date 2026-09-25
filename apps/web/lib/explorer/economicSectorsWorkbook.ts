import type {
  SectorDefinition,
} from "../data/economicSectors/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import { unitFor, unitsFor } from "./format";
import {
  buildEconomicSectorsModel,
  rankSectorDefinitions,
  SECTOR_GDP,
  type SectorState,
} from "./economicSectors";
import {
  SHEET_NAMES,
  mergeSourcesByHref,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  withAbsoluteUrls,
  workbookFilename,
} from "./workbookModel";
import type { ClientSectorObservation } from "../servedRows";

export function buildEconomicSectorsWorkbookExportModel(
  facts: ClientSectorObservation[],
  registry: SectorDefinition[],
  state: SectorState,
  presentation: Presentation,
  sources: (WorkbookPublicSource & { sourceId: string })[],
  siteOrigin: string,
  sourceIdByMeasure: Record<string, string>,
): WorkbookExportModel {
  const model = buildEconomicSectorsModel(facts, registry, state, sourceIdByMeasure);
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `sectors.${key}`);
  const w = (key: Parameters<typeof workbookMessage>[1]) =>
    workbookMessage(locale, key);
  const percent = state.measure !== "nominal";
  const share = state.measure === "share_of_gdp";
  const label = t(share ? "shareOfGdp" : percent ? "realGrowth" : "nominal");
  const unitLabel = percent ? label : message(messages, "format.bnGel");
  const definitions = rankSectorDefinitions(registry, model.endValues)
    .filter((r) => state.selectedIds.includes(r.id));
  const name = (r: SectorDefinition) =>
    locale === "en" ? r.labelEn : r.labelKa;
  const active = facts.filter(
    (f) =>
      f.measure === state.measure &&
      state.selectedIds.includes(f.seriesId) &&
      model.years.includes(f.year),
  );
  const byCell = new Map(active.map((f) => [`${f.seriesId}:${f.year}`, f]));
  const nominal = new Map(
    facts
      .filter((f) => f.measure === "nominal")
      .map((f) => [`${f.seriesId}:${f.year}`, f]),
  );
  // Every row of a measure comes from one publication, so the years the
  // workbook must cite are simply the active years of that source. The old
  // year_over_year branch went with the column: no fact carries that
  // calculation — every real-growth row is index_to_growth.
  const neededYears = new Map<string, Set<number>>();
  for (const f of active) {
    const sourceId = sourceIdByMeasure[f.measure];
    if (!sourceId) continue;
    const years = neededYears.get(sourceId) ?? new Set<number>();
    years.add(f.year);
    neededYears.set(sourceId, years);
  }
  const originals = mergeSourcesByHref(sources, (source) =>
    source.years.filter((y) => neededYears.get(source.sourceId)?.has(y)),
  ).map(({ sourceId: _sourceId, ...source }) => source);
  const preliminaryYears = [
    ...new Set(
      active.filter((f) => f.status === "preliminary").map((f) => f.year),
    ),
  ].sort((a, b) => a - b);
  return {
    locale,
    filename: workbookFilename(`economic-sectors-${state.measure}-${model.range.start}-${model.range.end}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: message(messages, "sectors.workbookTitle", { measure: label }),
      subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}${preliminaryYears.length ? ` · ${t("preliminary")}: ${preliminaryYears.join(", ")}` : ""}`,
      unitLabel,
      amountDecimals: unitFor(facts.filter(f => f.measure === "nominal").map(f => f.value), unitsFor(locale).bn).decimals,
      years: model.years,
      showChangeColumn: false,
      rows: definitions.map((r) => ({
        kind: r.id === SECTOR_GDP ? "total" : "item",
        parentLabel: null,
        label: name(r),
        change: null,
        valuesByYear: Object.fromEntries(
          model.years.map((year) => {
            const f = byCell.get(`${r.id}:${year}`);
            return [year, f ? f.value / (percent ? 100 : 1e9) : null];
          }),
        ),
        basisByYear: Object.fromEntries(
          model.years.map((year) => [
            year,
            byCell.get(`${r.id}:${year}`)?.status ?? null,
          ]),
        ),
      })),
    },
    analysis: {
      headers: [
        w("workbook.year"),
        t("sector"),
        percent && !share ? label : w("workbook.amountGel"),
        ...(share ? [label] : []),
        w("workbook.status"),
      ],
      rows: model.years.flatMap((year) =>
        definitions.map((r) => {
          const f = byCell.get(`${r.id}:${year}`);
          const value = f ? (percent ? f.value / 100 : f.value) : null;
          return [
            year,
            name(r),
            share ? (nominal.get(`${r.id}:${year}`)?.value ?? null) : value,
            ...(share ? [value] : []),
            w(
              f
                ? f.status === "preliminary"
                  ? "workbook.preliminary"
                  : "workbook.published"
                : "workbook.unavailable",
            ),
          ];
        }),
      ),
      numericFormats: share
        ? { 3: "#,##0.00", 4: "0.0%" }
        : { 3: percent ? "0.0%" : "#,##0.00" },
    },
    sources: withAbsoluteUrls(originals, siteOrigin),
  };
}
