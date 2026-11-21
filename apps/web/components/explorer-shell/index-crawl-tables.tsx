"use client";

import type { CrawlTable } from "../../lib/explorer/crawlTables";
import { CrawlTableBlock } from "./crawl-tables";

/**
 * A map index page's every-year tables (lib/explorer/indexCrawlTables.ts) in the data-table block CrawlTables writes. The
 * tables arrive as props, so the server and the browser write the same string, and a page opened by a link inside the site
 * shows them too. It is a client component so a server page sends the browser the tables' text, not their markup a second
 * time in the page's data.
 */
export function IndexCrawlTables({ tables, category }: { tables: readonly CrawlTable[]; category: string }) {
  return <CrawlTableBlock tables={tables} category={category} />;
}
