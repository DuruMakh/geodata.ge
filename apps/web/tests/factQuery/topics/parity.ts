// apps/web/tests/factQuery/topics/parity.ts
//
// The page-parity check every topic adapter's test runs (spec §7.1): the cells a dataset serves equal the cells the page's
// own workbook models print, the models its Excel download and crawl tables are built from. Only `match` is
// family-specific: it names the served entity and series a workbook row shows.
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import { readableRowLabel, type WorkbookExportModel, type WorkbookReadableRow } from "../../../lib/explorer/workbookModel";

/** The served cell a workbook row shows. Its value must be the number the page's model carries: nothing is rescaled. */
export type ParityTarget = { entityId: string; seriesId: string };

const RELATIVE_TOLERANCE = 1e-9;
const key = (entityId: string, seriesId: string) => `${entityId}\u0000${seriesId}`;
const near = (served: number, printed: number) => Math.abs(served - printed) <= RELATIVE_TOLERANCE * Math.max(Math.abs(served), Math.abs(printed));

/** A percent-formatted cell (`0.0%`) stores the fraction Excel shows ×100: the shown number (a rate of 24.6%) is compared. */
const shown = (row: WorkbookReadableRow, model: WorkbookExportModel, printed: number | null) =>
  printed !== null && (row.numberFormat ?? model.readable.numberFormat ?? "").endsWith("%") ? printed * 100 : printed;

/** A label-only row: a heading line that prints no figure (kind "group", every year empty). It names nothing to serve. */
const labelOnly = (row: WorkbookReadableRow) => row.kind === "group" && Object.values(row.valuesByYear).every((value) => value === null);

/**
 * Fails, listing every disagreement, unless:
 * - at least one row matched (no models, or none that match, is a failure, never a pass);
 * - every readable row of every model (label-only heading rows aside) maps through `match` to a served entity and series;
 * - in each of the row's years a printed value equals the served value (relative tolerance 1e-9; a percent-formatted cell
 *   as Excel shows it), and an empty cell is a missing one (a fact with `value: null`, or no fact);
 * - the dataset serves no year of a matched entity and series that no row prints (the page's years, nothing more);
 * - every entity in `expectedEntityIds` (by default every entity the dataset serves) is covered by some row, and every
 *   series the dataset serves for it has a row in some model.
 * A test that builds the models of only some places names them in `expectedEntityIds`.
 */
export function expectWorkbookParity(
  build: TopicDatasetBuild,
  models: readonly WorkbookExportModel[],
  match: (row: WorkbookReadableRow, model: WorkbookExportModel) => ParityTarget | null,
  expectedEntityIds: readonly string[] = build.entities.map((entity) => entity.entityId),
): void {
  const served = new Map<string, Map<number, TopicFact>>();
  for (const fact of build.facts) {
    const cells = served.get(key(fact.entityId, fact.seriesId)) ?? new Map<number, TopicFact>();
    cells.set(fact.year, fact);
    served.set(key(fact.entityId, fact.seriesId), cells);
  }
  const problems: string[] = [];
  const printedYears = new Map<string, Set<number>>();
  const covered = new Set<string>();
  for (const model of models) {
    for (const row of model.readable.rows) {
      if (labelOnly(row)) continue;
      const where = `${model.filename} "${readableRowLabel(row)}"`;
      const target = match(row, model);
      if (!target) {
        problems.push(`${where}: no served series matches the row`);
        continue;
      }
      const { entityId, seriesId } = target;
      covered.add(entityId);
      const cells = served.get(key(entityId, seriesId));
      if (!cells) {
        problems.push(`${where}: ${entityId} ${seriesId} is not served`);
        continue;
      }
      const years = printedYears.get(key(entityId, seriesId)) ?? new Set<number>();
      printedYears.set(key(entityId, seriesId), years);
      for (const [yearText, stored] of Object.entries(row.valuesByYear)) {
        const year = Number(yearText), printed = shown(row, model, stored);
        years.add(year);
        const value = cells.get(year)?.value ?? null;
        if (printed === null && value !== null) problems.push(`${where} ${year}: the page prints nothing, ${entityId} ${seriesId} serves ${value}`);
        else if (printed !== null && value === null) problems.push(`${where} ${year}: the page prints ${printed}, ${entityId} ${seriesId} serves nothing`);
        else if (printed !== null && value !== null && !near(value, printed)) problems.push(`${where} ${year}: the page prints ${printed}, ${entityId} ${seriesId} serves ${value}`);
      }
    }
  }
  if (!covered.size) problems.push("no workbook row matched a served series");
  const expected = new Set(expectedEntityIds);
  for (const entityId of expected) if (!covered.has(entityId)) problems.push(`${entityId}: no workbook row covers the entity`);
  for (const [cellKey, cells] of served) {
    const [entityId, seriesId] = cellKey.split("\u0000") as [string, string];
    if (!expected.has(entityId) && !covered.has(entityId)) continue;
    const years = printedYears.get(cellKey);
    if (!years) {
      problems.push(`${entityId} ${seriesId}: served, but no workbook row prints it`);
      continue;
    }
    for (const year of cells.keys()) if (!years.has(year)) problems.push(`${entityId} ${seriesId} ${year}: served, but no workbook row prints the year`);
  }
  if (problems.length) {
    const shown = problems.slice(0, 40);
    throw new Error(`${build.page.datasetId}: ${problems.length} served cell(s) disagree with the page's workbook models\n${shown.join("\n")}${problems.length > shown.length ? `\n… and ${problems.length - shown.length} more` : ""}`);
  }
}
