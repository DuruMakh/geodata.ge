-- Geostat stores the 2025 municipal population in thousands with three decimals; keep them all.
ALTER TABLE "MunicipalPopulationFact" ALTER COLUMN "populationThousand" TYPE DECIMAL(10,3);
