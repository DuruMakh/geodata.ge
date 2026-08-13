-- CreateEnum
CREATE TYPE "GdpAccountingStandard" AS ENUM ('sna_1993', 'sna_2008');

-- CreateEnum
CREATE TYPE "GdpStatus" AS ENUM ('final_as_published', 'preliminary');

-- CreateTable
CREATE TABLE "NationalGdpFact" (
    "year" INTEGER NOT NULL,
    "gdpCurrentPricesGel" DECIMAL(18,2) NOT NULL,
    "accountingStandard" "GdpAccountingStandard" NOT NULL,
    "status" "GdpStatus" NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "transformation" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "NationalGdpFact_pkey" PRIMARY KEY ("year")
);

-- AddForeignKey
ALTER TABLE "NationalGdpFact" ADD CONSTRAINT "NationalGdpFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalGdpFact" ADD CONSTRAINT "NationalGdpFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Match the repository's defense-in-depth policy for every mirror table.
ALTER TABLE "NationalGdpFact" ENABLE ROW LEVEL SECURITY;
