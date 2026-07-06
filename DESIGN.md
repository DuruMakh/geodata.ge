# GeoData.ge Design System — Editorial

Version: 4.1
Last updated: 2026-07-07
Status: Production visual system for GeoData.ge Budget Explorer v1
Scope: Budget Explorer product UI, charts, tables, controls, export surfaces, responsive behavior, and future pages that reuse the Budget Explorer shell.

---

## 1. Source of Truth

This file defines the production design system for GeoData.ge v1. It **replaces DESIGN.md v3.x (the Apple-like Light/Night system) in full**. The editorial direction is the approved production direction.

Confirmed visual references (checked into the repo):

- `docs/Design HTML files/editorial-v2/GeoData Platform - Editorial v2.dc.html` — **primary reference**: full product prototype (3-tab navigation, explorer, indicators, analysis/single-year view, responsive rules, hash deep-linking).
- `docs/Design HTML files/editorial-v2/Editorial Design System - Reference.dc.html` — component reference sheet (colors, typography, rules, controls, data patterns, single-year surfaces).
- `docs/Design HTML files/editorial-v2/Budget Explorer - Editorial (approved).dc.html` — earlier approved multi-year explorer layout.
- `docs/Design HTML files/editorial-v2/DESIGN v4 (Editorial).md` — the original v4.0 draft exported from Claude Design (kept for provenance; this file supersedes it where they differ).

Confirmed product references:

- `Project_Definition.md`

If this file and the confirmed reference files disagree, prefer **GeoData Platform - Editorial v2.dc.html** for visual and behavioral details and update this file immediately.

Superseded and must not appear in production:

- The Apple-like Light/Night system (DESIGN.md v3.x), including `#0071e3` primary, card/shadow surfaces, 24px radii, gradient headline cards, the SF Pro stack, the theme toggle, and the iOS view switch.
- Crypto/terminal, neon, and marketing-homepage directions.

## 2. Product Scope Boundary

GeoData.ge v1 is a Georgian-first national budget explorer for annual data. It is not a broad public-data catalog.

V1 includes: multi-year explorer (line + table) with fields/ministries grouping, single-year analysis view, CSV export, Georgian-first UI, minimal public source label, internal provenance metadata.

V1 excludes: data catalog, municipal/capital/debt explorers, admin UI, public API, uploads, sub-annual data, automated document extraction, clickable drilldown pages (series selection in the explorer is not drilldown).

Every visual decision should support a focused budget product, not a generic dashboard.

### 2.1 Actual Data Coverage (data-driven, never hardcoded)

Year ranges in the UI always derive from loaded facts. Current reviewed coverage:

- Expenditure by public spending fields: **2005–2025** (13 fields per year, 12-month actual execution).
- Expenditure by ministries (administrative view): **2005–2025** categories; major-program drill-down rows exist from 2012 (partial) and are contiguous 2017–2025.
- Revenue: **2005–2025** (11 top-level categories).
- All current facts are `basis = actual`. Planned-value affordances (the `გეგმა` tag) stay specified and must activate automatically if planned facts ever load.

## 3. Design Direction

The confirmed direction is a **warm editorial statistical annual**: the product should read like a precisely typeset printed reference publication, not a SaaS dashboard.

Core atmosphere:

- Paper background, ink foreground, one terracotta accent.
- Structure comes from **typographic rules (horizontal lines)**, not cards. There are no cards, no elevated surfaces, no container shadows.
- Serif display type for titles and big numbers; sans for UI; mono for every numeral.
- Dense but calm; generous section spacing, compact data rows.
- Georgian-first.

The system should feel: civic and archival, analytical but humane, printed rather than rendered.

## 4. Theme

**One theme in v1: editorial paper (light).** There is no night theme and no theme toggle. If a night variant is ever approved, it must keep identical layout, section order, chart geometry, and controls, changing tokens only.

### 4.1 Role Tokens

```yaml
colors:
  paper: "#F7F2E9"        # page background; the only canvas
  tint: "#F1EADC"         # hover rows, selected rows, callout background
  tile: "#FDFAF3"         # tooltip and treemap tile fill (only "raised" surface)
  ink: "#1E1B16"          # primary text, strong rules, total row
  body: "#55503F"         # secondary data text
  muted: "#6A6050"        # labels, captions, inactive controls (v2 darkened from #7A7060 for contrast)
  faint: "#A89C88"        # decoration-only metadata
  hairline: "#D9CFBE"     # section sub-rules, aside border
  hairline-soft: "#E7DECF" # row borders, chart grid, bar tracks
  row-border: "#EDE4D3"   # series-panel row borders
  control: "#C9BEA9"      # control borders (checkbox, pill, search underline)
  accent: "#B3402A"       # terracotta: active states, focus, negative values
  positive: "#1F6E56"     # positive change
  negative: "#B3402A"     # negative change (shared with accent by design)
```

Rules:

- `paper` is the only page background. Never introduce white panels.
- Selection/hover emphasis is always `tint`, never shadow or border color change.
- `tile` is reserved for tooltips and treemap tiles.
- Focus rings: `2px solid rgba(179,64,42,0.4)`, offset 2px.
- Selection highlight: `rgba(179,64,42,0.16)`.
- Scrollbars: thin, `control`-colored thumb on transparent track.

### 4.2 Category Series Tokens (stable)

A category keeps the same color in every surface: chart lines, table swatches, series panel, treemap tiles, Every 100 GEL cells, radar, budget field, ranking rows. IDs are stable and label-independent. These use the **actual repo taxonomy IDs**.

Expenditure (public spending fields):

```yaml
series:
  total: "#1E1B16"
  spending.social_protection: "#B3402A"
  spending.health: "#1F6E56"
  spending.education: "#3D5A98"
  spending.infrastructure_regional_development: "#B08A2E"
  spending.defence: "#7A4E8C"
  spending.public_order_safety: "#4A707A"
  spending.economic_affairs: "#C26E4C"
  spending.agriculture_environment: "#2F4B3A"
  spending.culture: "#9C3D5E"
  spending.sport: "#8A7B65"
  spending.general_public_services: "#5B5347"
  spending.debt_service: "#8C5A32"
  spending.other_unclassified: "#A89C88"
```

Revenue:

```yaml
series:
  revenue.vat: "#B3402A"
  revenue.income_tax: "#3D5A98"
  revenue.profit_tax: "#1F6E56"
  revenue.excise_tax: "#B08A2E"
  revenue.import_tax: "#C26E4C"
  revenue.property_tax: "#7A4E8C"
  revenue.other_taxes: "#8A7B65"
  revenue.grants: "#4A707A"
  revenue.other_revenue: "#9C3D5E"
  revenue.asset_decrease: "#2F4B3A"
  revenue.increase_liabilities: "#5B5347"
```

Ministries (administrative view) keep stable per-ministry assignments:

```yaml
series:
  admin_spending.health_social_affairs: "#B3402A"
  admin_spending.education_science_youth: "#3D5A98"
  admin_spending.regional_development_infrastructure: "#B08A2E"
  admin_spending.defence: "#7A4E8C"
  admin_spending.internal_affairs: "#4A707A"
  admin_spending.environment_agriculture: "#2F4B3A"
  admin_spending.economy_sustainable_development: "#C26E4C"
  admin_spending.justice: "#1F6E56"
  admin_spending.foreign_affairs: "#5B5347"
  admin_spending.finance: "#4E5D74"
  admin_spending.culture: "#9C3D5E"
  admin_spending.sport: "#8A7B65"
  admin_spending.debt_service: "#8C5A32"
  admin_spending.other_costs: "#A89C88"
```

Open-ended sets (major programs, any future ministry not listed) use index-based assignment cycling through the editorial palette:

```text
#B3402A #1F6E56 #3D5A98 #B08A2E #7A4E8C #4A707A #C26E4C #2F4B3A #9C3D5E #8A7B65 #5B5347 #8C5A32 #4E5D74 #A89C88
```

Rules:

- Never assign `accent` meaning beyond "active/negative" in UI chrome; as a series color it belongs only to the categories listed above.
- Never use color alone; pair with the 14×3px swatch bar, label, and value.

## 5. Typography

### 5.1 Font Stack

```yaml
fonts:
  display: "'Noto Serif Georgian', serif"
  ui: "'Noto Sans Georgian', 'Helvetica Neue', sans-serif"
  numeric: "'Geist Mono', monospace"
```

Weights: Noto Serif Georgian 400–700, Noto Sans Georgian 400–700, Geist Mono 400–600. In production, load via `next/font` (self-hosted), not a runtime Google Fonts `<link>`.

**Every numeral in a data context (values, years, %, axis labels, counts) is set in Geist Mono.** Serif is reserved for display: page title, section titles, KPI/headline values, treemap share values, brand. Sans covers everything else.

### 5.2 Type Scale

```yaml
type:
  page-title:      { font: display, size: 40px (30px mobile), weight: 600, ls: -0.01em, lh: 1.15 }
  hero-value:      { font: display, size: 62px (44px mobile), weight: 600, ls: -0.02em, lh: 1 }   # indicators hero KPI
  headline-value:  { font: display, size: 34px, weight: 600, ls: -0.02em, lh: 1.1 }  # analysis headline stats
  kpi-value:       { font: display, size: 24px, weight: 600, ls: -0.02em, lh: 1.1 }  # indicators side KPIs
  section-title:   { font: display, size: 22px, weight: 600, ls: -0.01em }
  brand:           { font: display, size: 18px, weight: 700, ls: -0.01em }
  subsection:      { font: ui, size: 13px, weight: 600 }
  row-label:       { font: ui, size: 12.5–13px, weight: 500 }
  body:            { font: ui, size: 13.5px, weight: 400, lh: 1.6 }
  caption:         { font: ui, size: 12px, weight: 400, color: muted, lh: 1.5–1.6 }
  overline:        { font: ui, size: 11px, weight: 600, uppercase, ls: 0.06–0.1em, color: muted }
  data:            { font: numeric, size: 12.5px, weight: 400–600 }
  data-meta:       { font: numeric, size: 10.5–11px, color: muted/faint }
  chart-axis:      { font: numeric, size: 10px, color: muted }
  deck-lead:       { font: numeric, size: 13px, weight: 500 }   # value line under the page title
```

Rules:

- Do not scale font sizes with viewport width beyond the specified mobile overrides.
- Negative letter-spacing only at ≥16px.
- Emphasis inside data = weight 600 (e.g. latest-year column), never color-only.
- Unit suffixes on serif values (`მლრდ ₾`) are mono 12–13px in `body` color, not serif.

## 6. Layout System

### 6.1 Page Shell

```yaml
page:
  background: paper
  maxWidth: "1240px"
  padding: "30px 28px 72px"   # mobile: "24px 20px 64px"
```

No screen card, no outer container. Content sits directly on paper.

### 6.2 Information Architecture

One page, three header nav tabs (hash-synced):

1. `ხარჯები` — multi-year expenditure explorer (fields/ministries grouping).
2. `შემოსავლები` — multi-year revenue explorer.
3. `ანალიზი` — single-year analysis view with its own side switch, grouping switch (expenditure only), and year selector.

Under the page title sits the **deck line**: a mono lead value (latest-year total for the explorer, `year · N კატეგორია · სულ X` for analysis) plus a colored YoY delta and the phrase `წინა წელთან`.

The header right slot shows a mono context label: selected range (`2005–2025`) in the explorer, selected year (`2025 წელი`) in analysis.

### 6.3 URL State (deep linking)

Screen state serializes into the URL hash so any view is shareable:

```text
#nav=expenditure&g=fields&m=line&sh=1&r=2005-2025&sel=id1,id2   (explorer)
#nav=analysis&as=expenditure&ag=ministries&ay=2024              (analysis)
```

Restore on load with validation (unknown values fall back to defaults; ranges clamp to loaded years).

### 6.4 Rule Hierarchy (replaces cards)

Sections are separated by horizontal rules, in three weights:

- `2px solid ink` — page header bottom, major section tops, table header bottom, table total-row top, aside top rule when stacked.
- `1px solid ink` — primary panel top (chart/table block).
- `1px solid hairline (#D9CFBE)` — sub-section separators, aside left border.
- `1px solid hairline-soft (#E7DECF)` — data row borders, chart grid.

Never nest a rule-framed block inside another rule-framed block with the same weight.

### 6.5 Spacing

```yaml
spacing:
  row-pad-comfortable: "11px 12px"   # table cells
  row-pad-compact: "8px 12px"
  section-gap: "48px"       # between major sections (with 2px rule + 22px padding-top)
  block-gap: "36px"         # sub-blocks inside a section (with 1px hairline + 24px padding-top)
  workspace-gap: "40px"     # chart column ↔ aside (32px stacked)
  grid-gap: "32px"          # KPI columns
```

### 6.6 Shape and Elevation Policy

- Border radius: **0–3px everywhere** (buttons 2px, tooltip 3px). Exception: the `% წილი` measure pill and slider handles/ticks use `999px`.
- Shadows: only the chart tooltip (`0 4px 16px rgba(30,27,22,0.10)`) and slider handles (`0 1px 3px rgba(30,27,22,0.15)`). Nothing else casts a shadow.
- Swatches are **14×3px bars**, never dots or rounded squares.

## 7. Core Components

Specs below are contracts; visual proof lives in the reference files.

### 7.1 Header / Nav

Baseline-aligned row: serif brand left (`GeoData`), nav tabs center, mono context label right; `2px ink` bottom rule. Nav tab: sans 13px; active = ink, weight 600, `2px accent` bottom border touching the header rule; inactive = muted, weight 500.

### 7.2 Mode / Grouping Tabs

Text-only, sans 12.5px; active = ink 600 with `text-decoration: underline`, 2px thickness, accent color, `text-underline-offset: 4px`. No backgrounds. Mode tabs: `ხაზი / ცხრილი`, in the chart controls row. In the **explorer**, the grouping tabs (`სფეროები / უწყებები`, expenditure only) live in the series aside, directly under the `სერიები` header row (gap 18px, 12px padding-bottom, 1px `row-border` bottom rule). In the **analysis view**, grouping tabs sit next to the side tabs, separated by a 1px×13px `control` vertical divider.

### 7.3 Measure Pill (% წილი)

Height 27px, pill radius, 1px `control` border, transparent bg, muted text. Active: ink bg, paper text, ink border, `aria-pressed`. This is the only pill in the system. Share = share of the side's total; there is no GDP measure.

### 7.4 Range Quick Chips (1წ / 5წ / 10წ / ყველა)

Mono 11px text links; active = ink 600 underlined (accent underline); inactive = muted 400. `5წ` shows only when >5 loaded years, `10წ` only when >10.

### 7.5 Range Slider

24px-high rail: 3px `hairline-soft` track, accent fill at 40% opacity between handles, 15px round handles (paper fill, 2px accent border, handle shadow). The rail is clean — no per-year tick dots. Handles are buttons with `role="slider"`, aria value attributes, and Arrow/Home/End keyboard support. Mono min/max year labels below.

### 7.6 Series Row (aside panel)

Row: 1px `row-border` bottom border; hover/selected bg `tint`; a 2px accent left rail marks expanded ministries and program rows. Toggle button (`aria-pressed`): 14px square checkbox (1.5px `control` border; checked = accent fill + paper ✓), swatch bar shown only when selected, sans 12.5/500 label clamped to 2 lines, latest value mono 11 muted right. Ministries rows add a caret button (`▸/▾`, `aria-expanded`) that expands the ministry's major programs; program rows are indented, sans 11.5/400 in `body` color. Program rows show names only — official program codes stay in the data layer (they fragment across reorganizations) and are not surfaced.

### 7.7 Search

Underline-only input: h34, no box, 1px `control` bottom border, transparent bg, sans 13px, radius 0. Placeholder in ministries grouping: `ძებნა — უწყება ან პროგრამა`. A query with no matches shows `0 შედეგი — შეცვალე საძიებო ტექსტი.` While searching in ministries grouping, ministries with matching programs auto-expand to show only matching programs.

### 7.8 CSV Button

Full-width block, h38, ink bg, paper text, sans 12.5/600, radius 2px. Hover: opacity 0.85. Label: `CSV ჩამოტვირთვა`. Must export exactly the visible filtered dataset with the metadata columns of §15.

### 7.9 Callout / Notice

Tint bg, `2px accent` left border, sans 11.5–12.5px, `body` color, max-width 560px. Used for series limit, empty selection, no-growth-data, and load-error states.

### 7.10 Source Note

Sans 12px, muted, plain paragraph under the primary panel and at the end of the analysis view. Pattern:

```text
მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო). <coverage note> · 12-თვიანი ფაქტობრივი შესრულება. ბოლო განახლება: YYYY-MM-DD.
```

Coverage notes state actual loaded ranges (e.g. `ხარჯვითი მონაცემები: 2005–2025`, `შემოსავლების მონაცემები: 2005–2025`).

### 7.11 KPI Block

No card: overline label, serif value, muted detail line. Two variants: analysis headlines (serif 34, four per row) and indicators side KPIs (serif 24, stacked with `hairline-soft` separators, value left / detail right on one baseline).

### 7.12 Hero KPI (indicators)

The first indicator (`პერიოდის ცვლილება`) is a hero block: overline, serif 62px value (accent-negative if the period change is negative), then a 3px two-segment gauge (ink = base year total share, accent = delta), mono `year · amount` labels at both ends, and an editorial sentence with mono-set delta and CAGR values:

```text
2005–2025 წლებში ჯამური ხარჯები გაიზარდა X მლრდ ₾-ით — საშუალო წლიური ზრდა +Y%.
```

### 7.13 Mover Row

Grid `24px 1fr 96px 72px`: mono rank (`01`), sans label (ellipsized), 3px horizontal bar (track `hairline-soft`, fill positive/negative color, width relative to max |change|), mono % right-aligned. Board = two columns: `ყველაზე მზარდი` / `ყველაზე ნელი ზრდა`. If a "bottom mover" is still positive growth, the copy stays `ყველაზე ნელი ზრდა` — never call growth a loss.

## 8. Multi-Year Explorer

Confirmed source: `GeoData Platform - Editorial v2.dc.html` (Explorer + Indicators screens).

### 8.1 Defaults

Side: expenditure. Grouping: fields. Mode: line. Measure: nominal GEL. Range: full available per scope. Selection: **top 5 categories by latest-year value** per scope (fields, ministries, and revenue each keep their own selection and range). Chart series limit: 6 (table mode unlimited; exceeding shows the callout). The derived total is not a selectable series — totals appear in the table `სულ` row, deck line, and hero KPI.

### 8.2 Layout

```yaml
workspace:
  display: grid
  columns: "minmax(0,1fr) 292px"   # <1100px: one column, aside below with 2px ink top rule
  gap: "40px"
```

Left: mode tabs + unit note + measure pill row → chart or table → range strip → source note. Right (aside, sticky, 1px hairline left border, 26px padding-left): `სერიები` overline + mono count (`n / 6` in line mode, `n` in table mode; count turns accent at the limit), grouping tabs (expenditure only, §7.2), search, series rows (scroll ≤430px), CSV button.

### 8.3 Line Chart

SVG on paper (no plot frame), viewBox 920×320: grid lines `hairline-soft`, baseline `1px ink` at zero, 1px `hairline` y-axis line; axis labels mono 10px muted (y labels right-aligned outside the plot, ~62px left padding); year labels thinned to ≤12 (first anchored start, last anchored end); series polylines 2.2px round-joined with a 3.5px dot on the final point only; no in-plot direct labels. Hover/pointer: 1px `control` vertical guide, ring markers (paper fill, 2px series stroke), tooltip (tile bg, 1px hairline border, radius 3, tooltip shadow, mono year + swatch/label/value rows; flips side past 60% width). `role="img"` + Georgian aria-label.

### 8.4 Table Mode

Columns: `<first col> | years… | ცვლილება | წილი <end-year>`. First column header by scope: `სფერო` (fields), `უწყება` (ministries), `საბიუჯეტო მუხლი` (revenue). Header: overline style, `2px ink` bottom rule. Rows: 1px `hairline-soft` borders, tint hover; swatch bar + sans label left; numerals mono right-aligned; latest-year column weight 600; change colored positive/negative (minus sign `−`). Total row `სულ`: `2px ink` top rule, weight 600, share `100.0%`. Horizontal scroll with sticky first column and sticky right change/share columns (paper bg, 1px `hairline-soft` edge shadows).

### 8.5 Below-Chart Sections (`ძირითადი ინდიკატორები`, order fixed)

1. Hero KPI (`პერიოდის ცვლილება`, §7.12) + three side KPIs (`ყველაზე დიდი ზრდა`, `ყველაზე ნელი ზრდა`, `ყველაზე დიდი წილი`) in a `1.35fr | 1fr` grid split by a hairline.
2. Movers board (top 3 / bottom 3 across all scope items).
3. `პერიოდის შედარება` — table `<first col> | start year | ცვლილება | end year`, total row first, fixed layout with 44% label column.

## 9. Single-Year Analysis (ანალიზი)

Confirmed source: `GeoData Platform - Editorial v2.dc.html` (Analysis screen). Order is fixed:

1. Side tabs (`ხარჯები / შემოსავლები`) + grouping tabs (expenditure only: `სფეროები / უწყებები`) + mono basis note.
2. Year selector.
3. Four headline stats.
4. `სტრუქტურა …` treemap — full width.
5. `ყოველი 100 ლარი` — grid + legend.
6. `ბიუჯეტის რადარი` — radar + numbered list.
7. `ბიუჯეტის ველი` — full width.
8. `სრული რეიტინგი`.
9. Source note.

### 9.1 Year Selector

Horizontal row of mono 12px year buttons (scrolls on narrow screens). Active: ink 600 + 2px accent underline. Planned year: mono superscript tag `გეგმა` in faint next to the label; keep the tag in the active state.

### 9.2 Headline Stats

Exactly four, in the KPI pattern (no cards, no gradients): overline label, serif 34px value with mono unit suffix, muted detail. Content: `სულ` (total + category count), `ყველაზე დიდი` (largest category + share), `ყველაზე სწრაფი ზრდა`, `ყველაზე დიდი მატება`. When no previous year exists, growth cells show `—` with detail `წინა წლის მონაცემები არ არის`.

### 9.3 Structure Treemap

Production computes a **squarified treemap** over a `1000×430` unit area rendered at `aspect-ratio: 1000/430`, sorted by value descending. Title by scope: `სტრუქტურა სფეროების მიხედვით` / `სტრუქტურა უწყებების მიხედვით` / `სტრუქტურა კატეგორიების მიხედვით`.

Tile: `tile` bg, 1px `hairline` border, **3px category-color top bar**, radius 0, padding 9px 11px. Content: serif share % (22px at ≥8% share, 16px at ≥3.3%, 12px at ≥1.4%, hidden below), sans label 12/500 (shown ≥3.3%), mono amount 11 muted (shown ≥8%). Hover: tint bg; no lift, no shadow. Categories too small to label render as bare tiles and are listed in a small swatch legend below the treemap. Full detail lives in the `title` tooltip. No drilldown.

### 9.4 Every 100 GEL

Exactly 100 square cells, 10×10 grid, `gap: 5px`, `width: min(100%, 560px)`, radius 0, category colors, allocations rounded to whole GEL summing to 100 (largest remainder method). A legend column sits beside the grid on wide screens (wraps below on narrow): swatch bar + label + mono `n ₾` per category. Caption notes the rounding rule and how many categories round to 0 ₾.

### 9.5 Budget Radar

Radar + list grid (`1fr 300px`, stacks on narrow). Radar: single polygon of top-level category shares, top 7 + `სხვა` when more than 8 categories; rings + spokes `hairline-soft` 1px; polygon `2px accent` stroke with `rgba(179,64,42,0.12)` fill; 3px vertex dots in category colors; **mono two-digit index labels** (`01`…) around the rim. The list beside repeats the indices with swatch, label, and mono share. Visual-only — exact values live in the ranking.

### 9.6 Budget Field

Bubble scatter, viewBox 920×380: x = share of total, y = growth vs previous year, radius = `7 + sqrt(value/max)·40`, color = category token (fill at 18% opacity + 1.5px solid stroke). Zero-growth line `1px ink`; grid `hairline-soft`; y-axis line `hairline`; axis labels mono 10px. Labels (sans 11px, `body`) only on the top 3 by amount plus |change| ≥ 20% outliers, with overlap avoidance; full values in `title` tooltips. If previous-year data is missing, show the callout: `წინა წლის მონაცემები არ არის ხელმისაწვდომი — ზრდის მაჩვენებლები ამ წლისთვის ვერ გამოჩნდება. აირჩიე უფრო გვიანი წელი.`

### 9.7 Full Ranking

Table columns: `<scope header> | მლრდ ₾ | წილი | ცვლილება`, sorted by GEL descending, top-level categories of the active grouping only. Rank as mono `01`-style index + swatch + label; a 120px 3px share bar (category color on `hairline-soft` track) next to the mono share; change colored positive/negative. Same table anatomy as §8.4 including sticky first column on horizontal scroll.

## 10. Revenue Adaptation

No separate revenue direction. Same shell, tokens, controls, chart/table treatment, analysis order, CSV and source patterns. Change only labels, taxonomy, revenue series tokens (§4.2), source wording, tooltips, CSV metadata.

## 11. Content and Copy

Voice: precise, civic, archival. Georgian is primary; English only for compact technical labels (`CSV`).

Canonical terms: `ხარჯები`, `შემოსავლები`, `ანალიზი`, `სერიები`, `ხაზი`, `ცხრილი`, `სფეროები`, `უწყებები`, `% წილი`, `დიაპაზონი`, `სულ`, `ძირითადი ინდიკატორები`, `პერიოდის ცვლილება`, `ყველაზე მზარდი`, `ყველაზე ნელი ზრდა`, `პერიოდის შედარება`, `სტრუქტურა სფეროების მიხედვით`, `ყოველი 100 ლარი`, `ბიუჯეტის რადარი`, `ბიუჯეტის ველი`, `სრული რეიტინგი`, `CSV ჩამოტვირთვა`, `გეგმა`.

Units always shown: `მლრდ ₾`, `მლნ ₾`, `%`. Numbers use `en-US` grouping, fixed decimals (bn: 2, mln: 1, %: 1). Amounts ≥ ~1bn display in `მლრდ ₾`, below in `მლნ ₾`. Negative sign is `−` (minus, not hyphen) in deltas.

Page titles are editorial sentences, not labels: `როგორ იხარჯება საქართველოს ბიუჯეტი`, `როგორ ივსება საქართველოს ბიუჯეტი`, `<year> წლის ბიუჯეტის სურათი — სად მიდის საჯარო ფული / საიდან მოდის საჯარო ფული`.

Empty/error copy explains what happened and what to do, e.g.:

```text
არც ერთი სერია არ არის არჩეული. აირჩიე სერია პანელიდან „სერიები“.
გრაფიკზე მაქსიმუმ 6 სერია შეიძლება. ცხრილის რეჟიმში ლიმიტი არ არის.
მონაცემები ვერ ჩაიტვირთა. განაახლე გვერდი — თუ პრობლემა გაგრძელდება, სცადე მოგვიანებით.
```

## 12. Responsive Behavior

```yaml
breakpoints:
  desktop: ">= 1100px"
  tablet: "768px – 1099px"
  mobile: "< 768px"
```

At `<1100px`: workspace becomes one column; aside moves below the chart, loses its left border, gains a `2px ink` top rule; headline stats/KPIs become two columns; hero + side KPIs stack (side column gains a hairline top rule); movers board stacks; radar/every-100 side lists wrap below.

Mobile (<768px): page padding `24px 20px 64px`; page title 30px; hero value 44px; year selector scrolls horizontally; tables scroll horizontally (min-width preserved, sticky columns active); Every 100 GEL stays 10×10 — shrink cells, never cell count; controls ≥30px tall (prefer 36px+).

Breakpoint behavior keys off the page container width (ResizeObserver or CSS container/media queries), matching the reference prototype.

## 13. Accessibility

- All controls have accessible names; toggles expose pressed/selected state (`aria-pressed`, `aria-expanded`); slider handles expose `role="slider"` with value attributes and keyboard support.
- SVG charts: `role="img"` + Georgian accessible label; SVG-only data must also exist in table/tooltip/summary.
- Focus visible (accent ring) on paper.
- Never color-only meaning: swatch + label + value.
- Respect `prefers-reduced-motion`.
- Chart labels ≥10px mono only for axes; interactive text ≥12px; body ≥12px.
- Contrast: `muted` (#6A6050) on paper is the minimum for meaningful text; `faint` is decoration/metadata only.

## 14. Motion

```yaml
motion:
  fast: "120ms"
  base: "150ms"
  easing: "ease"
```

Only color, background, border-color, and opacity transition. No transforms, no lifts, no decorative loops. Nothing animates on load.

## 15. Data and Trust Presentation

Every analytical view exposes: active side, view, year/period, unit, measure, source note. Planned years get the `გეგმა` tag near the year context and a subtle marker in charts. When planned and actual both exist, actual wins in UI and CSV.

CSV metadata columns: `year, category_id, parent_item_id, level, detail_label, official_institution_label, ka_label, en_label, amount_gel, basis, source_name, source_url_or_file, last_reviewed_at`.

## 16. Implementation Tokens

```css
:root {
  --paper: #F7F2E9;
  --tint: #F1EADC;
  --tile: #FDFAF3;
  --ink: #1E1B16;
  --body: #55503F;
  --muted: #6A6050;
  --faint: #A89C88;
  --hairline: #D9CFBE;
  --hairline-soft: #E7DECF;
  --row-border: #EDE4D3;
  --control: #C9BEA9;
  --accent: #B3402A;
  --positive: #1F6E56;
  --negative: #B3402A;
  --font-display: 'Noto Serif Georgian', serif;
  --font-ui: 'Noto Sans Georgian', 'Helvetica Neue', sans-serif;
  --font-numeric: 'Geist Mono', monospace;
}
```

## 17. Do / Do Not

Do:

- Structure pages with the rule hierarchy; keep content directly on paper.
- Set every data numeral in Geist Mono; every display value in Noto Serif Georgian.
- Keep category colors stable across all surfaces via §4.2 tokens.
- Keep the single measure toggle (`% წილი`) as the only pill.
- Keep the analysis sections in the fixed order of §9.
- Reuse the identical system for revenue.
- Keep the CSV button visible and bound to active filters.
- Show source/update context on every analytical view.
- Derive every year range from loaded data.

Do not:

- No cards, panels with backgrounds, container shadows, or radii above 3px (pill exceptions only).
- No white surfaces; no gradients anywhere.
- No blue `#0071e3` or any v3.x Apple token; no night theme or theme toggle.
- No dots/rounded-square swatches — bars only.
- No bar/stacked chart modes; only `ხაზი` and `ცხრილი`.
- No GDP-share measure; `% წილი` is share of the side total.
- No official program codes in the series panel (names only).
- No emoji, no decorative icons; the system is typographic (caret `▸/▾` and checkmark `✓` glyphs are part of the control language).
- No drilldown anywhere.

## 18. Design QA Checklist

1. Page is paper-backed with no cards or shadows (tooltip/slider-handle exceptions only).
2. Header has the 2px ink rule; major sections open with 2px rules; nav has exactly three tabs.
3. All numerals are mono; all display values serif; overlines uppercase sans 11/600.
4. Explorer default: line mode, nominal GEL, full range, top-5 selection, 6-series chart limit with callout.
5. Only `ხაზი` and `ცხრილი` modes exist; `% წილი` is the only pill.
6. Swatches are 14×3px bars everywhere.
7. Category colors match §4.2 on every surface.
8. Analysis order: controls → year selector → 4 headlines → structure → 100 GEL → radar → field → ranking → source.
9. Every 100 GEL renders exactly 100 cells, allocations sum to 100.
10. Headline stats are exactly four, card-free.
11. CSV exports the visible filtered dataset with metadata columns.
12. Source note present with actual coverage ranges; planned years tagged `გეგმა` when planned data exists.
13. Georgian labels don't clip at any breakpoint.
14. Revenue reuses the identical system.
15. Ministries grouping works in both explorer (with program expansion) and analysis (categories only).
16. URL hash round-trips: reloading a deep link restores nav, grouping, mode, share, range, selection, and analysis year.
17. No v3.x (Apple) or older terminal/neon styling anywhere.
