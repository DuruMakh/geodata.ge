# Georgian and English presentation

The bilingual design is recorded in `docs/superpowers/specs/2026-09-05-fiscal-bilingual-design.md`. This document owns the reviewed display catalogue and its validation. English page and service integration are separate implementation stages; catalogue coverage alone does not mean a page has been translated.

## Text ownership

Reviewed Georgian names continue to come from the existing taxonomy, glossary, municipal registry, programme facts, and source metadata. Their identifiers and numerical records are unchanged.

`data/localization/en/` owns English display records:

- `labels.json`: public category, entity, dataset, total, and current programme names. Municipality official display names use a separate `{code}.official-name` display key; this is not a new data entity.
- `programme-history.json`: English names for each actually served programme/year, paired with the exact original Georgian label. A changed original invalidates its old translation record.
- `sources.json`: logical source names and English derivation descriptions where the source represents a calculation.
- `documents.json`: English document titles, publishers, attribution descriptions, and verified document language, or `null` when not verified.

Existing `enLabel` fields in the serving mirror remain legacy fields. New public English presentation consumes this catalogue after either CSV or mirror loading, so the implementation requires no database changes or manual import.

Interface messages live in scoped Georgian and English JSON files under `apps/web/lib/i18n/messages/`. The browser-safe message formatter is separate from `messages.server.ts`, which loads the requested dictionaries. Page/client roots receive only their required messages and plain label strings, without review metadata or the full source catalogue.

## Initial editorial review

The initial catalogue was reviewed on 2026-09-05 against the loaded national/municipal registries, current and historical programme labels, existing source metadata, and validated source manifests. Existing English category and source names were used as seeds; new translations were authored for municipal functions and places, programme name variants, and Georgian document descriptions. These are Fiscal.ge display translations; they are not represented as official English editions of source documents.

The full receipts total is labelled **Total receipts** in English because the underlying series includes financing items. The national dataset is **Consolidated budget receipts**; state-budget expenditure and the separately sourced general-government balance retain their distinct accounting boundaries. No value, status, mapping, or aggregation changes as a result of these terms.

Historical labels preserve changes in programme meaning and wording. Existing acronyms such as `SG` are retained where the source does not establish an expansion. The 2004 Treasury E11 document's English title explicitly identifies its central-budget scope, as already recorded by the expenditure methodology; it is not relabelled as the full state-budget source used for 2004 public expenditure.

Source publisher/attribution identities are preserved. Original files, official titles in the original metadata, URLs, licences, hashes, and retrieval dates remain untouched. A translated title is not evidence of the original file's language. Initially, `documentLanguage` is `null`; populate it only after inspecting that original or authoritative publication metadata. Do not infer it from the title's script, filename, URL, or the English language of this website.

The initial reviewed coverage comprises 264 display keys, 549 programme/year records across 48 programme series, 115 logical sources, and 195 original-document identities. These counts describe the initial catalogue and are not hardcoded limits. The validator derives required coverage from current served data and manifests.

## Displayed numbers

Both languages share one number format (DESIGN.md §11): en-US grouping, the `−` minus sign, and a last-digit 5 rounded up on the number's decimal form, as Excel and Geostat round, so a stored 0.95 shows as 1.0 and 1.65 as 1.7. Every displayed decimal goes through the shared Intl formatter in `apps/web/lib/explorer/format.ts` (`roundForDisplay`, `formatShare`, `formatPoints`), which first drops the float noise arithmetic adds (a fraction × 100 turns 1.65 into 1.6499999999999999). JavaScript `toFixed` rounds the binary value instead (`(0.95).toFixed(1)` is `0.9`, `(10.25).toFixed(1)` is `10.3`) and is not used for displayed figures. Until 2026-10-13 the share and point formatters, the inflation grid and the inflation labels used it: 51 values showed their last digit one too low (inflation national 1, categories 10, cities 11, product changes 28, and the 2021 external debt rate, 0.95% shown as 0.9%), and an inflation cell could read 1.6 on the page but 1.7 in Excel. Values the pages take from `published_value` were not affected.

Percentages show one decimal. Interest rates show two, as the Ministry of Finance and NBG publish them; a rate whose source prints one decimal keeps one and is never padded (`government-debt-annual.md`, `money-banks-annual.md`). Inflation stays at one decimal, as Geostat prints it.

## Validation and updates

Run from `apps/web`:

```powershell
npm run i18n:check
npx tsx scripts/check-localization.ts --inventory
```

The check runs in normal development/build preparation and in `npm run check`. It rejects missing records, empty or untranslated English values, invalid review dates, changed historical Georgian names, missing derivation/attribution descriptions, and missing or mismatched interface variables. Original Georgian historical text is kept in a separately named field rather than exempting all English strings from validation.

New data years and public identities require the corresponding reviewed translations. Keep the numerical/source import authoritative; update the presentation records alongside it. Set a review date only after checking the wording and meaning. Ordinary rebuilds must not rewrite those dates. Preserve official entity names and source-document identities rather than deriving them from translated text.

Before final bilingual launch, also verify actual page bodies, hidden/accessible text, real Excel files, search metadata, and both AI output representations. Later service integration must bundle its required translations and templates into its deterministic snapshot so translation changes are reflected in `dataVersion`; the catalogue-only stage does not yet change that public service contract.
