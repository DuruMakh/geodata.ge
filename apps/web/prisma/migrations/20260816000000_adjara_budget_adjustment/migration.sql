-- CreateTable
CREATE TABLE "MunicipalAdjaraBudgetAdjustment" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "scopeId" TEXT NOT NULL,
    "republicPaymentsGel" DECIMAL(18,2) NOT NULL,
    "municipalTransfersGel" DECIMAL(18,2) NOT NULL,
    "netRepublicPaymentsGel" DECIMAL(18,2) NOT NULL,
    "basis" "BudgetBasis" NOT NULL,
    "republicSourceId" TEXT NOT NULL,
    "transferSourceId" TEXT NOT NULL,

    CONSTRAINT "MunicipalAdjaraBudgetAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MunicipalAdjaraBudgetAdjustment_scopeId_check" CHECK ("scopeId" = 'region.adjara')
);

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalAdjaraBudgetAdjustment_year_key" ON "MunicipalAdjaraBudgetAdjustment"("year");

-- CreateIndex
CREATE INDEX "MunicipalAdjaraBudgetAdjustment_scopeId_idx" ON "MunicipalAdjaraBudgetAdjustment"("scopeId");

-- Deny public Data API access, matching every other mirror table.
ALTER TABLE "MunicipalAdjaraBudgetAdjustment" ENABLE ROW LEVEL SECURITY;
