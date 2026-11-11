import { crawlTablesHtml, type CrawlTable } from "../../lib/explorer/crawlTables";

/**
 * A map index page's every-year tables (lib/explorer/indexCrawlTables.ts) in the hidden crawl-tables wrapper, the markup
 * CrawlTables writes. It has no hooks, so a server page renderer and a client index can both place it. In the browser the
 * caller passes no tables, the inner HTML is "" and hydration keeps the server's tables, as with CrawlTables.
 */
export function IndexCrawlTables({ tables, category }: { tables: readonly CrawlTable[]; category: string }) {
  return <div hidden data-testid="crawl-tables" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: tables.length ? crawlTablesHtml(tables, category) : "" }} />;
}
