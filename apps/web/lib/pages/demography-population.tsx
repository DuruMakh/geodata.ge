import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES } from "../data/demography/series";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

const POPULATION_PATH = "/explorer/demography/population";

export async function demographyPopulationPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: POPULATION_PATH,
    title: `${message(p.messages, "demography.populationMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.populationDescription"),
  });
}

export async function renderDemographyPopulationPage(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([
    loadServedDemographyData(),
    getPresentation(locale, ["demography", "common"], []),
  ]);
  const t = (key: string, values?: TemplateValues) => message(presentation.messages, `demography.${key}`, values);
  const years = facts.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => fact.year);
  const title = t("populationTitle");
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(presentation.messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
        { name: title, path: pageHref(POPULATION_PATH, locale) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first: Math.min(...years), last: Math.max(...years) })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("unitLine")}</p>
      </ExplorerPage>
    </I18nProvider>
  );
}
