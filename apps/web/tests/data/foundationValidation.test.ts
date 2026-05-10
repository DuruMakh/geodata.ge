import { describe, expect, it } from "vitest";
import { validateFoundationReferences } from "../../lib/data/foundationValidation";
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
});
