import { InflationOverview } from "../../components/inflation/inflation-overview";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { packCpiFacts } from "../explorer/inflationOverview";
import { projectCpiFact, projectInflationTarget, sourceIdBySeriesMeasure } from "../explorer/clientData";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { INFLATION_HUB_PATH, inflationRepositoryRoot, inflationWorkbookSources } from "./inflation-shared";

const OVERVIEW_PATH = "/explorer/inflation/overview";

export async function inflationOverviewMetadata(locale: Locale) {
  const [{ facts }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = facts.map((fact) => periodYear(periodFromKey(fact.period)));
  return fiscalMetadata({
    locale,
    path: OVERVIEW_PATH,
    title: message(messages, "inflation.metaTitle", { first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.description"),
  });
}

export async function renderInflationOverview(locale: Locale) {
  const root = inflationRepositoryRoot();
  const [{ facts, targets }, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(INFLATION_HUB_PATH, locale) },
          { name: t("inflation.heading"), path: pageHref(OVERVIEW_PATH, locale) },
        ]}
      />
      <InflationOverview
        facts={packCpiFacts(facts.map(projectCpiFact))}
        sourceIdBySeriesMeasure={sourceIdBySeriesMeasure(facts)}
        lastReviewedAt={facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? ""}
        targets={targets.map(projectInflationTarget)}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}
