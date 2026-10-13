import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareMethodologyArchives } from "../lib/methodology/prepareArchives";

export async function main(args: readonly string[]) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check");

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const summaries = await prepareMethodologyArchives({
    repositoryRoot,
    publicRoot: path.join(process.cwd(), "public"),
    reportPath: path.join(repositoryRoot, "data", "reports", "methodology-archive-validation.json"),
    mode: write ? "write" : "check",
  });
  for (const [datasetId, summary] of Object.entries(summaries)) {
    console.log(`${datasetId}: PASS (${summary.fileCount} originals, ${summary.totalBytes} source bytes)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
