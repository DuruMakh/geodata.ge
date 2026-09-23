import { BudgetHub } from "../../components/hub/budget-hub";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../data/economicSectors/importEconomicSectors";
import { loadServedRegionalEconomyData, REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { buildEconomyHubCards } from "../explorer/economyHubCards";
export async function economyPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["gdp"], []);
  return fiscalMetadata({
    locale,
    path: "/explorer/economy",
    title: `${message(p.messages, "gdp.economy")} | Fiscal.ge`,
    description: message(p.messages, "gdp.hubDescription"),
  });
}
export async function renderEconomyPage(locale: Locale) {
  const [{ facts }, p, sectors, regional] = await Promise.all([
    loadServedGdpOverviewData(),
    getPresentation(locale, ["gdp", "common", "sectors", "regionalEconomies"], REGIONAL_ECONOMY_REGIONS.map((region) => region.id)),
    loadServedEconomicSectorsData(),
    loadServedRegionalEconomyData(),
  ]);
  const t = (k: string) => message(p.messages, `gdp.${k}`);
  return (
    <I18nProvider {...p}>
      <main className="px-5 pb-16 min-[768px]:px-[34px]">
        <div className="mx-auto max-w-[1180px]">
          <PageHeader
            crumbs={[
              {
                label: message(p.messages, "common.home"),
                href: pageHref("/", locale),
              },
              { label: message(p.messages, "common.data") },
              { label: t("economy") },
            ]}
            coverage=""
          />
          <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
            {t("economy")}
          </h1>
          <p className="mb-[30px] text-[13px] text-[var(--body)]">
            {t("hubDescription")}
          </p>
          <BudgetHub
            cards={buildEconomyHubCards(facts, p, sectors.facts, regional.facts)}
            locale={locale}
            testId="economy-hub"
          />
        </div>
      </main>
    </I18nProvider>
  );
}
