-- CreateTable
CREATE TABLE "EducationFact" (
    "year" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "geographyId" TEXT NOT NULL,
    "value" DECIMAL(40,30) NOT NULL,
    "publishedValue" DECIMAL(40,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "shown" BOOLEAN NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "EducationFact_pkey" PRIMARY KEY ("indicatorId","geographyId","year")
);

-- AddForeignKey
ALTER TABLE "EducationFact" ADD CONSTRAINT "EducationFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationFact" ADD CONSTRAINT "EducationFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private serving mirror: no access through Supabase's public Data API.
ALTER TABLE "EducationFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EducationFact" FROM anon, authenticated;
