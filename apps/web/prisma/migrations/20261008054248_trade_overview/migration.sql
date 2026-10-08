-- CreateTable
CREATE TABLE "TradeOverviewFact" (
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "valueUsd" DECIMAL(40,20) NOT NULL,
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "publicationStatus" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceRefs" TEXT NOT NULL,
    "sourceValue" TEXT,
    "sourceUnit" TEXT,
    "sourceLabel" TEXT,
    "sourceNumberFormat" TEXT,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradeOverviewFact_pkey" PRIMARY KEY ("indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "TradeOverviewFact" ADD CONSTRAINT "TradeOverviewFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOverviewFact" ADD CONSTRAINT "TradeOverviewFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "TradeOverviewFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TradeOverviewFact" FROM anon, authenticated;
