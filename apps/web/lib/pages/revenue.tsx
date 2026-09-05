import type { Metadata } from "next";
import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedExplorerData, loadServedLandingData } from "../data/servedData";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { projectBudgetFact, projectGdpFact } from "../explorer/clientData";

export async function revenuePageMetadata(locale: Locale): Promise<Metadata> {
  const [{ facts }, messages] = await Promise.all([loadServedLandingData(), getMessages(locale, ["main"])]);
  const { firstYear, lastYear } = coverageFromYears(facts.filter(fact => fact.side === "revenue"));
  return fiscalMetadata({
    title: message(messages, "main.metadataRevenueTitle", { firstYear, lastYear }),
    description: message(messages, "main.metadataRevenueDescription", { firstYear, lastYear }),
    path: locale === "ka" ? "/explorer/revenue" : "/en/explorer/revenue",
  });
}

export async function renderRevenuePage(locale: Locale) {
  const [{ facts, glossary, sourceDocuments, gdpFacts }, workbookSources, gdpWorkbookSources] = await Promise.all([
    loadServedExplorerData(),
    loadWorkbookSources("revenue", "revenue"),
    loadGdpWorkbookSources(),
  ]);
  // `nav` fixes explorerSide to "revenue" here, so the 286 expenditure rows can
  // never be rendered on this route — 53 KB of dead payload, the same reasoning
  // the adminFacts note below already applies to the admin corpus.
  const ownFacts = facts.filter((fact) => fact.side === "revenue");
  // Computed from the full registry, before the narrowing below: this is the
  // displayed "განახლდა" date and narrowing it here would change what the page
  // shows, not just what it ships.
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const { firstYear, lastYear } = coverageFromYears(ownFacts);
  const presentation = await getPresentation(locale, ["common", "controls", "format", "main"], [
    "revenue.total", ...ownFacts.map(fact => fact.itemId),
  ]);
  const { messages } = presentation;

  // No adminFacts/adminCategories: the ministries scope cannot be reached from
  // this route, so shipping the admin corpus here is dead payload.
  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: "/explorer/revenue",
          name: message(messages, "main.datasetRevenueName"),
          description: message(messages, "main.metadataRevenueDescription", { firstYear, lastYear }),
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "main.georgia"),
          downloadPath: "/downloads/data/national-revenue.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: "/" }, { name: message(messages, "common.budget"), path: "/explorer" }, { name: message(messages, "common.revenue"), path: "/explorer/revenue" }]} />
      <MainExplorer
        presentation={presentation}
        nav="revenue"
        facts={ownFacts.map(projectBudgetFact)}
        glossaryEntries={Array.from(glossary.values())}
        gdpFacts={gdpFacts.map(projectGdpFact)}
        workbookSources={workbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
