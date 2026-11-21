"use client";

import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import { crawlBlockHtml, crawlTables, type CrawlTable } from "../../lib/explorer/crawlTables";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { workbookMessage } from "../../lib/i18n/workbook";

/** A page's models for its data-table block: `models` for the first tables, `earlier` for the periods a monthly page folds below them. */
export type CrawlModels = { models: readonly WorkbookExportModel[]; earlier: readonly WorkbookExportModel[] };

const NO_MODELS: CrawlModels = { models: [], earlier: [] };
const subscribe = () => () => {};

/** Runs `run` once the browser is idle (a short timer where it has no `requestIdleCallback`); returns the cancel. */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 200);
  return () => window.clearTimeout(id);
}

/**
 * A chart page's crawl models. The server builds them, and CrawlTables keeps that markup through hydration, so a page loaded
 * from its HTML never builds them in the browser (it cost the heaviest pages over half a second of hydration). A page opened
 * by a link inside the site has no server markup: it builds them once, after it mounts, when the browser is idle.
 * `buildEarlier` gives a monthly page's models for the periods before its window (`earlierPeriodsRange`).
 */
export function useCrawlModels(build: () => readonly WorkbookExportModel[], buildEarlier?: () => readonly WorkbookExportModel[]): CrawlModels {
  // The server snapshot is what a hydrating render reads too, so only a page mounted in the browser starts false.
  const [fromServer] = useState(useSyncExternalStore(subscribe, () => false, () => true));
  const [late, setLate] = useState(NO_MODELS);
  const buildLate = useEffectEvent(() => setLate({ models: build(), earlier: buildEarlier?.() ?? [] }));
  useEffect(() => (fromServer ? undefined : whenIdle(() => buildLate())), [fromServer]);
  return typeof window === "undefined" ? { models: build(), earlier: buildEarlier?.() ?? [] } : late;
}

/**
 * The data-table block for tables already built (DESIGN.md §8.4): the wrapper CrawlTables and IndexCrawlTables write. With
 * no tables its HTML is "", which keeps what the server wrote there (React rewrites inner HTML only when the string changes).
 */
export function CrawlTableBlock({ tables, category }: { tables: readonly CrawlTable[]; category: string }) {
  const { messages } = useI18n();
  const html = useMemo(() => crawlBlockHtml(tables, {
    category, heading: message(messages, "controls.crawlHeading"), rest: message(messages, "controls.crawlRest"),
  }), [tables, category, messages]);
  return <div data-testid="crawl-tables" className="crawl-tables" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Every series of a chart page as a visible data-table block, so visitors and every kind of reader get the numbers. Pass
 * models from useCrawlModels: the server writes the block as HTML; while the browser has no models the block's HTML is ""
 * and hydration keeps the server's.
 */
export function CrawlTables({ models }: { models: CrawlModels }) {
  const { locale, messages } = useI18n();
  const tables = useMemo(() => crawlTables(models.models, messages, models.earlier), [models, messages]);
  return <CrawlTableBlock tables={tables} category={workbookMessage(locale, "workbook.category")} />;
}
