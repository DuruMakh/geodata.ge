// apps/web/lib/factQuery/caveats/rules.sectors.ts
import type { CaveatRule } from "./engine";

const DATASET_ID = "economic-sectors";

export const SECTORS_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "sectors_preliminary",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.sectors_preliminary",
    methodologyRef: "economic-sectors.md",
    methodologyRefEn: "/en/methodology/economic-sectors",
    // Scoped by status, not by year: the message used to name 2025, which goes
    // stale the moment Geostat finalises it and marks the next year preliminary.
    applies: (c) => c.datasetId === DATASET_ID && c.observations.some((o) => o.basis === "preliminary"),
    affects: (c) => c.observations.filter((o) => o.basis === "preliminary").map((o) => `${o.seriesId}:${o.year}`),
  },
];
