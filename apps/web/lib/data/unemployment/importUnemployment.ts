import { readFileSync } from "node:fs";
import path from "node:path";
import { readCsvRecords, type CsvRecord } from "../csv";
import { assertSameServedRows } from "../servedDataParity";
import { validateUnemploymentFacts, assertCompleteUnemploymentCoverage } from "./validation";
import { unemploymentObservationKey, type UnemploymentObservation, type UnemploymentGroupDefinition } from "./types";

export const UNEMPLOYMENT_GROUPS: UnemploymentGroupDefinition[] = JSON.parse(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/taxonomy/unemployment-groups.json"), "utf8"));
export function unemploymentObservationFromCsv(row: CsvRecord, lastReviewedAt: string): UnemploymentObservation {
  return {
    year: Number(row.year), frequency: row.frequency as UnemploymentObservation["frequency"], dimension: row.dimension as UnemploymentObservation["dimension"], groupId: row.group_id, groupLabelEn: row.group_label_en,
    sex: (row.sex || (row.dimension === "sex" ? row.group_id : "total")) as UnemploymentObservation["sex"], indicatorId: row.indicator_id as UnemploymentObservation["indicatorId"], unit: row.unit as UnemploymentObservation["unit"],
    value: row.value, publishedValue: row.published_value, basis: row.basis as UnemploymentObservation["basis"], valueStatus: row.value_status as UnemploymentObservation["valueStatus"], methodologyEpoch: row.methodology_epoch as UnemploymentObservation["methodologyEpoch"], role: row.role as UnemploymentObservation["role"],
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceGroupLabel: row.source_group_label, sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, lastReviewedAt,
  };
}
export function assertUnemploymentParity(csv: UnemploymentObservation[], mirror: UnemploymentObservation[]): void {
  validateUnemploymentFacts(csv); validateUnemploymentFacts(mirror);
  assertCompleteUnemploymentCoverage(csv); assertCompleteUnemploymentCoverage(mirror);
  assertSameServedRows("Unemployment", csv, mirror, unemploymentObservationKey);
}
export async function loadUnemploymentFacts(): Promise<UnemploymentObservation[]> {
  const manifest = JSON.parse(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../docs/Raw Data/Unemployment/geostat-labour-force-annual/source-manifest.json"), "utf8")) as { source_id: string; retrieved_at: string }[];
  const dates = new Map(manifest.map(source => [source.source_id, source.retrieved_at]));
  const rows = (await Promise.all(["unemployment-annual.csv", "unemployment-education-annual.csv", "unemployment-long-term-annual.csv"].map(name => readCsvRecords(`../../data/imports/${name}`)))).flat();
  const facts = rows.map(row => unemploymentObservationFromCsv(row, dates.get(row.source_id)!));
  validateUnemploymentFacts(facts); assertCompleteUnemploymentCoverage(facts);
  if (facts.some(f => !UNEMPLOYMENT_GROUPS.some(group => group.id === f.groupId && (group.labelEn === f.groupLabelEn || (f.dimension === "long_term" && f.groupId === "georgia" && f.groupLabelEn === "Total"))))) throw new Error("Unreviewed unemployment group label");
  return facts;
}
