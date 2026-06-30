import type { BudgetFactImportRow } from "./importBudgetFacts";
import type { SourceDocumentRow } from "./sources";
import type { SpendingMapping } from "./mappings";
import type { TaxonomyItem } from "./taxonomy";

const importedTotalFactIds = new Set(["expenditure.total", "revenue.total"]);

export type FoundationValidationInput = {
  taxonomy: TaxonomyItem[];
  sources: SourceDocumentRow[];
  mappings: SpendingMapping[];
  facts: BudgetFactImportRow[];
};

export function validateFoundationReferences(input: FoundationValidationInput): void {
  const taxonomyIds = new Set(input.taxonomy.map((item) => item.id));
  const sourceIds = new Set(input.sources.map((source) => source.sourceId));

  for (const mapping of input.mappings) {
    if (!taxonomyIds.has(mapping.publicSpendingFieldId)) {
      throw new Error(
        `Mapping references unknown public spending field: ${mapping.publicSpendingFieldId}`,
      );
    }
  }

  for (const fact of input.facts) {
    if (!taxonomyIds.has(fact.itemId) && !importedTotalFactIds.has(fact.itemId)) {
      throw new Error(`Fact references unknown taxonomy item: ${fact.itemId}`);
    }

    if (!sourceIds.has(fact.sourceId)) {
      throw new Error(`Fact references unknown source document: ${fact.sourceId}`);
    }

    if (fact.publicSpendingFieldId && !taxonomyIds.has(fact.publicSpendingFieldId)) {
      throw new Error(
        `Fact references unknown public spending field: ${fact.publicSpendingFieldId}`,
      );
    }
  }
}


