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
import { isPlannedYear } from "../explorer/explorerData";
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

// Methodology route ids are the public URL vocabulary; the schema.org Dataset
// vocabulary is keyed by published dataset id, so the two are mapped here.
const DATASET_SCHEMA_IDS = {
  expenditure: "national-expenditure",
  revenue: "national-revenue",
  municipalities: "municipal-expenditure",
  debt: "government-debt",
  gdp: "gdp-overview",
  "economic-sectors": "economic-sectors",
  "gdp-expenditure": "gdp-expenditure",
  "expenditure-types": "expenditure-types",
  "regional-economies": "regional-economies",
  inflation: "inflation",
  unemployment: "unemployment",
  trade: "trade",
  "external-flows": "external-flows",
  wages: "wages",
  poverty: "poverty",
  "household-income": "household-income",
  health: "health",
  "social-protection": "social-protection",
  education: "education",
  "science-culture": "science-culture",
  crime: "crime",
  internet: "internet",
  "energy-food": "energy-food",
  environment: "environment",
  transport: "transport",
  money: "money",
  business: "business",
  housing: "housing",
} as const;

const DATASET_SOURCE_NOTES = {
  expenditure: "common.budgetSourceNote",
  revenue: "common.budgetSourceNote",
  municipalities: "common.budgetSourceNote",
  debt: "common.budgetSourceNote",
  gdp: "common.economySourceNote",
  "economic-sectors": "common.geostatSourceNote",
  "gdp-expenditure": "common.geostatSourceNote",
  "expenditure-types": "common.budgetStatisticsSourceNote",
  "regional-economies": "common.geostatSourceNote",
  inflation: "common.inflationSourceNote",
  unemployment: "common.geostatSourceNote",
  trade: "common.geostatSourceNote",
  "external-flows": "common.nbgSourceNote",
  demography: "common.geostatSourceNote",
  wages: "common.geostatSourceNote",
  poverty: "common.geostatSourceNote",
  "household-income": "common.geostatSourceNote",
  health: "common.geostatSourceNote",
  "social-protection": "common.socialSourceNote",
  education: "common.geostatSourceNote",
  "science-culture": "common.geostatSourceNote",
  crime: "common.geostatSourceNote",
  internet: "common.geostatSourceNote",
  "energy-food": "common.geostatSourceNote",
  environment: "common.geostatSourceNote",
  transport: "common.geostatSourceNote",
  money: "common.nbgSourceNote",
  business: "common.geostatSourceNote",
  housing: "common.geostatSourceNote",
} as const;

const DATASET_DOWNLOADS = {
  expenditure: "/downloads/data/national-expenditure.csv",
  revenue: "/downloads/data/national-revenue.csv",
  municipalities: "/downloads/data/municipal-expenditure.csv",
  debt: "/downloads/data/government-debt.csv",
  gdp: "/downloads/data/gdp-overview.csv",
  "economic-sectors": "/downloads/data/economic-sectors.csv",
  "gdp-expenditure": null,
  "expenditure-types": null,
  "regional-economies": "/downloads/data/regional-economies.csv",
  inflation: "/downloads/data/inflation-cpi-national.csv",
  unemployment: null,
  trade: null,
  "external-flows": null,
  // Demography has no bulk files and no MCP entry yet (spec section 10).
  demography: null,
  wages: null,
  poverty: null,
  "household-income": null,
  health: null,
  "social-protection": null,
  education: null,
  "science-culture": null,
  crime: null,
  internet: null,
  "energy-food": null,
  environment: null,
  transport: null,
  money: null,
  business: null,
  housing: null,
} as const;

// Spec 12.2: the expenditure methodology links both the expenditure and the
// ministries JSON. ministries.json has no CSV counterpart in this family, so
// this page is its only published entry point.
const DATASET_JSON_DOWNLOADS = {
  "economic-sectors": [{ href: "/downloads/data/economic-sectors.json", labelKey: "methodology.jsonSectors" }],
  "gdp-expenditure": [],
  "expenditure-types": [],
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
  trade: [],
  "external-flows": [],
  demography: [],
  wages: [],
  poverty: [],
  "household-income": [],
  health: [],
  "social-protection": [],
  education: [],
  "science-culture": [],
  crime: [],
  internet: [],
  "energy-food": [],
  environment: [],
  transport: [],
  money: [],
  business: [],
  housing: [],
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
  "gdp-expenditure": [],
  "expenditure-types": [],
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
  trade: [],
  "external-flows": [],
  demography: [],
  wages: [],
  poverty: [],
  "household-income": [],
  health: [],
  "social-protection": [],
  education: [],
  "science-culture": [],
  crime: [],
  internet: [],
  "energy-food": [],
  environment: [],
  transport: [],
  money: [],
  business: [],
  housing: [],
} as const;

const METHODOLOGY_WORD = /methodology|მეთოდოლოგია/i;

export async function methodologyArticleMetadata(locale: Locale, { params }: MethodologyDatasetPageProps): Promise<Metadata> {
  const dataset = validatedDataset((await params).dataset);
  const content = getMethodologyContent(dataset, locale);
  const messages = await getMessages(locale, ["common", "methodology"]);
  // "Expenditure methodology" already says what the suffix would add.
  const title = METHODOLOGY_WORD.test(content.title) ? content.title : message(messages, "methodology.articleMetaTitle", { title: content.title });
  const canonical = `/methodology/${dataset}` as const;

  return fiscalMetadata({ locale,
    title,
    description: content.metaDescription ?? content.summary,
    path: canonical,
    type: "article",
  });
}

export async function renderMethodologyArticle(locale: Locale, { params }: MethodologyDatasetPageProps) {
  const dataset = validatedDataset((await params).dataset);
  const content = getMethodologyContent(dataset, locale);
  const messages = await getMessages(locale, ["common", "methodology"]);
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  // Only an article whose coverage line is drawn from served facts loads them,
  // and only the facts its coverage source names; a build renders every article
  // in two locales. The kind is not hard-coded here: this reads the same record
  // deriveMethodologyCoverage reads — the Georgian one, whatever the locale — so
  // the two cannot drift.
  const coverageKind = METHODOLOGY_CONTENT[dataset].coverageSource.kind;
  const [landingData, municipalData, debtData, archiveSummaries, rows, catalogue] = await Promise.all([
    coverageKind === "budgetSide" ? loadServedLandingData() : Promise.resolve({ facts: [] }),
    coverageKind === "municipalTotals" ? loadServedMunicipalData() : Promise.resolve({ totalFacts: [] }),
    coverageKind === "governmentDebt" ? loadServedGovernmentDebtData() : Promise.resolve({ facts: [] }),
    loadGeneratedArchiveSummaries(repositoryRoot),
    loadReviewedSourceManifest(repositoryRoot, content.archiveManifestId),
    loadEnglishCatalogue(repositoryRoot),
  ]);
  const coverage = deriveMethodologyCoverage(dataset, landingData.facts, municipalData.totalFacts, debtData.facts, archiveSummaries[dataset]);
  // A budget side whose latest year holds a planned value names it apart from the actual years in its basis line.
  const coverageSource = METHODOLOGY_CONTENT[dataset].coverageSource;
  const plannedYear = coverageSource.kind === "budgetSide" && isPlannedYear(landingData.facts, coverageSource.side, coverage.lastYear)
    ? {
        year: coverage.lastYear,
        lastActualYear: Math.max(...landingData.facts.filter((fact) => fact.side === coverageSource.side && fact.year < coverage.lastYear).map((fact) => fact.year)),
      }
    : undefined;
  const publicRows = projectPublicSources(rows, locale, catalogue.documents);

  return (
    <>
      {/* Demography has no Dataset markup yet (spec section 10): its page keeps the breadcrumb and the archived originals. */}
      {dataset === "demography" ? null : (
      <JsonLd
        // A dataset with no bulk file (DATASET_DOWNLOADS null) claims no distribution.
        data={datasetJsonLd({ locale,
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
      )}
      <MethodologyArticle
        locale={locale}
        messages={messages}
        content={content}
        coverage={coverage}
        plannedYear={plannedYear}
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
