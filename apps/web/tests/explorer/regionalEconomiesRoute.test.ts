import { expect, test } from "vitest";
import {
  regionalEconomyStaticParams,
  renderRegionalEconomyPage,
} from "../../lib/pages/regional-economy";
import { renderPageMarkup } from "../helpers/render-localized";

test("regional economy routes expose exactly eleven stable region IDs", () => {
  expect(regionalEconomyStaticParams()).toEqual([
    "tbilisi", "adjara", "guria", "imereti", "kakheti", "mtskheta_mtianeti",
    "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti",
    "kvemo_kartli", "shida_kartli",
  ].map((id) => ({ id })));
});

// Heading, link and name are checked in regional-economies.spec.ts; the coverage is not.
test.each(["ka", "en"] as const)("the Imereti page states its 2010–2024 coverage in %s", async (locale) => {
  const detail = renderPageMarkup(locale, await renderRegionalEconomyPage("imereti", locale));
  expect(detail).toContain("2010–2024");
});

test("unknown regional economy IDs fail closed", async () => {
  await expect(renderRegionalEconomyPage("unknown", "en")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
});
