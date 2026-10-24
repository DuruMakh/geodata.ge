import path from "node:path";
import { EconomicSectorsExplorer } from "../../components/economic-sectors/economic-sectors-explorer";
import { projectSectorObservation, sourceIdByMeasure } from "../explorer/clientData";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedExpenditureTypesData, EXPENDITURE_TYPES } from "../data/expenditureTypes/importExpenditureTypes";
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
import { EXPENDITURE_TYPES_PAGE_CONFIG } from "../explorer/expenditureTypes";
import { resolveSiteUrl } from "../siteUrl";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { navGroup } from "../navigation/navTree";

const PATH = "/explorer/expenditure-types";

export async function expenditureTypesPageMetadata(locale: Locale) {
  const messages = await getMessages(locale,["expenditureTypes"]);
  return fiscalMetadata({locale,path:PATH,title:message(messages,"expenditureTypes.metaTitle"),description:message(messages,"expenditureTypes.metaDescription")});
}
export async function renderExpenditureTypesPage(locale: Locale) {
  const root=path.resolve(/* turbopackIgnore: true */ process.cwd(),"../..");
  const [{facts},presentation,manifest,catalogue]=await Promise.all([
    loadServedExpenditureTypesData(),getPresentation(locale,["expenditureTypes","format","main","workbook"],EXPENDITURE_TYPES.map(r=>r.id)),
    loadReviewedSourceManifest(root,"expenditure-types"),loadEnglishCatalogue(root),
  ]);
  const publicSources=projectPublicSources(manifest,locale,catalogue.documents);
  const sources=manifest.map(source=>{
    const translated=publicSources.find(s=>s.source_id===source.source_id)!;
    return {sourceId:source.source_id,years:source.years,title:translated.title,organization:translated.publisher,downloadHref:source.downloadHref,retrievedAt:source.retrieved_at};
  });
  const title=message(presentation.messages,"expenditureTypes.heading"),firstYear=Math.min(...facts.map(f=>f.year)),lastYear=Math.max(...facts.map(f=>f.year)),dateModified=facts.map(f=>f.lastReviewedAt).sort().at(-1)!;
  const crumbs=[{label:message(presentation.messages,"common.home"),href:pageHref("/",locale)},{label:message(presentation.messages,"common.data")},{label:message(presentation.messages,"common.budget"),href:pageHref(navGroup("budget").href, locale)},{label:title}];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({locale,datasetId:"expenditure-types",origin:resolveSiteUrl(),path:PATH,name:message(presentation.messages,"expenditureTypes.metaTitle"),description:message(presentation.messages,"expenditureTypes.metaDescription"),firstYear,lastYear,dateModified,spatialCoverageName:locale==="ka"?"საქართველო":"Georgia"})}/>
    <BreadcrumbJsonLd items={[{name:crumbs[0].label,path:pageHref("/",locale)},{name:crumbs[2].label,path:pageHref(navGroup("budget").href,locale)},{name:title,path:pageHref(PATH,locale)}]}/>
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, dateModified)}/>
      <EconomicSectorsExplorer facts={packFacts(facts.map(projectSectorObservation))} sourceIdByMeasure={sourceIdByMeasure(facts)} registry={EXPENDITURE_TYPES} sources={sources} siteOrigin={resolveSiteUrl()} config={EXPENDITURE_TYPES_PAGE_CONFIG}/>
    </ExplorerPage>
  </I18nProvider>;
}
