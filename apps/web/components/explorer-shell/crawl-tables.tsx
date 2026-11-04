"use client";

import { crawlTables, crawlTablesHtml } from "../../lib/explorer/crawlTables";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { workbookMessage } from "../../lib/i18n/workbook";

const NO_MODELS: readonly WorkbookExportModel[] = [];

/**
 * A chart page's crawl models, built during the server render only. Crawlers read the server HTML and CrawlTables keeps that
 * markup through hydration, so the browser never calls `build` (it cost the heaviest pages over half a second of hydration).
 * The server renders each component once, so there is nothing to memoize.
 */
export function useCrawlModels(build: () => readonly WorkbookExportModel[]): readonly WorkbookExportModel[] {
  return typeof window === "undefined" ? build() : NO_MODELS;
}

/**
 * Every series of a chart page as plain tables, hidden from visitors, so crawlers read the numbers. Pass models from
 * useCrawlModels: the server writes the tables as HTML; in the browser the models are empty, so the wrapper's HTML is "" and
 * hydration keeps the server's tables (React neither compares nor rewrites inner HTML that stays the same string).
 */
export function CrawlTables({ models }: { models: readonly WorkbookExportModel[] }) {
  const { locale, messages } = useI18n();
  const html = models.length === 0 ? "" : crawlTablesHtml(crawlTables(models, messages), workbookMessage(locale, "workbook.category"));
  return <div hidden data-testid="crawl-tables" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
