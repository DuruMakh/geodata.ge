-- Debt facts cite the source registry's ids (source.mof_…) from 2026-09-17.
-- Rewrite rows already in the mirror before the constraint checks them.
UPDATE "GovernmentDebtFact"
SET "sourceId" = 'source.' || "sourceId"
WHERE "sourceId" IS NOT NULL AND "sourceId" NOT LIKE 'source.%';

-- CreateIndex
CREATE INDEX "GovernmentDebtFact_sourceId_idx" ON "GovernmentDebtFact"("sourceId");

-- AddForeignKey
ALTER TABLE "GovernmentDebtFact" ADD CONSTRAINT "GovernmentDebtFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
