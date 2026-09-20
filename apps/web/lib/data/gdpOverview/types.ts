// `first` is the publisher's first year and does not move. The last year comes
// from the data: pinning it here made every refresh a code change.
export const GDP_SERIES = {
  real_usd_2015: { unit: "usd_2015", first: 1960 },
  real_growth_percent: { unit: "percent", first: 1961 },
  nominal_gel: { unit: "gel", first: 1996 },
  nominal_usd: { unit: "usd", first: 1996 },
  per_capita_gel: { unit: "gel_per_person", first: 1996 },
  per_capita_usd: { unit: "usd_per_person", first: 1996 },
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
