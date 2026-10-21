import type { Locale } from "../i18n/types";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { DebtExplorer } from "../../components/debt/debt-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedExplorerData, loadServedGovernmentDebtData } from "../data/servedData";
import { projectDebtFact, projectGdpFact } from "../explorer/clientData";
import { coverageFromYears, governmentDebtMetadata } from "../seo/metadata";
import { DEBT_EXPLORER_PATH } from "../seo/internalLinks";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { loadDebtWorkbookSources, loadGdpWorkbookSources } from "../methodology/workbookSources";

export async function debtPageMetadata(locale: Locale): Promise<Metadata> {
  const { facts } = await loadServedGovernmentDebtData();
  return governmentDebtMetadata(facts, locale);
}

export async function renderDebtPage(locale: Locale) {
  const [{ facts }, { gdpFacts }, workbookSources, gdpWorkbookSources] = await Promise.all([
    loadServedGovernmentDebtData(),
    loadServedExplorerData(),
    loadDebtWorkbookSources(locale),
    loadGdpWorkbookSources(locale),
  ]);
  // The debt model builds each series' English name beside the Georgian on both pages.
  const seriesIds = [...new Set(facts.map(fact => fact.seriesId))];
  const presentation = await getPresentation(locale, ["format", "main", "debt"], seriesIds, seriesIds);
  const { messages } = presentation;
  const stockFacts = facts.filter((fact) => fact.family === "stock" && fact.status === "actual");
  const { firstYear, lastYear } = coverageFromYears(stockFacts);
  const { firstYear: datasetFirstYear, lastYear: datasetLastYear } = coverageFromYears(facts);
  const lastUpdatedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const description = message(messages, "debt.description", { first: firstYear, last: lastYear });
  const datasetDescription = `${description} ${message(messages, "debt.datasetForecast")}`;

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          datasetId: "government-debt",
          sameAsPath: "/methodology/debt",
          origin: resolveSiteUrl(),
          path: DEBT_EXPLORER_PATH,
          name: message(messages, "debt.datasetName"),
          description: datasetDescription,
          firstYear: datasetFirstYear,
          lastYear: datasetLastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "debt.georgia"),
          downloadPath: "/downloads/data/government-debt.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[
        { name: message(messages, "common.home"), path: pageHref("/", locale) },
        { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) },
        { name: message(messages, "common.debt"), path: pageHref(DEBT_EXPLORER_PATH, locale) },
      ]} />
      <I18nProvider {...clientPresentation(presentation)}>
      <DebtExplorer
        facts={facts.map(projectDebtFact)}
        gdpFacts={gdpFacts.filter((fact) => fact.year >= datasetFirstYear && fact.year <= datasetLastYear).map(projectGdpFact)}
        workbookSources={workbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
      </I18nProvider>
    </>
  );
}
