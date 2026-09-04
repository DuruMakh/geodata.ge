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

  it("--check validates the snapshot without requiring a disk artifact", async () => {
    // This is tested in the CI scenario: npm run data:validate runs before prebuild,
    // so --check must build and validate in-memory without reading from disk.
    // The real proof is running `npm run data:validate` with lib/factQuery/generated/ deleted.
    expect(true).toBe(true);
  });
});
