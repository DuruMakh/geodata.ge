// The hidden crawl tables on a production build (DESIGN.md §8.4): every chart page carries them, no page holds more than
// the cell cap, the HTML stays within its size ceiling, and a few known figures reach the prerendered HTML.
// Run after `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`: `npm run crawl:check`. Not part of `npm run check`.
// CI runs it with `--size-report-only` after its build: the gzip ceiling then prints but does not fail, because its fixed
// baseline would go stale as the data grows; every other check (wrapper, cell cap, spot checks) still fails the run.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { CRAWL_CELL_CAP } from "../lib/explorer/crawlTables";
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

const WRAPPER = '<div hidden="" data-testid="crawl-tables">';
const CHART_PANEL = /data-testid="(?:[\w-]*chart-panel|municipal-chart-controls)"/;

type Page = { route: string; html: string; wrappers: string[]; cells: number; gzip: number; payloadTables: boolean };

const stripScripts = (html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");

/**
 * Each crawl-tables wrapper's inner HTML: it holds only tables, so the first closing div ends it. A wrapper with no table
 * (the server had none to write there) does not count, so it never satisfies "a chart page carries crawl tables".
 */
export function crawlWrappers(html: string): string[] {
  const wrappers: string[] = [];
  let at = html.indexOf(WRAPPER);
  while (at !== -1) {
    const end = html.indexOf("</div>", at);
    const inner = html.slice(at + WRAPPER.length, end);
    if (inner.includes("<table>")) wrappers.push(inner);
    at = html.indexOf(WRAPPER, end);
  }
  return wrappers;
}

const countCells = (wrappers: readonly string[]) => wrappers.reduce((total, inner) => total + (inner.match(/<td>/g) ?? []).length, 0);

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
    name: "Trade partners: the cap note",
    route: "explorer/trade/partners",
    test: (inner, messages) => {
      const [before, after] = message(messages, "controls.crawlTop", { kept: "\u0000", of: "\u0001" }).split(/\u0000|\u0001/);
      return tablesOf(inner).some((table) => table.caption.includes(before!) && table.caption.includes(after!));
    },
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
    return { route: file.replace(/\.html$/, ""), html, wrappers, cells: countCells(wrappers), gzip: gzipSync(raw, { level: 6 }).length, payloadTables };
  });
  const failures: string[] = [];

  const missing = pages.filter((page) => CHART_PANEL.test(page.html) && page.wrappers.length === 0 && !(page.route.replace(/^en\//, "") in NO_CRAWL_TABLES));
  for (const page of missing) failures.push(`${page.route}: a chart panel but no crawl tables`);
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
  const unwrappedTables = pages.filter((page) => page.wrappers.some((inner) => /<div\b/.test(inner)));
  for (const page of unwrappedTables) failures.push(`${page.route}: a crawl-tables wrapper holds a div`);
  for (const page of pages.filter((entry) => entry.cells > CRAWL_CELL_CAP)) failures.push(`${page.route}: ${bytes(page.cells)} crawl cells, over the ${bytes(CRAWL_CELL_CAP)} cap`);

  const totalGzip = pages.reduce((total, page) => total + page.gzip, 0);
  const overCeiling = totalGzip > GZIP_CEILING_BYTES ? `total gzip ${bytes(totalGzip)} bytes is over the ${bytes(GZIP_CEILING_BYTES)} ceiling` : null;
  if (overCeiling && !sizeReportOnly) failures.push(overCeiling);

  const messages = { ka: loadMessages("ka"), en: loadMessages("en") };
  const spotResults = SPOT_CHECKS.flatMap((check) => (["ka", "en"] as const).map((locale) => {
    const route = locale === "en" ? `en/${check.route}` : check.route;
    const page = pages.find((entry) => entry.route === route);
    const passed = page !== undefined && check.test(page.wrappers.join(""), messages[locale]);
    if (!passed) failures.push(`${route}: spot check failed: ${check.name}`);
    return `${passed ? "PASS" : "FAIL"} ${locale} ${check.name} (${route})`;
  }));

  const withTables = pages.filter((page) => page.wrappers.length > 0);
  console.log("Per page with crawl tables (cells, gzip bytes):");
  for (const page of withTables) console.log(`  ${page.cells}\t${page.gzip}\t/${page.route}`);
  const chartPages = pages.filter((page) => CHART_PANEL.test(page.html));
  console.log(`HTML files: ${files.length} (baseline ${BASELINE_HTML_FILES})`);
  console.log(`Chart pages: ${chartPages.length}; pages with crawl tables: ${withTables.length}; crawl cells in all: ${bytes(pages.reduce((total, page) => total + page.cells, 0))}`);
  console.log(`Total gzip (level 6): before ${bytes(BASELINE_GZIP_BYTES)} bytes, after ${bytes(totalGzip)} bytes (${((totalGzip / BASELINE_GZIP_BYTES - 1) * 100).toFixed(1)}%), ceiling ${bytes(GZIP_CEILING_BYTES)} bytes`);
  if (overCeiling && sizeReportOnly) console.log(`WARNING (size report only, not a failure): ${overCeiling}`);
  console.log(`Top 10 pages by crawl cells (cap ${bytes(CRAWL_CELL_CAP)}):`);
  for (const page of [...pages].sort((a, b) => b.cells - a.cells || a.route.localeCompare(b.route)).slice(0, 10)) {
    console.log(`  ${String(page.cells).padStart(5)} cells  ${page.wrappers.length} wrapper(s)  ${bytes(page.gzip).padStart(9)} gzip  /${page.route}`);
  }
  // A map index page within a year's growth of the cap: its tables will need room before the next data update fails this check.
  for (const page of pages.filter((entry) => MAP_INDEX_ROUTES.includes(entry.route.replace(/^en\//, "")) && entry.cells > CRAWL_CELL_CAP - 250)) {
    console.log(`WARNING: /${page.route} has ${bytes(page.cells)} crawl cells, within 250 of the ${bytes(CRAWL_CELL_CAP)} cap`);
  }
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
