CREATE TABLE "InflationCityFact" (
  "cityId" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationCityFact_pkey" PRIMARY KEY ("cityId", "seriesId", "measure", "period"),
  CONSTRAINT "InflationCityFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationCityFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "InflationCityFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InflationCityFact" FROM anon, authenticated;
