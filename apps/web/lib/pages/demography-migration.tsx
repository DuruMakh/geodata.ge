import Link from "next/link";
import { MigrationExplorer } from "../../components/demography/demography-migration";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { projectMigrationObservation } from "../explorer/clientData";
import { MIGRATION_SERIES, migrationCoverage, migrationSearchLabels } from "../explorer/demographyMigration";
import { DEMOGRAPHY_HUB_PATH, MIGRATION_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadPopulationSources } from "./demography-population";

export async function demographyMigrationPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: MIGRATION_PATH,
    title: `${message(p.messages, "demography.migrationMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.migrationDescription"),
  });
}

export async function renderDemographyMigrationPage(locale: Locale) {
  const [{ facts: served }, sources, presentation, kaMessages, enMessages] = await Promise.all([
    loadServedDemographyData(),
    loadPopulationSources(locale),
    getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook"], []),
    getMessages("ka", ["demography"]),
    getMessages("en", ["demography"]),
  ]);
  const { messages } = presentation;
  const t = (key: string, values?: TemplateValues) => message(messages, `demography.${key}`, values);
  // Only the three series the page reads go to the browser (518 rows), never the whole mirrored file.
  const facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  const { min: first, max: last } = migrationCoverage(facts);
  const title = t("migrationTitle");
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  const sourceNote = (
    <>
      {t("migrationSource", { start: first, end: last })}{" "}
      <Link href={pageHref("/methodology/demography", locale)} className="underline underline-offset-2">
        {message(messages, "common.methodology")}
      </Link>.
    </>
  );
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: crumbs[0].label, path: pageHref("/", locale) },
          { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
          { name: title, path: pageHref(MIGRATION_PATH, locale) },
        ]}
      />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("migrationCoverage", { first, last })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("migrationUnitLine")}</p>
        <MigrationExplorer
          facts={facts}
          sources={sources}
          siteOrigin={resolveSiteUrl()}
          sourceNote={sourceNote}
          searchLabels={migrationSearchLabels(kaMessages, enMessages)}
        />
      </ExplorerPage>
    </I18nProvider>
  );
}
