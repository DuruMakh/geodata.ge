import { AGE_BANDS, AGE_GROUPS } from "./series";

export type AgeBands = Record<(typeof AGE_BANDS)[number]["id"], number>;

/** Adds the 19 age groups of one sex and year, in whole persons, into 0–14, 15–64 and 65+. */
export function ageBands(groups: readonly number[]): AgeBands {
  if (groups.length !== AGE_GROUPS.length) {
    throw new Error(`Age bands need the ${AGE_GROUPS.length} age groups, got ${groups.length}`);
  }
  const bands = {} as AgeBands;
  for (const band of AGE_BANDS) {
    bands[band.id] = groups.slice(band.first, band.last + 1).reduce((sum, value) => sum + value, 0);
  }
  return bands;
}
