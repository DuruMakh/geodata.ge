import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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

  // Check: validate the snapshot builds and is internally sound
  if (!snapshot.dataVersion || snapshot.dataVersion.length !== 64) {
    throw new Error("Invalid dataVersion: must be 64-char hex hash");
  }
  if (!Array.isArray(snapshot.national?.facts) || snapshot.national.facts.length === 0) {
    throw new Error("Invalid snapshot: national.facts array is empty");
  }
  if (!Array.isArray(snapshot.sources) || snapshot.sources.length === 0) {
    throw new Error("Invalid snapshot: sources array is empty");
  }
  process.stdout.write(`snapshot valid dataVersion=${snapshot.dataVersion}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
