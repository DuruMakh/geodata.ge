import { InflationOverview } from "../../components/inflation/inflation-overview";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { packCpiFacts } from "../explorer/inflationOverview";
import { projectCpiFact, projectInflationTarget, sourceIdBySeriesMeasure } from "../explorer/clientData";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { inflationRepositoryRoot, inflationWorkbookSources } from "./inflation-shared";
import { topicSection } from "../navigation/navTree";

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
    getPresentation(locale, ["inflation", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  const periods = facts.map((fact) => fact.period).sort(), lastReviewedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
        locale, origin: resolveSiteUrl(), path: OVERVIEW_PATH, datasetId: "inflation", name: t("inflation.heading"), description: t("inflation.description"),
        firstYear: periods[0], lastYear: periods.at(-1)!, dateModified: lastReviewedAt,
        // The national CPI file is this page's data, and /methodology/inflation describes the same dataset.
        downloadPath: "/downloads/data/inflation-cpi-national.csv", sameAsPath: "/methodology/inflation",
        variableMeasured: [t("inflation.tab.yoy"), t("inflation.tab.mom"), t("inflation.tab.index"), t("inflation.series.target")],
      })} />
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(topicSection("inflation").path, locale) },
          { name: t("inflation.heading"), path: pageHref(OVERVIEW_PATH, locale) },
        ]}
      />
      <InflationOverview
        facts={packCpiFacts(facts.map(projectCpiFact))}
        sourceIdBySeriesMeasure={sourceIdBySeriesMeasure(facts)}
        lastReviewedAt={lastReviewedAt}
        targets={targets.map(projectInflationTarget)}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}
