import type { Locale } from "../i18n/types";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { pageHref } from "../i18n/routes";
import { projectPublicSources } from "../methodology/publicSources";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import path from "node:path";
import { MethodologyArticle } from "../../components/methodology/methodology-article";
import { JsonLd } from "../../components/seo/json-ld";
import { SiteFooter } from "../../components/site/site-footer";
import { loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import {
  deriveMethodologyCoverage,
  LIVE_METHODOLOGY_IDS,
  getMethodologyContent,
} from "../methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../methodology/prepareArchives";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import type { MethodologyDatasetId } from "../methodology/types";
import { fiscalMetadata } from "../seo/metadata";
import { datasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

export type MethodologyDatasetPageProps = {
  params: Promise<{ dataset: string }>;
};

export function methodologyStaticParams() {
  return LIVE_METHODOLOGY_IDS.map((dataset) => ({ dataset }));
}

function isMethodologyDatasetId(value: string): value is MethodologyDatasetId {
  return LIVE_METHODOLOGY_IDS.some((dataset) => dataset === value);
}

function validatedDataset(value: string): MethodologyDatasetId {
  if (!isMethodologyDatasetId(value)) notFound();
  return value;
}

const DATASET_DOWNLOADS = {
  expenditure: "/downloads/data/national-expenditure.csv",
  revenue: "/downloads/data/national-revenue.csv",
  municipalities: "/downloads/data/municipal-expenditure.csv",
  debt: "/downloads/data/government-debt.csv",
} as const;

// Spec 12.2: the expenditure methodology links both the expenditure and the
// ministries JSON. ministries.json has no CSV counterpart in this family, so
// this page is its only published entry point.
const DATASET_JSON_DOWNLOADS = {
  expenditure: [
    { href: "/downloads/data/national-expenditure.json", labelKey: "methodology.jsonExpenditure" },
    { href: "/downloads/data/ministries.json", labelKey: "methodology.jsonMinistries" },
  ],
  revenue: [{ href: "/downloads/data/national-revenue.json", labelKey: "methodology.jsonRevenue" }],
  municipalities: [{ href: "/downloads/data/municipal-expenditure.json", labelKey: "methodology.jsonMunicipalities" }],
  debt: [
    { href: "/downloads/data/government-debt.json", labelKey: "methodology.jsonDebt" },
    { href: "/downloads/data/government-debt-rates.json", labelKey: "methodology.jsonRates" },
  ],
} as const;

// Only the file that IS this dataset in another format belongs in the Dataset
// node's distribution. ministries.json is a separate published dataset (spec
// 12.1), so it stays a human link on this page and is not claimed as a
// distribution of national expenditure.
const DATASET_JSON_DISTRIBUTIONS = {
  expenditure: ["/downloads/data/national-expenditure.json"],
  revenue: ["/downloads/data/national-revenue.json"],
  municipalities: ["/downloads/data/municipal-expenditure.json"],
  // Only the amounts file is a distribution OF this dataset; the rates
  // file is a different measure of it and stays a human link above.
  debt: ["/downloads/data/government-debt.json"],
} as const;

export async function methodologyArticleMetadata(locale: Locale, { params }: MethodologyDatasetPageProps): Promise<Metadata> {
  const dataset = validatedDataset((await params).dataset);
  const content = getMethodologyContent(dataset, locale);
  const messages = await getMessages(locale, ["common", "methodology"]);
  const title = message(messages, "methodology.articleMetaTitle", { title: content.title });
  const canonical = `/methodology/${dataset}` as const;

  return fiscalMetadata({ locale,
    title,
    description: content.summary,
    path: canonical,
    type: "article",
  });
}

export async function renderMethodologyArticle(locale: Locale, { params }: MethodologyDatasetPageProps) {
  const dataset = validatedDataset((await params).dataset);
  const content = getMethodologyContent(dataset, locale);
  const messages = await getMessages(locale, ["common", "methodology"]);
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [landingData, municipalData, debtData, archiveSummaries, rows, catalogue] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadGeneratedArchiveSummaries(repositoryRoot),
    loadReviewedSourceManifest(repositoryRoot, content.archiveManifestId),
    loadEnglishCatalogue(repositoryRoot),
  ]);
  const coverage = deriveMethodologyCoverage(dataset, landingData.facts, municipalData.totalFacts, debtData.facts);
  const updatedAt = landingData.sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const publicRows = projectPublicSources(rows, locale, catalogue.documents);

  return (
    <>
      <JsonLd
        data={datasetJsonLd({ locale,
          origin: resolveSiteUrl(),
          path: locale === "en" ? `/en/methodology/${dataset}` : `/methodology/${dataset}`,
          name: content.title,
          description: content.summary,
          firstYear: coverage.firstYear,
          lastYear: coverage.lastYear,
          dateModified: content.reviewedAt,
          downloadPath: DATASET_DOWNLOADS[dataset],
          jsonDownloadPaths: DATASET_JSON_DISTRIBUTIONS[dataset],
        })}
        testId="dataset-json-ld"
      />
      <MethodologyArticle
        locale={locale}
        messages={messages}
        content={content}
        coverage={coverage}
        rows={publicRows}
        archiveSummary={archiveSummaries[dataset]}
        processedDataHref={DATASET_DOWNLOADS[dataset]}
        processedDataJsonLinks={DATASET_JSON_DOWNLOADS[dataset].map(link => ({ href: link.href, label: message(messages, link.labelKey) }))}
        breadcrumbItems={[
          { name: message(messages, "common.home"), path: pageHref("/", locale) },
          { name: message(messages, "common.methodology"), path: pageHref("/methodology", locale) },
          { name: content.title, path: pageHref(`/methodology/${dataset}`, locale) },
        ]}
      />
      <div className="mx-auto w-full max-w-[1240px] px-5 min-[768px]:px-7">
        <SiteFooter locale={locale} updatedAt={updatedAt} />
      </div>
    </>
  );
}
