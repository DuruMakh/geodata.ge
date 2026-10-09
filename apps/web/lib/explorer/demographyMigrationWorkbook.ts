import { SOURCE_ID } from "../data/demography/series";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import type { ClientMigrationFact } from "../servedRows";
import { buildMigrationModel, type MigrationDirection, type MigrationGroup, type MigrationState } from "./demographyMigration";
import {
  SHEET_NAMES,
  withAbsoluteUrls,
  workbookFilename,
  type WorkbookExportModel,
  type WorkbookPublicSource,
  type WorkbookReadableRow,
} from "./workbookModel";

const SEX_KEYS = { total: "sexTotal", male: "sexMale", female: "sexFemale" } as const;
const DIRECTION_KEYS = { arrivals: "dirArrivals", departures: "dirDepartures", net: "dirNet" } as const;

export function buildMigrationWorkbookExportModel(
  input: {
    facts: readonly ClientMigrationFact[];
    state: MigrationState;
    sources: readonly (WorkbookPublicSource & { sourceId: string })[];
    siteOrigin: string;
  },
  presentation: Presentation,
): WorkbookExportModel {
  const { locale, messages } = presentation;
  const t = (key: string) => message(messages, `demography.${key}`);
  const model = buildMigrationModel(input.facts, input.state);
  const groupLabel = (group: MigrationGroup) => t(`group.${group}`);
  const published = (values: Record<number, number | null>) =>
    Object.fromEntries(model.years.map((year) => [year, values[year] === null || values[year] === undefined ? null : ("published" as const)]));
  const row = (kind: WorkbookReadableRow["kind"], parentLabel: string | null, label: string, values: Record<number, number | null>): WorkbookReadableRow => ({
    kind, parentLabel, label, change: null, valuesByYear: Object.fromEntries(model.years.map((year) => [year, values[year] ?? null])), basisByYear: published(values),
  });
  const block = (direction: Exclude<MigrationDirection, "net">) => {
    const heading = t(DIRECTION_KEYS[direction]);
    return [
      row("group", null, heading, model.totals[direction]),
      ...model.selectedIds.map((group) => row("item", heading, groupLabel(group), model.byDirection[direction][group])),
    ];
  };
  const rows = model.selectedIds.length
    ? [...block("arrivals"), ...block("departures"), row("total", null, t(model.allSelected ? "netLabel" : "netSelectedLabel"), model.totals.net)]
    : [];
  const originals = input.sources
    .filter((source) => model.selectedIds.length > 0 && (source.sourceId === SOURCE_ID.migrationCitizenship || source.sourceId === SOURCE_ID.netMigration))
    .map(({ sourceId: _sourceId, ...source }) => ({ ...source, years: source.years.filter((year) => model.years.includes(year)) }))
    .filter((source) => source.years.length > 0);
  const unitLabel = t("personsHeader");
  return {
    locale,
    filename: workbookFilename(`demography-migration-${model.range.start}-${model.range.end}`, locale),
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t("migrationWorkbookTitle"),
      subtitle: `${model.range.start}–${model.range.end} · ${t(SEX_KEYS[input.state.sex])} · ${unitLabel} · ${t("migrationGroupsNote")}`,
      unitLabel,
      amountDecimals: 0,
      showChangeColumn: false,
      years: model.years,
      // Net migration is signed; its sign is neither good nor bad, so it is not shown in red.
      numberFormat: "#,##0;−#,##0",
      // The subtitle carries the computed group's definition, which a short range would otherwise cut off.
      fitSubtitle: true,
      rows,
    },
    analysis: {
      headers: [workbookMessage(locale, "workbook.year"), t("directionHeader"), t("citizenshipHeader"), t("sexHeader"), unitLabel],
      rows: model.years.flatMap((year) =>
        (["arrivals", "departures"] as const).flatMap((direction) =>
          model.selectedIds.map((group) => [year, t(DIRECTION_KEYS[direction]), groupLabel(group), t(SEX_KEYS[input.state.sex]), model.byDirection[direction][group][year] ?? null]),
        ),
      ),
      numericFormats: { 5: "#,##0" },
    },
    sources: withAbsoluteUrls(originals, input.siteOrigin),
  };
}
