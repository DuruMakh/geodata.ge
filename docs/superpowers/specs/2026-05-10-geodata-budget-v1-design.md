# GeoData.ge Budget Explorer V1 Design

Date: 2026-05-10
Status: Historical v1 spec — kept for provenance, not maintained

> Supersedure note (2026-07-13): this spec predates implementation. Where it
> conflicts with `Project_Definition.md` (served coverage is 2005-2025 — no
> loaded 2004 data), `DESIGN.md` v4.1 (single editorial paper theme; the
> Light/Night system and theme toggle in §12 are superseded), or `AGENTS.md`
> (current stack: static CSVs read at build time, no runtime database), those
> documents win.

## 1. Product Scope

GeoData.ge v1 is a Georgian-first public budget explorer for Georgia. It is not a broad data catalog in the first version. The v1 focus is national budget overview and visualization for annual budget data from 2017 through 2025.

The first release should beat the current manual workflow of reading budget documents and copying figures into Excel by giving users a clear, trustworthy, interactive public interface.

### Included in V1

- Annual national budget data for 2004-2025 for expenditure and 2005-2025 for revenue. Revenue coverage starts in 2005 because the project does not currently have a reviewed 2004 revenue source. Expenditure coverage starts in 2004.
- Revenue overview with tax revenue and major revenue categories.
- Expenditure overview with public-friendly top-level spending fields such as health, education, social protection, defence, infrastructure, and similar categories where the source data supports a reviewed mapping.
- Multi-year trends and selected-period comparisons.
- Single-year budget snapshot with rich visual summaries.
- CSV download for filtered data.
- Georgian-first interface, with architecture prepared for bilingual support later.

### Excluded from V1

- Municipal transfers explorer.
- Capital projects explorer.
- Debt explorer.
- Admin UI.
- Public API.
- User uploads.
- Automated production extraction from DOCX/PDF.
- Clickable drilldown/detail pages into programs, subprograms, or revenue subcategories.
- Source/provenance visualization in the public UI.

Source and provenance fields should still exist in the backend data model for trust, review, and future display. V1 public UI should include a small source label, but not heavy provenance panels.

## 2. Data Scope and Semantics

V1 data is annual only. Quarterly or monthly data can be added later without changing the public v1 interaction model.

The data model should support planned and actual values, but the public UI does not need to force users to manage planned-vs-actual modes. The current official year can appear as the latest value, with a subtle `planned` badge where applicable. Internally, each fact should retain a `basis` field such as `actual` or `planned`.

Planned vs actual replacement rule:

- A year/item can have planned data first.
- When actual data arrives, actual becomes the active public value.
- If planned and actual values both exist internally for the same item/year, `actual` wins in public charts, tables, and CSV unless an internal audit view is built later.
- Planned values are marked with a badge or dotted chart segment only while they are the active public value.
- The public UI does not expose a planned/actual comparison mode in v1.

Revenue hierarchy:

- Revenue category.
- Optional revenue subcategory.

Expenditure hierarchy:

- Official institution or ministry.
- Official program.
- Optional official subprogram.
- Public spending field, assigned through a reviewed taxonomy mapping.

V1 single-year UI is zoomed out. It uses top-level revenue categories and top-level public expenditure fields.

V1 multi-year explorer can expose official institutions, programs, and subprograms as selectable chart/table series where data exists. This is selection, not drilldown: users can add those rows to charts, but clicking a row does not open a deeper detail page in v1.

### Public Revenue Taxonomy

The public revenue UI should show top-level tax categories directly instead of hiding them under a single `Tax revenue` category.

Revenue taxonomy v0:

- VAT / დამატებული ღირებულების გადასახადი
- Income tax / საშემოსავლო გადასახადი
- Profit tax / მოგების გადასახადი
- Excise tax / აქციზის გადასახადი
- Import tax / იმპორტის გადასახადი
- Property tax / ქონების გადასახადი
- Other taxes / სხვა გადასახადები
- Grants / გრანტები
- Other revenue / სხვა შემოსავლები
- Decrease in non-financial assets / Georgian source label to confirm
- Decrease in financial assets / Georgian source label to confirm
- Increase in liabilities / Georgian source label to confirm

Revenue subcategories, such as income tax from individuals or businesses, remain in the data model for future versions and validation, but v1 public UI stays zoomed out.

### Stable Category IDs

Display labels can change and can be localized, but category IDs must be stable. Imports, charts, CSV exports, and saved mappings should reference IDs, not labels.

ID style:

```text
revenue.vat
revenue.income_tax
revenue.profit_tax
revenue.excise_tax
revenue.import_tax
revenue.property_tax
revenue.other_taxes
spending.health
spending.education
spending.social_protection
spending.debt_service
```

Rules:

- IDs are lowercase ASCII.
- Use dot namespace: `revenue.*`, `spending.*`, `measure.*`, `source.*` where needed.
- Use snake_case after the dot.
- Never use Georgian labels as IDs.
- Never change an ID just because the public label changes.
- If a category is truly replaced, create a new ID and preserve the old one for historical rows.

### Renames and Category Changes

Renames should not break multi-year charts.

Rules:

- If a category is renamed but its meaning is materially the same, keep the same stable ID and update the display label.
- If the meaning materially changes, create a new stable ID and document the transition.
- If one official category splits into multiple public fields, map rows explicitly rather than stretching the old ID.
- If multiple official rows merge into one public field, preserve original official row data and aggregate only in the public query layer.
- Multi-year chart continuity should be based on stable IDs, not labels.

Example:

```text
spending.infrastructure
Label 2024: Infrastructure
Label 2025: Infrastructure and regional development
Same meaning -> same ID
```

### Georgian Terminology Glossary

Before UI implementation, create a small glossary for all public category labels. The glossary should drive chart labels, table labels, selector labels, cards, and CSV headers.

Format:

```text
id | ka_label | en_label | description | notes
spending.health | ჯანდაცვა | Health | Health-related spending field | confirm mapping by programs
revenue.excise_tax | აქციზის გადასახადი | Excise tax | Tax on selected goods | source-confirmed
```

Rules:

- Do not hard-code public labels independently inside chart components.
- Georgian labels are primary for v1.
- English labels can exist for developer clarity and later bilingual UI.
- Source-specific official labels can be stored separately from public UI labels.
- If a label changes, update the glossary, not each component.

### Public Taxonomy and Mapping Layer

The public expenditure UI should use citizen-readable fields, not only administrative institution names. Preferred public fields include categories like health, education, social protection, defence, infrastructure, public order, economy, agriculture and environment, culture, sport, and general public services.

This requires a mapping layer.

Mapping layer means a reviewed table that connects official budget rows to public-facing categories. It does not change the original data. It lets the product preserve official source structure while presenting a clearer public taxonomy.

Example:

```text
Official row: Ministry of Internally Displaced Persons, Labour, Health and Social Affairs
Public field: Health or Social protection, depending on the specific program row
```

Rules:

- Keep the original official institution/program/subprogram identifiers.
- Add a reviewed `public_spending_field` classification for public visualizations.
- Store mapping confidence and mapping notes for review.
- Do not use AI or fuzzy matching as the source of truth for classification.
- If a row cannot be confidently mapped, assign it explicitly to `Other / unclassified` with clear internal audit status. No official row may disappear silently from public totals.
- Mapping can vary by year if government structure or program names change.
- Single-year UI should show public spending fields in v1.
- Multi-year chart/table selection may expose official institution, program, and subprogram rows as selectable series.
- Official hierarchy remains source data; v1 does not provide clickable detail pages for it.

## 3. Public Information Architecture

The main budget explorer has two high-level modes:

- `Expenditure`
- `Revenue`

Default first view:

- Mode: `Expenditure`
- View: `Multi-year`
- Measure: `Nominal GEL`
- Chart type: `Line`
- Time range: `2004-2025`
- Selected series: `Total expenditure`

The product should avoid a generic marketing homepage in v1. The budget explorer itself is the primary experience.

## 4. Main Explorer

The first viewport should feel like an Our World in Data style chart explorer, adapted for Georgian budget data.

Layout:

- Header switcher: `Expenditure / Revenue`.
- Chart area on the left.
- Data selection panel on the right.
- Year or range controls below the chart.
- Chart mode switcher above the chart.

Current production chart modes:

- `Line`: multi-year trend over selected range.
- `Table`: exact data table.

Current production measure controls:

- `Nominal GEL`
- `Share of total`

Bar mode, stacked mode, `% change`, and `Share of GDP` are deferred from the current production v1 UI. They should not be exposed unless a new design and implementation scope explicitly re-approves them. `Share of GDP` still requires trusted GDP data before implementation.

### Series Selection

Users can select multiple series from the right-side panel.

Rules:

- Up to 8 visible series on charts.
- Table mode has no 8-series limit.
- Search filters available items while preserving hierarchy context.
- If the user tries to select more than 8 chart series, show a clear limit message.
- Expenditure and revenue remember separate selections when switching modes.

The default selected series is total expenditure in expenditure mode.

### Line Mode

Line mode shows multi-year trends for selected series.

Rules:

- Direct end labels when readable.
- Right-side selected list always shows color and latest value.
- If labels collide, hide some direct labels and rely on the selector.
- Hover tooltip remains simple: item name, year, value, and current measure if relevant.
- Planned values are visually distinct from actual values. For line charts, use a dotted final segment or distinct planned-year marker when the latest year is planned.

### Deferred Chart Modes

Bar and stacked modes are not part of the current production v1 UI. Older plans may describe them, but `DESIGN.md` is the current source of truth for the production interface. Keep these modes out of the visible UI until they are re-approved with matching design references, data semantics, and tests.

### Table Mode

Table mode shows exact values.

Approved table structure:

```text
Budget item | 2017 | ... | 2025 | Change | Share 2025
```

Hierarchy should be shown with indentation, not a separate parent column.

Example:

```text
Education Ministry
  General Education
    School Infrastructure
```

No provenance/source columns in v1 public table.

## 5. Multi-Year Below-Scroll

The first viewport is not the whole page. Below it, the multi-year page should summarize the selected period.

Recommended order:

1. Selected-period summary cards.
2. Top 3 growth and bottom 3 growth.
3. Start-year vs end-year comparison.

### Selected-Period Cards

Cards should be computed from the active side and selected period.

Recommended cards:

- Total selected-period change.
- Largest absolute GEL increase.
- Fastest percentage growth.
- Lowest percentage growth.
- Biggest share-of-total change.

Wording should avoid calling something a "loser" unless the value actually declines. Prefer "Top growth" and "Bottom growth" or "Fastest growers" and "Slowest growers".

### Top and Bottom Movers

Show two compact lists:

- Top 3 fastest-growing top-level items.
- Bottom 3 lowest-growth top-level items.

Each row should show rank, item name, growth percentage, and a small context label.

### Start vs End Comparison

Show a side-by-side comparison for the selected period start and end years.

Example:

- Left side: 2018 values.
- Right side: 2024 values.
- Rows align by budget item.

This helps users see how composition changed over the selected period.

## 6. Single-Year Snapshot

Single-year mode is a zoomed-out national budget snapshot. It has no drilldown in v1.

The same section structure works for revenue and expenditure, but wording should adapt:

- Expenditure: "Where public money goes".
- Revenue: "Where public money comes from".

Final single-year order:

1. Year headline cards.
2. Treemap.
3. Every 100 GEL.
4. Spending petals.
5. Budget Field.
6. Full ranking.

### Year Headline Cards

For expenditure:

- Total expenditure.
- Largest field.
- Fastest growing item vs previous available year.
- Largest GEL increase vs previous available year.

For revenue:

- Total revenue.
- Largest source.
- Fastest growing item vs previous available year.
- Largest GEL increase vs previous available year.

Keep this block to four cards. More detail belongs in the visual sections and ranking.

If the selected year is planned, show a small `planned budget` badge near the year title. Do not hide the year or force users into a separate planned/actual mode.

### Treemap

Treemap is the single-year opener.

Rules:

- Shows all top-level items.
- Rectangle size = share of total.
- Labels appear only where readable.
- Full details available on hover.
- No click/drilldown in v1.

Tooltip:

- Item name.
- GEL amount.
- Share of total.

### Every 100 GEL

This is a public explainer, not exact accounting.

Rules:

- Uses rounded whole-GEL amounts.
- Shows where every 100 GEL goes for the selected side and selected year.
- Exact percentages and GEL values remain available in treemap, ranking, and tooltips.
- If rounding requires adjustment, use a clear `Other` or rounding bucket rather than decimals.

Example:

```text
From every 100 GEL of expenditure:
30 GEL social protection
15 GEL health
13 GEL education
8 GEL defence
5 GEL infrastructure
29 GEL other
```

Tooltip:

- Item name.
- Rounded GEL from 100.
- Exact share.

### Spending Petals

Spending petals are separate from Every 100 GEL. They are a more expressive composition visual.

Rules:

- Show top 7 items plus `Other`.
- Petal size = share of total.
- Labels only for readable petals.
- Tiny petals rely on tooltip or legend.
- No click/drilldown in v1.

Tooltip:

- Item name.
- GEL amount.
- Share of total.

### Budget Field

Budget Field is a scatter plot for one selected year.

Rules:

- x-axis = share of total in selected year.
- y-axis = growth vs previous available year.
- bubble size = GEL amount.
- color = item/category palette.
- Show all top-level items.
- Labels only for notable or selected points.
- Full details on hover.

Growth must be data-driven. If the selected year has no previous year available in the dataset, show a clear `growth unavailable` state. Do not hard-code this to 2016, because earlier years may be added later.

Tooltip:

- Item name.
- GEL amount.
- Share of total.
- Growth vs previous available year.

### Full Ranking

Full ranking is the exact single-year inspection section.

Columns:

```text
Rank | Item | GEL amount | Share of total | Change vs previous available year
```

Rules:

- Default sort = GEL amount descending.
- User can sort by share of total or change vs previous available year.
- Expenditure rows are top-level public spending fields.
- Revenue rows are top-level revenue categories.
- No programs, subprograms, or revenue subcategories in the single-year full ranking.

## 7. Mobile Behavior

V1 should be usable on mobile without reducing access to the data.

Rules:

- Main explorer stacks vertically: chart first, selector below.
- Line and stacked charts may use compact x-axis labels or horizontal scroll.
- Bar and table modes should remain naturally mobile-friendly.
- Single-year sections stack one after another.
- Every 100 GEL becomes a compact 10x10 grid or grouped legend.
- Spending petals should still render, but labels may reduce aggressively.
- Budget Field should keep a minimum chart width with horizontal scroll if needed.

## 8. Data Model Direction

Use one shared annual budget facts model rather than separate revenue and expenditure fact tables.

Core dimensions:

- Year.
- Amount.
- Currency.
- Basis: `actual` or `planned`.
- Measure type or fact type.
- Revenue category.
- Revenue subcategory.
- Institution.
- Program.
- Subprogram.
- Public spending field.
- Mapping confidence.
- Mapping notes.
- Mapping version.
- Source/provenance metadata.

Nullable dimensions are expected because a row may represent revenue, expenditure, balance, or another budget indicator. Validation must enforce valid combinations instead of relying on every column being required.

Examples:

- Revenue row: revenue fields populated, expenditure fields empty.
- Expenditure row: institution/program fields populated, revenue fields empty.
- Total/balance row: most hierarchy fields empty, fact type defines meaning.

## 9. Data Ingestion Workflow

V1 ingestion should be reviewed and controlled, not fully automated extraction.

Pipeline:

1. Source documents are collected.
2. Data is manually reviewed and normalized into XLSX/CSV.
3. Import script validates schema, hierarchy, year coverage, and totals.
4. Clean data is inserted into the database.
5. Dashboard reads only validated facts.

Production should not depend on parsing Word/PDF documents automatically in v1. That can become a later internal tooling project.

### Import Validation Report

Every import should produce an internal validation report. This is not a public v1 feature; it is a maintenance and trust tool.

The report should include:

- Import year or years.
- Number of rows read.
- Number of rows imported.
- Total revenue and expenditure loaded.
- Planned vs actual row counts.
- Amount and share assigned to `Other / unclassified`.
- Total reconciliation result.
- Warnings for changed labels, missing years, duplicate IDs, unmapped rows, or suspicious zero/null values.

Example:

```text
Import year: 2025
Rows imported: 312
Total expenditure: 31.2B GEL
Unclassified expenditure: 180M GEL / 0.58%
Planned rows: 0
Actual rows: 312
Warnings:
- 4 rows assigned to Other / unclassified
- 2 labels changed from previous year
```

The goal is to catch data problems before they reach public charts.

## 10. Technical Architecture

Target stack:

- Next.js with App Router.
- TypeScript.
- Supabase Postgres.
- Prisma.
- Tailwind/shadcn or a disciplined design system layer.
- Vercel deployment.

Architecture rules:

- Server-side data loading for public pages where practical.
- Shared query/data transformation layer for charts, tables, and CSV export.
- Chart components should not own business logic.
- CSV export should use the same filtered data model as the visible UI.
- Public read-only data access in v1.
- No auth-dependent user features in v1.

### Implementation Sequence

Build v1 data-first, not visual-first.

Recommended sequence:

1. Data foundation: schema, taxonomy IDs, glossary, mapping table, import validation report.
2. Real v1 data: load and validate the 2004-2025 expenditure source-backed facts and 2005-2025 revenue source-backed facts.
3. Main explorer core: expenditure/revenue switch, line mode, table mode, CSV.
4. Add single-year core: headline cards, treemap, Every 100 GEL, ranking, and the approved snapshot visuals.
5. Polish: planned badges, source label, mobile behavior, and the `DESIGN.md` Light/Night production visual system.

This order prevents a visually impressive but data-weak product.

## 11. Trust and Source Policy

Backend facts must retain source/provenance metadata. Public v1 UI does not display provenance panels, source cards, or source-heavy tooltips.

Tooltips and tables should stay simple. The product should not overload first-version users with document provenance unless that becomes a later trust feature.

V1 should still show a minimal source label, such as:

```text
Data: reviewed official budget documents. Last updated: YYYY-MM-DD.
```

If a selected year is planned, the label or year badge should make that clear:

```text
YYYY planned budget
```

CSV exports should include enough metadata to identify source basis, update date, and whether values are planned or actual.

CSV metadata should be included as columns, not only as comment headers, because spreadsheet tools handle columns reliably.

Minimum CSV columns:

```text
year
category_id
ka_label
en_label
amount_gel
basis
source_name
source_url_or_file
last_reviewed_at
```

Public source label minimum:

```text
Data: reviewed official budget documents
Last updated: YYYY-MM-DD
Latest year: YYYY planned budget
```

## 12. Visual Direction

The production visual direction follows `DESIGN.md` and the confirmed references in `docs/Design HTML files/`. The current approved direction is a clean Apple-like analytical Budget Explorer with Light and Night themes.

Guardrails:

- Keep production UI aligned with `DESIGN.md`.
- Older dark, neon, and terminal-like prototype styling is superseded for production unless a new design change is explicitly approved.
- Do not let the style reduce readability of Georgian text or chart labels.
- Data colors must remain distinguishable and accessible.
- Avoid decorative effects that make charts harder to read.
- Light and Night themes must keep the same layout, controls, and chart geometry.

## 13. Durable Agent Context

Future sessions should preserve these project decisions:

- GeoData.ge v1 is a Georgian-first Georgia Budget Explorer.
- Budget Explorer comes before a broad public-data catalog.
- Annual national budget data for 2004-2025 expenditure and 2005-2025 revenue is the v1 data window.
- Planned years are shown with subtle badges and planned markers in charts.
- V1 has no admin UI and no public API.
- V1 has no clickable drilldown/detail pages; single-year pages show zoomed-out top-level budget composition.
- Revenue supports subcategories in the data model, but v1 UI shows top-level revenue categories.
- Expenditure supports institution, program, and subprogram in the data model, but v1 UI shows reviewed public spending fields.
- Multi-year charts/tables may expose institutions, programs, and subprograms as selectable series; this is not clickable drilldown.
- Source/provenance is backend-first in v1, with only minimal public source labeling.
- Multi-year and single-year views are both first-class product surfaces.
- Long-term architecture should remain stable and data-first; avoid short-term UI-only hacks.
- Production UI follows `DESIGN.md`: clean Apple-like analytical Budget Explorer, Light and Night themes, no default dark/neon/terminal prototype layer.

## 14. Pre-Implementation Requirements

These requirements must be clarified before implementation begins, because they affect schema and UI behavior:

- Top-level public expenditure taxonomy. Current v0 categories: Social protection, Health, Education, Defence, Public order and safety, Infrastructure and regional development, Economic affairs, Agriculture and environment, Culture, Sport, General public services, Debt service, Other / unclassified.
- Source-confirmed Georgian labels for `Decrease in non-financial assets`, `Decrease in financial assets`, and `Increase in liabilities`.
- Mapping table format from official budget rows to public spending fields.
- Mapping confidence and mapping notes format.
- Stable IDs for categories across years.
- Rules for renamed ministries, programs, and revenue categories.
- Planned vs actual display rules.
- Minimal source label and CSV metadata format.
- Validation rules for totals, missing years, and unmapped rows.
- Internal import validation report format.
- Georgian terminology glossary for the public categories.
- UTF-8 verification for Georgian labels in source files, import outputs, browser UI, and CSV exports.

These do not require perfect final data before coding starts, but they do require a clear first version of the rules.

## 15. Open Implementation Questions

These should be resolved during implementation planning, not by changing product scope:

- Mapping-review decisions needed to reduce `Other / unclassified` expenditure after the current validated data pipeline.
- Any future re-approval criteria for deferred chart controls such as Bar, Stacked, `% change`, or `Share of GDP`.
- Import file format conventions and validation error format.

## 16. Success Criteria

V1 succeeds when a Georgian-speaking user can:

- Open GeoData.ge and immediately understand national budget direction.
- Switch between expenditure and revenue.
- Compare annual trends from 2004-2025 for expenditure and 2005-2025 for revenue.
- Understand whether a latest-year value is planned or actual.
- See exact values in table mode.
- Export filtered data to CSV.
- Understand one selected year through treemap, Every 100 GEL, petals, Budget Field, and ranking.
- Trust that displayed data comes from reviewed official budget sources, even if source UI is not exposed yet.
