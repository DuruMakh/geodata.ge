import type { Metadata } from "next";
import type { Locale, Messages } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { publicGlossaryEntry } from "../data/glossary";
import { citedReviewedAt } from "../data/sources";
import { loadServedExplorerData, loadServedLandingData } from "../data/servedData";
import { packFacts } from "../data/packedFacts";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import { pageHref } from "../i18n/routes";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { projectAdminFact, projectBudgetFact, projectGdpFact } from "../explorer/clientData";
import { ALL_DATA_PATH, navGroup } from "../navigation/navTree";
import { isPlannedYear } from "../explorer/explorerData";
import type { ServedBudgetFact } from "../servedRows";

// A latest year with a planned value is named as the plan it is, apart from the actual span before it.
function expenditureDescription(messages: Messages, facts: readonly ServedBudgetFact[]): string {
  const { firstYear, lastYear } = coverageFromYears(facts);
  if (!isPlannedYear(facts, "expenditure", lastYear)) return message(messages, "main.metadataExpenditureDescription", { firstYear, lastYear });
  const lastActualYear = Math.max(...facts.filter((fact) => fact.year < lastYear).map((fact) => fact.year));
  return message(messages, "main.metadataExpenditureDescriptionPlanned", { firstYear, lastActualYear, lastYear });
}

export async function expenditurePageMetadata(locale: Locale): Promise<Metadata> {
  const [{ facts }, messages] = await Promise.all([loadServedLandingData(), getMessages(locale, ["main"])]);
  const ownFacts = facts.filter(fact => fact.side === "expenditure");
  const { firstYear, lastYear } = coverageFromYears(ownFacts);
  return fiscalMetadata({ locale,
    title: message(messages, "main.metadataExpenditureTitle", { firstYear, lastYear }),
    description: expenditureDescription(messages, ownFacts),
    path: "/explorer/expenditure",
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
  // The displayed "განახლდა" date: the newest source the page's own rows cite, its ministries included, as the sitemap dates
  // it (lib/seo/sitemap.ts). The Budget group cites these rows and more, so it is never older than this page.
  const lastUpdatedAt = citedReviewedAt(sourceDocuments, [...ownFacts, ...adminFacts]);
  const { firstYear, lastYear } = coverageFromYears(ownFacts);
  // The series search matches English names on the Georgian page too.
  const labelIds = ["expenditure.total", ...ownFacts.map(fact => fact.itemId), "admin_spending.total", ...adminFacts.map(fact => fact.itemId)];
  const presentation = await getPresentation(locale, ["format", "main"], labelIds, labelIds);
  const { messages } = presentation;

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          datasetId: "national-expenditure",
          sameAsPath: "/methodology/expenditure",
          origin: resolveSiteUrl(),
          path: "/explorer/expenditure",
          name: message(messages, "main.datasetExpenditureName"),
          description: expenditureDescription(messages, ownFacts),
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "main.georgia"),
          downloadPath: "/downloads/data/national-expenditure.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: message(messages, "common.budget"), path: pageHref(navGroup("budget").href, locale) }, { name: message(messages, "common.expenditure"), path: pageHref("/explorer/expenditure", locale) }]} />
      <MainExplorer
        presentation={clientPresentation(presentation)}
        nav="expenditure"
        facts={packFacts(ownFacts.map(projectBudgetFact))}
        adminFacts={packFacts(adminFacts.map(projectAdminFact))}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values(), publicGlossaryEntry)}
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
