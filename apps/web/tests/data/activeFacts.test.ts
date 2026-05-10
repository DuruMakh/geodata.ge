import { describe, expect, it } from "vitest";
import { chooseActivePublicFacts } from "../../lib/data/activeFacts";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

describe("active public fact selection", () => {
  it("uses actual when planned and actual exist for the same item and year", () => {
    const rows: BudgetFactImportRow[] = [
      {
        year: 2026,
        side: "revenue",
        itemId: "revenue.vat",
        amountGel: 800,
        basis: "planned",
        sourceId: "source.mof_2026_plan",
        officialInstitution: null,
        officialProgram: null,
        officialSubprogram: null,
        publicSpendingFieldId: null,
        mappingConfidence: null,
        mappingNotes: "",
      },
      {
        year: 2026,
        side: "revenue",
        itemId: "revenue.vat",
        amountGel: 900,
        basis: "actual",
        sourceId: "source.mof_2026_actual",
        officialInstitution: null,
        officialProgram: null,
        officialSubprogram: null,
        publicSpendingFieldId: null,
        mappingConfidence: null,
        mappingNotes: "",
      },
    ];

    const active = chooseActivePublicFacts(rows);

    expect(active).toHaveLength(1);
    expect(active[0]?.basis).toBe("actual");
    expect(active[0]?.amountGel).toBe(900);
  });

  it("keeps planned when no actual exists", () => {
    const rows: BudgetFactImportRow[] = [
      {
        year: 2026,
        side: "expenditure",
        itemId: "spending.health",
        amountGel: 500,
        basis: "planned",
        sourceId: "source.mof_2026_plan",
        officialInstitution: "Health institution",
        officialProgram: "Health program",
        officialSubprogram: null,
        publicSpendingFieldId: "spending.health",
        mappingConfidence: "high",
        mappingNotes: "",
      },
    ];

    expect(chooseActivePublicFacts(rows)[0]?.basis).toBe("planned");
  });
});
