import { loadServedProductData } from "../data/inflation/importProducts";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { checkPageDataFiles, pageDataFile, type PageDataFile } from "../data/pageDataFiles";
import { packProductFacts, type PackedProductSeries } from "../explorer/inflationProducts";

/** Every inflation page-data file starts with this, so the inflation prebuild step owns exactly these files. */
export const INFLATION_PAGE_DATA_PREFIX = "inflation-";

export type InflationPageData = {
  /** The 610 product index runs (U14-01): about 250 KB gzip that every products page view carried inline. */
  products: PageDataFile;
  productRuns: PackedProductSeries[];
};

let cached: Promise<InflationPageData> | null = null;

/** Built from the served data, so the pages and the prebuild step that writes the files name the same files. */
export function loadInflationPageData(): Promise<InflationPageData> {
  cached ??= (async () => {
    const { facts } = await loadServedProductData();
    const productRuns = packProductFacts(facts);
    const data = { products: pageDataFile(`${INFLATION_PAGE_DATA_PREFIX}products`, productRuns), productRuns };
    // `next build` and the prebuild step that wrote the files are separate processes that must compute the same names
    // (a .env read by one and not the other can change the data and so the hash). A page naming a file that is not on
    // disk would build green and show the load error, so the build fails instead.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) await checkPageDataFiles(INFLATION_PAGE_DATA_PREFIX, [data.products]);
    return data;
  })();
  return cached;
}
