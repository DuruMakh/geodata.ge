import { JsonLd } from "../../components/seo/json-ld";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import path from "node:path";
import { GdpOverview } from "../../components/gdp/gdp-overview";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { projectGdpObservation, sourceIdRangesBySeries } from "../explorer/clientData";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { projectPublicSources } from "../methodology/publicSources";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { pageHref } from "../i18n/routes";
export async function gdpPageMetadata(locale: Locale) {
  const m = await getMessages(locale, ["gdp"]);
  return fiscalMetadata({
    locale,
    path: "/explorer/economy/gdp",
    title: message(m, "gdp.metaTitle"),
    description: message(m, "gdp.metaDescription"),
  });
}
export async function renderGdpPage(locale: Locale) {
  const [{ facts }, presentation, manifest] = await Promise.all([
    loadServedGdpOverviewData(),
    getPresentation(
      locale,
      ["gdp", "common", "controls", "format", "main"],
      [],
    ),
    loadReviewedSourceManifest(
      path.resolve(/* turbopackIgnore: true */ process.cwd(), "../.."),
      "gdp",
    ),
  ]);
  const catalogue = await loadEnglishCatalogue(
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "../.."),
  );
  const publicSources = projectPublicSources(
    manifest,
    locale,
    catalogue.documents,
  );
  const sources = manifest.flatMap((s) => {
    const translated = publicSources.find((p) => p.source_id === s.source_id)!;
    const ids = s.source_id.includes("metadata")
      ? ["source.wb_gdp_real_usd_2015", "source.wb_gdp_real_growth_percent"]
      : [s.source_id];
    return ids.map((sourceId) => ({
      sourceId,
      years: s.years,
      title: translated.title,
      organization: translated.publisher,
      downloadHref: s.downloadHref,
      retrievedAt: s.retrieved_at,
    }));
  });
  return (
    <I18nProvider {...presentation}>
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({locale,datasetId:"gdp-overview",origin:resolveSiteUrl(),path:"/explorer/economy/gdp",name:message(presentation.messages,"gdp.heading"),description:message(presentation.messages,"gdp.description"),firstYear:Math.min(...facts.map(f=>f.year)),lastYear:Math.max(...facts.map(f=>f.year)),dateModified:facts.map(f=>f.lastReviewedAt).sort().at(-1)!,spatialCoverageName:locale==="ka"?"საქართველო":"Georgia",downloadPath:"/downloads/data/gdp-overview.csv"})}/>

      <BreadcrumbJsonLd
        items={[
          {
            name: message(presentation.messages, "common.home"),
            path: pageHref("/", locale),
          },
          {
            name: message(presentation.messages, "gdp.economy"),
            path: pageHref("/explorer/economy", locale),
          },
          {
            name: message(presentation.messages, "gdp.heading"),
            path: pageHref("/explorer/economy/gdp", locale),
          },
        ]}
      />
      <GdpOverview
        facts={facts.map(projectGdpObservation)}
        sourceIdRanges={sourceIdRangesBySeries(facts)}
        lastReviewedAt={facts.map((f) => f.lastReviewedAt).sort().at(-1)!}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}
