# Public procurement data collection, 2016–2026

Status: research collection only. Nothing here is published on the site, and the collected data is not in this
repository. Design: `docs/superpowers/specs/2026-10-22-procurement-data-collection-design.md`.

## What is collected

- Every open tender announced from 1 January 2016, one row per tender.
- Every direct ("simplified") purchase contract from 1 January 2016, one row per contract.
- One list of suppliers and one of buyers built from those two, by year and currency.
- For each winning company with a 9-digit company ID code: its registry record and the people and companies linked
  to it (directors, partners and so on), as companyinfo.ge shows them.

## Sources

| Data | Source | Coverage |
| --- | --- | --- |
| Open tenders | Tender Monitor (Transparency International Georgia), `https://tendermonitor.ge/uploads/archives/main_{YEAR}.zip` | 2016 to the end of August 2026 |
| Direct purchases | Tender Monitor, `https://tendermonitor.ge/uploads/archives/simpified_{YEAR}.zip` (the site's spelling) | 2016 to mid-August 2025; no 2026 file |
| Control figures | State Procurement Agency annual activity reports, `https://procurement.gov.ge/ka/page/AnalyticalStudiesReports` | 2016–2025 |
| Owners and directors | companyinfo.ge public data service, `https://api.companyinfo.ge/api/` (Transparency International Georgia, copied monthly from `enreg.reestri.gov.ge`) | as of the collection date of each company |

Tender Monitor is an NGO's copy of the official electronic system, not the agency's own release. The official system
`tenders.procurement.gov.ge` is not crawled: its `robots.txt` asks automated tools not to. Its open-data service
stopped in 2019. Direct purchases after mid-August 2025 are a known gap.

## Where the data lives

`/mnt/project-files/procurement-data/` (the project's private shared folder; `PROCUREMENT_DATA_DIR` overrides it):

- `originals/`: the yearly zips and their workbooks as downloaded; `MANIFEST.csv` lists path, size, SHA-256, address
  and time for each.
- `reports/`: the agency's annual reports used for the control figures; `control-totals.csv`: those figures, entered
  by hand, with the report and page of each.
- `clean/`: `tenders_{YEAR}.csv.gz`, `purchases_{YEAR}.csv.gz`, `suppliers.csv.gz`, `buyers.csv.gz` (UTF-8 with BOM,
  gzip) and `stats.json`.
- `registry/`: `raw/{code}.json` (one answer per company) and `status.csv` (each lookup's outcome and time).
- `data-report.md`: counts, totals and checks, in plain words.

The cleaned tables keep every source column except six long free-text tender fields (submission terms, additional
information, quantity, delivery term, guarantee amount and guarantee validity), which stay in the original workbooks.
Values stay in their published currency; nothing is converted to GEL. A supplier's or buyer's rows are one per year
and currency, so amounts in different currencies are never added together. A tender's amount is its final contract
value, else its start value.

## Privacy rules

- No collected data is committed to the repository, which is public. Code, tests (made-up rows only) and this note are.
- An 11-digit personal number never appears in `clean/` or `registry/`. In the cleaned tables it is replaced by
  `p_` plus the first 16 hex characters of an HMAC-SHA-256 of the number, keyed by `secret.key` in the data folder,
  so the same person keeps the same key across years. The original workbooks keep the numbers (they are public on
  Tender Monitor) and stay in the private folder.
- Every 11-digit value in a registry answer is removed before the answer is saved. People are recorded by name and
  by companyinfo.ge's own person number.
- Individuals and sole traders are not looked up on companyinfo.ge; its `robots.txt` excludes their pages.
- The report step scans `clean/` and `registry/` and refuses to report if it finds an 11-digit number.

## Politeness

- Tender Monitor: each yearly file is downloaded once; a re-run skips files already present.
- companyinfo.ge: one request at a time, at least two seconds apart, user-agent
  `fiscal.ge-procurement-collection/1.0 (+https://fiscal.ge)`. A server error, rate limit or network error is retried
  after 10 s and then 30 s; ten failed companies in a row stop the run. Saved companies are never asked for again.
  Companies are looked up in order of total GEL won, largest first.

## Checks

The `report` step writes `data-report.md` with: tender rows per year against the agency's count of tenders
announced; direct-purchase GEL totals per year against the agency's simplified-purchase total; duplicate tender and
contract numbers; tenders marked "contract signed" with no supplier; rows per currency; the date of the last direct
purchase; and owner/director coverage (found, not found, failed). A year that differs from the agency is listed with
both numbers. The clean step stops, naming the file and both header lists, if a yearly file's columns differ from the
expected ones.

## Re-running

From `apps/web`, each step on its own:

```
npx tsx scripts/collect-procurement.ts download
npx tsx scripts/collect-procurement.ts clean
npx tsx scripts/collect-procurement.ts parties
npx tsx scripts/collect-procurement.ts registry [--limit N]
npx tsx scripts/collect-procurement.ts report
```

These steps are not part of `npm run check` or `data:validate`: the data they need is not in the repository. Their
unit tests are part of `npm test`.
