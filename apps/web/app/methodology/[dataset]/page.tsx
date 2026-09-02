import type { Metadata } from "next";
import { notFound } from "next/navigation";
import path from "node:path";
import { MethodologyArticle } from "../../../components/methodology/methodology-article";
import { JsonLd } from "../../../components/seo/json-ld";
import { SiteFooter } from "../../../components/site/site-footer";
import { loadServedLandingData, loadServedMunicipalData } from "../../../lib/data/servedData";
import {
  deriveMethodologyCoverage,
  LIVE_METHODOLOGY_IDS,
  METHODOLOGY_CONTENT,
} from "../../../lib/methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../../../lib/methodology/prepareArchives";
import { loadReviewedSourceManifest } from "../../../lib/methodology/sourceManifest";
import type { MethodologyDatasetId } from "../../../lib/methodology/types";
import { fiscalMetadata } from "../../../lib/seo/metadata";
import { datasetJsonLd } from "../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../lib/siteUrl";

type MethodologyDatasetPageProps = {
  params: Promise<{ dataset: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
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
} as const;

// Spec 12.2: the expenditure methodology links both the expenditure and the
// ministries JSON. ministries.json has no CSV counterpart in this family, so
// this page is its only published entry point.
const DATASET_JSON_DOWNLOADS = {
  expenditure: ["/downloads/data/national-expenditure.json", "/downloads/data/ministries.json"],
  revenue: ["/downloads/data/national-revenue.json"],
  municipalities: ["/downloads/data/municipal-expenditure.json"],
} as const;

export async function generateMetadata({ params }: MethodologyDatasetPageProps): Promise<Metadata> {
  const dataset = validatedDataset((await params).dataset);
  const content = METHODOLOGY_CONTENT[dataset];
  const title = `${content.titleKa} — მეთოდოლოგია და მონაცემები | Fiscal.ge`;
  const canonical: `/methodology/${MethodologyDatasetId}` = `/methodology/${dataset}`;

  return fiscalMetadata({
    title,
    description: content.summaryKa,
    path: canonical,
    type: "article",
  });
}

export default async function MethodologyDatasetPage({ params }: MethodologyDatasetPageProps) {
  const dataset = validatedDataset((await params).dataset);
  const content = METHODOLOGY_CONTENT[dataset];
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [landingData, municipalData, archiveSummaries, rows] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadGeneratedArchiveSummaries(repositoryRoot),
    loadReviewedSourceManifest(repositoryRoot, content.archiveManifestId),
  ]);
  const coverage = deriveMethodologyCoverage(dataset, landingData.facts, municipalData.totalFacts);
  const updatedAt = landingData.sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const publicRows = rows.map((row) => ({
    source_id: row.source_id,
    year: row.year,
    years: row.years,
    source_organization: row.source_organization,
    display_title_ka: row.display_title_ka,
    official_filename: row.official_filename,
    media_type: row.media_type,
    byte_size: row.byte_size,
    downloadHref: row.downloadHref,
  }));

  return (
    <>
      <JsonLd
        data={datasetJsonLd({
          origin: resolveSiteUrl(),
          path: `/methodology/${dataset}`,
          name: content.titleKa,
          description: content.summaryKa,
          firstYear: coverage.firstYear,
          lastYear: coverage.lastYear,
          dateModified: content.reviewedAt,
          downloadPath: DATASET_DOWNLOADS[dataset],
          jsonDownloadPaths: DATASET_JSON_DOWNLOADS[dataset],
        })}
        testId="dataset-json-ld"
      />
      <MethodologyArticle
        content={content}
        coverage={coverage}
        rows={publicRows}
        archiveSummary={archiveSummaries[dataset]}
        processedDataHref={DATASET_DOWNLOADS[dataset]}
        processedDataJsonHrefs={DATASET_JSON_DOWNLOADS[dataset]}
        breadcrumbItems={[
          { name: "მთავარი", path: "/" },
          { name: "მეთოდოლოგია", path: "/methodology" },
          { name: content.titleKa, path: `/methodology/${dataset}` },
        ]}
      />
      <div className="mx-auto w-full max-w-[1240px] px-5 min-[768px]:px-7">
        <SiteFooter updatedAt={updatedAt} />
      </div>
    </>
  );
}
