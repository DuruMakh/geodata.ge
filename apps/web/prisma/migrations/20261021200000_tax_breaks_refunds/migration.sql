-- CreateTable
CREATE TABLE "TaxBreaksRefundsFact" (
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "value" DECIMAL(40,30) NOT NULL,
    "publishedValue" DECIMAL(40,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "TaxBreaksRefundsFact_pkey" PRIMARY KEY ("indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "TaxBreaksRefundsFact" ADD CONSTRAINT "TaxBreaksRefundsFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBreaksRefundsFact" ADD CONSTRAINT "TaxBreaksRefundsFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "TaxBreaksRefundsFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TaxBreaksRefundsFact" FROM anon, authenticated;
