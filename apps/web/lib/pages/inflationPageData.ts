import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedProductData } from "../data/inflation/importProducts";
import { categoryFactInput } from "../data/inflation/types";
import { pageDataFile, type PageDataFile } from "../data/pageDataFiles";
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
    return {
      products: pageDataFile(`${INFLATION_PAGE_DATA_PREFIX}products`, productRuns),
      productRuns,
      categoryMonthly: pageDataFile(`${INFLATION_PAGE_DATA_PREFIX}category-mom`, monthly),
    };
  })();
  return cached;
}
