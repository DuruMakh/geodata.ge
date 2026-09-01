CREATE TABLE "GovernmentDebtFact" (
    "year" INTEGER NOT NULL,
    "family" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "value" DECIMAL(24,6),
    "valueKind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceId" TEXT,
    "snapshotDate" DATE,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "GovernmentDebtFact_pkey" PRIMARY KEY ("year", "seriesId")
);

CREATE INDEX "GovernmentDebtFact_family_year_idx" ON "GovernmentDebtFact"("family", "year");

ALTER TABLE "GovernmentDebtFact" ADD CONSTRAINT "GovernmentDebtFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GovernmentDebtFact" ENABLE ROW LEVEL SECURITY;
