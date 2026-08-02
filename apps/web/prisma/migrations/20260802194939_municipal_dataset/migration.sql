-- CreateEnum
CREATE TYPE "MunicipalWarningType" AS ENUM ('none', 'source_version_difference', 'financing_outside_functional', 'reconciliation_review_required', 'source_actual_missing');

-- CreateTable
CREATE TABLE "MunicipalFunctionCategory" (
    "id" TEXT NOT NULL,
    "kaLabel" TEXT NOT NULL,
    "functionalCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MunicipalFunctionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MunicipalRegion" (
    "id" TEXT NOT NULL,
    "kaLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MunicipalRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Municipality" (
    "code" TEXT NOT NULL,
    "sortId" INTEGER NOT NULL,
    "nameKa" TEXT NOT NULL,
    "displayNameKa" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "isSelfGoverningCity" BOOLEAN NOT NULL,

    CONSTRAINT "Municipality_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "MunicipalFunctionFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "municipalityCode" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "functionalCode" TEXT NOT NULL,
    "amountGel" DECIMAL(18,2) NOT NULL,
    "basis" "BudgetBasis" NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "MunicipalFunctionFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MunicipalTotalFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "municipalityCode" TEXT NOT NULL,
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

    CONSTRAINT "MunicipalTotalFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalFunctionCategory_functionalCode_key" ON "MunicipalFunctionCategory"("functionalCode");

-- CreateIndex
CREATE INDEX "Municipality_regionId_idx" ON "Municipality"("regionId");

-- CreateIndex
CREATE INDEX "MunicipalFunctionFact_year_idx" ON "MunicipalFunctionFact"("year");

-- CreateIndex
CREATE INDEX "MunicipalFunctionFact_municipalityCode_idx" ON "MunicipalFunctionFact"("municipalityCode");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalFunctionFact_year_municipalityCode_categoryId_key" ON "MunicipalFunctionFact"("year", "municipalityCode", "categoryId");

-- CreateIndex
CREATE INDEX "MunicipalTotalFact_year_idx" ON "MunicipalTotalFact"("year");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalTotalFact_year_municipalityCode_key" ON "MunicipalTotalFact"("year", "municipalityCode");

-- AddForeignKey
ALTER TABLE "Municipality" ADD CONSTRAINT "Municipality_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "MunicipalRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MunicipalFunctionFact" ADD CONSTRAINT "MunicipalFunctionFact_municipalityCode_fkey" FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MunicipalFunctionFact" ADD CONSTRAINT "MunicipalFunctionFact_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MunicipalFunctionCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MunicipalTotalFact" ADD CONSTRAINT "MunicipalTotalFact_municipalityCode_fkey" FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Harden the Supabase Data API surface: enable row level security with no
-- policies (deny-all) on the new municipal mirror tables, matching every
-- existing mirror table (see prisma/migrations/20260713220000_enable_row_level_security).
-- Prisma connects as the table owner and is unaffected.
ALTER TABLE "MunicipalFunctionCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalRegion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Municipality" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalFunctionFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalTotalFact" ENABLE ROW LEVEL SECURITY;
