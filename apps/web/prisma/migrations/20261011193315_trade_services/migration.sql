-- CreateTable
CREATE TABLE "TradeServiceEntity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "labelKa" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradeServiceEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeServiceFact" (
    "entityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "valueUsd" DECIMAL(40,20),
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "publicationStatus" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceRefs" TEXT NOT NULL,
    "sourceValue" TEXT,
    "sourceUnit" TEXT,
    "sourceLabel" TEXT,
    "sourceNumberFormat" TEXT,
    "sourceBlock" TEXT,
    "sourceDocumentId" TEXT,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradeServiceFact_pkey" PRIMARY KEY ("entityId","indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "TradeServiceEntity" ADD CONSTRAINT "TradeServiceEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeServiceFact" ADD CONSTRAINT "TradeServiceFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TradeServiceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeServiceFact" ADD CONSTRAINT "TradeServiceFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeServiceFact" ADD CONSTRAINT "TradeServiceFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TradeServiceEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeServiceFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TradeServiceEntity" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "TradeServiceFact" FROM PUBLIC, anon, authenticated;
