import { describe, expect, it } from "vitest";
import { parseDetailProgramRows } from "../../../lib/data/adminSpending/parseAnnualReportPdf";

// The 2006/2007 annual reports print program rows only in per-ministry detail sections with a
// [plan | ACTUAL | %] layout; these tests pin the pdf-parse text pathologies the pass handles.
describe("parseDetailProgramRows", () => {
  it("captures an inline whitelisted row and ignores non-whitelisted codes", () => {
    const text = [
      "32 03 ზოგადსაგანმანათლებლო სკოლები 201,407.4 201,396.2 99.99%",
      "32 07 პროგრამა ბავშვზე ზრუნვა 10,196.4 10,001.5 98.09%",
    ].join("\n");

    const { rows, warnings } = parseDetailProgramRows(text, ["32 03"]);

    expect(rows).toEqual([
      {
        code: "32 03",
        label: "ზოგადსაგანმანათლებლო სკოლები",
        approvedThousandGel: 201_407.4,
        revisedThousandGel: null,
        actualThousandGel: 201_396.2,
      },
    ]);
    expect(warnings).toEqual([]);
  });

  it("rejoins a code split across lines (\"35\" then \"26 label amounts\")", () => {
    const text = ["35", "26 სოციალური პროგრამები 707,401.9 699,886.4 98.94%"].join("\n");

    const { rows } = parseDetailProgramRows(text, ["35 26"]);

    expect(rows[0]?.code).toBe("35 26");
    expect(rows[0]?.actualThousandGel).toBe(699_886.4);
  });

  it("resolves amounts wrapping mid-number without stealing the next economic line's figures", () => {
    // The real 2006 roads layout: code groups on their own lines, the label wrapped, the
    // ACTUAL split across lines ("181" / "243,0 100,0%"), and the wage economic line following.
    const text = [
      "26",
      "14",
      "საქართველოს საავტომობილო გზების",
      "დეპარტამენტი 181 297,5",
      "181",
      "243,0 100,0%",
      "მუშა-მოსამსახურეთა შრომის ანაზღაურება 1 235,0 1 223,7 99,1%",
    ].join("\n");

    const { rows } = parseDetailProgramRows(text, ["26 14"]);

    expect(rows[0]?.approvedThousandGel).toBe(181_297.5);
    expect(rows[0]?.actualThousandGel).toBe(181_243.0);
    expect(rows[0]?.label).toBe("საქართველოს საავტომობილო გზების დეპარტამენტი");
  });

  it("does not merge a stray digit-only line (page number) into a following complete code", () => {
    const text = ["35", "32 03 ზოგადსაგანმანათლებლო სკოლების დაფინანსების პროგრამა 187,400.0 187,396.5 100.0%"].join("\n");

    const { rows, warnings } = parseDetailProgramRows(text, ["32 03"]);

    expect(rows[0]?.actualThousandGel).toBe(187_396.5);
    expect(warnings).toEqual([]);
  });

  it("keeps the first resolution and warns when a code re-resolves with a different actual", () => {
    const text = [
      "09 02 საერთო სასამართლოები 27,105.3 26,315.5 97.1%",
      "09 02 საერთო სასამართლოები 100.0 90.0 90.0%",
    ].join("\n");

    const { rows, warnings } = parseDetailProgramRows(text, ["09 02"]);

    expect(rows[0]?.actualThousandGel).toBe(26_315.5);
    expect(warnings.some((warning) => warning.includes("resolved twice"))).toBe(true);
  });

  it("warns for a whitelisted code that never resolves", () => {
    const { rows, warnings } = parseDetailProgramRows("მხოლოდ ტექსტი, კოდების გარეშე", ["99 98"]);

    expect(rows).toEqual([]);
    expect(warnings).toEqual(["Detail code 99 98 not found in the report text."]);
  });
});
