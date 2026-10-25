import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { LatestFigure } from "../../components/explorer-shell/latest-value-line";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { SocialExplorer } from "../../components/social/social-explorer";
import { loadServedExplorerData } from "../data/servedData";
import { loadServedSocialData, toClientSocialFact } from "../data/social/importSocial";
import { SOCIAL_GEORGIA } from "../data/social/types";
import { projectGdpFact } from "../explorer/clientData";
import { coverageLabel } from "../explorer/coverageLabel";
import { formatInUnit, UNIT_PERSONS } from "../explorer/format";
import { SOCIAL_SECTIONS, socialCoverage, socialTopicSeries, socialViews, type SocialTopicId } from "../explorer/social";
import { Message } from "../i18n/message";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadGdpWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { loadSocialWorkbookSources } from "./social-places";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

const topicHref = (section: SocialTopicId) => SOCIAL_SECTIONS.find(item => item.id === section)!.href;

/** The latest line's figure: the money headlines (Social payments' total, the funded pension's savings) in billion GEL to two decimals ("6.17"), Social package's recipients whole. */
function latestFigure(section: SocialTopicId, value: number): string {
  return section === "social-payments" || section === "funded-pension" ? formatInUnit(value / 1000, { divisor: 1, label: "", decimals: 2 }) : formatInUnit(value, UNIT_PERSONS);
}

export async function socialTopicMetadata(locale: Locale, section: SocialTopicId) {
  const messages = await getMessages(locale, ["social"]);
  return fiscalMetadata({ locale, path: topicHref(section), title: message(messages, `social.page.${section}.metaTitle`), description: message(messages, `social.page.${section}.summary`) });
}

/** Social payments, Social package or the funded pension: the latest line, then the chart workspace over Georgia's series. */
export async function renderSocialTopicPage(locale: Locale, section: SocialTopicId) {
  // The % of GDP view of the money pages divides by the national GDP the debt page uses, and their Excel cites the same Geostat files.
  const gdp = socialViews(section).includes("gdp");
  const [{ facts: served, breaks }, presentation, sources, gdpFacts, gdpSources] = await Promise.all([
    loadServedSocialData(), getPresentation(locale, ["social", "format", "main", "workbook"], []), loadSocialWorkbookSources(locale),
    gdp ? loadServedExplorerData().then(explorer => explorer.gdpFacts.map(projectGdpFact)) : [], gdp ? loadGdpWorkbookSources(locale) : [],
  ]);
  const { messages } = presentation;
  const t = (key: string) => message(messages, `social.${key}`);
  const series = socialTopicSeries(section);
  // The page receives only Georgia's observations of the series its list shows.
  const ids = new Set<string>(series.map(({ id }) => id));
  const shown = served.filter(f => ids.has(f.indicatorId) && f.geographyId === SOCIAL_GEORGIA);
  const facts = shown.map(toClientSocialFact);
  const { min, max } = socialCoverage(section, "amount", facts, gdpFacts);
  const href = topicHref(section);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = shown.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const headingLabels = Object.fromEntries(series.map(({ heading }) => [heading, t(`heading.${heading}`)]));
  const latest = facts.filter(f => f.indicatorId === series[0].id).sort((a, b) => a.year - b.year).at(-1)!;
  const hubLabel = message(messages, "common.health");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) },
    { label: hubLabel, href: pageHref(topicSection("health").href, locale) },
    { label: title },
  ];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: section === "funded-pension" ? "funded-pension" : "social-protection", name: title, description, firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: [...new Set(Object.values(headingLabels))],
      // SSA's statistics; only Social payments' % of GDP view divides by Geostat's GDP. The funded pension has its own dataset vocabulary.
      ...(gdp ? {} : { sources: ["ssa"] as const }),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: hubLabel, path: pageHref(topicSection("health").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, min, max, lastReviewedAt)} />
      <SocialExplorer key={section} section={section} facts={facts} gdpFacts={gdpFacts} gdpSources={gdpSources} breaks={breaks}
        labels={Object.fromEntries(series.map(({ id }) => [id, t(`series.${id}`)]))} headingLabels={headingLabels}
        latestLine={<Message messages={messages} id={`social.latest.${section}`} values={{ period: latest.year, value: <LatestFigure value={latestFigure(section, latest.value)} /> }} />}
        sources={section === "funded-pension" ? sources.pensionFund : sources.ssa} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
