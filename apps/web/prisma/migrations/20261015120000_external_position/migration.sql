-- CreateTable
CREATE TABLE "ExternalPositionFact" (
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "value" DECIMAL(40,30) NOT NULL,
    "publishedValue" DECIMAL(40,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "ExternalPositionFact_pkey" PRIMARY KEY ("indicatorId","year")
);

-- AddForeignKey
ALTER TABLE "ExternalPositionFact" ADD CONSTRAINT "ExternalPositionFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPositionFact" ADD CONSTRAINT "ExternalPositionFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "ExternalPositionFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ExternalPositionFact" FROM anon, authenticated;
