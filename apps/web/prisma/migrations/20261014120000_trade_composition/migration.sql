-- CreateTable
CREATE TABLE "TradeCompositionEntity" (
    "id" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "labelKa" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradeCompositionEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeCompositionFact" (
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

    CONSTRAINT "TradeCompositionFact_pkey" PRIMARY KEY ("entityId","indicatorId","year")
);

-- CreateIndex
CREATE INDEX "TradeCompositionEntity_importRunId_idx" ON "TradeCompositionEntity"("importRunId");

-- CreateIndex
CREATE INDEX "TradeCompositionFact_sourceDocumentId_idx" ON "TradeCompositionFact"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "TradeCompositionFact_importRunId_idx" ON "TradeCompositionFact"("importRunId");

-- AddForeignKey
ALTER TABLE "TradeCompositionEntity" ADD CONSTRAINT "TradeCompositionEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCompositionFact" ADD CONSTRAINT "TradeCompositionFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TradeCompositionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCompositionFact" ADD CONSTRAINT "TradeCompositionFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCompositionFact" ADD CONSTRAINT "TradeCompositionFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Build-time mirror only; public Data API roles have no access.
ALTER TABLE "TradeCompositionEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeCompositionFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TradeCompositionEntity" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "TradeCompositionFact" FROM PUBLIC, anon, authenticated;
