import { pathToFileURL } from "node:url";
import { writeInflationArtifacts, type InflationArtifactMode } from "../lib/data/inflation/prepareInflation";
import { checkPageDataFiles, writePageDataFiles } from "../lib/data/pageDataFiles";
import { INFLATION_PAGE_DATA_PREFIX, loadInflationPageData } from "../lib/pages/inflationPageData";

// The public modes also own the pages' fetched data files (public/page-data/inflation-*), written before the build
// beside the public CSV. "public" reads back what it wrote; "check-public" is that read on its own.
async function pageData(mode: InflationArtifactMode) {
  if (mode !== "public" && mode !== "check-public") return;
  const { products, categoryMonthly } = await loadInflationPageData();
  const files = [products, categoryMonthly];
  if (mode === "public") await writePageDataFiles(INFLATION_PAGE_DATA_PREFIX, files);
  await checkPageDataFiles(INFLATION_PAGE_DATA_PREFIX, files);
  console.log(`Inflation page data ${mode === "public" ? "written" : "matches"}: ${files.map((file) => file.fileName).join(", ")}`);
}

export async function main(args: readonly string[]) {
  const modes = (["--write", "--check", "--public", "--check-public"] as const).filter((flag) => args.includes(flag));
  if (modes.length !== 1) throw new Error("Pass exactly one of --write, --check, --public or --check-public");
  const mode = modes[0].slice(2) as InflationArtifactMode;

  const validation = await writeInflationArtifacts(mode);
  console.log(validation ? JSON.stringify(validation, null, 2) : `Inflation public CSV ${mode === "public" ? "written" : "matches"}`);
  await pageData(mode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
