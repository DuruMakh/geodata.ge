import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Locale } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import { renderExpenditurePage } from "../../lib/pages/expenditure";
import { renderMunicipalCountry } from "../../lib/pages/municipal-country";
import { renderMunicipalRegion } from "../../lib/pages/municipal-region";
import { renderMunicipality } from "../../lib/pages/municipality";
import { renderRevenuePage } from "../../lib/pages/revenue";

// A page ships two things: its markup and, in the RSC payload, every prop a server page hands a client component.
// The payload is not in renderToStaticMarkup's output, so the props of every element in the tree are read as well.
function shippedProps(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(shippedProps).join("");
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  const { children, ...props } = node.props;
  return JSON.stringify(props) + shippedProps(children);
}


type PageRender = [string, (locale: Locale) => Promise<ReactNode>];

const budgetPages: PageRender[] = [
  ["expenditure", renderExpenditurePage],
  ["revenue", renderRevenuePage],
  ["analysis", renderAnalysisPage],
];

const municipalPages: PageRender[] = [
  ["municipality", (locale) => renderMunicipality("tbilisi", locale)],
  ["region", (locale) => renderMunicipalRegion("imereti", locale)],
  ["country", renderMunicipalCountry],
];

describe.each(["ka", "en"] as const)("%s", (locale) => {
  test.each(budgetPages)("budget pages ship no glossary notes: %s", async (_name, renderPage) => {
    const page = await renderPage(locale);
    const html = renderToStaticMarkup(page) + shippedProps(page);
    expect(["Confirm against source", "Temporary source aggregate", "by user decision"].filter((note) => html.includes(note))).toEqual([]);
  });

  test.each(municipalPages)("municipal pages ship only public fact fields: %s", async (_name, renderPage) => {
    // Props only: the municipal pages' markup needs the client I18nProvider context to render here, and a fact's
    // field names can reach the HTML only through the payload, never through the visible text.
    const html = shippedProps(await renderPage(locale));
    expect(["reconciliationDifferenceGel", "warningType", "sourceId"].filter((field) => html.includes(field))).toEqual([]);
  });
});
