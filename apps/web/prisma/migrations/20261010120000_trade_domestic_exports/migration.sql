-- CreateTable
CREATE TABLE "TradeDomesticEntity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT,
    "labelKa" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "sourceBlock" TEXT NOT NULL,
    "categoryId" TEXT,
    "aliasesKa" TEXT[],
    "aliasesEn" TEXT[],
    "importRunId" TEXT,

    CONSTRAINT "TradeDomesticEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeDomesticFact" (
    "entityId" TEXT NOT NULL,
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
    "sourceBlock" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TradeDomesticFact_pkey" PRIMARY KEY ("entityId","indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "TradeDomesticEntity" ADD CONSTRAINT "TradeDomesticEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDomesticFact" ADD CONSTRAINT "TradeDomesticFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "TradeDomesticEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDomesticFact" ADD CONSTRAINT "TradeDomesticFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDomesticFact" ADD CONSTRAINT "TradeDomesticFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TradeDomesticEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeDomesticFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TradeDomesticEntity", "TradeDomesticFact" FROM anon, authenticated;
