import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAdjaraBudgetAdjustments } from "../../../lib/data/municipal/importAdjaraBudgetAdjustments";

const HEADER =
  "year,scope_id,republic_payments_gel,municipal_transfers_gel,net_republic_payments_gel," +
  "basis,republic_source_id,transfer_source_id";

async function fixture(rows: string[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "adjara-adjustments-"));
  const filePath = path.join(dir, "adjustments.csv");
  await writeFile(filePath, `${HEADER}\n${rows.join("\n")}\n`, "utf8");
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function row(year: number, overrides: Partial<Record<string, string>> = {}): string {
  const republic = overrides.republic ?? "170031400.00";
  const transfers = overrides.transfers ?? "27186011.29";
  const net = overrides.net ?? "142845388.71";
  return [
    year,
    overrides.scope ?? "region.adjara",
    republic,
    transfers,
    net,
    overrides.basis ?? "actual",
    overrides.republicSource ?? "source.adjara_republic_budget_actual",
    overrides.transferSource ?? "source.treasury_consolidated_revenue_actual",
  ].join(",");
}

function denseRows(): string[] {
  return Array.from({ length: 11 }, (_, index) => row(2015 + index));
}

describe("Adjara budget adjustment loader", () => {
  it("loads the complete 2015-2025 panel and preserves exact 2015 arithmetic", async () => {
    const rows = await loadAdjaraBudgetAdjustments(await fixture(denseRows()));

    expect(rows).toHaveLength(11);
    expect(rows.map((entry) => entry.year)).toEqual([
      2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(rows[0]).toEqual({
      year: 2015,
      scopeId: "region.adjara",
      republicPaymentsGel: 170031400,
      municipalTransfersGel: 27186011.29,
      netRepublicPaymentsGel: 142845388.71,
      basis: "actual",
      republicSourceId: "source.adjara_republic_budget_actual",
      transferSourceId: "source.treasury_consolidated_revenue_actual",
    });
  });

  it("rejects a scope other than region.adjara", async () => {
    const rows = denseRows();
    rows[0] = row(2015, { scope: "country.georgia" });

    await expect(loadAdjaraBudgetAdjustments(await fixture(rows))).rejects.toThrow(/region\.adjara/);
  });

  it("rejects a missing or duplicate year", async () => {
    await expect(
      loadAdjaraBudgetAdjustments(await fixture(denseRows().filter((entry) => !entry.startsWith("2020,")))),
    ).rejects.toThrow(/2015-2025/);

    const duplicate = denseRows();
    duplicate[5] = row(2019);
    await expect(loadAdjaraBudgetAdjustments(await fixture(duplicate))).rejects.toThrow(/duplicate year 2019/);
  });

  it("rejects a net amount that does not equal payments minus transfers", async () => {
    const rows = denseRows();
    rows[0] = row(2015, { net: "142845388.70" });

    await expect(loadAdjaraBudgetAdjustments(await fixture(rows))).rejects.toThrow(/2015 arithmetic/);
  });

  it("rejects blank amount cells instead of converting them to zero", async () => {
    const rows = denseRows();
    rows[0] = row(2015, { republic: "", transfers: "", net: "" });

    await expect(loadAdjaraBudgetAdjustments(await fixture(rows))).rejects.toThrow(/amount/);
  });

  it("rejects amounts with more than two decimal places", async () => {
    const rows = denseRows();
    rows[0] = row(2015, {
      republic: "170031400.001",
      transfers: "27186011.290",
      net: "142845388.711",
    });

    await expect(loadAdjaraBudgetAdjustments(await fixture(rows))).rejects.toThrow(/two decimal places/);
  });
});
