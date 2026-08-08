import { exec } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { GENERATED_ARTIFACT_PATH } from "../../../lib/data/municipalGeometry/prepareMunicipalGeometry";

const execAsync = promisify(exec);

async function expectStaleGeometryFailure(command: string) {
  const originalArtifact = await readFile(GENERATED_ARTIFACT_PATH, "utf8");

  try {
    await writeFile(GENERATED_ARTIFACT_PATH, `${originalArtifact} `, "utf8");

    let output = "";
    let exitCode = 0;
    try {
      const result = await execAsync(command, { cwd: process.cwd() });
      output = `${result.stdout}${result.stderr}`;
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      exitCode = failure.code ?? 1;
      output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    }

    expect(exitCode).not.toBe(0);
    expect(output).toContain("Stale municipality geometry artifact");
  } finally {
    await writeFile(GENERATED_ARTIFACT_PATH, originalArtifact, "utf8");
  }
}

it("rejects stale geometry through the data:validate entry point", async () => {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await expectStaleGeometryFailure(`${npm} run data:validate`);
}, 60_000);

it("rejects stale geometry through the standalone data validator", async () => {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await expectStaleGeometryFailure(`${npm} exec -- tsx scripts/validate-data-files.ts`);
}, 60_000);
