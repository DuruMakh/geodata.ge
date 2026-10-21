import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { DATA_VALIDATE_CHECKS } from "../../scripts/validate-all";

const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts;

describe("data:validate", () => {
  it("runs every check in one process", () => {
    expect(scripts["data:validate"]).toBe("tsx scripts/validate-all.ts");
    expect(new Set(DATA_VALIDATE_CHECKS).size).toBe(DATA_VALIDATE_CHECKS.length);
    expect(DATA_VALIDATE_CHECKS).toContain("data:check-trade-composition");
  });

  // Importing the module, as the gate does, must hand back its main without running it: runAsCli runs main only
  // when the file is the one node was started with (tests/scripts/runAsCli.test.ts starts one that way).
  it.each(DATA_VALIDATE_CHECKS)("%s stays runnable on its own and exports the main the gate calls", async (name) => {
    const [runner, file] = (scripts[name] ?? "").split(" ");
    expect(runner).toBe("tsx");
    expect(file).toMatch(/^scripts\/[\w-]+\.ts$/);
    expect(existsSync(file)).toBe(true);
    const check = (await import(pathToFileURL(path.resolve(file)).href)) as { main?: unknown };
    expect(typeof check.main).toBe("function");
  });
});
