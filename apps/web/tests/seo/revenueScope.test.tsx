import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { renderRevenuePage, revenuePageMetadata } from "../../lib/pages/revenue";

test.each(["ka", "en"] as const)("revenue page exposes consolidated receipts and the distinct expenditure scope: %s", async (locale) => {
  const metadata = await revenuePageMetadata(locale);
  const html = renderToStaticMarkup(await renderRevenuePage(locale));
  const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
  const sourceNote = html.match(/<p[^>]*data-testid="source-label"[^>]*>([\s\S]*?)<\/p>/)![1];

  expect(metadata.description).toContain(locale === "en" ? "consolidated-budget receipts" : "ნაერთი ბიუჯეტის ფაქტობრივი შემოსულობები");
  expect(dataset.name).toContain(locale === "en" ? "consolidated-budget receipts" : "ნაერთი ბიუჯეტის შემოსულობები");
  expect(sourceNote).toContain(locale === "en" ? "expenditure covers the state budget" : "ხარჯები — სახელმწიფო ბიუჯეტს");
  expect(sourceNote).toContain(locale === "en" ? "Their difference is not the deficit" : "მათი სხვაობა დეფიციტი არ არის");
});
