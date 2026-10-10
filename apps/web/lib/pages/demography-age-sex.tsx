import { AgeSexExplorer } from "../../components/demography/age-sex-explorer";
import { AgeSexRegions } from "../../components/demography/age-sex-regions";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES, SOURCE_ID } from "../data/demography/series";
import { ageYears, annualAgeFacts } from "../explorer/demographyAgeSex";
import { buildAgeSexRegionModel, georgiaOldShare } from "../explorer/demographyAgeSexRegions";
import { AGE_SEX_PATH, DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationBasics, loadPopulationSources } from "./demography-population";

export async function demographyAgeSexPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: AGE_SEX_PATH,
    title: `${message(p.messages, "demography.ageSexMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.ageSexDescription"),
  });
}

export async function renderDemographyAgeSexPage(locale: Locale) {
  // The population basics bring the region registry, the Population index's years and a presentation with the place labels;
  // the region index adds its own fixed words (`regionalEconomies`).
  const [{ facts: served }, { facts: population, municipal, presentation: basics }, sources, regional] = await Promise.all([
    loadServedDemographyData(),
    loadPopulationBasics(locale),
    loadPopulationSources(locale),
    getMessages(locale, ["regionalEconomies"]),
  ]);
  const presentation = { ...basics, messages: { ...basics.messages, ...regional } };
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  const facts = annualAgeFacts(served);
  const years = ageYears(facts);
  const [first, last] = [years[0]!, years.at(-1)!];
  // The pyramid's latest year must be the Population index's, or the two pages would describe different Januaries.
  const populationLast = Math.max(...population.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => fact.year));
  if (last !== populationLast) throw new Error(`Age rows end in ${last}, the Population index in ${populationLast}`);
  const model = buildAgeSexRegionModel(served, municipal.regions);
  const title = t("ageSexTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(AGE_SEX_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("ageSexCoverage", { first, last })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("ageSexLead", { first })}</p>
        <AgeSexRegions model={model} georgiaShare={georgiaOldShare(served)} sourceNote={t("regionsSource")} />
        <AgeSexExplorer facts={facts} sources={sources.filter((source) => source.sourceId === SOURCE_ID.ageSex)} siteOrigin={resolveSiteUrl()} />
      </ExplorerPage>
    </I18nProvider>
  );
}
