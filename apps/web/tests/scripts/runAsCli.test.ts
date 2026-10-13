import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Runs a converted data check the way npm does, `tsx scripts/<file>.ts`, but through a linked path. The guard it
// replaced compared the started path with the module's own URL as strings, so a symlinked or junctioned checkout
// ran nothing and exited 0; runAsCli compares real paths, and refuses a path it cannot resolve.
const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const linkRoot = mkdtempSync(path.join(tmpdir(), "run-as-cli-"));
const linkedScripts = path.join(linkRoot, "scripts");
// A junction needs no privileges on Windows; elsewhere the type is ignored.
symlinkSync(path.join(process.cwd(), "scripts"), linkedScripts, "junction");
afterAll(() => rmSync(linkRoot, { recursive: true, force: true }));

function runTsx(script: string) {
  return spawnSync(process.execPath, [tsxCli, script], { cwd: process.cwd(), encoding: "utf8" });
}

describe("runAsCli", () => {
  it("runs a check started through a linked path", () => {
    const result = runTsx(path.join(linkedScripts, "check-nominal-gdp-consistency.ts"));
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Nominal GDP artifacts agree");
    expect(result.status).toBe(0);
  }, 30_000);

  it("fails when the started path is not a file instead of doing nothing", () => {
    const result = runTsx(path.join("scripts", "check-nominal-gdp-consistency"));
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Cannot tell whether");
    expect(result.status).not.toBe(0);
  }, 30_000);
});
