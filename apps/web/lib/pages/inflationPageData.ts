import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedProductData } from "../data/inflation/importProducts";
import { categoryFactInput } from "../data/inflation/types";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { checkPageDataFiles, pageDataFile, type PageDataFile } from "../data/pageDataFiles";
import { packCategoryFacts, type PackedCategorySeries } from "../explorer/inflationCategories";
import { packProductFacts, type PackedProductSeries } from "../explorer/inflationProducts";

/** Every inflation page-data file starts with this, so the inflation prebuild step owns exactly these files. */
export const INFLATION_PAGE_DATA_PREFIX = "inflation-";

export type InflationPageData = {
  /** The 610 product index runs (U14-01): about 250 KB gzip that every products page view carried inline. */
  products: PageDataFile;
  productRuns: PackedProductSeries[];
  /** The categories' monthly-change runs, which only the monthly tab reads (U13-03). */
  categoryMonthly: PageDataFile;
};

let cached: Promise<InflationPageData> | null = null;

/** Built from the served data, so the pages and the prebuild step that writes the files name the same files. */
export function loadInflationPageData(): Promise<InflationPageData> {
  cached ??= (async () => {
    const [{ facts }, { categories }] = await Promise.all([loadServedProductData(), loadServedInflationData()]);
    const productRuns = packProductFacts(facts);
    const monthly: PackedCategorySeries[] = packCategoryFacts(categories.filter((fact) => fact.measure === "mom_pct").map(categoryFactInput));
    const data = {
      products: pageDataFile(`${INFLATION_PAGE_DATA_PREFIX}products`, productRuns),
      productRuns,
      categoryMonthly: pageDataFile(`${INFLATION_PAGE_DATA_PREFIX}category-mom`, monthly),
    };
    // `next build` and the prebuild step that wrote the files are separate processes that must compute the same names
    // (a .env read by one and not the other can change the data and so the hash). A page naming a file that is not on
    // disk would build green and show the load error, so the build fails instead.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) await checkPageDataFiles(INFLATION_PAGE_DATA_PREFIX, [data.products, data.categoryMonthly]);
    return data;
  })();
  return cached;
}
