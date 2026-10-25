import type { Metadata } from "next";
import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { publicGlossaryEntry } from "../data/glossary";
import { citedReviewedAt } from "../data/sources";
import { loadServedExplorerData, loadServedLandingData } from "../data/servedData";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import { pageHref } from "../i18n/routes";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { projectBudgetFact, projectGdpFact } from "../explorer/clientData";
import { ALL_DATA_PATH, navGroup } from "../navigation/navTree";

export async function revenuePageMetadata(locale: Locale): Promise<Metadata> {
  const [{ facts }, messages] = await Promise.all([loadServedLandingData(), getMessages(locale, ["main"])]);
  const { firstYear, lastYear } = coverageFromYears(facts.filter(fact => fact.side === "revenue"));
  return fiscalMetadata({ locale,
    title: message(messages, "main.metadataRevenueTitle", { firstYear, lastYear }),
    description: message(messages, "main.metadataRevenueDescription", { firstYear, lastYear }),
    path: "/explorer/revenue",
  });
}

export async function renderRevenuePage(locale: Locale) {
  const [{ facts, glossary, sourceDocuments, gdpFacts }, workbookSources, gdpWorkbookSources] = await Promise.all([
    loadServedExplorerData(),
    loadWorkbookSources("revenue", "revenue", locale),
    loadGdpWorkbookSources(locale),
  ]);
  // `nav` fixes explorerSide to "revenue" here, so the 286 expenditure rows can
  // never be rendered on this route — 53 KB of dead payload, the same reasoning
  // the adminFacts note below already applies to the admin corpus.
  const ownFacts = facts.filter((fact) => fact.side === "revenue");
  // The displayed "განახლდა" date: the newest source the page's own rows cite, as the sitemap dates it (lib/seo/sitemap.ts).
  // The Budget group cites these rows and more, so it is never older than this page.
  const lastUpdatedAt = citedReviewedAt(sourceDocuments, ownFacts);
  const { firstYear, lastYear } = coverageFromYears(ownFacts);
  // The series search matches English names on the Georgian page too.
  const labelIds = ["revenue.total", ...ownFacts.map(fact => fact.itemId)];
  const presentation = await getPresentation(locale, ["format", "main"], labelIds, labelIds);
  const { messages } = presentation;

  // No adminFacts/adminCategories: the ministries scope cannot be reached from
  // this route, so shipping the admin corpus here is dead payload.
  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          datasetId: "national-revenue",
          sameAsPath: "/methodology/revenue",
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
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: message(messages, "common.budget"), path: pageHref(navGroup("budget").href, locale) }, { name: message(messages, "common.revenue"), path: pageHref("/explorer/revenue", locale) }]} />
      <MainExplorer
        presentation={clientPresentation(presentation)}
        nav="revenue"
        facts={ownFacts.map(projectBudgetFact)}
        glossaryEntries={Array.from(glossary.values(), publicGlossaryEntry)}
        gdpFacts={gdpFacts.map(projectGdpFact)}
        workbookSources={workbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
