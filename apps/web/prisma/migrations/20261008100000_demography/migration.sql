CREATE TABLE "DemographyFact" (
  "seriesId" TEXT NOT NULL,
  "geographyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "sex" TEXT NOT NULL,
  "ageGroup" TEXT NOT NULL,
  "citizenshipId" TEXT NOT NULL,
  "settlement" TEXT NOT NULL,
  "value" DECIMAL(40,20) NOT NULL,
  "unit" TEXT NOT NULL,
  "estimateBasis" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "DemographyFact_pkey" PRIMARY KEY ("seriesId", "geographyId", "year", "sex", "ageGroup", "citizenshipId", "settlement"),
  CONSTRAINT "DemographyFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DemographyFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "DemographyFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DemographyFact" FROM anon, authenticated;
