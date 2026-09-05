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
import { projectAdminFact, projectBudgetFact, projectGdpFact } from "../explorer/clientData";

export async function expenditurePageMetadata(locale: Locale): Promise<Metadata> {
  const [{ facts }, messages] = await Promise.all([loadServedLandingData(), getMessages(locale, ["main"])]);
  const { firstYear, lastYear } = coverageFromYears(facts.filter(fact => fact.side === "expenditure"));
  return fiscalMetadata({
    title: message(messages, "main.metadataExpenditureTitle", { firstYear, lastYear }),
    description: message(messages, "main.metadataExpenditureDescription", { firstYear, lastYear }),
    path: locale === "ka" ? "/explorer/expenditure" : "/en/explorer/expenditure",
  });
}

export async function renderExpenditurePage(locale: Locale) {
  const [{ facts, glossary, sourceDocuments, adminFacts, adminCategories, gdpFacts }, workbookSources, adminWorkbookSources, gdpWorkbookSources] =
    await Promise.all([
      loadServedExplorerData(),
      loadWorkbookSources("expenditure", "expenditure-fields", locale),
      loadWorkbookSources("expenditure", "expenditure-ministries", locale),
      loadGdpWorkbookSources(locale),
    ]);
  // Same reasoning the revenue route already applies to the admin corpus: this
  // route's explorerSide is fixed to "expenditure" by `nav`, so the 241 revenue
  // rows can never be rendered here and were 35 KB of dead RSC payload.
  const ownFacts = facts.filter((fact) => fact.side === "expenditure");
  // Computed from the full registry, before the narrowing below: this is the
  // displayed "განახლდა" date and narrowing it here would change what the page
  // shows, not just what it ships.
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const { firstYear, lastYear } = coverageFromYears(ownFacts);
  const presentation = await getPresentation(locale, ["common", "controls", "format", "main"], [
    "expenditure.total", ...ownFacts.map(fact => fact.itemId), "admin_spending.total", ...adminFacts.map(fact => fact.itemId),
  ]);
  const { messages } = presentation;

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: "/explorer/expenditure",
          name: message(messages, "main.datasetExpenditureName"),
          description: message(messages, "main.metadataExpenditureDescription", { firstYear, lastYear }),
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "main.georgia"),
          downloadPath: "/downloads/data/national-expenditure.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: "/" }, { name: message(messages, "common.budget"), path: "/explorer" }, { name: message(messages, "common.expenditure"), path: "/explorer/expenditure" }]} />
      <MainExplorer
        presentation={presentation}
        nav="expenditure"
        facts={ownFacts.map(projectBudgetFact)}
        adminFacts={adminFacts.map(projectAdminFact)}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values())}
        gdpFacts={gdpFacts.map(projectGdpFact)}
        workbookSources={workbookSources}
        adminWorkbookSources={adminWorkbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
