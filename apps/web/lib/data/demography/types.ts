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
