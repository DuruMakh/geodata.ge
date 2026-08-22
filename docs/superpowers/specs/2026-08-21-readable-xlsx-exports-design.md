# Fiscal.ge readable Excel exports design

**Status:** Approved 2026-08-21; source-sheet and title-band amendment approved 2026-08-22

**Production baseline:** Fiscal.ge rebrand PR #64, merged as `2c5c1403`

## 1. Purpose

Fiscal.ge currently downloads a long-form CSV whose identifiers and provenance columns are useful for systems but inconvenient for people working in Excel. Public explorer downloads will become one `.xlsx` workbook that serves both quick reading and separate analysis without exposing repository paths or database-style column names.

Every workbook has three visible sheets:

1. `მარტივი ცხრილი` — a formatted years-across view for reading and comparison;
2. `მონაცემები` — a compact row-based table for filtering, calculations, and pivot tables;
3. `წყაროები` — a clean, dedicated list of the relevant downloadable public originals.

The design applies to national expenditure fields, ministry/program expenditure, national revenue, municipality and region pages, and the Georgia municipal aggregate. It establishes reusable rules for future Fiscal.ge datasets without forcing irrelevant empty columns into every workbook.

## 2. Approved user experience

### 2.1 One download action

- Each explorer keeps one dataset-owned download action in its current location below the series selector.
- The label becomes `Excel ჩამოტვირთვა`.
- There is no separate public CSV action and no file-format menu.
- While the workbook is being created, the button is disabled and reads `Excel მზადდება…`.
- If generation fails, the page shows `ფაილი ვერ მომზადდა — სცადეთ თავიდან.` directly below the action. The user can retry without reloading.
- The downloaded filename is `fiscal-{scope}-{startYear}-{endYear}.xlsx`, using the existing scope-specific basename rules.

### 2.2 Active context

The workbook represents the same context the visitor chose on the page:

- active route and dataset;
- expenditure grouping (`სფეროები` or `უწყებები`);
- selected year range;
- selected series;
- active measure, including `% მშპ-ში` where applicable;
- actual/planned precedence already used by the explorer.

Selector search text does not filter the workbook. Search only helps find a series; selection and year range define the export.

The municipality export must be corrected to use the active range rather than silently exporting every loaded year.

## 3. Sheet 1 — `მარტივი ცხრილი`

### 3.1 Structure

The sheet opens by default and follows this exact order:

1. dataset title;
2. one subtitle containing selected period, basis, and unit;
3. table header immediately below the subtitle;
4. selected total row first, when the total is part of the active selection;
5. selected category rows;
6. one short reading note.

There is no blank row or redundant `მონაცემები` section label between the subtitle and table header.

The table uses categories as rows and years as columns. Year headings are right-aligned directly above their numeric values. The first column and header rows are frozen.

### 3.2 Values and units

- Cells contain real numeric values, not formatted text.
- Nominal values use a clearly stated readable scale. The initial national and municipal pattern is `მილიონი ₾` with one decimal; the analysis sheet retains full GEL precision.
- Percentage views use numeric percentages and a precise Georgian unit label.
- Blank means unavailable. Zero is displayed only for a real zero.
- Negative values use red parentheses.
- Planned values remain numeric and receive a visible `გეგმა` marker.
- The final column is `ცვლილება {startYear}–{endYear}`.
- Change is blank when either endpoint is missing, the starting value is zero or negative, or the result would be misleading for a sign change.

### 3.3 Totals and hierarchy

- When selected, the applicable total remains the first row. It uses the explorer's exact total semantics and is never assumed to equal the visible components. This preserves municipal public totals and other non-additive aggregate rules.
- Ordinary component cells may reference `მონაცემები`; a total may use a sum formula only when that dataset explicitly defines the total as the sum of those exported components. Otherwise the exact total value comes from the shared export model.
- A deselected total is not silently reinserted.
- Field, revenue, and municipal categories are ordinary rows.
- Ministry rows are visually stronger parent rows.
- Major programs appear indented under their ministry.
- Missing years stay blank; rows are not discarded merely because they have partial coverage.
- The displayed ordering follows the explorer model rather than re-sorting independently inside the export.

### 3.4 Source separation

`მარტივი ცხრილი` contains no source appendix. All provenance links move to the dedicated `წყაროები` sheet so the years-across table remains visually compact.

## 4. Sheet 2 — `მონაცემები`

### 4.1 Purpose and shape

`მონაცემები` is an Excel table with filters and one observation per row. It uses full, unscaled numeric values suitable for formulas and pivot tables.

The standard columns are exactly:

```text
წელი
მთავარი ჯგუფი
კატეგორია
თანხა (₾)
სტატუსი
```

Approved meanings:

- `წელი` — observation year;
- `მთავარი ჯგუფი` — the parent or active grouping, such as `გადასახადები`, a ministry, or municipal functions;
- `კატეგორია` — the Georgian series label;
- `თანხა (₾)` — full GEL amount as a number;
- `სტატუსი` — `ფაქტი` or `გეგმა`.

The sheet does not include category IDs, parent IDs, English labels, source IDs, repository paths, review dates, hashes, or GDP-source metadata.

### 4.2 Dataset-specific columns

Only meaningful columns may be added:

- `% მშპ-ში` adds `მშპ-ის წილი (%)`;
- a future multi-entity export may add a clearly named first column such as `ტერიტორია` or `ერთეული`;
- a dataset with another approved measure may add one precisely named numeric column.

No generic column is emitted empty across an entire workbook.

### 4.3 Aggregates and hierarchy

- The analysis table preserves user-selected series.
- A derived overall total is omitted when its component rows are present, preventing immediate double counting in pivot tables.
- When the total is the only selected series, it is included so the sheet is not empty.
- Ministry/program hierarchy is expressed through `მთავარი ჯგუფი` and `კატეგორია`; no code column is reintroduced.
- Filter buttons remain visible, the header row is frozen, and numeric columns are right-aligned.

## 5. Sheet 3 — `წყაროები`

The sheet contains one row per distinct relevant public original, deduplicated across categories. It displays:

```text
პერიოდი | ოფიციალური წყარო | ორგანიზაცია | ფაილი | მოპოვებულია
```

Rules:

- continuous coverage is compressed to a range such as `2015–2019`; discontinuous coverage is shown as compact ranges rather than a comma-separated year list;
- source titles and organizations come from the reviewed methodology archive manifest;
- the visible hyperlink text is `ფაილის ჩამოტვირთვა`, while the hyperlink targets the absolute downloadable original under `/downloads/methodology/...` or the reviewed external official URL;
- raw URLs, `docs/Raw Data/...`, and repository paths do not occupy visible cells;
- the origin comes from the shared production site resolver and is passed into workbook generation;
- neither `fiscal.ge` nor a Vercel alias is hardcoded in the workbook writer;
- source rows cover only the selected years and are sorted oldest-to-newest;
- internal source IDs, hashes, review notes, and repeated per-observation provenance do not appear here.

Fiscal.ge methodology manifests and original ZIP/file downloads remain unchanged. Their manifest CSVs are archive-integrity artifacts, not explorer dataset exports, and stay in their current formats.

## 6. Reusable export model

Workbook generation is split into two independent units.

### 6.1 Pure workbook model

A pure, library-independent builder receives explorer rows and returns a typed model containing:

- title, period, unit, and measure;
- ordered years;
- ordered readable rows with hierarchy and basis;
- row-based analysis observations;
- total and change rules;
- deduplicated public sources;
- filename and scope metadata.

National and municipal pages adapt their current explorer models into this shared shape. Future datasets implement the same boundary instead of adding conditions throughout the XLSX writer.

### 6.2 XLSX writer

One client-safe writer converts the typed model into the approved three-sheet workbook. It owns only workbook mechanics:

- sheet creation and ordering;
- formulas;
- styling, widths, alignment, and number formats;
- frozen panes and filters;
- clickable hyperlinks;
- workbook metadata and file serialization.

The writer does not know how budget categories, municipality aggregates, or methodology manifests are loaded.

## 7. Technical approach

### 7.1 Browser generation

The deployed site remains fully static. XLSX files are generated in the browser from data already loaded for the active explorer; no API route, server write, stored user export, or new public API is added.

Use ExcelJS as a production dependency because its browser API supports the approved requirements: multiple worksheets, formulas, styles, number formats, frozen panes, Excel tables, hyperlink cells, and `workbook.xlsx.writeBuffer()` for Blob download.

ExcelJS must be dynamically imported only after the user activates the download. The initial explorer bundle must not eagerly include the workbook library. The implementation verifies this through the production build output and browser behavior.

The existing Blob-and-anchor download pattern remains. The MIME type is:

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

### 7.2 Public source metadata

Server route code loads validated methodology archive rows and passes a compact export-source model to the client:

- covered year or years;
- Georgian display title;
- relative `downloadHref`;
- retrieval date;
- source organization where needed for accessible text.

The client receives the resolved production site origin separately and constructs absolute hyperlinks. Missing source coverage for a live export year is a validation/test failure; the writer never falls back to a repository path.

### 7.3 Component boundaries

Expected implementation units:

- a pure shared workbook-model module under `apps/web/lib/explorer/`;
- a client-only ExcelJS writer under `apps/web/lib/explorer/`;
- a small methodology-to-export source adapter under `apps/web/lib/methodology/`;
- one reusable download action/state component or hook;
- thin adapters in the national and municipal explorers;
- route-level source/site-origin props derived on the server.

The current CSV exporter and direct CSV download handlers are removed when no public consumer remains. Canonical reviewed CSV imports, methodology manifests, data validation, and database parity are untouched.

## 8. Visual contract

The approved prototype establishes the workbook treatment:

- Fiscal warm paper, ink, terracotta, and restrained rules;
- Georgian-first labels;
- cream title bands with dark text, plus dark table-header bands;
- total row visually separated;
- no decorative chart, dashboard, card grid, or unnecessary worksheet;
- `მარტივი ცხრილი` begins its data table on row 3;
- year headings and numeric values share right alignment;
- source links live only on `წყაროები` and use a clean visible download label rather than raw URL text;
- `მონაცემები` is compact, filterable, and free of database-style names.

The workbook must remain usable in Microsoft Excel and Google Sheets. Styling is allowed to degrade gracefully in other compatible spreadsheet applications, but values, formulas, sheet names, filters, and hyperlinks must survive.

## 9. Accessibility and failure behavior

- The web download action retains visible keyboard focus and an accessible name that includes Excel.
- Busy and error states are announced through an appropriate live region without moving focus.
- Repeated activation while generation is running cannot create duplicate downloads.
- An empty series selection disables the download and uses the page's existing empty-selection explanation.
- Workbook text is Georgian-first and does not depend on color alone.
- Negative values use both parentheses and color.
- Source hyperlinks expose the source title and file format in their accessible spreadsheet text or tooltip.

## 10. Verification and acceptance criteria

### 10.1 Pure model tests

- years are derived from the active range;
- search text does not change export rows;
- selection and grouping do change export rows;
- totals and hierarchy are correct;
- missing values remain blank and zero remains numeric zero;
- planned values show `გეგმა` and actual wins when both exist;
- negative/sign-change growth is blank;
- derived totals do not create immediate double counting in `მონაცემები`;
- optional measure columns appear only when applicable;
- source rows are deduplicated and contain no repository path.

### 10.2 XLSX tests

Read the generated workbook back with ExcelJS and assert:

- exact sheet order and names: `მარტივი ცხრილი`, `მონაცემები`, `წყაროები`;
- first sheet is active;
- readable table starts on row 3;
- year headers are right-aligned;
- formulas and representative values reconcile with the analysis sheet;
- full GEL values remain numeric;
- approved Georgian analysis headers are exact;
- `კატეგორიის კოდი` is absent;
- filters and frozen panes exist;
- public source hyperlinks use the resolved site origin;
- no cell contains `docs/Raw Data`, a source ID, or a repository path;
- workbook filename begins with `fiscal-` and ends with `.xlsx`.

### 10.3 Surface coverage

Browser tests download and parse representative workbooks for:

- national expenditure fields;
- ministries with at least one selected program;
- national revenue;
- `% მშპ-ში` mode;
- one municipality;
- one region;
- the Georgia municipal aggregate;
- a narrow/mobile viewport.

Tests verify the active year range, selected series, sheet names, source links, filename, and absence of a public CSV download action.

### 10.4 Engineering and release gates

- dependency audit after adding ExcelJS;
- lint;
- strict TypeScript check;
- unit tests;
- data validation;
- production build and confirmation that ExcelJS is lazy-loaded;
- full relevant browser suite;
- required hosted CI and review resolution;
- post-merge Vercel deployment matching the merge commit;
- live Fiscal.ge page checks and representative `.xlsx` downloads;
- downloaded workbooks opened in Microsoft Excel for a final manual smoke check.

## 11. Documentation updates

Implementation updates current authoritative documents together:

- `Project_Definition.md` changes the public export from CSV to the approved three-sheet Excel workbook;
- `DESIGN.md` replaces the CSV button/metadata contract with this Excel contract;
- landing-page copy and preview stop presenting the explorer export as CSV;
- relevant browser tests and user-facing filenames use Fiscal.ge naming;
- methodology archive manifest/ZIP documentation remains unchanged.

## 12. Out of scope

- changing reviewed facts, mappings, classifications, or source files;
- changing methodology archive manifests or original-file publication;
- adding a public API or server-side export endpoint;
- persisting generated workbooks;
- restoring a separate public CSV action;
- adding charts or dashboards inside the workbook;
- adding English sheet/column duplicates;
- exporting internal IDs or repository provenance into the public workbook;
- designing an all-purpose multi-entity schema before a real dataset requires it.
