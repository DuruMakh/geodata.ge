import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { RegionalEconomiesIndex } from "../../components/regional-economies/regional-economies-index";
import { loadServedMunicipalData } from "../data/servedData";
import {
  loadServedRegionalEconomyData,
  REGIONAL_ECONOMY_REGIONS,
  REGIONAL_ECONOMY_SECTORS,
} from "../data/regionalEconomies/importRegionalEconomies";
import { buildRegionalEconomyMapModel } from "../explorer/regionalEconomyMap";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

export async function regionalEconomiesPageMetadata(locale: Locale) {
  const presentation = await getPresentation(locale, ["regionalEconomies"], []);
  return fiscalMetadata({
    locale,
    path: "/explorer/economy/regions",
    title: message(presentation.messages, "regionalEconomies.indexMetaTitle"),
    description: message(presentation.messages, "regionalEconomies.description"),
  });
}

export async function renderRegionalEconomiesPage(locale: Locale) {
  const [{ facts }, municipal, presentation] = await Promise.all([
    loadServedRegionalEconomyData(),
    loadServedMunicipalData(),
    getPresentation(
      locale,
      ["regionalEconomies", "common", "format"],
      [...REGIONAL_ECONOMY_REGIONS.map((region) => region.id), ...REGIONAL_ECONOMY_SECTORS.map((sector) => sector.id)],
    ),
  ]);
  const model = buildRegionalEconomyMapModel({
    facts,
    regions: municipal.regions,
    municipalities: municipal.municipalities,
  });
  const title = message(presentation.messages, "regionalEconomies.heading");
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(presentation.messages, "common.data") },
    { label: message(presentation.messages, "common.economy"), href: pageHref("/explorer/economy", locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref("/explorer/economy", locale) },
        { name: title, path: pageHref("/explorer/economy/regions", locale) },
      ]} />
      <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
        <div className="@container mx-auto max-w-[1180px]">
          <PageHeader crumbs={crumbs} coverage={`${model.firstYear}–${model.year} · ${message(presentation.messages, "regionalEconomies.currentPrices")}`} />
          <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">{title}</h1>
          <p className="mb-[30px] max-w-[720px] text-[13px] leading-relaxed text-[var(--body)]">{message(presentation.messages, "regionalEconomies.description")}</p>
          <RegionalEconomiesIndex model={model} sourceNote={message(presentation.messages, "regionalEconomies.sourceNote")} />
        </div>
      </main>
    </I18nProvider>
  );
}
