-- CreateTable
CREATE TABLE "MunicipalPopulationFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "municipalityCode" TEXT NOT NULL,
    "populationThousand" DECIMAL(10,1) NOT NULL,
    "populationPersons" INTEGER NOT NULL,
    "referenceDate" DATE NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceCell" TEXT NOT NULL,
    "sourceUnit" TEXT NOT NULL,
    "transformation" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "MunicipalPopulationFact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MunicipalPopulationFact_year_check" CHECK ("year" = 2025),
    CONSTRAINT "MunicipalPopulationFact_populationPersons_check" CHECK ("populationPersons" > 0),
    CONSTRAINT "MunicipalPopulationFact_referenceDate_check" CHECK ("referenceDate" = DATE '2025-01-01')
);

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalPopulationFact_year_municipalityCode_key" ON "MunicipalPopulationFact"("year", "municipalityCode");

-- CreateIndex
CREATE INDEX "MunicipalPopulationFact_municipalityCode_idx" ON "MunicipalPopulationFact"("municipalityCode");

-- AddForeignKey
ALTER TABLE "MunicipalPopulationFact" ADD CONSTRAINT "MunicipalPopulationFact_municipalityCode_fkey" FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MunicipalPopulationFact" ADD CONSTRAINT "MunicipalPopulationFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MunicipalPopulationFact" ADD CONSTRAINT "MunicipalPopulationFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deny public Data API access, matching every other mirror table.
ALTER TABLE "MunicipalPopulationFact" ENABLE ROW LEVEL SECURITY;
