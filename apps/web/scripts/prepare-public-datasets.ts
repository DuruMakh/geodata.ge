import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { preparePublicDatasets } from "../lib/data/publicDatasetExports";

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  const checkOutput = process.argv.includes("--check-output");
  if ([write, check, checkOutput].filter(Boolean).length !== 1) {
    throw new Error("Pass exactly one of --write, --check or --check-output");
  }

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const validations = await preparePublicDatasets({
    repositoryRoot,
    publicRoot: path.join(process.cwd(), "public"),
    mode: write ? "write" : checkOutput ? "check-output" : "check",
  });
  if (write) {
    const reportPath = path.join(repositoryRoot, "data", "reports", "public-dataset-validation.json");
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify({ status: "PASS", datasets: validations }, null, 2)}\n`, "utf8");
  }
  for (const row of validations) {
    console.log(`${row.datasetId}: PASS (${row.rowCount} rows, ${row.bytes} bytes, ${row.sha256})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
