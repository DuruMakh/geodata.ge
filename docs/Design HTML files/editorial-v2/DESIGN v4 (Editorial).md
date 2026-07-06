# GeoData.ge Design System — Editorial

Version: 4.0
Last updated: 2026-07-03
Status: Production visual system for GeoData.ge Budget Explorer v1
Scope: Budget Explorer product UI, charts, tables, controls, export surfaces, responsive behavior, and future pages that reuse the Budget Explorer shell.

---

## 1. Source of Truth

This file defines the production design system for GeoData.ge v1. It **replaces DESIGN.md v3.0 (the Apple-like Light/Night system) in full**. The editorial direction is now the approved production direction.

Confirmed visual references:

- `Budget Explorer - Editorial (approved).dc.html` — multi-year explorer (chart, table, series panel, range strip, KPIs, movers, period comparison).
- `Editorial Design System — Reference.dc.html` — component reference sheet, including the single-year surfaces (year selector, headline stats, structure treemap, Every 100 GEL, budget radar, budget field, full ranking).

Confirmed product references:

- `Project_Definition.md`

If this file and the confirmed reference files disagree, prefer the reference files for visual details and update this file immediately.

Superseded and must not appear in production:

- The Apple-like Light/Night system (DESIGN.md v3.0), including `#0071e3` primary, card/shadow surfaces, 24px radii, gradient headline cards, and the SF Pro stack.
- Crypto/terminal, neon, and marketing-homepage directions.

## 2. Product Scope Boundary

GeoData.ge v1 is a Georgian-first national budget explorer for annual data (expenditure 2004–2025, revenue 2005–2025). It is not a broad public-data catalog.

V1 includes: multi-year explorer (line + table), single-year snapshot, CSV export, Georgian-first UI, minimal public source label, internal provenance metadata.

V1 excludes: data catalog, municipal/capital/debt explorers, admin UI, public API, uploads, sub-annual data, automated document extraction, clickable drilldown pages.

Every visual decision should support a focused budget product, not a generic dashboard.

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

**One theme in v1: editorial paper (light).** There is no night theme. If a night variant is ever approved, it must keep identical layout, section order, chart geometry, and controls, changing tokens only.

### 4.1 Role Tokens

```yaml
colors:
  paper: "#F7F2E9"        # page background; the only canvas
  tint: "#F1EADC"         # hover rows, selected rows, callout background
  tile: "#FDFAF3"         # tooltip and treemap tile fill (only "raised" surface)
  ink: "#1E1B16"          # primary text, strong rules, total series
  body: "#55503F"         # secondary data text
  muted: "#7A7060"        # labels, captions, inactive controls
  faint: "#A89C88"        # metadata, axis labels, disabled
  hairline: "#D9CFBE"     # section sub-rules, aside border
  hairline-soft: "#E7DECF" # row borders, chart grid, bar tracks
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

### 4.2 Category Series Tokens (stable)

A category keeps the same color in every surface: chart lines, table swatches, series panel, treemap tiles, Every 100 GEL cells, radar, budget field, ranking rows. IDs are stable and label-independent.

Expenditure:

```yaml
series:
  total: "#1E1B16"
  spending.social_protection: "#B3402A"
  spending.health: "#1F6E56"
  spending.education: "#3D5A98"
  spending.infrastructure: "#B08A2E"
  spending.defence: "#7A4E8C"
  spending.public_order: "#4A707A"
  spending.economic_affairs: "#C26E4C"
  spending.agriculture_environment: "#2F4B3A"
  spending.culture: "#9C3D5E"
  spending.sport: "#8A7B65"
  spending.general_services: "#5B5347"
  spending.debt_service: "#8C5A32"
  spending.other: "#A89C88"
```

Revenue (same hue family, stable per category):

```yaml
series:
  revenue.vat: "#B3402A"
  revenue.income_tax: "#3D5A98"
  revenue.profit_tax: "#1F6E56"
  revenue.excise: "#B08A2E"
  revenue.import_tax: "#C26E4C"
  revenue.property_tax: "#7A4E8C"
  revenue.other_taxes: "#8A7B65"
  revenue.grants: "#4A707A"
  revenue.other_revenue: "#9C3D5E"
  revenue.nonfinancial_assets: "#2F4B3A"
  revenue.financial_assets: "#5B5347"
  revenue.liabilities: "#A89C88"
```

Rules:

- Never assign `accent` meaning beyond "active/negative" in UI chrome; as a series color it belongs only to `spending.social_protection` / `revenue.vat`.
- Never use color alone; pair with the 14×3px swatch bar, label, and value.
- Official-hierarchy series (ministries/programs) selected in the explorer may use index-based assignment from the full palette above, in order, since their set is open-ended.

## 5. Typography

### 5.1 Font Stack

```yaml
fonts:
  display: "'Noto Serif Georgian', serif"
  ui: "'Noto Sans Georgian', 'Helvetica Neue', sans-serif"
  numeric: "'Geist Mono', monospace"
```

Load via Google Fonts: Noto Serif Georgian 400–700, Noto Sans Georgian 400–700, Geist Mono 400–600.

**Every numeral in a data context (values, years, %, axis labels, counts) is set in Geist Mono.** Serif is reserved for display: page title, section titles, KPI/headline values, brand. Sans covers everything else.

### 5.2 Type Scale

```yaml
type:
  page-title:      { font: display, size: 40px, weight: 600, ls: -0.01em, lh: 1.15 }
  section-title:   { font: display, size: 22px, weight: 600, ls: -0.01em }
  headline-value:  { font: display, size: 34px, weight: 600, ls: -0.02em, lh: 1.1 }  # single-year headline stats
  kpi-value:       { font: display, size: 30px, weight: 600, ls: -0.02em, lh: 1.1 }
  brand:           { font: display, size: 18px, weight: 700, ls: -0.01em }
  subsection:      { font: ui, size: 13px, weight: 600 }
  row-label:       { font: ui, size: 12.5–13px, weight: 500 }
  body:            { font: ui, size: 13.5px, weight: 400, lh: 1.6 }
  caption:         { font: ui, size: 12px, weight: 400, color: muted, lh: 1.5–1.6 }
  overline:        { font: ui, size: 11px, weight: 600, uppercase, ls: 0.06–0.1em, color: muted }
  data:            { font: numeric, size: 12.5px, weight: 400–600 }
  data-meta:       { font: numeric, size: 10.5–11px, color: faint }
  chart-axis:      { font: numeric, size: 10px, color: faint }
```

Rules:

- Do not scale font sizes with viewport width.
- Negative letter-spacing only at ≥16px.
- Emphasis inside data = weight 600 (e.g. latest-year column), never color-only.

## 6. Layout System

### 6.1 Page Shell

```yaml
page:
  background: paper
  maxWidth: "1240px"
  padding: "30px 28px 72px"
```

No screen card, no outer container. Content sits directly on paper.

### 6.2 Rule Hierarchy (replaces cards)

Sections are separated by horizontal rules, in three weights:

- `2px solid ink` — page header bottom, major section tops, table header bottom, table total-row top.
- `1px solid ink` — primary panel top (chart/table block).
- `1px solid hairline (#D9CFBE)` — sub-section separators, aside left border.
- `1px solid hairline-soft (#E7DECF)` — data row borders, chart grid.

Never nest a rule-framed block inside another rule-framed block with the same weight.

### 6.3 Spacing

```yaml
spacing:
  row-pad-comfortable: "11px 12px"   # table cells
  row-pad-compact: "8px 12px"
  section-gap: "48px"       # between major sections (with 2px rule + 22px padding-top)
  block-gap: "36px"         # sub-blocks inside a section (with 1px hairline + 24px padding-top)
  workspace-gap: "40px"     # chart column ↔ aside
  grid-gap: "32px"          # KPI columns
```

### 6.4 Shape and Elevation Policy

- Border radius: **0–3px everywhere** (buttons 2px, tooltip 3px). Exception: the `% წილი` measure pill and slider handles/ticks use `999px`.
- Shadows: only the chart tooltip (`0 4px 16px rgba(30,27,22,0.10)`) and slider handles (`0 1px 3px rgba(30,27,22,0.15)`). Nothing else casts a shadow.
- Swatches are **14×3px bars**, never dots or rounded squares.

## 7. Core Components

Specs below are contracts; visual proof lives in the reference sheet.

### 7.1 Header / Nav

Baseline-aligned row: serif brand left, nav tabs center, mono range label right; `2px ink` bottom rule. Nav tab: sans 13px; active = ink, weight 600, `2px accent` bottom border touching the header rule; inactive = muted, weight 500.

### 7.2 Mode Tabs (ხაზი / ცხრილი)

Text-only, sans 12.5px; active = ink 600 with `text-decoration: underline`, 2px thickness, accent color, `text-underline-offset: 4px`. No backgrounds.

### 7.3 Measure Pill (% წილი)

Height 27px, pill radius, 1px `control` border, transparent bg, muted text. Active: ink bg, paper text, ink border. This is the only pill in the system.

### 7.4 Range Quick Chips (1წ / 5წ / ყველა)

Mono 11px text links; active = ink 600 underlined (accent underline); inactive = faint 400.

### 7.5 Range Slider

24px-high rail: 3px `hairline-soft` track, accent fill at 40% opacity between handles, 5px round year ticks (paper inside range, hairline outside), 15px round handles (paper fill, 2px accent border, handle shadow). Mono min/max year labels below.

### 7.6 Series Row (aside panel)

Grid `auto 1fr auto`, gap 10px, 1px `#EDE4D3` bottom border. 14px square checkbox (1.5px `control` border; checked = accent fill + paper ✓). Swatch bar shown only when selected. Label sans 12.5/500 ellipsized; latest value mono 11 faint. Hover/selected bg = tint.

### 7.7 Search

Underline-only input: h34, no box, 1px `control` bottom border, transparent bg, sans 13px. No icons.

### 7.8 CSV Button

Full-width block, h38, ink bg, paper text, sans 12.5/600, radius 2px. Hover: opacity 0.85. Label: `CSV ჩამოტვირთვა`. Must export exactly the visible filtered dataset.

### 7.9 Callout / Notice

Tint bg, `2px accent` left border, sans 11.5px, `body` color. Used for limits and empty/error states.

### 7.10 Source Note

Sans 12px, faint color, plain paragraph under the primary panel:
`მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო). ბოლო განახლება: YYYY-MM-DD.`

### 7.11 KPI Block

No card: overline label, serif 30px value, 12px muted detail line. Four per row, gap 32px.

### 7.12 Mover Row

Grid `24px 1fr 96px 72px`: mono rank (`01`), sans label, 3px horizontal bar (track `hairline-soft`, fill positive/negative color), mono % right-aligned. Board = two columns: `ყველაზე მზარდი` / `ყველაზე ნელი ზრდა`.

## 8. Multi-Year Explorer

Confirmed source: `Budget Explorer - Editorial (approved).dc.html`.

### 8.1 Defaults

Side: expenditure. Mode: line. Measure: nominal GEL. Range: full available. Selection: top 5 categories by latest year. Chart series limit: 6 (table mode unlimited; exceeding shows the callout).

### 8.2 Layout

```yaml
workspace:
  display: grid
  columns: "minmax(0,1fr) 292px"
  gap: "40px"
```

Left: mode tabs + unit note + measure pill row → chart or table → range strip → source note. Right (aside, sticky, 1px hairline left border, 26px padding-left): `სერიები` overline + mono count (`n / 6`), search, series rows (scroll ≤430px), CSV button.

### 8.3 Line Chart

SVG on paper (no plot frame): grid lines `hairline-soft`, baseline `1px ink`; axis labels mono 10px faint; series polylines 2.2px round-joined with 3.5px end dot; no in-plot direct labels. Hover: 1px `control` vertical guide, ring markers (paper fill, 2px series stroke), tooltip (tile bg, 1px hairline border, radius 3, tooltip shadow, mono year + swatch/label/value rows).

### 8.4 Table Mode

Columns: `საბიუჯეტო მუხლი | years… | ცვლილება | წილი <end-year>`. Header: overline style, `2px ink` bottom rule. Rows: 1px `hairline-soft` borders, tint hover; swatch bar + sans label left; numerals mono right-aligned; latest-year column weight 600; change colored positive/negative. Total row: `2px ink` top rule, weight 600. Horizontal scroll below 860px content width.

### 8.5 Below-Chart Sections (order fixed)

1. `ძირითადი ინდიკატორები` — four KPI blocks.
2. Movers board (top 3 / bottom 3).
3. `პერიოდის შედარება` — formula table `start | ცვლილება | end`, total row first.

## 9. Single-Year Snapshot

Confirmed source: `Editorial Design System — Reference.dc.html`. Order is fixed:

1. Year selector
2. Four headline stats
3. `სტრუქტურა სფეროების მიხედვით` (treemap) — full width
4. `ყოველი 100 ლარი` — full width, below structure (never side-by-side)
5. `ბიუჯეტის რადარი`
6. `ბიუჯეტის ველი`
7. `სრული რეიტინგი`

### 9.1 Year Selector

Horizontal row of mono 12px year labels (scrolls on narrow screens). Active: ink 600 + 2px accent underline (offset 6px). Planned year: mono superscript tag `გეგმა` in faint next to the label; keep the tag in the active state.

### 9.2 Headline Stats

Exactly four, in the KPI pattern (no cards, no gradients): overline label, serif 34px value, muted detail. Content: total amount; largest category; fastest growth; largest GEL increase.

### 9.3 Structure Treemap

Editorial composition grid (production may compute a true treemap but must preserve hierarchy):

```yaml
treemap:
  columns: "1.1fr .72fr .52fr"
  rows: "150px 112px 94px"
  gap: "12px"
```

Tile: `tile` bg, 1px `hairline` border, **3px category-color top bar**, radius 0. Content: serif share % (22px, 16px on small tiles), sans label 12/500, mono amount 11 faint (hidden on small tiles). Largest category may span two rows. Hover: tint bg; no lift, no shadow. No drilldown.

### 9.4 Every 100 GEL

Exactly 100 square cells, 10×10 grid, `gap: 5px`, `width: min(100%, 560px)`, radius 0, category colors, allocations rounded to whole GEL summing to 100. Legend below: swatch bar + label + mono cell count per category. No adjacent list.

### 9.5 Budget Radar

Single polygon of top-level category shares. Grid rings + spokes `hairline-soft` 1px; polygon `2px accent` stroke, accent fill at 12% opacity, 3px vertex dots in category colors; labels mono 10px faint. Visual-only; if >8 categories, use top categories + `სხვა`.

### 9.6 Budget Field

Bubble scatter: x = share of total, y = growth vs previous year, size = GEL amount, color = category token (fill at 18% opacity + 1.5px solid stroke). Axes: baseline and zero-growth line `1px ink`; grid `hairline-soft`; axis labels mono 10px. Labels only on notable/selected bubbles (sans 11px). If previous-year data is missing, show an explicit no-growth-data state.

### 9.7 Full Ranking

Table columns: `სფერო | GEL | წილი | ცვლილება`, sorted by GEL descending, top-level categories only. Same table anatomy as 8.4, plus a 3px share bar in the წილი column.

## 10. Revenue Adaptation

No separate revenue direction. Same shell, tokens, controls, chart/table treatment, single-year order, CSV and source patterns. Change only labels, taxonomy, revenue series tokens (§4.2), source wording, tooltips, CSV metadata. Georgian labels for the three budget-classification categories must be confirmed from source documents before release.

## 11. Content and Copy

Voice: precise, civic, archival. Georgian is primary; English only for compact technical labels (`CSV`).

Canonical terms: `ხარჯები`, `შემოსავლები`, `ანალიზი`, `სერიები`, `ხაზი`, `ცხრილი`, `% წილი`, `დიაპაზონი`, `სულ`, `ძირითადი ინდიკატორები`, `ყველაზე მზარდი`, `ყველაზე ნელი ზრდა`, `პერიოდის შედარება`, `სტრუქტურა სფეროების მიხედვით`, `ყოველი 100 ლარი`, `ბიუჯეტის რადარი`, `ბიუჯეტის ველი`, `სრული რეიტინგი`, `CSV ჩამოტვირთვა`, `გეგმა`.

Units always shown: `მლრდ ₾`, `მლნ ₾`, `%`. Numbers use `en-US` grouping, fixed decimals (bn: 2, mln: 1, %: 1). Negative sign is `−` (minus, not hyphen) in deltas.

Page titles are editorial sentences, not labels: `როგორ იხარჯება საქართველოს ბიუჯეტი`, `როგორ ივსება საქართველოს ბიუჯეტი`.

Empty/error copy explains what happened and what to do:
`ამ არჩევანისთვის მონაცემები არ არის ხელმისაწვდომი. შეცვალე წელი ან გაასუფთავე ფილტრები.`

## 12. Responsive Behavior

```yaml
breakpoints:
  desktop: ">= 1100px"
  tablet: "768px – 1099px"
  mobile: "< 768px"
```

At `<1100px`: workspace becomes one column; aside moves below the chart, loses its left border, gains a `2px ink` top rule; headline stats/KPIs become two columns; movers board stacks; comparison rows stack.

Mobile: year selector scrolls horizontally; tables scroll horizontally (min-width preserved); Every 100 GEL stays 10×10 — shrink cells, never cell count; treemap may reduce to a stacked grid if labels would clip; controls ≥30px tall (prefer 36px+); page padding 20px.

## 13. Accessibility

- All controls have accessible names; toggles expose pressed/selected state.
- SVG charts: `role="img"` + accessible label; SVG-only data must also exist in table/tooltip/summary.
- Focus visible (accent ring) on paper.
- Never color-only meaning: swatch + label + value.
- Respect `prefers-reduced-motion`.
- Chart labels ≥10px mono only for axes; interactive text ≥12px; body ≥12px.
- Contrast: `muted` (#7A7060) on paper is the minimum for meaningful text; `faint` is decoration/metadata only.

## 14. Motion

```yaml
motion:
  fast: "120ms"
  base: "150ms"
  easing: "ease"
```

Only color, background, border-color, and opacity transition. No transforms, no lifts, no decorative loops. Theme-free system: nothing animates on load.

## 15. Data and Trust Presentation

Every analytical view exposes: active side, view, year/period, unit, measure, source note. Planned years get the `გეგმა` tag near the year context and a subtle marker in charts. When planned and actual both exist, actual wins in UI and CSV.

CSV metadata columns: `year, category_id, ka_label, en_label, amount_gel, basis, source_name, source_url_or_file, last_reviewed_at`.

## 16. Implementation Tokens

```css
:root {
  --paper: #F7F2E9;
  --tint: #F1EADC;
  --tile: #FDFAF3;
  --ink: #1E1B16;
  --body: #55503F;
  --muted: #7A7060;
  --faint: #A89C88;
  --hairline: #D9CFBE;
  --hairline-soft: #E7DECF;
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
- Keep single-year sections in the fixed order, structure and Every 100 GEL stacked.
- Reuse the identical system for revenue.
- Keep the CSV button visible and bound to active filters.
- Show source/update context on every analytical view.

Do not:

- No cards, panels with backgrounds, container shadows, or radii above 3px (pill exceptions only).
- No white surfaces; no gradients anywhere.
- No blue `#0071e3` or any v3.0 Apple token.
- No dots/rounded-square swatches — bars only.
- No night theme in v1; no theme toggle in the UI.
- No bar/stacked chart modes; only `ხაზი` and `ცხრილი`.
- No list beside Every 100 GEL; no drilldown anywhere.
- No emoji, no decorative icons; the system is typographic.

## 18. Design QA Checklist

1. Page is paper-backed with no cards or shadows (tooltip/slider-handle exceptions only).
2. Header has the 2px ink rule; major sections open with 2px rules.
3. All numerals are mono; all display values serif; overlines uppercase sans 11/600.
4. Multi-year default: line mode, nominal GEL, full range, top-5 selection, 6-series chart limit with callout.
5. Only `ხაზი` and `ცხრილი` modes exist; `% წილი` is the only pill.
6. Swatches are 14×3px bars everywhere.
7. Category colors match §4.2 on every surface.
8. Single-year order: selector → 4 headline stats → structure → Every 100 GEL → radar → field → ranking.
9. Every 100 GEL renders exactly 100 cells, allocations sum to 100.
10. Headline stats are exactly four, card-free.
11. CSV exports the visible filtered dataset with metadata columns.
12. Source note present; planned years tagged `გეგმა`.
13. Georgian labels don't clip at any breakpoint.
14. Revenue reuses the identical system.
15. No v3.0 (Apple) or older terminal/neon styling anywhere.
