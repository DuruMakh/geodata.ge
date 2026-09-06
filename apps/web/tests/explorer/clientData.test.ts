import { describe, expect, it } from "vitest";
import type { AdminSpendingCategory } from "../../lib/data/adminSpending/types";
import type { GlossaryEntry } from "../../lib/data/glossary";
import {
  projectAdminFact,
  projectBudgetFact,
  projectGdpFact,
} from "../../lib/explorer/clientData";
import {
  buildExplorerModel,
  getDefaultSelection,
  type ExplorerModel,
} from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";
import {
  buildWorkbookExportModel,
  type WorkbookExportInput,
  type WorkbookSeries,
} from "../../lib/explorer/workbookModel";
import type {
  ServedAdminFact,
  ServedBudgetFact,
  ServedNationalGdpFact,
} from "../../lib/servedRows";

const fullBudgetFact: ServedBudgetFact = {
  year: 2025,
  side: "expenditure",
  itemId: "spending.health",
  amountGel: 500,
  basis: "actual",
  sourceId: "source.budget",
};

const fullCategoryFact: ServedAdminFact = {
  year: 2025,
  itemId: "admin_spending.health",
  parentItemId: null,
  level: "admin_category",
  amountGel: 300,
  basis: "actual",
  sourceId: "source.admin",
  officialLabelKa: "ოფიციალური კატეგორია",
  officialInstitutionLabelKa: "ოფიციალური უწყება",
};

const fullProgramFact: ServedAdminFact = {
  ...fullCategoryFact,
  itemId: "admin_spending.health.program.primary_care",
  parentItemId: "admin_spending.health",
  level: "major_program",
  amountGel: 120,
  officialLabelKa: "პირველადი ჯანდაცვა",
};

const fullGdpFact: ServedNationalGdpFact = {
  year: 2025,
  gdpCurrentPricesGel: 2_000,
  accountingStandard: "sna_2008",
  status: "preliminary",
  sourceId: "source.gdp",
};

const facts: ServedBudgetFact[] = [
  { ...fullBudgetFact, year: 2024, amountGel: 300 },
  { ...fullBudgetFact, year: 2025, amountGel: 450, basis: "planned" },
  fullBudgetFact,
  { ...fullBudgetFact, year: 2024, itemId: "spending.education", amountGel: 200 },
  { ...fullBudgetFact, itemId: "spending.education", amountGel: 250 },
  { ...fullBudgetFact, year: 2024, side: "revenue", itemId: "revenue.vat", amountGel: 700 },
  { ...fullBudgetFact, side: "revenue", itemId: "revenue.vat", amountGel: 900 },
];

const adminFacts: ServedAdminFact[] = [
  { ...fullCategoryFact, year: 2024, amountGel: 250 },
  fullCategoryFact,
  { ...fullProgramFact, year: 2024, amountGel: 100 },
  fullProgramFact,
];

const gdpFacts: ServedNationalGdpFact[] = [
  { ...fullGdpFact, year: 2024, gdpCurrentPricesGel: 1_500, status: "final_as_published" },
  fullGdpFact,
];

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანმრთელობა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
]);

const adminCategories = new Map<string, AdminSpendingCategory>([
  [
    "admin_spending.health",
    {
      id: "admin_spending.health",
      sortOrder: 1,
      kaLabel: "ჯანდაცვის უწყებები",
      enLabel: "Health institutions",
    },
  ],
]);

function workbookFor(model: ExplorerModel, measure: "nominal" | "share_of_gdp") {
  const labelById = new Map(model.items.map((item) => [item.id, item.kaLabel]));
  const series = model.tableRows.map<WorkbookSeries>((row) => ({
    id: row.itemId,
    kind: row.itemId === model.totalRow?.itemId ? "total" : row.level === "admin_category" ? "group" : "item",
    parentLabel: row.parentItemId ? labelById.get(row.parentItemId) ?? null : null,
    label: row.kaLabel,
    pointsByYear: Object.fromEntries(
      model.years.map((year) => {
        const amountGel = row.valuesByYear[year];
        const basis = row.basisByYear[year];
        return [
          year,
          amountGel === null || amountGel === undefined || basis === undefined
            ? null
            : {
                amountGel,
                measureValue: measure === "share_of_gdp" ? row.shareByYear?.[year] : undefined,
                basis,
              },
        ];
      }),
    ),
  }));
  const input: WorkbookExportInput = {
    locale: "ka",
    filenameBase: "parity",
    title: "პარიტეტის ტესტი",
    groupLabel: "ხარჯები",
    years: model.years,
    measure:
      measure === "share_of_gdp"
        ? { kind: "percentage", unitLabel: "% მშპ-ში", analysisHeader: "მშპ-ის წილი (%)" }
        : { kind: "amount", unitLabel: "მილიონი ₾", readableScale: 1_000_000 },
    totalId: model.totalRow?.itemId ?? null,
    series,
    sources: [],
    siteOrigin: "https://fiscal.ge",
  };
  return buildWorkbookExportModel(input);
}

describe("browser client data projections", () => {
  it("keeps only budget fields read by browser models", () => {
    expect(projectBudgetFact(fullBudgetFact)).toEqual({
      year: fullBudgetFact.year,
      side: fullBudgetFact.side,
      itemId: fullBudgetFact.itemId,
      amountGel: fullBudgetFact.amountGel,
      basis: fullBudgetFact.basis,
    });
  });

  it("keeps program labels but drops server-only admin provenance and category labels", () => {
    expect(projectAdminFact(fullProgramFact)).not.toHaveProperty("sourceId");
    expect(projectAdminFact(fullProgramFact)).not.toHaveProperty("officialInstitutionLabelKa");
    expect(projectAdminFact(fullProgramFact).officialLabelKa).toBe("პირველადი ჯანდაცვა");
    expect(projectAdminFact(fullCategoryFact).officialLabelKa).toBeNull();
  });

  it("keeps GDP display metadata but drops its server-only source id", () => {
    expect(projectGdpFact(fullGdpFact)).toEqual({
      year: 2025,
      gdpCurrentPricesGel: 2_000,
      accountingStandard: "sna_2008",
      status: "preliminary",
    });
    expect(projectGdpFact(fullGdpFact)).not.toHaveProperty("sourceId");
  });

  it("preserves selections, every explorer model combination, snapshots and workbook exports", () => {
    const clientFacts = facts.map(projectBudgetFact);
    const clientAdminFacts = adminFacts.map(projectAdminFact);
    const clientGdpFacts = gdpFacts.map(projectGdpFact);
    const groupings = ["fields", "ministries"] as const;
    const sides = ["expenditure", "revenue"] as const;
    const measures = ["nominal", "share_of_gdp"] as const;
    const ranges = [
      [2024, 2024],
      [2024, 2025],
      [2025, 2025],
    ] as const;

    for (const side of sides) {
      for (const grouping of groupings) {
        if (side === "revenue" && grouping === "ministries") continue;
        expect(getDefaultSelection(side, facts, grouping, adminFacts)).toEqual(
          getDefaultSelection(side, clientFacts, grouping, clientAdminFacts),
        );

        for (const [startYear, endYear] of ranges) {
          for (const measure of measures) {
            const selectedItemIds =
              grouping === "ministries"
                ? ["admin_spending.total", "admin_spending.health", fullProgramFact.itemId]
                : side === "revenue"
                  ? ["revenue.total", "revenue.vat"]
                  : ["expenditure.total", "spending.health", "spending.education"];
            const shared = {
              glossary,
              adminCategories,
              expenditureGrouping: grouping,
              side,
              selectedItemIds,
              startYear,
              endYear,
              measure,
            };
            const fullModel = buildExplorerModel({
              ...shared,
              facts,
              adminFacts,
              gdpFacts,
            });
            const clientModel = buildExplorerModel({
              ...shared,
              facts: clientFacts,
              adminFacts: clientAdminFacts,
              gdpFacts: clientGdpFacts,
            });

            expect(clientModel).toEqual(fullModel);
            expect(workbookFor(clientModel, measure)).toEqual(workbookFor(fullModel, measure));
          }
        }
      }
    }

    for (const side of sides) {
      for (const grouping of groupings) {
        if (side === "revenue" && grouping === "ministries") continue;
        for (const year of [2024, 2025]) {
          const shared = { glossary, adminCategories, grouping, side, year };
          expect(
            buildSingleYearSnapshotModel({
              ...shared,
              facts: clientFacts,
              adminFacts: clientAdminFacts,
            }),
          ).toEqual(
            buildSingleYearSnapshotModel({
              ...shared,
              facts,
              adminFacts,
            }),
          );
        }
      }
    }
  });
});
