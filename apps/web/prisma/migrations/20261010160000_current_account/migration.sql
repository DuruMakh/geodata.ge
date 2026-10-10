-- CreateTable
CREATE TABLE "CurrentAccountFact" (
    "seriesId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "flow" TEXT NOT NULL,
    "valueUsd" DECIMAL(40,20) NOT NULL,
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCells" TEXT NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "vintage" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "CurrentAccountFact_pkey" PRIMARY KEY ("seriesId","flow","year")
);

-- AddForeignKey
ALTER TABLE "CurrentAccountFact" ADD CONSTRAINT "CurrentAccountFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentAccountFact" ADD CONSTRAINT "CurrentAccountFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "CurrentAccountFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CurrentAccountFact" FROM anon, authenticated;
