/** What an archived Geostat file is used for, as recorded in the package manifest. */
export const DEMOGRAPHY_SOURCE_ROLES = ["canonical_input", "validation_only", "archived_not_served", "definitions"] as const;
export type DemographySourceRole = (typeof DEMOGRAPHY_SOURCE_ROLES)[number];

export type DemographyManifestRow = {
  sourceId: string;
  datasetTitle: string;
  publisher: string;
  role: DemographySourceRole;
  family: string;
  sourcePageUrl: string;
  retrievedFileUrl: string;
  retrievedAt: string;
  /** Relative to the vintage folder, or repository-relative for the reused municipal capture. */
  localFile: string;
  /** Lower-case hex; the manifest records it upper-case. */
  sha256: string;
  bytes: number;
  sourceYearMin: number | null;
  sourceYearMax: number | null;
  unit: string;
  notes: string;
};

export type VerifiedDemographySource = { row: DemographyManifestRow; bytes: Buffer };

/** The archived package after every file was checked against its manifest bytes and SHA-256. */
export type DemographySources = {
  readonly vintage: string;
  readonly rows: readonly DemographyManifestRow[];
  get(sourceId: string): VerifiedDemographySource;
};

/** Where a value comes from, which decides how far it can be compared with its neighbours. */
export const ESTIMATE_BASES = ["retro_projection", "pre_census", "census_based", "registered", "border_police"] as const;
export type EstimateBasis = (typeof ESTIMATE_BASES)[number];
export type Sex = "total" | "male" | "female";

/** One published Geostat value in the canonical demography files. */
export type DemographyObservation = {
  seriesId: string;
  /** `country.georgia`, a `region.*` id, or a two-digit municipality code. */
  geographyId: string;
  year: number;
  /** A whole number of persons, or a published rate as its shortest decimal text. */
  value: string;
  unit: string;
  estimateBasis: EstimateBasis;
  status: "published";
  sourceId: string;
  /** Sheet, cell and reference date or year, e.g. `1!AG5 [2025-01-01]`. */
  sourceLocator: string;
  lastReviewedAt: string;
  sex?: Sex;
  ageGroup?: string;
  citizenshipId?: string;
};
