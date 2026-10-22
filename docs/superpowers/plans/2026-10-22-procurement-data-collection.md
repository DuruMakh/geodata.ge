# Procurement Data Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect, clean and check Georgia's open tenders (2016 to end of August 2026), direct purchases (2016 to mid-August 2025) and the owners and directors of winning companies, into the project's private folder, with a plain-words data report.

**Architecture:** Four small steps under `apps/web/lib/data/procurement/` (download, clean, registry, report), each a pure-ish module with its own tests, run by one command `scripts/collect-procurement.ts <step>`. All data is written outside the repository to `/mnt/project-files/procurement-data/` (override with `PROCUREMENT_DATA_DIR`). Nothing joins `npm run check` or `data:validate` except the unit tests.

**Tech Stack:** TypeScript (strict), Node 22, `tsx`, `exceljs` 4.4.0 streaming reader, `node:zlib` gzip, `node:crypto` (SHA-256, HMAC), `csvEscape`/`serializeBomCsvRows` from `lib/data/csvEscape.ts`, Vitest. No new dependencies; zip files are opened with the system `unzip` via `node:child_process.execFile`.

**Spec:** `docs/superpowers/specs/2026-10-22-procurement-data-collection-design.md`

## Global Constraints

- No collected data is committed to the repository. Tests use made-up rows only.
- Data folder: `/mnt/project-files/procurement-data/` with `originals/`, `clean/`, `registry/`, `MANIFEST.csv`, `data-report.md`.
- Tender files: `https://tendermonitor.ge/uploads/archives/main_{YEAR}.zip`, years 2016–2026.
- Direct-purchase files: `https://tendermonitor.ge/uploads/archives/simpified_{YEAR}.zip`, years 2016–2025.
- Registry service: `https://api.companyinfo.ge/api/`; at most one request every 2 seconds, one at a time; user-agent `fiscal.ge-procurement-collection/1.0 (+https://fiscal.ge)`.
- An 11-digit all-digit ID code is a personal number. It never appears in `clean/` or `registry/`. In cleaned tables it becomes `p_` + the first 16 hex characters of HMAC-SHA-256(secret, code); the secret is 32 random bytes, hex, in `<data>/secret.key`, created once.
- Only 9-digit company ID codes are looked up on the registry service.
- Cleaned tables: gzip-compressed UTF-8 CSV with BOM, `\n` line endings, one file per table per year: `clean/tenders_{YEAR}.csv.gz`, `clean/purchases_{YEAR}.csv.gz`; plus `clean/suppliers.csv.gz`, `clean/buyers.csv.gz`.
- Values stay in their original currency; no GEL conversion.
- Six long free-text tender fields stay in the originals only: `წინადადება წარმოდგენილი უნდა იყოს`, `დამატებითი ინფორმაცია`, `ესყიდვის რაოდენობა ან მოცულობა`, `მოწოდების ვადა`, `გარანტიის ოდენობა`, `გარანტიის მოქმედების ვადა`.

## Review Focus

1. A yearly file whose header differs from the expected list (renamed, added, reordered column) → the clean step stops with the file name and the differing headers, never writes a half-mapped table. Test in Task 3.
2. Rows shorter than the header (exceljs/openpyxl drop trailing empty cells; seen in `simpified_2025.xlsx`) → missing trailing cells read as empty, row kept. Test in Task 3.
3. A personal number hidden in a free field of a registry answer (any key, any depth) → removed before the answer is saved. Test in Task 5.
4. A registry run that is interrupted, or meets repeated server errors (both TI Georgia services returned HTTP 500 for hours on 2026-10-22) → re-run resumes without re-asking saved companies; after 10 consecutive failures the run stops and reports instead of hammering. Test in Task 5.
5. A tender row with a supplier but no final value, or a non-GEL currency → kept, counted per currency, never summed into another currency. Test in Task 4.

---

### Task 1: Data folder, manifest and download

**Files:**
- Create: `apps/web/lib/data/procurement/paths.ts`
- Create: `apps/web/lib/data/procurement/download.ts`
- Test: `apps/web/tests/data/procurement/download.test.ts`

**Interfaces:**
- Produces:
  - `procurementDataDir(): string` — `process.env.PROCUREMENT_DATA_DIR ?? "/mnt/project-files/procurement-data"`.
  - `TENDER_YEARS = [2016..2026]`, `PURCHASE_YEARS = [2016..2025]` (readonly number arrays).
  - `type SourceFile = { kind: "tenders" | "purchases"; year: number; url: string; zipPath: string; xlsxPath: string }` — zipPath `originals/{main|simpified}_{YEAR}.zip`, xlsxPath `originals/{main|simpified}_{YEAR}.xlsx` (relative to the data dir).
  - `sourceFiles(): SourceFile[]`
  - `downloadSources(dataDir: string, fetchImpl: typeof fetch, unzip: (zip: string, outDir: string) => Promise<void>): Promise<ManifestRow[]>` — skips a file whose zip already exists; after unzip, the single `.xlsx` inside is renamed to `xlsxPath`; writes `MANIFEST.csv` (columns `path,bytes,sha256,source_url,retrieved_at`) for every zip and xlsx.
  - `type ManifestRow = { path: string; bytes: number; sha256: string; source_url: string; retrieved_at: string }`

- [ ] **Step 1: Write failing tests** — `sourceFiles()` returns 21 entries, first `main_2016`, last `simpified_2025`, no `simpified_2026`; `downloadSources` with a fake fetch returning fixed bytes and a fake unzip writing one xlsx: writes both files, MANIFEST row `sha256` equals `createHash("sha256")` of those bytes; a second call does not call fetch again; a fetch answering 404 throws with the URL in the message.
- [ ] **Step 2: Run** `npx vitest run tests/data/procurement/download.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `paths.ts` and `download.ts`. The real unzip passed by the CLI is `execFile("unzip", ["-o", "-q", zip, "-d", outDir])` into a fresh temp folder.
- [ ] **Step 4: Run** the test — expect PASS. Run `npm run typecheck` — expect no errors.
- [ ] **Step 5: Commit** `feat(procurement): download step with manifest`.

### Task 2: Personal-number privacy

**Files:**
- Create: `apps/web/lib/data/procurement/privacy.ts`
- Test: `apps/web/tests/data/procurement/privacy.test.ts`

**Interfaces:**
- Produces:
  - `isPersonalNumber(code: string): boolean` — `/^\d{11}$/` after trim.
  - `loadOrCreateSecret(dataDir: string): Promise<string>` — reads `secret.key`, creating 32 random bytes (hex) with mode `0o600` if absent.
  - `partyKey(code: string, secret: string): string` — personal number → `p_` + 16 hex of HMAC-SHA-256; any other code returned trimmed and unchanged.
  - `stripPersonalNumbers<T>(value: T): T` — deep copy with every string of exactly 11 digits (after trim), and every number with 11 digits, replaced by `null`; object keys kept.

- [ ] **Step 1: Write failing tests** — `isPersonalNumber("01019067930")` true, `("202283242")` false, `("0101906793a")` false; `partyKey` is stable for the same input/secret, differs between secrets, starts with `p_`, length 18, and never contains the input; `partyKey("202283242", s) === "202283242"`; `stripPersonalNumbers({a:{b:["01019067930", "x"]}, n: 12345678901, c: "202283242"})` equals `{a:{b:[null,"x"]}, n:null, c:"202283242"}`; `loadOrCreateSecret` twice in a temp dir returns the same 64-hex string.
- [ ] **Step 2: Run** `npx vitest run tests/data/procurement/privacy.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `privacy.ts`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(procurement): personal-number pseudonymisation`.

### Task 3: Read and clean the yearly files

**Files:**
- Create: `apps/web/lib/data/procurement/columns.ts`
- Create: `apps/web/lib/data/procurement/clean.ts`
- Test: `apps/web/tests/data/procurement/clean.test.ts`

**Interfaces:**
- Consumes: `SourceFile`, `sourceFiles()` (Task 1); `isPersonalNumber`, `partyKey` (Task 2).
- Produces:
  - `TENDER_COLUMNS` and `PURCHASE_COLUMNS`: readonly arrays of `{ source: string; field: string | null }`, in file order; `field: null` means "originals only". Headers are compared after `trim()` (the source has `"გარანტიის ოდენობა\t"`).
  - `readSheetRows(xlsxPath: string, expected: readonly {source: string}[]): AsyncGenerator<(string | null)[]>` — exceljs `stream.xlsx.WorkbookReader`, first worksheet; throws `Error` naming the file and listing expected-vs-found headers when the trimmed header row differs; pads short rows with `null`; cell values become strings (dates as `YYYY-MM-DD` or ISO date-time as in the source, numbers via `String`).
  - `cleanFile(file: SourceFile, dataDir: string, secret: string): Promise<CleanStats>` — writes `clean/{tenders|purchases}_{YEAR}.csv.gz` with a header row of the non-null `field` names; supplier and buyer ID codes go through `partyKey`; bidder name lists are kept as published.
  - `type CleanStats = { file: string; rows: number; duplicateIds: number; wonWithoutSupplier: number; currencies: Record<string, number> }`

The exact source headers, in order (copy verbatim; `field` names are snake_case English):

Tenders (32): `ID`→`tm_id`, `შიდა კოდი`→`internal_flag`, `რეგისტრაციის კოდი`→`tender_number`, `შემსყიდველი`→`buyer_name`, `შემსყიდველის კოდი`→`buyer_code`, `შემსყიდველის რეგისტრაციის თარიღი`→`buyer_registered`, `მთავარი Cpv`→`cpv_main`, `Cpvs`→`cpv_all`, `ტიპი`→`tender_type`, `სტატუსი`→`status`, `გამოცხადების დრო`→`announced`, `ბიდინგის დაწყების დრო`→`bidding_start`, `ბიდინგის დამთავრების დრო`→`bidding_end`, `ბიდერების რაოდენობა`→`bidder_count`, `სავარაუდო ღირებულება`→`estimated_value`, `ყველაზე მცირე ბიდი`→`lowest_bid`, `წინადადება წარმოდგენილი უნდა იყოს`→null, `დამატებითი ინფორმაცია`→null, `ესყიდვის რაოდენობა ან მოცულობა`→null, `მოწოდების ვადა`→null, `შეთავაზების ფასის კლების ბიჯი`→`bid_step`, `გარანტიის ოდენობა`→null, `გარანტიის მოქმედების ვადა`→null, `ბიდერები`→`bidders`, `საწყისი ღირებულება`→`contract_value_start`, `საბოლოო ღირებულება`→`contract_value_final`, `ვერსიების რაოდენობა`→`contract_versions`, `ვალუტა`→`currency`, `მიმწოდებლის სახელი`→`supplier_name`, `მიმწოდებლის Id`→`supplier_code`, `მიმწოდებლის რეგისტრაციის თარიღი`→`supplier_registered`, `მიმწოდებლის ქვეყანა`→`supplier_country`.

Direct purchases (25): `id`→`tm_id`, `რეგისტრაციის ნომერი`→`registration_number`, `სტატუსი`→`status`, `კონტრაქტის ღირებულება`→`contract_value`, `ვალუტა`→`currency`, `კონტრაქტის დრო`→`contract_date`, `შემსყიდველი`→`buyer_name`, `შემსყიდველის კოდი`→`buyer_code`, `შემსყიდველის რეგისტრაციის თარიღი`→`buyer_registered`, `რეალური ღირებულება`→`actual_value`, `დაფინანსება`→`funding`, `შესყიდვის საფუძვლები`→`legal_basis`, `მთავარი დოკუმენტი`→`main_document`, `მთავარი დოკუმენტის დრო`→`main_document_date`, `მთავარი დოკუმენტის დაწყების დრო`→`main_document_start`, `მთავარი დოკუმენტის დამთავრების დრო`→`main_document_end`, `კონტრაქტის ტიპი`→`contract_type`, `ხელშეკრულების შესრულება`→`performance`, `SPM`→`spm`, `დაფინანსების წყარო`→`funding_source`, `მიმწოდებელი`→`supplier_name`, `მიმწოდებელის კოდი`→`supplier_code`, `მიმწოდებლის რეგისტრაციის თარიღი`→`supplier_registered`, `მთავარი CPV`→`cpv_main`, `დამატებითი CPV`→`cpv_extra`.

Duplicate key: `tender_number` for tenders, `registration_number` for purchases. "Won without supplier": tender with status `ხელშეკრულება დადებულია` and an empty supplier code.

- [ ] **Step 1: Write failing tests** with tiny xlsx files built in the test by `exceljs` in a temp dir (made-up Georgian names, codes `111111111`, `22222222222`): header with the tab-suffixed guarantee column is accepted; a header with one renamed column throws and the message contains both names; a row missing its last 3 cells is kept with empty trailing fields; the output gz decompresses to BOM + a header of exactly 26 tender fields (32 source columns minus 6 originals-only); `22222222222` never appears in the output and a `p_` key does; `111111111` appears unchanged; stats count a duplicate `tender_number`, a won-without-supplier row, and `{ GEL: 2, USD: 1 }`.
- [ ] **Step 2: Run** `npx vitest run tests/data/procurement/clean.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `columns.ts` and `clean.ts`; write the gzip through `zlib.createGzip()` piped to a file stream, rows serialised with `csvEscape`.
- [ ] **Step 4: Run** — expect PASS; `npm run typecheck` clean.
- [ ] **Step 5: Commit** `feat(procurement): clean tenders and direct purchases`.

### Task 4: Suppliers and buyers

**Files:**
- Create: `apps/web/lib/data/procurement/parties.ts`
- Test: `apps/web/tests/data/procurement/parties.test.ts`

**Interfaces:**
- Consumes: the cleaned gz files of Task 3 (read back with `zlib.createGunzip()` + `csv-parse` stream, `bom: true, columns: true`).
- Produces:
  - `buildParties(dataDir: string): Promise<{ suppliers: number; buyers: number }>` — writes `clean/suppliers.csv.gz` and `clean/buyers.csv.gz`.
  - Supplier columns: `supplier_code, names` (distinct names joined by ` | `), `first_year, last_year, tenders_won, purchases_won, year, currency, amount` — one row per supplier × year × currency (long format), so currencies are never added together. Tender amount = `contract_value_final`, falling back to `contract_value_start`, else counted with amount empty; purchase amount = `contract_value`.
  - Buyer columns: same shape with `buyer_code` and counts `tenders_announced, tenders_contracted, purchases`.
  - `companyLookupQueue(dataDir: string): Promise<string[]>` — 9-digit supplier codes ordered by total GEL amount won, descending, ties by code; codes with no GEL amount at the end.

- [ ] **Step 1: Write failing tests** from two made-up cleaned years: one supplier winning a GEL tender in 2016 and a USD purchase in 2017 yields two rows with separate currencies and `first_year 2016, last_year 2017`; a tender with only a start value uses it; a won tender with no value is counted with an empty amount; `companyLookupQueue` excludes `p_` keys and orders by GEL total.
- [ ] **Step 2: Run** `npx vitest run tests/data/procurement/parties.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `parties.ts` (in-memory maps are fine: tens of thousands of parties).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(procurement): supplier and buyer lists`.

### Task 5: Owners and directors from companyinfo.ge

**Files:**
- Create: `apps/web/lib/data/procurement/registry.ts`
- Test: `apps/web/tests/data/procurement/registry.test.ts`

**Interfaces:**
- Consumes: `companyLookupQueue` (Task 4), `stripPersonalNumbers` (Task 2).
- Produces:
  - `type RegistryClient = { getJson(path: string): Promise<unknown> }` and `politeClient(fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>, now: () => number): RegistryClient` — base `https://api.companyinfo.ge/api/`, the user-agent above, ≥2,000 ms between request starts, up to 3 attempts per request with 10 s, 30 s waits on HTTP 5xx/429/network error; HTTP 404 → resolves `null`.
  - `collectRegistry(dataDir: string, codes: string[], client: RegistryClient, log: (line: string) => void): Promise<RegistryStats>` — per code: skip if `registry/raw/{code}.json` exists; `getcorporation/{code}` → internal id (a number; `null`/non-number → status `not_found`); `corporations/{id}` → record; save `{ code, retrieved_at, internal_id, record: stripPersonalNumbers(record) }` to `registry/raw/{code}.json`; append `code,status,retrieved_at` to `registry/status.csv`. Stops with status `stopped` after 10 consecutive failed codes.
  - `type RegistryStats = { looked_up: number; found: number; not_found: number; failed: number; skipped: number; stopped: boolean }`
  - `flattenRegistry(dataDir: string): Promise<void>` — writes `registry/companies.csv.gz` and `registry/links.csv.gz`. Its field mapping is written in Step 6 from a live sample, because the service was down when the spec was written and its record layout has not been seen.

- [ ] **Step 1: Write failing tests** with a fake client: a saved code is skipped (no client call); a found company writes a raw file without the 11-digit value planted at depth 3 of the fake record; a `null` id yields `not_found`; 10 consecutive throwing codes stop the run with `stopped: true` and the 11th code untouched; `politeClient` with a fake clock calls fetch no sooner than 2,000 ms apart and retries a 500 twice before throwing.
- [ ] **Step 2: Run** `npx vitest run tests/data/procurement/registry.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `politeClient` and `collectRegistry`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(procurement): polite registry collection`.
- [ ] **Step 6: Map the record** — once `curl -s -o /dev/null -w "%{http_code}" https://api.companyinfo.ge/api/metadata` answers 200, fetch one large company (the first queue code) through `collectRegistry` with a one-code list, read only its key structure, and define: companies columns `company_code, internal_id, name, legal_form, registered, status, address, retrieved_at`; links columns `company_code, role, person_id, person_name, linked_company_code, share, start_date, end_date, nationality, retrieved_at` (exactly one of `person_id` / `linked_company_code` filled). Add a test that flattens a made-up record with that layout, including one person and one company partner, and asserts both link rows. Implement `flattenRegistry`, run the test, commit `feat(procurement): flatten registry records`.

### Task 6: Control totals and data report

**Files:**
- Create: `apps/web/lib/data/procurement/report.ts`
- Test: `apps/web/tests/data/procurement/report.test.ts`

**Interfaces:**
- Consumes: `CleanStats[]` (Task 3), `RegistryStats` and `registry/status.csv` (Task 5), cleaned gz files.
- Produces:
  - `<data>/control-totals.csv`, entered by hand from the State Procurement Agency annual reports (`procurement.gov.ge/ka/page/AnalyticalStudiesReports`, 2016–2025): `year, tenders_announced, simplified_total_gel, report_file, page`. Blank where a report does not give the figure.
  - `buildReport(dataDir: string): Promise<string>` — writes `data-report.md`: per year tender rows vs `tenders_announced` (difference shown), direct-purchase GEL total vs `simplified_total_gel`, duplicates, won-without-supplier, currency counts, a line confirming a scan found no 11-digit number in `clean/` and `registry/` (fails the report with the file name if one is found), registry coverage, and the direct-purchase gap from mid-August 2025, with the last contract date found.

- [ ] **Step 1: Write failing tests** — a made-up year with 3 tender rows against `tenders_announced` 4 reports a difference of −1; a planted 11-digit number in a temp `clean/` file makes `buildReport` throw naming that file; the gap line shows the latest `contract_date` of the purchases.
- [ ] **Step 2: Run** `npx vitest run tests/data/procurement/report.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `report.ts`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(procurement): data report with control totals`.

### Task 7: Command, methodology note, and the real run

**Files:**
- Create: `apps/web/scripts/collect-procurement.ts`
- Create: `docs/data-methodology/procurement-collection.md`
- Test: `apps/web/tests/scripts/collect-procurement.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `main(args)` via `runAsCli`; steps `download | clean | parties | registry | report`; unknown or missing step throws `Usage: collect-procurement.ts download|clean|parties|registry|report`. `registry` accepts `--limit N` for a trial run. Each step prints one JSON line `{ status, step, ... }` like `prepare-*.ts`.

- [ ] **Step 1: Write failing test** — `main([])` and `main(["oops"])` reject with the usage message.
- [ ] **Step 2: Run** `npx vitest run tests/scripts/collect-procurement.test.ts` — expect FAIL; implement; expect PASS; commit `feat(procurement): collection command`.
- [ ] **Step 3: Methodology note** — sources and dates, the coverage table and gap from the spec, privacy rules, politeness rules, checks, and how to re-run each step. Commit `docs: procurement collection methodology`.
- [ ] **Step 4: Real run, tenders and purchases** — from `apps/web`: `npx tsx scripts/collect-procurement.ts download`, then `clean`, then `parties`. Expected: 21 zips and 21 xlsx in MANIFEST; every file passes the header check (a failure is reported, not patched around); `tenders_2016` has 39,087 rows; `tenders_2025` has 27,796 rows.
- [ ] **Step 5: Control totals** — fill `control-totals.csv` from the ten annual reports, then `npx tsx scripts/collect-procurement.ts report`. Expected: the report renders; every year's difference is listed.
- [ ] **Step 6: Registry trial** — when the service answers, `registry --limit 20`; check 20 raw files exist and none contains an 11-digit number (`grep -rlE '\b[0-9]{11}\b' <data>/registry` prints nothing). Then complete Task 5 Step 6.
- [ ] **Step 7: Full registry run** — start `registry` in the background (one to two days), resume after any stop, then `report` again.
- [ ] **Step 8: Narrow checks** — `npx vitest run tests/data/procurement tests/scripts/collect-procurement.test.ts`, `npm run typecheck`, `npm run lint`. The full `npm run check` and a pull request wait for Duru's OK (project rule).
