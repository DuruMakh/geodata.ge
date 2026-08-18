import Decimal from "decimal.js";
import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { MunicipalPopulationFact } from "./types";

const rowSchema = z.object({
  year: z.coerce.number().int().refine((year) => year === 2025, "year must be 2025"),
  municipality_code: z.string().regex(/^\d{2}$/),
  population_thousand: z.string().min(1),
  population_persons: z.string().min(1),
  reference_date: z.literal("2025-01-01"),
  source_id: z.literal("source.geostat_municipal_population"),
  source_sheet: z.string().min(1),
  source_cell: z.string().regex(/^[A-Z]+[1-9][0-9]*$/),
  source_unit: z.literal("(thousands)"),
  transformation: z.string().min(1),
  last_reviewed_at: z.iso.date(),
});

export async function loadMunicipalPopulationFacts(
  relativePath: string,
): Promise<MunicipalPopulationFact[]> {
  const records = await readCsvRecords(relativePath);
  const keys = new Set<string>();

  return records.map((record) => {
    const row = rowSchema.parse(record);
    const key = `${row.year}:${row.municipality_code}`;
    if (keys.has(key)) throw new Error(`Duplicate municipal population key ${key}`);
    keys.add(key);

    const thousand = new Decimal(row.population_thousand);
    const persons = new Decimal(row.population_persons);
    if (!persons.greaterThan(0)) {
      throw new Error(`Population persons must be positive for ${row.municipality_code}`);
    }
    if (!persons.isInteger() || !Number.isSafeInteger(persons.toNumber())) {
      throw new Error(`Population persons must be a safe integer for ${row.municipality_code}`);
    }
    if (!thousand.times(1_000).equals(persons)) {
      throw new Error(`Population conversion mismatch for ${row.municipality_code}`);
    }

    return {
      year: 2025,
      municipalityCode: row.municipality_code,
      populationThousand: thousand.toNumber(),
      populationPersons: persons.toNumber(),
      referenceDate: row.reference_date,
      sourceId: row.source_id,
      sourceSheet: row.source_sheet,
      sourceCell: row.source_cell,
      sourceUnit: row.source_unit,
      transformation: row.transformation,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
}
