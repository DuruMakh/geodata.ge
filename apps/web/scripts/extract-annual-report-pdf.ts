/**
 * Pre-extraction for the Group C ministries-expenditure years: parses each official
 * mof.ge annual-execution-report / tavi-VI-programmatic PDF into a reviewable staging CSV
 * of coded organizational rows [year, code, label, approved, revised, ACTUAL] (thousand
 * GEL). The pipeline (lib/data/adminSpending/extractAnnualReportYears.ts) then reads that
 * staging CSV synchronously — PDF parsing (async, slow) happens once here, not per run.
 *
 * Legacy AcadNusx-font years are transliterated to Mkhedruli before parsing. Run:
 *   npm run data:extract-annual-reports
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseAnnualReportRows } from "../lib/data/adminSpending/parseAnnualReportPdf";
import { transliterateAcadNusx } from "../lib/data/adminSpending/transliterateAcadNusx";
import { normalizeOfficialCode } from "../lib/data/realExpenditure/hierarchy";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

const REPORT_DIR = "../../docs/Raw Data/Expenditure/mof.ge/annual-execution-reports";
const STAGING_OUT = "../../data/staging/admin-spending-annual-report-rows.csv";

type YearConfig = {
  year: number;
  file: string;
  transliterate: boolean;
  /**
   * Full annual reports embed the organizational table inside a large narrative document
   * (unlike the standalone tavi-VI files). Slice the text from this marker (the grand-total
   * or first-institution row) so the parser locks onto the org table and not an earlier
   * summary/revenue table.
   */
  tableStartMarker?: string;
  /** 2007/2008 use a two-amount "[plan | ACTUAL | %]" column layout. */
  percentColumn?: boolean;
  /** 2009's org table has larger gaps between coded rows than the default. */
  maxGap?: number;
  /** 2006 prints each institution code split across lines ("01"\n"00"\n label); rejoin them. */
  rejoinSplitCodes?: boolean;
};

/**
 * 2006's compact org table prints each institution's two code groups on separate lines
 * ("01" then "00", then the wrapped label + amounts). Rejoin every "NN" line immediately
 * followed by a "00[ label]" line into a single "NN 00[ label]" line so the parser reads it.
 */
function rejoinSplitCodes(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i].trim();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : "";
    const secondGroup = /^\d{2}$/.test(current) ? next.match(/^00(?:\s+(\D.*))?$/) : null;
    if (secondGroup) {
      out.push(`${current} 00${secondGroup[1] ? ` ${secondGroup[1]}` : ""}`);
      i += 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

// Add Group C years here as each is validated. 2015/2016 are clean-Georgian tavi-VI files;
// 2012 is a full report (org table sliced from its grand-total marker); legacy years
// (2006-2011) will set transliterate: true.
const YEAR_CONFIGS: YearConfig[] = [
  { year: 2006, file: "2006-annual-execution-report.pdf", transliterate: true, tableStartMarker: "ბიუჯეტის ხარჯების ორგანიზაციული კლასიფიკაცია", rejoinSplitCodes: true },
  { year: 2007, file: "2007-annual-execution-report.pdf", transliterate: true, tableStartMarker: "01 00 საქართველოს პარლამენტი და მასთან არსებული", percentColumn: true },
  { year: 2008, file: "2008-annual-execution-report.pdf", transliterate: true, tableStartMarker: "01 00 საქართველოს პარლამენტი და მასთან არსებული ორგანიზაციები", percentColumn: true },
  { year: 2009, file: "2009-annual-execution-report.pdf", transliterate: true, tableStartMarker: "01 00 საქართველოს პარლამენტი და მასთან", maxGap: 90 },
  { year: 2010, file: "2010-annual-execution-report.pdf", transliterate: true, tableStartMarker: "01 00 საქართველოს პარლამენტი და მასთან არსებული" },
  { year: 2011, file: "2011-annual-execution-report.pdf", transliterate: true, tableStartMarker: "00 00 საქართველოს სახელმწიფო" },
  { year: 2012, file: "2012-annual-execution-report.pdf", transliterate: false, tableStartMarker: "00 00 მხარჯავი დაწესებულებები" },
  { year: 2015, file: "2015-annual-execution-tavi-VI-programmatic.pdf", transliterate: false },
  { year: 2016, file: "2016-annual-execution-tavi-VI-programmatic.pdf", transliterate: false },
];

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function numText(value: number | null): string {
  return value === null ? "" : String(value);
}

async function pdfText(file: string): Promise<{ text: string; sha256: string }> {
  const buffer = readFileSync(path.resolve(process.cwd(), REPORT_DIR, file));
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const parsed = await new PDFParse({ data: buffer }).getText();
  return { text: parsed.text as string, sha256 };
}

async function main() {
  const header = ["year", "code", "label", "approved_thousand_gel", "revised_thousand_gel", "actual_thousand_gel"];
  const lines: string[] = [header.join(",")];

  for (const config of YEAR_CONFIGS) {
    const { text: rawText, sha256 } = await pdfText(config.file);
    let text = config.transliterate ? transliterateAcadNusx(rawText) : rawText;
    if (config.tableStartMarker) {
      const markerIndex = text.indexOf(config.tableStartMarker);
      if (markerIndex < 0) throw new Error(`${config.year}: tableStartMarker "${config.tableStartMarker}" not found in the report text.`);
      text = text.slice(markerIndex);
    }
    if (config.rejoinSplitCodes) text = rejoinSplitCodes(text);
    const { rows, warnings } = parseAnnualReportRows(text, {
      percentColumn: config.percentColumn,
      maxGap: config.maxGap,
    });

    const totalRow = rows.find((row) => row.code === "00 00");
    const institutionSum = rows
      .filter((row) => /^\d{2} 00$/.test(row.code) && row.code !== "00 00")
      .reduce((sum, row) => sum + row.actualThousandGel, 0);
    const delta = totalRow ? institutionSum - totalRow.actualThousandGel : NaN;

    console.error(
      `${config.year}: ${rows.length} coded rows | 00 00 total=${totalRow?.actualThousandGel ?? "MISSING"} | ` +
        `institution sum=${institutionSum.toFixed(1)} (delta ${delta.toFixed(1)}) | warnings=${warnings.length} | sha256=${sha256}`,
    );
    for (const warning of warnings.slice(0, 10)) console.error(`  ! ${warning}`);

    for (const row of rows) {
      const code = normalizeOfficialCode(row.code) ?? row.code;
      lines.push(
        [
          String(config.year),
          csvEscape(code),
          csvEscape(row.label),
          numText(row.approvedThousandGel),
          numText(row.revisedThousandGel),
          numText(row.actualThousandGel),
        ].join(","),
      );
    }
  }

  writeFileSync(path.resolve(process.cwd(), STAGING_OUT), `${lines.join("\n")}\n`, "utf8");
  console.error(`\nWrote ${lines.length - 1} rows to ${STAGING_OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
