import path from "node:path";
import { prepareMethodologyArchives } from "../lib/methodology/prepareArchives";
import { runAsCli } from "../lib/runAsCli";

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

runAsCli(import.meta.url, main);
