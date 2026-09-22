import path from "node:path";
import { EconomicSectorsExplorer } from "../../components/economic-sectors/economic-sectors-explorer";
import { projectSectorObservation, sourceIdByMeasure } from "../explorer/clientData";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedEconomicSectorsData, ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { formatDisplayDate } from "../explorer/format";
import { resolveSiteUrl } from "../siteUrl";

export async function economicSectorsPageMetadata(locale: Locale) {
  const messages = await getMessages(locale,["sectors"]);
  return fiscalMetadata({locale,path:"/explorer/economy/sectors",title:message(messages,"sectors.heading"),description:message(messages,"sectors.nominalContext")});
}
export async function renderEconomicSectorsPage(locale: Locale) {
  const root=path.resolve(/* turbopackIgnore: true */ process.cwd(),"../..");
  const [{facts},presentation,manifest,catalogue]=await Promise.all([
    loadServedEconomicSectorsData(),getPresentation(locale,["sectors","common","controls","format","main","workbook"],ECONOMIC_SECTORS.map(r=>r.id)),
    loadReviewedSourceManifest(root,"economic-sectors"),loadEnglishCatalogue(root),
  ]);
  const publicSources=projectPublicSources(manifest,locale,catalogue.documents);
  const sources=manifest.map(source=>{
    const translated=publicSources.find(s=>s.source_id===source.source_id)!;
    return {sourceId:source.source_id,years:source.years,title:translated.title,organization:translated.publisher,downloadHref:source.downloadHref,retrievedAt:source.retrieved_at};
  });
  const title=message(presentation.messages,"sectors.heading"),firstYear=Math.min(...facts.map(f=>f.year)),lastYear=Math.max(...facts.map(f=>f.year)),dateModified=facts.map(f=>f.lastReviewedAt).sort().at(-1)!;
  const crumbs=[{label:message(presentation.messages,"common.home"),href:pageHref("/",locale)},{label:message(presentation.messages,"common.data")},{label:message(presentation.messages,"common.economy"),href:pageHref("/explorer/economy",locale)},{label:title}];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({locale,datasetId:"economic-sectors",origin:resolveSiteUrl(),path:"/explorer/economy/sectors",name:title,description:message(presentation.messages,"sectors.nominalContext"),firstYear,lastYear,dateModified,spatialCoverageName:locale==="ka"?"საქართველო":"Georgia",downloadPath:"/downloads/data/economic-sectors.csv"})}/>
    <BreadcrumbJsonLd items={[{name:crumbs[0].label,path:pageHref("/",locale)},{name:crumbs[2].label,path:pageHref("/explorer/economy",locale)},{name:title,path:pageHref("/explorer/economy/sectors",locale)}]}/>
    <main className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="mx-auto max-w-[1180px]">
        <PageHeader crumbs={crumbs} coverage={`${firstYear}–${lastYear} · ${message(presentation.messages, "main.updated", { date: locale === "en" ? formatDisplayDate(dateModified, locale) : dateModified })}`}/>
        <EconomicSectorsExplorer facts={facts.map(projectSectorObservation)} sourceIdByMeasure={sourceIdByMeasure(facts)} registry={ECONOMIC_SECTORS} sources={sources} siteOrigin={resolveSiteUrl()}/>
      </div>
    </main>
  </I18nProvider>;
}
