-- Private serving mirror of data/imports/expenditure-types-annual.csv.
CREATE TABLE "ExpenditureTypeFact" (
  "seriesId" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "value" DECIMAL(40,20) NOT NULL,
  "unit" TEXT NOT NULL,
  "valuation" TEXT NOT NULL,
  "priceBasis" TEXT NOT NULL,
  "calculation" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "ExpenditureTypeFact_pkey" PRIMARY KEY ("seriesId", "measure", "year"),
  CONSTRAINT "ExpenditureTypeFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExpenditureTypeFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
ALTER TABLE "ExpenditureTypeFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ExpenditureTypeFact" FROM anon, authenticated;
