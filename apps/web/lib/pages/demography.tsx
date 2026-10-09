import { BudgetHub } from "../../components/hub/budget-hub";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { buildDemographyHubCards } from "../explorer/demographyHubCards";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

export async function demographyPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: DEMOGRAPHY_HUB_PATH,
    title: `${message(p.messages, "demography.title")} | Fiscal.ge`,
    description: message(p.messages, "demography.hubDescription"),
  });
}

export async function renderDemographyPage(locale: Locale) {
  const [{ facts }, p] = await Promise.all([
    loadServedDemographyData(),
    getPresentation(locale, ["demography", "common"], []),
  ]);
  const title = message(p.messages, "demography.title");
  const crumbs = [
    { label: message(p.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(p.messages, "common.data") },
    { label: title },
  ];
  return (
    <I18nProvider {...p}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: title, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
      ]} />
      <main className="px-5 pb-16 min-[768px]:px-[34px]">
        <div className="mx-auto max-w-[1180px]">
          <PageHeader crumbs={crumbs} coverage="" />
          <ExplorerHeading>{title}</ExplorerHeading>
          <p className="mb-[30px] text-[13px] text-[var(--body)]">{message(p.messages, "demography.hubDescription")}</p>
          <BudgetHub cards={buildDemographyHubCards(facts, p)} locale={locale} testId="demography-hub" />
        </div>
      </main>
    </I18nProvider>
  );
}
