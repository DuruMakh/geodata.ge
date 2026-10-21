import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { loadTranslationInventory } from "../../lib/i18n/inventory.server";
import { validateCatalogue } from "../../lib/i18n/validation";
import { DEFICIT_ITEM } from "../../lib/explorer/deficitExplorer";

describe("served translation inventory", () => {
  it("requires reviewed labels, historical names and sources from the actual served corpus", async () => {
    const [catalogue, inventory] = await Promise.all([
      loadEnglishCatalogue(path.resolve(process.cwd(), "../..")), loadTranslationInventory(),
    ]);
    expect(validateCatalogue(catalogue, inventory)).toEqual([]);
    expect(catalogue.labels["spending.education"].text).toBe("Education");
    expect(catalogue.labels["revenue.total"].text).toBe("Total receipts");
    expect(catalogue.labels["06"].text).toBe("Batumi");
    expect(inventory.labelIds).toContain(DEFICIT_ITEM.id);
    expect(catalogue.labels[DEFICIT_ITEM.id].text).toBe("General government balance");
    expect(inventory.derivedSourceIds).toContain("source.adjara_consolidated_budget");
  });
});
