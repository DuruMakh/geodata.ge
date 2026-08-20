# Georgia State Budget — Treasury Functional Expenditure: Complete Data Methodology (2004–2025)

Status: complete and reconciled; the 2004 extension was reviewed on 2026-08-20.

This is the authoritative, standalone methodology for the functional-classification
expenditure series in GeoData.ge — the treasury "ფუნქციონალურ ჭრილში დანახარჯები"
(form E11) data, mapped to public spending categories, for every fiscal year the app
carries. It documents, per year: which official documents were used, where they came
from, how they were parsed, how the numbers were reconciled to the official totals, and
every classification and data-scoping decision that was made along the way.

It consolidates and supersedes the per-era working notes, which remain in this folder
for deeper provenance detail:

- `2005-2006-old-classification-expenditure-methodology.md`
- `2007-2016-expenditure-final-methodology.md`
- `2025-expenditure-final-methodology.md` (the original confirmed 2017–2025 process)

Sibling methodologies for the app's other datasets: `revenue-methodology.md` (the receipts side —
consolidated-budget revenue from 2004–2025; the 2004 annual-report panel omits the unavailable
comparable liabilities amount, while 2005–2025 uses Treasury Form #1) and
`ministries-expenditure-methodology.md` (the organizational expenditure lens).

One-line integrity claim: **every published year reproduces byte-identical from
SHA-256-verified official source PDFs, and every year's category totals sum to the
official state-budget payments total within 1,000 GEL on multi-billion-GEL budgets.**

---

## 1. Scope, concept, and units

- **Dataset:** Georgia national **state budget** expenditure, **actual (cash) execution**,
  **functional** classification, annual.
- **Coverage:** detailed public-category data for **2004–2025** (22 continuous years).
  The 2004 functional facts come from the complete state-budget execution annex; the
  separate central-budget Treasury E11 PDF is retained as corroboration but is not served.
- **Accounting concept — "payments" (გადასახდელები):** every year measures the full
  payments concept, i.e. expenses **plus** non-financial asset growth **plus** financial
  asset growth (net lending) **plus** liabilities decrease (debt repayment). This is the
  same concept the Ministry of Finance headlines as `სულ გადასახდელები`. Using one
  concept for all years is what makes the series comparable — year-over-year growth is
  smooth and every jump traces to documented history (the 2005–2008 budget tripling of
  the reform era; the 2020–2021 COVID surge). See §8.
- **Units:** Georgian Lari (GEL), whole lari in the published facts. Several source
  documents are denominated in thousand-GEL; those are scaled ×1000 on ingest.
- **Public taxonomy:** 13 expenditure categories (`spending.*`): general public services,
  defence, public order & safety, economic affairs, agriculture & environment,
  infrastructure & regional development, health, culture, sport, education, social
  protection, debt service, and other/unclassified.

---

## 2. The two official source families

The functional expenditure of a Georgian fiscal year is not published in a single table.
Two official documents are combined:

1. **Treasury form E11 — "ფუნქციონალურ ჭრილში" (in functional breakdown).**
   The State Treasury's 12-month functional-classification statement. Downloaded from
   **treasury.ge**; committed under `docs/Raw Data/Expenditure/treasury.ge/<year>-12-month-state-budget-functional-expenditure.pdf`.
   From 2008 on, the E11 covers **expenses + non-financial asset growth** (it excludes
   financial-asset growth and debt repayment). This is the functional cut — it tells us
   *what* the money was spent on.

2. **MoF annual budget-execution supplement.**
   The Ministry of Finance annual execution report (or, for 2017–2025, the annual
   execution workbook). It supplies the two flows the E11 omits — **financial assets
   growth (ფინანსური აქტივების ზრდა)** and **liabilities decrease
   (ვალდებულებების კლება)** — and the official payments grand total to reconcile against.
   Downloaded from **mof.ge** (live for 2017+, recovered from the Internet Archive for the
   older years); committed under `docs/Raw Data/Expenditure/mof.ge/`.

Two eras are special: **2004–2006** use the older 14-group functional classification.
For 2004, the complete execution annex supplies the full-state table; for 2005–2006,
the E11 functional blocks already contain lending and debt repayment, so their E11 grand
total *is* the whole payments concept and **no supplement is needed** (the report is used
only to confirm the total). See §4.

---

## 3. The pipeline

```
final_year = mapped(E11 functional PDF)                     # expenses + non-financial assets, by function
           + financial-assets-growth supplement (per unit)  # from the MoF execution source
           + liabilities-decrease supplement (per unit)     # from the MoF execution source
  reconciled to the official payments grand total  (tolerance 1,000 GEL)
```

Guardrails, applied to every year:

- **SHA-256 verification.** Each E11 PDF's hash is checked against a pinned value before
  parsing; a mismatch aborts the run. (Hashes in §5.)
- **Deterministic mapping.** Functional codes and reviewed keyword rules — no manual
  per-row entry except the two 2008 whole-budget aggregates (§7.7), which cross-check to
  the report's own stated totals.
- **Reconciliation gate.** The composition script throws if the final total differs from
  the official total by more than 1,000 GEL. You cannot fabricate 13 category numbers that
  sum *exactly* to the official total unless they trace to real parsed rows, so
  reconciliation is a hard integrity check, not a soft one.
- **Regression pins.** All 22 detailed years have committed total pins in
  `apps/web/tests/data/pipelineIntegration.test.ts`; the shipped CSVs cannot drift silently.
- **Reproducibility.** Regenerating every year from source leaves the working tree
  git-clean — the shipped data *is* the pipeline's output from the official documents,
  never hand-edited.

Code map in §12.

---

## 4. Method by era

The treasury changed its E11 layout, font, code style, and classification several times
over 22 years. Five distinct extraction methods cover the series.

### Era 1 — 2017–2025 (modern E11 + execution workbook)

Clean Unicode E11, COFOG functional codes, dotted (7.1, 7.4.5). Supplement from the MoF
annual execution **workbook** (`excel-fact-files-2004-2025/<year>-fact.xlsx`, sheet "tavi 6"
/ "VI თავი"), which carries the per-program financial-assets and liabilities rows. The
"actual payment" column position varies by year's layout and is configured per year
(validated by reconciliation). Mapping: COFOG rules (§6a) for the E11, plus the reviewed
2023–2025 label mapping and candidate keyword rules (§6c) for the supplement rows.

### Era 2 — 2012–2016 (E11 + Chapter VI programmatic report PDF)

Same COFOG structure, but the supplement comes from the annual execution report's
**Chapter VI (თავი VI) programmatic** table, published as a PDF (live mof.ge URLs are
dead; recovered via the Internet Archive). Two era quirks:

- **Legacy non-Unicode font (2012–2014).** The treasury E11 embeds a legacy Georgian font
  whose glyphs land in IPA/spacing-modifier codepoints and lose word spaces. Codes and
  amounts parse normally, so extraction keys on the functional codes and display labels
  are replaced from a canonical code→label table
  (`cofogCanonicalLabels.ts`); the raw extracted text is retained as evidence.
- **Non-dotted codes (2012–2013).** These E11s print codes without dots (701 for 7.1,
  70111 for 7.1.1.1, 21 for 2.1). A per-year flag normalizes them before mapping.

### Era 3 — 2008–2011 (inline E11 + payments-by-organization report)

Older E11 row shape: each functional row prints its code, label, and five amount columns
inline (payment = commitment − arrears identity confirms the column); no `00` total rows;
the grand total is the bare code-`7` row. Parsed by a dedicated inline mode. Program
budgeting did not exist yet, so the supplement comes from the report's **payments-by-
organization chapter (Tavi V)**, parsed by unit with a deepest-carrier rule and hard
reconciliation to the report's published financial-assets / liabilities figures.
2008–2010 reports use a legacy ASCII-transliteration Georgian font (converted with a
LitNusx letter map). **2008** prints no per-organization financial rows at all — its
whole-budget aggregates (loans, equity, external/domestic debt repayment) are taken from
the report's Tavi I balance and financial-assets chapter (§7.7).

### Era 4 — 2007 (first COFOG year, old economic classification, no supplement)

2007 is the first COFOG functional year, but its E11 still uses the pre-GFSM2001 economic
classification, whose functional blocks **include** lending (დაკრედიტება) and debt
repayment (ვალების დაფარვა). So the E11 grand total already covers the whole payments
concept and **no supplement exists or is needed**; the execution report contributes only
the reconciliation total. State debt sits in functional code 7016 and maps through the
existing 7.1.6 → debt-service rule.

### Era 5 — 2004–2006 (pre-COFOG 14-group classification)

These predate COFOG entirely and use the **old 14-group functional classification**
(`01`…`14`). A dedicated parser and a dedicated group→category mapping are used (§6b).
The classification's functional groups already contain lending and debt repayment, so
again there is **no supplement** — the report is used only to confirm the payments total.
2006 is Unicode with GEL amounts; 2005 uses the legacy transliteration font with
thousand-GEL amounts.

### 2004 — complete state-budget execution annex

The canonical source is `2004-annual-execution-annex.pdf` (SHA-256
`C999654E8C2A430778E48FE67C1BFC7D15DC30F76A60CEEF4477614A31849889`). Its
organizational annex is pages **2–231** and its complete functional table is page **232**.
The latter supplies fourteen rounded full-state functional groups and the printed state-budget
payments total: **GEL 1,930,210,300**. The group values sum to GEL 1,930,210,400, so the
reviewed mapping applies the explicit **-GEL 100** source-table rounding adjustment only to
`spending.other_unclassified`, yielding the printed total exactly.

### 2004 — central-only Treasury E11 is not served

The archived Treasury E11 PDF (SHA-256
`33EE4A12881FB6AA6B3D7221ABBF8FEB61F1764B448B6F8A76155CC24AF67A97`) is a
central-budget-only document of roughly GEL 1.5bn. It is not the full state budget and is
therefore not served as a 2004 fact. It corroborates scope and parent groups only; no generated
review-row amount comes from it. Exact annex-derived carve-outs are sport (GEL 6,866,000),
external and domestic debt operations together (GEL 291,350,100), and intergovernmental
transfers (GEL 128,234,000).

---

## 5. Per-year source register

E11 = treasury form E11 (functional PDF), from **treasury.ge**, committed under
`docs/Raw Data/Expenditure/treasury.ge/`. Supplement/verify source from **mof.ge**,
committed under `docs/Raw Data/Expenditure/mof.ge/`. SHA-256 is of the treasury E11 PDF
(the hash the pipeline verifies on every run). "diff" is the final composed total minus
the official payments total.

| Year | Era | E11 SHA-256 (treasury) | Supplement / verify source | Final total (GEL) | diff (GEL) |
|---|---|---|---|---|---|
| 2004 | 5 | 33EE4A12… (central-only, not served) | complete execution annex, p.232, SHA-256 `C999654E…49889` | 1,930,210,300 | 0 |
| 2005 | 5 | BFC38ACB… | 2005 execution report (mof.ge doc 8907) — total only | 2,626,507,300 | 0 |
| 2006 | 5 | 5088EDA0… | 2006 execution report (mof.ge doc 8905) — total only | 3,822,512,626 | 0 |
| 2007 | 4 | F3CC7E9C… | 2007 execution report (mof.ge doc 8903) — total only | 5,237,131,090 | 10 |
| 2008 | 3 | 268178E5… | 2008 execution report (mof.ge doc 8898, Tavi I + pp.109–110 aggregates) | 6,758,831,737 | 63 |
| 2009 | 3 | C3558042… | 2009 execution report Tavi V (mof.ge doc 8894, pp.53–114) | 6,754,106,742 | 58 |
| 2010 | 3 | F98A74D4… | 2010 execution report Tavi V (mof.ge doc 8881, pp.47–100) | 6,972,343,653 | 147 |
| 2011 | 3 | 5D972664… | 2011 execution report Tavi V (mof.ge doc 8944, pp.69–151) | 7,459,279,360 | 140 |
| 2012 | 2 | 8509167D… | 2012 execution report Chapter VI (mof.ge doc 10150, pp.202–249) | 7,806,801,963 | 163 |
| 2013 | 2 | 84088FD0… | 2013 execution report Chapter VI (in-repo `final-fact-files-2004-2025/2013-fact.pdf`) | 8,104,217,952 | 352 |
| 2014 | 2 | A09E932E… | 2014 execution report Chapter VI (mof.ge `biuj2014_12tve/TAVI_VI.pdf`) | 9,009,812,195 | 5 |
| 2015 | 2 | ABDF59CF… | 2015 execution report Chapter VI (mof.ge `biuj2015/TAVI_VI.pdf`) | 9,703,126,964 | 136 |
| 2016 | 2 | 8F8509EB… | 2016 execution report Chapter VI (mof.ge `biuj2016_12tve/TAVI_VI_e.pdf`) | 10,292,234,620 | 520 |
| 2017 | 1 | 45DCDEBB… | 2017 execution workbook (`excel-fact-files-2004-2025/2017-fact.xlsx`, tavi 6) | 11,764,835,158 | < 1,000 |
| 2018 | 1 | F45968C1… | 2018 execution workbook (2018-fact.xlsx, tavi 6) | 12,590,181,621 | < 1,000 |
| 2019 | 1 | F0CBF895… | 2019 execution workbook (2019-fact.xlsx, tavi 6) | 13,469,688,961 | < 1,000 |
| 2020 | 1 | 01655B1F… | 2020 execution workbook (2020-fact.xlsx, tavi 6) | 16,174,635,967 | < 1,000 |
| 2021 | 1 | 1135A9CD… | 2021 execution workbook (2021-fact.xlsx, tavi 6) | 19,807,502,469 | < 1,000 |
| 2022 | 1 | 07E7F03F… | 2022 execution workbook (2022-fact.xlsx, tavi 6) | 20,163,012,511 | < 1,000 |
| 2023 | 1 | C20E1BF8… | 2023 execution workbook (2023-fact.xlsx, tavi 6) | 22,350,179,410 | < 1,000 |
| 2024 | 1 | DAA2BD22… | 2024 execution workbook (2024-fact.xlsx, tavi 6) | 25,946,342,918 | < 1,000 |
| 2025 | 1 | 1B680A25… | 2025 execution workbook (2025-fact.xlsx, tavi 6) | 27,723,319,039 | < 1,000 |

Full SHA-256 hashes of the supplement PDFs (2005–2016) and the exact Internet Archive
capture URLs are in the per-era docs and the machine-readable catalog
`data/sources/source-documents.csv`. The treasury E11 origin is
`https://treasury.ge/…` (12-month functional statements); the 2004 E11 is catalogued as
`source.mof_2004_expenditure_pdf_form_e11_actual` but not served as a fact.

---

## 6. Classification mapping

### 6a. COFOG functional code → public category (2007–2025)

The E11 functional (COFOG) codes map deterministically to the 13 public categories
(`apps/web/lib/data/realExpenditurePdf/publicMapping.ts`). Key rules:

| COFOG | Public category |
|---|---|
| 7.1.1 / 7.1.3 / 7.1.4 / 7.1.5 / 7.1.8 | general public services |
| 7.1.6 (debt operations) | debt service |
| 7.1.7 (intergovernmental transfers) | infrastructure & regional development |
| 7.2 | defence |
| 7.3 | public order & safety |
| 7.4.1 / 7.4.3 / 7.4.4 / 7.4.6 / 7.4.7 / 7.4.8 / 7.4.9 | economic affairs |
| 7.4.2 | agriculture & environment |
| 7.4.5 (transport & roads) | infrastructure & regional development |
| 7.5 (environment) | agriculture & environment |
| 7.6 (housing & communal) | infrastructure & regional development |
| 7.7 | health |
| 7.8.1 | sport |
| 7.8.2 / 7.8.3 / 7.8.4 / 7.8.6 | culture |
| 7.9 | education |
| 7.10 | social protection |

### 6b. Old 14-group → public category (2004–2006)

The pre-COFOG groups are the predecessors of the COFOG divisions, so the mapping is the
direct analogue (`oldClassificationExpenditurePdf.ts`). Each group maps to a dominant
category, with four sub-codes carved out (allocation is group-total-minus-carve-outs, so
the categories sum to the group totals, which sum to the grand total exactly):

- 1→general public services, 2→defence, 3→public order, 4→education, 5→health,
  6→social protection, 7→infrastructure, 8→culture, 9→economic affairs,
  10→agriculture/environment, 11→economic affairs, 12→infrastructure, 13→economic affairs,
  14→other/unclassified.
- Carve-outs: `08 01 01` sport→**sport**; `13 05` environment→**agriculture/environment**;
  `14 01` debt operations→**debt service**; `14 02` intergovernmental transfers→**infrastructure**.

### 6c. Supplement / keyword mapping (pre-2023 years)

Supplement rows (per-program or per-organization financial-assets / liabilities rows)
are mapped by, in order: (1) exact Georgian label match to the reviewed 2023–2025 mapping
file; (2) deterministic keyword rules in
`apps/web/lib/data/realExpenditure/candidateMapping.ts`. Keyword trap: never use the bare
stem "ზრუნვ" (it is a substring of the ubiquitous "უზრუნველყოფა"/provision and hijacks
unrelated rows) — the rule uses the exact phrase "სახელმწიფო ზრუნვ".

---

## 7. Reviewed data decisions (the judgment-call log)

Every non-mechanical choice, with its reasoning. Totals are invariant under
reclassification — none of these move a year's grand total; they only shift money between
categories (except 7.1, a scope decision).

**7.1 — 2004 complete state-budget functional inclusion.** The canonical execution annex's
page 232 has the complete state-budget functional table and its GEL 1,930,210,300 printed
payments total. The reviewed old-classification mapping uses its fourteen full-state parents;
the three exact carve-outs above are also read from that annex. The rounded parents total
GEL 1,930,210,400, so -GEL 100 is applied only to other/unclassified to preserve the printed
total exactly.

**7.2 — 2004 central-only Treasury E11 is not served.** The E11 is a narrower central-budget
document (~GEL 1.5bn), not a competing full-state total. It remains archived for scope and
parent corroboration but supplies no generated review-row amount.

**7.3 — 2005 uses the payments column, not the narrower expenditure column.** The 2005
E11 grand row carries both `გადასახდელები` (payments, incl. lending/debt, 2,626,507.3k)
and a narrower 12-month expenditure column (2,618,557.0k). Payments is used, for
consistency with the 2007+ concept.

**7.4 — 2009 tax-arrears clearance → general public services.** The 182.9M GEL row
"ორგანიზაციების წინა წლებში წარმოქმნილი საგადასახადო დავალიანებების დაფარვა" is the
state returning organizations' accumulated tax refund/overpayment claims — a
fiscal-administration operation under the Ministry of Finance, not sovereign debt service
and not attributable to a single sector. **Owner-reviewed:** corrected from an initial
debt-service classification to general public services.

**7.5 — 2012 disaster-fund financial-assets row (700,000 GEL) stays in other/unclassified.**
"სტიქიის შედეგების ლიკვიდაცია" — the label alone cannot distinguish infrastructure
restoration from household support. **Owner decision:** kept in other/unclassified. (This
is the only nonzero other/unclassified in 2007–2016.)

**7.6 — GIZ/KfW donor-coordination rows → infrastructure & regional development.**
Bilateral/regional donor project rows (ორმხრივი, რეგიონალური და რეგიონთაშორისი
პროექტები; KfW office co-financing). **Owner decision:** keywords `რეგიონთაშორისი პროექტ`,
`kfw`.

**7.7 — 2008 whole-budget financial aggregates → economic affairs / debt service.** The
2008 report has no per-organization financial rows, only whole-budget aggregates: loans
issued 142,620.2k + equity 57,092.9k (= the report's net financial-assets growth) →
**economic affairs** (documented enterprise-support programs — "იაფი კრედიტი", SOE
equity); external 58,633.3k + domestic 52,400.0k debt repayment (= liabilities decrease)
→ **debt service**.

**7.8 — 2011 arrears/court-judgment fund → public order & safety.** "წინა წლებში
წარმოქმნილი დავალიანების დაფარვისა და სასამართლო გადაწყვეტილებების აღსრულების ფონდი" —
mapped consistently with how the same fund is treated in the shipped 2012–2016 years.

**7.9 — 2014–2016 arrears reclassification (other/unclassified → 0).** 19 supplement
arrears rows initially unclassified were individually reviewed and covered by extended
keyword rules (e.g. შეიარაღებული ძალ→defence; სასწავლო/საგანმანათლებლო→education;
პატიმრობ→public order; ეპიდზედამხედველ→health; ფერმერ→agriculture; აეროპორტ/საჰაერო
ხომალდ→infrastructure — the 2.5M 2014 airport takeoff/landing reimbursement follows the
7.4.5 air-transport convention). other/unclassified is 0 for 2013–2016.

**7.10 — 2008–2011 supplement reclassification (other/unclassified → 0).** The same
keyword-review approach cleared all residual arrears rows for 2008–2011 (SOE agency
"საწარმოთა მართვის სააგენტო"→economic affairs; energy/water donor projects→infrastructure;
etc.); all keyword additions verified byte-identical no-ops for the already-shipped
2012–2016 outputs.

**7.11 — category splits are GeoData's mapping, not official categorization (disclosure).**
The annual totals are official and exact; the 13-category breakdown is GeoData's reviewed
mapping from the official functional/COFOG codes. This is disclosed in-app in the data
note: "წლიური ჯამები ოფიციალურ წყაროებს ეყრდნობა; კატეგორიებად დაყოფა GeoData-ის
კლასიფიკაციაა ოფიციალური ფუნქციური (COFOG) კოდების მიხედვით."

---

## 8. Reconciliation results

Every year's category total equals the official state-budget payments total within
tolerance (see the register in §5 for per-year figures and diffs). Diffs are 0–520 GEL on
budgets of 2.6B–27.7B GEL — a maximum relative error of 5 parts per hundred million.
2005 and 2006 reconcile exactly (diff 0). Year-over-year growth is smooth and every large
move is real history (the reform-era expansion 2005→2008, the flat post-crisis 2009, the
COVID surge 2020–2021), confirming a single consistent concept across the series.

---

## 9. Verification & reproducibility

- **Regenerate-and-diff:** running every year's generation script from the committed
  source PDFs leaves the working tree git-clean. The shipped CSVs are exactly the
  pipeline's output from the official documents.
- **Hash gate:** each treasury E11 PDF is SHA-256-checked before parsing.
- **Reconciliation gate:** the composition aborts if a year misses its official total by
  more than 1,000 GEL.
- **Regression pins:** all 22 detailed years pinned in
  `apps/web/tests/data/pipelineIntegration.test.ts`.
- **Test suite:** the repository's complete automated suite covers referential integrity
  (every fact's source is catalogued), coverage, non-negative values, and complete panels.

---

## 10. Limitations & disclosure

- **Categories are a mapping, not official taxonomy.** Totals are official; the 13-category
  split is GeoData's documented, reviewed mapping (§6, §7.11).
- **other/unclassified** is 0 for 2007–2011 and 2013–2016; 700,000 GEL in 2012 (one
  reviewed disaster-fund row, §7.5); and the residual of the old group 14 in 2005
  (2.06M / 0.08%) and 2006 (20.41M / 0.53%) — genuinely unclassified in the source.
- **2004 uses the complete execution annex, not the central-only E11** (§7.1–§7.2).
- **2013's supplement** is the in-repo Chapter VI PDF (`final-fact-files-2004-2025/2013-fact.pdf`,
  which is itself the 2013 annual report Chapter VI), not a separately re-downloaded file.

---

## 11. Source recovery (Internet Archive) & old-site index

The live mof.ge site 404s the legacy execution-report URLs after its migration; those
files were recovered from the Internet Archive. The old-site navigation
(`mof.ge/4981` "შესრულების ანგარიშები" → year page → "12 თვე") maps to document ids:

| Year | year page | 12-month page | report doc id |
|---|---|---|---|
| 2011 | /4983 | /4991 | 8944 |
| 2010 | /4993 | /4995 | 8881 |
| 2009 | /5003 | /5005 | 8894 |
| 2008 | /5013 | /5015 | 8898 |
| 2007 | /5023 | /5025 | 8903 |
| 2006 | /5033 | /5041 | 8905 |
| 2005 | /5037 | /5043 | 8907 |
| 2004 | /5039 | /5045 | 8909 (unused) |

Files retrieved via `mof.ge/common/get_doc.aspx?doc_id=NNNN` through
`web.archive.org`. 2012 = doc 10150 (full 518-page report, table pp.202–249). 2014–2016 =
the `mof.ge/images/File/biuj<year>…/TAVI_VI*.pdf` Chapter VI PDFs.

**Wayback truncation trap:** captures of large files can be silently truncated (the 2022
capture of the 2014 Chapter VI stops at exactly 1 MiB). Always compare the downloaded
size against `x-archive-orig-content-length` or prefer the newest capture, and confirm the
file ends with `%%EOF`.

---

## 12. Where the code lives

| Concern | File |
|---|---|
| Coverage constants (which years, which tier) | `apps/web/lib/data/coverage.ts` |
| E11 parser (modern + non-dotted + 2008–2011 inline + 2007 bare-code modes) | `apps/web/lib/data/realExpenditurePdf/phase1Pilot.ts` |
| Legacy-font canonical labels (2012–2014, + 2008–2011 codes) | `apps/web/lib/data/realExpenditurePdf/cofogCanonicalLabels.ts` |
| 2008–2011 organizational supplement parser | `apps/web/lib/data/realExpenditurePdf/legacyAnnualReportPdf.ts` |
| 2012+ programmatic Chapter VI parser | `apps/web/lib/data/realExpenditurePdf/tavi6ProgrammaticPdf.ts` |
| 2004 complete-state parser | `apps/web/lib/data/realExpenditurePdf/year2004StateBudget.ts` |
| Old 14-group parser + mapping (2004–2006) | `apps/web/lib/data/realExpenditurePdf/oldClassificationExpenditurePdf.ts` |
| COFOG → public category rules | `apps/web/lib/data/realExpenditurePdf/publicMapping.ts` |
| Keyword / supplement mapping | `apps/web/lib/data/realExpenditure/candidateMapping.ts` |
| Extraction scripts | `apps/web/scripts/extract-expenditure-pdf-pilot.ts`, `generate-final-2025-expenditure-data.ts`, `generate-final-old-classification-expenditure.ts` |
| Compose / import | `apps/web/scripts/compose-budget-facts.ts` |
| Regression pins | `apps/web/tests/data/pipelineIntegration.test.ts` |
| Machine-readable source catalog | `data/sources/source-documents.csv` |
| Published facts | `data/imports/expenditure-facts-2004-2025.csv`, `budget-facts-2004-2025.csv` |

---

## 13. Document provenance

Originally compiled 2026-07-05 for the reviewed 2005–2025 corpus at commit `17b0b66`,
consolidating this project's per-era methodology notes, source catalog, extraction and mapping
code, regression pins, and grounding review. Updated and revalidated on 2026-08-20 when the
complete reviewed 2004 state-budget annex was added. To export to Word or PDF for external
distribution: `pandoc treasury-functional-expenditure-methodology-2004-2025.md -o methodology.docx`.

Historical changelog 2026-07-13: published facts CSVs were renamed `expenditure-facts-2004-2025.csv` / `budget-facts-2004-2025.csv` → `*-2005-2025.csv` because the then-served files contained 2005–2025 rows only. On 2026-08-20, complete reviewed 2004 expenditure facts were added and the current served filenames returned to `*-2004-2025.csv`.

## 14. National GDP denominator

The multi-year explorer's `% მშპ-ში` measure divides each expenditure amount—including fields, ministries, programs, and the derived total—by Geostat's same-year nominal GDP at current prices. It is independent of selected series, and missing GDP is not estimated. The SNA 1993/SNA 2008 handoff, preliminary status, preserved workbooks, hashes, preparation commands, and export columns are documented in `national-nominal-gdp.md`. This denominator does not change the single-year expenditure composition view.
