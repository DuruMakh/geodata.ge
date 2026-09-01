import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";

type CsvRow = Record<string, string>;

const repoRoot = path.resolve(process.cwd(), "../..");
const packageDir = path.join(
  repoRoot,
  "docs/Raw Data/Debt/government-debt-annual",
);

const expectedSourceIds = new Set([
  "mof_public_debt_bulletin_n7",
  "mof_public_debt_bulletin_n13",
  "mof_public_debt_bulletin_n19",
  "mof_public_debt_bulletin_n25",
  "mof_monthly_debt_report_2026_07",
  "mof_debt_strategy_2019_2021",
  "mof_debt_strategy_2022_2025",
  "mof_debt_strategy_2023_2026",
  "mof_debt_strategy_2025_2029",
  "mof_central_government_liabilities_control",
]);

function readPackageCsvRows(fileName: string): CsvRow[] {
  return parse(fs.readFileSync(path.join(packageDir, fileName), "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

describe("government debt research package", () => {
  it("pins every approved official source with matching hash and size", () => {
    expect(fs.existsSync(packageDir)).toBe(true);
    if (!fs.existsSync(packageDir)) return;

    const rows = readPackageCsvRows("source-manifest.csv");
    expect(new Set(rows.map((row) => row.source_id))).toEqual(expectedSourceIds);

    for (const row of rows) {
      const sourcePath = path.join(packageDir, row.local_file);
      expect(fs.existsSync(sourcePath), row.source_id).toBe(true);
      const bytes = fs.readFileSync(sourcePath);
      expect(String(bytes.length), row.source_id).toBe(row.bytes);
      expect(
        createHash("sha256").update(bytes).digest("hex").toUpperCase(),
        row.source_id,
      ).toBe(row.sha256);
    }
  });

  it("validates the complete manifest contract and rejects field drift", async () => {
    const modulePath = path.join(
      repoRoot,
      "apps/web/lib/data/governmentDebt/sourceManifest.ts",
    );
    expect(fs.existsSync(modulePath)).toBe(true);
    if (!fs.existsSync(modulePath)) return;

    const { validateGovernmentDebtSourceManifest } = await import(
      pathToFileURL(modulePath).href
    );
    const rows = readPackageCsvRows("source-manifest.csv");
    await expect(validateGovernmentDebtSourceManifest(rows)).resolves.toBe(true);

    const changedHash = rows.map((row, index) =>
      index === 0 ? { ...row, sha256: "0".repeat(64) } : { ...row },
    );
    await expect(
      validateGovernmentDebtSourceManifest(changedHash),
    ).rejects.toThrow("Unexpected source-manifest sha256");
  });
});
