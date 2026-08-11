import type { Metadata } from "next";
import { notFound } from "next/navigation";
import path from "node:path";
import { MethodologyArticle } from "../../../components/methodology/methodology-article";
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

export async function generateMetadata({ params }: MethodologyDatasetPageProps): Promise<Metadata> {
  const dataset = validatedDataset((await params).dataset);
  const content = METHODOLOGY_CONTENT[dataset];
  const title = `${content.titleKa} — GeoData`;
  const canonical = `/methodology/${dataset}`;

  return {
    title,
    description: content.summaryKa,
    alternates: { canonical },
    openGraph: {
      type: "article",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: canonical,
      title,
      description: content.summaryKa,
    },
  };
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
      <MethodologyArticle
        content={content}
        coverage={coverage}
        rows={publicRows}
        archiveSummary={archiveSummaries[dataset]}
      />
      <div className="mx-auto w-full max-w-[1240px] px-5 min-[768px]:px-7">
        <SiteFooter updatedAt={updatedAt} />
      </div>
    </>
  );
}
