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
import { loadImfWeoManifest, type ImfWeoManifest } from "../methodology/workbookSources";
import { resolveSiteUrl } from "../siteUrl";
import { projectBalanceFact } from "../explorer/clientData";

function editionLabel(messages: Parameters<typeof message>[0], publicationDate: string): string {
  const [year, month] = publicationDate.split("-");
  return message(messages, "deficit.weoEdition", {
    year: year!,
    month: message(messages, `deficit.weoMonth.${Number(month)}`),
  });
}

function workbookSourcesFor(
  messages: Parameters<typeof message>[0],
  manifest: ImfWeoManifest,
  edition: string,
): WorkbookPublicSource[] {
  return [{
    years: Array.from({ length: manifest.yearMax - manifest.yearMin + 1 }, (_, index) => manifest.yearMin + index),
    title: message(messages, "deficit.workbookTitle", { edition }),
    organization: message(messages, "deficit.workbookOrganization"),
    downloadHref: manifest.retrievedFileUrl as `https://${string}`,
    retrievedAt: manifest.retrievedAt,
  }];
}

export async function deficitPageMetadata(locale: Locale): Promise<Metadata> {
  const { facts } = await loadServedGeneralGovernmentBalanceData();
  if (locale === "ka") return generalGovernmentDeficitMetadata(facts);
  const { firstYear, lastYear } = coverageFromYears(facts.filter(fact => fact.status === "actual"));
  const messages = await getMessages(locale, ["deficit"]);
  return fiscalMetadata({ locale, title: message(messages, "deficit.metaTitle", { first: firstYear, last: lastYear }), description: message(messages, "deficit.description", { first: firstYear, last: lastYear }), path: DEFICIT_EXPLORER_PATH });
}

export async function renderDeficitPage(locale: Locale) {
  const [{ facts }, manifest] = await Promise.all([
    loadServedGeneralGovernmentBalanceData(),
    loadImfWeoManifest(),
  ]);
  const presentation = await getPresentation(locale, ["common", "controls", "format", "main", "deficit"], ["deficit.general_government_balance"]);
  const { messages } = presentation;
  const { firstYear, lastYear } = coverageFromYears(facts);
  const lastUpdatedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const edition = editionLabel(messages, manifest.publicationDate);
  const projections = facts.filter((fact) => fact.status === "projection").map((fact) => fact.year);
  const description = message(messages, "deficit.datasetDescription", {
    first: firstYear,
    last: lastYear,
    projectionFirst: projections[0] ?? lastYear,
    projectionLast: projections.at(-1) ?? lastYear,
  });

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
        facts={facts.map(projectBalanceFact)}
        workbookSources={workbookSourcesFor(messages, manifest, edition)}
        edition={edition}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
      </I18nProvider>
    </>
  );
}
