# Procurement data collection — design

Date: 2026-10-22. Owner: Duru. Thread: "Procurement portal".
Status: draft for Duru's review.

## 1. Purpose and scope

Duru wants a procurement portal built from all public tender data for the last ten years: who bought,
who won, how much, how many competed, and each winning company's owners and directors. Duru decided
(2026-10-21 23:49 Tbilisi) that this piece of work covers **collecting the data only**. How it is
analysed and presented is a separate, later decision.

In scope:

- Every open tender announced from 1 January 2016 to the latest available date.
- Every direct ("simplified") purchase contract from 1 January 2016 to the latest available date.
- One list of suppliers and one list of buyers built from those two.
- Owners (partners/shareholders) and directors of every winning company that is a legal entity,
  from companyinfo.ge (Duru chose this route on 2026-10-22 11:50 Tbilisi).
- Checks against the State Procurement Agency's own yearly reports.
- A short data report for Duru: counts and totals per year, coverage and known gaps.

Out of scope: any site page, navigation, Excel download, MCP tool, database import, analysis
for publication, and a refresh schedule. `Project_Definition.md` is not changed by this work,
because nothing becomes public. It changes when the presentation work is approved.

## 2. Sources

| Data | Source | Coverage found 2026-10-22 |
|---|---|---|
| Open tenders | Tender Monitor (Transparency International Georgia) yearly files `https://tendermonitor.ge/uploads/archives/main_{YEAR}.zip` | 2016–2026; the 2026 file runs to the end of August 2026 |
| Direct purchases | Tender Monitor `simpified_{YEAR}.zip` (the site's own spelling) | 2016–2025; the 2025 file stops in mid-August 2025, and there is no 2026 file |
| Yearly control totals | State Procurement Agency annual reports, `procurement.gov.ge/ka/page/AnalyticalStudiesReports` (PDF) | 2016–2025 |
| Owners and directors | companyinfo.ge public data service `https://api.companyinfo.ge/api/` (TI Georgia; copied monthly from the official registry `enreg.reestri.gov.ge`) | 1.29 million companies on 2026-10-21 |

Tender Monitor is a copy of the official system made by an NGO, not the agency's own release. Its
2025 tender count (27,796) matches the agency's 2025 report exactly. The official system
`tenders.procurement.gov.ge` is not crawled: its `robots.txt` asks automated tools not to. Its old
open-data service stopped in 2019.

Known gap: direct purchases from mid-August 2025 onward are missing from the yearly files. Tender
Monitor's own site may hold them. Section 7 says how this is handled.

Both TI Georgia services returned server errors on the morning of 2026-10-22 (the static yearly
files still downloaded). Collection waits until they answer again.

## 3. What is collected

### 3.1 Tenders (one row per tender)

All Tender Monitor columns are kept: tender number and registration code, buyer and buyer ID code,
main and all CPV categories, tender type, status, announcement and bidding dates, number of bidders,
estimated value, lowest bid, the list of bidders, start and final contract value, currency, and the
winning supplier's name, ID code, registration date and country. The long free-text fields
(guarantee terms, additional information) are kept in the originals only.

### 3.2 Direct purchases (one row per contract)

All columns: registration number, status, contract value and currency, contract date, buyer and
buyer ID code, actual value, funding and funding source, legal basis, main document dates, contract
type, performance, supplier name and ID code, supplier registration date, main and extra CPV.

### 3.3 Suppliers and buyers

One row per ID code with every name seen, first and last year seen, number of tenders and direct
purchases won and the total won per year and currency. Values stay in their original currency:
converting to GEL is a presentation decision.

### 3.4 Owners and directors

For each winning supplier with a 9-digit company ID code: the company's registry record as
companyinfo.ge shows it (name, legal form, registration date, status, address), and each person or
company linked to it with their role (director, partner, representative and so on), share where
given, start and end dates where given, and nationality. Linked companies are recorded by their
company ID code.

Estimated size: about 30,000–40,000 distinct companies won something since 2016 (21,900 distinct
suppliers in just three of the yearly files, about half of them companies). Lookups run one at a
time with a pause between requests, so the full pass takes roughly one to two days and can stop and
resume. Companies are looked up in order of total amount won, so the biggest winners are done first.

## 4. Privacy rules

The repository is public on GitHub, so anything committed is published.

1. **No collected data is committed to the repository.** Originals, cleaned tables and
   owner/director data live in the project's private shared folder
   `/mnt/project-files/procurement-data/`. Only the collection code, its tests (with made-up
   rows), this design and the methodology note are committed.
2. **Personal ID numbers are never kept in cleaned tables.** Suppliers whose ID code is an 11-digit
   personal number (individual people and sole traders) get a pseudonymous key instead: the first
   16 hex characters of an HMAC-SHA-256 of the number, using a secret kept in the private folder.
   The same person keeps the same key across years. The original Tender Monitor files keep the
   numbers, since they are already public there, but they stay in the private folder.
3. **Owners' and directors' personal ID numbers are dropped** if the data service returns them.
   People are recorded by name and by companyinfo.ge's own person number.
4. **Individuals and sole traders are not looked up** on companyinfo.ge. Its `robots.txt` excludes
   their pages, and their owner is themselves.
5. Every owner/director record carries the date it was collected, since the registry changes.

Whether any person's name is ever shown on the site is a presentation decision for later.

## 5. Being a polite visitor

- Tender Monitor: eleven tender files and ten direct-purchase files, downloaded once each.
- companyinfo.ge: at most one request every two seconds, one at a time, with a descriptive
  user-agent naming fiscal.ge. On an error, wait and retry a few times, then record the company as
  failed and move on. If errors continue, stop and report rather than retry harder.
- Every answer is saved as received, so a re-run never asks twice for the same company.

## 6. How it is built (reuses existing patterns)

- **Reused as is:** the `apps/web/scripts/prepare-*.ts` command pattern and `runAsCli`, the
  `exceljs` reader already in the project, the raw-file manifest format (path, size, SHA-256) used in
  `docs/Raw Data/*/MANIFEST.csv`, and Vitest for tests.
- **Genuinely new:** a `lib/data/procurement/` folder with four small steps, each with one job:
  1. `download` — fetch the yearly files, record size and SHA-256 in a manifest.
  2. `clean` — read the yearly files into the two cleaned tables, apply the privacy rules, and
     check each file's columns against the expected list (a changed column stops the run).
  3. `registry` — look up companies on companyinfo.ge as in section 5.
  4. `report` — counts, totals, checks and coverage, written as the data report for Duru.
- A new command `apps/web/scripts/collect-procurement.ts` runs a named step. It is **not** added to
  `npm run check` or `data:validate`, because those run on GitHub where the private data is absent.
  Its unit tests (made-up rows only) are part of `npm test` as usual.
- Cleaned tables are written as gzip-compressed CSV (UTF-8), one file per table per year.

## 7. Checks

Each run of `report` checks, and the data report lists:

- Tender rows per year against the agency report's "tenders announced" count. A year that differs
  is listed with both numbers; it does not silently pass.
- Direct-purchase totals per year against the report's simplified-purchase total, where the report
  gives one.
- No duplicate tender numbers or direct-purchase registration numbers.
- Every won tender has a supplier ID code; rows that don't are counted and listed.
- Currencies other than GEL are counted per year.
- No 11-digit personal number appears in any cleaned table.
- Owners/directors coverage: companies looked up, found, not found and failed.
- The direct-purchase gap from mid-August 2025: the report states it plainly. Filling it is a
  follow-up for Duru to approve once Tender Monitor's site is checked for those months.

## 8. Deliverables

1. `/mnt/project-files/procurement-data/` with `originals/`, `clean/`, `registry/` and a
   `MANIFEST.csv`.
2. `/mnt/project-files/procurement-data/data-report.md`: the data report for Duru, in plain words.
3. In the repository: the collection code and tests, this design, and
   `docs/data-methodology/procurement-collection.md` describing sources, privacy rules and checks.

## 9. Open questions for later (not blockers)

- Asking TI Georgia for permission to republish, before anything goes public.
- How to present the data, including whether people's names appear.
- Where the data lives once pages use it (likely the existing database).
