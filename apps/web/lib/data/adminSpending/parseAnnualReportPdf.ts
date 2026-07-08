/**
 * Parser for the official mof.ge annual-execution-report "tavi VI" organizational
 * expenditure tables (PDF text). Turns the pdf-parse text of a report into coded rows
 * [code, label, approved plan, revised plan, ACTUAL] in thousand GEL.
 *
 * The table layout (verified on 2016) is:
 *   00 00 სულ ჯამი 10,297,950.0 10,297,950.0 10,292,234.1        <- code row, 3 amounts on the line
 *   ხარჯები 8,671,300.5 8,721,874.2 8,741,830.8                  <- economic-classification line (NO code) -> skipped
 *   01 00 საქართველოს პარლამენტი ... 58,031.7 58,031.7 55,667.4
 *   11 00                                                        <- code alone; label + amounts wrap
 *   სახელმწიფო რწმუნებულის - გუბერნატორის ადმინისტრაცია
 *   აბაშის, ზუგდიდის, ...მუნიციპალიტეტებში
 *   900.0 900.0 807.2                                            <- amounts on their own line
 *
 * Rows that carry a code (depth 1-4: "NN 00" / "NN NN" / "NN NN NN" / "NN NN NN NN")
 * are kept; the interleaved no-code economic-classification lines and the repeated
 * page headers / page numbers / formfeed markers do not match a code and are ignored.
 * Legacy AcadNusx-font years must be transliterated to Mkhedruli BEFORE parsing (the
 * numeric layout is identical; only the label glyphs differ).
 *
 * Some legacy years (2007/2008) use a two-amount "[plan | ACTUAL | execution %]" layout
 * instead of the three-amount "[approved | revised | ACTUAL]" layout — pass
 * { percentColumn: true } for those. A wider table has bigger gaps between coded rows
 * (2009) — pass a larger { maxGap }.
 */

export type AnnualReportRow = {
  code: string;
  label: string;
  approvedThousandGel: number | null;
  revisedThousandGel: number | null;
  actualThousandGel: number;
};

export type ParseAnnualReportResult = {
  rows: AnnualReportRow[];
  warnings: string[];
};

export type ParseAnnualReportOptions = {
  /** Two-amount "[plan | ACTUAL (საკასო) | execution %]" layout: take the 2nd amount as ACTUAL. */
  percentColumn?: boolean;
  /** Max lines without a coded row before we conclude the table has ended (default 40). */
  maxGap?: number;
};

// A code token: two-digit groups separated by single spaces, depth 1-4. Requires at least two
// groups ("NN NN"), so a bare 2-digit economic-classification code (e.g. "10 საქონელი და
// მომსახურება ...", "24 ...") in the legacy reports is never mistaken for a depth-1 organizational
// code. When a label follows on the same line it must start with a non-digit (so a "2016" year or
// a "282" page number never reads as a code).
const CODE_LINE = /^(\d{2}(?: \d{2}){1,3})(?:\s+(\D.*))?$/;

// A single amount: 1-3 leading digits, optional 3-digit thousands groups (space / no-break
// space / comma separated), then a REQUIRED decimal (dot or comma + 1-2 digits). Requiring
// the decimal makes the field boundary unambiguous with space-separated thousands.
const AMOUNT_SOURCE = "-?\\d{1,3}(?:[\\s,\\u00a0]\\d{3})*[.,]\\d{1,2}";
// Default layout: [approved plan | revised plan | ACTUAL] — take the last amount.
const THREE_AMOUNTS = new RegExp(`^(.*?)\\s*(${AMOUNT_SOURCE})\\s+(${AMOUNT_SOURCE})\\s+(${AMOUNT_SOURCE})\\s*$`);
// Legacy 2007/2008 layout: [plan | ACTUAL | execution %] — two amounts then a percent token;
// the ACTUAL is the SECOND amount.
const TWO_AMOUNTS_PERCENT = new RegExp(`^(.*?)\\s*(${AMOUNT_SOURCE})\\s+(${AMOUNT_SOURCE})\\s+[\\d.,\\s\\u00a0]+\\s*%\\s*$`);

const DEFAULT_MAX_TABLE_GAP = 40;

function toNumber(token: string): number | null {
  // Strip spaces / non-breaking spaces (space thousands separators), then handle the
  // decimal: European "19 980,8" -> 19980.8; US "10,297,950.0" -> 10297950.0.
  const noSpace = token.replace(/\s/g, "");
  let normalized = noSpace;
  if (/,\d{1,2}$/.test(noSpace) && !/\.\d/.test(noSpace)) {
    // comma is the decimal separator (no dot present): drop dot-thousands, comma->dot
    normalized = noSpace.replace(/\./g, "").replace(",", ".");
  } else {
    // dot is the decimal separator: commas are thousands separators
    normalized = noSpace.replace(/,/g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

type AmountMatch = { label: string; approved: number | null; revised: number | null; actual: number };

function endsWithAmounts(line: string, percentColumn: boolean): AmountMatch | null {
  if (percentColumn) {
    const m = line.match(TWO_AMOUNTS_PERCENT);
    if (!m) return null;
    const actual = toNumber(m[3]);
    if (actual === null) return null;
    return { label: m[1].trim(), approved: toNumber(m[2]), revised: null, actual };
  }
  const m = line.match(THREE_AMOUNTS);
  if (!m) return null;
  const actual = toNumber(m[4]);
  if (actual === null) return null;
  return { label: m[1].trim(), approved: toNumber(m[2]), revised: toNumber(m[3]), actual };
}

/** True if a line begins a new coded row (used to stop a wrapped-label accumulation). */
function isCodeLine(line: string): boolean {
  return CODE_LINE.test(line.trim());
}

export function parseAnnualReportRows(text: string, options: ParseAnnualReportOptions = {}): ParseAnnualReportResult {
  const percentColumn = options.percentColumn ?? false;
  const maxGap = options.maxGap ?? DEFAULT_MAX_TABLE_GAP;
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim());
  const rows: AnnualReportRow[] = [];
  const warnings: string[] = [];

  let i = 0;
  let lastResolvedLine = -1;
  while (i < lines.length) {
    // Once past the dense table, a long gap with no coded rows means we have entered the
    // per-ministry narrative "explanations" section — stop so its code-like prose
    // ("02 00 - საქართველოს პრეზიდენტის ...") and chart axes are never parsed.
    if (rows.length > 0 && lastResolvedLine >= 0 && i - lastResolvedLine > maxGap) break;
    const line = lines[i];
    const codeMatch = line.match(CODE_LINE);
    if (!codeMatch) {
      i += 1;
      continue;
    }

    const code = codeMatch[1];
    const rest = codeMatch[2] ?? "";

    // Case 1 — amounts on the same line as the code.
    const inline = rest ? endsWithAmounts(rest, percentColumn) : null;
    if (inline) {
      rows.push(makeRow(code, inline));
      lastResolvedLine = i;
      i += 1;
      continue;
    }

    // Case 2 — label (and amounts) wrap onto following lines. Accumulate text until a
    // line ends with the expected amounts, stopping if another code row starts first.
    const labelParts = rest ? [rest] : [];
    let resolved = false;
    let j = i + 1;
    for (let steps = 0; j < lines.length && steps < 12; j += 1, steps += 1) {
      const next = lines[j];
      if (!next) continue;
      // Check for a new coded row BEFORE trying to read amounts: a coded continuation line
      // ("12 00 ... 500.0 500.0 480.0") also ends with amounts, and the lazy label group would
      // otherwise let the current (amount-less) row swallow it and steal its amounts.
      if (isCodeLine(next)) break; // hit the next coded row before finding this row's amounts
      const amounts = endsWithAmounts(next, percentColumn);
      if (amounts) {
        if (amounts.label) labelParts.push(amounts.label);
        rows.push(makeRow(code, { ...amounts, label: labelParts.join(" ").replace(/\s+/g, " ").trim() }));
        resolved = true;
        lastResolvedLine = j;
        j += 1;
        break;
      }
      labelParts.push(next);
    }

    if (resolved) {
      i = j;
    } else {
      warnings.push(
        `Unresolved coded row ${code} at line ${i + 1}: "${labelParts.join(" ").slice(0, 80)}" (no trailing amounts found)`,
      );
      i += 1;
    }
  }

  return { rows, warnings };
}

function makeRow(code: string, match: AmountMatch): AnnualReportRow {
  return {
    code,
    label: match.label,
    approvedThousandGel: match.approved,
    revisedThousandGel: match.revised,
    actualThousandGel: match.actual,
  };
}

// ---------------------------------------------------------------------------------------------
// Targeted detail-section pass (2006/2007)
//
// The 2006/2007 reports print program-level rows only in per-ministry DETAIL sections deep in
// the document (the summary tavi-VI table is institution-only, and the narrative-stop guard of
// parseAnnualReportRows correctly ends there). Detail rows use the [plan | ACTUAL | %] layout,
// interleave no-code economic-classification lines, wrap labels, and often split the code
// itself across lines ("35" ⏎ "26 სოციალური პროგრამები 707,401.9 699,886.4 98.94%"). pdf-parse
// can also merge two visual rows into one text line, so the FIRST plan/actual/% triple after
// the label is the row's own (a trailing economic line may follow on the same text line).
//
// This pass extracts ONLY an explicit whitelist of depth-2 codes (the owner-approved
// legacy-join components), so stray code-like lines elsewhere in the report can never leak
// into staging. The first resolved occurrence of a code wins; a later occurrence with a
// different ACTUAL is reported as a warning.
// ---------------------------------------------------------------------------------------------

/** A line that is nothing but 2-digit code groups (a code split across lines). */
const CODE_GROUPS_ONLY = /^\d{2}(?: \d{2}){0,3}$/;
// The FIRST [plan | ACTUAL | %] triple anywhere in a line.
const FIRST_TWO_AMOUNTS_PERCENT = new RegExp(
  `(${AMOUNT_SOURCE})\\s+(${AMOUNT_SOURCE})\\s+[\\d.,\\u00a0]+\\s*%`,
);

/** Merge consecutive code-groups-only lines into the following line ("35"+"26 label…" → "35 26 label…"). */
function rejoinDetailSplitCodes(lines: string[]): string[] {
  const out: string[] = [];
  let pending = "";
  for (const line of lines) {
    if (CODE_GROUPS_ONLY.test(line) && `${pending} ${line}`.trim().split(" ").length <= 4) {
      pending = `${pending} ${line}`.trim();
      continue;
    }
    if (pending) {
      // A pending fragment only continues onto a line that does NOT itself start a complete
      // code: a genuine split looks like "35" ⏎ "26 label…" (single group + label). If the next
      // line already carries a full code ("32 03 label…"), the pending token was a stray
      // digit-only line (page number, table fragment) — merging would corrupt the real code, so
      // flush the fragment as its own (harmless, code-less) line instead.
      if (CODE_LINE.test(line)) {
        out.push(pending);
        out.push(line);
        pending = "";
        continue;
      }
      out.push(`${pending} ${line}`.trim());
      pending = "";
      continue;
    }
    out.push(line);
  }
  if (pending) out.push(pending);
  return out;
}

export function parseDetailProgramRows(text: string, codes: string[]): ParseAnnualReportResult {
  const wanted = new Set(codes);
  const lines = rejoinDetailSplitCodes(
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
  const byCode = new Map<string, AnnualReportRow>();
  const warnings: string[] = [];

  const resolveTriple = (candidate: string): { label: string; plan: number | null; actual: number } | null => {
    const m = candidate.match(FIRST_TWO_AMOUNTS_PERCENT);
    if (!m || m.index === undefined) return null;
    const actual = toNumber(m[2]);
    if (actual === null) return null;
    return { label: candidate.slice(0, m.index).trim(), plan: toNumber(m[1]), actual };
  };

  for (let i = 0; i < lines.length; i += 1) {
    const codeMatch = lines[i].match(CODE_LINE);
    if (!codeMatch || !wanted.has(codeMatch[1])) continue;
    const code = codeMatch[1];

    const labelParts: string[] = [];
    let resolved: { label: string; plan: number | null; actual: number } | null = null;
    const inline = resolveTriple(codeMatch[2] ?? "");
    if (inline) {
      resolved = inline;
    } else {
      if (codeMatch[2]) labelParts.push(codeMatch[2]);
      for (let j = i + 1, steps = 0; j < lines.length && steps < 8; j += 1, steps += 1) {
        if (CODE_LINE.test(lines[j])) break;
        // The amounts themselves can wrap mid-number ("… 181 297,5" ⏎ "181" ⏎ "243,0 100,0%"),
        // so resolve the triple against the ACCUMULATED text, not each line in isolation —
        // otherwise the row would steal the amounts of the next (economic) line.
        const wrapped = resolveTriple([...labelParts, lines[j]].join(" ").replace(/\s+/g, " ").trim());
        if (wrapped) {
          resolved = wrapped;
          break;
        }
        labelParts.push(lines[j]);
      }
    }
    if (!resolved) continue;

    const existing = byCode.get(code);
    if (existing) {
      if (Math.abs(existing.actualThousandGel - resolved.actual) > 0.05) {
        warnings.push(
          `Detail code ${code} resolved twice with different actuals (${existing.actualThousandGel} vs ${resolved.actual}); kept the first.`,
        );
      }
      continue;
    }
    byCode.set(code, {
      code,
      label: resolved.label,
      approvedThousandGel: resolved.plan,
      revisedThousandGel: null,
      actualThousandGel: resolved.actual,
    });
  }

  for (const code of codes) {
    if (!byCode.has(code)) warnings.push(`Detail code ${code} not found in the report text.`);
  }

  return { rows: codes.filter((code) => byCode.has(code)).map((code) => byCode.get(code)!), warnings };
}
