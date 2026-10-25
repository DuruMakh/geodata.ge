import path from "node:path";

const repositoryRoot = path.resolve(process.cwd(), "../..");

/**
 * The Law of Georgia on the 2026 State Budget, archived from mof.ge. Tavi III is a .DOC, so the
 * reader uses its generated LibreOffice conversion under data/staging; the hash is of the official original.
 */
export const BUDGET_LAW_2026 = {
  sourceId: "source.mof_2026_budget_law_planned",
  tavi3DocxPath: path.join(repositoryRoot, "data/staging/budget-law-2026/2026-tavi-III.docx"),
  tavi6DocxPath: path.join(repositoryRoot, "docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-VI.docx"),
  tavi3Sha256: "4244b3c5cc9565da0326e88397dd21af727391fc9d6c8347a2adad2e69fb8297",
  tavi6Sha256: "fecd149457fd373422e6c5f4c0b47d88380416b68c90863495bd7a97a16103d7",
} as const;
