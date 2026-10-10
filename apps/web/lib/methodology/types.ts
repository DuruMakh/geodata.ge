import type { MunicipalTotalFact } from "../data/municipal/types";
import type { ServedBudgetFact, ServedGovernmentDebtFact } from "../servedRows";

export const LIVE_METHODOLOGY_IDS = ["expenditure", "revenue", "municipalities", "debt", "gdp", "economic-sectors", "regional-economies", "inflation", "unemployment", "wages", "trade", "demography"] as const;

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
  group: string;
  title: string;
  statusLabel: "ოფიციალური ფაქტი" | "Fiscal.ge-ის გადაწყვეტილება" | "შეზღუდვა" | "Official fact" | "Fiscal.ge decision" | "Limitation";
  summary: string;
  detail: readonly string[];
  canonicalDecisionIds: readonly string[];
};

export type MethodologyContent = {
  id: MethodologyDatasetId;
  slug: MethodologyDatasetId;
  title: string;
  summary: string;
  reviewedAt: string;
  archiveManifestId: MethodologyDatasetId;
  // Where this dataset's coverage years come from. Declared rather than inferred:
  // the previous derivation filtered budget facts by `fact.side === id`, which
  // worked only because two of three dataset ids happened to equal the two
  // BudgetSide values. The next four datasets (ინფლაცია, მშპ, მოსახლეობა,
  // უმუშევრობა) are not budget sides.
  coverageSource:
    | { kind: "budgetSide"; side: ServedBudgetFact["side"] }
    | { kind: "municipalTotals" }
    | { kind: "governmentDebt" }
    | { kind: "archive" };
  canonicalDocuments: readonly string[];
  disclosure: string;
  keyFacts: readonly {
    label: string;
    valueKind: "coverage" | "frequency" | "basis" | "unit";
    value?: string;
  }[];
  sections: readonly {
    id: string;
    kind: MethodologySectionKind;
    title: string;
    paragraphs: readonly string[];
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
  title: string;
  summary: string;
  href: `/methodology/${MethodologyDatasetId}` | `/en/methodology/${MethodologyDatasetId}`;
  coverage: { firstYear: number; lastYear: number };
  originalFileCount: number;
  reviewedAt: string;
};

export type MethodologyHubInput = {
  budgetFacts: readonly ServedBudgetFact[];
  municipalFacts: readonly MunicipalTotalFact[];
  debtFacts: readonly ServedGovernmentDebtFact[];
  archives: Readonly<Record<MethodologyDatasetId, MethodologyArchiveSummary>>;
};
