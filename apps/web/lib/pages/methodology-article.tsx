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
  METHODOLOGY_CONTENT,
} from "../methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../methodology/prepareArchives";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import type { MethodologyDatasetId } from "../methodology/types";
import { fiscalMetadata } from "../seo/metadata";
import { catalogReference, datasetJsonLd } from "../seo/structuredData";
import { seoMessage } from "../seo/strings";
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

// Methodology route ids are the public URL vocabulary; the schema.org Dataset
// vocabulary is keyed by published dataset id, so the two are mapped here.
const DATASET_SCHEMA_IDS = {
  expenditure: "national-expenditure",
  revenue: "national-revenue",
  municipalities: "municipal-expenditure",
  debt: "government-debt",
  gdp: "gdp-overview",
  "economic-sectors": "economic-sectors",
  "regional-economies": "regional-economies",
} as const;

const DATASET_SOURCE_NOTES = {
  expenditure: "common.budgetSourceNote",
  revenue: "common.budgetSourceNote",
  municipalities: "common.budgetSourceNote",
  debt: "common.budgetSourceNote",
  gdp: "common.economySourceNote",
  "economic-sectors": "common.geostatSourceNote",
  "regional-economies": "common.geostatSourceNote",
  inflation: "common.inflationSourceNote",
  unemployment: "common.geostatSourceNote",
} as const;

const DATASET_DOWNLOADS = {
  expenditure: "/downloads/data/national-expenditure.csv",
  revenue: "/downloads/data/national-revenue.csv",
  municipalities: "/downloads/data/municipal-expenditure.csv",
  debt: "/downloads/data/government-debt.csv",
  gdp: "/downloads/data/gdp-overview.csv",
  "economic-sectors": "/downloads/data/economic-sectors.csv",
  "regional-economies": "/downloads/data/regional-economies.csv",
  inflation: "/downloads/data/inflation-cpi-national.csv",
  unemployment: null,
} as const;

// Spec 12.2: the expenditure methodology links both the expenditure and the
// ministries JSON. ministries.json has no CSV counterpart in this family, so
// this page is its only published entry point.
const DATASET_JSON_DOWNLOADS = {
  "economic-sectors": [{ href: "/downloads/data/economic-sectors.json", labelKey: "methodology.jsonSectors" }],
  "regional-economies": [{ href: "/downloads/data/regional-economies.json", labelKey: "methodology.jsonRegionalEconomies" }],
  expenditure: [
    { href: "/downloads/data/national-expenditure.json", labelKey: "methodology.jsonExpenditure" },
    { href: "/downloads/data/ministries.json", labelKey: "methodology.jsonMinistries" },
  ],
  revenue: [{ href: "/downloads/data/national-revenue.json", labelKey: "methodology.jsonRevenue" }],
  municipalities: [{ href: "/downloads/data/municipal-expenditure.json", labelKey: "methodology.jsonMunicipalities" }],
  gdp: [],
  inflation: [],
  unemployment: [],
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
  "economic-sectors": ["/downloads/data/economic-sectors.json"],
  "regional-economies": ["/downloads/data/regional-economies.json"],
  expenditure: ["/downloads/data/national-expenditure.json"],
  revenue: ["/downloads/data/national-revenue.json"],
  municipalities: ["/downloads/data/municipal-expenditure.json"],
  // Only the amounts file is a distribution OF this dataset; the rates
  // file is a different measure of it and stays a human link above.
  debt: ["/downloads/data/government-debt.json"],
  gdp: [],
  inflation: [],
  unemployment: [],
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
    // Only an article whose coverage line is drawn from the debt facts needs
    // them, and a build renders eight articles in two locales. The id is not
    // hard-coded here: this reads the same record deriveMethodologyCoverage
    // reads — the Georgian one, whatever the locale — so the two cannot drift.
    METHODOLOGY_CONTENT[dataset].coverageSource.kind === "governmentDebt"
      ? loadServedGovernmentDebtData()
      : Promise.resolve({ facts: [] }),
    loadGeneratedArchiveSummaries(repositoryRoot),
    loadReviewedSourceManifest(repositoryRoot, content.archiveManifestId),
    loadEnglishCatalogue(repositoryRoot),
  ]);
  const coverage = deriveMethodologyCoverage(dataset, landingData.facts, municipalData.totalFacts, debtData.facts, archiveSummaries[dataset]);
  const publicRows = projectPublicSources(rows, locale, catalogue.documents);

  return (
    <>
      <JsonLd
        data={dataset === "unemployment" ? {
          "@context": "https://schema.org", "@type": "Dataset", name: content.title, description: content.summary,
          url: `${resolveSiteUrl()}${pageHref("/methodology/unemployment", locale)}`,
          temporalCoverage: `${coverage.firstYear}/${coverage.lastYear}`, inLanguage: ["ka", "en"], dateModified: content.reviewedAt,
          spatialCoverage: { "@type": "Place", name: seoMessage(locale, "seo.country") },
          creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" },
          publisher: { "@id": `${resolveSiteUrl()}/#organization` },
        } : dataset === "inflation" ? {
          "@context":"https://schema.org", "@type":"Dataset", "@id":`${resolveSiteUrl()}/methodology/${dataset}`, name:content.title, description:content.summary,
          url:`${resolveSiteUrl()}${pageHref(`/methodology/${dataset}`,locale)}`, temporalCoverage:`${coverage.firstYear}/${coverage.lastYear}`,
          inLanguage:["ka","en"], dateModified:content.reviewedAt, spatialCoverage:{"@type":"Place",name:seoMessage(locale,"seo.country")},
          creator:{"@id":`${resolveSiteUrl()}/#organization`}, publisher:{"@id":`${resolveSiteUrl()}/#organization`},
          includedInDataCatalog:catalogReference(resolveSiteUrl(),locale), license:"https://creativecommons.org/licenses/by/4.0/",
          distribution:{"@type":"DataDownload",encodingFormat:"text/csv",contentUrl:`${resolveSiteUrl()}${DATASET_DOWNLOADS[dataset]}`}
        } : datasetJsonLd({ locale,
          origin: resolveSiteUrl(),
          path: locale === "en" ? `/en/methodology/${dataset}` : `/methodology/${dataset}`,
          datasetId: DATASET_SCHEMA_IDS[dataset],
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
        <SiteFooter locale={locale} sourceNote={message(messages, DATASET_SOURCE_NOTES[dataset])} />
      </div>
    </>
  );
}
