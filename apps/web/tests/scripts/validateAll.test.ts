import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_VALIDATE_CHECKS } from "../../scripts/validate-all";

const scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts;

describe("data:validate", () => {
  it("runs every check in one process", () => {
    expect(scripts["data:validate"]).toBe("tsx scripts/validate-all.ts");
    expect(new Set(DATA_VALIDATE_CHECKS).size).toBe(DATA_VALIDATE_CHECKS.length);
  });

  it.each(DATA_VALIDATE_CHECKS)("%s stays runnable on its own and exports the main the gate calls", (name) => {
    const [runner, file] = (scripts[name] ?? "").split(" ");
    expect(runner).toBe("tsx");
    expect(file).toMatch(/^scripts\/[\w-]+\.ts$/);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(/^export async function main\(/m);
  });
});
