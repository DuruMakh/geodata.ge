import { describe, expect, it } from "vitest";
import { validateFoundationReferences } from "../../lib/data/foundationValidation";
import { loadGlossary } from "../../lib/data/glossary";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadSpendingMappings } from "../../lib/data/mappings";
import { loadSourceDocuments } from "../../lib/data/sources";
import { loadTaxonomyFiles } from "../../lib/data/taxonomy";

describe("foundation cross-file validation", () => {
  it("accepts sample data when every reference exists", async () => {
    await expect(async () => {
      validateFoundationReferences({
        taxonomy: await loadTaxonomyFiles("../../data/taxonomy"),
        sources: await loadSourceDocuments("../../data/sources/source-documents.csv"),
        mappings: await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv"),
        facts: await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv"),
      });
    }).not.toThrow();
  });

  it("rejects fact item IDs that are formatted correctly but absent from taxonomy", async () => {
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");

    facts[0] = {
      ...facts[0],
      itemId: "spending.heath",
    };

    expect(() =>
      validateFoundationReferences({ taxonomy, sources, mappings, facts }),
    ).toThrow("Fact references unknown taxonomy item: spending.heath");
  });

  it("rejects facts that point to unknown source documents", async () => {
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");

    facts[0] = {
      ...facts[0],
      sourceId: "source.missing",
    };

    expect(() =>
      validateFoundationReferences({ taxonomy, sources, mappings, facts }),
    ).toThrow("Fact references unknown source document: source.missing");
  });

  it("includes the temporary taxes aggregate before VAT in taxonomy and glossary", async () => {
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const taxesTotal = taxonomy.find((item) => item.id === "revenue.taxes_total");
    const vat = taxonomy.find((item) => item.id === "revenue.vat");

    expect(taxesTotal).toEqual(
      expect.objectContaining({
        side: "revenue",
        level: "revenue_category",
        enLabel: "Taxes total",
        sortOrder: 5,
      }),
    );
    expect(vat?.sortOrder).toBeGreaterThan(taxesTotal?.sortOrder ?? 0);
    expect(glossary.get("revenue.taxes_total")).toEqual(
      expect.objectContaining({
        kaLabel: taxesTotal?.kaLabel,
        enLabel: "Taxes total",
        notes: expect.stringContaining("Temporary source aggregate"),
      }),
    );
  });
  it("accepts reserved official total fact IDs without taxonomy rows", async () => {
    const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
    const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");

    facts[0] = { ...facts[0], itemId: "expenditure.total", publicSpendingFieldId: null };
    facts[1] = { ...facts[1], side: "revenue", itemId: "revenue.total", publicSpendingFieldId: null };

    expect(() => validateFoundationReferences({ taxonomy, sources, mappings, facts })).not.toThrow();
  });
});
