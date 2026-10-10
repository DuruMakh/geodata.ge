-- CreateTable
CREATE TABLE "ForeignInvestmentEntity" (
    "id" TEXT NOT NULL,
    "dimension" TEXT,
    "kind" TEXT NOT NULL,
    "labelKa" TEXT NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "ForeignInvestmentEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForeignInvestmentFact" (
    "entityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "valueUsd" DECIMAL(40,20),
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCells" TEXT NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "vintage" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "ForeignInvestmentFact_pkey" PRIMARY KEY ("entityId","year")
);

-- AddForeignKey
ALTER TABLE "ForeignInvestmentEntity" ADD CONSTRAINT "ForeignInvestmentEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignInvestmentFact" ADD CONSTRAINT "ForeignInvestmentFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ForeignInvestmentEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignInvestmentFact" ADD CONSTRAINT "ForeignInvestmentFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignInvestmentFact" ADD CONSTRAINT "ForeignInvestmentFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "ForeignInvestmentEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ForeignInvestmentFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ForeignInvestmentEntity", "ForeignInvestmentFact" FROM anon, authenticated;
