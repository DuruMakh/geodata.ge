import type { SectorDefinition } from "../data/economicSectors/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { workbookMessage } from "../i18n/workbook";
import {
  buildRegionalEconomyModel,
  rankRegionalEconomyDefinitions,
  regionalEconomyDefinitions,
  type RegionalEconomyState,
} from "./regionalEconomies";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import {
  SHEET_NAMES,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  withAbsoluteUrls,
  workbookFilename,
} from "./workbookModel";
import type { ClientRegionalEconomyObservation } from "../servedRows";

type RegionExportIdentity = {
  id: string;
  slug: string;
  labelKa: string;
  labelEn: string;
};

export function buildRegionalEconomyWorkbookExportModel(
  facts: ClientRegionalEconomyObservation[],
  registry: SectorDefinition[],
  state: RegionalEconomyState,
  region: RegionExportIdentity,
  presentation: Presentation,
  sources: (WorkbookPublicSource & { sourceId: string })[],
  siteOrigin: string,
): WorkbookExportModel {
  const model = buildRegionalEconomyModel(facts, registry, state);
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `regionalEconomies.${key}`);
  const w = (key: Parameters<typeof workbookMessage>[1]) => workbookMessage(locale, key);
  const share = state.measure === "share_of_region_gdp";
  const measureLabel = t(share ? "shareOfRegionGdp" : "nominal");
  const unitLabel = share ? w("workbook.percentShare") : message(messages, "format.bnGel");
  const definitions = rankRegionalEconomyDefinitions(regionalEconomyDefinitions(registry), model.endValues)
    .filter((definition) => state.selectedIds.includes(definition.id));
  const label = (definition: SectorDefinition) => locale === "en" ? definition.labelEn : definition.labelKa;
  const active = facts.filter((fact) =>
    fact.measure === state.measure && state.selectedIds.includes(fact.seriesId) && model.years.includes(fact.year));
  const byCell = new Map(active.map((fact) => [`${fact.seriesId}:${fact.year}`, fact]));
  const nominal = new Map(
    facts.filter((fact) => fact.measure === "nominal").map((fact) => [`${fact.seriesId}:${fact.year}`, fact]),
  );
  const selectedIds = new Set(definitions.map((definition) => definition.id));
  const neededSourceIds = new Set<string>();
  if (selectedIds.has(REGIONAL_GDP_TOTAL)) neededSourceIds.add("source.geostat_regional_gdp");
  if ([...selectedIds].some((id) => id !== REGIONAL_GDP_TOTAL)) neededSourceIds.add("source.geostat_regional_gdp_by_activity");
  if (share && selectedIds.size > 0) neededSourceIds.add("source.geostat_regional_gdp");
  const originals = sources
    .filter((source) => neededSourceIds.has(source.sourceId))
    .map((source) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  const regionLabel = locale === "en" ? region.labelEn : region.labelKa;
  return {
    locale,
    filename: workbookFilename(`regional-economy-${region.slug}-${state.measure}-${model.range.start}-${model.range.end}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: message(messages, "regionalEconomies.workbookTitle", { measure: measureLabel, region: regionLabel }),
      subtitle: `${model.range.start}–${model.range.end} · ${unitLabel}`,
      unitLabel,
      amountDecimals: 2,
      showChangeColumn: false,
      years: model.years,
      rows: definitions.map((definition) => ({
        kind: definition.id === REGIONAL_GDP_TOTAL ? "total" : "item",
        parentLabel: null,
        label: label(definition),
        change: null,
        valuesByYear: Object.fromEntries(model.years.map((year) => {
          const fact = byCell.get(`${definition.id}:${year}`);
          return [year, fact ? fact.value / (share ? 100 : 1_000_000_000) : null];
        })),
        basisByYear: Object.fromEntries(model.years.map((year) => [
          year,
          byCell.has(`${definition.id}:${year}`) ? "published" : null,
        ])),
      })),
    },
    analysis: {
      headers: [
        t("region"),
        w("workbook.year"),
        t("sector"),
        w("workbook.amountGel"),
        ...(share ? [`${measureLabel} (%)`] : []),
        w("workbook.status"),
      ],
      rows: model.years.flatMap((year) => definitions.map((definition) => {
        const fact = byCell.get(`${definition.id}:${year}`);
        const amount = nominal.get(`${definition.id}:${year}`)?.value ?? null;
        return [
          regionLabel,
          year,
          label(definition),
          amount,
          ...(share ? [fact ? fact.value / 100 : null] : []),
          w(fact ? "workbook.published" : "workbook.unavailable"),
        ];
      })),
      numericFormats: share ? { 4: "#,##0.00", 5: "0.0%" } : { 4: "#,##0.00" },
    },
    sources: withAbsoluteUrls(originals.map(({ sourceId: _sourceId, ...source }) => source), siteOrigin),
  };
}
