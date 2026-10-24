import { expect, test } from "vitest";
import { renderTaxBreaksRefundsPage, taxBreaksRefundsPageMetadata } from "../../lib/pages/tax-breaks-refunds";
import { loadServedTaxBreaksRefundsData } from "../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds";
import { buildHubCards } from "../../lib/explorer/hubCards";
import { INK } from "../../lib/explorer/colors";
import { NAV_TREE } from "../../lib/navigation/navTree";
import { renderPageMarkup } from "../helpers/render-localized";

const HEADINGS = {
  ka: ["საგადასახადო შეღავათები", "დღგ", "საშემოსავლო და მოგების გადასახადი", "დაბრუნება"],
  en: ["Tax breaks", "VAT", "Income and profit tax", "Refunds"],
};

test.each(["ka", "en"] as const)("the %s page shows its heading, the latest refunds and the four list headings in order", async locale => {
  const metadata = await taxBreaksRefundsPageMetadata(locale);
  const html = renderPageMarkup(locale, await renderTaxBreaksRefundsPage(locale));
  expect(html).toContain(locale === "en" ? "Tax breaks and refunds" : "საგადასახადო შეღავათები და დაბრუნება");
  expect(html.match(/data-testid="explorer-dataset-json-ld"/g)).toHaveLength(1);
  const latest = html.match(/data-testid="tax-breaks-refunds-latest"[^>]*>([\s\S]*?)<\/p>/)![1];
  expect(latest).toContain("2.7");
  // Both totals do not fit one 375px line, so the line names refunds only (spec fallback).
  expect(latest).not.toContain("6.4");
  const headings = [...html.matchAll(/data-testid="series-heading"[^>]*>([^<]*)</g)].map(match => match[1].split(" · ")[0]);
  expect(headings).toEqual(HEADINGS[locale]);
  // Browse-only: no bulk file.
  expect(html).not.toContain("/downloads/data/tax-breaks-refunds");
  expect(metadata.alternates?.canonical).toContain(`${locale === "en" ? "/en" : ""}/explorer/tax-breaks-refunds`);
});

test("Budget card 04 is tax breaks and refunds, drawn from refunds", async () => {
  const { facts } = await loadServedTaxBreaksRefundsData();
  const refunds = new Map(facts.filter(f => f.indicatorId === "tax_refunds.total").map(f => [f.year, Number(f.value) * 1e6]));
  const cards = buildHubCards([], new Map(), [], [], undefined, undefined, refunds);
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
  expect(cards[3]).toMatchObject({ href: "/explorer/tax-breaks-refunds", comingSoon: false, seriesColor: INK, title: "შეღავათები და დაბრუნება" });
  expect(cards[3].series).toHaveLength(18);
  expect(cards[3].footer).toBe("2025 · დაბრუნება 2.7 მლრდ ₾");
  // On the Budget group page the card states the same refunds figure, named, and the years refunds cover.
  const groupCard = buildHubCards([], new Map(), [], [], undefined, undefined, refunds, true)[3];
  expect(groupCard.latest).toEqual({ value: "2.7 მლრდ ₾", period: "2025", caption: "დაბრუნება" });
  expect(groupCard.years).toBe("2008–2025");
});

test("the sidebar lists the page between Revenue and Municipalities", () => {
  const budget = NAV_TREE[0].sections.map(section => section.href);
  expect(budget.slice(0, 5)).toEqual(["/explorer/expenditure", "/explorer/expenditure-types", "/explorer/revenue", "/explorer/tax-breaks-refunds", "/explorer/municipalities"]);
});
