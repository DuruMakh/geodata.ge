// The data-table blocks on a production build (DESIGN.md §8.4): every chart page carries one, in view (nothing hides it or
// an ancestor of it), its first tables hold no more than the cell cap and the whole block no more than the page cap, the
// HTML stays within its size ceiling, and a few known figures reach the prerendered HTML. It also reports how much of each
// page a short-window AI reader keeps (about 40,000 characters): where the first tables end.
// Run after `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`: `npm run crawl:check`. Not part of `npm run check`.
// CI runs it with `--size-report-only` after its build: the gzip ceiling then prints but does not fail, because its fixed
// baseline would go stale as the data grows; every other check (wrapper, cell caps, spot checks) still fails the run.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { CRAWL_CELL_CAP, CRAWL_PAGE_CELL_CAP } from "../lib/explorer/crawlTables";
import { message } from "../lib/i18n/messages";
import type { Locale, Messages } from "../lib/i18n/types";
import { runAsCli } from "../lib/runAsCli";

// Prerendered HTML before the crawl tables (`main` at 6ebf6686, gzip level 6, the same files as below), and the
// ceiling it may grow to: 15% over the baseline (spec S6).
export const BASELINE_HTML_FILES = 1556;
export const BASELINE_GZIP_BYTES = 54_378_250;
export const GZIP_CEILING_BYTES = 62_535_000;

// Chart pages that carry no crawl tables, each with a one-line reason.
const NO_CRAWL_TABLES: Record<string, string> = {
  "explorer/inflation/products": "data fetched after page load; never in prerendered HTML",
};

// Map index pages: each carries every year of its figures for every place it lists (DESIGN.md §8.4), in ka and en.
const MAP_INDEX_ROUTES = [
  "explorer/education/schools", "explorer/education/kindergartens", "explorer/demography/population", "explorer/demography/births-deaths",
  "explorer/demography/marriages-divorces", "explorer/health/pensions", "explorer/health/subsistence-allowance", "explorer/municipalities",
  "explorer/business/regions", "explorer/economy/regions", "explorer/housing/regions", "explorer/money/regions", "explorer/transport/regions",
  "explorer/wages/regions", "explorer/internet/homes", "explorer/living-standards/income", "explorer/living-standards/spending",
  "explorer/science-culture/museums", "explorer/environment/forests", "explorer/environment/waste", "explorer/environment/air-quality",
  "explorer/health/causes-of-death",
];

const WRAPPER_TEST_ID = 'data-testid="crawl-tables"';
// The wrapper PR #231 wrote: readers that drop `hidden` elements (Claude's web fetch) never saw its tables.
const HIDDEN_WRAPPER = '<div hidden="" data-testid="crawl-tables">';
const CHART_PANEL = /data-testid="(?:[\w-]*chart-panel|municipal-chart-controls)"/;
/** About what Claude's web fetch passes on word for word from one page (measured on production, 2026-11-21). */
export const READER_WINDOW_CHARS = 40_000;

/**
 * One data-table block: `first` is its tables in view, `rest` the ones folded in its <details>. `hiddenBy` names what keeps
 * the block out of view (an attribute on it or an ancestor), and `readerEnd` is about how many characters a
 * markdown-converting reader has taken from the page when the first tables end.
 */
export type CrawlWrapper = { first: string; rest: string; hiddenBy: string | null; readerEnd: number };
type Page = { route: string; html: string; wrappers: CrawlWrapper[]; firstCells: number; cells: number; gzip: number; payloadTables: boolean };

const stripScripts = (html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
// What a reader that turns the page into text drops: these tags, and every subtree with the `hidden` attribute.
const UNREAD_TAGS = new Set(["head", "style", "svg", "template", "noscript", "select"]);
const TAG = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

function hiding(tag: string, attributes: string): string | null {
  if (/(?:^|\s)hidden(?:[\s=/]|$)/.test(attributes)) return "hidden";
  if (/\saria-hidden="true"/.test(attributes)) return 'aria-hidden="true"';
  if (/(?:^|\s)inert(?:[\s=/]|$)/.test(attributes)) return "inert";
  if (/\sstyle="[^"]*display:\s*none/.test(attributes)) return "display:none";
  if (tag === "details" && !/(?:^|\s)open(?:[\s=/]|$)/.test(attributes)) return "a closed <details>";
  return null;
}

/**
 * Each data-table block of a page (scripts already stripped) that holds a table; an empty wrapper (the server had nothing to
 * write there) does not count, so it never satisfies "a chart page carries a data table". One pass over the tags keeps the
 * open elements, so a block knows what hides it, and adds up the text a reader keeps: text outside dropped subtrees, a
 * separator per table cell, and each link's address.
 */
export function crawlWrappers(html: string): CrawlWrapper[] {
  const wrappers: CrawlWrapper[] = [];
  const open: { tag: string; hides: string | null; unread: boolean; href: number }[] = [];
  let unreadDepth = 0;
  let chars = 0;
  let at = 0;
  // The block being read: where its markup starts, its depth in `open`, and where its first tables end.
  let block: { start: number; depth: number; hiddenBy: string | null; firstEnd: number | null; readerEnd: number } | null = null;
  const text = (to: number) => { if (unreadDepth === 0) chars += html.slice(at, to).replace(/\s+/g, " ").length; };
  for (const match of html.matchAll(TAG)) {
    text(match.index);
    at = match.index + match[0].length;
    const tag = match[2]?.toLowerCase();
    if (!tag) continue;
    const attributes = match[3] ?? "";
    if (match[1] === "/") {
      const depth = open.findLastIndex((element) => element.tag === tag);
      if (depth === -1) continue;
      for (const closed of open.splice(depth)) {
        if (closed.unread) unreadDepth -= 1;
        else if (closed.tag === "a" && unreadDepth === 0) chars += closed.href + 4;
      }
      if (block && depth === block.depth) {
        const inner = html.slice(block.start, match.index);
        const firstEnd = block.firstEnd ?? inner.length;
        if (inner.includes("<table>")) wrappers.push({ first: inner.slice(0, firstEnd), rest: inner.slice(firstEnd), hiddenBy: block.hiddenBy, readerEnd: block.firstEnd === null ? chars : block.readerEnd });
        block = null;
      }
      continue;
    }
    if (block && tag === "details" && block.firstEnd === null) {
      block.firstEnd = match.index - block.start;
      block.readerEnd = chars;
    }
    const hides: string | null = block ? null : hiding(tag, attributes);
    if (attributes.includes(WRAPPER_TEST_ID)) block = { start: at, depth: open.length, hiddenBy: hides ?? open.find((element) => element.hides)?.hides ?? null, firstEnd: null, readerEnd: 0 };
    if (VOID_TAGS.has(tag) || attributes.endsWith("/")) continue;
    const unread = UNREAD_TAGS.has(tag) || hides === "hidden";
    if (unread) unreadDepth += 1;
    else if (unreadDepth === 0) chars += tag === "td" || tag === "th" ? 3 : 2;
    const href = tag === "a" ? /\shref="([^"]*)"/.exec(attributes)?.[1] : undefined;
    open.push({ tag, hides, unread, href: href === undefined ? 0 : href.length + (href.startsWith("/") ? "https://fiscal.ge".length : 0) });
  }
  return wrappers;
}

const countCells = (html: string) => (html.match(/<td>/g) ?? []).length;

function htmlFiles(appDir: string): string[] {
  return (readdirSync(appDir, { recursive: true }) as string[])
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file.endsWith(".html") && !/(^|\/)_(not-found|global-error)(\.|\/)/.test(file))
    .sort();
}

function loadMessages(locale: Locale): Messages {
  const dir = resolve(process.cwd(), "lib/i18n/messages", locale);
  return Object.assign({}, ...readdirSync(dir).filter((file) => file.endsWith(".json")).map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")))) as Messages;
}

type SpotCheck = { name: string; route: string; test: (inner: string, messages: Messages) => boolean };

const rowsOf = (inner: string) => [...inner.matchAll(/<tr><th>([^<]*)<\/th>((?:<td>[^<]*<\/td>)+)<\/tr>/g)].map((match) => ({ label: match[1]!, cells: [...match[2]!.matchAll(/<td>([^<]*)<\/td>/g)].map((cell) => cell[1]!) }));
const tablesOf = (inner: string) => inner.split("<table>").slice(1).map((table) => ({ caption: /<caption>([^<]*)<\/caption>/.exec(table)?.[1] ?? "", rows: rowsOf(table) }));

/** A row named `label` (by its Georgian or English name) with every figure in `cells`. */
const hasRow = (inner: string, labels: readonly string[], cells: readonly string[]) =>
  rowsOf(inner).some((row) => labels.includes(row.label) && cells.every((cell) => row.cells.includes(cell)));

const captionNote = (messages: Messages, key: string) => message(messages, key, { kept: "\u0000", of: "\u0001", count: "\u0000" }).split(/\u0000|\u0001/).filter((part) => part !== "");

const SPOT_CHECKS: SpotCheck[] = [
  {
    name: "Schools map: Khulo's pupils 3,936 and 2,075, Shuakhevi's 2,410 and 1,137",
    route: "explorer/education/schools",
    test: (inner) => hasRow(inner, ["ხულო", "Khulo"], ["3,936", "2,075"]) && hasRow(inner, ["შუახევი", "Shuakhevi"], ["2,410", "1,137"]),
  },
  { name: "Business regions map: sales and jobs tables", route: "explorer/business/regions", test: (inner) => tablesOf(inner).length === 2 },
  { name: "Pensions map: pensioners and their share, for municipalities and regions", route: "explorer/health/pensions", test: (inner) => tablesOf(inner).length === 4 },
  {
    name: "Samegrelo-Zemo Svaneti: the employed row reads 118.9 and 118.5",
    route: "explorer/unemployment/regions/samegrelo_zemo_svaneti",
    test: (inner, messages) => rowsOf(inner).some((row) => row.label === message(messages, "unemployment.indicator.employed") && row.cells.includes("118.9") && row.cells.includes("118.5")),
  },
  {
    name: "Expenditure: 30,881.4 marked planned",
    route: "explorer/expenditure",
    test: (inner, messages) => inner.includes(`<td>30,881.4 (${message(messages, "workbook.planned").toLowerCase()})</td>`),
  },
  {
    name: "Wages by industry: a median table with figures",
    route: "explorer/wages/industries",
    test: (inner, messages) => tablesOf(inner).some((table) => table.caption.includes(message(messages, "wages.group.median")) && table.rows.some((row) => row.cells.some((cell) => /\d/.test(cell)))),
  },
  {
    name: "Trade partners: the first tables say the others follow, and the folded rest lists them (over 150 more partners)",
    route: "explorer/trade/partners",
    test: (inner, messages) => {
      const [first = "", rest = ""] = inner.split("<details>");
      return tablesOf(first).some((table) => captionNote(messages, "controls.crawlTopMore").every((part) => table.caption.includes(part)))
        && tablesOf(rest).some((table) => table.rows.length > 150 && captionNote(messages, "controls.crawlOthers").every((part) => table.caption.includes(part)));
    },
  },
  {
    name: "Inflation by category: the folded rest carries 2015, month by month",
    route: "explorer/inflation/categories",
    test: (inner) => rowsOf(inner.split("<details>")[1] ?? "").some((row) => row.label.endsWith("— 2015") && row.cells.filter((cell) => /\d/.test(cell)).length >= 12),
  },
  {
    name: "Inflation by category: the folded rest carries the monthly change, back to every month of 2004",
    route: "explorer/inflation/categories",
    test: (inner, messages) => tablesOf(inner.split("<details>")[1] ?? "")
      .filter((table) => table.caption.startsWith(`${message(messages, "inflation.categoryTab.mom")} · `))
      .some((table) => table.rows.some((row) => row.label.endsWith("— 2004") && row.cells.filter((cell) => /\d/.test(cell)).length === 12)),
  },
  {
    name: "Marriages and divorces map: the folded rest carries 2009, the year the first tables leave out",
    route: "explorer/demography/marriages-divorces",
    test: (inner) => tablesOf(inner.split("<details>")[1] ?? "").some((table) => table.caption.includes(" · 2009 · ")),
  },
];

const bytes = (value: number) => value.toLocaleString("en-US");

export async function checkCrawlTables(root = process.cwd(), { sizeReportOnly = false }: { sizeReportOnly?: boolean } = {}): Promise<boolean> {
  const appDir = join(root, ".next/server/app");
  const files = htmlFiles(appDir);
  const pages: Page[] = files.map((file) => {
    const raw = readFileSync(join(appDir, file));
    const html = stripScripts(raw.toString("utf8"));
    const wrappers = crawlWrappers(html);
    // Table markup in the page's scripts means the tables travel twice: in the HTML and again in the data payload.
    const payloadTables = /\\u003ctable\\u003e|<table>/.test(raw.toString("utf8").match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)?.join("") ?? "");
    const firstCells = wrappers.reduce((total, wrapper) => total + countCells(wrapper.first), 0);
    const cells = firstCells + wrappers.reduce((total, wrapper) => total + countCells(wrapper.rest), 0);
    return { route: file.replace(/\.html$/, ""), html, wrappers, firstCells, cells, gzip: gzipSync(raw, { level: 6 }).length, payloadTables };
  });
  const failures: string[] = [];

  const missing = pages.filter((page) => CHART_PANEL.test(page.html) && page.wrappers.length === 0 && !(page.route.replace(/^en\//, "") in NO_CRAWL_TABLES));
  for (const page of missing) failures.push(`${page.route}: a chart panel but no data table`);
  for (const page of pages) {
    if (page.html.includes(HIDDEN_WRAPPER)) failures.push(`${page.route}: a crawl-tables wrapper with the hidden attribute, which AI readers drop`);
    for (const wrapper of page.wrappers) if (wrapper.hiddenBy) failures.push(`${page.route}: a data table is out of view, under ${wrapper.hiddenBy}`);
  }
  for (const route of Object.keys(NO_CRAWL_TABLES)) {
    for (const prefix of ["", "en/"]) {
      const page = pages.find((entry) => entry.route === `${prefix}${route}`);
      if (!page || page.wrappers.length > 0) failures.push(`${prefix}${route}: no longer qualifies for the no-crawl-tables exemption`);
    }
  }
  for (const route of MAP_INDEX_ROUTES) {
    for (const prefix of ["", "en/"]) {
      const page = pages.find((entry) => entry.route === `${prefix}${route}`);
      if (!page || page.wrappers.length === 0) failures.push(`${prefix}${route}: a map index page without its every-year tables`);
      else if (page.payloadTables) failures.push(`${prefix}${route}: its crawl tables' markup is repeated in the page's data payload`);
    }
  }
  // A block is a label, one region, tables and at most one <details>: anything else would break how this check reads it.
  const malformed = pages.filter((page) => page.wrappers.some((wrapper) => (`${wrapper.first}${wrapper.rest}`.match(/<div\b/g) ?? []).length !== 1 || /<details>/.test(wrapper.rest.slice(1))));
  for (const page of malformed) failures.push(`${page.route}: a data-table block is not a label, one region, tables and at most one <details>`);
  for (const page of pages.filter((entry) => entry.firstCells > CRAWL_CELL_CAP)) failures.push(`${page.route}: ${bytes(page.firstCells)} cells in its first tables, over the ${bytes(CRAWL_CELL_CAP)} cap`);
  for (const page of pages.filter((entry) => entry.cells > CRAWL_PAGE_CELL_CAP)) failures.push(`${page.route}: ${bytes(page.cells)} cells in all, over the ${bytes(CRAWL_PAGE_CELL_CAP)} page cap`);

  const totalGzip = pages.reduce((total, page) => total + page.gzip, 0);
  const overCeiling = totalGzip > GZIP_CEILING_BYTES ? `total gzip ${bytes(totalGzip)} bytes is over the ${bytes(GZIP_CEILING_BYTES)} ceiling` : null;
  if (overCeiling && !sizeReportOnly) failures.push(overCeiling);

  const messages = { ka: loadMessages("ka"), en: loadMessages("en") };
  const spotResults = SPOT_CHECKS.flatMap((check) => (["ka", "en"] as const).map((locale) => {
    const route = locale === "en" ? `en/${check.route}` : check.route;
    const page = pages.find((entry) => entry.route === route);
    const passed = page !== undefined && check.test(page.wrappers.map((wrapper) => `${wrapper.first}${wrapper.rest}`).join(""), messages[locale]);
    if (!passed) failures.push(`${route}: spot check failed: ${check.name}`);
    return `${passed ? "PASS" : "FAIL"} ${locale} ${check.name} (${route})`;
  }));

  const withTables = pages.filter((page) => page.wrappers.length > 0);
  console.log("Per page with a data table (cells in its first tables, cells in all, gzip bytes, characters a reader has taken when the first tables end):");
  for (const page of withTables) console.log(`  ${page.firstCells}\t${page.cells}\t${page.gzip}\t${Math.max(...page.wrappers.map((wrapper) => wrapper.readerEnd))}\t/${page.route}`);
  const chartPages = pages.filter((page) => CHART_PANEL.test(page.html));
  console.log(`HTML files: ${files.length} (baseline ${BASELINE_HTML_FILES})`);
  console.log(`Chart pages: ${chartPages.length}; pages with a data table: ${withTables.length}; cells in first tables: ${bytes(pages.reduce((total, page) => total + page.firstCells, 0))}; cells in all: ${bytes(pages.reduce((total, page) => total + page.cells, 0))}`);
  console.log(`Total gzip (level 6): before ${bytes(BASELINE_GZIP_BYTES)} bytes, after ${bytes(totalGzip)} bytes (${((totalGzip / BASELINE_GZIP_BYTES - 1) * 100).toFixed(1)}%), ceiling ${bytes(GZIP_CEILING_BYTES)} bytes`);
  if (overCeiling && sizeReportOnly) console.log(`WARNING (size report only, not a failure): ${overCeiling}`);
  console.log(`Top 10 pages by cells (first tables at most ${bytes(CRAWL_CELL_CAP)}, the page ${bytes(CRAWL_PAGE_CELL_CAP)}):`);
  for (const page of [...pages].sort((a, b) => b.cells - a.cells || a.route.localeCompare(b.route)).slice(0, 10)) {
    console.log(`  ${String(page.firstCells).padStart(5)} first  ${String(page.cells).padStart(6)} in all  ${page.wrappers.length} block(s)  ${bytes(page.gzip).padStart(9)} gzip  /${page.route}`);
  }
  // A map index page within a year's growth of the cap: its tables will need room before the next data update fails this check.
  for (const page of pages.filter((entry) => MAP_INDEX_ROUTES.includes(entry.route.replace(/^en\//, "")) && entry.firstCells > CRAWL_CELL_CAP - 250)) {
    console.log(`WARNING: /${page.route} has ${bytes(page.firstCells)} cells in its first tables, within 250 of the ${bytes(CRAWL_CELL_CAP)} cap`);
  }
  // An estimate, so a report and never a failure: the pages whose first tables end past what a short-window reader keeps.
  const pastWindow = withTables.map((page) => ({ route: page.route, readerEnd: Math.max(...page.wrappers.map((wrapper) => wrapper.readerEnd)) })).filter((page) => page.readerEnd > READER_WINDOW_CHARS);
  console.log(`Reader window (about ${bytes(READER_WINDOW_CHARS)} characters): the first tables end inside it on ${withTables.length - pastWindow.length} of ${withTables.length} pages.`);
  for (const page of pastWindow.sort((a, b) => b.readerEnd - a.readerEnd)) console.log(`  past the window: ${bytes(page.readerEnd)} characters  /${page.route}`);
  console.log("Spot checks:");
  for (const line of spotResults) console.log(`  ${line}`);
  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} problem(s)`);
    for (const failure of failures) console.error(`  ${failure}`);
    return false;
  }
  console.log("PASS");
  return true;
}

runAsCli(import.meta.url, async () => {
  if (!(await checkCrawlTables(process.cwd(), { sizeReportOnly: process.argv.includes("--size-report-only") }))) process.exitCode = 1;
});
