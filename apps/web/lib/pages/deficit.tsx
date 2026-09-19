import { DEFICIT_SERIES_ID } from "../factQuery/types";
import type { Locale } from "../i18n/types";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { DeficitExplorer } from "../../components/deficit/deficit-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedGeneralGovernmentBalanceData } from "../data/servedData";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { coverageFromYears, fiscalMetadata, generalGovernmentDeficitMetadata } from "../seo/metadata";
import { DEFICIT_EXPLORER_PATH } from "../seo/internalLinks";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

function workbookSourcesFor(messages: Parameters<typeof message>[0]): WorkbookPublicSource[] { return [{
  years: Array.from({ length: 37 }, (_, index) => 1995 + index),
  title: message(messages, "deficit.workbookTitle"),
  organization: message(messages, "deficit.workbookOrganization"),
  downloadHref: "https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx",
  retrievedAt: "2026-09-04",
}]; }

export async function deficitPageMetadata(locale: Locale): Promise<Metadata> {
  const { facts } = await loadServedGeneralGovernmentBalanceData();
  if (locale === "ka") return generalGovernmentDeficitMetadata(facts);
  const { firstYear, lastYear } = coverageFromYears(facts.filter(fact => fact.status === "actual"));
  const messages = await getMessages(locale, ["deficit"]);
  return fiscalMetadata({ locale, title: message(messages, "deficit.metaTitle", { first: firstYear, last: lastYear }), description: message(messages, "deficit.description", { first: firstYear, last: lastYear }), path: DEFICIT_EXPLORER_PATH });
}

export async function renderDeficitPage(locale: Locale) {
  const { facts } = await loadServedGeneralGovernmentBalanceData();
  const presentation = await getPresentation(locale, ["common", "controls", "format", "main", "deficit"], [DEFICIT_SERIES_ID]);
  const { messages } = presentation;
  const { firstYear, lastYear } = coverageFromYears(facts);
  const lastUpdatedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const description = message(messages, "deficit.datasetDescription", { first: firstYear, last: lastYear });

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          datasetId: "general-government-balance",
          origin: resolveSiteUrl(),
          path: DEFICIT_EXPLORER_PATH,
          name: message(messages, "deficit.datasetName"),
          description,
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "deficit.georgia"),
          downloadPath: "/downloads/data/general-government-balance.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[
        { name: message(messages, "common.home"), path: pageHref("/", locale) },
        { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) },
        { name: message(messages, "common.deficit"), path: pageHref(DEFICIT_EXPLORER_PATH, locale) },
      ]} />
      <I18nProvider {...presentation}>
      <DeficitExplorer
        facts={facts}
        workbookSources={workbookSourcesFor(messages)}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
      </I18nProvider>
    </>
  );
}
