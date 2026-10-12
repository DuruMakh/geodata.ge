-- CreateTable
CREATE TABLE "WagesFact" (
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "value" DECIMAL(30,20),
    "publishedValue" DECIMAL(30,20),
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceNumberFormat" TEXT,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "WagesFact_pkey" PRIMARY KEY ("indicatorId","dimension","groupId","sectorId","year")
);

-- AddForeignKey
ALTER TABLE "WagesFact" ADD CONSTRAINT "WagesFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WagesFact" ADD CONSTRAINT "WagesFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "WagesFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WagesFact" FROM anon, authenticated;
