-- CreateTable
CREATE TABLE "SocialFact" (
    "year" INTEGER NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "geographyId" TEXT NOT NULL,
    "value" DECIMAL(30,12) NOT NULL,
    "unit" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceWorkbook" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "SocialFact_pkey" PRIMARY KEY ("indicatorId","geographyId","year")
);

-- AddForeignKey
ALTER TABLE "SocialFact" ADD CONSTRAINT "SocialFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialFact" ADD CONSTRAINT "SocialFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "SocialFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SocialFact" FROM anon, authenticated;
