CREATE TABLE "InflationCategoryFact" (
  "categoryId" TEXT NOT NULL,
  "coicopCode" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "parentId" TEXT,
  "measure" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationCategoryFact_pkey" PRIMARY KEY ("categoryId", "measure", "period"),
  CONSTRAINT "InflationCategoryFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationCategoryFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "InflationBasketWeight" (
  "categoryId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "weightPct" DECIMAL(12,6) NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationBasketWeight_pkey" PRIMARY KEY ("categoryId", "year"),
  CONSTRAINT "InflationBasketWeight_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationBasketWeight_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "InflationCategoryFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InflationBasketWeight" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InflationCategoryFact" FROM anon, authenticated;
REVOKE ALL ON TABLE "InflationBasketWeight" FROM anon, authenticated;
