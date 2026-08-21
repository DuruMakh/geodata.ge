import type { MunicipalTotalFact } from "../data/municipal/types";
import type { ServedBudgetFact } from "../servedRows";

export const LIVE_METHODOLOGY_IDS = ["expenditure", "revenue", "municipalities"] as const;

export type MethodologyDatasetId = (typeof LIVE_METHODOLOGY_IDS)[number];

export type MethodologySectionKind =
  | "scope"
  | "sources"
  | "journey"
  | "decisions"
  | "classification"
  | "validation"
  | "limitations"
  | "archive";

export type MethodologyDecision = {
  id: string;
  groupKa: string;
  titleKa: string;
  statusKa: "ოფიციალური ფაქტი" | "Fiscal.ge-ის გადაწყვეტილება" | "შეზღუდვა";
  summaryKa: string;
  detailKa: readonly string[];
  canonicalDecisionIds: readonly string[];
};

export type MethodologyContent = {
  id: MethodologyDatasetId;
  slug: MethodologyDatasetId;
  titleKa: string;
  summaryKa: string;
  reviewedAt: string;
  archiveManifestId: MethodologyDatasetId;
  canonicalDocuments: readonly string[];
  disclosureKa: string;
  keyFacts: readonly {
    labelKa: string;
    valueKind: "coverage" | "frequency" | "basis" | "unit";
    valueKa?: string;
  }[];
  sections: readonly {
    id: string;
    kind: MethodologySectionKind;
    titleKa: string;
    paragraphsKa: readonly string[];
  }[];
  decisions: readonly MethodologyDecision[];
  technicalAppendix: readonly MethodologyDecision[];
  hiddenDecisionGroups?: readonly string[];
  showTechnicalAppendix?: boolean;
};

export type DecisionRegisterRow = {
  canonicalDecisionId: string;
  datasetId: MethodologyDatasetId;
  canonicalDocument: string;
  canonicalHeading: string;
  publicDecisionId: string;
  classification: "official_fact" | "geodata_decision" | "limitation";
  reviewedAt: string;
};

export type DecisionCoverageResult = {
  canonicalDecisionCount: number;
  publicMappingCount: number;
  uncovered: string[];
  unknownPublicIds: string[];
};

export type MethodologyArchiveSummary = {
  fileCount: number;
  totalBytes: number;
  latestRetrievedAt: string;
  validated: boolean;
  status?: "PASS";
  generatedBytes?: number;
  formats?: readonly string[];
  minYear?: number;
  maxYear?: number;
  proxyDateCount?: number;
  licenseCounts?: Readonly<Record<string, number>>;
  redistributionStatusCounts?: Readonly<Record<string, number>>;
  outputHashes?: Readonly<Record<string, string>>;
  outputByteSizes?: Readonly<Record<string, number>>;
};

export type MethodologyHubEntry = {
  id: MethodologyDatasetId;
  titleKa: string;
  summaryKa: string;
  href: `/methodology/${MethodologyDatasetId}`;
  coverage: { firstYear: number; lastYear: number };
  originalFileCount: number;
  reviewedAt: string;
};

export type MethodologyHubInput = {
  budgetFacts: readonly ServedBudgetFact[];
  municipalFacts: readonly MunicipalTotalFact[];
  archives: Readonly<Record<MethodologyDatasetId, MethodologyArchiveSummary>>;
};
