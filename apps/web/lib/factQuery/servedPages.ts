// apps/web/lib/factQuery/servedPages.ts
//
// The Fiscal.ge pages whose figures this service serves, each with the
// datasets behind it: the twelve core pages and every topic page
// (topics/pages.ts). Every other navigation page is website-only: a catalogue
// search that finds one points to it and gives no figure (describeCoverage.ts).
// tests/factQuery/describeCoverage.test.ts pins that each key is a NAV_TREE href
// and that every dataset appears here.
import { TOPIC_PAGES } from "./topics/pages";
import type { AnyDatasetId } from "./topics/types";
import type { DatasetId } from "./types";

export const CORE_SERVED_PAGES: Readonly<Record<string, readonly DatasetId[]>> = {
  "/explorer/expenditure": ["national-expenditure", "ministries"],
  "/explorer/revenue": ["national-revenue"],
  "/explorer/municipalities": ["municipal-expenditure"],
  "/explorer/debt": ["government-debt"],
  "/explorer/deficit": ["general-government-balance"],
  "/explorer/economy/gdp": ["gdp-overview"],
  "/explorer/economy/sectors": ["economic-sectors"],
  "/explorer/economy/regions": ["regional-economies"],
  "/explorer/inflation/overview": ["inflation"],
  "/explorer/inflation/categories": ["inflation"],
  "/explorer/inflation/products": ["inflation-products"],
  "/explorer/inflation/cities": ["inflation"],
};

/** Every page the service serves: the core pages, and each topic page with its one dataset. */
export const MCP_SERVED_PAGES: Readonly<Record<string, readonly AnyDatasetId[]>> = {
  ...CORE_SERVED_PAGES,
  ...Object.fromEntries(TOPIC_PAGES.map((page) => [page.pagePath, [page.datasetId]])),
};
