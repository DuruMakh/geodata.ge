CREATE TABLE "InflationCpiFact" (
  "seriesId" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationCpiFact_pkey" PRIMARY KEY ("seriesId", "measure", "period"),
  CONSTRAINT "InflationCpiFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationCpiFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "InflationTarget" (
  "effectiveFrom" TEXT NOT NULL,
  "effectiveTo" TEXT,
  "targetPct" DECIMAL(6,3) NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationTarget_pkey" PRIMARY KEY ("effectiveFrom"),
  CONSTRAINT "InflationTarget_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationTarget_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "InflationCpiFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InflationTarget" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InflationCpiFact" FROM anon, authenticated;
REVOKE ALL ON TABLE "InflationTarget" FROM anon, authenticated;
