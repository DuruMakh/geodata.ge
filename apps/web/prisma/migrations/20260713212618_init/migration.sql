-- CreateEnum
CREATE TYPE "BudgetSide" AS ENUM ('revenue', 'expenditure');

-- CreateEnum
CREATE TYPE "BudgetBasis" AS ENUM ('actual', 'planned');

-- CreateEnum
CREATE TYPE "BudgetItemLevel" AS ENUM ('revenue_category', 'public_spending_field');

-- CreateEnum
CREATE TYPE "AdminSpendingLevel" AS ENUM ('admin_category', 'major_program');

-- CreateEnum
CREATE TYPE "MappingConfidence" AS ENUM ('high', 'medium', 'low', 'unclassified');

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "side" "BudgetSide" NOT NULL,
    "level" "BudgetItemLevel" NOT NULL,
    "kaLabel" TEXT NOT NULL,
    "enLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSpendingCategory" (
    "id" TEXT NOT NULL,
    "kaLabel" TEXT NOT NULL,
    "enLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "AdminSpendingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrlOrFile" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "importLabel" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowsRead" INTEGER NOT NULL,
    "rowsImported" INTEGER NOT NULL,
    "totalRevenueGel" DECIMAL(18,2) NOT NULL,
    "totalExpenditureGel" DECIMAL(18,2) NOT NULL,
    "unclassifiedAmountGel" DECIMAL(18,2) NOT NULL,
    "unclassifiedShare" DECIMAL(9,6) NOT NULL,
    "plannedRows" INTEGER NOT NULL,
    "actualRows" INTEGER NOT NULL,
    "reconciliationStatus" TEXT NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "reportJson" JSONB NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetMapping" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "officialInstitution" TEXT NOT NULL,
    "officialProgram" TEXT,
    "officialSubprogram" TEXT,
    "publicSpendingFieldId" TEXT NOT NULL,
    "confidence" "MappingConfidence" NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "BudgetMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "side" "BudgetSide" NOT NULL,
    "itemId" TEXT NOT NULL,
    "amountGel" DECIMAL(18,2) NOT NULL,
    "basis" "BudgetBasis" NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "importRunId" TEXT,
    "officialInstitution" TEXT,
    "officialProgram" TEXT,
    "officialSubprogram" TEXT,
    "publicSpendingFieldId" TEXT,
    "mappingConfidence" "MappingConfidence",
    "mappingNotes" TEXT NOT NULL,

    CONSTRAINT "BudgetFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSpendingFact" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "parentItemId" TEXT,
    "level" "AdminSpendingLevel" NOT NULL,
    "amountGel" DECIMAL(18,2) NOT NULL,
    "basis" "BudgetBasis" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "importRunId" TEXT,
    "officialCode" TEXT,
    "officialLabelKa" TEXT,
    "officialInstitutionCode" TEXT,
    "officialInstitutionLabelKa" TEXT,
    "mappingConfidence" "MappingConfidence" NOT NULL,
    "mappingNotes" TEXT NOT NULL,

    CONSTRAINT "AdminSpendingFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetItem_side_level_idx" ON "BudgetItem"("side", "level");

-- CreateIndex
CREATE INDEX "BudgetMapping_year_idx" ON "BudgetMapping"("year");

-- CreateIndex
CREATE INDEX "BudgetMapping_publicSpendingFieldId_idx" ON "BudgetMapping"("publicSpendingFieldId");

-- CreateIndex
CREATE INDEX "BudgetFact_year_side_idx" ON "BudgetFact"("year", "side");

-- CreateIndex
CREATE INDEX "BudgetFact_itemId_idx" ON "BudgetFact"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetFact_year_side_itemId_basis_key" ON "BudgetFact"("year", "side", "itemId", "basis");

-- CreateIndex
CREATE INDEX "AdminSpendingFact_year_level_idx" ON "AdminSpendingFact"("year", "level");

-- CreateIndex
CREATE INDEX "AdminSpendingFact_parentItemId_idx" ON "AdminSpendingFact"("parentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSpendingFact_year_itemId_key" ON "AdminSpendingFact"("year", "itemId");

-- AddForeignKey
ALTER TABLE "BudgetMapping" ADD CONSTRAINT "BudgetMapping_publicSpendingFieldId_fkey" FOREIGN KEY ("publicSpendingFieldId") REFERENCES "BudgetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetFact" ADD CONSTRAINT "BudgetFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetFact" ADD CONSTRAINT "BudgetFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSpendingFact" ADD CONSTRAINT "AdminSpendingFact_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "AdminSpendingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSpendingFact" ADD CONSTRAINT "AdminSpendingFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
