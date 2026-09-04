CREATE TABLE "GeneralGovernmentBalanceFact" (
    "year" INTEGER NOT NULL,
    "generalGovernmentBalancePctGdp" DECIMAL(9,3) NOT NULL,
    "generalGovernmentBalanceGel" DECIMAL(24,0) NOT NULL,
    "status" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,

    CONSTRAINT "GeneralGovernmentBalanceFact_pkey" PRIMARY KEY ("year")
);

ALTER TABLE "GeneralGovernmentBalanceFact" ADD CONSTRAINT "GeneralGovernmentBalanceFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneralGovernmentBalanceFact" ADD CONSTRAINT "GeneralGovernmentBalanceFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneralGovernmentBalanceFact" ENABLE ROW LEVEL SECURITY;
