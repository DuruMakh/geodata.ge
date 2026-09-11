export const GDP_SERIES = {
  real_usd_2015: { unit: "usd_2015", first: 1960, last: 2025 },
  real_growth_percent: { unit: "percent", first: 1961, last: 2025 },
  nominal_gel: { unit: "gel", first: 1996, last: 2025 },
  nominal_usd: { unit: "usd", first: 1996, last: 2025 },
  per_capita_gel: { unit: "gel_per_person", first: 1996, last: 2025 },
  per_capita_usd: { unit: "usd_per_person", first: 1996, last: 2025 },
} as const;
export type GdpSeriesId = keyof typeof GDP_SERIES;
export type GdpObservation = {
  seriesId: GdpSeriesId;
  year: number;
  value: string;
  unit: (typeof GDP_SERIES)[GdpSeriesId]["unit"];
  status: "published" | "preliminary";
  accountingStandard: "sna_1993" | "sna_2008" | null;
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};
export type ServedGdpObservation = Omit<GdpObservation, "value"> & {
  value: number;
};
