"use client";

import { crawlTablesHtml, type CrawlTable } from "../../lib/explorer/crawlTables";

/**
 * A map index page's every-year tables (lib/explorer/indexCrawlTables.ts) in the hidden crawl-tables wrapper, the markup
 * CrawlTables writes. It has no hooks, so a server page renderer and a client index can both place it. It is a client
 * component so a server page sends the browser the tables' text, not their markup, which would travel a second time in the
 * page's data; the markup is written in the server render only, and hydration keeps the server's tables, as with CrawlTables.
 */
export function IndexCrawlTables({ tables, category }: { tables: readonly CrawlTable[]; category: string }) {
  const html = typeof window === "undefined" && tables.length ? crawlTablesHtml(tables, category) : "";
  return <div hidden data-testid="crawl-tables" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
