import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { AnalysisExplorer } from "../../components/analysis/analysis-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { publicGlossaryEntry } from "../data/glossary";
import { loadServedExplorerData } from "../data/servedData";
import { referencedSourceIds } from "../data/sources";
import { projectAdminFact, projectBudgetFact } from "../explorer/clientData";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import { ALL_DATA_PATH, navGroup } from "../navigation/navTree";

export async function analysisPageMetadata(locale: Locale): Promise<Metadata> {
  const [{ facts }, messages] = await Promise.all([loadServedExplorerData(), getMessages(locale, ["analysis"])]);
  const { lastYear } = coverageFromYears(facts);
  // The page opens on the last year. Actual wins over planned, so it reads as actuals only when it has an actual row.
  const planned = !facts.some((fact) => fact.year === lastYear && fact.basis === "actual");
  return fiscalMetadata({ locale,
    title: message(messages, planned ? "analysis.metadataTitlePlanned" : "analysis.metadataTitle", { year: lastYear }),
    description: message(messages, planned ? "analysis.metadataDescriptionPlanned" : "analysis.metadataDescription", { year: lastYear }),
    path: "/explorer/analysis",
  });
}

export async function renderAnalysisPage(locale: Locale) {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  // buildSingleYearSnapshotModel keeps only admin_category rows (singleYear.ts),
  // and the route's other admin readers agree: totalsByScope filters to the same
  // level, and yearsByScope.ministries needs a year set the category rows already
  // cover in full (the same years either way). So the 549 major_program rows were
  // 307 KB of payload this route has no way to render.
  const ownAdminFacts = adminFacts.filter((fact) => fact.level === "admin_category");
  // Date from the FULL corpus, so narrowing the payload cannot move the
  // displayed "განახლდა" date.
  const cited = referencedSourceIds([...facts, ...adminFacts]);
  const lastUpdatedAt = sourceDocuments
    .filter((source) => cited.has(source.sourceId))
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1) ?? "";

  // The snapshot model builds each item's English name beside the Georgian on both pages.
  const labelIds = [
    ...glossary.keys(), ...adminCategories.map(category => category.id),
    "snapshot.other", "expenditure.total", "revenue.total", "admin_spending.total",
  ];
  const presentation = await getPresentation(locale, ["format", "main", "analysis"], labelIds, labelIds);
  const { messages } = presentation;
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: message(messages, "common.budget"), path: pageHref(navGroup("budget").href, locale) }, { name: message(messages, "common.analysis"), path: pageHref("/explorer/analysis", locale) }]} />
      <AnalysisExplorer
        presentation={clientPresentation(presentation)}
        facts={facts.map(projectBudgetFact)}
        adminFacts={ownAdminFacts.map(projectAdminFact)}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values(), publicGlossaryEntry)}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
