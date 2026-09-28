CREATE TABLE "InflationProduct" (
  "productId" TEXT NOT NULL,
  "coicopCode" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelKa" TEXT NOT NULL,
  "firstPeriod" TEXT NOT NULL,
  "decisionRef" TEXT NOT NULL,
  CONSTRAINT "InflationProduct_pkey" PRIMARY KEY ("productId")
);

CREATE TABLE "InflationProductFact" (
  "productId" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "index100" DECIMAL(12,4),
  "availability" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationProductFact_pkey" PRIMARY KEY ("productId", "measure", "period"),
  CONSTRAINT "InflationProductFact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InflationProduct"("productId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationProductFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationProductFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "InflationProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InflationProductFact" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InflationProduct" FROM anon, authenticated;
REVOKE ALL ON TABLE "InflationProductFact" FROM anon, authenticated;
