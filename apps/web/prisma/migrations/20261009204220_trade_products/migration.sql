-- CreateTable
CREATE TABLE "TradeProductEntity" (
    "id" TEXT NOT NULL,
    "sourceBlock" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelKa" TEXT NOT NULL,
    "sourceLabelEn" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "aliasesKa" TEXT[],
    "aliasesEn" TEXT[],
    "importRunId" TEXT,

    CONSTRAINT "TradeProductEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeProductFact" (
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
    "sourceUnit" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceNumberFormat" TEXT NOT NULL,
    "sourceBlock" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradeProductFact_pkey" PRIMARY KEY ("entityId","indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "TradeProductEntity" ADD CONSTRAINT "TradeProductEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeProductFact" ADD CONSTRAINT "TradeProductFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TradeProductEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeProductFact" ADD CONSTRAINT "TradeProductFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeProductFact" ADD CONSTRAINT "TradeProductFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Private serving mirror; no public Data API grants.
ALTER TABLE "TradeProductEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeProductFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TradeProductEntity", "TradeProductFact" FROM anon, authenticated;
