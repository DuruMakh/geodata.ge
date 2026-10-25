import path from "node:path";
import { EconomicSectorsExplorer } from "../../components/economic-sectors/economic-sectors-explorer";
import { projectSectorObservation, sourceIdByMeasure } from "../explorer/clientData";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedGdpExpenditureData, GDP_EXPENDITURE } from "../data/gdpExpenditure/importGdpExpenditure";
import { packFacts } from "../data/packedFacts";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { coverageLabel } from "../explorer/coverageLabel";
import { GDP_EXPENDITURE_PAGE_CONFIG } from "../explorer/gdpExpenditure";
import { resolveSiteUrl } from "../siteUrl";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ALL_DATA_PATH } from "../navigation/navTree";

const PATH = "/explorer/economy/expenditure";

export async function gdpExpenditurePageMetadata(locale: Locale) {
  const messages = await getMessages(locale,["gdpExpenditure"]);
  return fiscalMetadata({locale,path:PATH,title:message(messages,"gdpExpenditure.metaTitle"),description:message(messages,"gdpExpenditure.metaDescription")});
}
export async function renderGdpExpenditurePage(locale: Locale) {
  const root=path.resolve(/* turbopackIgnore: true */ process.cwd(),"../..");
  const [{facts},presentation,manifest,catalogue]=await Promise.all([
    loadServedGdpExpenditureData(),getPresentation(locale,["gdpExpenditure","format","main","workbook"],GDP_EXPENDITURE.map(r=>r.id)),
    loadReviewedSourceManifest(root,"gdp-expenditure"),loadEnglishCatalogue(root),
  ]);
  const publicSources=projectPublicSources(manifest,locale,catalogue.documents);
  const sources=manifest.map(source=>{
    const translated=publicSources.find(s=>s.source_id===source.source_id)!;
    return {sourceId:source.source_id,years:source.years,title:translated.title,organization:translated.publisher,downloadHref:source.downloadHref,retrievedAt:source.retrieved_at};
  });
  const title=message(presentation.messages,"gdpExpenditure.heading"),firstYear=Math.min(...facts.map(f=>f.year)),lastYear=Math.max(...facts.map(f=>f.year)),dateModified=facts.map(f=>f.lastReviewedAt).sort().at(-1)!;
  const crumbs=[{label:message(presentation.messages,"common.home"),href:pageHref("/",locale)},{label:message(presentation.messages,"common.data"),href:pageHref(ALL_DATA_PATH,locale)},{label:message(presentation.messages,"common.economy"),href:pageHref("/explorer/economy",locale)},{label:title}];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({locale,datasetId:"gdp-expenditure",origin:resolveSiteUrl(),path:PATH,name:message(presentation.messages,"gdpExpenditure.metaTitle"),description:message(presentation.messages,"gdpExpenditure.metaDescription"),firstYear,lastYear,dateModified,spatialCoverageName:locale==="ka"?"საქართველო":"Georgia"})}/>
    <BreadcrumbJsonLd items={[{name:crumbs[0].label,path:pageHref("/",locale)},{name:message(presentation.messages,"common.data"),path:pageHref(ALL_DATA_PATH,locale)},{name:crumbs[2].label,path:pageHref("/explorer/economy",locale)},{name:title,path:pageHref(PATH,locale)}]}/>
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, dateModified)}/>
      <EconomicSectorsExplorer facts={packFacts(facts.map(projectSectorObservation))} sourceIdByMeasure={sourceIdByMeasure(facts)} registry={GDP_EXPENDITURE} sources={sources} siteOrigin={resolveSiteUrl()} config={GDP_EXPENDITURE_PAGE_CONFIG}/>
    </ExplorerPage>
  </I18nProvider>;
}
