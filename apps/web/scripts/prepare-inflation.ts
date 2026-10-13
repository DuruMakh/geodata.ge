import { writeInflationArtifacts, type InflationArtifactMode } from "../lib/data/inflation/prepareInflation";
import { checkPageDataFiles, writePageDataFiles } from "../lib/data/pageDataFiles";
import { INFLATION_PAGE_DATA_PREFIX, loadInflationPageData } from "../lib/pages/inflationPageData";

const modes = (["--write", "--check", "--public", "--check-public"] as const).filter((flag) => process.argv.includes(flag));
if (modes.length !== 1) throw new Error("Pass exactly one of --write, --check, --public or --check-public");
const mode = modes[0].slice(2) as InflationArtifactMode;

// The public modes also own the pages' fetched data files (public/page-data/inflation-*), written before the build
// and checked after it, beside the public CSV.
async function pageData() {
  if (mode !== "public" && mode !== "check-public") return;
  const { products, categoryMonthly } = await loadInflationPageData();
  const files = [products, categoryMonthly];
  if (mode === "public") await writePageDataFiles(INFLATION_PAGE_DATA_PREFIX, files);
  else await checkPageDataFiles(INFLATION_PAGE_DATA_PREFIX, files);
  console.log(`Inflation page data ${mode === "public" ? "written" : "matches"}: ${files.map((file) => file.fileName).join(", ")}`);
}

writeInflationArtifacts(mode)
  .then(async (validation) => {
    console.log(validation ? JSON.stringify(validation, null, 2) : `Inflation public CSV ${mode === "public" ? "written" : "matches"}`);
    await pageData();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
