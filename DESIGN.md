# GeoData.ge Design System

Version: 3.0  
Last updated: 2026-05-27  
Status: Production-ready visual system for GeoData.ge Budget Explorer v1  
Scope: Budget Explorer product UI, charts, tables, controls, export surfaces, responsive behavior, and future pages that reuse the Budget Explorer shell.

---

## 1. Source of Truth

This file defines the production design system for GeoData.ge v1. It replaces earlier visual directions and must be treated as the implementation contract for the Budget Explorer UI.

Confirmed visual references:

- `docs/Design HTML files/multiyear-apple.html`
- `docs/Design HTML files/singleyear-apple.html`

Confirmed product references:

- `Project_Definition.md`
- `docs/superpowers/specs/2026-05-10-geodata-budget-v1-design.md`

The HTML files define visual layout, spacing, controls, theme behavior, chart treatment, and component composition. This `DESIGN.md` turns those confirmed pages into a reusable design system for production React components.

If this file and the confirmed HTML disagree, prefer the confirmed HTML for visual details and update this file immediately.

---

## 2. Product Scope Boundary

GeoData.ge v1 is a Georgian-first national budget explorer for annual data. It is not a broad public-data catalog.

V1 includes:

- Annual national budget data for 2023-2025.
- Expenditure and revenue modes.
- Multi-year explorer.
- Single-year snapshot.
- CSV export.
- Georgian-first UI.
- Minimal public source label.
- Internal source and provenance metadata.

V1 excludes:

- Broad public data catalog.
- Municipal transfers explorer.
- Capital projects explorer.
- Debt explorer.
- Admin UI.
- Public API.
- User uploads.
- Quarterly or monthly data.
- Automated production extraction from DOCX/PDF.
- Clickable drilldown/detail pages.

Design implication: every visual decision should support a focused budget product, not a generic data platform.

---

## 3. Design Direction

The confirmed direction is a clean analytical Budget Explorer: spacious, precise, Georgian-first, and data-led. It uses an Apple-like product calm without becoming a generic SaaS dashboard.

Core atmosphere:

- Clean public finance instrument.
- High-trust analytical workspace.
- Spacious cards and restrained borders.
- Two complete themes: Light and Night.
- Stable category colors across charts, tables, treemaps, and summary visuals.
- Clear year, unit, source, and export context.

The system should feel:

- Civic but not bureaucratic.
- Analytical but not dense by default.
- Polished but not decorative.
- Georgian-first but easy to extend to bilingual UI later.

Do not reintroduce previous unconfirmed directions into production:

- No crypto/terminal visual layer as the default UI.
- No warm editorial atlas system.
- No neon pink primary system.
- No separate revenue visual style.
- No marketing-first homepage pattern for v1.

---

## 4. Theme System

GeoData.ge has two themes with one shared structure:

- `light`: default public-facing theme.
- `night`: same layout, darker surfaces, same data colors.

The theme switch changes tokens only. It must not change layout, section order, chart geometry, or available controls.

### 4.1 Core Color Tokens

```yaml
colors:
  primary: "#0071e3"
  primary-active: "#0077ed"

  series:
    total: "#0071e3"
    social-protection: "#ffd60a"
    health: "#30d5c8"
    education: "#0a84ff"
    infrastructure: "#ff9f0a"
    defence: "#bf5af2"
    other: "#8e8e93"

  semantic:
    success: "#34c759"
    warning: "#ffd60a"
    error: "#ff453a"
    info: "#0071e3"
    unavailable: "#8e8e93"
```

### 4.2 Light Theme Tokens

```yaml
light:
  canvas: "#f5f5f7"
  surface: "#ffffff"
  soft: "#fafafa"
  strong: "#e8e8ed"
  chart: "#ffffff"
  hairline: "#e8e8ed"
  hairline-soft: "#f5f5f7"
  ink: "#1d1d1f"
  body: "#515154"
  mute: "#86868b"
  grid: "#f5f5f7"
  shadow: "rgba(0, 0, 0, 0.04)"
  on-primary: "#ffffff"
```

### 4.3 Night Theme Tokens

```yaml
night:
  canvas: "#000000"
  surface: "#1d1d1f"
  soft: "#161617"
  strong: "#323236"
  chart: "#1d1d1f"
  hairline: "#323236"
  hairline-soft: "#2d2d2f"
  ink: "#f5f5f7"
  body: "#a1a1a6"
  mute: "#86868b"
  grid: "#161617"
  shadow: "rgba(0, 0, 0, 0.6)"
  on-primary: "#ffffff"
```

### 4.4 Single-Year Headline Card Gradients

Use these only for the four single-year headline cards. Do not use them as generic page backgrounds.

```yaml
headlineCards:
  light:
    card1Background: "linear-gradient(135deg, #fffcf0, #fff7d6)"
    card1Border: "#ffe599"
    card2Background: "linear-gradient(135deg, #fff5f2, #ffe6e0)"
    card2Border: "#ffccbe"
    card3Background: "linear-gradient(135deg, #f9f5ff, #f0e6ff)"
    card3Border: "#d9c2ff"
    card4Background: "linear-gradient(135deg, #f2fffb, #e0fff5)"
    card4Border: "#b3ffd9"

  night:
    card1Background: "linear-gradient(135deg, #211c00, #141100)"
    card1Border: "#423800"
    card2Background: "linear-gradient(135deg, #240a05, #140502)"
    card2Border: "#4f170b"
    card3Background: "linear-gradient(135deg, #130026, #0c0017)"
    card3Border: "#2d005c"
    card4Background: "linear-gradient(135deg, #001f16, #00120d)"
    card4Border: "#004d36"
```

---

## 5. Color Rules

Budget colors are stable semantic assignments, not a rotating chart palette.

| Meaning | Token | Hex |
|---|---|---:|
| Total expenditure / total revenue | `series.total` | `#0071e3` |
| Social protection | `series.social-protection` | `#ffd60a` |
| Health | `series.health` | `#30d5c8` |
| Education | `series.education` | `#0a84ff` |
| Infrastructure | `series.infrastructure` | `#ff9f0a` |
| Defence | `series.defence` | `#bf5af2` |
| Other / unclassified | `series.other` | `#8e8e93` |

Rules:

- A category keeps the same color in charts, legends, table swatches, treemap tiles, Every 100 GEL cells, radar, Budget Field, and ranking rows.
- Use `primary` for controls, active states, and the total series.
- Do not assign `primary` to every important value.
- Do not use color alone for meaning; pair color with labels, values, and shape.
- Revenue categories should use the same visual system and stable token pattern. Add revenue-specific series tokens only after the revenue taxonomy is finalized.

---

## 6. Typography

The system is Georgian-first. Georgian labels must stay readable in both themes and all viewports.

### 6.1 Font Stack

```yaml
fonts:
  ui: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Noto Sans Georgian", sans-serif'
  display: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Noto Sans Georgian", sans-serif'
  numeric: '"SF Pro Text", "Inter", "Noto Sans Georgian", sans-serif'
```

`Plus Jakarta Sans` can remain in prototypes, but production should prefer the system stack plus `Noto Sans Georgian` for reliable Georgian rendering.

### 6.2 Type Scale

```yaml
type:
  page-title:
    size: 32px
    weight: 700
    line-height: 1.15
    letter-spacing: "-0.03em"
  screen-brand:
    size: 22px
    weight: 700
    line-height: 1.25
  section-title:
    size: 20px
    weight: 700
    line-height: 1.3
  chart-title:
    size: 28px
    weight: 700
    line-height: 1.2
  body:
    size: 15px
    weight: 400
    line-height: 1.5
  ui-label:
    size: 13px
    weight: 600
    line-height: 1.3
  table:
    size: 14px
    weight: 500
    line-height: 1.45
  chart-axis:
    size: 12px
    weight: 600
    line-height: 1.35
  caption:
    size: 12px
    weight: 600
    line-height: 1.35
```

Rules:

- Do not scale font sizes with viewport width.
- Do not use negative letter spacing below `16px`.
- Numeric values should align consistently and remain scannable.
- Large Georgian headings can be bold, but compact controls should stay plain and readable.

---

## 7. Layout System

### 7.1 Page Shell

The Budget Explorer page uses a centered shell.

```yaml
page:
  maxWidth: "1200px"
  width: "min(1200px, calc(100vw - 32px))"
  paddingTop: "40px"
  paddingBottom: "80px"
```

Structure:

1. Review/page header with title, subtitle, and theme toggle.
2. Primary screen card.
3. Below-screen content sections.

### 7.2 Screen Card

```yaml
screen:
  background: "theme.surface"
  radius: "24px"
  padding: "24px"
  shadow: "0 20px 40px theme.shadow"
  marginBottom: "24px"
```

The screen card is the product frame. It contains the product top bar and the primary view.

### 7.3 Top Bar

The top bar contains:

- Brand.
- Expenditure / Revenue segmented switch.
- Multi-year / Single-year switch.

Rules:

- The top bar sits inside the screen card.
- It has a bottom border using `theme.hairline`.
- It is not a global marketing nav.
- Controls should be compact and horizontally aligned on desktop.
- On narrow screens, controls wrap or stack without clipping.

### 7.4 Spacing Tokens

```yaml
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
  section: "24px"
```

Confirmed visual rhythm uses `16px`, `20px`, and `24px` more than large marketing gaps. Keep sections compact enough for data work.

### 7.5 Shape Tokens

```yaml
radii:
  xs: "5px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  xxl: "18px"
  section: "20px"
  screen: "24px"
  pill: "999px"
```

Rules:

- Use `24px` only for major product containers.
- Use `18px` to `20px` for chart sections and headline cards.
- Use `10px` to `14px` for rows, inputs, buttons, table wrappers, and compact surfaces.
- Use pill radius only for segmented controls, theme toggles, range quick actions, and switches.

---

## 8. Core Components

### 8.1 Theme Toggle

Purpose: switch `light` and `night` themes.

```yaml
themeToggle:
  display: "inline-flex"
  height: "36px"
  padding: "3px"
  radius: "pill"
  background: "theme.strong"
  buttonWidth: "80px"
  buttonHeight: "30px"
```

Rules:

- Active theme uses `theme.surface`, `theme.ink`, and a subtle shadow.
- Theme choice should persist in `localStorage`.
- Theme switch must not reload data or change selected view state.

### 8.2 Segmented Switch

Used for:

- Expenditure / Revenue.
- Chart mode tabs.
- Year pills.
- Quick range actions.

Rules:

- Use pill background with active segment.
- Active state uses `theme.surface` in normal segmented controls.
- The `% წილი` measure button uses `primary` when active.
- Labels must be short and Georgian-first.

### 8.3 View Switch

Used to move between Multi-year and Single-year.

Rules:

- Use a label plus iOS-style switch.
- Keep the switch compact: `51px x 31px`.
- Do not make this a large card or route preview.
- It can navigate between the paired page routes.

### 8.4 Product Panel

Product panels are surfaces inside the screen card.

```yaml
panel:
  background: "theme.surface"
  radius: "20px"
```

Use panels for:

- Multi-year chart card.
- Multi-year series side panel.
- Single-year inner sections.

### 8.5 Content Section

Below-screen sections use:

```yaml
contentSection:
  background: "theme.surface"
  radius: "24px"
  padding: "24px"
  shadow: "0 20px 40px theme.shadow"
  marginTop: "24px"
```

Each section has a title row with:

- `h2`
- optional explanatory `p`
- optional small tag

Do not put page sections inside another decorative card. The screen card and content section already frame the page.

### 8.6 Search Field

Series search uses a quiet field:

```yaml
search:
  height: "36px"
  radius: "10px"
  background: "theme.canvas"
  border: "1px solid theme.hairline"
  text: "theme.mute"
  paddingInline: "12px"
```

Search should filter rows without changing active selections unless the user explicitly toggles a result.

### 8.7 CSV Button

CSV export is a primary utility action, not a decorative CTA.

```yaml
csvButton:
  height: "44px"
  radius: "12px"
  background: "theme.ink"
  text: "theme.surface"
  fontSize: "13px"
  fontWeight: 600
```

Rules:

- Label should be Georgian-first and explicit: `მონაცემების ჩამოტვირთვა CSV`.
- CSV export must use the same filtered dataset as the visible chart/table.
- Disabled state should explain why export is unavailable.

---

## 9. Multi-Year Explorer

Confirmed source: `docs/Design HTML files/multiyear-apple.html`

### 9.1 Default State

Default view:

- Side: Expenditure.
- View: Multi-year.
- Chart mode: Line.
- Measure: nominal GEL.
- Range: 2023-2025.
- Selected series: total expenditure plus selected public spending fields.

Revenue reuses the same structure. Only labels, taxonomy, data, and source semantics change.

### 9.2 Desktop Layout

```yaml
multiYearWorkspace:
  display: "grid"
  columns: "minmax(0, 1fr) 280px"
  gap: "24px"
```

Left column:

- Chart title.
- Plot frame.
- Chart mode tabs.
- `% წილი` measure toggle.
- Line chart or table.
- Legend.
- Range strip.

Right column:

- Series title.
- Search.
- Series rows.
- CSV button.

### 9.3 Confirmed Chart Modes

Confirmed modes:

- `ხაზი`
- `ცხრილი`

Do not show `სვეტი` or `კომპოზიცია` in v1 production unless a new confirmed design is created for those modes.

### 9.4 Measure Toggle

The confirmed measure toggle is `% წილი`.

Rules:

- Default state shows nominal GEL.
- Active `% წილი` state uses `primary` fill and white text.
- In `% წილი`, line view uses dual vertical axes:
  - Left axis: `მშპს წილი`.
  - Right axis: `ბიუჯეტის წილი`.
- Do not add extra measure chips inside the confirmed plot unless design is re-approved.

### 9.5 Plot Frame

```yaml
plot:
  background: "theme.canvas"
  radius: "18px"
  padding: "70px 24px 24px"
```

Rules:

- Chart mode tabs sit inside the plot frame at top-left.
- `% წილი` toggle sits inside the plot frame at top-right.
- Grid lines use `theme.grid`.
- Direct line labels are off the plot in the confirmed visual.
- Use legend and side panel for series identity.

### 9.6 Table Mode

Table mode replaces the chart area inside the plot frame.

Confirmed columns:

```text
კატეგორია | 2023 | 2024 | 2025 | ცვლილება
```

Rules:

- Hide chart SVG, range strip, and legend in table mode if the confirmed layout requires it.
- Use swatches in the first column.
- Text column aligns left; numeric columns align right.
- Table data must match the active side and period.

### 9.7 Legend

Legend appears below the chart.

Rules:

- Use colored dots.
- Use Georgian category labels.
- Legend can toggle series visibility if implementation supports it.
- Muted legend state should reduce opacity but keep layout stable.

### 9.8 Range Strip

Range strip appears below the legend in line mode.

Confirmed pieces:

- Range label: `Range: 2023 - 2025`.
- Quick actions: `1Y`, `5Y`, `ALL`.
- Rail with two handles.

Rules:

- For v1, range bounds are constrained to available years.
- If only 2023-2025 exists, `ALL` and `5Y` can resolve to the same range.
- Handles should not imply missing years outside loaded data.

### 9.9 Series Panel

```yaml
seriesPanel:
  width: "280px"
  title: "სერიები"
  rowMinHeight: "48px"
  rowRadius: "10px"
  activeBackground: "theme.canvas"
```

Rules:

- Use square/rounded-square color chips, not decorative icons.
- Active rows have quiet surface emphasis.
- Search filters available rows.
- CSV button stays at the bottom after series list.
- If production supports many rows, the series list may scroll inside the panel.

### 9.10 Below-Chart Multi-Year Sections

Confirmed order:

1. Main indicators / poster KPI cards.
2. Top movers board.
3. Formula analysis.

Do not replace these with unrelated storytelling blocks.

#### KPI Cards

Use four cards in a grid. Each card contains:

- Small label.
- Large value.
- Short context line.

#### Top Movers Board

Use six vertical tower blocks:

- Top 3 gainers.
- Bottom 3 movers.

Copy rule: if the value is still positive growth, avoid calling it a true loss in production copy. Prefer `ყველაზე სწრაფი ზრდა` and `ყველაზე ნელი ზრდა`, or equivalent Georgian wording.

#### Formula Analysis

Use formula rows:

```text
start year + change = end year
```

Rules:

- Rows use category swatch.
- Values stay compact.
- Formula blocks stack on mobile.

---

## 10. Single-Year Snapshot

Confirmed source: `docs/Design HTML files/singleyear-apple.html`

Single-year mode is a zoomed-out national budget snapshot. It has no drilldown in v1.

Revenue reuses the same layout and system. Only labels, taxonomy, data, and source semantics change.

### 10.1 Confirmed Order

1. Year selector.
2. Four headline cards.
3. Full-width structure/treemap section.
4. Full-width Every 100 GEL section.
5. Budget radar.
6. Budget Field.
7. Full ranking.

Do not place the structure section and Every 100 GEL side by side. The confirmed layout stacks them vertically.

### 10.2 Year Selector

The year selector is a horizontal pill row and must handle 10+ years.

Rules:

- Selected year uses active pill state.
- On narrow screens, allow horizontal scroll instead of squeezing labels.
- If the selected year is planned, show a subtle planned badge near the year context.

### 10.3 Headline Cards

Four cards only:

1. Total amount.
2. Largest category/source.
3. Fastest growth.
4. Largest GEL increase.

Rules:

- Use the confirmed gradient tokens.
- Keep large value and short context line.
- Do not add more cards; additional detail belongs in the ranking or visual sections.

### 10.4 Structure Section

Production title:

```text
სტრუქტურა სფეროების მიხედვით
```

This section is the single-year composition opener.

Confirmed layout:

```yaml
treemap:
  display: "grid"
  columns: "1.1fr .72fr .52fr"
  rows: "150px 112px 94px"
  gap: "12px"
  minHeight: "372px"
```

Tile rules:

- Tile background uses `theme.surface`.
- Tile border uses `theme.hairline`.
- Left border uses category color.
- Large categories can span two rows.
- `Other` can span two columns.
- No click drilldown in v1.
- Hover may slightly lift the tile.

### 10.5 Every 100 GEL

Production title:

```text
ყოველი 100 ლარი
```

Confirmed layout:

```yaml
every100:
  section: "full-width below structure"
  gridColumns: 10
  cellCount: 100
  gridWidth: "min(100%, 560px)"
  gap: "6px"
  cellRadius: "5px"
```

Rules:

- This is a visual-only 100-cell explainer.
- Do not add a list beside it in v1.
- Cells use category colors.
- Cell counts use rounded whole GEL values that sum to 100.
- Exact values remain available in ranking, table, tooltips, and export.

### 10.6 Budget Radar

Budget Radar replaces the older petals concept.

Rules:

- Radar is visual-only in v1.
- Use top-level categories.
- No list beside the chart.
- Labels can be reduced on narrow screens.
- If too many categories make the radar unreadable, use top categories plus `Other`.

### 10.7 Budget Field

Budget Field is a bubble/scatter view for one selected year.

Rules:

- x-axis: share of total.
- y-axis: growth versus previous available year.
- bubble size: GEL amount.
- color: category token.
- If previous-year data is unavailable, show a clear missing-growth state instead of guessing.
- Labels are only for notable or selected points.

### 10.8 Full Ranking

Full ranking is the exact inspection section.

Columns:

```text
სფერო | GEL | წილი | ცვლილება
```

Rules:

- Default sort is GEL amount descending.
- Use swatches next to category names.
- Values must match the active side, selected year, and public taxonomy.
- Single-year ranking shows top-level public spending fields or top-level revenue categories only.
- No program/subprogram rows in single-year ranking.

---

## 11. Revenue Adaptation

Do not create a separate revenue visual direction.

Revenue uses:

- Same page shell.
- Same theme tokens.
- Same controls.
- Same chart/table treatment.
- Same single-year section order.
- Same CSV and source patterns.

Change only:

- Labels.
- Category taxonomy.
- Series colors if revenue-specific stable tokens are added.
- Source wording.
- Tooltips and CSV metadata.

Revenue taxonomy should expose top-level tax categories directly, including VAT, income tax, profit tax, excise tax, import tax, property tax, other taxes, grants, other revenue, decrease in non-financial assets, decrease in financial assets, and increase in liabilities.

Georgian labels for source-specific budget-classification categories must be confirmed before production release.

---

## 12. Data Visualization Rules

### 12.1 Line Charts

Rules:

- Use clean polylines with circular points.
- Use category tokens for stroke colors.
- Use `theme.grid` for grid lines.
- Keep axes readable at `12px`.
- Avoid direct labels inside dense plot areas.
- Use legend and side panel for series identity.
- Planned values use a subtle marker or badge if active public value is planned.

### 12.2 Tables

Rules:

- Table background is `theme.surface`.
- Header background is `theme.soft`.
- Borders use `theme.hairline`.
- Text column aligns left.
- Numeric columns align right.
- Include category swatches in the first column.
- Table values are exact and export-consistent.

### 12.3 Treemap

Rules:

- Tile area represents share of total where implementation supports true treemap sizing.
- The confirmed prototype uses a fixed editorial composition; production can compute layout but must preserve the same visual hierarchy.
- Labels appear only where readable.
- Full detail should be available on hover/focus.
- No click drilldown in v1.

### 12.4 Every 100 GEL

Rules:

- Always render exactly 100 cells.
- Use rounded allocations that sum to 100.
- Keep grid centered in its section.
- Preserve layout stability while data changes.

### 12.5 Radar

Rules:

- Use category color sparingly.
- Keep grid and polygon readable in both themes.
- Do not overload with too many labels.
- Provide accessible text summary outside SVG where needed.

### 12.6 Budget Field

Rules:

- Use bubble size for amount, x for share, y for growth.
- Keep axes labeled.
- Use hover/focus details for exact numbers.
- Use a no-data state when growth cannot be computed.

---

## 13. Content and Copy

The voice is precise, civic, and analytical.

Use:

- `ხარჯები`
- `შემოსავლები`
- `მრავალწლიანი`
- `ერთწლიანი`
- `სერიები`
- `სტრუქტურა სფეროების მიხედვით`
- `ყოველი 100 ლარი`
- `ბიუჯეტის რადარი`
- `ბიუჯეტის ველი`
- `სრული რეიტინგი`
- `მონაცემების ჩამოტვირთვა CSV`

Rules:

- Georgian is primary in the UI.
- English is allowed only where the user has approved it or where a compact technical label is clearer, such as `CSV`.
- Include units with values: `მლრდ`, `მლნ`, `%`, `GEL`.
- Avoid vague marketing copy.
- Empty/error copy should explain what happened and what the user can do next.

Example error:

```text
ამ არჩევანისთვის მონაცემები არ არის ხელმისაწვდომი. შეცვალე წელი ან გაასუფთავე ფილტრები.
```

---

## 14. Responsive Behavior

### 14.1 Breakpoints

```yaml
breakpoints:
  desktop: ">= 1100px"
  tablet: "768px - 1099px"
  mobile: "< 768px"
```

### 14.2 Desktop

- Page width maxes at `1200px`.
- Multi-year workspace uses chart plus 280px side panel.
- Single-year sections stack vertically after headline cards.
- Below-screen sections use four-card or six-column grids where confirmed.

### 14.3 Tablet and Mobile

At `max-width: 1100px`:

- Multi-year workspace becomes one column.
- Series panel moves below chart.
- Headline cards become two columns.
- Movement board becomes one column.
- Formula rows stack.
- Top bar can stack vertically.

Additional mobile rules:

- Year pills may scroll horizontally.
- Treemap can reduce to a simpler stacked grid if labels would clip.
- Every 100 GEL must remain a 10x10 grid when width allows; otherwise reduce cell size, not cell count.
- Tables can horizontally scroll.
- Controls must remain at least `30px` high, preferably `36px+`.

---

## 15. Accessibility

Rules:

- All controls need accessible names.
- Theme, side, view, mode, and measure controls must expose selected/pressed state.
- SVG charts need `role="img"` and an accessible label.
- Data shown only in SVG must also be available in table, tooltip, or accessible summary.
- Focus states must be visible in both themes.
- Do not rely on color alone; use labels, swatches, values, and row text.
- Respect reduced motion preferences.
- Keep chart labels at least `12px` on desktop.
- Keep body text at least `14px`.

---

## 16. Motion and Interaction

```yaml
motion:
  fast: "120ms"
  base: "200ms"
  slow: "260ms"
  easing: "cubic-bezier(0.16, 1, 0.3, 1)"
```

Rules:

- Theme switching should feel immediate.
- Hover states may lift cards by `2px`.
- Chart changes can fade or update lightly.
- Avoid decorative animation loops.
- Loading states should preserve layout size.

---

## 17. Data and Trust Presentation

Design must make data context visible without adding heavy provenance panels in v1.

Every public analytical view should expose:

- Active side: expenditure or revenue.
- Active view: multi-year or single-year.
- Year or period.
- Unit.
- Measure.
- Source/update context.
- CSV export path where applicable.

Minimal public source label:

```text
მონაცემები: გადამოწმებული ოფიციალური ბიუჯეტის დოკუმენტები
ბოლო განახლება: YYYY-MM-DD
```

CSV export must include metadata columns:

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

If a year is planned, show a subtle planned badge or marker. If planned and actual both exist for the same item/year, actual wins in public UI and CSV.

---

## 18. Implementation Tokens

Use these CSS custom properties as the production baseline.

```css
:root {
  --primary: #0071e3;
  --primary-active: #0077ed;
  --teal: #30d5c8;
  --yellow: #ffd60a;
  --blue: #0a84ff;
  --orange: #ff9f0a;
  --violet: #bf5af2;
  --slate: #8e8e93;
  --font-ui: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Noto Sans Georgian", sans-serif;
}

[data-theme="light"] {
  --canvas: #f5f5f7;
  --surface: #ffffff;
  --soft: #fafafa;
  --strong: #e8e8ed;
  --chart: #ffffff;
  --hairline: #e8e8ed;
  --hairline-soft: #f5f5f7;
  --ink: #1d1d1f;
  --body: #515154;
  --mute: #86868b;
  --grid: #f5f5f7;
  --shadow: rgba(0, 0, 0, .04);
  --on-primary: #ffffff;
}

[data-theme="night"] {
  --canvas: #000000;
  --surface: #1d1d1f;
  --soft: #161617;
  --strong: #323236;
  --chart: #1d1d1f;
  --hairline: #323236;
  --hairline-soft: #2d2d2f;
  --ink: #f5f5f7;
  --body: #a1a1a6;
  --mute: #86868b;
  --grid: #161617;
  --shadow: rgba(0, 0, 0, .6);
  --on-primary: #ffffff;
}
```

---

## 19. Production Do / Do Not

Do:

- Use the confirmed multi-year and single-year HTML as visual references.
- Keep Light and Night variants.
- Keep the same layout structure across both themes.
- Keep the single-year structure and Every 100 GEL sections stacked vertically.
- Use only confirmed multi-year chart modes: line and table.
- Keep `% წილი` as the confirmed measure toggle.
- Reuse the visual system for revenue.
- Keep category colors stable across all surfaces.
- Preserve Georgian-first labels.
- Keep CSV export visible in multi-year explorer.

Do not:

- Do not bring back unconfirmed visual variants.
- Do not add bar or stacked chart modes to the confirmed multi-year UI without a new approved design.
- Do not put the single-year structure section and Every 100 GEL side by side.
- Do not add a list beside Every 100 GEL in v1.
- Do not use the old petals section; use Budget Radar.
- Do not create a separate revenue design direction.
- Do not turn v1 into a broad data catalog.
- Do not add clickable drilldown pages in v1.
- Do not hide units, year, measure, source, or export context.

---

## 20. Design QA Checklist

Before shipping UI that claims to follow this system, verify:

1. Light and Night themes render the same layout.
2. Multi-year default is line mode with nominal GEL.
3. Multi-year only exposes `ხაზი` and `ცხრილი`.
4. `% წილი` toggle switches to the confirmed share view.
5. Series panel uses stable category colors.
6. CSV button is visible and tied to active filters.
7. Single-year headline cards are exactly four.
8. Single-year structure section is full-width.
9. Every 100 GEL is full-width below structure and renders 100 cells.
10. Budget Radar appears before Budget Field.
11. Full Ranking is last.
12. Revenue reuses the same visual system.
13. Georgian labels do not clip at desktop and mobile widths.
14. Tables and SVG charts have accessible equivalents or labels.
15. Source/update context is present.
16. No deprecated visual direction remains in production UI.
