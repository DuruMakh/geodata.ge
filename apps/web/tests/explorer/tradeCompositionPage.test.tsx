import { Children, isValidElement, type ReactNode } from "react";
import { expect, test } from "vitest";
import { TradeComposition } from "../../components/trade/trade-composition";
import { loadServedTradeCompositionData } from "../../lib/data/tradeComposition/importTradeComposition";
import { coverageLabel } from "../../lib/explorer/coverageLabel";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import { renderTradeHub } from "../../lib/pages/hubs/trade";
import { renderTradeCompositionPage, tradeCompositionMetadata } from "../../lib/pages/trade";
import { resolveSiteUrl } from "../../lib/siteUrl";
import { renderPageMarkup } from "../helpers/render-localized";

function componentProps(node: ReactNode, component: unknown): Record<string, unknown> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === component) return child.props;
    const found = componentProps(child.props.children, component);
    if (found) return found;
  }
}

test.each(["ka", "en"] as const)("%s composition page uses shared coverage, sources and localized dataset identity", async locale => {
  const page = await renderTradeCompositionPage(locale);
  const html = renderPageMarkup(locale, page);
  const dataset = JSON.parse(/data-testid="explorer-dataset-json-ld"[^>]*>(.*?)<\/script>/.exec(html)![1]);
  const path = `${locale === "en" ? "/en" : ""}/explorer/trade/composition`;
  expect(dataset).toMatchObject({
    "@id": `${resolveSiteUrl()}${path}#dataset`,
    url: `${resolveSiteUrl()}${path}`,
    temporalCoverage: "2000/2025",
    license: "https://creativecommons.org/licenses/by/4.0/",
  });
  expect(dataset.includedInDataCatalog).toBeTruthy();
  expect(dataset.variableMeasured).toHaveLength(2);
  const metadata = await tradeCompositionMetadata(locale);
  expect(metadata.alternates?.canonical).toContain(path);
  expect(html).toContain("2000–2025");
  expect(isValidElement<Presentation>(page)).toBe(true);
  if (!isValidElement<Presentation>(page)) return;
  expect(Object.keys(page.props.messages).some(key => key.startsWith("common.") || key.startsWith("controls."))).toBe(false);
  expect(Object.keys(page.props.englishLabels)).toHaveLength(17);
  const props = componentProps(page, TradeComposition)!;
  expect(props.data).not.toHaveProperty("englishLabels");
  expect(props.data).toHaveProperty("sitc");
  expect(props.data).toHaveProperty("bec");
  const sources = props.sources as { downloadHref: string }[];
  expect(sources).toHaveLength(5);
  expect(sources.every(source => source.downloadHref.startsWith("/downloads/methodology/trade/files/"))).toBe(true);
});

test.each(["ka", "en"] as const)("%s Trade hub includes composition in cards and its last review date", async locale => {
  const [hub, composition, presentation] = await Promise.all([renderTradeHub(locale), loadServedTradeCompositionData(), getPresentation(locale, ["trade"], [])]);
  const latestCompositionReview = composition.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!;
  expect(hub.props.cards).toHaveLength(6);
  expect(hub.props.cards.at(-1)).toMatchObject({ index: "06", href: "/explorer/trade/composition" });
  expect(hub.props.coverage).toBe(coverageLabel(presentation.messages, locale, 1995, 2025, latestCompositionReview));
});
