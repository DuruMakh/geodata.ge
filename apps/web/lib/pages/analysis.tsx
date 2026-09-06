import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { getPresentation } from "../i18n/presentation.server";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedExplorerData } from "../data/servedData";
import { referencedSourceIds } from "../data/sources";
import { projectAdminFact, projectBudgetFact } from "../explorer/clientData";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";

export async function analysisPageMetadata(locale: Locale): Promise<Metadata> {
  const [{ facts }, messages] = await Promise.all([loadServedExplorerData(), getMessages(locale, ["analysis"])]);
  const { lastYear } = coverageFromYears(facts);
  return fiscalMetadata({
    title: message(messages, "analysis.metadataTitle", { year: lastYear }),
    description: message(messages, "analysis.metadataDescription", { year: lastYear }),
    path: pageHref("/explorer/analysis", locale),
  });
}

export async function renderAnalysisPage(locale: Locale) {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  // buildSingleYearSnapshotModel keeps only admin_category rows (singleYear.ts),
  // and the route's other admin readers agree: totalsByScope filters to the same
  // level, and yearsByScope.ministries needs a year set the category rows already
  // cover in full (2004-2025 either way). So the 549 major_program rows were
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

  const presentation = await getPresentation(locale, ["common", "controls", "format", "main", "analysis"], [
    ...glossary.keys(), ...adminCategories.map(category => category.id),
    "snapshot.other", "expenditure.total", "revenue.total", "admin_spending.total",
  ]);
  const { messages } = presentation;
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }, { name: message(messages, "common.analysis"), path: pageHref("/explorer/analysis", locale) }]} />
      <MainExplorer
        presentation={presentation}
        nav="analysis"
        facts={facts.map(projectBudgetFact)}
        adminFacts={ownAdminFacts.map(projectAdminFact)}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values())}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
