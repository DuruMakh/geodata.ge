import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseThousandGel, readDocxTables } from "../../../lib/data/budgetLaw/readDocxTables";
import { BUDGET_LAW_2026 } from "../../../lib/data/budgetLaw/sources";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const originalTavi3Path = path.join(repositoryRoot, "docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-III.doc");

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

describe("readDocxTables", () => {
  it("reads the Tavi VI grand total row of the 2026 budget law", () => {
    const tables = readDocxTables(BUDGET_LAW_2026.tavi6DocxPath);
    const rows = tables.flat();
    expect(rows).toContainEqual([
      "00 00", "სულ ჯამი", "25,946,342.9", "27,941,729.4", "30,881,358.0", "29,521,958.0", "86,300.0", "1,273,100.0",
    ]);
  });

  it("reads the Article 9 total row of the converted Tavi III", () => {
    const rows = readDocxTables(BUDGET_LAW_2026.tavi3DocxPath).flat();
    const totalRow = rows.find((row) => row[0] === "7");
    expect(totalRow?.[1]).toBe("სულ ჯამი");
    expect(parseThousandGel(totalRow![4])).toBe(27311597);
  });

  it("joins runs inside a cell and drops empty paragraphs", () => {
    const header = readDocxTables(BUDGET_LAW_2026.tavi3DocxPath)[0][0];
    expect(header[0]).toBe("დასახელება");
  });

  it("decodes XML entities, collapses whitespace and keeps tables and rows apart", () => {
    const cell = (text: string) => `<w:tc><w:tcPr/><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
    const documentXml = `<w:document><w:body>
      <w:tbl><w:tr><w:trPr/>${cell("A &amp; B")}${cell("  x  &lt;1&gt;  &quot;q&quot; &apos;s&apos;  ")}</w:tr><w:tr>${cell("")}</w:tr></w:tbl>
      <w:tbl><w:tr>${cell("second")}</w:tr></w:tbl></w:body></w:document>`;
    const directory = mkdtempSync(path.join(tmpdir(), "docx-tables-"));
    try {
      const filePath = path.join(directory, "synthetic.docx");
      writeFileSync(filePath, zipSync({ "word/document.xml": strToU8(documentXml) }));
      expect(readDocxTables(filePath)).toEqual([[["A & B", `x <1> "q" 's'`], [""]], [["second"]]]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("parses thousand-GEL amounts", () => {
    expect(parseThousandGel("1,273,100.0")).toBe(1273100);
    expect(parseThousandGel("30,881,358.0")).toBe(30881358);
    expect(parseThousandGel("")).toBe(0);
    expect(parseThousandGel("  ")).toBe(0);
  });

  it("records the SHA-256 of the archived official files", () => {
    expect(sha256(originalTavi3Path)).toBe(BUDGET_LAW_2026.tavi3Sha256);
    expect(sha256(BUDGET_LAW_2026.tavi6DocxPath)).toBe(BUDGET_LAW_2026.tavi6Sha256);
    expect(BUDGET_LAW_2026.sourceId).toBe("source.mof_2026_budget_law_planned");
  });
});
