# Fiscal.ge data validation — October 2026

**Date:** 2026-10-12 · **Code reviewed:** `main` at `9177f036` (Merge PR #181) · **Status:** review complete; no data or code changed.
**Fix plan:** [2026-10-12-data-validation-fixes.md](../plans/2026-10-12-data-validation-fixes.md)
**Evidence:** 80 per-task reports in `.superpowers/data-validation-2026-10/<dataset>/<A|B|C|D>-*.md` (git-ignored, local to the
review worktree), the orchestrator log `ORCHESTRATOR.md` and the dataset inventory `inventory.md` in the same folder. Every
finding below carries its report id (for example `EXPM-B1` = expenditure-ministries, Task B, finding 1) and the key evidence,
so this document stands on its own.

## How the review was done

- **20 datasets** with live pages on `main` (inventory: `.superpowers/data-validation-2026-10/inventory.md`). Central budget
  spending was split into *by function* and *by ministry/program*; poverty and household income/spending were joined as
  *living standards*. Not reviewed: unmerged local branch `codex/national-budget-gdp-share` (edits the national GDP CSV).
- **Four checks per dataset**, one agent each (80 agents, Sonnet): **A** source reliability and vintage, **B** alternative
  sources with numeric comparisons, **C** rebuilding values straight from the official files without our scripts, **D**
  comparing what a visitor sees (Georgian and English pages, hub cards, Excel downloads, `/mcp`, published JSON, live
  fiscal.ge) with the reviewed CSVs. Display checks ran against a production build of `main` served locally
  (`NEXT_PUBLIC_SITE_URL=https://fiscal.ge`).
- **Orchestrator re-check:** every critical or high finding and every reported mismatch was re-opened at its source cell,
  CSV row or code line before it was accepted (re-check log in `ORCHESTRATOR.md`).

**Size of the sample.** About **280,000 values were rebuilt from the original publisher files** (complete rebuilds for 14
datasets — e.g. inflation 135,350 rows, trade ~87,500, municipal functions 7,040, demography 9,740 — and year samples for
budget spending, revenue and debt). About **115,000 displayed values** were compared on pages, charts, 200+ Excel workbooks,
`/mcp` answers and published files. Live fiscal.ge was identical to the local build of `9177f036` in every dataset checked.

**Result counts.** Agents reported **0 critical, 9 high, 209 medium, 320 low** findings (538 before merging duplicates;
many medium/low items repeat one shared cause, see §5). Orchestrator re-check of every high item and every reported
mismatch: **8 of 9 high reports confirmed** (two of them — GDP-B1 and DEMO-B1 — are the same issue, reframed: GDP per person
equals Geostat's own current figure, the problem is the population base), **1 downgraded** to medium (MONEY-B1), **0
withdrawn as false**. Re-checking also **promoted 8 medium reports**: 2 to critical (wrong public numbers: EXPM-B1, MUNI-C1)
and 6 to high (CA-B1/TRADE-B2, MUNI-A2, ENERGY-D1, REV-C3, EXPF-B1, EXPM-A1/EXPF-A3). Net result: **2 critical and 13 high
distinct issues**, all confirmed at the source cell, CSV row or code line.

---

## 1. Wrong or outdated numbers shown publicly (plain language)

The copying of numbers from official files into our data is **excellent**: in 280,000 rebuilt values there were **no
extraction errors**. The display layer also matches our data almost everywhere. The problems are in what we *chose* to show,
how we *label* it, and *how current* it is.

| # | What a visitor sees today | What is right | How big | Ids | Severity |
|---|---|---|---|---|---|
| W1 | **Ministry of Justice spending is too high.** The "Justice" line also contains the High Council of Justice (a court body). 2024: page shows 431.4 mln GEL. | Ministry of Justice alone: 425.0 mln; the 6.3 mln belongs in "Other costs" (our own methodology §6.10 says courts go there). | +1.5% every year the Council exists; total spending unaffected. | EXPM-B1 | critical |
| W2 | **Municipal spending per resident is slightly off**, because the 2025 population was copied from Geostat's rounded display (e.g. Lentekhi 5.1 thousand) instead of the stored value (5.145 thousand). The demography pages show the exact population, so two pages give two populations for the same place (Tbilisi 1,335,700 vs 1,335,671). | Use Geostat's stored values. | 39 of 64 municipalities off by 1–3 GEL per resident; up to 0.9% (Lentekhi 3,307 vs 3,278 GEL). | MUNI-C1, MUNI-D2, DEMO-C1, REG-B3 | critical |
| W3 | **Numbers ending in 5 are sometimes rounded down.** 0.95% shows as 0.9%; an inflation value of 1.65 shows as 1.6% on the page but 1.7% in the Excel file. | Round half-up consistently (as Excel and Geostat do). | Last digit only; 17 inflation cells seen wrong, one debt rate; any page using the shared formatter can be affected. | DEBT-D3, INF-D1 | medium (shared) |
| W4 | **Inflation is one month behind.** Pages end at August 2026 (5.6% a year). | Geostat published September 2026 on 2 October: 5.57%; core inflation 3.8% → 3.7%. | One month stale. | INF-A1 | high |
| W5 | **The 2022 deficit is an outdated IMF figure:** −1.60 bn GEL (−2.2% of GDP). | IMF's June 2026 country report: −1.865 bn (−2.6%); consistent with the Ministry of Finance. A new IMF database (October WEO) is due 13 October 2026. | 0.36 pp of GDP. | DEF-A1, DEF-B | high |
| W6 | **2025 grants come from a superseded Treasury print:** 122.3 mln GEL ("122 mln"). | Treasury's revised December file (24 Feb 2026), also in the Finance Ministry workbook already in our repo: 123.0 mln. | +0.57% grants; total +0.002%. | REV-A1 | high |
| W7 | **Two pages disagree on 2024 services exports:** Trade → Services shows 7,706.3 mln USD; External → Current account shows 7,769.1 mln. | The National Bank's current balance of payments (30 Sep 2026) has 7,769.1; Geostat's services table is an older vintage. | 0.8%; all in telecom/IT services. | CA-B1, TRADE-B2 | high |
| W8 | **Municipal spending by function adds up to more than the municipality's total** in 2016–2019. | In 61–63 of 64 municipalities each year the functions sum to more than the total shown (worst 113.5%); the function figures for those years come from a different, larger basis than the totals. From 2020 the parts add up. | Up to +13.5%; shares above 100%. | MUNI-A1, MUNI-A2, MUNI-B2 | high |
| W9 | **Revenue grants for 2008–2014 are 2–3 times lower than the Finance Ministry's own reports.** 2010: page 165 mln GEL. | MoF annual execution report 2010: 471 mln (state budget); MoF statistics and IMF agree with the report. Our figure faithfully copies the Treasury Form #1 row; why the two official documents differ is not yet known. | −61% to −86% on grants; total receipts only −0.6% (the rest sits in "other revenue"). | REV-B2, REV-C2 | high (cause open) |
| W10 | **"Food self-sufficiency: 19%"** on the Energy & food hub reads as all food. | It is wheat only. Maize 78%, potatoes 139%, grapes 158%. | Label. | ENERGY-D1 | high (label) |
| W11 | **"Total revenue"** includes 3.1 bn GEL of 2025 borrowing and 0.96 bn of asset sales (12.6% of the total; 38% in 2020). The landing page calls the same number "Total receipts". | Call it "receipts", or show revenue without financing. | Label. | REV-C3, REV-A7, REV-D | high (label) |
| W12 | **"Total expenditure"** includes debt repayment and purchases of financial assets. | The Ministry's and IMF's "total expenditure" exclude them: 2025 25.91 bn vs our 27.72 bn. Our total does match the State Audit Office cash figure. | +7% versus the usual definition. | EXPF-B1 | high (label) |
| W13 | **"Total services trade"** labels the exports, imports and balance rows on Trade → Services. | Exports 2024 = 7.71 bn; "total trade" (exports + imports) = 11.5 bn on the Overview tab. | Label. | TRADE-D1 | high (label) |
| W14 | **GDP per person 2024–2025** (28,235 GEL / 10,297 USD for 2025) is divided by the pre-census population (3.70 M) while our own population pages show 3.93 M. | Our number is Geostat's current published figure; World Bank and NBG already use the census population (World Bank 9,692 USD). Geostat revises on 13 Nov 2026. | ~6% higher than on the census base. | GDP-A3, GDP-B1, GDP-C1, DEMO-B1 | high (base/caveat) |
| W15 | Wages, *Industries* in **median** view: the lead line still says "Average monthly wage · 2,165.2 GEL" above a median table (1,531). | Lead line and labels should follow the measure. | Label. | WAGE-D1 | medium |
| W16 | Living standards methodology says Imereti's line **"steps down" in 2019**. | It steps **up**: income per household 893.1 → 1,040.4 GEL (+16.5%). | Wrong sentence. | LIV-C1, LIV-D1 | medium |
| W17 | **Electricity imports and exports** (2023: 4,234 / 4,913 GWh) are described as "electricity bought and sold abroad" (`lib/methodology/content/en/energyFood.ts:76`). | Geostat's figures include **transit** through Georgia: 3,445 GWh in 2023 (GNERC 2023 annual report). Georgia's own trade was about 790 GWh in and 1,468 GWh out. | ~81% of 2023 imports are transit; same pattern 2019–2022. | ENERGY-B1 | high (description) |
| W18 | **Provenance claim:** the methodology page calls the expenditure archive "unmodified official files". | 12 of those workbooks are our own Openpyxl extractions (2026-06-23/24) labelled as MoF files; their metadata cells contain local Windows paths (`C:\Users\Mylaptop\Desktop\Projects\…`). | 21 of 79 archive rows are derived or duplicate files. | EXPF-A3, EXPM-A1 | high (provenance) |

Downgraded after re-check: **MONEY-B1** (pre-2015 loan/deposit rates are NBG's own "period-end" annual figures, which differ
from NBG's Q4 figures; we copy NBG faithfully — now a medium break-marker issue plus an owner decision) and **INF-B1** (our
"contribution to inflation" is a documented approximation, 0.07 pp below Geostat's published contribution for transport;
medium, footnote).

### 1a. Deep dive on the three wrong numbers (owner request, 2026-10-12)

Method: read-only scripts that call the site's own code (`classifyAdminSpendingCategory`, `formatShare`, `formatPoints`,
`displayedValue`, the product-rate subtraction) on the reviewed CSVs and Geostat's stored cells. Scripts:
`scratchpad/orch/admin-audit.mts`, `muni-pop-audit.mjs`, `tie-scan.mjs`, `fmt-proof.mts` (session scratchpad).

**W1 — Ministry categories absorb bodies by name match.** Re-running the real classifier over all 21,231 staged official rows
reproduces all 303 served category-year totals exactly (0 mismatches), then lists every institution inside each category.
Four non-ministry bodies are placed by a keyword match instead of by owner; courts, the Prosecutor's Office, the Academy of
Sciences and the Intellectual Property Center are all correctly in *Other costs*, so these four are inconsistent with the
site's own rule (methodology §6.10). The 2004 review file records the reason as "Existing … keyword rule applies"
(`data/mappings/review/admin-spending-institution-review-2004.csv` rows 11, 39), while the Academy of Sciences (row 38) was
deliberately kept in Other costs.

| Body (institution code) | Shown under | Years | Amount per year | Overstatement of that category |
|---|---|---|---|---|
| High Council of Justice (10 00) | Justice | **every year 2004–2025** | 0.60 M (2005) → 6.85 M (2025); 59.9 M in total | 0.4%–2.8% a year; **2024 +1.49% (431.37 shown vs 425.04 M), 2025 +1.68% (413.80 vs 406.95 M)** |
| International Education Center (61 00 / 58 00) | Education, science & youth | 2015, 2016 | 5.14 M, 5.95 M | +0.62%, +0.63% |
| Academy of Agricultural Sciences (38 00) | Environment & agriculture | 2004 | 2.89 M | +3.91% |
| Lugar Public Health Research Center (48 00) | Health & social affairs | 2012, 2013 | 0.95 M, 0.55 M | +0.05%, +0.03% |

*Other costs* is understated by the same amounts; total spending is unaffected (no double counting). Visible on the ministries
view of `/explorer/expenditure` (both languages), its Excel workbooks, `query_ministries` on `/mcp` and
`/downloads/data/ministries.json`. No major program (≥100 M) belongs to these bodies, so the program drill-down is unaffected.

**W2 — Municipal population taken from Geostat's rounded display.** Only one reader in the codebase does this
(`readMatrix` with `raw: false`, `prepareGeostatPackage.ts:432`); it reads Geostat's population and regional-GDP workbooks. The
regional-GDP output stays inside the research package (the served regional-economies data has its own exact reader), so the
public impact is the 2025 municipal population only. Per-resident spending exists for 2025 only
(`MUNICIPAL_PER_RESIDENT_YEAR`).

- **39 of 64 municipalities show a different whole-GEL per-resident figure**; max error 0.88%. Largest: Lentekhi 3,307 shown
  vs 3,278 correct (+29 GEL; population 5,100 vs 5,145), Kazbegi 3,476 vs 3,457 (+19), Oni 4,373 vs 4,396 (−23), Tsageri
  2,800 vs 2,812 (−12), Mestia 4,339 vs 4,351 (−12), Ambrolauri 2,862 vs 2,872 (−10). Errors are largest in the smallest
  mountain municipalities.
- **Regions:** at most −5 GEL (Racha-Lechkhumi and Kvemo Svaneti 3,209 vs 3,214); all others within 1 GEL.
- **Ranking:** one swap in the per-resident order (Abasha and Terjola, positions 40/41).
- **Population sum:** 3,930,600 served vs 3,930,428 stored; the demography pages show the stored values, so the two page
  families disagree for every municipality (e.g. Tbilisi 1,335,700 vs 1,335,671).
- Visible on the municipalities index list and map (including hover/aria text), region and municipality pages, and
  `query_municipal` per-resident answers.

**W3 — Rounding.** The main number formatter (Intl, `fixed()` in `format.ts`) and Excel both round correctly
(0.95 → 1.0). The fault is limited to code paths that round with JavaScript `toFixed`: `formatShare` and `formatPoints`
(`format.ts:83-100`), `displayedValue` (`inflationGrid.ts:26`), and inflation label helpers. They lose one in the last digit
whenever the stored decimal ends exactly in 5 and its binary value sits just below the tie. Proven by calling the site's
functions: 0.95 → "0.9" (correct 1.0), 1.65 → "1.6" in the inflation grid but "1.7%" via `formatShare`, 12.85 → "12.8",
9.85 → "9.8"; product index 99.05 → "−0.9%" (correct −1.0%).

A scan of every number in `data/imports/*.csv` for exact ties, simulating each page path, finds the visible cases are
confined to:

| Dataset | Cells shown with the last digit one too low | Examples |
|---|---|---|
| Inflation — national, categories, cities (1-decimal grids/labels) | 22 (national 1, categories 10, cities 11); 17 confirmed on rendered pages by Task D | core ex-tobacco Nov 2014 1.65 → 1.6; category Feb 2013 0.35 → 0.3; city category 11 Jul–Aug 2023 9.85 → 9.8 |
| Inflation — products (rate = index − 100, via `formatShare`) | 28 of 74 tie values | p0028 May 2024 −0.95 → −0.9; p0015 Nov 2022 annual 6.85 → 6.8; p0019 Aug 2019 annual 5.05 → 5.0 |
| Government debt — interest rates | 1 | external 2021 0.95% → 0.9% |

All other datasets either format through the correct Intl path, serve `published_value` already at display precision, or
have no exact ties among displayed values (confirmed by their Task D checks: unemployment 0/3,370, wages 0/1,917, living
standards 0/11,129, demography 0/5,095 shares, energy, money & banks, FDI, money from abroad). Derived numbers (growth, shares,
pp changes) rarely land on an exact tie; none was found, but the same faulty path would mis-round one if it did. **Total:
about 51 displayed values, each off by 0.1 in its last digit; in the inflation pages the page and the Excel file can show
different last digits for the same cell.**

---

## 2. Source register

Reliability is the Task A score (1–5). "Max gap" is the largest difference found against an alternative, with its cause.

| Dataset | Publisher | Primary? | Standard | Vintage we hold | Latest vintage (2026-10-12) | Rel. | Best alternative | Max gap vs alternative |
|---|---|---|---|---|---|---|---|---|
| Budget spending by function | State Treasury (E11 PDFs), MoF fact files | yes | Georgian functional classification (COFOG-like), cash | 2004–2025 files, all byte-identical to today | same (2025 audited) | 4 | State Audit Office / Parliamentary Budget Office totals (exact) | +7.0% vs MoF/IMF "total expenditure" — definition (includes financing) |
| Budget spending by ministry | MoF annual execution reports + fact workbooks | partly — 12 archive files are our own extractions | Georgian organisational classification | current | same | 4 | SAO grand totals (exact); PBO institutions 29/33 to 0.1 M | Justice +1.5% (our mapping, W1); 2005 up to 7.9 M (2006 budget document used) |
| Revenue | State Treasury Form #1 (2005–25); MoF 2004 report | yes | Georgian budget classification (GFSM 2001-based from 2008) | 2025 first print (Jan 2026) | revised Dec-2025 file (24 Feb 2026) | 4 | MoF GFS Table 2A (taxes ≤0.1 M, 2008–25) | grants 2010 −65% (165 vs 472 M), cause open |
| Municipalities | MoF municipal portal (archived 2022), MoF budget history, Adjara AR, Geostat population | yes; portal discontinued | Georgian functional classification | 2022 snapshot (final) | same | 3 | municipalities' own execution reports (0.1 k GEL, 2020–25) | IMF GFS local govt −17.3% (2018), unexplained; 2015–19 basis (W8) |
| Government debt | MoF Public Debt bulletins, monthly report, strategy | yes | public/general government debt (MoF/IMF) | Bulletin N25 | Bulletin N26 (Jun 2026); Strategy 2027–30 (22 Jul 2026) | 4 | IMF WEO GGXWDG (≤0.17%) | World Bank central-govt debt +12.5% — definition (other payables) |
| Deficit (general govt balance) | IMF WEO (compiles national data) | secondary | GFSM 2014 net lending/borrowing | WEO April 2026 | WEO Oct 2026 due 13 Oct; IMF CR 26/133 (Jun 2026) revises 2022 | 3 | MoF GFS consolidated balance | 2004: +3.59% vs +0.78% of GDP; 2025 251 M unexplained |
| GDP | Geostat national accounts; World Bank (constant USD) | yes | SNA 1993 to 2009, SNA 2008 from 2010 | Geostat 19 Jun 2026 | 18 Sep 2026 (annual values identical); revision 13 Nov 2026 | 4 | World Bank / IMF (rounding) | per person 2025 +6.2% vs World Bank — population base (W14) |
| Economic sectors | Geostat | yes | SNA 2008, NACE Rev.2 | 19 Jun 2026 | 18 Sep 2026 (0 of ~5,400 cells differ) | 4 | UN National Accounts (≤1.07 GEL) | none |
| Regional economies | Geostat | yes | SNA 2008 regional accounts | Dec 2025 release | same; next 23 Dec 2026 | 4 | Geostat PxWeb (match) | −13% Geostat press release — basic vs market prices (definition) |
| Inflation | Geostat CPI; NBG target | yes | COICOP, base 2010 = 100 | Aug 2026 | Sep 2026 (2 Oct) | 4 | World Bank, IMF, PxWeb (agree) | contributions −0.07 pp vs Geostat (method) |
| Trade | Geostat (goods, services) | yes | general trade system, HS / SITC / BEC; services EBOPS | 7 Oct 2026; services 31 Oct 2025 | goods same; services update due late Oct 2026 | 4 | UN Comtrade (<0.01%, 2009–24) | 1995–97 imports +5–20% vs IMF/WB/UN (unexplained); services 2024 −0.8% vs NBG |
| Current account | NBG balance of payments | yes | BPM6 | 30 Sep 2026 | same; next 30 Dec 2026 | 4 | IMF BOP / WDI (to the cent 2000–20) | 2025 −11.4% vs WDI — WDI holds an older NBG vintage |
| Foreign investment | Geostat FDI | yes | BPM6 / OECD BMD4, directional | 17 Aug 2026 | same | 4 | Geostat PxWeb (0.05 USD) | NBG/IMF DI liabilities +9.3% (2023) — debt instruments, unexplained |
| Money from abroad | NBG money-transfer statistics; NBG BoP | yes | transfers via named systems; BPM6 personal transfers | current | next 15 Oct 2026 | 4 | World Bank / IMF (re-serve NBG) | Bank of Russia mirror −16% to −38% (2015–21), unexplained |
| Unemployment | Geostat Labour Force Survey | yes | ICLS 19th (2020+; back-cast 2010–19) | May 2026 | same | 4 | ILOSTAT / World Bank | 13.9% vs 8.2% (2025) — ILO counts subsistence farmers as employed |
| Wages | Geostat business survey; Revenue Service (median) | yes | NACE Rev.2 | Oct 2025 releases | same (2025 final) | 4 | Geostat PxWeb (1,811/1,812) | quarterly mean 3–6% above annual average — Geostat, unexplained |
| Demography | Geostat | yes | usual residents; 2024 census re-base | Oct 2026 | same; Geostat says 2015–24 "subject to revision" | 4 | Geostat PC-Axis (0 mismatches) | UN/WB are copies or models |
| Living standards | Geostat HIES; World Bank international lines | yes | HIES; WB 2021 PPP lines | 25 May 2026 | same | 4 | Geostat PxWeb (3,668/3,668); World Bank PIP (≤0.011 pp) | headline income −5.0%, spending −25.7% vs Geostat headline lines (different line) |
| Money & banks | NBG | yes | IMF MFSM; FSI guide | 30 Sep 2026 | same; next 21–30 Oct 2026 | 4 | IMF IFS (M3 exact); IMF FSI | ROA/ROE up to 4.3 pp below IMF FSI (2001–21) |
| Energy & food | Geostat energy and food balances | yes | IRES / Eurostat energy balance; FAO food balance | 2013–2024 energy, 2014–2025 food | same (2013–18 revised in 2021–22, unstated) | 4 | Eurostat / IEA electricity (rounding, 12 years); Geostat food-security table (144/144) | electricity trade includes ~3.4 TWh transit vs GNERC (definition, W17); 2017 imports −2.1% vs Eurostat (unexplained) |

---

## 3. Scorecard

Scores 1–5 from the four agents. **Weakest link** names where a visitor is most likely to be misled.

| Dataset | Source (A) | Alternatives (B) | Extraction (C) | Display (D) | Weakest link |
|---|---|---|---|---|---|
| Budget spending by function | 4 | 4 | 4 | 4 | Label/definition of "total expenditure" (W12); unmarked 2010 GDP break in % of GDP |
| Budget spending by ministry | 4 | 4 | 4 | 4 | Justice mapping (W1); archive presents our extractions as originals |
| Revenue | 4 | 3 | 4 | 4 | Grants 2008–14 divergence (W9); "Total revenue" label (W11) |
| Municipalities | 3 | 4 | 4 | 4 | Source basis 2015–19 (W8); rounded population (W2) |
| Government debt | 4 | 4 | 4 | 4 | Display rounding to whole billions; newer bulletin not loaded |
| Deficit | 3 | 3 | 5 | 4 | Source vintage (W5) and IMF-vs-MoF definition; no methodology page |
| GDP | 4 | 4 | 4 | 4 | Per-person base (W14); SNA 2010 step drawn as a continuous line |
| Economic sectors | 4 | 5 | 5 | 5 | Dead Geostat links only |
| Regional economies | 4 | 4 | 5 | 4 | Missing caveats (occupied territories, tax allocation); tiny values shown as "<0.01" |
| Inflation | 4 | 4 | 5 | 4 | Stale month (W4); shared rounding (W3) |
| Trade | 4 | 4 | 5 | 4 | Services label (W13) and services vintage (W7); 2019 domestic-exports break |
| Current account | 4 | 4 | 5 | 4 | Services inconsistency with trade (W7); revisions/2010 break not marked |
| Foreign investment | 4 | 4 | 5 | 4 | Large revisions of latest years not flagged; Excel marks unpublished cells "Actual" |
| Money from abroad | 4 | 4 | 5 | 4 | Coverage limited to named transfer systems (Russia drop may be channel switch) |
| Unemployment | 4 | 4 | 5 | 5 | No explanation of the gap to ILO/World Bank; pre-census weights |
| Wages | 4 | 4 | 5 | 4 | Median view label (W15) |
| Demography | 4 | 4 | 5 | 5 | Announced 2015–24 revision not mentioned |
| Living standards | 4 | 4 | 4 | 4 | Imereti sentence (W16); headline lines differ from Geostat's |
| Money & banks | 4 | 4 | 4 | 4 | Unmarked breaks (2015 rates and aggregates; 2022/2023 bank health) |
| Energy & food | 4 | 4 | 5 | 4 | Transit in electricity trade (W17); wheat-only hub card (W10) |

---

## 4. Per-dataset chain (source → alternative → extraction → display)

- **Budget by function.** Treasury/MoF are primary and current (2025 = audited 27.72 bn). Alternatives agree on totals (SAO, PBO) but the
  common "total expenditure" excludes financing → our label overstates by 7% (W12). Extraction exact (7 years, ≤2 GEL). Display exact;
  % of GDP crosses the 2010 SNA switch unmarked (2.1 of the 6.1 pp drop 2009→10 is the switch), "Updated" date is the newest date across
  all sources (`lib/pages/expenditure.tsx:42`). **Weakest: label.**
- **Budget by ministry.** MoF files current; 21 of 79 archive rows are our derived files (W-provenance). Extraction exact (5 years, ≤600 GEL
  per year). Display exact. Justice mapping wrong (W1); roads program shown under the wrong parent in 2006–08 (EXPM-D2); 2018 emergency
  service outside internal affairs (EXPM-C2); 2005 taken from a 2006 budget document (EXPM-C1). **Weakest: mapping.**
- **Revenue.** Treasury Form #1 primary; 2025 superseded (W6). Taxes match MoF statistics; grants 2008–14 do not (W9). Extraction exact
  (241 facts ≤1 GEL). Display exact; "Total revenue" label (W11); 2007/08 social-tax reclassification unmarked (income tax +146%,
  REV-C1/A4). **Weakest: alternatives (grants).**
- **Municipalities.** Portal archive is the last vintage; 2015–19 function basis larger than totals (W8). Municipal reports match 2020–25.
  Extraction exact (7,040 values) except rounded population (W2). Display exact; no break notes; movers board ranks source switches as
  growth (−93.1%, +391.1%). **Weakest: source basis.**
- **Debt.** MoF current except newer Bulletin N26/Strategy (forecast +10% for 2029; 2025 component rates now published; 2022 rate 3.97
  not 3.9). IMF within 0.17%. Extraction exact (93 amounts, 22 rates). Display: table rounds to whole billions, rows don't foot (DEBT-D1).
- **Deficit.** IMF WEO is a secondary compilation; vintage superseded for 2022 (W5) and replaced tomorrow. Large gaps vs MoF's national
  measure in 6 of 24 years. Extraction exact (37 years). Display correct; Excel shows small deficits as "(0.0)" (DEF-D1); no methodology
  page (`/methodology/deficit` 404) and no public source archive. **Weakest: source.**
- **GDP.** Geostat current (newer file, identical values). WB/IMF agree. Extraction exact (311 values). Display exact; SNA 1993→2008
  step (+6.8% level, 2010 growth 23.1% vs 15.3% like-for-like) drawn without marker (`gdp-overview.tsx:217` omits `breaks`); 2025 not
  marked preliminary on hub/landing/workbooks. Per-person base (W14). **Weakest: base/break caveats.**
- **Economic sectors.** Clean throughout (987/987 at every stage). Dead Geostat URLs; revision date 13 Nov not 16 Nov.
- **Regional economies.** Clean (6,930/6,930). Missing caveats: occupied territories, pro-rata product taxes, 13% gap to Geostat's
  basic-price press figures; 2 decimals of a billion make small regions "<0.01".
- **Inflation.** Clean extraction (135,350/135,350) and display (~42,000 cells); one month stale (W4); shared rounding (W3); 16 Geostat
  URLs dead; NBG's "core" is ex-tobacco while ours includes tobacco (INF-B2).
- **Trade.** Clean extraction (~87,500 rows) and display (~20,000 cells). Services label (W13) and vintage (W7); 2019 domestic-exports
  reclassification unmarked (TRADE-A3); 2025 revised vs January preliminary unstated.
- **Current account.** Clean (390/390; ~2,600 shown values). Revisions of recent years and the 2010 % of GDP break unmarked.
- **Foreign investment.** Clean (2,707/2,707; ~2,800 shown). Geostat revises recent years a lot (2025 +12.5% prelim→adjusted), page silent;
  1996 is a single-country value (Ukraine) with no caveat; Excel exports unpublished cells as "Actual"
  (`foreignInvestmentWorkbook.ts:18`).
- **Money from abroad.** Clean (9,364/9,364; ~1,870 shown). Coverage limited to named systems (Unistream 1.0 bn → 0, Contact 0.33 bn → 0
  by 2025); 2010 microfinance step (+25%) and pre-2008 18-country coverage not noted on page; label clash with living-standards
  "Money from abroad" (~304 M vs 3,649 M).
- **Unemployment.** Clean (3,370/3,370; ~9,100 shown). Survey weights still pre-census; 13.9% vs ILO 8.2% unexplained (subsistence
  farmers); 2017 survey change unmarked.
- **Wages.** Clean (1,929/1,929; ~8,000 shown). Median view label (W15); quarterly-vs-annual gap unexplained.
- **Demography.** Clean (9,740/9,740 extracted; ~7,000 shown values and 2,100 workbook rows, 0 mismatches; census re-base marked
  everywhere). Geostat's Sep 2026 report says 2015–24 indicators are subject to revision — not mentioned.
- **Living standards.** Clean (11,129/11,129). Imereti sentence (W16); HIES weights pre-census; our headline income/spending lines are not
  Geostat's headline lines; Gini differs from World Bank's by definition, unexplained.
- **Money & banks.** Clean (730/730 extracted; ~5,100 shown values and Excel rows). M3 equals IMF and World Bank exactly. Pre-2015
  rate break (MONEY-B1/C1) and Nov-2015 money-aggregate redefinition unmarked; bank-health breaks 2022/2023 recorded in the CSV
  but not drawn (`money-banks-explorer.tsx:127-128`); 2022 ROE break wrongly called unexplained (NBG switched to after-tax income).
- **Energy & food.** Clean (681/681 extracted; ~2,700 shown values). Electricity matches Eurostat/IEA to rounding; electricity
  imports/exports include transit but are described as purchases/sales (W17); wheat-only hub card (W10); 2013–18 energy balances
  were revised by Geostat in 2021–22, unstated; consumption may include ~1.5 TWh supplied to Abkhazia (unverified, ENERGY-B2).

---

## 5. Findings merged by shared cause

| Cause | Where it shows | Ids |
|---|---|---|
| **C1 Geostat re-issued files under new `/media/<id>` URLs** (Sep 2026). Old links return 404 in the source registries, public manifests, `sources.json`, `gdp-overview.json`, `economic-sectors.json`, the `/mcp` snapshot and every "% of GDP" workbook (all fed by
`retrieved_file_url` in `docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv`, read at `lib/methodology/workbookSources.ts:196`). Values are unchanged. | budget % of GDP, debt, GDP, sectors, regions, current account, inflation (16 URLs) | EXPM-D1, REV-D1, EXPF-D5, DEBT-D4, GDP-A1, SECT-A1, REG-A4, CA-D1, INF-A2, DEMO-B3 |
| **C2 Shared number formatter rounds with `toFixed`** (`lib/explorer/format.ts:91`, `lib/explorer/inflationGrid.ts:26`) — binary floats make x.x5 round down. | any page using formatPercent / formatPoints / formatSignedFixed | DEBT-D3, INF-D1 (W3) |
| **C3 Series breaks not marked on charts.** The chart component supports `breaks`/`breakYears`, but most pages don't pass them. | SNA 2010 (budget % of GDP, GDP, current account); revenue 2007/08; municipal 2016 & 2020; trade 2019; money 2015 (rates, aggregates), 2017 capital rules, 2022 ROE; FDI 2009; remittances 2010; unemployment 2017; wages 1995–97/2006; inflation 5→6 cities 2016 | EXPF-D1, GDP-D2, CA-D2, REV-C1, MUNI-D1, TRADE-A3, MONEY-A1/B, FDI-A2, REM-D1, UNEMP-D1, WAGE-D5, INF-A3 |
| **C4 Pre-2024-census population base** in Geostat's GDP per person, Labour Force Survey and HIES weights, while our demography pages use the census. Geostat revisions expected. | GDP, unemployment, living standards | W14, UNEMP-A2, LIV-A1 |
| **C5 "Updated" dates are not the dataset's release date** (newest date across all sources, or our review date). | budget, revenue, regional, current account | EXPF-D2, REV-D, REG-A5, CA-B |
| **C6 Public "original sources" archive is not all original.** 12 expenditure workbooks are our Openpyxl extractions (2026-06-23/24) labelled MoF; their metadata cells contain local Windows paths (e.g. `C:\Users\Mylaptop\Desktop\Projects\…`, `C:\tmp\geodata-mof-word-csv\…`); most expenditure/revenue registry rows have no publisher URL; deficit has no registry or methodology page. | expenditure, revenue, deficit | EXPF-A3, EXPM-A1, REV-A2, DEF-A, DEF-D3 |
| **C7 Validation evidence proves less than it claims.** Verifiers compare the value at the cell address the CSV names, but not that the cell's row/column header matches the CSV's year and group; research-package verifiers are not run in CI; expenditure/revenue reconciliation reports are git-ignored and some identities are circular. No error exists today; the risk is a future re-extraction. | unemployment, wages, energy, trade, FDI, transfers, revenue, expenditure | UNEMP-C1, WAGE-C1, ENERGY-C, TRADE-C3, FDI-C2, REM-C2, REV-C4, EXPF-C3 |
| **C8 Latest years are revisable but not marked.** | GDP 2025, FDI, current account, trade 2025, revenue 2025 (pre-audit), sectors chart | GDP-D2, FDI-A1, CA-A3, TRADE-A2, REV-A6, SECT-D3 |
| **C9 Definitions differ from the international figures readers will compare with, without a bridge sentence.** | unemployment vs ILO; debt vs IMF/WB general government; deficit IMF vs MoF; household headline lines; Gini; remittances (several "official" totals) | UNEMP-B1, DEBT-B1, DEF-B, LIV-B1/B2, REM-B2 |
| **C10 Reader that keeps Geostat's displayed rounding** (`readMatrix` `raw: false`, `lib/data/municipalIndicators/prepareGeostatPackage.ts:431`). | municipal population (W2) | MUNI-C1, DEMO-C1, REG-B3 |

---

## 6. Not checked

- Georgian wording quality beyond the labels named above; the database mirror contents (`GEODATA_DATA_SOURCE=db` build);
  the 2026–2030 debt forecast against an independent source; IMF Article IV PDFs that blocked automated access (two were
  obtained and used); UN Comtrade partner-side data for Russia and China (quota).
- Pages outside the 20 datasets (landing narrative, `/connect`, `/about`) except where they show dataset numbers.
- The unmerged branch `codex/national-budget-gdp-share`.
- The unemployment Task C report file on disk holds only the agent's early checkpoint (a tool rule blocked its final write);
  its full result (3,370/3,370 rows exact, 1 medium, 3 low) is recorded in `ORCHESTRATOR.md`.
