import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { cleanFile } from "../lib/data/procurement/clean";
import { downloadSources } from "../lib/data/procurement/download";
import { buildParties, companyLookupQueue } from "../lib/data/procurement/parties";
import { procurementDataDir, sourceFiles } from "../lib/data/procurement/paths";
import { loadOrCreateSecret } from "../lib/data/procurement/privacy";
import { collectRegistry, flattenRegistry, politeClient } from "../lib/data/procurement/registry";
import { buildReport } from "../lib/data/procurement/report";
import { runAsCli } from "../lib/runAsCli";

const USAGE = "Usage: collect-procurement.ts download|clean|parties|registry [--limit N]|report";
const run = promisify(execFile);

function registryLimit(args: readonly string[]): number | undefined {
  if (args.length === 0) return undefined;
  const limit = Number(args[1]);
  if (args.length !== 2 || args[0] !== "--limit" || !Number.isInteger(limit) || limit < 1) throw new Error(USAGE);
  return limit;
}

/**
 * Collects procurement data into the private data folder (PROCUREMENT_DATA_DIR, default /mnt/project-files/procurement-data).
 * Not part of `npm run check`: the data is not in the repository. See docs/data-methodology/procurement-collection.md.
 */
export async function main(args: readonly string[]) {
  const [step, ...rest] = args;
  if (!["download", "clean", "parties", "registry", "report"].includes(step ?? "") || (step !== "registry" && rest.length > 0)) throw new Error(USAGE);
  const limit = step === "registry" ? registryLimit(rest) : undefined;
  const dataDir = procurementDataDir();

  if (step === "download") {
    const rows = await downloadSources(dataDir, fetch, async (zip, outDir) => { await run("unzip", ["-o", "-q", zip, "-d", outDir]); });
    console.log(JSON.stringify({ status: "passed", step, files: rows.length }));
  } else if (step === "clean") {
    const secret = await loadOrCreateSecret(dataDir);
    const stats = [];
    for (const file of sourceFiles()) stats.push(await cleanFile(file, dataDir, secret));
    fs.writeFileSync(path.join(dataDir, "clean", "stats.json"), `${JSON.stringify(stats, null, 2)}\n`);
    console.log(JSON.stringify({ status: "passed", step, files: stats.length, rows: stats.reduce((sum, s) => sum + s.rows, 0) }));
  } else if (step === "parties") {
    console.log(JSON.stringify({ status: "passed", step, ...(await buildParties(dataDir)) }));
  } else if (step === "registry") {
    const queue = await companyLookupQueue(dataDir);
    const client = politeClient(fetch, ms => sleep(ms), () => Date.now());
    const stats = await collectRegistry(dataDir, limit ? queue.slice(0, limit) : queue, client, line => console.error(line));
    const flattened = await flattenRegistry(dataDir);
    console.log(JSON.stringify({ status: stats.stopped ? "stopped" : "passed", step, queued: queue.length, ...stats, ...flattened }));
  } else {
    await buildReport(dataDir);
    console.log(JSON.stringify({ status: "passed", step, report: path.join(dataDir, "data-report.md") }));
  }
}

runAsCli(import.meta.url, main);
