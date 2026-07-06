# 2007-2016 Expenditure Final Data Methodology

Status: implemented and reconciled (2026-07-04)

Scope: national budget expenditure, actual execution, 2007-2016

These years extend the confirmed 2017-2025 process (see `2025-expenditure-final-methodology.md`) backwards. The E11 functional PDF side is structurally identical to 2017-2025 for 2012-2016, with two era quirks: 2012-2014 E11 PDFs embed a legacy non-Unicode Georgian font (section 3a), and 2012-2013 print classification codes without dots — 701 for 7.1, 21 for 2.1 — normalized by the parser behind a per-year flag (section 3b). The 2008-2011 E11 PDFs use an older inline row shape parsed by a dedicated mode (section 3c). The supplement side required different official sources per era: programmatic Chapter VI report PDFs for 2012-2016, and payments-by-organization report chapters (program budgeting did not exist yet) for 2008-2011 (section 3d). 2007 — the first COFOG year — needs no supplement at all: its E11 still uses the old economic classification whose functional blocks include lending and debt repayment, so the E11 grand total is the whole official payments concept (section 3e).

## 1. Why these years needed a new supplement source

The confirmed process composes each year from two sources:

```text
final = mapped E11 functional PDF total
      + financial assets growth supplement (per program)
      + liabilities decrease supplement (per program)
```

For 2017-2025 the supplements come from the annual execution workbooks in
`docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/`.

For 2014-2016 the files with the same names in that folder are NOT
execution reports. They are budget-law annexes:

```text
2014-fact.xlsx  ->  2014 budget law annex: 2012 fact, 2013 fact, 2014 PLAN
2015-fact.xlsx  ->  2015 budget law annex: 2013 fact, 2014 fact, 2015 PLAN
2016-fact.xlsx  ->  2016 budget law annex (truncated): 2014 fact, 2015 fact, 2016 PLAN
```

Using them for supplements would silently mix plan data into actual facts.
The same caution applies to `final-fact-files-2004-2025/2015-fact.doc`
(same 2015 law annex in Word form).

## 2. Official actual supplement sources used

The Ministry of Finance annual budget execution reports ("სახელმწიფო
ბიუჯეტის შესრულების წლიური ანგარიში") publish Chapter VI — state budget
payments by programmatic classification — with approved plan, revised plan,
and actual execution columns per institution/program. These are the direct
analog of the 2017+ "VI TAVI" workbooks, published as PDFs.

The old mof.ge pages are no longer served after the site migration; the
files were retrieved from the Internet Archive captures of the original
mof.ge URLs:

```text
docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2012-annual-execution-report.pdf
  Full 518-page 2012 annual execution report ("მიმოხილვა", mof.ge doc 10150
  from the old-site page mof.ge/5069, listed on mof.ge/4981 "შესრულების
  ანგარიშები" -> 2012 -> 12 თვე). The payments-by-program table lives on PDF
  pages 202-249 (config workbookPageRange). Total row reads "00 00 მხარჯავი
  დაწესებულებები".
  archived copy used: http://web.archive.org/web/20140812055540/http://mof.ge/common/get_doc.aspx?doc_id=10150
  SHA-256: FD0E3A36731FEC184A8907B04024457E77139F2823547AFC5AB560C696980829

docs/Raw Data/Expenditure/mof.ge/final-fact-files-2004-2025/2013-fact.pdf
  Already in the repo: this IS the 2013 annual execution report Chapter VI
  ("თავი VI ... პროგრამული კლასიფიკაციის მიხედვით", authored 2014-04-01).
  Used as the 2013 supplement workbook directly. Note the source PDF itself
  contains the header typo "დაზუსტბული", tolerated by the parser.

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2014-annual-execution-tavi-VI-programmatic.pdf
  original: https://mof.ge/images/File/biuj2014_12tve/TAVI_VI.pdf
  landing page: https://mof.ge/shesrulebis_angarishi_2014
  archived copy used: http://web.archive.org/web/20250622055924/https://www.mof.ge/images/File/biuj2014_12tve/TAVI_VI.pdf
  (note: the 2022 capture of this URL is truncated at 1 MiB; the 2024+
  captures carry the full 2,987,605-byte file)
  SHA-256: 712B5B562E44F94A9A21547A3D47A684F8CF59AC1E5F79B3AF31514AD12F44E9

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2015-annual-execution-tavi-VI-programmatic.pdf
  original: https://mof.ge/images/File/biuj2015/TAVI_VI.pdf
  landing page: https://mof.ge/shesrulebis_angarishi_2015
  archived copy used: http://web.archive.org/web/20250327123345/https://www.mof.ge/images/File/biuj2015/TAVI_VI.pdf
  SHA-256: FC2056952A81FB514D6CC90A81CCF8CEEB299A563EB2A3D962A6D959D1C0BED4

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2016-annual-execution-tavi-VI-programmatic.pdf
  original: https://mof.ge/images/File/biuj2016_12tve/TAVI_VI_e.pdf
  landing page: https://mof.ge/shesrulebis_angarishi_2016_12tve
  archived copy used: http://web.archive.org/web/20221116100441/https://mof.ge/images/File/biuj2016_12tve/TAVI_VI_e.pdf
  SHA-256: 94206BA75B2ACB7F1F28CE88F69DB64E18617EA548537D195E055FE395436C7D
```

For 2008-2011 there is no programmatic Chapter VI (program budgeting was
introduced in 2012). The annual execution reports of that era publish the
payments table by organizational classification instead — Tavi V "წლის
სახელმწიფო ბიუჯეტის გადასახდელები ორგანიზაციული კლასიფიკაციის მიხედვით" —
with per-unit economic rows including ფინანსური აქტივების ზრდა and
ვალდებულებების კლება. Reports located through the old-site index
mof.ge/4981 ("შესრულების ანგარიშები") -> year page -> "12 თვე", files
served by mof.ge/common/get_doc.aspx (retrieved via Wayback, completeness
verified against x-archive-orig-content-length and %%EOF):

```text
docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2008-annual-execution-report.pdf
  "საქართველოს 2008 წლის სახელმწიფო ბიუჯეტის 12 თვის შესრულების მიმოხილვა"
  (mof.ge doc 8898 from year page /5013 -> "12 თვე" /5015; 276 pages,
  legacy ASCII-transliteration Georgian font).
  archived copy used: http://web.archive.org/web/20140813163326/http://www.mof.ge/common/get_doc.aspx?doc_id=8898
  SHA-256: B30010F44BE0E89639A5FB14B467F6362EB3A2BE4CE7266258EBD0EAB60ADD67

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2009-annual-execution-report.pdf
  "საქართველოს 2009 წლის ... 12 თვის შესრულების მიმოხილვა" (doc 8894 from
  /5003 -> /5005; 315 pages, legacy translit font; Tavi V pages 53-114).
  archived copy used: http://web.archive.org/web/20140812132632/http://www.mof.ge/common/get_doc.aspx?doc_id=8894
  SHA-256: CE18D097CA2394A1841A7256E53CEAFEDBC14E32C11E33F6D739F99414A14B85

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2010-annual-execution-report.pdf
  "საქართველოს 2010 წლის ... 12 თვის შესრულების მიმოხილვა" (doc 8881 from
  /4993 -> /4995; 274 pages, legacy translit font; Tavi V pages 47-100).
  The same year page also lists the full 2010 annual report (doc 9229),
  which republishes the same tables.
  archived copy used: http://web.archive.org/web/20140813152251/http://www.mof.ge/common/get_doc.aspx?doc_id=8881
  SHA-256: E95BBBF23808045F56E6E54CF531F4E00EB5F36FF3B4D6DC9FB26E6316C6F00D

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2011-annual-execution-report.pdf
  "საქართველოს 2011 წლის ... 12 თვის შესრულების მიმოხილვა" (doc 8944 from
  /4983 -> /4991; 464 pages, Unicode Georgian; Tavi V pages 69-151, with an
  in-table "00 00" grand block matching the summary balance exactly).
  archived copy used: http://web.archive.org/web/20140811235353/http://www.mof.ge/common/get_doc.aspx?doc_id=8944
  SHA-256: 3A6A2F5EB176E0A58EA18C4502EEFEA32D9C5D77D9D9B533FEE739775CB085C1
```

For 2007 the only figure needed from the execution report is the official
payments total (the E11 alone covers the year, section 3e):

```text
docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2007-annual-execution-report.pdf
  "საქართველოს 2007 წლის სახელმწიფო ბიუჯეტის 12 თვის შესრულების მიმოხილვა"
  (mof.ge doc 8903 from year page /5023 -> "12 თვე" /5025; 329 pages, legacy
  translit font). Official total: "sul saqarTvelos saxelmwifo biujetis
  gadasaxdelebi 5,469,861.0 5,237,131.1 95.75%", with the economic breakdown
  matching the E11 code-7 block line by line (მუშა-მოსამსახურეთა შრომის
  ანაზღაურება 483,770.9k; კაპიტალური ხარჯები 1,331,607.8k; დაკრედიტება
  77,985.2k; ვალების დაფარვა 151,744.9k). The same page's დანართი (doc 8904)
  republishes the functional cut.
  archived copy used: http://web.archive.org/web/20140812172300/http://www.mof.ge/common/get_doc.aspx?doc_id=8903
  SHA-256: 557A2E620F32149680C15BEE4714CDE10571A16FE7B8FF5FB2DCE5FBDBAFF26C
```

Cross-checks for 2008-2011: each report's Tavi I summary balance satisfies
გადასახდელები = ხარჯები + არაფინანსური აქტივების ზრდა + ფინანსური
აქტივების ზრდა (ნაშთის გამოკლებით) + ვალდებულებების კლება, and the
(ხარჯები + არაფინანსური აქტივების ზრდა) figure matches the treasury E11
grand total to within display rounding for every year. The 2008 report's
დანართი (doc 8897) additionally republishes the functional cut and its
division rows match the E11 extraction exactly (e.g. 701 = 1,363,102.1k).

Independent cross-check: the truncated 2016 law annex republishes the 2015
actual aggregates, and they match the 2015 report exactly (ხარჯები
8,157,998.4k; არაფინანსური აქტივების ზრდა 680,173.3k; ფინანსური აქტივების
ზრდა 444,804.8k; ვალდებულებების კლება 420,150.6k; სულ 9,703,127.1k).
Likewise the 2015 law annex republishes the 2014 actual aggregates and they
match the 2014 report exactly (ხარჯები 7,479,426.2k; ფინანსური აქტივების
ზრდა 272,202.2k; ვალდებულებების კლება 559,733.7k; სულ 9,009,812.2k).

The 2012-2016 execution report PDFs use proper Unicode Georgian text (only
the treasury E11 PDFs for 2012-2014 carry the legacy font).

For 2012 and 2013 the official aggregates republished in later budget-law
annexes match the composed supplements exactly:

```text
2012 (from the 2014 law annex, 2012-fact column):
  ხარჯები 6,566,316.0k; არაფინანსური აქტივების ზრდა 728,465.6k;
  ფინანსური აქტივების ზრდა 372,654.2k; ვალდებულებების კლება 139,366.1k;
  სულ 7,806,801.8k
2013 (from the 2015 law annex, 2013-fact column):
  ხარჯები 6,545,615.2k; არაფინანსური აქტივების ზრდა 767,632.2k;
  ფინანსური აქტივების ზრდა 277,105.1k; ვალდებულებების კლება 513,865.1k;
  სულ 8,104,217.6k
```

## 3. Pipeline pieces added or changed

### 3a. Legacy-font E11 labels (2012-2014)

The 2012-2014 treasury E11 PDFs embed a legacy Georgian font: glyphs land in
IPA/spacing-modifier codepoints (for example `ˆʨʸˇʬʩʰ` for ხარჯები) and
word spaces are lost. Codes and amounts parse normally, so extraction and
mapping key on functional codes; only the display labels are affected.

`apps/web/lib/data/realExpenditurePdf/cofogCanonicalLabels.ts` carries the
canonical functional-code -> Georgian label table (96 entries sourced from
the reviewed 2017/2016/2015 E11 extractions; COFOG labels are standardized
across years — every 2014 code is covered). Years flagged with
`legacyEncodedLabels: true` in the script configs get labelKa/hierarchyPath
replaced with canonical text; rawRowText keeps the original extracted
evidence. All functional codes appearing in 2012-2014 are covered by the
canonical table.

### 3b. Non-dotted classification codes (2012-2013)

The 2012 and 2013 E11 PDFs print codes without dots: functional 701,
70111 (for 7.1, 7.1.1.1) and economic 21 (for 2.1). Source entries flagged
`nonDottedCodes: true` normalize codes before the functional-context logic
(COFOG division = two digits after the leading 7, then one digit per
level), after which mapping rules and canonical labels apply unchanged.

```text
apps/web/lib/data/realExpenditurePdf/tavi6ProgrammaticPdf.ts
  New parser: Chapter VI programmatic PDF -> OfficialExpenditureRow[]
  (thousand-GEL amounts, three columns, wrapped labels, repeated page
  headers, trailing footnote markers "... 0.0 0.0 0.0 *").

apps/web/lib/data/realExpenditurePdf/phase1Pilot.ts
  - page-header flush also accepts dash timestamps ("21-03-2016 17:09");
  - collapses the 2015 E11 text-layer artifact where every label cell is
    repeated four times on a tab-separated line.

apps/web/lib/data/realExpenditurePdf/publicMapping.ts
  New reviewed rule: 7.4.8 (applied research in economic activity, present
  through 2015) -> spending.economic_affairs, medium confidence.

apps/web/scripts/extract-expenditure-pdf-pilot.ts
apps/web/scripts/generate-final-2025-expenditure-data.ts
  2015/2016 source entries use actualAmountIndex 3 (same column layout as
  2017/2018) and point workbookPath at the Chapter VI PDFs; both scripts
  parse a .pdf workbook path through the new parser.

apps/web/lib/data/coverage.ts
  EXPENDITURE_DETAILED_YEARS now starts at 2008. ADMIN_SPENDING_YEARS stays
  at 2017 (no execution workbooks with institution columns before that), so
  the functional-vs-admin reconciliation test covers the overlap years only.
```

Supplement mapping uses the same machinery as other pre-2023 years: exact
Georgian label propagation from the reviewed 2023-2025 mapping file first,
then the deterministic candidate rules (`candidateMapping.ts`). The final
report notes how many rows used generated candidates.

### 3c. 2008-2011 E11 inline row shape

The 2008-2011 treasury E11 PDFs predate the layout used from 2012 on:

- every functional row prints its non-dotted code, label, and five amount
  columns inline (no "00" totals rows; the grand total is the bare code "7"
  row "მთლიანი ხარჯები");
- economic breakdown rows underneath are label-only, without codes;
- the five columns are გეგმა, გადახდა, მოთხოვნა, ვალდებულება, დავალიანება.
  Column identity was established from the data itself: the identity
  col3 = col1 + col4 (ვალდებულება = გადახდა + დავალიანება) holds for every
  row of all four years (114 rows differ between col1 and col3 in 2009,
  177 in 2010), so the actual payment is column index 1
  (`actualAmountIndex: 1`);
- labels wrap across lines and page breaks; rows are reconstructed by
  accumulating lines until five amounts are collected
  (`inlineFunctionalRows: true` in `phase1Pilot.ts`).

Internal validation: the ten division rows (701-710) sum to the code-7 row
exactly (0.00 in all five columns, all four years). Labels are normalized
through the canonical table (`canonicalizeLabels: true`) to remove
mid-word wrap artifacts; 13 canonical entries were added for codes that
existed only in 2008-2011 (applied-research subcategories 7.1.5, 7.3.5,
7.4.8.1-7.4.8.7, 7.5.5, 7.7.5; preschool 7.9.1; basic general education
7.9.2.2; forestry 7.4.2.2; maritime transport 7.4.5.2), with labels taken
from the source PDFs. Three pre-existing canonical entries polluted with a
page footer ("გვერდი N - 40 დან" in 7.4.7, 7.6.3, 7.10.1.1) were repaired
in the same pass; the 2012-2014 staging/review CSVs were regenerated
(label-only diffs, amounts and totals unchanged). A new mapping rule
7.1.5 -> spending.general_public_services covers the applied-research code
present through 2010.

### 3d. 2008-2011 organizational supplement parsing

`apps/web/lib/data/realExpenditurePdf/legacyAnnualReportPdf.ts` parses the
payments-by-organization chapter (Tavi V) of the 2009-2011 reports into
the same workbook-row shape the 2012+ supplement pipeline consumes:

- amounts are thousand GEL with one decimal in two mixed print styles
  ("1,600,699.3" and "1 600 699,3"), sometimes mixed within one row;
  percent tokens are rejected;
- 2009-2010 text is the legacy ASCII-transliteration Georgian font,
  converted with the standard LitNusx letter map (Latin acronyms such as
  WB/KFW/GTZ/EBRD are preserved by an uppercase-run rule); 2011 is Unicode;
- org blocks are keyed by codes of two-digit groups ("23 00" ministry
  roots, "23 01 05" nested units). A code line is a new block header only
  when it opens a ministry root or starts with the current ministry id;
  any other code line is the continuation of a code that wrapped across
  lines and extends the last full header (e.g. "25 04 01" + "02 08 ...");
- ფინანსური აქტივების ზრდა / ვალდებულებების კლება rows are captured at
  every block depth, deduplicated against page-break re-prints, and
  filtered by a deepest-carrier rule (a parent's row is dropped when any
  captured descendant carries the same kind, because parents print sums of
  children). Donor-project component rows that repeat their unit's org
  code are handled by dropping a leading same-code aggregate when the
  following same-code rows sum to it;
- the walk stops at the chapter's "SUL ..." grand-total block (2009, 2010)
  or the explanations section "განმარტებები" (2011);
- the parser fails hard unless the kept rows sum to the officially
  published summary figures per kind (config pins, tolerance 0.25 thousand
  GEL). Extracted sums land within 0.2 thousand GEL of the official values
  for all six series (2009-2011, fin/liab).

The 2008 report prints no per-organization financial-assets or liabilities
rows at all; its whole-budget aggregates (Tavi I balance and the
financial-assets/liabilities chapter, report pages 109-110) are configured
explicitly and emitted in the same shape
(`buildAggregateSupplementWorkbookRows`):

```text
sesxebi (loans issued)                142,620.2k -> reviewed as economic affairs
aqciebi da sxva kapitali (equity)      57,092.9k -> reviewed as economic affairs
valdebulebebis kleba - sagareo         58,633.3k -> debt service
valdebulebebis kleba - saSinao         52,400.0k -> debt service
(loans + equity = 199,713.1k = the summary's net financial assets growth;
 external + domestic = 111,033.3k = the summary's liabilities decrease)
```

The loans figure is dominated by the documented government credit programs
("იაფი კრედიტი": 117 projects, 62.4M GEL approved — export promotion
50.8M, crafts/agriculture/tourism 11.6M — plus student-loan and other
subprograms) and the equity figure by state enterprise capital; both are
enterprise-support flows, mapped to spending.economic_affairs pending any
finer owner decision.

### 3e. 2007: first COFOG year, old economic classification, no supplement

The 2007 E11 uses COFOG functional codes (same 701-710 family, non-dotted)
but the pre-GFSM2001 economic classification: მუშა-მოსამსახურეთა შრომის
ანაზღაურება, კაპიტალური ხარჯები, დაკრედიტება (lending), ვალების დაფარვა
(debt repayment) — the last two printed inside the functional blocks, so
the E11 grand total covers the entire payments concept of that era and no
financial-assets/liabilities supplement exists or is needed.

Layout quirks handled by the shared inline mode
(`inlineFunctionalRows: true` plus a bare-code line pattern): each
functional code stands alone on its own line with the label and the five
amount columns following on the next lines; economic children print
amounts-first with the label injected before the last amount and are
skipped (only functional rows are extracted, as in every other year);
"მ.შ. კვების ხარჯები" memo lines are informational sub-items and are
likewise skipped. The five columns and the payment-column identity
(ვალდებულება = გადახდა + დავალიანება, actual at index 1) are the same as
2008-2011, and the ten division rows sum to the code-7 row exactly in all
five columns. State debt lives in functional code 7016 ("სახელმწიფო
ვალთან დაკავშირებული ოპერაციები": interest 97,460.2k + repayment
151,744.9k), which the existing 7.1.6 -> spending.debt_service rule maps
without any special handling. All 91 functional codes are covered by the
canonical label table.

The composition reuses the aggregate-supplement plumbing with an empty
items list: the execution report contributes only the official total
(5,237,131.1 thousand GEL) that the mapped E11 reconciles against.

## 4. Reconciliation results

```text
2007
  E11 PDF mapped total:            5,237,131,090 GEL
  Supplements:                                 0 GEL (none exist in 2007)
  Final total:                     5,237,131,090 GEL
  Official annual total:           5,237,131,100 GEL (thousand-GEL report rounding)
  Difference:                                 10 GEL (tolerance 1,000)

2008
  E11 PDF mapped total:            6,448,085,337 GEL
  Supplements (fin.assets+liab.):    310,746,400 GEL
  Final total:                     6,758,831,737 GEL
  Official annual total:           6,758,831,800 GEL (thousand-GEL report rounding)
  Difference:                                 63 GEL (tolerance 1,000)

2009
  E11 PDF mapped total:            6,274,268,442 GEL
  Supplements (fin.assets+liab.):    479,838,300 GEL
  Final total:                     6,754,106,742 GEL
  Official annual total:           6,754,106,800 GEL
  Difference:                                 58 GEL (tolerance 1,000)

2010
  E11 PDF mapped total:            6,486,731,853 GEL
  Supplements (fin.assets+liab.):    485,611,800 GEL
  Final total:                     6,972,343,653 GEL
  Official annual total:           6,972,343,800 GEL
  Difference:                                147 GEL (tolerance 1,000)

2011
  E11 PDF mapped total:            6,862,924,860 GEL
  Supplements (fin.assets+liab.):    596,354,500 GEL
  Final total:                     7,459,279,360 GEL
  Official annual total:           7,459,279,500 GEL
  Difference:                                140 GEL (tolerance 1,000)

2012
  E11 PDF mapped total:            7,294,781,563 GEL
  Supplements (fin.assets+liab.):    512,020,400 GEL
  Final total:                     7,806,801,963 GEL
  Official annual total:           7,806,801,800 GEL (thousand-GEL annex rounding)
  Difference:                                163 GEL (tolerance 1,000)

2013
  E11 PDF mapped total:            7,313,247,452 GEL
  Supplements (fin.assets+liab.):    790,970,500 GEL
  Final total:                     8,104,217,952 GEL
  Official annual total:           8,104,217,600 GEL
  Difference:                                352 GEL (tolerance 1,000)

2014
  E11 PDF mapped total:            8,177,876,295 GEL
  Supplements (fin.assets+liab.):    831,935,900 GEL
  Final total:                     9,009,812,195 GEL
  Official annual total:           9,009,812,200 GEL (thousand-GEL annex rounding)
  Difference:                                  5 GEL (tolerance 1,000)

2015
  E11 PDF mapped total:            8,838,171,764 GEL
  Supplements (fin.assets+liab.):    864,955,200 GEL
  Final total:                     9,703,126,964 GEL
  Official annual total:           9,703,127,100 GEL (thousand-GEL annex rounding)
  Difference:                                136 GEL (tolerance 1,000)

2016
  E11 PDF mapped total:            9,404,231,220 GEL
  Supplements (fin.assets+liab.):    888,003,400 GEL
  Final total:                    10,292,234,620 GEL
  Official annual total:          10,292,234,100 GEL
  Difference:                                520 GEL (tolerance 1,000)

spending.other_unclassified: 0 GEL for 2013-2016; 700,000 GEL (0.009%)
for 2012 — a single reviewed row kept there deliberately (see below). The initial runs
left 19 supplement arrears rows unclassified (3,919,900 / 288,100 /
541,300 GEL); their program labels were individually reviewed (2026-07-04)
and the deterministic keyword rules in `candidateMapping.ts` were extended
to cover them: შეიარაღებული ძალ -> defence; პატიმრობ, სამართალშემოქმედ ->
public order; სასწავლო, საგანმანათლებლო, ახალგაზრდ -> education;
ეპიდზედამხედველ -> health; ფერმერ -> agriculture/environment;
უშიშროების საბჭო, საკანონმდებლო, სახელმწიფო მინისტრის აპარატ -> general
public services; აეროპორტ, საჰაერო ხომალდ -> infrastructure (the largest
2014 row, 2.5M GEL, is reimbursement of aircraft takeoff/landing services
at Georgian airports under treaty obligations — air transport, following
the same convention that maps functional 7.4.5 transport to
infrastructure_regional_development). Year totals are invariant under
reclassification; the regression pins did not change. Keyword additions for
2012-2013 rows: სახელმწიფო ზრუნვ -> social protection (the bare stem ზრუნვ
is forbidden — it is a substring of უზრუნველყოფა and hijacks unrelated
labels), საინვესტიციო პოლიტიკ -> economic affairs.

Owner-reviewed decisions (2026-07-04): the GIZ/KfW donor-coordination
rows (ორმხრივი, რეგიონალური და რეგიონთაშორისი პროექტები; KfW ოფისის
თანადაფინანსება) map to spending.infrastructure_regional_development
(keywords: რეგიონთაშორისი პროექტ, kfw). The 2012 disaster-fund
financial-assets row "სტიქიის შედეგების ლიკვიდაცია" (700,000 GEL) stays
in spending.other_unclassified by explicit owner decision — the label
alone does not determine whether it financed infrastructure restoration
or household support.

2008-2011 supplements: spending.other_unclassified is 0 GEL in all four
final compositions. The initial runs left 26/17/14 rows (2009/2010/2011)
plus the two 2008 aggregates unclassified; each label was reviewed and the
keyword rules extended (2026-07-04) — all additions verified to leave the
2012-2016 outputs byte-identical:

- general public services: საგადასახადო დავალიანებ (the 2009 row
  "ორგანიზაციების წინა წლებში წარმოქმნილი საგადასახადო დავალიანებების
  დაფარვა", 182.9M GEL — owner-reviewed 2026-07-04: this is the state
  returning organizations' accumulated tax refund/overpayment claims, a
  fiscal-administration operation under the Ministry of Finance; it is not
  sovereign debt service and has no single sector, so it follows the
  MoF-family convention into general public services);
- infrastructure: ბუნებრივი გაზ, ელექტროქსელ, ელექტრომომარაგ,
  ელექტროსადგურ, წყლის პროექტ (energy-grid, gas-supply, and water donor
  projects, matching the existing power-infrastructure convention);
- economic affairs: საწარმოთა მართვის სააგენტო (SOE equity injections,
  the largest recurring item: 20.2M/27.9M/53.8M in 2009/2010/2011),
  იაფი კრედიტ, სესხები (ფინანსური აქტივების ზრდა), აქციები და სხვა
  კაპიტალი (the 2008 aggregates), სამშენებლო ინსპექცი, საინვესტიციო რისკ,
  ენერგომატარებლ;
- agriculture/environment: სოფლის განვითარების პროექტ, მეღვინეობ,
  ვაზისა და ღვინის, ბუნებრივი რესურს;
- public order: სასჯელაღსრულებ;
- social protection: მიგრაციულ, ლტოლვილ, ხანდაზმულ;
- education: ბიოქიმი, ბიოლოგი (science institutes), პატრიოტ (youth
  program);
- general public services: შემოსავლების სამსახური, სახაზინო სამსახური,
  ფინანსთა სამინისტრო, კონტროლის პალატა, არჩევნ, შესყიდვების სააგენტო,
  საჯარო სამსახურის ბიურო, სტატისტიკის, საგარეო საქმეთა, სამხრეთ ოსეთის
  ადმინისტრაცია, მიწის მართვის დეპარტამენტ;
- mixed health/social labels (ministry apparatus, program agencies)
  follow the existing reviewed-as-health convention.

Convention kept for consistency with 2012-2016: the fund "წინა წლებში
წარმოქმნილი დავალიანების დაფარვისა და სასამართლო გადაწყვეტილებების
აღსრულების ფონდი" maps to spending.public_order_safety in 2011 exactly as
it does in the shipped 2012-2016 years.
```

Regression pins for both totals live in
`apps/web/tests/data/pipelineIntegration.test.ts`.

## 5. Verification commands

```powershell
cd apps/web
npm run data:extract-expenditure-pdf-2007
npm run data:generate-final-2007-expenditure
npm run data:extract-expenditure-pdf-2008
npm run data:extract-expenditure-pdf-2009
npm run data:extract-expenditure-pdf-2010
npm run data:extract-expenditure-pdf-2011
npm run data:generate-final-2008-expenditure
npm run data:generate-final-2009-expenditure
npm run data:generate-final-2010-expenditure
npm run data:generate-final-2011-expenditure
npm run data:extract-expenditure-pdf-2012
npm run data:extract-expenditure-pdf-2013
npm run data:extract-expenditure-pdf-2014
npm run data:extract-expenditure-pdf-2015
npm run data:extract-expenditure-pdf-2016
npm run data:generate-final-2012-expenditure
npm run data:generate-final-2013-expenditure
npm run data:generate-final-2014-expenditure
npm run data:generate-final-2015-expenditure
npm run data:generate-final-2016-expenditure
npm run data:compose-budget-facts
npm run data:validate
npm test
```

## 6. Notes for the remaining years (2004-2006)

- 2005 and 2006 are now detailed via the pre-COFOG old 14-group
  classification — see `2005-2006-old-classification-expenditure-methodology.md`.
- 2004 is deliberately not loaded: its treasury E11 is central-budget scoped
  (~1.51B) rather than the full state budget (~1.93B). The source PDF stays
  recognized in `EXPENDITURE_SOURCE_YEARS`; revisiting it needs a
  state-budget functional source and a scope-caveat decision.
- The `excel-fact-files-2004-2025/<year>-fact.xlsx` files for pre-2017 years
  are budget-law annexes (plan data, prior-year facts). Do not use them as
  actual-execution sources without checking the column headers.
- The old-site year pages live under mof.ge/4981 ("შესრულების ანგარიშები"):
  2006 -> mof.ge/5033, 2005 -> /5037, 2004 -> /5039 (Wayback); files via
  mof.ge/common/get_doc.aspx?doc_id=NNNN.
- Wayback captures of large files can be silently truncated (the 2022
  capture of the 2014 Chapter VI stops at exactly 1 MiB). Always compare
  the downloaded size against `x-archive-orig-content-length` or prefer the
  newest capture, and check the file ends with `%%EOF`.
