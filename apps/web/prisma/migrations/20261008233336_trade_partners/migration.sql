-- CreateTable
CREATE TABLE "TradePartnerEntity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceCode" TEXT,
    "labelKa" TEXT NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradePartnerEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePartnerFact" (
    "entityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "valueUsd" DECIMAL(40,20),
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
    "sourceBlock" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradePartnerFact_pkey" PRIMARY KEY ("entityId","indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "TradePartnerEntity" ADD CONSTRAINT "TradePartnerEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePartnerFact" ADD CONSTRAINT "TradePartnerFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TradePartnerEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePartnerFact" ADD CONSTRAINT "TradePartnerFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePartnerFact" ADD CONSTRAINT "TradePartnerFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "TradePartnerEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradePartnerFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TradePartnerEntity", "TradePartnerFact" FROM anon, authenticated;