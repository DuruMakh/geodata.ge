import { notFound } from "next/navigation";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import {
  RegionalEconomyExplorer,
  type RegionalEconomyIdentity,
} from "../../components/regional-economies/regional-economy-explorer";
import {
  loadServedRegionalEconomyData,
  REGIONAL_ECONOMY_REGIONS,
  REGIONAL_ECONOMY_SECTORS,
} from "../data/regionalEconomies/importRegionalEconomies";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import path from "node:path";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
export {
  regionalEconomiesPageMetadata,
  renderRegionalEconomiesPage,
} from "./regional-economies";

export function regionalEconomyStaticParams() {
  return REGIONAL_ECONOMY_REGIONS.map((region) => ({ id: region.id.replace(/^region\./, "") }));
}

function regionForSlug(slug: string) {
  const region = REGIONAL_ECONOMY_REGIONS.find((candidate) => candidate.id === `region.${slug}`);
  if (!region) notFound();
  return region;
}

async function regionalPresentation(locale: Locale) {
  return getPresentation(
    locale,
    ["regionalEconomies", "common", "controls", "format", "main", "workbook"],
    [...REGIONAL_ECONOMY_REGIONS.map((region) => region.id), ...REGIONAL_ECONOMY_SECTORS.map((sector) => sector.id)],
  );
}

export async function regionalEconomyPageMetadata(slug: string, locale: Locale) {
  const region = regionForSlug(slug);
  const presentation = await regionalPresentation(locale);
  const regionName = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
  return fiscalMetadata({
    locale,
    path: `/explorer/economy/regions/${slug}`,
    title: message(presentation.messages, "regionalEconomies.detailMetaTitle", { region: regionName }),
    description: message(presentation.messages, "regionalEconomies.detailMetaDescription", { region: regionName }),
  });
}

export async function renderRegionalEconomyPage(slug: string, locale: Locale) {
  const region = regionForSlug(slug);
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [{ facts }, presentation, manifest, catalogue] = await Promise.all([
    loadServedRegionalEconomyData(),
    regionalPresentation(locale),
    loadReviewedSourceManifest(repositoryRoot, "regional-economies"),
    loadEnglishCatalogue(repositoryRoot),
  ]);
  const regionName = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
  const identity: RegionalEconomyIdentity = {
    id: region.id,
    slug,
    labelKa: region.kaLabel,
    labelEn: publicLabel("en", region.id, region.kaLabel, presentation.englishLabels),
  };
  const regionalFacts = facts.filter((fact) => fact.regionId === region.id);
  if (regionalFacts.length === 0) notFound();
  const firstYear = Math.min(...regionalFacts.map((fact) => fact.year));
  const lastYear = Math.max(...regionalFacts.map((fact) => fact.year));
  const reviewedAt = regionalFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!;
  const title = message(presentation.messages, "regionalEconomies.heading");
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.map((source) => {
    const translated = publicSources.find((candidate) => candidate.source_id === source.source_id)!;
    return {
      sourceId: source.source_id,
      years: source.years,
      title: translated.title,
      organization: translated.publisher,
      downloadHref: source.downloadHref,
      retrievedAt: source.retrieved_at,
    };
  });
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(presentation.messages, "common.data") },
    { label: message(presentation.messages, "common.economy"), href: pageHref("/explorer/economy", locale) },
    { label: title, href: pageHref("/explorer/economy/regions", locale) },
    { label: regionName },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref("/explorer/economy", locale) },
        { name: title, path: pageHref("/explorer/economy/regions", locale) },
        { name: regionName, path: pageHref(`/explorer/economy/regions/${slug}`, locale) },
      ]} />
      <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
        <div className="@container mx-auto max-w-[1180px]">
          <PageHeader crumbs={crumbs} coverage={`${firstYear}–${lastYear} · ${reviewedAt}`} />
          <RegionalEconomyExplorer
            facts={regionalFacts}
            registry={REGIONAL_ECONOMY_SECTORS}
            region={identity}
            regions={REGIONAL_ECONOMY_REGIONS}
            sources={sources}
            siteOrigin={resolveSiteUrl()}
          />
        </div>
      </main>
    </I18nProvider>
  );
}
