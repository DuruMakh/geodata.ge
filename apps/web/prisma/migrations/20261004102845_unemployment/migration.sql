-- CreateTable
CREATE TABLE "UnemploymentFact" (
    "dimension" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "groupLabelEn" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "value" DECIMAL(40,20) NOT NULL,
    "publishedValue" DECIMAL(40,20) NOT NULL,
    "basis" TEXT NOT NULL,
    "valueStatus" TEXT NOT NULL,
    "methodologyEpoch" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceGroupLabel" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceNumberFormat" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "UnemploymentFact_pkey" PRIMARY KEY ("dimension","groupId","sex","indicatorId","year")
);

-- CreateIndex
CREATE INDEX "UnemploymentFact_sourceDocumentId_idx" ON "UnemploymentFact"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "UnemploymentFact_importRunId_idx" ON "UnemploymentFact"("importRunId");

-- AddForeignKey
ALTER TABLE "UnemploymentFact" ADD CONSTRAINT "UnemploymentFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnemploymentFact" ADD CONSTRAINT "UnemploymentFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UnemploymentFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "UnemploymentFact" FROM anon, authenticated;
