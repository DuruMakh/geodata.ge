# Public methodology and source archives

This is the maintenance runbook for the public methodology centre and its original-source downloads. The approved product and content contract remains [`docs/superpowers/specs/2026-08-11-methodology-portal-design.md`](../superpowers/specs/2026-08-11-methodology-portal-design.md).

## Publication boundary

The reviewed category manifests under `data/methodology/source-archives/` are the only publication control. A file being present under `docs/Raw Data/` does not by itself make it public. The generator requires the manifest paths to equal the approved inventory exactly and verifies every byte size and SHA-256 before publishing.

The initial approved inventory is 175 untouched originals totalling 61,420,375 bytes:

| Dataset | Included originals | Initial count | Initial bytes | Explicit exclusions |
| --- | --- | ---: | ---: | --- |
| Expenditure | Every regular file recursively under `docs/Raw Data/Expenditure/`. This root is reserved for upstream originals. | 77 | 53,661,484 | No prepared GeoData derivative belongs in this root or archive. |
| Revenue | Only the 21 top-level PDF files directly under `docs/Raw Data/Revenue/`. | 21 | 4,667,365 | Extracted `text/*.txt` files and any other prepared derivative are excluded. |
| Municipalities | The six `.xlsx` files under `mof-functional-classification/`; the 69 `.xlsx` files under `mof-municipality-budget-history-2016-2025/`; and the two top-level `.zip` files under `municipalities.mof.ge-archive-2022/`. | 77 | 3,091,526 | Excludes source manifests; unpacked archive CSVs; `combined-annual-2015-2025/`; `geostat-population-regional-gdp/`; and `municipality-map-geometry/`, including prepared CSV, text, workbook, report, and geometry outputs. |

The originals under `docs/Raw Data/` are immutable. Never normalize, re-encode, rename in place, or otherwise rewrite a published original. Add a newly captured upstream file as a new original and update the reviewed manifest; if an upstream correction supersedes a file, retain the earlier bytes unless a separate reviewed removal decision says otherwise.

Prepared GeoData CSV, text, validation, and geometry artifacts are not upstream originals and must never be described or published as such. Explorer Excel workbooks remain on their explorer surfaces; methodology manifest CSVs remain archive artifacts with their existing contract.

## Bilingual descriptions and original documents

The methodology hub and all four current topic pages have Georgian and English
versions. Both expose the same reviewed manifest entries and byte-identical
archives under the existing shared download URLs. English titles, publishers
and explanatory attribution come from `data/localization/en/`; generic original
metadata and required legal attribution remain intact. A translated description
does not mean the source document has been translated. `documentLanguage` is
`null` unless verified.

Original filenames are the deliberate original-language exception on English
pages: each is marked with language/source identity, explained beside the archive,
and checked against the exact manifest filename. Do not exempt an entire archive,
source description or SVG from translation checks. Search accepts reviewed names
in either language and original filenames. Source selection and hyperlinks in
English Excel exports are identical to their Georgian counterparts.

Review new names and full explanatory sentences in both languages, validate
message parameters with `npm run i18n:check`, and update affected dates in
`data/localization/en/page-revisions.json`. Service wording is pinned into the
build snapshot and participates in `dataVersion`; no runtime file lookup or
translation network call belongs in a fact query.

## Reviewed manifest contract

Each category manifest is a human-reviewed CSV with one row per approved original. Every row records a stable source ID, dataset and year scope, source organization, Georgian display title, official filename and URL/archive location, immutable repository path, stable lowercase-ASCII public path, media type, byte size, SHA-256, retrieval metadata, licence, attribution, redistribution status, and notes.

`retrieved_at_basis` gives the date its meaning:

- `exact`: `retrieved_at` is the recorded date on which that exact upstream byte was retrieved.
- `source_manifest`: the date comes from the source package's reviewed capture manifest.
- `repository_first_commit_proxy`: the exact retrieval date was not recorded, so the date is the first repository commit known to contain that byte. It is a repository-capture proxy, not an upstream publication date or a claim about the original download day.

Only these `redistribution_status` values are accepted:

- `repository_owner_approved`: the repository owner has explicitly approved redistribution, including official public documents that do not state an explicit licence.
- `approved_with_attribution`: redistribution is approved only with the recorded licence and attribution.
- `public_domain`: the source is reviewed as public domain.

Every status still requires non-empty `license_id` and `attribution_text`. Generated CSV/JSON manifests and the public archive table must preserve the source organization, original URL/archive location, licence, attribution, and redistribution status; a permissive status never licenses dropping attribution metadata.

Validation rejects missing or extra inventory rows, duplicate IDs or public paths, path traversal, absolute or symlinked paths, paths outside the repository or category download root, non-ASCII/unstable public paths, missing files, byte-size or SHA-256 drift, blank attribution, unknown date bases, and unapproved redistribution statuses.

## Deterministic generated outputs

Run archive commands from `apps/web`:

```powershell
npm.cmd run data:prepare-methodology-archives
npm.cmd run data:check-methodology-archives
```

The write alias passes `--write`. It removes and recreates `apps/web/public/downloads/methodology/`, copies each original without changing its bytes, writes both manifests, builds one category ZIP, and writes `data/reports/methodology-archive-validation.json`. The generator CLI accepts exactly one of `--write` or `--check`.

The check alias passes `--check`. It generates the complete output twice in fresh temporary directories, compares every output hash and byte size, and removes the temporary trees. It does not mutate the public download tree or the repository report.

For every category:

- original files are copied in lexical `public_download_path` order and retain the reviewed SHA-256;
- `manifest.csv` starts with the UTF-8 BOM bytes `EF BB BF`, uses the documented columns, CRLF rows, and a final newline so it opens safely in Excel;
- `manifest.json` is pretty-printed UTF-8 JSON with a final newline and includes the derived expanded `years` and stable `downloadHref` values;
- `<dataset>-original-sources.zip` contains exactly the individually published originals plus `manifest.csv` and `manifest.json`—never the category ZIP itself or the validation report;
- ZIP entries follow lexical public-path order, use compression level 6, and carry the fixed DOS timestamp `1980-01-01 00:00:00` rather than filesystem timestamps;
- two clean generations must have identical output membership, byte sizes, and SHA-256 values.

Both `predev` and `prebuild` run the write alias automatically. The entire generated download tree and `data/reports/*.json` are ignored build artifacts, not a second source of truth; they must remain unstaged.

## Adding or updating a source year

A new data year is one coordinated change, not an archive-only update:

1. Capture the untouched upstream original under the approved `docs/Raw Data/` boundary. Record the exact official URL/archive location and retrieval evidence; do not transform the byte.
2. Decide whether the source is an original within the approved public boundary. Add one reviewed manifest row with its actual byte size and SHA-256, correct retrieval-date basis, reviewed redistribution status, licence, and attribution.
3. Update the canonical internal methodology, the public methodology content, and `data/methodology/decision-register.csv` when the source changes a methodological decision, coverage statement, limitation, or public explanation.
4. Run `npm.cmd run data:prepare-methodology-archives` (`--write`) to inspect the regenerated assets and validation report.
5. Run the focused catalog/inventory/manifest/archive tests, then `npm.cmd run data:check-methodology-archives` (`--check`).
6. Run `npm.cmd run data:validate` (archive check included), `npm.cmd run check`, `npm.cmd run build`, and the browser suite. `npm.cmd run build` runs `prebuild`, so the production build always regenerates from the reviewed manifests.
7. Review the generated-output report and ignored-file state. Commit the original, reviewed manifest, methodology/content decisions, and tests—not generated downloads or reports.
8. After CI, authorized merge, and a ready production deployment, run the representative download checks below together with the page checks. A new year is not production-complete until its content, archive, validation, and deployed bytes agree.

## Deployment-size and download checks

After a write/prebuild, inspect `data/reports/methodology-archive-validation.json`. It must report top-level and per-dataset `PASS`, the expected source counts and bytes, `generatedBytes`, formats, year coverage, proxy-date count, licence/status counts, and every output's byte size and SHA-256. Sum the per-dataset `generatedBytes` and compare the full static build output with the active hosting plan's deployment/file limits before release; do not rely on source-byte totals alone because individual copies, manifests, and ZIPs coexist in the deployment.

If the static host cannot safely carry the archive, move only the generated byte storage to an approved object store/CDN. Keep the product routes, `/downloads/methodology/<dataset>/...` public URLs, reviewed manifest records, generated CSV/JSON contents, hashes, ZIP membership, and validation contract unchanged—for example by proxying or rewriting those stable paths to the byte host. The fallback must not turn external storage into a new editable source of truth.

After Vercel reports `READY` for the authorized merge SHA, verify HTTP 200 and manifest-matching SHA-256 for one individual original from each of expenditure, revenue, and municipalities; all three category ZIPs; and one category's `manifest.csv` plus `manifest.json`. Confirm the CSV BOM, exact ZIP membership, stable download paths, and no runtime download errors. Production verification follows authorized merge and deployment; local generation or a green deploy-hook workflow is not production proof.
