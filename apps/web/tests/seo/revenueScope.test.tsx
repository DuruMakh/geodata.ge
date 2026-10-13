import { expect, test } from "vitest";
import { budgetTotalsByScope } from "../../components/main-explorer/budget-explorer-frame";
import { DECK_LINE_CLASS } from "../../components/explorer-shell/latest-value-line";
import { loadServedExplorerData } from "../../lib/data/servedData";
import { projectBudgetFact } from "../../lib/explorer/clientData";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";
import { renderRevenuePage, revenuePageMetadata } from "../../lib/pages/revenue";
import { renderPageMarkup } from "../helpers/render-localized";

test.each(["ka", "en"] as const)("revenue page exposes consolidated receipts and the distinct expenditure scope: %s", async (locale) => {
  const metadata = await revenuePageMetadata(locale);
  const html = renderPageMarkup(locale, await renderRevenuePage(locale));
  const dataset = JSON.parse(html.match(/<script[^>]*data-testid="explorer-dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]);
  const sourceNote = html.match(/<p[^>]*data-testid="source-label"[^>]*>([\s\S]*?)<\/p>/)![1];

  expect(metadata.description).toContain(locale === "en" ? "consolidated-budget receipts" : "ნაერთი ბიუჯეტის ფაქტობრივი შემოსულობები");
  expect(dataset.name).toContain(locale === "en" ? "consolidated-budget receipts" : "ნაერთი ბიუჯეტის შემოსულობები");
  expect(sourceNote).toContain(locale === "en" ? "expenditure covers the state budget" : "ხარჯები — სახელმწიფო ბიუჯეტს");
  expect(sourceNote).toContain(locale === "en" ? "Their difference is not the deficit" : "მათი სხვაობა დეფიციტი არ არის");
});

// U04-15: the national deck line under the heading: the latest year's receipts and the change on the year before,
// both from the served facts (as the page totals them), so a new year or a revision does not fail the test.
test.each(["ka", "en"] as const)("the revenue deck states the latest receipts and their change on the previous year: %s", async (locale) => {
  const html = renderPageMarkup(locale, await renderRevenuePage(locale));
  const deck = html.match(new RegExp(`<p class="${DECK_LINE_CLASS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">([\\s\\S]*?)</p>`))![1];
  const parts = [...deck.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((match) => match[1]);

  const { facts } = await loadServedExplorerData();
  const totals = budgetTotalsByScope(facts.filter((fact) => fact.side === "revenue").map(projectBudgetFact), []).revenue;
  const [previous, latest] = [...totals.keys()].sort((a, b) => a - b).slice(-2);
  const messages = await getMessages(locale, ["main"]);
  expect(parts).toEqual([
    `${latest}: ${formatAmount(totals.get(latest!)!, locale)}`,
    formatShare((totals.get(latest!)! - totals.get(previous!)!) / totals.get(previous!)!, true),
    message(messages, "main.previousYear"),
  ]);
  expect(parts[1]).toMatch(/^[+−]\d+\.\d%$/);
});
