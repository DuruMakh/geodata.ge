-- CreateTable
CREATE TABLE "MunicipalCountryFunctionFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "scopeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "functionalCode" TEXT NOT NULL,
    "amountGel" DECIMAL(18,2) NOT NULL,
    "basis" "BudgetBasis" NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "MunicipalCountryFunctionFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MunicipalCountryTotalFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "scopeId" TEXT NOT NULL,
    "publicTotalGel" DECIMAL(18,2) NOT NULL,
    "publicTotalMeasure" TEXT NOT NULL,
    "totalPaymentsGel" DECIMAL(18,2),
    "expensesGel" DECIMAL(18,2),
    "nonfinancialAssetGrowthGel" DECIMAL(18,2),
    "financialAssetGrowthGel" DECIMAL(18,2),
    "liabilityDecreaseGel" DECIMAL(18,2),
    "functionalSumGel" DECIMAL(18,2) NOT NULL,
    "reconciliationDifferenceGel" DECIMAL(18,2),
    "warningAmountGel" DECIMAL(18,2),
    "showWarning" BOOLEAN NOT NULL,
    "warningType" "MunicipalWarningType" NOT NULL,
    "basis" "BudgetBasis" NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "MunicipalCountryTotalFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MunicipalCountryFunctionFact_year_idx" ON "MunicipalCountryFunctionFact"("year");

-- CreateIndex
CREATE INDEX "MunicipalCountryFunctionFact_scopeId_idx" ON "MunicipalCountryFunctionFact"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalCountryFunctionFact_year_scopeId_categoryId_key" ON "MunicipalCountryFunctionFact"("year", "scopeId", "categoryId");

-- CreateIndex
CREATE INDEX "MunicipalCountryTotalFact_year_idx" ON "MunicipalCountryTotalFact"("year");

-- CreateIndex
CREATE INDEX "MunicipalCountryTotalFact_scopeId_idx" ON "MunicipalCountryTotalFact"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalCountryTotalFact_year_scopeId_key" ON "MunicipalCountryTotalFact"("year", "scopeId");

-- AddForeignKey
ALTER TABLE "MunicipalCountryFunctionFact" ADD CONSTRAINT "MunicipalCountryFunctionFact_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MunicipalFunctionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deny public Data API access, matching every other mirror table.
ALTER TABLE "MunicipalCountryFunctionFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalCountryTotalFact" ENABLE ROW LEVEL SECURITY;
