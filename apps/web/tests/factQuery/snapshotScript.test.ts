import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("fact query snapshot script", () => {
  it("is registered in both the prepare and validate chains", async () => {
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));

    expect(pkg.scripts["data:prepare-fact-query-snapshot"]).toContain("prepare-fact-query-snapshot.ts");
    expect(pkg.scripts["data:check-fact-query-snapshot"]).toContain("--check");
    expect(pkg.scripts["data:validate"]).toContain("data:check-fact-query-snapshot");
    expect(pkg.scripts.prebuild).toContain("data:prepare-fact-query-snapshot");
  });
});
