import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { buildCatalogueFile } from "../../lib/factQuery/publications";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { outputSchemaFor } from "../../lib/mcp/outputSchema";
import { toolResult } from "../../lib/mcp/result";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-06T00:00:00.000Z" });
});

const cases = [
  {
    datasetId: "municipal-expenditure",
    en: { gel_per_resident: "Available only for 2025 municipality and region totals (municipal.total); not for the country aggregate or individual functions." },
    ka: { gel_per_resident: "მხოლოდ 2025 წლის მუნიციპალური და რეგიონული ჯამებისთვის (municipal.total); ქვეყნის აგრეგატისა და ცალკეული ფუნქციებისთვის არ გამოიყენება." },
  },
  {
    datasetId: "government-debt",
    en: { amount_gel: "Stock and service only.", share_of_gdp_pct: "Stock and service, where reviewed GDP is available.", rate_percent: "Interest-rate series only; unpublished rates are missing, not zero." },
    ka: { amount_gel: "მხოლოდ ვალის ნაშთისა და მომსახურებისთვის.", share_of_gdp_pct: "ვალის ნაშთისა და მომსახურებისთვის, როცა გადამოწმებული მშპ ხელმისაწვდომია.", rate_percent: "მხოლოდ საპროცენტო განაკვეთის სერიებისთვის; გამოუქვეყნებელი განაკვეთი აკლია და ნული არ არის." },
  },
];

describe("bilingual measurement restrictions", () => {
  for (const { datasetId, en, ka } of cases) {
    it(`${datasetId} retains both languages through the MCP schema and publication`, () => {
      const result = toolResult(describeCoverage(snapshot, { datasetId }));
      const parsed = outputSchemaFor("describe_coverage").parse(result.structuredContent);
      const expected = { datasetId, measureNotes: en, measureNotesEn: en, measureNotesKa: ka };
      expect(parsed.data).toMatchObject({ datasets: [expected] });
      const published = JSON.parse(buildCatalogueFile(snapshot).bytes.toString("utf8"));
      expect(published.datasets).toEqual(expect.arrayContaining([expect.objectContaining(expected)]));
    });
  }
});
