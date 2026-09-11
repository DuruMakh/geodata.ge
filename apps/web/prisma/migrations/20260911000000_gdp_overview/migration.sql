CREATE TABLE "GdpOverviewFact" (
 "seriesId" TEXT NOT NULL, "year" INTEGER NOT NULL, "value" DECIMAL(40,20) NOT NULL,
 "unit" TEXT NOT NULL, "status" TEXT NOT NULL, "accountingStandard" TEXT, "sourceLocator" TEXT NOT NULL,
 "sourceDocumentId" TEXT NOT NULL, "lastReviewedAt" DATE NOT NULL, "importRunId" TEXT,
 CONSTRAINT "GdpOverviewFact_pkey" PRIMARY KEY ("seriesId","year"),
 CONSTRAINT "GdpOverviewFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "GdpOverviewFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
ALTER TABLE "GdpOverviewFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GdpOverviewFact" FROM anon, authenticated;
