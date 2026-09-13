CREATE TABLE "RegionalEconomyFact" (
  "regionId" TEXT NOT NULL,
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
  CONSTRAINT "RegionalEconomyFact_pkey" PRIMARY KEY ("regionId", "seriesId", "measure", "year"),
  CONSTRAINT "RegionalEconomyFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegionalEconomyFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "RegionalEconomyFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "RegionalEconomyFact" FROM anon, authenticated;
