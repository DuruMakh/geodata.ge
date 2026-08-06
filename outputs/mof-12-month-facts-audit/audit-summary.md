# MoF 12-Month Facts 2004-2025 Audit Summary

Date: 2026-06-24
Target: `docs/Raw Data/Expenditure/mof.ge/12-month-facts-2004-2025/`
Official index checked: <https://mof.ge/ka/govbudget>
Official endpoint checked: `https://mof.ge/ka/GovBudget/GetData`

## Current Result

This folder is now mostly verified for 2005-2025. For 2004, the Treasury functional-expenditure annex is category-mismatched, but a stronger source candidate has been found in the official MoF 2005 October budget-law editable package, which contains `2004 wlis faqti` columns in organizational/programmatic expenditure tables.

- 2004 functional-expenditure PDF remains in `2004/official-sources/`, but should not be used as the aligned programmatic source.
- 2004 source candidate now lives at `2004/official-sources/2005-october-budget-law-editable-files-with-2004-fact.source-candidate.rar`.
- The candidate is tied to the official MoF 2005 October state-budget editable-file link (`4. cvlileba 3.rar`, UUID `14f0e115-b730-4cca-8531-d828ec286d49`); local size is `872996`, matching the official inventory size. Direct re-download failed locally with a TLS receive error, so hash certification is still pending.
- 2005-2025 are official exact downloads/archive members or derived spreadsheets validated against official source files with documented fixes.

## Rejected / Quarantined Files

Moved to `outputs/mof-12-month-facts-audit/rejected/`:

- `2004-tavi-VI-VII.official-but-plan-not-fact.xls` - official, but not a 2004 fact file.
- `2012-tavi-VI.unverified-derived.docx` - not byte-certified; official 2012 PDF source was downloaded instead.
- `2014-12-month-tavi-VI.unverified-derived.doc` - not byte-certified; official 2014 PDF source was downloaded instead.
- `2015-12-month-tavi-VI.unverified-derived.doc` - not byte-certified; official 2015 PDF source was downloaded instead.
- `2016-12-month-tavi-VI.not-fact.xlsx` - budget-plan workbook with 2014 fact, 2015 fact, and 2016 plan columns; not 2016 annual facts.

## Year Status

| Year | Status | Evidence |
|---|---|---|
| 2004 | Source candidate found; not fully hash-certified | Treasury functional annex is category-mismatched. Better candidate: official MoF 2005 October budget-law editable RAR copied to `2004/official-sources/2005-october-budget-law-editable-files-with-2004-fact.source-candidate.rar`; extracted `II tavi.doc` and `IV tavi -*.doc` contain `2004 wlis faqti` / `2005 wlis gegma` columns, including organizational/programmatic expenditure rows. |
| 2005 | Certified derived XLSX + official PDF | Source PDF is exact official MoF archive member from 2006 December ZIP. Derived XLSX fact values matched official PDF fingerprints 93/93; 2006 plan columns add up. |
| 2006 | Certified derived XLSX + official PDF | Source PDF exact official MoF execution-report download. XLSX integrity clean; PDF fingerprint 126/126. |
| 2007 | Certified derived XLSX + official PDF | Source PDF exact official MoF execution-report download. XLSX integrity clean; PDF fingerprint 156/156. |
| 2008 | Certified after correction | Source PDF exact official MoF execution-report download. Fixed code `32 13 03 66` page-break parse error (`985528.39` -> `85528.39`, plan `85600`). XLSX integrity clean; PDF fingerprint 135/135. |
| 2009 | Certified derived XLSX + official PDF | Source PDF exact official MoF execution-report download. XLSX integrity clean; PDF fingerprint 143/143. |
| 2010 | Certified after correction with documented source anomaly | Source PDF exact official MoF execution-report download. Fixed code `34 00` malformed parent totals from direct child sums `34 01 + 34 14`. XLSX integrity clean; PDF fingerprint is 175/176 because the official PDF/extractor text for that parent row is itself malformed, while child rows reconcile. |
| 2011 | Certified derived XLSX + official PDF | Source PDF exact official MoF execution-report download. XLSX integrity clean; PDF fingerprint 482/482. |
| 2012 | Certified official source | Official MoF `2012 programmatic execution annex` PDF downloaded to `2012/official-sources/`. Unverified local DOCX was quarantined. |
| 2013 | Certified exact official source | Local PDF is exact official MoF annual Chapter VI execution-report download. |
| 2014 | Certified official source | Official MoF annual Chapter VI PDF downloaded to `official-sources/`. Unverified local DOC was quarantined. |
| 2015 | Certified official source | Official MoF annual Chapter VI PDF downloaded to `official-sources/`. Unverified local DOC was quarantined. |
| 2016 | Certified official source | Official MoF annual Chapter VI PDF downloaded to `official-sources/`. Local plan workbook was quarantined as not facts. |
| 2017 | Certified exact archive member | Local XLSX exact match inside official MoF annual execution-report ZIP member. |
| 2018 | Certified exact archive member | Local XLSX exact match inside official MoF annual execution-report RAR member. |
| 2019 | Certified exact archive member | Local XLSX exact match inside official MoF annual execution-report RAR member. |
| 2020 | Certified exact archive member | Local XLSX exact match inside official MoF annual execution-report RAR member. |
| 2021 | Certified derived XLSX + official DOCX | Official MoF annual Chapter VI DOCX downloaded. Local XLSX row-by-row comparison matched official DOCX 2056/2056 with zero mismatches. |
| 2022 | Certified exact official source | Local XLS exact official MoF annual execution-report Excel download. |
| 2023 | Certified exact official source | Local XLS exact official MoF annual execution-report Excel download. |
| 2024 | Certified exact official source | Local XLSX exact official MoF annual execution-report Excel download. |
| 2025 | Certified exact official source | Local XLSX exact official MoF annual execution-report Excel download. |

## Evidence Files

- `official-link-inventory.json` - official MoF link inventory for 2004-2025.
- `official-hidden-link-inventory.json` - hidden view checked; returned zero links for gap years.
- `official-annual-source-downloads.json` - official 2012, 2014, 2015, 2016, and 2021 downloads with hashes.
- `2004-treasury-pdf-validation.json` - official Treasury 2004 functional-expenditure annex hash, extraction shape, and summary consistency.
- `2005-xlsx-vs-official-pdf-fingerprint-check.json` - 2005 derived XLSX validation.
- `2004-fact-source-candidate-2005-cvlileba3-rar-inspection.json` - inspection evidence for the 2005 October editable RAR containing 2004 fact columns.
- `derived-xlsx-integrity-checks-after-fixes.json` - 2006-2011 integrity validation after fixes.
- `derived-xlsx-pdf-row-fingerprint-check-v4.json` - 2006-2011 PDF fingerprint validation after fixes.
- `2008-code-32-13-03-66-fix.json` - exact 2008 fix evidence.
- `2010-code-34-00-fix.json` - exact 2010 fix evidence.
- `2021-xlsx-vs-official-docx-row-compare.json` - 2021 row-by-row validation.

## Remaining Step

2004 still needs either direct official hash re-confirmation of the 2005 October editable RAR or an explicit decision to accept the MoF inventory-size match plus extracted `2004 wlis faqti` columns as sufficient provenance.

