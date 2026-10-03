import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { CitizenshipMap } from "./citizenship";
import { EXTENSION_REVIEWED_AT, SERIES } from "./series";
import { DemographyStopError } from "./stops";
import type { DemographyObservation, Sex } from "./types";

const TOTAL_ID = "citizenship.total";
const SEXES: readonly Sex[] = ["total", "male", "female"];

const rowSchema = z.object({
  citizenship_id: z.string().regex(/^citizenship\.[a-z_]+$/),
  group_id: z.string().regex(/^citizenship\.[a-z_]+$/),
  mapping_note: z.string().min(1),
  reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CitizenshipGroups = {
  /** The countries Geostat lists in every year, each its own group, in reviewed order. */
  readonly named: readonly string[];
  /** The one computed group that holds every other listed citizenship, so it means the same in every year. */
  readonly remainder: string;
  /** The named countries, then the remainder. */
  readonly ids: readonly string[];
  /** The group a listed citizenship belongs to. An id nobody reviewed stops preparation. */
  groupOf(citizenshipId: string): string;
};

/**
 * Geostat lists only the countries large enough in each year, so its `Other` row changes meaning.
 * This reviewed mapping fixes five countries that appear in every year as groups of their own and
 * sends every other listed citizenship, Geostat's own `Other` included, to one computed remainder.
 * Every listed citizenship must be assigned exactly once, so a new label forces a review.
 */
export async function loadCitizenshipGroups(repositoryRoot: string, citizenships: CitizenshipMap): Promise<CitizenshipGroups> {
  const text = await fs.readFile(path.join(repositoryRoot, "data/mappings/demography/citizenship-groups.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const groupOf = new Map<string, string>();
  records.forEach((record, index) => {
    const result = rowSchema.safeParse(record);
    if (!result.success) throw new Error(`citizenship-groups.csv row ${index + 2} is invalid: ${result.error.message}`);
    const { citizenship_id: id, group_id: group } = result.data;
    if (id === TOTAL_ID) throw new Error(`The total (${TOTAL_ID}) is not a member of any citizenship group`);
    if (!citizenships.ids.includes(id)) throw new Error(`${id} is not a citizenship in the reviewed map`);
    if (groupOf.has(id)) throw new Error(`The citizenship groups list ${id} twice`);
    groupOf.set(id, group);
  });
  for (const id of citizenships.ids.filter((candidate) => candidate !== TOTAL_ID)) {
    if (!groupOf.has(id)) throw new Error(`The citizenship groups have no group for ${id}`);
  }

  const named = [...groupOf].filter(([id, group]) => id === group).map(([id]) => id);
  const remainders = new Set([...groupOf].filter(([id, group]) => id !== group).map(([, group]) => group));
  if (remainders.size !== 1) throw new Error(`The citizenship groups need exactly one remainder group, found ${remainders.size}`);
  const remainder = [...remainders][0]!;
  if (groupOf.has(remainder)) throw new Error(`The remainder group ${remainder} must not be a listed citizenship`);

  return {
    named,
    remainder,
    ids: [...named, remainder],
    groupOf(citizenshipId) {
      const group = groupOf.get(citizenshipId);
      if (!group) throw new DemographyStopError("unreviewed_label", `${citizenshipId} is not assigned to a citizenship group`);
      return group;
    },
  };
}

const DIRECTIONS = [
  { published: SERIES.immigrants, grouped: SERIES.immigrantsByCitizenshipGroup },
  { published: SERIES.emigrants, grouped: SERIES.emigrantsByCitizenshipGroup },
] as const;

/** `1!B8 [2012]` → the sheet and the cell, which a derived row lists together. */
function cellOf(row: DemographyObservation): { sheet: string; ref: string } {
  const match = /^([^!]+)!([A-Z]+\d+) \[\d{4}\]$/.exec(row.sourceLocator);
  if (!match) throw new Error(`Unreadable source locator: ${row.sourceLocator}`);
  return { sheet: match[1]!, ref: match[2]! };
}

/**
 * Immigrants and emigrants by citizenship group, in whole persons: each group is the sum of its
 * members' published values (the total row is not a member). A named country that a year no longer
 * lists stops preparation, because it would otherwise be folded into the remainder unseen. Ordered by
 * direction, group, sex and year.
 */
export function groupMigrationByCitizenship(published: readonly DemographyObservation[], groups: CitizenshipGroups): DemographyObservation[] {
  const rows: DemographyObservation[] = [];
  for (const { published: seriesId, grouped } of DIRECTIONS) {
    const members = published.filter((row) => row.seriesId === seriesId && row.citizenshipId !== TOTAL_ID);
    for (const row of members) groups.groupOf(row.citizenshipId!);
    const years = [...new Set(members.map((row) => row.year))].sort((a, b) => a - b);

    for (const group of groups.ids) {
      for (const sex of SEXES) {
        for (const year of years) {
          const inYear = members.filter((row) => row.sex === sex && row.year === year);
          for (const country of groups.named) {
            if (!inYear.some((row) => row.citizenshipId === country)) {
              throw new DemographyStopError("missing_served_cell", `${country} is not listed for ${year} (${seriesId}); it would be folded into ${groups.remainder}`);
            }
          }
          const parts = inYear.filter((row) => groups.groupOf(row.citizenshipId!) === group);
          const cells = parts.map(cellOf);
          rows.push({
            seriesId: grouped,
            geographyId: parts[0]!.geographyId,
            year,
            value: String(parts.reduce((total, part) => total + Number(part.value), 0)),
            unit: "persons",
            estimateBasis: "border_police",
            status: "published",
            sourceId: parts[0]!.sourceId,
            sourceLocator: `${cells[0]!.sheet}!${cells.map((cell) => cell.ref).join("+")} [${year}]`,
            lastReviewedAt: EXTENSION_REVIEWED_AT,
            sex,
            citizenshipId: group,
          });
        }
      }
    }
  }
  return rows;
}
