import type { Locale } from "../i18n/types";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import path from "node:path";
import { MethodologyHub } from "../../components/methodology/methodology-hub";
import { JsonLd } from "../../components/seo/json-ld";
import { SiteFooter } from "../../components/site/site-footer";
import { loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { buildLandingContext } from "../landing/landingData";
import { buildMethodologyHubEntries } from "../methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../methodology/prepareArchives";
import { fiscalMetadata } from "../seo/metadata";
import { DEBT_EXPLORER_PATH, DEFICIT_EXPLORER_PATH } from "../seo/internalLinks";
import { dataCatalogJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

export async function methodologyPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["methodology"]);
  return fiscalMetadata({ locale, title: message(messages, "methodology.metaTitle"), description: message(messages, "methodology.metaDescription"), path: "/methodology" });
}

export async function renderMethodologyPage(locale: Locale) {
  const messages = await getMessages(locale, ["common", "methodology"]);
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [landingData, municipalData, debtData, archives] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadGeneratedArchiveSummaries(repositoryRoot),
  ]);
  const liveEntries = buildMethodologyHubEntries({
    budgetFacts: landingData.facts,
    municipalFacts: municipalData.totalFacts,
    debtFacts: debtData.facts,
    archives,
  }, locale);
  const landingModel = buildLandingContext(landingData);

  return (
    <>
      <JsonLd
        data={dataCatalogJsonLd(resolveSiteUrl(), liveEntries.map(entry => entry.href), locale, [
          "/explorer/economy/gdp",
          "/explorer/expenditure",
          "/explorer/revenue",
          DEBT_EXPLORER_PATH,
          DEFICIT_EXPLORER_PATH,
          "/explorer/municipalities",
        ])}
        testId="catalog-json-ld"
      />
      <MethodologyHub
        messages={messages}
        liveEntries={liveEntries}
        breadcrumbItems={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.methodology"), path: pageHref("/methodology", locale) }]}
      />
      <div className="mx-auto w-full max-w-[1240px] px-5 min-[768px]:px-7">
        <SiteFooter locale={locale} updatedAt={landingModel.updatedAt} />
      </div>
    </>
  );
}
