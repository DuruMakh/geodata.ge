import { expect, test } from "vitest";
import { budgetTotalsByScope } from "../../components/main-explorer/budget-explorer-frame";
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
// U04-11: the line names what the figure is, as the debt and deficit decks do; U04-10: its lari sign is set in the UI face.
test.each(["ka", "en"] as const)("the revenue deck states the latest receipts and their change on the previous year: %s", async (locale) => {
  const html = renderPageMarkup(locale, await renderRevenuePage(locale));
  const deck = html.match(/<p data-testid="budget-deck"[^>]*>([\s\S]*?)<\/p>/)![1];
  const parts = [...deck.matchAll(/<span class="font-\[family-name[^>]*>([\s\S]*?)<\/span>(?=<span|$)|<span>([^<]*)<\/span>/g)]
    .map((match) => (match[1] ?? match[2]!).replace(/<[^>]+>/g, ""));

  const { facts } = await loadServedExplorerData();
  const totals = budgetTotalsByScope(facts.filter((fact) => fact.side === "revenue").map(projectBudgetFact), []).revenue;
  const [previous, latest] = [...totals.keys()].sort((a, b) => a - b).slice(-2);
  const messages = await getMessages(locale, ["main"]);
  expect(parts).toEqual([
    `${latest}: ${locale === "en" ? "Total receipts" : "მთლიანი შემოსავლები"} · ${formatAmount(totals.get(latest!)!, locale)}`,
    formatShare((totals.get(latest!)! - totals.get(previous!)!) / totals.get(previous!)!, true),
    message(messages, "main.previousYear"),
  ]);
  expect(parts[1]).toMatch(/^[+−]\d+\.\d%$/);
  if (locale === "ka") expect(deck).toContain('<span data-lari="" class="font-[family-name:var(--font-ui)]">₾</span>');
});

// U04-05: five of the eleven revenue lines are under 1 bn, so the period comparison prints two decimals, as the table does.
test("the revenue period comparison prints the table's two decimals", async () => {
  const html = renderPageMarkup("en", await renderRevenuePage("en"));
  const comparison = html.slice(html.indexOf('data-testid="period-comparison"'));
  expect(comparison).toMatch(/>\d+\.\d\d</);
  expect(comparison).not.toMatch(/>[+−]?<0\.1</);
});

// U05-14: the analysis deck is the change on the year before only; the year, category count and total are the first
// headline card right below it.
test("the analysis deck does not repeat the first headline card", async () => {
  const { renderAnalysisPage } = await import("../../lib/pages/analysis");
  const html = renderPageMarkup("en", await renderAnalysisPage("en"));
  const deck = html.match(/<p data-testid="budget-deck"[^>]*>([\s\S]*?)<\/p>/)![1]!.replace(/<[^>]+>/g, " ");
  expect(deck).not.toMatch(/categories|Total/);
  expect(deck).toMatch(/^\s*[+−]\d+\.\d%\s+from the previous year\s*$/);
});

// U03-14: in the line view the phone chart's own axis caption names the unit, so the mode row's caption is desktop-only;
// U04-10: its lari sign is set in the UI face like every other ₾ on the page.
test("the mode row's unit caption is desktop-only in the line view and sets ₾ in the UI face", async () => {
  const html = renderPageMarkup("ka", await renderRevenuePage("ka"));
  const caption = html.match(/<span data-testid="explorer-unit-caption"[^>]*>[\s\S]*?<\/span><\/span>/)![0];
  expect(caption).toContain("max-[768px]:hidden");
  expect(caption).toContain("data-lari");
});
