-- CreateTable
CREATE TABLE "MoneyTransferEntity" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "labelKa" TEXT NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "MoneyTransferEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransferFact" (
    "entityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "measure" TEXT NOT NULL,
    "valueUsd" DECIMAL(40,20),
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "monthsReported" INTEGER,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCells" TEXT NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "vintage" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "MoneyTransferFact_pkey" PRIMARY KEY ("entityId","measure","year")
);

-- AddForeignKey
ALTER TABLE "MoneyTransferEntity" ADD CONSTRAINT "MoneyTransferEntity_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransferFact" ADD CONSTRAINT "MoneyTransferFact_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MoneyTransferEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransferFact" ADD CONSTRAINT "MoneyTransferFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransferFact" ADD CONSTRAINT "MoneyTransferFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "MoneyTransferEntity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MoneyTransferFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MoneyTransferEntity", "MoneyTransferFact" FROM anon, authenticated;
