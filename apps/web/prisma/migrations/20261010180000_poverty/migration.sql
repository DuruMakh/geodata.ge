-- CreateTable
CREATE TABLE "PovertyFact" (
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "value" DECIMAL(30,20) NOT NULL,
    "publishedValue" DECIMAL(30,20) NOT NULL,
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceNumberFormat" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "PovertyFact_pkey" PRIMARY KEY ("indicatorId","groupId","year")
);

-- AddForeignKey
ALTER TABLE "PovertyFact" ADD CONSTRAINT "PovertyFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PovertyFact" ADD CONSTRAINT "PovertyFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "PovertyFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PovertyFact" FROM anon, authenticated;
