import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  regionalEconomyStaticParams,
  renderRegionalEconomiesPage,
  renderRegionalEconomyPage,
} from "../../lib/pages/regional-economy";

test("regional economy routes expose exactly eleven stable region IDs", () => {
  expect(regionalEconomyStaticParams()).toEqual([
    "tbilisi", "adjara", "guria", "imereti", "kakheti", "mtskheta_mtianeti",
    "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti",
    "kvemo_kartli", "shida_kartli",
  ].map((id) => ({ id })));
});

test.each(["ka", "en"] as const)("All Regions and Imereti pages render in %s", async (locale) => {
  const index = renderToStaticMarkup(await renderRegionalEconomiesPage(locale));
  const detail = renderToStaticMarkup(await renderRegionalEconomyPage("imereti", locale));
  expect(index).toContain(locale === "en" ? "Regional economies" : "რეგიონების ეკონომიკა");
  expect(index).toContain(`${locale === "en" ? "/en" : ""}/explorer/economy/regions/imereti`);
  expect(detail).toContain(locale === "en" ? "Imereti" : "იმერეთი");
  expect(detail).toContain("2010–2024");
});

test("unknown regional economy IDs fail closed", async () => {
  await expect(renderRegionalEconomyPage("unknown", "en")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
});
