import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactQuerySnapshot } from "../lib/factQuery/buildSnapshot";

const OUTPUT = path.join(process.cwd(), "lib", "factQuery", "generated", "snapshot.json");

function releaseCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check");

  const snapshot = await buildFactQuerySnapshot({
    releaseCommit: releaseCommit(),
    generatedAt: new Date().toISOString(),
  });

  if (write) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${OUTPUT} dataVersion=${snapshot.dataVersion}\n`);
    return;
  }

  const existing = JSON.parse(await readFile(OUTPUT, "utf8"));
  if (existing.dataVersion !== snapshot.dataVersion) {
    throw new Error(
      `Snapshot is stale: committed dataVersion ${existing.dataVersion} != rebuilt ${snapshot.dataVersion}. Run npm run data:prepare-fact-query-snapshot.`,
    );
  }
  process.stdout.write(`snapshot current dataVersion=${snapshot.dataVersion}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
