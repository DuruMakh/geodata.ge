# Fiscal.ge Design System — Editorial

Version: 4.1
Last updated: 2026-10-20
Status: Production visual system for Fiscal.ge
Scope: Explorer product UI (the eighteen dataset hubs of §6.7), charts, tables, controls, export surfaces, responsive behavior, and future pages that reuse the Budget Explorer shell.

---

## 1. Source of Truth

This file defines the production design system for Fiscal.ge v1. It **replaces DESIGN.md v3.x (the Apple-like Light/Night system) in full**. The editorial direction is the approved production direction.

`DESIGN.md` v4.1 is the canonical visual and behavioral source of truth. The earlier `editorial-v2` HTML prototype package was intentionally removed as superseded in 2026-08. Retained concept files under `docs/Design HTML files/` are contextual inputs only unless a current product spec explicitly promotes them; they do not override this file or current route contracts.

Confirmed product references:

- `Project_Definition.md`

This file owns production visuals. Current product specs may record deliberate feature-level carve-outs, which must be reflected here when they become durable; the platform shell and route IA are specified in §6.2/§6.7 and `docs/superpowers/specs/2026-07-28-explorer-shell-and-workspace-design.md`.

Superseded and must not appear in production:

- The Apple-like Light/Night system (DESIGN.md v3.x), including `#0071e3` primary, card/shadow surfaces, 24px radii, gradient headline cards, the SF Pro stack, the theme toggle, and the iOS view switch.
- Crypto/terminal, neon, and marketing-homepage directions.

## 2. Product Scope Boundary

Fiscal.ge is a Georgian-first explorer of reviewed annual public-finance and economy data in eighteen dataset hubs (§6.7), plus monthly national inflation. It is not a broad public-data catalog. `Project_Definition.md` §2 owns scope; this section only frames the visual system.

Included: the budget hub, multi-year explorer (line + table) with fields/ministries grouping, single-year analysis view, the one-chart Government Debt explorer, the one-series general-government deficit explorer, the Economy hub (GDP overview, national sectors, GDP by expenditure, regional economies), the Business hub (§35), the Housing hub (§37), the Inflation hub (overview, categories, products, cities), the Money and banks hub (§34), the Unemployment hub (§27), the Wages hub (§31), the Living standards hub (§32), the Health hub (§36), the Education hub (§39), the Science and culture hub (§40), the Crime and justice hub (§38), the Trade hub (overview, trading partners, products, domestic exports, services trade; §28), the External flows hub (§30), the Energy and food hub (§33), the Environment and climate hub (§41), the Demography hub (population, age and sex, migration, births and deaths; §29), methodology pages, the `/about` mission page (§23), the `/connect` page, Excel workbook export, Georgian-first UI with an English mirror (§2.2), minimal public source label, internal provenance metadata.

Excluded: data catalog, capital explorer, admin UI, a public API beyond the read-only MCP and static publications, uploads, sub-annual data other than inflation (§25) and the one latest 2026 amount on Foreign debt and Reserves (§30.3, §30.4), automated document extraction, clickable drilldown pages (series selection in the explorer is not drilldown). The Government Debt explorer does not alter the existing `spending.debt_service` expenditure series.

Municipal budgets are a budget **section** at `/explorer/municipalities` (§2.1, §6.2, §20): an index with a municipality-grain map and ranked list, 64 municipality pages, 11 region roll-up pages, and one explicit Georgia aggregate page, reachable from the sidebar and hub card 03 (§6.7). The annual unemployment explorer is active at `/explorer/unemployment` and its English mirror. No teaser dataset remains in the sidebar; a future teaser is a marker only, with no data at all, and nothing about a marker may be styled as if it were live.

Regional economies are an Economy route family at `/explorer/economy/regions` (§2.1, §6.2, §26): one All Regions index and 11 detail pages.

Every visual decision should support a focused budget product, not a generic dashboard.

### 2.1 Actual Data Coverage (data-driven, never hardcoded)

Year ranges in the UI always derive from loaded facts. Current reviewed coverage:

- Expenditure by public spending fields: **2004–2025** (13 fields per year, 12-month actual execution).
- Expenditure by ministries (administrative view): **2004–2025** categories; major-program drill-down rows exist from 2012 (partial) and are contiguous 2017–2025.
- Revenue: **2004–2025** (11 top-level categories; 2004 has 10 because increase in liabilities starts in 2005).
- Municipal expenditure by functional category: **2015–2025** (10 main functions plus the public total headline). The public entity set is 64 municipalities across 11 data-bearing regions. Adjara's total combines its six municipalities with Adjara republican actual payments net of transfers to territorial budgets. The separate Georgia scope aggregates all 69 reviewed municipal-budget series and adds the same net Adjara amount once; the 110 function rows remain municipal-only. Five occupied-territory-associated bodies appear only inside that country aggregate. Served at `/explorer/municipalities` (§20).
- General-government balance: **1995–2031** (1995–2025 actual; 2026–2031 IMF projection), published directly as percent of GDP and nominal GEL.
- Regional economies: **2010–2024**, 11 regions, Total regional GDP plus 20 NACE Rev. 2 activities, with current-price GEL and share of the selected region's market-price GDP only.
- Unemployment: comparable core annual observations **2010–2025**; education and long-term **2020–2025**. Historical age bands and combined regions remain distinct, with source-derived coverage and missing-year gaps.
- Demography: population on 1 January, Georgia **2004–2026** and the 11 regions and 64 municipalities **2015–2026**; density (persons per km²), Georgia **2014–2026** and the 11 regions **2015–2026**, none for municipalities. The 2024 census re-bases 1 January 2025, so no change is computed across it. Served at `/explorer/demography/population` (§29).
- Government Debt, GDP overview, national economic sectors and inflation: coverage is stated in `Project_Definition.md` §2 and §2C and in each dataset's methodology page.
- All current budget facts are `basis = actual`. Planned-value affordances (the `გეგმა` tag) stay specified and must activate automatically if planned budget facts ever load; debt and deficit projections use the separate `პროგნოზი` treatment.

### 2.2 Bilingual presentation

Georgian keeps its existing addresses; English human pages use `/en`. Both use
this same v4.1 visual system, component hierarchy, colours, chart geometry and
financial rules. The language switch is an accessible link and preserves the
current page, query and explorer settings. Human navigation stays in the selected
language; downloads and the MCP endpoint retain shared resource addresses.

English names and full sentences come from reviewed catalogues and scoped
messages. Missing English text is a validation error. Search may match either
language while results use the selected language. Long English debt-rate labels
wrap so domestic and external series remain distinguishable. Dates and units
use the selected locale; numerical precision, missing/zero distinctions, basis
markers and forecasts retain their existing meaning. English workbooks have
Summary, Data and Sources sheets and an `-en.xlsx` suffix, with identical numbers
and original-source selection. Original filenames remain unchanged, explicitly
marked with their language and accompanied by translated descriptions.

Review both languages at 390, 768 and 1440 pixels, including keyboard navigation,
the compact sidebar, mobile controls, search and exports. Update the affected
English page review dates when a translation or shared public text changes.

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
  paper: "#F7F2E9"        # page background; the default canvas
  tint: "#F1EADC"         # hover rows, selected rows, callout background
  tile: "#FDFAF3"         # tooltip and treemap tile fill (only "raised" surface)
  ink: "#1E1B16"          # primary text, strong rules, total row
  body: "#55503F"         # secondary data text
  muted: "#6A6050"        # labels, captions, inactive controls (v2 darkened from #7A7060 for contrast)
  faint: "#776E5C"        # small metadata text (darkened from #A89C88 for contrast)
  ink-fg-muted: "#A69C8C" # inactive labels on the ink shell surface only
  ink-fg-faint: "#8F8676" # overlines, badges, tertiary text on the ink shell surface only
  hairline: "#D9CFBE"     # section sub-rules, aside border
  hairline-soft: "#E7DECF" # row borders, chart grid, bar tracks
  row-border: "#EDE4D3"   # series-panel row borders
  control: "#95846A"      # control borders (checkbox, pill, search underline)
  accent: "#B3402A"       # terracotta: active states, focus, negative values
  positive: "#1F6E56"     # positive change
  negative: "#B3402A"     # negative change (shared with accent by design)
```

Rules:

- `paper` is the only background for the landing page and the explorer content column. Never introduce white panels.
- **Exception: the explorer sidebar** (`ink` background, §6.7) — a persistent navigation shell beside the content column, not a panel within it. This does not generalize: `paper` remains the only background for every panel, block, or surface inside the content column.
- Selection/hover emphasis is always `tint`, never shadow or border color change.
- Series-row values use `muted` so their small text stays above 4.5:1 on both `paper` and selected/hovered `tint` backgrounds; `faint` is not a text color for tinted rows.
- `tile` is reserved for tooltips, treemap tiles, and budget hub cards (§6.6).
- The two `ink-fg-*` tokens exist only on the `ink` shell surface (§6.7); never use them on paper. **These lines are the single definition of both hex values** — §16 mirrors the paper tokens only, so a value change is one edit here plus one in `apps/web/app/globals.css`.
- `ComingSoonBadge` keeps `ink-fg-faint` for its default dark-shell use. On the methodology hub's paper background, use its explicit `paper` surface with `muted` text; its label, size, and border stay unchanged.
- Both ink tokens clear WCAG AA on `ink`: `ink-fg-faint` measures **4.77:1** for the 8.5–9.5px text it carries from 768px (11px below it, §5.2) (brand sub-line, `მონაცემები /` overline, rail label, `მალე` badge) and `ink-fg-muted` measures **6.34:1** for its 12–12.5px labels. They are a deliberate two-step hierarchy — an ~8.5 CIE L\* gap, so faint still reads dimmer than muted. Any future move has to keep **both** above 4.5:1 **and** that gap; raising one alone collapses the pair. (The pair was raised from `#7A7060` / `#8F8676`, where faint sat at 3.53:1.)
- The paper pair answers to the same floor: `faint` measures **4.52:1** on `paper` and **4.83:1** on `tile`, and `muted` **5.54:1** / **5.92:1**. `faint` is the dimmest paper tier, not decoration — it carries the page-header coverage line (10.5px), hub card footers (10px) and the `გეგმა` planned tag (9px) — sizes from 768px; all render at 11px below it (§5.2) — all small text, all owed 4.5:1. `tests/explorer/themeTokens.test.ts` asserts both, mirroring the ink-pair guard. (The token was darkened from `#A89C88`, which sat at 2.42:1. The paper two-step is necessarily tighter than the ink pair's — `muted` is itself only 5.54:1, so the L\* gap is ~5.6, not 8.5. Restoring a wider step means moving `muted` down first.)
- Non-text UI boundaries answer to WCAG 2.1 SC 1.4.11's **3:1**, the same floor §6.7 cites for the `მალე` badge border. `control` measures **3.25:1** on `paper` and **3.03:1** on `tint`; the focus ring, drawn in solid `accent`, measures **5.11:1** on `paper`. Both sat below the floor until this was pinned — `control` at `#C9BEA9` was 1.65:1, the first repair `#97866C` still reached only 2.95:1 on a tinted hover row, and the ring at 0.4 alpha composited to `rgb(220,171,157)`, 1.82:1 — while every 4.5:1 text assertion stayed green. `tests/explorer/themeTokens.test.ts` therefore asserts the actual `paper` and `tint` backgrounds as well as the solid ring.
- Focus rings: `2px solid var(--accent)`, offset 2px. No alpha: an alpha composites the ring toward `paper` and silently undoes the ratio the token measures.
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
  spending.infrastructure_regional_development: "#A5822B"
  spending.defence: "#7A4E8C"
  spending.public_order_safety: "#4A707A"
  spending.economic_affairs: "#C26E4C"
  spending.agriculture_environment: "#2F4B3A"
  spending.culture: "#9C3D5E"
  spending.sport: "#8A7B65"
  spending.general_public_services: "#5B5347"
  spending.debt_service: "#8C5A32"
  spending.other_unclassified: "#94856D"
```

Revenue:

```yaml
series:
  revenue.vat: "#B3402A"
  revenue.income_tax: "#3D5A98"
  revenue.profit_tax: "#1F6E56"
  revenue.excise_tax: "#A5822B"
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
  admin_spending.regional_development_infrastructure: "#A5822B"
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
  admin_spending.other_costs: "#94856D"
```

Major programs are **derived from their parent ministry's colour**, not assigned
from a palette: same hue, stepped through lightness and saturation so a line's
parentage is legible from its colour alone. Each step is a fraction of the
headroom between the parent and the edge of the readable band (lightness 22–78,
saturation 14–84), so no shade is ever clamped flat against a sibling — three
ministry tokens (`#94856D`, `#8A7B65`, `#5B5347`) sit within 2° of hue and are
told apart by lightness alone. With every ministries series selected this yields
63 distinct colours.

The resolved displayed parent colour is the input, including for a future
ministry that falls back to the open-ended palette. Later sibling cycles use
progressively smaller steps and collision nudges; at least 24 siblings under one
parent remain distinct without changing the current corpus's first eight shades.
Every derived shade clears 3:1 on both `paper` and the `tint` used by selected
and hovered series rows.

The programs must not cycle the editorial palette: it holds the very hexes the
categories use, so a program could draw as its own parent.

Any future ministry not listed above still uses index-based assignment cycling
through the editorial palette, as do the other open-ended sets (single-year
snapshot, landing, municipal rows):

```text
#B3402A #1F6E56 #3D5A98 #A5822B #7A4E8C #4A707A #C26E4C #2F4B3A #9C3D5E #8A7B65 #5B5347 #8C5A32 #4E5D74 #94856D
```

Municipal functions (`municipal.*`) reuse the semantic colour of the same concept
on the budget side, so a category keeps one colour across the whole site:

| Function | Token | Shares with |
|---|---|---|
| `municipal.social_protection` | `#B3402A` | `spending.social_protection` |
| `municipal.health` | `#1F6E56` | `spending.health` |
| `municipal.education` | `#3D5A98` | `spending.education` |
| `municipal.housing_communal` | `#A5822B` | `spending.infrastructure_regional_development` |
| `municipal.defence` | `#7A4E8C` | `spending.defence` |
| `municipal.public_order_safety` | `#4A707A` | `spending.public_order_safety` |
| `municipal.economic_affairs` | `#C26E4C` | `spending.economic_affairs` |
| `municipal.environment` | `#2F4B3A` | `spending.agriculture_environment` |
| `municipal.recreation_culture` | `#9C3D5E` | `spending.culture` |
| `municipal.general_public_services` | `#5B5347` | `spending.general_public_services` |

Demography migration citizenship groups (`citizenship.*`) are fixed series tokens in `lib/explorer/colors.ts`, held to the 3:1 graphical-object floor like every other series. The computed remainder wears the shared "other" colour and is never labelled a country.

| Group | Token | Contrast on `paper` |
|---|---|---|
| `citizenship.georgia` | `#3D5A98` | 6.05:1 |
| `citizenship.russian_federation` | `#C26E4C` | 3.35:1 |
| `citizenship.turkey` | `#1F6E56` | 5.50:1 |
| `citizenship.azerbaijan` | `#A5822B` | 3.23:1 |
| `citizenship.ukraine` | `#7A4E8C` | 5.71:1 |
| `citizenship.all_other_computed` | `#94856D` (`OTHER_COLOR`) | 3.23:1 |

Demography births and deaths add four more fixed tokens in `lib/explorer/colors.ts`, also above the 3:1 floor: `vital.births` and `vital.deaths` for the two directions of the "Births and deaths" chart, and `sex.male` and `sex.female` for the life-expectancy lines (the Age and sex page reuses the two sex tokens).

| Series | Token | Contrast on `paper` |
|---|---|---|
| Births | `vital.births` `#1F6E56` | 5.50:1 |
| Deaths | `vital.deaths` `#8C5A32` | 5.20:1 |
| Men | `sex.male` `#3D5A98` | 6.05:1 |
| Women | `sex.female` `#C26E4C` | 3.35:1 |

Rules:

- Never assign `accent` meaning beyond "active/negative" in UI chrome; as a series color it belongs only to the categories listed above.
- Never use color alone; pair with the 14×3px swatch bar, label, and value.
- Every fixed and derived series colour clears the 3:1 graphical-object floor on both `paper` and `tint`, where selected rows, swatches, and checkbox fills appear; the former `#B08A2E` and `#A89C88` tokens were darkened to `#A5822B` and `#94856D` for that reason.

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
  page-title:      { font: display, size: 40px (30px mobile), weight: 600, ls: -0.01em, lh: 1.15 }  # methodology articles: H1 clamp(24px, 8vw, 30px) below 768px and section H2 clamp(22px, 7vw, 27px), so the longest Georgian word fits a 320px phone without a mid-word break
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
- **Phone floor** (owner decision D8, 2026-10-07): below 768px no informational text is smaller than 11px. Labels specified here or elsewhere at 8.5–10.5px (brand sub-line, menu overline, `მალე` badge, captions, hub footers, coverage line, series counts, mono labels) render at 11px and keep their specified size from 768px. Chart SVG text is 11px on phones (§8.3).
- Body copy, notes, series rows, KPI/indicator text, methodology, landing, footer, `/about` and `/connect` are sized in `rem` (the same px at a 16px root) so the reader's text-size setting applies; display headings, charts and the remaining controls stay in px.
- Negative letter-spacing only at ≥16px.
- Emphasis inside data = weight 600 (e.g. latest-year column), never color-only.
- Unit suffixes on serif values (`მლრდ ₾`) are mono 12–13px in `body` color, not serif.
- Year ranges are one style everywhere: an **unspaced en dash** (`2004–2025`, U+2013). Not an em dash, not spaced. This covers the coverage label (§6.2), the source note (§7.10), and the range strip (§7.4).

## 6. Layout System

### 6.1 Page Shell

```yaml
page:
  background: paper
  maxWidth: "1240px"
  padding: "30px 28px 72px"   # mobile: "24px 20px 64px"
```

No screen card, no outer container. Content sits directly on paper.

**Exception: the explorer shell** (§6.7) — every dataset hub under `/explorer` and its pages use a sidebar + content-column layout instead, with different max-width and padding. This page shell applies to the landing page (§19) only.

### 6.2 Information Architecture

The landing lives at `/` (მთავარი — see §19). Everything else is the data platform: the Budget, Economy, Business, Housing and construction, Inflation, Money and banks, Unemployment, Wages, Living standards, Health and social protection, Education, Science and culture, Crime and justice, Trade, External flows, Energy and food, Environment and climate and Demography hubs and their sections, all mounted under `/explorer` inside the shell of §6.7. Every route below also exists under `/en` (§2.2).

```text
/explorer                              budget hub — the six sections as cards
/explorer/expenditure                  ხარჯები           multi-year expenditure explorer (fields/ministries grouping)
/explorer/revenue                      შემოსავლები       multi-year revenue explorer
/explorer/municipalities               მუნიციპალიტეტები  index — municipality-grain map, ranked list, KPIs (§20)
/explorer/municipalities/georgia                         Georgia aggregate page for all 69 reviewed series
/explorer/municipalities/[slug]                          64 municipality pages
/explorer/municipalities/region/[id]                     11 region roll-up pages
/explorer/analysis                     ანალიზი           single-year analysis view (own side switch, grouping switch
                                                          for expenditure, and year selector)
/explorer/debt                         ვალი              Government Debt stock, service, and rate explorer (§8.5)
/explorer/deficit                      დეფიციტი          General-government balance explorer (§8.6)
/explorer/economy                     ეკონომიკა         Economy hub
/explorer/economy/gdp                                   Annual GDP overview
/explorer/economy/sectors                               National economic sectors
/explorer/economy/expenditure                           GDP by expenditure
/explorer/economy/regions                               All Regions map and ranked list (§26)
/explorer/economy/regions/[id]                          11 regional-economy detail pages (§26)
/explorer/business                    ბიზნესი           Business hub (§35)
/explorer/business/sales                                Firms' sales by firm size and industry (§35)
/explorer/business/jobs                                 People employed in firms by firm size and industry (§35)
/explorer/business/investment-profit                    Investment, profit and loss, with sizes and industries nested (§35)
/explorer/business/firms                                Firms opened and closed, numbers and rates (§35)
/explorer/business/regions                              Region map and ranked list (§35)
/explorer/business/regions/[id]                         Georgia and 11 region business pages (§35)
/explorer/housing                     საცხოვრებელი და მშენებლობა  Housing and construction hub (§37)
/explorer/housing/permits                               Building permits by building type, numbers and floor area (§37)
/explorer/housing/completed                             Completed buildings by building type, numbers and floor area (§37)
/explorer/housing/prices                                Home price index and Tbilisi district prices (§37)
/explorer/housing/regions                               Region map and ranked list (§37)
/explorer/housing/regions/[id]                          Georgia and 11 region housing pages (§37)
/explorer/inflation                   ინფლაცია          Inflation hub (§25)
/explorer/inflation/overview                            Monthly national CPI overview (§25)
/explorer/inflation/categories                          COICOP categories and contributions (§25.1)
/explorer/inflation/products                            Individual products (§25.2)
/explorer/inflation/cities                              Inflation by city: Georgia page (§25.3)
/explorer/inflation/cities/[city]                       Inflation in one city (§25.3)
/explorer/money                       ფული და ბანკები   Money and banks hub (§34)
/explorer/money/supply                                  Money supply with a % of GDP icon switch (§34)
/explorer/money/loans-deposits                          Loans, deposits and a foreign-currency share icon switch (§34)
/explorer/money/interest-rates                          National Bank rate and bank interest rates (§34)
/explorer/money/bank-health                             Bad loans, profits and capital (§34)
/explorer/unemployment                უმუშევრობა        Unemployment hub (§27)
/explorer/unemployment/overview                         National overview and supporting tabs (§27)
/explorer/unemployment/regions                          Region-only map and linked list (§27)
/explorer/unemployment/regions/[id]                     Region indicators and trends (§27)
/explorer/unemployment/age                              Age-group comparisons (§27)
/explorer/unemployment/gender                           Women/men comparisons (§27)
/explorer/unemployment/industries                       Jobs by industry: everyone, women and men (§27)
/explorer/unemployment/hours                            Usual weekly hours by industry, sex and settlement (§27)
/explorer/unemployment/informal                         Informal share of non-farm jobs: Georgia, women, men, towns and villages (§27)
/explorer/unemployment/young-people                     Young people not in work or study (§27)
/explorer/wages                       ხელფასები         Wages hub (§31)
/explorer/wages/overview                                Average wage with women/men and public/non-public subcategories, and the median (§31)
/explorer/wages/industries                              Wages by economic activity for a chosen group (§31)
/explorer/wages/regions                                 Region map and ranked list (§31)
/explorer/wages/regions/[id]                            11 region wage pages (§31)
/explorer/living-standards            ცხოვრების დონე    Living standards hub (§32)
/explorer/living-standards/income                       Household income by source and area (§32)
/explorer/living-standards/spending                     Household spending by category and area (§32)
/explorer/living-standards/income/regions/[id]          Georgia and 11 region income pages (§32)
/explorer/living-standards/spending/regions/[id]        Georgia and 11 region spending pages (§32)
/explorer/living-standards/poverty                      Poverty rates on three tabs: poverty line, relative, international (§32)
/explorer/living-standards/inequality                   Gini coefficients (§32)
/explorer/health                      ჯანდაცვა და სოციალური დაცვა  Health and social protection hub (§36)
/explorer/health/doctors-hospitals                      Doctors and hospitals (§36)
/explorer/health/illnesses                              Illnesses (§36)
/explorer/health/causes-of-death                        Causes of death: death rate by region, map and ranked list (§36)
/explorer/health/causes-of-death/regions/[id]           Georgia and 11 region causes-of-death pages (§36)
/explorer/education                   განათლება         Education hub (§39)
/explorer/education/schools                             Schools: municipality map and ranked list by pupils (§39)
/explorer/education/schools/georgia                     Georgia schools page (§39)
/explorer/education/schools/region/[id]                 11 region schools pages; Tbilisi is region/tbilisi (§39)
/explorer/education/schools/[slug]                      63 municipality schools pages (§39)
/explorer/education/kindergartens                       Kindergartens: municipality map and ranked list by children (§39)
/explorer/education/kindergartens/georgia               Georgia kindergartens page (§39)
/explorer/education/kindergartens/region/[id]           11 region kindergartens pages (§39)
/explorer/education/kindergartens/[slug]                63 municipality kindergartens pages (§39)
/explorer/education/universities                        Universities: students, newly admitted and graduates (§39)
/explorer/education/vocational                          Vocational colleges: admitted and graduates (§39)
/explorer/science-culture              მეცნიერება და კულტურა  Science and culture hub (§40)
/explorer/science-culture/research                      Research: researchers, R&D staff, institutions and spending (§40)
/explorer/science-culture/patents                       Patents: invention and utility model applications and patents (§40)
/explorer/science-culture/museums                       Museums: region map and ranked list by visitors (§40)
/explorer/science-culture/museums/[id]                  Georgia and 11 region museum pages (§40)
/explorer/science-culture/theatres                      Theatres: audience, shows, events, theatres, seats and staff (§40)
/explorer/crime                        დანაშაული და მართლმსაჯულება  Crime and justice hub (§38)
/explorer/crime/recorded                                Recorded crimes (§38)
/explorer/crime/convictions                             Convictions (§38)
/explorer/crime/prisons                                 Prisons (§38)
/explorer/crime/victims                                 Victims (§38)
/explorer/crime/road-accidents                          Road accidents (§38)
/explorer/trade                       საგარეო ვაჭრობა   Trade hub (§28)
/explorer/trade/overview                                National goods overview (§28)
/explorer/trade/partners                                Trading partners (§28.1)
/explorer/trade/products                                Goods by product (§28.2)
/explorer/trade/domestic-exports                        Domestic exports and re-exports (§28.3)
/explorer/trade/services                                Services trade (§28.4)
/explorer/external                    საგარეო ნაკადები   External flows hub (§30)
/explorer/external/money-from-abroad                    Money from abroad (§30)
/explorer/external/foreign-investment                   Foreign investment (§30.1)
/explorer/external/current-account                      Current account (§30.2)
/explorer/external/foreign-debt                         Foreign debt (§30.3)
/explorer/external/reserves                             Reserves (§30.4)
/explorer/energy-food                ენერგეტიკა და სურსათი  Energy and food hub (§33)
/explorer/energy-food/energy-supply                     Energy supply (§33)
/explorer/energy-food/electricity                       Electricity (§33)
/explorer/energy-food/energy-use                        Energy use (§33)
/explorer/energy-food/food-self-sufficiency             Food self-sufficiency (§33)
/explorer/energy-food/farming                           Farming (§33)
/explorer/environment                 გარემო და კლიმატი  Environment and climate hub (§41)
/explorer/environment/greenhouse-gases                  Greenhouse gases (§41)
/explorer/environment/air-pollution                     Air pollution: eight pollutants (§41)
/explorer/environment/air-quality                       City air quality: nine city cards (§41)
/explorer/environment/air-quality/[city]                9 city air-quality pages, 16 stations (§41)
/explorer/environment/climate                           Temperature and rain (§41)
/explorer/environment/water                             Water (§41)
/explorer/environment/waste                             Waste: region map and ranked list (§41)
/explorer/environment/waste/[id]                        Georgia and 11 region waste pages (§41)
/explorer/environment/forests                           Forests: region map and ranked list (§41)
/explorer/environment/forests/[id]                      Georgia and 11 region forests pages (§41)
/explorer/demography                  დემოგრაფია        Demography hub (§29)
/explorer/demography/population                         Population on 1 January: index — municipality map, key figures, ranked list (§29)
/explorer/demography/population/georgia                 Georgia page (§29)
/explorer/demography/population/region/[id]             11 region pages (§29)
/explorer/demography/population/[slug]                  63 municipality pages; Tbilisi is its region's page only (§29)
/explorer/demography/age-sex                            Age and sex: Georgia's pyramid, age-by-year heat map, regions by 65+ share as a non-clickable glance (§29.3)
/explorer/demography/migration                          International migration by citizenship (§29.1)
/explorer/demography/births-deaths                      Births, deaths and fertility (§29.2)
```

Outside `/explorer` sit the two editorial pages, `/about` (§23) and `/connect`, the MCP connection page (§24), and the methodology centre at `/methodology` and `/methodology/[dataset]` (§21).

Public municipality routes use the explicit lowercase-ASCII `[slug]` registry. Numeric municipality codes remain internal data, geometry, and join identifiers; they are not the public route identity.

The section **is the route** — not React state, not a hash key. Sections are reached from the sidebar's nested list under `ბიუჯეტი` (§6.7) or from the hub cards; there are no in-page nav tabs. Section order is fixed and identical in both places: `ხარჯები`, `შემოსავლები`, `მუნიციპალიტეტები`, `ანალიზი`, `ვალი`, `დეფიციტი`.

Every surface under `/explorer` opens with the **breadcrumb row** (§6.7): `მთავარი / მონაცემები / ბიუჯეტი` on the hub, `მთავარი / მონაცემები / ბიუჯეტი / <section>` on a section. Municipality entity pages extend that hierarchy through their real region before the municipality name (`… / მუნიციპალიტეტები / იმერეთი / ჭიათურა`); the visible trail and `BreadcrumbList` JSON-LD use the same region route. Its right slot is a mono **coverage** label — `{range} · განახლდა {YYYY-MM-DD}` (English `Updated {d Month yyyy}`) for the route's active scope, not the user's selection (the range strip owns that, and the two facts live at different altitudes). One formatter (`lib/explorer/coverageLabel.ts`) writes it on every route, every hub included, except the Demography pages, which print `{first}–{last} · 1 იანვრის მდგომარეობით` (§29); the range uses the unspaced en dash for month ranges as well as years.

On the section routes, under the page title, sits the **deck line**: `year: Total` (`სულ`) in the body face and the latest-year total `X` in mono (the explorer) plus a colored YoY delta and the phrase `წინა წელთან` (`year on year`); the line fits one line at 375px in both languages (§17). The analysis deck is the YoY delta alone: its year, category count and total are the first headline card right below it. The hub has no deck line — it opens with the serif H1 `საქართველოს ბიუჯეტი` and a plain lead paragraph.

### 6.3 URL State (deep linking)

The section lives in the route (§6.2). Everything else about a screen serializes into the URL hash so any view is shareable:

```text
/explorer/expenditure#g=fields&m=line&sh=1&r=2004-2025&sel=id1,id2   (explorer sections)
/explorer/analysis#as=expenditure&ag=ministries&ay=2024              (analysis)
```

Keys by section. The hash never carries `nav`, and no key is renamed once shipped — shared links depend on them.

| Section | Keys | Notes |
|---|---|---|
| Expenditure, revenue, analysis | `g` grouping (expenditure only), `m` mode, `sh` share measure, `r` range, `sel` selection; `as` analysis side, `ag` analysis grouping, `ay` analysis year | — |
| Municipalities | `m`, `sh`, `r`, `sel` on the country, region and municipality pages; `lvl=region` on the index | `lvl` switches the index list to regions. |
| Government debt | `f` family, `m`, `sh`, `r`, `sel` | An empty `sel=` is a deliberate clear and survives a reload. |
| General-government deficit | `m`, `sh`, `r`, `sel` | A missing `sh` means percent of GDP, the section's default measure. |
| GDP overview | `indicator`, `view`, `currency`, `range=all` or `start`/`end` | — |
| Economic sectors, GDP by expenditure | `measure`, `view`, `sel`, `range=all` or `start`/`end` | — |
| Inflation overview | `i` indicator, `m` mode, `r=YYYY-MM-YYYY-MM`, `sel`, `t` table series | — |
| Inflation categories | `i`, `m`, `r`, `sel`, `t`, `x` expanded divisions | — |
| Inflation cities | `m`, `r`, `sel` (place slugs on the Georgia page; `total`, `01`–`12` on a city page), `t` table line | — |
| Demography age and sex | `year`, `cmp`, `measure` on the national page | Written with replace, never push. A key at its default is omitted (`year` is the latest year, `measure` is the share), so a pristine URL stays clean. `cmp` holds the comparison year and is absent when the comparison is off. Unknown values are rejected, an unloaded `year` falls back to the latest year, an unloaded `cmp`, or one equal to `year`, is dropped, and `measure=persons` across the 2025 re-base is read as the share. A `bands` key from the withdrawn age-groups part and a `pyramid` key from the withdrawn table switch are ignored. The place block on the Georgia and region pages keeps no state in the address. |
| Demography population | `m`, `r`, `sel` on the Georgia, region and municipality pages; `lvl=region` on the index | `sel` holds the ticked place ids, Tbilisi as `region.tbilisi`; `lvl` switches the index list to regions. No share measure exists, so a pasted `sh=1` is kept and ignored. A partial link such as `#m=table` is rewritten to the full form once on load, as on the Budget pages; a pristine or full link is left as it is. |

Write rules: loading a page never adds state to its URL, so a pristine URL stays clean. After that, every change replaces the current history entry, except the discrete switches a section's spec asks Back to step through, which push one — today only the economic sectors measure and view.

Restore on load with validation (unknown values fall back to defaults; ranges clamp to loaded years; repeated selection IDs collapse to their first occurrence).

Links shared before the route split still work: `/explorer#nav=expenditure|revenue|analysis` is honored once by a client component mounted on the hub, which reads the hash on mount and `router.replace`s to the matching route with `nav` stripped and the rest of the hash preserved.

The landing links into the dataset hubs (hero CTA → `/explorer`, the dataset row, the footer, which lists all eighteen) and into the budget sections from its ledger (§19).

### 6.4 Rule Hierarchy (replaces cards)

Sections are separated by horizontal rules, in three weights:

- `2px solid ink` — page header bottom, major section tops, table header bottom, table total-row top, aside top rule when stacked.
- `1px solid ink` — primary panel top (chart/table block).
- `1px solid hairline (#D9CFBE)` — sub-section separators, aside left border.
- `1px solid hairline-soft (#E7DECF)` — data row borders, analysis chart grids (radar rings, budget field). The multi-year line chart's grid is the dot lattice of §8.3, not a rule.

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

- Border radius: **0–3px everywhere** (buttons 2px, tooltip 3px). Exception: the national `% მშპ-ში` measure pill, the municipal `% წილი` measure pill, the return-to-chart pill (§7.14), and slider handles/ticks use `999px`.
- Shadows: only the chart tooltip (`0 4px 16px rgba(30,27,22,0.10)`), slider handles (`0 1px 3px rgba(30,27,22,0.15)`), and the floating return-to-chart pill (§7.14), which floats over content and shares the tooltip's shadow. Nothing else casts a shadow.
- Swatches are **14×3px bars**, never dots or rounded squares.
- **Exception: hub cards** (`tile` bg, 1px `hairline` border, radius 0, hover `tint`, no shadow): the budget hub's six cards, which every other dataset hub reuses for its own pages. The one other place they appear is the City air quality index (`/explorer/environment/air-quality`, §41), whose nine city cards use the same hub card component (`BudgetHub` with `HubCardModel`). A hub's peer destinations with no natural reading order are the one place containment beats rules — a rule stack implies a sequence that is not there. Cards remain forbidden everywhere else; this exception does not generalize to panels, KPI blocks, or any other surface.

### 6.7 Shell and Sidebar

Everything under `/explorer` renders inside a persistent shell: a dark sidebar on the left, the content column beside it (max-width 1180px, **centred** in the space left over, page padding `20px` / `34px` at ≥768px). Centring matters past ~1500px: left-aligned, the column strands the whole surplus as one blank margin on the right. Implementation: `apps/web/components/shell/`.

**Sidebar (expanded, ≥900px).** 232px, `ink` background, radius 0, sticky at `top: 0` with full viewport height so it holds while the long explorer page scrolls. When its links exceed the viewport height, the expanded sidebar's panel below the brand row scrolls on its own. Dividers on ink are `rgba(247,242,233,0.12)`; the active row background is `rgba(247,242,233,0.07)`.

- Brand block → `/`: the reversed mark at approximately 30px, followed by live serif text `Fiscal.ge` in `paper` and live mono text `ღია მონაცემები` (8.5px, 0.1em) beneath in `ink-fg-faint`. This identity is shared by the expanded desktop sidebar and the mobile top bar.
- `მონაცემები /` overline: mono 9.5px, 0.12em, `ink-fg-faint`.
- Eighteen dataset links, in order (one navigation config, `lib/navigation/navTree.ts`, which also feeds the header menu, footer and 404 hub lists): `ბიუჯეტი` → `/explorer`, `ეკონომიკა` → `/explorer/economy`, `ბიზნესი` → `/explorer/business`, `საცხოვრებელი და მშენებლობა` → `/explorer/housing`, `ინფლაცია` → `/explorer/inflation`, `ფული და ბანკები` → `/explorer/money`, `უმუშევრობა` → `/explorer/unemployment`, `ხელფასები` → `/explorer/wages`, `ცხოვრების დონე` → `/explorer/living-standards`, `ჯანდაცვა და სოციალური დაცვა` → `/explorer/health`, `განათლება` → `/explorer/education`, `მეცნიერება და კულტურა` → `/explorer/science-culture`, `დანაშაული და მართლმსაჯულება` → `/explorer/crime`, `საგარეო ვაჭრობა` → `/explorer/trade`, `საგარეო ნაკადები` → `/explorer/external`, `ენერგეტიკა და სურსათი` → `/explorer/energy-food`, `გარემო და კლიმატი` → `/explorer/environment`, `დემოგრაფია` → `/explorer/demography`. The active dataset wears a `2px accent` left border, active-row background and sans 12.5/600 in `paper`; inactive ones are `ink-fg-muted`.
- Only the active dataset's sections nest beneath it: the six budget sections (below), Economy's GDP / sectors / expenditure / regions, Business's Sales / Jobs / Investment and profit / Firms opened and closed / Regions, Housing's Permits / Completed buildings / Home prices / Regions, Inflation's overview / categories / products / cities, Money and banks' Money supply / Loans and deposits / Interest rates / Bank health, Unemployment's national overview / regions / age groups / gender / Jobs by industry / Hours worked / Informal jobs / Young people not in work or study, Wages' overview / industries / regions, Living standards' Income / Spending / Poverty / Inequality, Health's Doctors and hospitals / Illnesses / Causes of death, Education's Schools / Kindergartens / Universities / Vocational colleges, Science and culture's Research / Patents / Museums / Theatres, Crime and justice's Recorded crimes / Convictions / Prisons / Victims / Road accidents, Trade's Overview / Trading partners / Products / Domestic exports / Services trade, External flows' Money from abroad / Foreign investment / Current account / Foreign debt / Reserves, Energy and food's Energy supply / Electricity / Energy use / Food self-sufficiency / Farming, Environment and climate's Greenhouse gases / Air pollution / City air quality / Temperature and rain / Water / Waste / Forests, or Demography's Population / Age and sex / Migration / Births and deaths (Population stays current on its place pages too), all in the section-row style below.
- Teaser datasets (none today) — an `ink-fg-muted` label with a `მალე` badge (1px `#6C6860` border — **3.09:1** on `ink`, above the WCAG 1.4.11 3:1 floor for a component boundary — 2px radius, mono 9px, `ink-fg-faint`), rendered at reduced emphasis (opacity 0.6) so it never reads as a live row. Markers only: not links, not focusable, no route, no data. With none, the sidebar renders no teaser list at all.
- Foot, above a 1px divider: `← მთავარი`. No version string.
- Top-right: the collapse toggle — a 26px box, 1px `rgba(247,242,233,0.18)` border, Lucide `ChevronsLeft` (expanded) / `ChevronsRight` (collapsed) (§7.2a). `ChevronsLeft`/`ChevronsRight` are desktop-only; below 900px the toggle is the Lucide `Menu` / `X` pair (accessible name `მენიუ` / `Menu`, 44×44, no border).

**Section list** (`section-nav.tsx`, nested under `ბიუჯეტი`). Each entry is a route link, drawn by `SidebarSectionLink`, the one section row every hub's pages use. Active: accent `▸` marker, `paper` text at weight 600, active-row background, `aria-current="page"`. Inactive: `ink-fg-muted`, marker held in transparent so labels do not shift. All six sections — `ხარჯები`, `შემოსავლები`, `მუნიციპალიტეტები`, `ანალიზი`, `ვალი`, `დეფიციტი` — render this way; none is a `მალე` marker. The sidebar's hubs and their pages come from `lib/navigation/navTree.ts`: every hub is a list item and its pages a nested list (Budget's from `lib/explorer/sections.ts` through `SectionNav`, which adds any `მალე` rows). A row is current on its own page and on the pages below it (a municipality, region or place page). Removing the section rows means removing a hub's `sections` from that config, not deleting `section-nav.tsx`, which also holds the shared row.

**Collapsed rail (≥900px).** 52px, same `ink` surface, radius 0:

- The toggle stays in place at the top, icon flipped to `ChevronsRight`.
- Below it, the context line runs vertically down the rail, naming the active dataset (`მონაცემები · ბიუჯეტი`, or the Economy / Business / Housing and construction / Inflation / Money and banks / Unemployment / Wages / Living standards / Health and social protection / Education / Science and culture / Crime and justice / Trade / Energy and food / Environment and climate / Demography equivalent), mono 9.5px, `ink-fg-faint`, 0.1em, via `writing-mode: vertical-rl` plus `rotate(180deg)` so it reads **bottom-to-top**. It carries the same two facts the expanded overline and active row carry, which is why the section list can disappear without losing orientation.
- Beneath it, the compact language switch; at the foot, a Lucide `House` icon is the collapsed `← მთავარი` link, with a 26×26 hit area, `aria-label="მთავარი"`, and a `title` tooltip. The collapsed rail remains logo-free.
- **Sections are not reachable while collapsed** — the list is unmounted, not hidden. A 52px rail cannot carry Georgian section names, and reducing them to invented initials would trade one extra click for three ambiguous glyphs. Collapse is a reading posture: it hands the width back to the data and keeps only orientation and escape.

Width transitions at `base` (§14) and snaps under `prefers-reduced-motion: reduce`. The choice persists in `localStorage` under `geodata:sidebar-collapsed`, read after mount; a storage denial falls back to expanded rather than breaking the render.

**Below 900px** (owner decision D3, 2026-10-07). The sidebar becomes a full-width top bar (brand + `☰` toggle, ~56px, safe-area aware) that stays pinned to the top of the viewport while the page scrolls, so the menu is always one tap away. The toggle opens the same nav as a panel hanging directly below the bar, capped at the viewport height minus the bar and scrolling on its own; there is no backdrop. `Escape` closes it and hands focus back to the toggle; a tap outside the bar or on a link closes it. Every panel row — datasets, sections, the language switch and `← მთავარი`, which is a full row — is at least 44px tall. Expanded/collapsed is a **desktop-only** state: a persisted collapse preference is ignored below 900px rather than applied as an unexplained narrow rail, and the mobile toggle only opens and closes the panel.

**Accessibility, and the deviations on record.**

- The toggle exposes `aria-expanded`. On desktop its label flips between `პანელის ჩაკეცვა` and `პანელის გაშლა`; below 900px it is `მენიუ` / `Menu` and points with `aria-controls` to the mounted `data-sidebar-navigation` panel. The collapsed desktop rail omits `aria-controls` because that panel is unmounted.
- There is **no focus trap** on the mobile panel, by decision. A trap is the contract for a modal; this panel is non-modal — no backdrop, the page behind it stays reachable, and a tap outside dismisses it — so trapping would strand keyboard users in a region they can simply tab past. `Escape` to close plus focus return to the trigger is the whole contract.

**Breadcrumb page header** (`page-header.tsx`). One row with a `2px ink` bottom rule, rendered per route (the final crumb differs per route, and a server layout cannot read the child route). Crumbs: sans 10.5px uppercase 600 in `muted`, current crumb in `ink`, separators `/` in accent. `მთავარი` links to `/`; `მონაცემები` is plain text with no route; `ბიუჯეტი` links to the hub on section routes and is plain text on the hub. Right slot: the mono 10.5px `faint` coverage label of §6.2 — the loaded range of the route's active scope, so it tracks the grouping, and the union of both sides on the hub. Unemployment region pages end the trail with the region name.

Below 768px (owner decision D10, 2026-10-07) the trail is replaced by a single back-link to the nearest linked parent (`← ბიუჯეტი`), sans 11px uppercase with a 44px target. From 768px the full trail shows; the `BreadcrumbList` JSON-LD is the same at every width.

The crumbs carry `BreadcrumbTrail`'s semantics, not its markup: a localized breadcrumb `nav` landmark (`aria-label` from the messages: `Breadcrumb` in English), `aria-hidden` separators, and `aria-current="page"` on the final crumb. They deliberately do **not** reuse the component itself — `BreadcrumbTrail` renders its own `BreadcrumbJsonLd`, and these routes already emit one, so reusing it would ship two structured-data blocks per page. Marking the current page by colour alone, in a paragraph of spans, is what this replaced: on the site's largest set of routes the trail was not a landmark and read as a run-on string with the slashes announced.

**Footer.** Every `/explorer` route renders `SiteFooter` (§19) at the foot of the content column — inside it, not beside the sidebar — with the pages' own horizontal padding so its rule lines up with the content above. The footer uses the compact lockup at approximately 150px and retains its trust, navigation, contact, and CC BY 4.0 licence content (anatomy in §19). Explorer and methodology-article footers name the relevant dataset's source institutions; review dates remain in the page's existing source note or article header. They do not repeat the site-wide latest review date as if it applied to that dataset. Generic footers explicitly label the landing model's `updatedAt` as the latest source review across Fiscal.ge. These routes are the site's main SEO landing targets, and the footer is where the licence, contact address and methodology link live (§21).

**Budget hub (`/explorer`).** Breadcrumb, serif H1 `საქართველოს ბიუჯეტი`, a concise lead covering budgets, debt and deficit, then six cards in a two-column grid (one column below 768px, max-width 860px). It has no source note of its own: the footer note and the header's coverage label carry the source and update date. Card anatomy, in order: mono index in accent with `→` right-aligned, serif 18px title, 11.5px `muted` description, graphic, mono 10px `faint` footer (`muted` while the card is hovered: `faint` on the `tint` hover fill is 4.21:1). A card link is named by its title and described by its description and footer; the index is `aria-hidden`. The sparkline draws at 200×34 from 768px and at the full card width below it; a card without a graphic keeps the empty 34px band so footers align.

| # | Card | Graphic | Footer | Links to |
|---|------|---------|--------|----------|
| 01 | `ხარჯები` | total expenditure series, `Sparkline` at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/expenditure` |
| 02 | `შემოსავლები` | total revenue series, same at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/revenue` |
| 03 | `მუნიციპალიტეტები` | total municipal series, `Sparkline` at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/municipalities` |
| 04 | `ანალიზი` | none | `{latestYear} · {n} კატეგორია` | `/explorer/analysis` |
| 05 | `ვალი` | total Government Debt stock series, `Sparkline` at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/debt` |
| 06 | `დეფიციტი` | actual general-government balance as `% მშპ-ში`, `Sparkline` at 200×34 in `ink` | `{latestActualYear} · {balance}% მშპ-ის` | `/explorer/deficit` |

All five sparklines are `ink` because each traces a **total or balance** (a side total for cards 01/02, the municipal total for card 03, Government Debt stock for card 05, and the general-government balance for card 06). `accent` is not free chrome here: `#B3402A` is the token of `spending.social_protection` and `revenue.vat`, so an accent aggregate would draw one quantity in another category's color.

Every figure on the hub — series, footers and card 03's description counts alike — is computed at build time from the same served facts the section pages use, so the hub cannot drift from the pages behind it. Nothing on it is hardcoded.

## 7. Core Components

Specs below are contracts; visual proof lives in the reference files.

### 7.1 Header / Nav

The public-site header appears on the landing page (§19), `/about` (§23), the methodology hub, and every live dataset methodology route. Surfaces under `/explorer` use the sidebar of §6.7 and its breadcrumb page header instead, and have no nav tabs. The landing, mission, and methodology surfaces use one shared component.

The brand link uses the reviewed full v2.0 horizontal lockup at 280px from 900px upward and the standalone symbol below 900px. The full horizontal lockup must not render below 280px; the standalone mark must not render below 24px. The supplied token JSON's 180px lockup value is not authoritative for production.

Vertically centered logo row: lockup left, navigation centered independently of the side content, language switch right; no coverage-year label or bottom rule. From 900px, equal outer grid columns keep navigation at the header's true midpoint. Below 900px, a single compact row contains the standalone logo symbol on the left, a centered bold Fiscal.ge wordmark without a tagline, and an icon-only Menu button on the right. The button retains a localized accessible name. The button expands navigation links and the KA / EN language switch beneath it; the language switch stays inside this panel, with each language target at least 44×44px. A link that shows `KA` / `EN` (here and in the collapsed rail) carries the full language name after it as visually hidden text, so its accessible name starts with what it shows. In the panel, `მონაცემები` is a label over the eighteen dataset hub links, in the sidebar's order (§6.7) and from its one navigation config (`lib/navigation/navTree.ts`); from 900px the single `მონაცემები` → `/explorer` link stays (owner decision D3, 2026-10-07; all hubs per Q3, 2026-10-12, recommended default pending the owner's answer). Escape closes the panel and returns focus to the button; following a link or crossing the desktop breakpoint closes it. Nav tab: sans 13px; active = ink, weight 600, `2px accent` text underline with a `5px` offset; inactive = muted, weight 500. The landing page marks `მთავარი` active. `/about` marks `მიზანი` active. Methodology routes mark neither `მთავარი` nor `მონაცემები` nor `მიზანი` active and render no `aria-current`, because methodology remains inactive as a separate destination; no methodology tab is added.

The English hero heading uses two explicit lines: `Georgia` followed by `in numbers`. English hero statistics and city population labels abbreviate thousand as `k` (for example, `69.7 k km²`).

### 7.2a Mode Control

A segmented control for `ხაზი / ცხრილი` in the chart controls row, and the bounded measure switches of national sectors, money and banks and business: inline-flex, 1px `control` border, 2px radius. Text segments are mono 10.5px with 0.04em tracking and `6px 13px` padding; the divider between them is the shared 1px `control` border. Active segment: `ink` background, `paper` text. Inactive: `muted` on transparent, hover `tint` + `ink`. The group has `role="group"` with a localized label; each segment keeps `aria-pressed`. Icon segments use 36×36px targets and allow tooltips outside the border; text-only groups retain overflow clipping.

### Functional icon standard — Lucide

Lucide (`lucide-react`) is the project's chosen functional icon family. Use named imports of only the required icons, not a dynamic all-icons registry or another icon library. Default: 18×18px, 1.5px stroke, `currentColor`, no decorative fill, gradients or animation. Keep button sizes, focus rings and existing ink/paper/tint states from their owning controls; do not restyle the application to match an icon library. The dependency version is pinned in the package manifest/lockfile. Lucide's ISC licence permits commercial use; retain its packaged licence notices.

Icon-only controls must keep a localized accessible name on the button/link; the SVG itself is decorative (`aria-hidden`). Measure controls show the full label on hover and keyboard-visible focus, with Escape dismissal and hoverable tooltip content. Mouse/touch clicks must not latch the tooltip open after the pointer leaves. Touch users can read the selected measure's explanation beneath the heading, except on the household Income and Spending pages and their area pages (Georgia and the regions), whose latest-value line is fixed to the page's area per household, so the measure is read from the series panel caption, the source line and, on the section pages, the map legend. Crime and justice is the other exception: its latest-value line always shows the count headline (§38), so the per 100,000 view is read from the chart panel's unit caption beside the measure switch. Reuse `SegmentedTabs` and `ControlTooltip` for this pattern.

National-sector mapping: literal `₾` for nominal GEL, Lucide `ChartPie` for share of GDP, `ChartNoAxesCombined` for real growth; the money and banks pages reuse `₾` and `ChartPie`, and add `CircleDollarSign` for share in foreign currency (money and banks). The chart icon denotes a measure, not a promise of positive growth. The household measure switch uses Lucide `User` for per person. Dated exception (owner approval, 2026-10-12): per household uses one solid non-Lucide glyph, Material Symbols `family_restroom` (outlined, weight 400, Apache-2.0, © Google), because Lucide has no family icon. It is filled with `currentColor` at the same 18px as `User`, used for this one button only, kept in `components/ui/household-icon.tsx`, and is not a second icon family. Existing functional menu/close, sidebar collapse/expand and compact home controls use Lucide `Menu`, `X`, `ChevronsLeft`, `ChevronsRight`, and `House`. Logos, brand assets, maps and actual data visualizations are not UI icons and remain unchanged. Conventional checkbox marks, textual carets and arrows embedded in prose remain typographic; do not add decorative icons or indiscriminately replace text with symbols.

A boxed either/or switch is the honest affordance for choosing which view of the same data you are looking at. A filter is not that — do not box the tab groups of §7.2b.

### 7.2b Grouping Tabs

Text-only, sans 12.5px; active = ink 600 with `text-decoration: underline`, 2px thickness, accent color, `text-underline-offset: 4px`. No backgrounds. Below 768px each tab is a 44px-tall target at least 24px wide (§12); the look from 768px is unchanged. In the **explorer**, the grouping tabs (`სფეროები / სამინისტროები`, expenditure multi-year only) live in the series aside, directly under the `სერიები` header row (gap 18px, 12px padding-bottom, 1px `row-border` bottom rule). Below 1100px of column width they lead the chart panel instead, above the `ხაზი / ცხრილი` row, with the same state and URL key `g` (owner decision D4, 2026-10-07). In the **analysis view**, the side tabs (`ხარჯები / შემოსავლები`) and grouping tabs use this same style, separated by a 1px×13px `control` vertical divider. Every row of text tabs is a named group (`TextTabGroup` or an equivalent `role="group"` with a localized label), each tab keeping `aria-pressed`, as `SegmentedTabs` (§7.2a).

### 7.3 Measure Pill (% მშპ-ში)

Height 27px from 768px and 36px below it, pill radius, 1px `control` border, transparent bg, muted text. Active: ink bg, paper text, ink border, `aria-pressed`. This is the only pill control in the national multi-year explorer (the return-to-chart pill of §7.14 is a scroll shortcut, not a control of the data). Active `% მშპ-ში` divides every national revenue or expenditure amount, including the derived total, by Geostat's same-year nominal GDP at current prices. The denominator is independent of series selection. Missing same-year GDP renders a gap. Municipal explorers retain their `% წილი` pill as share of the active municipality, region, or Georgia budget total, and single-year analysis retains composition shares. The pill is a measure, not a GDP page; GDP has its own overview at `/explorer/economy/gdp` (GDP overview extension).

Active, the label is preceded by a decorative `✓` (not part of the accessible name; `aria-pressed` carries the state), and the unit caption beside the pill is not shown, so caption and pill never repeat the same text; inactive, the caption names the current unit (`მლრდ ₾`). The municipal `% წილი` pill follows the same rule; below 768px its amount caption shortens to `მლნ ₾` so the pill stays on the controls row.

### 7.4 Range Quick Chips (5წ / 10წ / ყველა)

Mono 11px text links; active = ink 600 underlined (accent underline); inactive = muted 400. `5წ` shows only when >5 loaded years, `10წ` only when >10. Below 768px each chip is 44px tall (§12).

When the strip carries a boundary marker (e.g. `პროგნოზი`), the rail gains top margin so the label clears the chips, and the label is shifted by its position so it stays inside the strip.

There is **no one-year chip**. Every figure in `ძირითადი ინდიკატორები` is a
start-to-end delta, so a range of one year zeroed the entire section — a headline
`0.0%`, movers falling back to row order, and a single category named both the
largest and the slowest growing. The rail handles can still collapse the range to
one year, which is what the §8.5 guard covers.

### 7.5 Range Slider

24px-high rail: 3px `hairline-soft` track, accent fill at 40% opacity between handles, 15px round handles (paper fill, 2px accent border, handle shadow). The rail is clean — no per-year tick dots. Below 768px the rail is inset 8px on both sides so a handle at rest sits outside the edge-swipe zone. On monthly strips the readout's month and year are each a native select (dotted underline), so an exact month is one tap away; a pick beyond the other handle snaps to it. Handles are buttons with `role="slider"`, aria value attributes, and Arrow/Home/End keyboard support. Mono min/max year labels below.

### 7.6 Series Row (aside panel)

Row: 1px `row-border` bottom border; hover/selected bg `tint`; a 2px accent left rail marks expanded ministries and program rows. Toggle button (`aria-pressed`): 14px square checkbox (1.5px `control` border; checked = the row's series-colour fill + paper ✓), swatch bar shown for selected and unselected rows, sans 12.5/500 label clamped to 2 lines, latest value mono 11 muted right-aligned. Values and metas are `muted` at full opacity. An optional visible header names the row values (inflation categories: basket share · active tab value, `პპ` for contributions). Ministries rows add a caret button (`▸/▾`, `aria-expanded`, a 24px column, named after its row — `{row} — ქვეკატეგორიები` unless the page names it) that expands the ministry's major programs; program rows are indented, sans 11.5/400 in `body` color. A caret's shown children sit in a `role="group"` named after their parent, which the caret's `aria-controls` names, so the hierarchy is not visual only. Program rows show names only — official program codes stay in the data layer (they fragment across reorganizations) and are not surfaced.

### 7.7 Search

The shared selector order is: optional grouping tabs (moved above the chart below 1100px, §7.2b), search, an action/status row, then the series list. The action/status row places `გასუფთავება` / `ყველას მონიშვნა` on the left. Ordinary scopes show `სერიები {selected} / {all}` on the right; ministries show `ძირითადი {selected} / {all} · პროგრამები {selectedPrograms}`. The bulk control is a plain action button named by its visible word (`გასუფთავება` / `ყველას მონიშვნა`, WCAG 2.5.3); its decorative, `aria-hidden` square shows three states: empty, partial with a centered ink dash, or ink-filled with a paper checkmark (`data-state` `false` / `mixed` / `true`). Empty selects all; partial and full states clear all. Search never scopes the count or bulk action; selection remains unlimited. The search field is shown only when the list has more than ten rows (`SEARCHABLE_MIN_ROWS`); debt, deficit, the inflation overview and the Georgia inflation-cities list have none.
Both the count's denominator and the bulk action cover the **top-level rows
only** — the total and its categories, the rows the panel lists before any caret
is opened. Collapsed major programs are neither counted nor selected by
`ყველას მონიშვნა`, so the ministries' `ძირითადი` denominator reads `/ 15`, not
`/ 63`. The separate `პროგრამები` figure counts every selected program, including
one whose caret is later collapsed, so the status never understates the chart.
A program is still selectable individually once its caret is open; `გასუფთავება`
clears everything, programs included.

**Long lists scroll inside their panel** (exception to D4, 2026-10-12). D4's rule that a stacked list flows with the page was written for short lists. A list of more than 30 rows (`LONG_LIST_ROWS`; trade partners 218, domestic-export countries 187, inflation products 305) uses `listLayout="scroll"`: the list scrolls inside a box of at most `min(430px, 60svh)` at every width, so the content after it stays within a couple of screens of the chart. Before the list sits a `სიის გამოტოვება` / `Skip the list` button, hidden until it has keyboard focus, that moves focus to the end of the list (a button, not an in-page link, because these pages keep their state in the URL hash). Trade partners and domestic-export countries also put their Excel button above the list, under the end-year · unit line (§7.8). The inflation products list keeps its phone top ten and `მეტი პროდუქტი` button; after that button the remaining rows scroll inside the same box.

Underline-only input: h34, no box, 1px `control` bottom border, transparent bg, sans 13px, radius 0. Search inputs are `type="search"` with `enterkeyhint="search"`; on stacked layouts focusing the field scrolls it to the top of the viewport so results stay above the on-screen keyboard. The placeholder is `ძებნა` / `Search` in every series panel, the products list and the municipal and regional indexes (all underline fields, h34); heading pickers keep their descriptive placeholder. A query with no matches shows `კატეგორია ვერ მოიძებნა — შეცვალე საძიებო ტექსტი.` The total row stays pinned regardless of the query, so this message names the categories that missed rather than claiming zero results — it would otherwise render directly above a visible `მთლიანი ხარჯი`. While searching in ministries grouping, ministries with matching programs auto-expand to show only matching programs (their caret is locked open); a ministry matched by name still honors its caret and expands to all of its programs. Search ignores accents (`turkiye` finds `Türkiye`); trade partners match their Georgian and English names in either language, Geostat's partner code and a few common names their labels lack (`Turkey`, `USA`, `UK`). The query is panel-local state and resets on ANY scope switch — nav (ხარჯები↔შემოსავლები) and grouping alike; typing must not re-render the chart.

### 7.8 Excel Button

Excel remains dataset-owned below the selector and is not part of the shared selector contract. Trade partners and domestic-export countries place it above their long list instead (§7.7).

Full-width block, h38, ink bg, paper text, sans 12.5/600, radius 2px. Hover: opacity 0.85. Label: `ჩამოტვირთვა`; while creating the file it is disabled and reads `Excel მზადდება…`; failures show `ფაილი ვერ მომზადდა — სცადეთ თავიდან.` below the action. There is one public action, no public explorer CSV action or format menu. It creates a Fiscal.ge `.xlsx` file for the active range, selected series, grouping, and measure; selector search never narrows it. The three visible sheets are `მარტივი ცხრილი`, `მონაცემები`, and `წყაროები` (§15).

### 7.9 Callout / Notice

Tint bg, `2px accent` left border, sans 11.5–12.5px, `body` color, max-width 560px. Used for empty selection, no-growth-data, and load-error states.

### 7.10 Source Note

Sans 12px, muted, plain paragraph under the primary panel and at the end of the analysis view. Below 768px its links answer taps 4px above and below their text, a 24px target (WCAG 2.5.8), without moving a line. Pattern:

```text
მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო). <coverage note> · 12-თვიანი ფაქტობრივი შესრულება. <classification note> ბოლო განახლება: YYYY-MM-DD.
```

Coverage notes state actual loaded ranges (e.g. `ხარჯვითი მონაცემები: 2004–2025`, `შემოსავლების მონაცემები: 2005–2025`).

The classification note is a required data-trust disclosure — year totals are official, but the category split is Fiscal.ge's own mapping and must say so on every expenditure surface:

- fields: `კატეგორიებად დაყოფა Fiscal.ge-ის კლასიფიკაციაა ოფიციალური ფუნქციური (COFOG) კოდების მიხედვით.`
- ministries: `უწყებრივი დაჯგუფება Fiscal.ge-ისაა ბიუჯეტის შესრულების ანგარიშების პროგრამული კლასიფიკაციის მიხედვით.`
- revenue: none (revenue categories are the official budget-classification lines).

### 7.11 KPI Block

No card: overline label, serif value, muted detail line. Two variants: analysis headlines (serif 34, four per row) and indicators side KPIs (serif 24, stacked with `hairline-soft` separators, value left / detail right on one baseline; the detail is ellipsized on one line from 768px and wraps below it).

**Sparkline.** Every side KPI carries one, left-aligned under the value/detail row with a 6px top margin. Pure SVG, no client state, safe from a server component (`components/ui/sparkline.tsx`).

- 64×16 by default, 1.2px stroke with round caps and joins, 1px inset so the stroke never clips. No axis, no end dot, no fill.
- The domain is the min/max of the non-null values; an all-equal series draws a flat mid line rather than pinning to an edge.
- Nulls split the polyline into segments and are **never bridged**, matching the chart rule of §8.3. Fewer than two non-null points renders nothing rather than a misleading flat line.
- `aria-hidden`: the KPI value and detail line already carry the meaning, and a 64px decoration has nothing to add to a screen reader.

| KPI | Series plotted | Color |
|-----|----------------|-------|
| `ყველაზე დიდი ზრდა` | that row's values across the selected period | its category color |
| `ყველაზე ნელი ზრდა` | that row's values across the selected period | its category color |
| `ყველაზე დიდი წილი მშპ-ში` | that row's **share of same-year nominal GDP** | `accent` |

The third is deliberately a different metric: the KPI states a percentage, so the sparkline traces that percentage — which is also why it reads jagged next to two smooth level lines. Years where either side is null, or the total is zero, produce a null point. The hero KPI (§7.12) keeps its gauge and gets no sparkline. The same component draws the hub graphics at 200×34 (§6.7).

### 7.12 Hero KPI (indicators)

The first indicator (`პერიოდის ცვლილება`) is a hero block: overline, serif 62px value (accent-negative if the period change is negative), then a 3px two-segment gauge (ink = base year total share, accent = delta), mono `year · amount` labels at both ends, and an editorial sentence with mono-set delta and CAGR values:

```text
2004–2025 წლებში ჯამური ხარჯები გაიზარდა X მლრდ ₾-ით — საშუალო წლიური ზრდა +Y%.
```

### 7.13 Mover Row

Grid `24px 1fr 96px 72px`: mono rank (`01`), sans label (ellipsized from 768px; wraps below it), 3px horizontal bar (track `hairline-soft`, fill positive/negative color, width relative to max |change|), mono % right-aligned. Board = two columns: `ყველაზე მზარდი` / `ყველაზე ნელი ზრდა`. If a "bottom mover" is still positive growth, the copy stays `ყველაზე ნელი ზრდა` — never call growth a loss. The reviewed residual bucket (`spending.other_unclassified`) and any row that is exactly zero in the end year never appear on the board or in the growth KPIs (owner decision D11, 2026-10-07); they stay in tables, series and the period comparison.

### 7.14 Return-to-Chart Pill

Stacked layouts (<1100px) only (owner decision D4, 2026-10-07). It appears when the selection changes while less than half the chart is visible: fixed bottom-centre, safe-area aware, at least 44px tall, pill radius, `paper` with a 1px `ink` border and the chart tooltip's shadow (`0 4px 16px rgba(30,27,22,0.10)`), sans 13/600, the selected swatches (at most six, then `+N`), Lucide `ArrowUp` (18px, 1.5 stroke) and `გრაფიკი` / `Chart` (`ცხრილი` / `Table` in table mode). A tap scrolls to the chart panel; the pill hides when the chart is in view or after 4 seconds. It is the only other surface allowed that shadow (§6.6).

### 7.15 Year Picker

`YearPicker` (`components/ui/year-picker.tsx`) chooses one year in place where a native select's browser-drawn list would show; the Age and sex page (§29.3) uses it. The trigger is a button with the small muted label above it and the value (mono for a year) with Lucide `ChevronDown` / `ChevronUp` (16px, 1.5 stroke, sized to the 12px text rather than the 18px default) on the same underlined select look as Unemployment's native select (`SELECT_CLASS`) but with its own classes, since a button is not a select: 1px `control` bottom rule, transparent, 12px. The trigger fills its picker, so the underline spans the label and does not change width with the value; each picker is a fixed 168px wide from 768px (room for `შედარება წელთან` and `არცერთი`) and full width, with a 44px trigger, below. It opens `RegionPicker`'s panel (§26: `tile`, 1px `control` border, `z-40`, 248px, at most 92vw) under the trigger: an optional full-width none row, then the years ascending in a four-column grid, mono 12.5px, centred, 36px tall (44px below 768px), hover `tint`, the selected cell `tint` with a 2px `accent` bottom rule and weight 600. An optional marked year carries a small accent `*`, explained by an 11px muted footer under a `hairline-soft` rule. On open the panel is scrolled into view if any of it is below the fold. The panel is a `listbox` with `option`s and `aria-activedescendant`, focused on open at the selected option; mouse presses inside the panel never take focus from it. The active option is drawn with the 2px accent focus ring when the list has keyboard focus, and after any arrow-key move even if the grid was opened by mouse: ←/→ move one, ↑/↓ one row (the none row sits above the first row), Home/End jump to the ends, Enter or Space choose and close, Escape and Tab close without a change, and all of them return focus to the trigger; an outside click closes too. Nothing animates.

### 7.16 Native Select

A native dropdown (`SELECT_CLASS` in `components/ui/editorial.tsx`: Unemployment's indicator and Wages' group menu; the monthly range strip's hidden month and year selects, §7.5; `TableSeriesPicker`, §25) is 16px and at least 44px tall below 768px, so iOS Safari does not zoom the page when it takes focus (Q5, 2026-10-12). From 768px each keeps its compact look.

## 8. Multi-Year Explorer

Canonical contract: this section and the reusable component contracts in §7.

### 8.1 Defaults

Side: expenditure. Grouping: fields. Mode: line. Measure: nominal GEL. Range: full available per scope. Selection: **the applicable total only** per scope (fields, ministries, revenue, municipalities, regions, and the Georgia municipal aggregate each keep their own selection and range). The total is first, ink-coloured, selectable, and removable. Series selection is unlimited; search filters visible rows only and never scopes the count or bulk action.

### 8.2 Layout

```yaml
workspace:
  display: grid
  columns: "minmax(0,1fr) 292px"   # <1100px: one column, aside below with 2px ink top rule
  gap: "40px"
```

Left: segmented control + unit note + measure pill row → chart or table → range strip → source note. Right (aside, sticky, 1px hairline left border, 26px padding-left): `სერიები` overline, grouping tabs (expenditure only, §7.2b), search, action-left/status-right row, series rows, dataset-owned Excel button. The series list scrolls inside a ≤430px box only in the sticky two-column aside (≥1100px); stacked, the list flows with the page (owner decision D4, 2026-10-07), except a list over 30 rows, which scrolls inside its panel at every width (§7.7).

### 8.3 Line Chart

SVG on paper (no plot frame), viewBox 920×320: a dot lattice for the grid (below), `1px ink` line at zero, 1px `hairline` y-axis line; axis labels mono 11px muted (y labels right-aligned outside the plot; left padding 74 minimum, widened to fit the widest label so no label clips); year labels thinned to ≤12 (first anchored start, last anchored end); series polylines 2.2px round-joined with a 3.5px dot on the final point only; no in-plot direct labels. Hover/pointer: 1px `#C9BEA9` vertical guide (the same chart-local hex as the lattice, §below), ring markers (paper fill, 2px series stroke), tooltip (tile bg, 1px hairline border, radius 3, tooltip shadow, mono year + swatch/label/value rows; flips side past 60% width). The tooltip is bounded because selection is unlimited: series with no value at the hovered year are dropped rather than shown as `—`, the rest are ranked by value descending, at most 10 are listed, and any remainder becomes a `+N სხვა` line. It is capped at the height of the plot it sits in, since the chart's `overflow-x` frame would otherwise clip it. Touch: a tap pins the readout for the tapped period until the same period is tapped again or a tap lands outside; from 768px the pinned tooltip sits in the top corner of the visible frame, away from the finger. Below 768px every readout (tap, hover, keyboard) renders instead as an in-flow panel directly under the chart, 12px, with the tooltip's header, rows, order and `+N` line; from 768px the floating tooltip is unchanged. A readout row may optionally carry a `marker` (`up` or `down`): it then draws a Lucide `ArrowUp` / `ArrowDown` (13px, 2px stroke) in the row's colour in place of the colour bar, and an optional `srLabel` keeps the full name for screen readers while the visible name is shortened; rows without a marker are unchanged (the Migration page of §29.1 uses it). `role="img"` + an aria-label: a caller's own name, otherwise `{first series}, {count} სერია, {first}–{last}` (`{count} series` in English). The chart is the keyboard stop (its frame is a second stop only while it scrolls sideways): ←/→ step the readout one period (the first press of ← opens on the latest), Home/End jump to the ends, Escape or leaving the chart closes it. An sr-only figcaption, linked by `aria-describedby`, lists each series' latest value with its period (`არ არის ხელმისაწვდომი` when the range has none), and a polite live line reads the active period's readout rows when a key moved it (not on pointer hover), or `არ არის ხელმისაწვდომი` for a period where no series has a value — a gap is never read as 0. Spoken values carry the marks the drawing shows: `(გეგმა)` for a planned point and the chart's preliminary label for a preliminary one. SVG text sets fonts via `style`, as house style for chart code.

**Dot lattice.** It replaces the horizontal gridlines outright — the dot field *is* the grid, not decoration behind one.

- `#C9BEA9` at opacity 0.6, radius 0.7. Literal hex from `lib/explorer/colors.ts`, matching the rest of this chart. An undefined custom property renders black, so chart code never references a token `app/globals.css` does not define. This was once the `control` value and is now chart-local: `control` darkened to `#95846A` to clear the 3:1 non-text floor on both paper and tint (§4.1), which governs control boundaries, not grid decoration. Darkening the lattice with it would turn the dot field into a tone.
- Pitch is derived from the active scale, never fixed: **2 columns per year interval** (`plotWidth / (2 × (n − 1))`) and **3 rows per gridline step** (`stepPx / 3`), so every third row lands exactly on a labelled y value and every second column on a year.
- Density guards: a sub-division pitch below 12px falls back to one column per year, or one row per step, independently. A negative domain can produce many gridline steps, and dots must never smear into a tone. With `n ≤ 1` there is no interval to divide and no lattice is drawn.
- Drawn as one `<pattern patternUnits="userSpaceOnUse">` with the circle at the tile center and the pattern origin offset back by half a pitch, so dot centers land exactly on the plot's grid intersections with no edge clipping — a pattern, not ~500 `<circle>` elements.
- The `1px ink` line at zero stays: it is load-bearing for negative domains. The `hairline-soft` horizontal gridlines are gone.

Data-reality rules (the prototype's snapshot had none of these; production data does):

- **Axis scale**: the gridline step is chosen from 1/2/2.5/5×10ⁿ for 4–7 intervals (an eighth only when the data dips at most one step below zero and rises above it, so a tiny dip does not force a coarser step), and the top/bottom is the first gridline past the data (+5% headroom). Amount axes only use whole multiples of the unit's printed precision.
- **Negative values** (e.g. `revenue.other_taxes` 2019–2020) extend the y-domain below zero: both bounds snap to one shared gridline step so 0 always sits on a gridline; the ink line stays at zero, not at the plot floor.
- **Interior gaps** (e.g. programs with no 2015 facts) split the polyline into segments — never bridge a missing year; an isolated point renders as a small dot.
- **Empty range**: a non-empty selection with zero points in the active range shows the callout `არჩეული სერიებისთვის ამ დიაპაზონში მონაცემები არ არის…` instead of a fabricated axis (table mode shows the same callout instead of a total-only table).
- **Narrow screens** (<768px, the §12 mobile breakpoint; owner decision D1, 2026-10-07): the chart draws a phone geometry at the frame's own width (one viewBox unit per CSS pixel, height 0.72 × width within 220–320px), so axis text renders at 11px and nothing scrolls. Year/month labels are thinned to whatever fits without collision, always labelling the first and the latest period; the y ticks print numbers only and the amount unit is printed once above the axis (share axes keep `%`). Before the browser measures, both geometries are in the HTML and CSS shows the phone one, so a phone never paints the desktop chart first. From 768px the 920×320 drawing is unchanged; where its 720px minimum still exceeds the frame (768–776px) it scrolls, opens at the latest period (and again after a range or series change), and keeps a sticky copy of the y-axis labels at the frame's left edge. Hover state is clamped when the years array shrinks. The chart frame's accessible name is `მრავალწლიანი გრაფიკი`; `— ჰორიზონტალურად გადაადგილებადი` is added, and the frame becomes a keyboard stop of its own, only when the frame actually scrolls.
- **Phone legend** (owner decision D4, 2026-10-07; extended to every stacked layout by owner decision Q4, 2026-10-12): below 1100px of column width, while the series list sits below the chart, with two to ten lines (a page may set its own cap), a wrapped legend sits directly under the frame — 14×3 swatch, label, and the value in the last period drawn with its unit (11px `muted`, value `ink` mono). A line with forecast years (debt service, deficit) shows its last published (non-forecast) value instead, followed by ` · {year}` when later forecast years are drawn, and `—` when only forecast years are drawn. While the tap readout is open the legend is hidden; it returns when the readout closes.

### 8.4 Table Mode

National columns: `<first col> | years… | ცვლილება | წილი მშპ-ში <end-year>`. First column header by scope: `სფერო` (fields), `უწყება` (ministries), `საბიუჯეტო მუხლი` (revenue). Header: overline style, `2px ink` bottom rule. Rows: 1px `hairline-soft` borders, tint hover; swatch bar + sans label left; numerals mono right-aligned; latest-year column weight 600; change colored positive/negative (minus sign `−`). When selected, the national dataset total row uses its exact scope label (`მთლიანი ხარჯი` or `მთლიანი შემოსავლები`) with a `2px ink` top rule, weight 600, and its calculated GDP share rather than `100.0%`; it is absent when deselected. Municipal tables retain `წილი <end-year>` and the selected `მთლიანი ბიუჯეტი` row at `100.0%`. Horizontal scroll with sticky first column and sticky right change/share columns (paper bg, 1px `hairline-soft` edge shadows). The sticky first column, header cell and body cells alike, also carries a solid 10px paper margin right of its rule at every width, so a year scrolled under it passes behind the column instead of showing half a figure; the rule stays at the column's edge in `hairline-soft` (U25-07). Below 768px of table width (owner decision D5, 2026-10-07) a table of one to three series lists one row per year, newest first, with the series as columns (swatch above a wrapping name in the header, values right-aligned mono, the latest row semibold); municipal change and latest share become summary rows above the years. Four or more series keep the year columns: the first column wraps at 12px and is capped at 40% of the scroller, the change/share columns scroll with the years instead of staying pinned, columns size to their values, status marks sit under their number, and the table opens scrolled to the latest year. Headers and row labels wrap at spaces (`overflow-wrap: break-word`); a word breaks mid-word only when it cannot fit its column. Series names are never shortened in code — not here, nor in the phone legend, tooltip, KPI details, movers, period comparison or ranking: the full name is always in the markup (screen readers and copy get all of it), and where room is short CSS clips it (a one-line ellipsis or a two-line clamp) with the full name in `title`.

### 8.5 Government Debt — approved Variant D

`/explorer/debt` reuses the explorer shell with exactly one chart or table and no dashboard cards or separate metric routes. Its right panel is one expanded hierarchy: `მთლიანი ვალი` with `საშინაო ვალი` and `საგარეო ვალი`; `ვალის გადახდა` with `ძირი თანხა` and `პროცენტი`; and `საპროცენტო განაკვეთი` with `საშინაო განაკვეთი` and `საგარეო განაკვეთი`. The three parents are real selectable series. The default is line mode, nominal GEL, full 2013–2025 stock coverage, and only `მთლიანი ვალი` selected. Same-family selections can be combined; choosing another family clears the old selection and resets to that family's full coverage. Because families never combine, the bulk control's "all" (§7.7) is the active family's three rows: `ყველას მონიშვნა` on an empty selection selects the parent and both children.

Stock can optionally use `% მშპ-ში`; service stays in GEL and rates use percent. Exact rate gaps render as `—` and are never interpolated or replaced with zero. Service may extend past actual 2025 values with a dashed 2026–2030 segment, a visible `პროგნოზი` boundary, and the statement that it covers only the portfolio outstanding on 2025-12-31, not a full future-budget forecast. The Excel action exports the active family, selection, range, and measure through the standard three-sheet workbook. For rates the GEL amount cell is blank and the percentage column carries the value; forecast service rows use status `პროგნოზი`. In the readable workbook sheet, cells in forecast years carry the `პროგნოზი` marker.

The deck line reports the latest **actual** observation of the active family's total — never a projection — and its change against the previous actual year: a relative change for stock and service, and a change in percentage points (`პპ`) for rates.

### 8.6 General-government deficit

`/explorer/deficit` reuses the Government Debt explorer primitives with H1 `რამდენია საქართველოს ბიუჯეტის დეფიციტი` and exactly one selectable series, `ზოგადი მთავრობის ბალანსი`. It defaults to `% მშპ-ში`, line mode and full 1995–2031 coverage; nominal GEL is the only alternative measure. The deck line always reports the latest actual observation, while every projection year renders as a dashed continuation with a visible `პროგნოზი` marker and table labels. The boundary, coverage sentences and edition name come from the facts and the reviewed IMF manifest, never from written-in years. Negative values mean deficit/net borrowing and positive values mean surplus/net lending. The source note names IMF WEO and explicitly prevents deriving this differently scoped general-government measure from the site's state-budget expenditure and consolidated-budget revenue datasets. In the readable workbook sheet, cells in projection years carry the `პროგნოზი` marker.

### 8.7 Below-Chart Sections (`ძირითადი ინდიკატორები`, order fixed)

When the selected range covers a single year (`start === end`, reachable through
the rail handles or a `#r=YYYY-YYYY` hash), the **delta-derived blocks stand
down** and the hero is replaced by one muted line —
`ერთწლიან პერიოდში ცვლილება არ იზომება — აირჩიე ერთ წელზე მეტი დიაპაზონი.`
Reporting a start-to-end delta of zero as a finding reads as a data error on a
public finance site.

What goes: the hero (`პერიოდის ცვლილება`), the movers board, the period
comparison, and any side KPI that is itself a delta (`ყველაზე დიდი ზრდა`,
`ყველაზე ნელი ზრდა`). What stays: every **point-in-time** KPI, because it is
still a fact about the chosen year — `ყველაზე დიდი წილი მშპ-ში` nationally, and
all three municipal side KPIs (level, rank, share). `#r=2015-2015` is a supported
way to read a municipality's 2015 rank, so the municipal KPI grid must survive.
The range caption prints the single year rather than `YYYY–YYYY`.

1. Hero KPI (`პერიოდის ცვლილება`, §7.12) + three side KPIs (`ყველაზე დიდი ზრდა`, `ყველაზე ნელი ზრდა`, `ყველაზე დიდი წილი მშპ-ში`) in a `1.35fr | 1fr` grid split by a hairline. Side KPIs rank **all top-level scope items** — the same population as the movers board, so the identical headings can never contradict each other on one screen. The residual bucket and end-year-zero rows are excluded from these delta KPIs and the movers board (§7.13). The `ყველაზე დიდი ზრდა` GEL delta requires a positive start value (a delta measured against a negative base is a correction unwind, not growth).
2. Movers board (top 3 / bottom 3 across all scope items).
3. `პერიოდის შედარება` — table `<first col> | start year | ცვლილება | end year`. The `ცვლილება` column is a delta sitting between two level columns in the same typographic style, so it always carries an explicit `+`/`−` on both the national and municipal surfaces; colour reinforces direction but is never the only cue (grayscale, print and colourblind readers). Rows: the exact-labeled total row always first, followed by every applicable top-level category in end-year value order; nested major programs are excluded. The table uses a fixed layout with a 44% label column and is independent of the user's chart/table series selection. Below 768px the table fits the column without scrolling: the change column is 70px, numeric cells use 4px side padding and the header keeps normal tracking, so headers and long labels stay inside their cells; in the municipal table each amount's unit drops under its number at 11px.

## 9. Single-Year Analysis (ანალიზი)

Canonical contract: this section and the reusable component contracts in §7. Order is fixed:

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

Row of mono 12px year buttons. Keep all years on one line when space permits; from 768px continue the sequence on additional lines without horizontal scrolling. Below 768px (§12) the buttons sit on one horizontally scrolling row that opens with the active year in view, each target at least 36px tall. Active: ink 600 + 2px accent underline. Planned year: mono superscript tag `გეგმა` in faint next to the label; keep the tag in the active state. The row is the shared `YearButtonRow` (`components/ui/year-button-row.tsx`) with an optional per-year tag, which Analysis uses for the planned tag. Analysis renders byte-for-byte as before.

### 9.2 Headline Stats

Exactly four, in the KPI pattern (no cards, no gradients): overline label, serif 34px value with mono unit suffix, muted detail. Content: `სულ` (total + category count), `ყველაზე დიდი` (largest category + share), `ყველაზე სწრაფი ზრდა`, `ყველაზე დიდი მატება`. When no previous year exists, growth cells show `—` with detail `წინა წლის მონაცემები არ არის`.

### 9.3 Structure Treemap

Production computes a **squarified treemap** over a `1000×430` unit area rendered at `aspect-ratio: 1000/430`, sorted by value descending. Title by scope: `სტრუქტურა სფეროების მიხედვით` / `სტრუქტურა უწყებების მიხედვით` / `სტრუქტურა კატეგორიების მიხედვით`.

Tile: `tile` bg, 1px `hairline` border, **3px category-color top bar**, radius 0, padding 9px 11px. Content: serif share % (22px at ≥8% share, 16px at ≥3.3%, 12px at ≥1.4%, hidden below), sans label 12/500 (shown ≥3.3%), mono amount 11 muted (shown ≥8%). Hover: tint bg; no lift, no shadow. Categories too small to label render as bare tiles and are listed in a small swatch legend below the treemap. Full detail lives in the `title` tooltip. No drilldown. Tile padding sits on an inner box, so a tile thinner than its padding never grows past the treemap's edge.

Below 768px (owner decision D6, 2026-10-07) the treemap is replaced by one 100% stacked horizontal bar (category colours, each item's share of the drawn sum, 1px gaps) and a full-width list in the same order: 14×3 swatch · full name (wraps, never truncated) · share % · amount. The small-category swatch legend is not shown there, since the list names every item. The treemap stays from 768px.

### 9.4 Every 100 GEL

Exactly 100 square cells, 10×10 grid, `gap: 5px`, `width: min(100%, 560px)`, radius 0, category colors, allocations rounded to whole GEL summing to 100 (largest remainder method). A legend column sits beside the grid on wide screens (wraps below on narrow): swatch bar + label + mono `n ₾` per category. Caption notes the rounding rule and how many categories round to 0 ₾.

### 9.5 Budget Radar

Radar + list grid (`1fr 300px`, stacks on narrow). Radar: single polygon of top-level category shares, top 7 + `სხვა` when more than 8 categories; rings + spokes `hairline-soft` 1px; polygon `2px accent` stroke with `rgba(179,64,42,0.12)` fill; 3px vertex dots in category colors; **mono two-digit index labels** (`01`…) around the rim. The list beside repeats the indices with swatch, label, and mono share. Visual-only — exact values live in the ranking; the note under the radar says so: `წილები · ზედა კატეგორიები · ზუსტი მნიშვნელობები — რეიტინგში ქვემოთ`.

### 9.6 Budget Field

Bubble scatter, viewBox 920×380: x = share of total, y = growth vs previous year, radius = `6 + sqrt(value/max)·16`, color = solid category token with a 2px paper-colored separation stroke. Y-axis bounds round outward to multiples of 10 percentage points. Ordinary ranges up to a 100-point span label every 10-point interval; unusually wide historical ranges use a readable `1/2/5 × 10ⁿ` interval no smaller than 10 points, targeting about eight intervals and preventing overlapping labels. Zero-growth line `1px ink`; grid `hairline-soft`; y-axis line `hairline`; axis labels mono 10px. Category names are not printed beside circles; hovering or keyboard-focusing a circle shows its full category name, amount and growth (`ცვლილება +11.7%`) in the chart tooltip. The pointer reads the circle whose centre is nearest, within at least 12 drawing units of each centre, not whichever circle is drawn on top, so a circle under a larger neighbour and one under 24px can still be hovered and tapped. Below 768px the field draws at the frame width (height 0.85 × width, 260–380px) without scrolling; a tap pins a circle (ink ring) and its readout sits under the field. The SVG is an accessible named group and every focusable circle is a named image, so assistive technology can identify points individually. If previous-year data is missing, show the callout: `წინა წლის მონაცემები არ არის ხელმისაწვდომი — ზრდის მაჩვენებლები ამ წლისთვის ვერ გამოჩნდება. აირჩიე უფრო გვიანი წელი.`

### 9.7 Full Ranking

Table columns: `<scope header> | მლრდ ₾ | წილი | ცვლილება`, sorted by GEL descending, top-level categories of the active grouping only. Rank as mono `01`-style index + swatch + label; a 120px 3px share bar (category color on `hairline-soft` track) next to the mono share; change colored positive/negative. On narrow mobile layouts the table fits without horizontal scrolling: labels wrap to at most two lines (CSS line clamp) with the full name in the markup and on hover, `მლრდ ₾` stays on one line, and the share bar is hidden while its numeric share remains visible. Desktop retains the full label and share bar.

**Completeness rule:** the ranking lists EVERY official row of the year — including zero and negative lines (e.g. `revenue.other_taxes` 2019–2020) — so the rows always reconcile with the `სულ` headline, and the category counts in the headline/deck count all rows. Shares are of the true year total (negative rows get a negative share and no bar). Only the geometry sections (treemap, every-100, radar, field) draw positive rows exclusively.

## 10. Revenue Adaptation

No separate revenue direction. Same shell, tokens, controls, chart/table treatment, analysis order, Excel and source patterns. Change only labels, taxonomy, revenue series tokens (§4.2), source wording, tooltips, and meaningful workbook columns.

## 11. Content and Copy

Voice: precise, civic, archival. Georgian is primary; English only for compact technical labels (`Excel`).

Canonical terms: `ხარჯები`, `შემოსავლები`, `ანალიზი`, `სერიები`, `ხაზი`, `ცხრილი`, `სფეროები`, `უწყებები`, `% მშპ-ში` (national multi-year), `% წილი` (municipal), `დიაპაზონი`, `მთლიანი ხარჯი`, `მთლიანი შემოსავლები`, `მთლიანი ბიუჯეტი`, `სულ` (single-year analysis), `ძირითადი ინდიკატორები`, `პერიოდის ცვლილება`, `ყველაზე მზარდი`, `ყველაზე ნელი ზრდა`, `პერიოდის შედარება`, `სტრუქტურა სფეროების მიხედვით`, `ყოველი 100 ლარი`, `ბიუჯეტის რადარი`, `ბიუჯეტის ველი`, `სრული რეიტინგი`, `ჩამოტვირთვა`, `გეგმა`.

Units always shown: `მლრდ ₾`, `მლნ ₾`, `%`. Numbers use `en-US` grouping and a `−` (minus, not hyphen) sign. Georgian editorial prose uses the same format as figures — decimal point and comma thousands (`104.6`, `67.2%`, `28,235`), never the Georgian-locale `104,6` / `28 235`. In mono figures the `₾` sign is set in the UI sans face (`withLari`, `components/ui/lari.tsx`), because Geist Mono has no lari glyph. Amounts ≥ ~1bn display in `მლრდ ₾`, below in `მლნ ₾`. Percentages carry 1 decimal.

**A funded line never renders the same as an unfunded one.** Precision is derived, not fixed, and that rule is what decides it:

- **Columns and chart axes** share one unit across every cell, which is what makes them comparable, so `unitFor()` picks the decimals once from every value the surface can show — all series, all years, never the current selection or range, or the numbers would reformat while the reader drags the range strip. It takes the fewest decimals that keep the surface's smallest non-zero value distinguishable from zero, up to a per-scope cap: **1** for fields, which are genuinely billions-scale, and **2** for municipalities (1 on 39 of the 64 pages, 2 on the other 25), for ministries, whose drill-down programs are billions-scale only in name — at 1 decimal 45 of them collapse into 16 distinct values — and for revenue, where five of the eleven lines sit under 1 bn and one decimal printed them, and their changes, as `0.1` and `−<0.1`.
- **Standalone amounts** (KPI values, series rows, movers, tooltips) carry their own unit label, so they vary per value at three significant digits — `450 მლნ ₾`, `26.8 მლნ ₾`, `0.42 მლნ ₾`.
- **Below either threshold**, `formatInUnit` and `formatAmountParts` floor to `<0.01` (`>−0.01` when negative) rather than printing a zero. Signed deltas keep their direction there too: a small positive change renders `+<0.01`, never the unsigned level form. Five municipalities hold amounts under 5,000 ₾; a genuine zero still prints `0.00` in a column. A standalone exact-zero amount prints `0 ₾` / `0 GEL` — no scaled unit, no sign.

`tests/explorer/formatInvariants.test.ts` asserts this against the reviewed corpus, per surface. Fixture-based assertions cannot catch a regression here — the 2026-08 one (ონი 2025 health, 133,333 ₾ shown as `0`) passed every unit test in `format.test.ts`.

Page titles are editorial sentences, not labels: `როგორ იხარჯება საქართველოს ბიუჯეტი`, `როგორ ფინანსდება საქართველოს ბიუჯეტი`, `<year> წლის ბიუჯეტის სურათი — სად მიდის საჯარო ფული / საიდან მოდის საჯარო ფული`.

Empty/error copy explains what happened and what to do, e.g.:

```text
არც ერთი სერია არ არის არჩეული. აირჩიე სერია პანელიდან „სერიები“.
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

Mobile (<768px): page padding `24px 20px 64px`; page title 30px; hero value 44px; year selector scrolls horizontally on one row, opening at the active year (§9.1); tables of up to three series list years as rows, newest first, and wider tables scroll horizontally, opening on the latest year (sticky first column capped at 40%; right-hand columns not pinned, §8.4); tables keep keyboard-focusable, visibly focused, accessibly named scrolling containers; charts fit the width (§8.3) and keep their named region, with the chart itself as the keyboard stop. Stacked layouts (<1100px) show the floating return-to-chart pill after a selection made while the chart is off-screen (§7.14), and show a legend with latest values under multi-line charts (§8.3). The user removed the visible horizontal-scrolling instruction site-wide on 2026-10-07. Every 100 GEL stays 10×10 — shrink cells, never cell count; controls ≥30px tall (prefer 36px+); the bulk toggle fills its 44px row, series-row carets answer taps 12px below the row (44px) without changing the row, and text links that act as controls are 44px tall. No informational text is below 11px (§5.2).

Breakpoint behavior keys off the page container width (ResizeObserver or CSS container/media queries), matching the reference prototype.

The shell adds one breakpoint of its own at **900px** (§6.7). It governs the sidebar only — above it the sidebar is a column, below it a pinned top bar with a drop-down nav panel — and does not change the content column's own breakpoints above. The hub card grid drops to one column below 768px.

The workspace's own breakpoints measure the **content column**, not the viewport (`@container` on the centred column in `main-explorer.tsx`). With a 232px sidebar in front of it the two differ by more than the 292px aside costs, so a viewport query keeps the two-column layout past the width the chart can fit and the chart clips inside its own frame.

**Chart width between 900 and 1019px — an accepted deviation from the §8.3 label size.** In that band the sidebar leaves the column 600–719px, under the chart frame's 720px minimum. The chart shrinks to fit there rather than scrolling, so the rendered axis label falls to **7.2px at 900px** (from 8.6px). This is a deliberate trade of label size for a whole chart, approved for this band only. Two things it does not change: below 900px the sidebar becomes a top bar, the column is wide again, and phones (<768px) draw the phone geometry of §8.3 instead; and the 11px in §8.3 is a viewBox unit, so the rendered size has always tracked the frame — it is 8.6px at 1020px and 9.7px at 1440px, reaching 11px only where the chart is widest.

## 13. Accessibility

- All controls have accessible names; toggles expose pressed/selected state (`aria-pressed`, `aria-checked`, `aria-expanded`); slider handles expose `role="slider"` with value attributes and keyboard support. Slider handles keep the 15 px visual dot but expose a 30 × 30 px interactive target.
- Static SVG charts: `role="img"` + Georgian accessible label. Charts with focusable data points use a named `group` with individually named point images instead. SVG-only data must also exist in table/tooltip/summary.
- Focus visible (accent ring) on paper.
- Every page opens with a `მთავარ შინაარსზე გადასვლა` / `Skip to content` link, hidden until it has keyboard focus and then shown top-left on `paper` (ink, 13px, weight 600, 44px tall, the accent ring), that moves focus to the page's single `#content` (the explorer content column, or the site page's `main`, which header and footer sit beside) without changing the URL hash.
- Never color-only meaning: swatch + label + value.
- Respect `prefers-reduced-motion`.
- Text floors: body copy ≥12px everywhere. Below 768px no informational text is under 11px, chart text included (§5.2, D8); from 768px only the metadata tiers listed in §4.1 (8.5–10.5px, each held to 4.5:1) and the 10–11px chart axes go below 12px.
- Contrast: every paper-surface foreground token clears WCAG AA small-text (4.5:1) on both `paper` and `tile` — `muted` and `faint` included. `faint` is the dimmest tier, not an exemption from the floor.

## 14. Motion

```yaml
motion:
  fast: "120ms"
  base: "150ms"
  easing: "ease-in-out"   # cubic-bezier(0.4, 0, 0.2, 1) — the curve the utility layer emits
```

Only color, background, border-color, opacity, and — for the sidebar rail alone (§6.7) — `width` transition. No transforms, no lifts, no decorative loops. Nothing animates on load.

The sidebar's width transition runs at `base` and is gated on `prefers-reduced-motion: reduce`, where it snaps: `globals.css` zeroes every transition duration under that query and additionally sets `transition: none` on the sidebar. `width` is permitted here and nowhere else — it is a layout change the user asked for by clicking, not motion for its own sake.

## 15. Data and Trust Presentation

Every analytical view exposes: active side, view, year/period, unit, measure, source note. Planned years get the `გეგმა` tag near the year context and a subtle marker in charts. When planned and actual both exist, actual wins in UI and the Excel workbook.

Each workbook has exactly three visible sheets, in order: `მარტივი ცხრილი`, `მონაცემები`, and `წყაროები`. `მარტივი ცხრილი` opens first and places its category-by-year table directly on row 3; its top title band is cream with dark text, while the table header remains ink with paper text. Year headings and numeric values are right-aligned, with the first column and header rows frozen. `მონაცემები` is a filterable row-based table with the exact Georgian headers `წელი`, `მთავარი ჯგუფი`, `კატეგორია`, `თანხა (₾)`, and `სტატუსი`; `% მშპ-ში` may add `მშპ-ის წილი (%)`. The Debt-rate exception adds `საპროცენტო განაკვეთი (%)` and leaves `თანხა (₾)` blank because a portfolio rate is not a GEL amount. It contains no internal IDs, repository paths, English labels, review dates, hashes, or source metadata columns. `წყაროები` contains the relevant validated public-archive originals with family-and-year-specific compressed periods, source organization, retrieval date, and a clean `ფაილის ჩამოტვირთვა` hyperlink label; raw URLs do not occupy visible cells. The filename is `fiscal-{scope}-{startYear}-{endYear}.xlsx`. Methodology manifest CSVs remain archive-integrity artifacts and are unchanged.

The `მარტივი ცხრილი` subtitle (row 2, merged and wrapped) keeps Excel's default height. A workbook whose subtitle carries a note opts in to a fitted height (`readable.fitSubtitle`): the writer sizes the row to the estimated number of lines across the merged width, counting Georgian letters 1.2× wide, because Excel never grows a merged row and would show only the first line. The Migration workbook (the computed group's definition), the inflation cities workbook (the central-prices note) and the inflation contributions workbook (the derived-measure note) opt in; every other workbook is unchanged.

## 16. Implementation Tokens

```css
:root {
  --paper: #F7F2E9;
  --tint: #F1EADC;
  --tile: #FDFAF3;
  --ink: #1E1B16;
  --body: #55503F;
  --muted: #6A6050;
  --faint: #776E5C;
  --hairline: #D9CFBE;
  --hairline-soft: #E7DECF;
  --row-border: #EDE4D3;
  --control: #95846A;
  --accent: #B3402A;
  --positive: #1F6E56;
  --negative: #B3402A;
  --font-display: 'Noto Serif Georgian', serif;
  --font-ui: 'Noto Sans Georgian', 'Helvetica Neue', sans-serif;
  --font-numeric: 'Geist Mono', monospace;
}
```

`apps/web/app/globals.css` ships these plus the two ink-surface tokens `--ink-fg-muted` and `--ink-fg-faint` (§6.7). Their values are defined once, in §4.1, and are deliberately not repeated here — the pair is contrast-constrained (§4.1), and a change to either should be a one-line edit, not a hunt.

## 17. Do / Do Not

Do:

- Structure pages with the rule hierarchy; keep content directly on paper.
- Set every data numeral in Geist Mono; every display value in Noto Serif Georgian.
- Keep category colors stable across all surfaces via §4.2 tokens.
- Keep the single measure toggle (`% მშპ-ში` nationally; `% წილი` municipally) as the only pill control (the §7.14 return-to-chart pill aside).
- Keep the analysis sections in the fixed order of §9.
- Reuse the identical system for revenue.
- Keep the Excel button visible and bound to the active range and selection.
- Show source/update context on every analytical view.
- Derive every year range from loaded data.
- Under a page's H1 show only one small one-line text (the latest-value line, or the hub's lead line). No summary paragraph, nominal/inflation note or other explanatory text goes between the heading and the workspace; disclosures belong in the source note, below-chart notes, methodology and Excel (owner rule, 2026-10-10, first applied to Wages; it applies to every explorer and hub page). The line fits one line at 375px; unit and price-basis wording ("Current prices", "Percent · …") opens the chart's source note instead of a second line under the heading. `tests/browser/mobile-fit-charts.spec.ts` checks every explorer route; the lines that still wrap there await the owner's wording.

Do not:

- No cards, panels with backgrounds, container shadows, or radii above 3px (pill exceptions only). The single card exception is the hub cards (§6.6): the budget hub's six cards and the other dataset hubs and the City air quality index, which reuse them; it does not generalize to any other surface.
- No white surfaces; no gradients anywhere.
- No blue `#0071e3` or any v3.x Apple token; no night theme or theme toggle.
- No dots/rounded-square swatches — bars only.
- No bar/stacked chart modes; only `ხაზი` and `ცხრილი`.
- National `% მშპ-ში` is share of same-year nominal GDP; municipal `% წილი` and single-year composition remain shares of their applicable budget total.
- No official program codes in the series panel (names only).
- No emoji or decorative icons; functional icons use Lucide under §7.2a. Caret `▸/▾` and checkmark `✓` glyphs remain part of the typographic control language.
- No drilldown anywhere.

## 18. Design QA Checklist

1. Page is paper-backed with no cards or shadows (tooltip, slider-handle and return-to-chart pill exceptions only; the hub cards — the budget hub's and the other dataset hubs' and the City air quality index's, which reuse them — are the one card exception, §6.6).
2. Every `/explorer` surface opens with the breadcrumb row's 2px ink rule; major sections open with 2px rules; sections are routes reached from the sidebar (§6.7), not in-page nav tabs.
3. All numerals are mono; all display values serif; overlines uppercase sans 11/600.
4. Explorer default: line mode, nominal GEL, full range, the default selection of §8.1 (with each section's documented departures, such as the sectors' five largest on share of GDP), and unrestricted line rendering.
5. Only `ხაზი` and `ცხრილი` modes exist; the national `% მშპ-ში` measure is the only pill control on national multi-year routes.
6. Swatches are 14×3px bars everywhere.
7. Category colors match §4.2 on every surface.
8. Analysis order: controls → year selector → 4 headlines → structure → 100 GEL → radar → field → ranking → source.
9. Every 100 GEL renders exactly 100 cells, allocations sum to 100.
10. Headline stats are exactly four, card-free.
11. Excel workbooks use the active range and selection, the approved three-sheet structure, and public-archive source hyperlinks on `წყაროები`.
12. Source note present with actual coverage ranges; planned years tagged `გეგმა` when planned data exists.
13. Georgian labels don't clip at any breakpoint.
14. Revenue reuses the identical system.
15. Ministries grouping works in both explorer (with program expansion) and analysis (categories only).
16. URL hash round-trips: reloading a deep link restores grouping, mode, share, range, selection, and analysis year; the section comes from the route, and a legacy `#nav=` link on `/explorer` redirects to it with the rest of the hash intact.
17. No v3.x (Apple) or older terminal/neon styling anywhere.

## 19. Landing Page (მთავარი)

Lives at `/`; reuses the editorial shell (§6.1), tokens, and type scale. Implementation: `apps/web/components/landing/`, geo data in `apps/web/lib/landing/georgiaGeo.ts`, and compact budget-derived summaries in `apps/web/lib/landing/landingData.ts` from the same active facts as the explorer.

Section order is fixed: shared header → living-relief hero → country figures → dataset row → expenditure → revenue → municipalities → Government Debt → general-government deficit → methodology and first sources → retained footer.

**Header and hero.** The header uses the responsive lockups of §7.1, keeps `მთავარი` as the active page and `მონაცემები` → `/explorer`. The living-relief map remains the full-bleed primary visual with its existing camera fitting, city behavior, reduced-motion still frame, accessible description, and WebGL fallback. Below 768px it is a static-only, reduced-motion capture selected for narrow, medium, or wide mobile widths; mobile must not request or mount the Three.js runtime. From 768px the existing WebGL relief remains interactive, retains 8.6px terrain spacing and the 2× renderer-density cap, and begins after `load` during browser idle time with a 1.5-second timeout. The hero receives no additional logo. Visible hero copy is exactly `საქართველოს მონაცემების პორტალი`, H1 `საქართველო ციფრებში`, and CTA `გაეცანი მონაცემებს` → `/explorer` (English: `/en/explorer`). The hero CTA and every ledger section link are at least 44px tall targets. The figure reserves the compact, settled map band from first paint: `calc(29vw + 48px)` below 768px, `calc(22.7vw + 57px)` from 768px, and the camera-fit bounds in `.landing-hero-frame` from 1100px. The existing virtual camera frames (340px, 500px, and `clamp(560px, 78vh, 820px)`) still determine the map's scale and crop. The static mobile image or desktop canvas receives that exact height; initialization must not resize the outer figure or move the country figures below it. At standard text sizes, keep the reserved band within 10px of the rendered visual at the tested responsive sizes, without clipping the map or adding a large blank area. From 768px, copy and figure share a grid row: the copy stays at its existing top/right alignment, and its intrinsic height plus 24px of clearance can enlarge the row for text-only zoom without overlapping the country figures.

**Brand metadata.** Organization structured data uses the reviewed mark at `/fiscal-ge-logo.svg` with its intrinsic 520×650 dimensions. App Router owns `favicon.ico`, `icon.svg`, and `apple-icon.png`. The generated 1200×630 social image combines the horizontal lockup with the reversed mark; it is the site sharing image, not a hero asset.

**Country figures.** Three figures share one row: two maintained snapshots, `მოსახლეობა` — `3.9 მლნ`, `2026 წლის 1 იანვარი · საქსტატი`, and `ფართობი` — `69.7 ათ. კმ²`, `საქართველოს ტერიტორია`; and `ეკონომიკის ზომა` — `104.6 მლრდ ₾`, `ნომინალური მშპ · 2025, წინასწარი`, which is read from the latest served nominal GDP fact (value, year and the `წინასწარი` mark while that year is preliminary), the same fact as the Economy dataset row. A narrow mobile caption may shorten visually, but assistive technology retains the full caption.

**Dataset row** (owner decision D3, 2026-10-07; Trade added 2026-10-08). One text link per dataset hub — `ბიუჯეტი`, `ეკონომიკა`, `ინფლაცია`, `უმუშევრობა`, `საგარეო ვაჭრობა` — each with one latest figure computed from served facts (spending total, nominal GDP, annual inflation, unemployment rate, total goods trade in USD at the Trade overview's million/billion scale) as `{measure} · {period}: {value}`. Two columns below 768px (an odd last link spans both), one per dataset from 768px. It is a row of links with no graphic, so it does not reintroduce the excluded post-hero graphics or the old three-path card below.

**Annual data ledger.** `#data` has no top rule, annual masthead, shared-year label, or reserved masthead spacing. The expenditure, revenue, and municipality ledger sections contain, in order: decorative index; dataset overline; question-led H2; concise latest-year description; real explorer link; an applicable total between two strong ink rules; latest year and truthful actual/planned/mixed status; and a semantic table of exactly four latest-year rows with amount and share. The first dataset section has no ordinary top border, avoiding a doubled rule; later sections retain their hairline top borders. Government Debt and deficit follow the same index/copy/data grid but use compact metric layouts suited to their measures instead of forcing them into the four-row budget table. There is no post-hero graphic, chart, map, canvas, SVG data visualization, prior-year comparison, change callout, old three-path card, About block, Excel preview, or separate methodology promotion.

The exact dataset contracts are:

1. `სახელმწიფო ხარჯები`; H2 `როგორ იხარჯება საქართველოს ბიუჯეტი`; total `მთლიანი ხარჯი`; first column `სფერო`; `ხარჯების მონაცემები →` → `/explorer/expenditure`.
2. `ნაერთი ბიუჯეტის შემოსულობები`; H2 `როგორ ფინანსდება საქართველოს ბიუჯეტი`; total `მთლიანი შემოსულობები`; first column `მუხლი`; `შემოსავლების მონაცემები →` → `/explorer/revenue`.
3. `მუნიციპალური ბიუჯეტები`; H2 `როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები`; total `საქართველოს მუნიციპალური ჯამი`; first column `უდიდესი მუნიციპალური ბიუჯეტები`; `მუნიციპალური მონაცემები →` → `/explorer/municipalities`.
4. `სახელმწიფო ვალი`; H2 `რამდენია საქართველოს მთავრობის ვალი`; latest actual total Government Debt stock plus its domestic and external amounts and shares; `ვალის მონაცემები →` → `/explorer/debt`.
5. `ზოგადი მთავრობის დეფიციტი`; H2 `რამდენია საქართველოს ბიუჯეტის დეფიციტი`; main label `დეფიციტი მშპ-სთან მიმართებით`; latest actual deficit as percent of GDP followed by the last three actual annual percentages; `დეფიციტის მონაცემები →` → `/explorer/deficit`.

National budget sections apply actual-over-planned selection before deriving the latest year, applicable total, status, and descending top four; stable category ID breaks ties. Municipal latest year and denominator come from the reviewed `country.georgia` public-total fact, while the descending top four come from all eligible public municipality totals for that year; municipality code breaks ties. The municipal total is never the sum of the four displayed rows. Debt uses the latest actual stock year and its explicit total, domestic, and external series. Deficit uses the latest actual observation and never promotes a projection into the homepage headline. All labels come from the reviewed glossary, municipality registry, or fixed public debt/deficit taxonomy; amounts use `formatAmount` and shares use the one-decimal `formatShare` contract.

**Methodology and footer.** The sixth section is index `06`, H2 `მეთოდოლოგია და პირველწყაროები`, the introduction `თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს, კლასიფიკაციის წესსა და გადამოწმების შედეგს.`, and four steps: official-document preservation; classification and transformation rule; reconciliation and quality check; downloadable data. At desktop the heading, introduction, and `მეთოდოლოგიის ნახვა →` link stay together in the left copy column, with the four steps alone in the right column; below 850px the copy comes first and the steps follow in reading order. The link targets `/methodology`. The shared footer follows immediately with its approximately 150px compact lockup, contact (no tagline, owner decision 2026-10-08), and the navigation: the eighteen dataset hubs in sidebar order, then `მეთოდოლოგია · AI-კავშირი · მიზანი` (owner decision D3, 2026-10-07; all hubs per Q3, 2026-10-12, recommended default pending the owner's answer). Source/update and the CC BY 4.0 licence share one fine-print paragraph with no `მონაცემები` heading. Below 768px the links form a two-column grid of 44px rows and the footer's top margin is 40px. This footer anatomy applies wherever `SiteFooter` renders.

**Responsive contract.** At ≥850px, each ledger reads index → copy → data in three columns and the three budget tables align. Below 850px, every data section and the methodology section stack in DOM order; total and year remain on one row where space permits; the three country figures remain one compact row; tables and fiscal metrics stay inside their parent without horizontal scrolling. Below 768px, each country-stat unit occupies the second line of an equal-height value block so font loading cannot move the unit or stagger the captions. At ≤380px, side padding and type scale tighten, country-stat labels reserve two lines, and a 320px viewport must have `scrollWidth === clientWidth`.

Landing QA: verify exact copy, metadata, destination links, ordered H2s, data-derived total/year/status and four rows for each budget dataset, the latest actual debt split, and the latest actual deficit plus its three-year actual history; verify a static-only hero with no WebGL request below 768px and one canvas or fallback from 768px; verify the absence of old paths/About/promo and all post-hero SVG/canvas graphics; at desktop, 390px, and 320px verify one-row figures, strong total rules, consistent ledger rhythm, semantic tables, unit wrap, content containment, and zero document overflow.

## 20. Municipal Surfaces

Reference implementation: `apps/web/components/municipalities/`, routes under `apps/web/app/(ka)/explorer/municipalities/` and the English mirror under `apps/web/app/(en)/en/explorer/municipalities/`. The section reuses the shell (§6.7) and the existing explorer machinery — `EditorialLineChart`, `RangeStrip`, `Callout`, `SourceNote`, `SwatchBar` — rather than inventing new surface types; `municipality-map.tsx` is the dedicated static SVG map component.

**Municipality-grain static SVG map.** The index choropleth renders a deterministic, vendored OpenStreetMap snapshot as 60 municipality polygons plus five green city markers: Tbilisi `04`, Batumi `06`, Kutaisi `20`, Poti `32`, and Rustavi `48`. Codes `06`, `20`, `32`, and `48` are marker-only; Tbilisi `04` is the sole polygon-plus-marker duplicate; the union is exactly the 64 publicly served municipality codes. Each polygon or marker resolves its internal numeric code through the explicit route registry and opens `/explorer/municipalities/[slug]` on a mouse click or keyboard activation. On touch (owner decision D7, 2026-10-07) the first tap selects and highlights the municipality and shows a one-line in-flow strip directly under the map — `{name} · {budget per resident} ერთ მოსახლეზე →`, a real link at least 44px tall; a second tap on the same place, or the strip, opens the page. Map targets whose longer side is under 24px at the map's measured drawn width (350px until measured), and the five city markers, get invisible touch disks up to 32px across, sized so that two small neighbours' disks never overlap. A target whose disk would then be no wider than the shape itself gets none, since it would add nothing: at the measured width of the narrowest phones a few close neighbours do (Tsalenjikha and Zugdidi on a 375px phone, Kaspi too at 320px). A city marker's disk is at least 24px across whatever its neighbours — a neighbour's disk gives way to it, and where two markers' disks overlap (Tbilisi and Rustavi) the tap goes to the nearer marker; the disks respond only to coarse pointers and are hidden from assistive technology. The map is **one tab stop**, not 65: targets carry a roving `tabindex`, so Tab enters the group and arrow keys (plus Home/End) move within it — the ranked list below is reachable without traversing the whole map. Tbilisi resolves to a single accessible target: the green marker is the encoding the legend names, so the `04` polygon stays drawn and pointer-interactive, co-highlighting with its marker and opening the same page on click, but is `aria-hidden` and unfocusable. That leaves **64 map targets**, one per served municipality, each announced once. The six-step terracotta ramp is quantile-classed by 2025 budget per resident, using the reviewed 1 January 2025 Geostat population denominator. Legend endpoints use whole-GEL budget per resident; the minimum and maximum stay on one row at the ramp's two ends, and the ramp narrows on phones. Each target's accessible name includes budget per resident and total budget. The map carries no separate heading or floating data popup — the legend and the SVG's accessible name state the measure, and the ranked list and index source note retain the values, measure and year. Pointer and keyboard activity synchronizes the exact municipality between map and ranked list; switching to the Regions list leaves the map at municipality grain and region rows remain inert toward map highlighting.

**Index list hierarchy.** Municipality and region rows remain ranked and sorted by displayed total budget; rank numbers, bars, and primary formatted amounts all continue to use that total. A smaller whole-GEL budget-per-resident line is supporting context only, labelled `ერთ მოსახლეზე` — the one per-resident term site-wide (map strip, list and legend alike). Region values divide the displayed region total by the summed 2025 population of member municipalities, so Adjara uses its consolidated numerator. The Georgia row remains first on the Regions tab and has no per-resident value because its numerator contains five aggregate-only budgets with no territorial population assignment. Both existing tab panels are server-rendered so the Georgia and 11 region destinations remain ordinary crawlable links in the initial HTML; the inactive Regions panel uses the native `hidden` state, so the default municipality view and tab interaction are visually unchanged. The KPI strip reports the median of the 64 municipality-level 2025 per-resident values. Below 768px the ranked list has no inner scroll height; the page scrolls it.

**Index source note.** The index closes with the standard `SourceNote` (§7.10), like every other data surface: it names the Ministry of Finance as the source, states that the map encodes budget per resident for 2025, and explains the 64-vs-69 split — the map and list cover the 64 served municipalities while the pinned `საქართველო` row is the 69-unit roll-up plus Adjara republican payments, which is why the region rows do not sum to it. Its review date comes from `latestReviewedAtForMunicipalFacts`. This is the note, not a methodology link: per §21 the methodology route reaches these pages through the footer only.

**Search surfaces answer.** All three — the series panel, the index list, and the entity picker — respond to a non-matching query rather than going blank. The picker renders the index's own empty state after its empty listbox (`ვერაფერი მოიძებნა` as a live status plus a `ძებნის გასუფთავება` button); before this it collapsed to a 0-height listbox with no options, no count, and no way to clear the query except selecting the text. A forward Tab from the combobox reaches that button, Enter clears the query and returns focus to the combobox, and the next forward Tab closes the non-modal picker and continues through the page. The index list's empty state is the same live status, and the bare count beside its search (`3 / 64`) is hidden from screen readers in favour of a polite live status that says it in words (`ნაჩვენებია 64-დან 3` / `3 of 64 shown`), so a screen-reader user hears the list narrow.

**Entity summary.** Every municipality and region route renders a concise, server-derived Georgian summary after the range/source note and before `ძირითადი ინდიკატორები`; the chart keeps its existing starting position. Municipality summaries name the latest reviewed total, rank out of 64, largest latest-year function, and its share of the public total. Ordinary region summaries use the parallel rank-out-of-11 and function facts. Adjara instead names the six municipalities plus the net republican budget because its functional rows cover only the municipal portion. The summary always prints its year explicitly and does not change when the reader narrows the interactive chart range. Municipality and region pages keep their previous/next links; below 768px each is a 44px-tall target.

The two reviewed occupied-area overlays render above the municipality fills as pale, non-interactive SVG paths with no public label, tooltip, link, keyboard focus, map text, or legend entry. The source note links `© OpenStreetMap contributors` to `https://www.openstreetmap.org/copyright` and states `ODbL` without adding occupied-territory wording. Natural Earth overlay provenance remains repository documentation because that source is public domain. Codes `05`, `42`, `43`, `46`, and `64` remain excluded from the public registry, standalone facts, regional aggregates, rankings, picker/list/map/member rows, and standalone Excel values. Their raw budgets belong to Georgian municipal bodies operating outside those territories and serving displaced communities, so they are not territorially attributable spending inside the named municipalities; they appear only inside the dedicated Georgia aggregate. Full geometry and licence provenance is documented in `docs/data-methodology/municipal-functional-annual-2015-2025.md`; the approved behavior is specified in `docs/superpowers/specs/2026-08-07-municipality-map-upgrade-design.md`.

**Georgia aggregate.** `/explorer/municipalities/georgia` reuses the municipal chart, table, `% წილი`, range, selector, comparisons, movers, and Excel surfaces over the 69-series country aggregate plus Adjara republican actual payments net of transfers to territorial budgets. In the index's `რეგიონები` tab, `საქართველო` is pinned before the 11 value-ranked region rows; in the entity picker it is the first option, before all regions and municipalities. The exact H1 is `როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები`, with `საქართველოს მუნიციპალიტეტები` as the picker trigger. The country page states `69 მუნიციპალური საბიუჯეტო ერთეული + აჭარის ა.რ.`, derives `2015–2025` from loaded facts, selects only `მთლიანი ბიუჯეტი` by default, and has no fake rank, map, member list, or previous/next navigation.

The Georgia page's total and function rows are dedicated `country.georgia` facts, not a synthetic municipality. Countrywide totals and municipality/region shares use the adjusted country denominator. Municipality and region ranks remain 64/11. The 11 region rows do not reconcile to the Georgia row because codes `05`, `42`, `43`, `46`, and `64` have no territorial region assignment and are included only in the country aggregate; both the index and country source notes explain this boundary. Adjara remains one region, not an extra republic entity.

**One public total.** `მთლიანი ბიუჯეტი` uses `public_total_gel` in the selector, chart, table, KPIs, comparisons, percentage denominator, and Excel total row. For Adjara and Georgia this is the consolidated total. The ten functions remain unchanged and municipality-classified only; their shares can sum below or above 100%. No residual category, proportional republic allocation, or reconciliation warning appears in the explorer. The Georgia workbook uses the public entity label `საქართველო` and contains only the country total and ten country-level functions for each year; it never exposes the internal identifier `country.georgia`, a standalone value or selectable entity for an aggregate-only code, or an Adjara republic entity. Its `წყაროები` sheet may cite the underlying official originals, including those five aggregate-only bodies, solely as provenance rather than public data rows.

**Unit: `მლნ ₾`, not `მლრდ ₾`.** Municipal budgets run one to three orders of magnitude below the national totals the rest of the explorer charts in billions; a billions axis would hide most municipal functions after rounding. The municipal chart and table pass `UNIT_MLN` (`lib/explorer/format.ts` — whole million GEL) to the same `EditorialLineChart`/`ExplorerTable` the budget explorer passes `UNIT_BN` to. KPI values, list rows, and the entity picker use `formatAmount`, which already auto-selects `მლნ ₾` below ~1bn GEL on its own.

## 21. Methodology Surfaces

Approved visual and behavioral specification: `docs/superpowers/specs/2026-08-11-methodology-portal-design.md`. The approved preview (variant D, Editorial Fieldbook) was not kept in the repository.

The public structure is `/methodology` plus live category pages for expenditure, revenue, municipalities, Government Debt, GDP, national economic sectors, regional economies, inflation, money and banks, unemployment, wages, household income and spending, poverty and inequality, health, education, science and culture, crime and justice, housing and construction, energy and food, environment and climate, trade, external flows, and demography. Methodology is not a top-header item. Discovery comes from the numbered landing methodology section and the retained site-footer link; since every `/explorer` route renders `SiteFooter` too (§6.7), the footer path is available on the data surfaces as well. Explorer and about pages do not repeat methodology promotions, contextual links, or long introductory SEO copy inside their analytical content: the footer link sits below the content rather than inside it.

Methodology surfaces reuse this document's paper, ink-rule, typography, radius, shadow, and accessibility contracts. The hub uses rule-separated dataset rows rather than cards; below 768px each row's arrow shares the title line. Category pages use layered, curated public explanation, an explicit official-versus-Fiscal.ge disclosure, sticky contents, a four-step source-to-data journey, and a searchable archive of untouched upstream originals. Below 1100px, where the contents list is not sticky, a small `სარჩევი ↑` / `Contents ↑` link — a bordered paper button with no shadow — stays at the bottom of the screen while the article scrolls and jumps back to the list. Complete canonical decisions and retrieval/hash provenance remain internal records and downloadable manifest integrity data. Future datasets are non-clickable `მალე` markers only; none is listed today.

The approved public visibility is dataset-specific: expenditure hides its historical-decision group; revenue hides its validation group, technical appendix, and later classification, validation, and limitations sections; municipalities hide the full decision record, appendix, and later classification, validation, and limitations sections; Government Debt uses only concise scope, source, limitation, and archive sections. Archive tables visibly show `Year | Original source/file | Format | Size | Download`. An archive of twelve files or fewer has no year filter, only the search, because the filter would offer more years than there are files. Below 760px the year filter wraps onto more rows (no sideways scroll) and each source is a stacked block (year · title · file name · publisher) with a full-width download link at least 44px tall showing format and size. The archive search uses the §7.7 placeholder `ძებნა`. The year buttons are a named group, and a visually hidden polite status says how many of the sources the search and year leave (`ნაჩვენებია {total}-დან {count} წყარო`).

## 22. Not-found Recovery

Unknown HTML routes retain their HTTP 404 status and use a minimal editorial recovery surface. It uses the existing paper, ink, body, muted, tint, and accent-focus tokens: a compact Fiscal.ge identifier, one Georgian H1, a short explanation, and ordinary visible links to the homepage, the eighteen dataset hubs in sidebar order and methodology; the English page mirrors them. Below 768px it has no top spacer. It does not load data, reuse the application shell, add an illustration, or introduce a separate visual system.

## 23. Mission Surface (მიზანი)

`/about` remains the canonical URL for the mission page. Its shared header links are `მთავარი`, `მონაცემები`, `AI`, and `მიზანი`; only `მიზანი` is active on `/about`, while methodology remains inactive. The page renders no visible breadcrumb.

The cover is an ink block with a paper title, terracotta `01`, `FISCAL.GE / OPEN DATA`, and a data-derived review year plus `MISSION NOTE`; below 768px the cover is about 200px tall. The copy is one continuous four-paragraph article. The final strong sentence alone carries the terracotta left rule. The article ends with the link `გაეცანი მონაცემებს →` to `/explorer`.

The page uses the shared footer of §19, whose navigation labels the `/about` link `მიზანი`. The page has no horizontal overflow at the documented mobile breakpoints.

## 24. Connection Page (`/connect`)

The one human-facing surface for the read-only MCP connection. Every other agent-facing surface (`llms.txt`, the JSON publications, the endpoint itself) is machine-facing; this page is the entire discovery funnel. It is written for someone who already uses an AI assistant and wants the address in it, not for a developer reading a spec.

No new visual direction, chart type, or interaction pattern. It reuses the established composition: `SiteHeader` following the responsive navigation rules of §7.1, `BreadcrumbTrail` (`მთავარი / AI-კავშირი`), a `2px ink` top rule under the serif H1 with a single-sentence deck, then rule-separated sections at the `border-t border-[var(--ink)] pt-5` rhythm, and `SiteFooter`.

**The page is ordered by weight, not as equal blocks: anchor, act, check, fine print.**

1. **The address** is the anchor and the only element on a `--tint` panel. Mono, 16px rising to 21px, with the copy control beside it and the conditions of use as short labels beneath (free; no authorization). It is the one thing the page exists to hand over, so nothing above it competes.
2. **Connection steps** name the applications actually verified and give their real menu paths as numbered lists, with a one-line qualifier under each name. Prose describing a menu path reads worse than the path itself. A closing note covers every other client generically.
3. **Asking without connecting** gives one copyable Georgian prompt, quoted and bold on a `--tint` block with its own copy control, and states plainly what this route does not provide — per-figure sources and caveats.
4. **The coverage statement** carries both halves: what is served, with year ranges derived from the same catalogue the endpoint answers from (§2.1 — never hardcoded), and what is not. The second half is not optional politeness. Without it a visitor asks for out-of-scope data, receives nothing, and concludes the service is broken.
5. **Technical details** are 12px `--muted` fine print above the footer, on a hairline rule rather than an ink one. Read-only status, protocol, revision and transport live here, where they inform without implying the page is for developers.

Developer detail stays out of the main path: tool and field names and the raw JSON/CSV files sit behind a disclosure for developers (files and tool parameters) under the served list. Three example questions are shown, the rest behind `მეტი მაგალითი`. Each setup link is named for its app and is a 44px target.

**Copy controls are conveniences, never the only route.** Both the address and the prompt are rendered as selectable text beside their buttons, so each is obtainable when the clipboard API is unavailable or refused. Each button carries an accessible Georgian name that changes to a confirmation on success, announced through a live region.

Discovery includes the shared public header item `AI` linking to `/connect`, active only on that page, and the site-footer navigation list, which every `/explorer` route and both editorial pages render (§6.7). `/connect` also appears in `sitemap.xml` and `llms.txt`. The AI item uses the existing link styling and keyboard/focus behavior.

## GDP overview extension

Economy is a peer below Budget in the explorer sidebar. Its hub reuses the budget cards and links to three live sections. GDP overview reuses the existing chart, table, range strip, text tabs and Excel button. The four indicator tabs are centred, wrapping `TextTab`s across the workspace (Real GDP, Nominal GDP, GDP growth, GDP per capita). Nominal measures have GEL/USD pills in the chart toolbar at the share-control position. There is no right-side display/series panel, new chart renderer or additional KPI system. Under the H1 sits a one-line latest value for the active indicator — `{indicator} · {year}: {value}[ · წინასწარი]` (owner decision D2, 2026-10-07) — and nothing else (§17): the price basis moves to the source note; heading, tabs and chart panel sit on compact spacing (12px under the tabs) so the chart or table reads without scrolling. See `docs/superpowers/specs/2026-09-10-gdp-overview-design.md`. Existing Budget components remain authoritative over previews.

The four live Economy hub cards use the same card anatomy: a 200×34 sparkline and a data-derived footer naming its measure and period. GDP overview traces real GDP and its footer states the latest nominal GDP (`{year} · ნომინალური მშპ {amount}`); Sectors traces the latest year's top three sectors' combined share of GDP using those same three sectors throughout the history; GDP by expenditure (card 03) traces households' share of GDP and its footer states the latest one (`{year} · Households {share} of GDP · {first}–{last}`); Regional economies (card 04) traces the latest year's largest region's nominal GDP. The Sectors and GDP by expenditure footers mark preliminary latest-year figures.

## 25. Inflation Surfaces

Inflation is the fourth dataset in the explorer sidebar (Budget, Economy, Business, Inflation), with the same active-row, nested-section, collapse, keyboard and mobile behaviour. Its hub reuses the budget hub cards: `ინფლაციის მიმოხილვა`, `კატეგორიები`, `პროდუქტები` and `ქალაქები` are all live. There is no separate basket card. The collapsed rail reads `მონაცემები / ინფლაცია`.

The overview follows the GDP overview's header — the one-line latest value for the active indicator (D2) as the only line under the H1 (§17; the unit moves to the source note), centred, wrapping `TextTab` indicator tabs directly above the workspace (`წლიური ინფლაცია`, `თვიური ინფლაცია`, `ფასების ინდექსი`) — over the Budget explorers' workspace: `ხაზი / ცხრილი`, chart or table, range strip, series panel with the download at its foot, source note. The series panel adds a reference row (the NBG target) with a dashed swatch; its chart line is dashed accent with no end dot, and it appears only on annual inflation. On the other tabs its row stays listed but inert (`aria-disabled`, unticked, `ამ მაჩვენებლისთვის არ ქვეყნდება` as its tooltip) and the panel's `{selected} / {all}` count leaves it out; core's rows on the index tab, which Geostat does not publish, are treated the same. The selection itself keeps them for the tab that draws them. Inflation values are never coloured good/bad; rate changes are in percentage points. The header's coverage label (§6.2) states the active tab's months, since the index tab reaches further back than the change tabs.

Monthly axes: the line chart and range strip take a periods-per-year hint. Axis labels fall on calendar years (thinned to twelve); lattice columns group months at calendar boundaries under the 12px floor (§8.3); range chips are `5წ / 10წ / ყველა` counted in months (no one-year chip); arrows step a month, PageUp/PageDown a year. Year charts and strips render unchanged.

`ცხრილი` for monthly data is a years (newest first) × months grid with ExplorerTable's anatomy (§8.4), one series at a time (a `TextTab` picker when several are selected; on Categories and Cities, `TableSeriesPicker` turns it into a native select below 768px of column width, at least 44px tall and 16px on phones). Percentage tabs tint cells on a five-step scale — deflation blue `#DCE4F2`, then `#F1EADC`, `#EBCDBB`, `#D9967C`, and accent `#B3402A` with paper text — every pair ≥ 4.5:1; values are always printed and a legend names the bins. The index tab is untinted. Annual inflation adds a `წლის საშუალო` column (December 12-month average).

`ძირითადი ინდიკატორები` on this page shows the latest published month: the §8.5 hero (value, 3px gauge on a 0–15% scale against the target in force, dashed target mark, one sentence) and three side KPIs with sparklines (core inflation, monthly inflation, 12-month average). No movers board and no period comparison. See `docs/superpowers/specs/2026-09-11-inflation-overview-design.md`.

### 25.1 Categories

`კატეგორიები` is the second inflation section, at `/explorer/inflation/categories`. It repeats the overview's anatomy exactly — latest-value line (the annual headline, or the monthly one on the monthly tab) as the only line under the H1, with the unit in the source note, centred, wrapping `TextTab`s, the same workspace, range strip, series panel and indicators — with three differences.

**Three tabs, landing on the third.** `წლიური ინფლაცია`, `თვიური ინფლაცია`, `წვლილი ინფლაციაში`. The rate tabs keep the order a reader knows from the overview, but the page lands on the contribution tab: the section exists for the decomposition. The three tabs have three coverages (2005-01, 2004-01, 2013-01) and the overview's range-transition rule handles them unchanged. The mode toggle reads `სვეტები / ცხრილი` on the contribution tab and `ხაზი / ცხრილი` on the rate tabs.

**A two-level series panel.** The ministries pattern: 12 division rows, each expanding to its subgroups, with the count line `ჯგუფები {selected} / 12 · ქვეჯგუფები {selectedSubgroups}` so a selected subgroup is never hidden by the division count. Every row carries its basket weight for the latest year, right-aligned in a quieter mono than the value; a row with no weight shows `—`, as does a category with no value on the active tab. All 12 divisions are selected by default — a deliberate, documented departure from the "only the total is selected by default" rule, since a stack of one series is meaningless. The selection is shared across all three tabs, so the departure covers the rate tabs too: this dataset has no total series to fall back to (55 rows = 12 divisions + 43 subgroups), and carrying the selection across a tab switch is what the overview does. Ticking a division clears its selected subgroups and vice versa — the two levels overlap, and summing both would show part of the basket twice while the residual quietly absorbed the duplicate.

**A stacked column chart** (`StackedColumnChart`), the only form in which "the parts add up to the published whole" is visible. Months on the x axis under the dot-lattice thinning rule (§8.3); percentage points on the y; positive segments stack up from a drawn ink zero line and negative segments down; the published headline runs over the stack as an ink line; the final segment is the residual `დანარჩენი` = published headline − Σ(selected contributions), so the stack closes exactly on the published figure at any selection. Columns are centred in equal bands (half-band inset) and axis numbers use the shared `en-US` grouping (`5,000`). Annual periods are laid out as years (year-rule labels, two lattice columns per year) and monthly periods by calendar boundary, so the same chart serves the annual unemployment context (§27). A visually-hidden list repeats each segment's latest value so the chart is never colour-only; the svg itself carries `role="img"`, which makes its children presentational, so per-segment `<title>`s would be unreadable and are not drawn. Six optional additions leave the default untouched: `legend` (a key above the plot, one 14×3 swatch and label per entry and none when absent or empty; values stay in the readout and the caption), a segment's `readoutLabel` and `marker` (the readout's short name and arrow, the caption keeps `label`), `readoutOrder="sign-then-magnitude"` (non-negative rows by size, then negative rows by size, instead of ranking by signed value), `readoutRowCap` (default 10), `formatOverlayValue` (the overlay's formatter in the readout header and the caption, default `formatValue`) and `compactReadout` (no row gap and a 14px line in the floating readout, so twelve rows fit the plot's height at every desktop width).

**Category colour.** Twelve stable division colours from the editorial palette, keeping each concept's colour site-wide (§4.2) — health `#1F6E56`, education `#3D5A98`, transport `#C26E4C`, housing `#A5822B`, food `#B3402A`, alcohol and tobacco `#9C3D5E`, clothing `#7A4E8C`, furnishings `#8A7B65`, communication `#4A707A`, recreation `#4E5D74`, restaurants `#8C5A32`, miscellaneous `#2F4B3A` — with the residual on the existing neutral `#94856D`. Subgroups inherit their division's colour; because the residual absorbs everything unselected, a readable stack never needs 43 distinct colours.

The month grid gains contribution bins (`0 / 0.25 / 0.75 / 1.5` pp) on the same five-step tint scale, with a legend in `პპ`, and has no annual-average column: Geostat publishes no annual average per category. Below 768px its category tabs become a native select (at least 44px tall) with the same state and URL key `t`. The indicators block carries **four different measures, not one ranked four ways**: the hero is the largest contributor of the latest published month with its price change and basket share, then `ყველაზე გაძვირებული` (highest annual change, as a rate, contribution as detail), `ყველაზე გაიაფებული` (lowest annual change — relabelled `ყველაზე ნაკლებად გაძვირებული` when nothing fell), and `ინფლაციის სიგანე` (`10 / 12` divisions rising, sparkline of that count). Divisions only. A negative value is described as `გაიაფდა`, never coloured as good or bad. See `docs/superpowers/specs/2026-09-12-inflation-categories-design.md`.

### 25.2 Individual products

`პროდუქტები` is the third inflation section, at `/explorer/inflation/products`. It uses the existing editorial page header and two-column explorer workspace. The left column begins with the monthly-observation line chart in **annual inflation** mode, with the standard year range strip directly beneath it. A single 36px `TrendingUp` Lucide button in the chart heading switches to or from a Fiscal.ge-derived cumulative change; its accessible name and tooltip are localized, but the button carries no visible word. There is no separate annual button, monthly tab or chart/table switch. The right column contains the existing selector anatomy with icon-sized product cutouts, official names, latest annual values, bilingual search, Clear and an Excel action at the foot. On stacked layouts the selector list shows its top ten (plus any selected products) with the rest behind `მეტი პროდუქტი`; search covers all products. Products are sorted by the latest published annual rate, with missing rates last; right-panel search never changes selection totals or the lower list.

Below the workspace, the established one-hero-plus-three-side indicators show the last selected product's latest annual rate on the cohort min–max scale, that product's selected-years cumulative change, and the highest and lowest latest annual product rates across the whole current cohort. Names, exact periods and unavailable explanations remain visible. A “Browse products” heading and independent bilingual search precede the complete illustrated product table, without a dividing rule or row counter. The table places selected-years cumulative change before latest annual change and ranks matching products by the selected-range cumulative value, highest first, with incomplete histories last; it re-ranks when the selected years change. `More products` works within matching results. It is a semantic table, not a product-card grid. A product on the chart shows its line-colour swatch in its table row as well as the tint, and from 768px the columns are 60% name, 20% and 20% rates. The series panel names its value column (`წლიური ინფლაცია · {latest month}`). On phones, the workspace stacks chart then selector; the table scrolls within its own region without hiding either rate column (short column headers; the periods are stated in the visible table caption). Below 768px the rate columns are sized to their headers (normal tracking) and names are 12px, so whole words wrap with no mid-word break at 390px and wider. Object illustrations are small transparent cutouts beside names and never function as UI icons or data evidence. Product colours follow the product number: products 1–14 wear the editorial palette, and each later run of 14 takes the next `colorForProgram` shade of the same palette colour, skipping a shade an earlier product wears, so no two products share a colour and adding a product recolours none. See `docs/superpowers/specs/2026-09-27-inflation-products-explorer-design.md`.

### 25.3 Cities

The section is a **Georgia page** at `/explorer/inflation/cities` and **one page per city** at `/explorer/inflation/cities/{tbilisi|kutaisi|batumi|gori|telavi|zugdidi}`. Both show annual inflation only (under the H1 only the latest-value line for Georgia or the city total, with the unit in the source note; no tabs) and repeat the overview's workspace, range strip, series panel, month grid, Excel action and indicators. Below 768px the month grid's line tabs become a native select, as on Categories.

**Heading picker.** Both open with `ინფლაცია ქალაქებში — {place} ▾`, the place being the regions page's trigger (accent text, dashed accent underline, Lucide `ChevronDown`). It opens the shared `PickerDialog` (as `RegionPicker` does): search combobox, listbox, arrow keys and Enter, Escape or an outside click to close and refocus the trigger, the empty-search state and hint. The trigger is `aria-haspopup="dialog"` and names the open dialog with `aria-controls`; Enter follows the active option's link in the app, as a click does (no document reload), and the new page's trigger takes focus. `საქართველო` is first, styled as the "all" row; the six cities follow in Geostat's order; the current page is `aria-current`. City pages add `← {previous} · {next} →` on the right in the fixed order, wrapping, each link a 44px-tall target below 768px; the Georgia page has none. There is no category select anywhere in the section.

**Georgia page.** Seven lines on the total: `საქართველო` first in ink as the benchmark, then the six cities, all selected by default — an owner-approved departure from the "only the total" rule; the count reads `სერიები {selected} / 7`. Indicators: hero = the city with the highest annual rate with its distance from Georgia in `პპ`; `ყველაზე დაბალი`; `ქალაქებს შორის სხვაობა` (36-month sparkline); `ეროვნულზე მაღალი` (`{n} / 6`, sparkline). Georgia is never ranked.

**City page.** The city's `სულ` in ink plus the 12 divisions in the Categories page's colours; only `სულ` is selected by default (`სერიები 1 / 13`). Georgia's line is not drawn. Coverage follows the city (Zugdidi from December 2016). Indicators: hero = the city's total with Georgia's beside it; `ყველაზე გაძვირებული`, `ყველაზე ნაკლებად გაძვირებული` / `ყველაზე გაიაფებული`, `ინფლაციის სიგანე` (`{n} / 12`, sparkline), each division against Georgia's same division in `პპ`.

**Shared rules.** Every difference subtracts the printed one-decimal figures. The month grid shows `წლის საშუალო` for a total line only; Zugdidi's late start leaves empty cells, never filled values. One standing note under the source says some prices are recorded once and applied to every city.

**City colours** (§4.2): Tbilisi `#B3402A`, Kutaisi `#3D5A98`, Batumi `#1F6E56`, Gori `#A5822B`, Telavi `#7A4E8C`, Zugdidi `#4A707A`, each ≥ 3:1 against paper and tint.

See `docs/superpowers/specs/2026-09-26-inflation-cities-design.md` as amended by `docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md`.


## National economic sectors extension

Sector table labels wrap within a bounded sticky column, preserving full names and space for values on narrow screens. Below 768px every explorer table wraps its labels (§8.4); above it, this behavior is opt-in.

Below the complete sector workspace, show four end-year highlights in the **same hero-plus-three-side-KPIs composition as Budget and municipality detail indicators** (§7.11–7.12): `1.35fr | 1fr` above the 1100px content breakpoint, stacked below it, not four equal columns or boxed cards. Largest nominal sector is the left hero (62px/44px numeral with a smaller GEL unit), with its GDP-share gauge and full sector name. The right column has a hairline divider, three stacked 24px figures, right-aligned details and existing 64×16 Sparklines: highest real annual growth, largest decline (slowest growth if none decline), and top-three combined GDP share. The sparklines trace the selected year's winning sectors from the first available year through that year; the top-three trace retains those same three members historically. Missing years break lines; a single point draws no fake trend. Exclude GDP from rankings; use all activities, never checked rows. Expose selected year, annual real-growth scope, source, unavailable growth and preliminary status. Full names remain in accessible text; missing-data explanations wrap instead of hiding the first available year. No movers board or period-comparison section is added.

Display name: `სექტორები` / `Sectors` on the page, Economy card, sidebar and workbook title. Use concise explanations under the heading, with shared intrinsic height across the three measures so switching never shifts the chart (the latest-value line reserves the national nominal line's height, which the shorter share line would otherwise give up); narrow screens may wrap without clipping text. Do not repeat `% მშპ-ში`, growth or GEL unit labels in a separate row under the line/table buttons. Preserve chart-axis units, table caption units and standalone row values. Rank the selector, table and workbook rows by the active measure's value in the selected final year, descending; keep GDP first, missing values last and stable classification order for ties. Detailed accounting caveats remain in methodology, source notes and machine-readable definitions.

The Economy hub also links to national economic sectors. Reuse the existing editorial workspace, line chart, table, year strip, paper series panel and Excel action. Do not reproduce prototype styling or add top indicator tabs. A compact joined toolbar control switches nominal GEL, share of GDP and real growth. Only Total GDP is selected initially; it stays first and removable. Switching to share of GDP with only Total GDP selected (a flat 100% line) selects the five largest sectors at the range's end instead, and so does a share-of-GDP link that names no sectors (plan default Q6, not yet confirmed by the owner). The share view's latest-value line is `Largest sector · {year}: {share}`, the largest sector's share in the latest year, on one line at 375px (U11-01, pending owner review); the ranked list and the chart name the sector. All 20 sectors are selectable without a selection limit. Search does not restrict bulk actions or counts. Nominal values display their unit explicitly; percentage measures retain signed values, and preliminary observations are marked in charts, tables and workbooks. Coverage and range bounds come from the active measure's facts. Regional sectors are not part of this page. Bounded decisions: `docs/superpowers/specs/2026-09-11-economic-sectors-design.md`.

GDP by expenditure (`/explorer/economy/expenditure`) is the same workspace with the same three-way measure control and no highlights block. Total GDP, households, government, investment, exports and imports are selected initially (owner-approved, 2026-10-20). The series list is in Geostat's order under small headings (Consumption, Investment, Exports, Imports), not ranked, and lists only the rows the active measure has: real growth shows one combined households-and-non-profits line in place of the two, and no change-in-inventories line; switching measure carries a selected households line across. The share view's latest-value line is household consumption's share in the latest year. Imports are positive amounts, so shares do not add to 100%, which the context line under the chart says. Every row has its own stable colour; the combined households line wears households'. Bounded decisions: `docs/superpowers/specs/2026-10-20-gdp-expenditure-design.md`.

**Sector colours.** Each of the 21 series has an explicit `SERIES_COLORS` entry. A sector wears a site concept colour only when it is that concept; every other sector has its own hex. All 21 are at least CIEDE2000 10 apart and at least 3:1 against paper and tint, enforced by `tests/explorer/economicSectors.test.ts`.

| ID | Sector | Colour | Shared with |
|---|---|---|---|
| `economy.gdp_total` | Total GDP | `#1E1B16` | ink reference |
| `sector.a` | Agriculture, forestry and fishing | `#2F4B3A` | agriculture and environment |
| `sector.b` | Mining and quarrying | `#663E08` | — |
| `sector.c` | Manufacturing | `#76819F` | — |
| `sector.d` | Electricity, gas, steam and air conditioning supply | `#9F7B3E` | — |
| `sector.e` | Water supply; sewerage, waste management and remediation | `#41757E` | — |
| `sector.f` | Construction | `#816150` | — |
| `sector.g` | Wholesale and retail trade; repair of motor vehicles | `#792F26` | — |
| `sector.h` | Transportation and storage | `#C26E4C` | transport |
| `sector.i` | Accommodation and food service activities | `#C16671` | — |
| `sector.j` | Information and communication | `#0D89C2` | — |
| `sector.k` | Financial and insurance activities | `#084D61` | — |
| `sector.l` | Real estate activities | `#987793` | — |
| `sector.m` | Professional, scientific and technical activities | `#6D6F50` | — |
| `sector.n` | Administrative and support service activities | `#474A02` | — |
| `sector.o` | Public administration and defence; compulsory social security | `#7A4E8C` | defence |
| `sector.p` | Education | `#3D5A98` | education |
| `sector.q` | Human health and social work activities | `#1F6E56` | health |
| `sector.r` | Arts, entertainment and recreation | `#9C3D5E` | culture |
| `sector.s` | Other service activities | `#588E54` | — |
| `sector.t` | Activities of households as employers | `#26958A` | — |

## 26. Regional economy surfaces

The 2026-10-06 map-popup removal applies to the Economy, Unemployment and municipal Budget maps. Hover and keyboard focus highlight the matching map target and list row without a floating data popup. Values remain in the ranked list, legend and accessible target names.

The Economy hub links to `/explorer/economy/regions`. Its index uses 11 region-level SVG boundaries and a value-ranked list; both open ordinary region links. Municipality boundaries and city markers are not drawn on this regional view. The map keeps the reviewed occupied-area overlays non-interactive and uses one keyboard stop per region with arrow-key movement. The index has no multi-region comparison chart. On touch (owner decision D7, 2026-10-07) the first tap on a region previews it in the same in-flow strip under the map as §20 (`{region} · {map value} →`), and a second tap or the strip opens the page; regions under 24px (Tbilisi) get a coarse-pointer touch disk. This applies to the Unemployment regions map too. The legend keeps its minimum and maximum on one row at the ramp's two ends; the ramp narrows on phones. `RegionMap` and `RegionIndex` also have an optional no-links mode (`RegionMapMetric.hrefForRegion` absent: plain shapes and rows, no tab stops, no arrow, no touch strip), used only by the regional glance of Age and sex (§29.3); the two indexes above always pass the link and are unchanged.

Region detail pages (Economy and Unemployment) show `← {previous} · {next} →` in the fixed region order beside the H1, as inflation city pages do (§25.3); below 768px each link is a 44px-tall target and a long name wraps instead of being cut. Below 768px the region picker's and the municipal picker's options are 44px tall, and the region and city pickers hide their arrow-key hint on touch screens. The municipal picker's list is at most 340px; below 768px it is also at most 40% of the small viewport height (`40svh`), so on a short phone screen the whole picker fits in view.

Each `/explorer/economy/regions/[id]` page reuses the editorial line chart, table, range strip, unlimited series panel, region picker, highlights and Excel action. Total regional GDP is first, selected by default and removable; all 20 NACE Rev. 2 activities are selectable. Activities wear the sector colours above; total regional GDP is ink. The joined measure control has exactly two choices: nominal GEL, shown with the literal `₾`, and share of that selected region's GDP, shown with Lucide `ChartPie`. There is no share of Georgia, real-growth, per-capita, USD, forecast or 2025 control.

Activity amounts are gross value added at basic prices. The share denominator is the same region and year's complete GDP at market prices and never changes with series selection. Net product taxes explain why activity shares need not sum to 100%. The end-year highlights use all 20 activities independently of chart selection. Georgian and English pages, three-sheet Excel workbooks, methodology originals, Dataset JSON-LD, the read-only query tool and central JSON/CSV files all carry the same 2010–2024 boundary. Bounded decisions: `docs/superpowers/specs/2026-09-13-regional-economies-design.md`.

## 27. Annual unemployment explorer

The age-page amendment approved on 2026-10-07 keeps its native indicator dropdown with all eight existing measures. Group options into rates (%) and counts (thousand persons). Following the user’s visual feedback, keep the original compact, underlined native select and label, without a boxed control, custom chevron or explanatory text beneath it. The Indicator label is screen-reader-only on the age page, and the survey/classification note above its workspace is omitted, as requested. The age page, hub coverage, saved ranges, tables and exports start in 2020 and contain only the eleven modern age groups; the national row and headline are removed. Age labels stay in chronological order, and the youngest available group (15–19) and the first prime-age group (25–29) are selected initially (owner decision D9, 2026-10-07). Explicitly empty selections remain empty; obsolete shared selections restore that pair.

Below the age workspace, show a semantic HTML heatmap table for all ages, independent of chart selection, using the active indicator and years. Print one-decimal values with percent or thousand-person units and preserve missing cells as dashes. A single sequential terracotta scale of six equal-width bins from zero to the maximum of all shown values, using the map ramp (paper tint to the full accent), applies to every cell. The five lighter bins carry ink text and the darkest (full accent) bin carries paper text; every pairing is at least 4.5:1. At narrow widths, contain horizontal scrolling within the table, open it scrolled to the newest year, keep age labels visible and allow keyboard scrolling. The heatmap remains visible in table mode or with no chart series selected. It adds no new chart library. Its table and legend are the shared `HeatmapTable` (`components/main-explorer/heatmap-table.tsx`), which the Demography Age and sex page also uses (§29.3); without its optional `breakYear` the output is unchanged.

The region name is an accent-coloured, dashed-underlined button inside the region page's H1, matching Economy's regional heading. Clicking it opens the reused region picker. There is no separate region-name dropdown beneath the title. This presentation was approved on 2026-10-06.

The Regions sidebar item stays active on its index and detail pages. Historical comparison instructions describe indicator and group selection rather than the index map. Wrapped Georgian series labels shrink and break within their column, keeping a gap before values. Shared Economy/Unemployment region maps track pointer and keyboard focus independently; leaving the map with the pointer restores the focused region's map/list highlight.

The regional amendment approved on 2026-10-06 reuses Economy's map/list workspace at `/explorer/unemployment/regions`: eleven linked region outlines, reviewed non-interactive occupied overlays, six sequential colour buckets, synchronized hover/focus, arrow-key movement, bilingual search and a rate-ranked list. Both map and list open a region's separate static page. Map values, legend and accessible labels are unemployment percentages for the latest source year. Summary figures show published-region count, national unemployment rate and available period. A supporting comparison link retains the historical combined groups and former shared settings.

Region detail pages use the overview's indicator checkbox panel, line chart, table, range strip and Excel action, plus Economy's region picker and previous/next links (§26). The indicator dropdown is removed from regional detail and comparison views. Only the selected region's unemployment rate is initially selected; it remains first, selectable and removable. Nine source-supported indicators are available, omitting employment rate. Hired and self-employed counts expand beneath Employed, matching the overview, and cover 2020–2025. A note explains that coverage and the small unclassified remainder. Selecting the parent with either child preserves the parent's longer history with gaps for unavailable child values; selecting only children fits to their published years. Percentage/count selection and bulk actions follow the overview rules. The title identifies the region, coverage comes from its own observations and the source note explains earlier combined groups. No combined observations are assigned to modern-region history. The regional comparison retains country and historic group identities behind index hash links. Age groups keep their existing controls; Gender follows the amendment below.

The bounded 2026-10-04 design, with navigation amended on 2026-10-05 and overview selection amended on 2026-10-06, reuses the budget hub cards and economic-sectors workspace. The hub at `/explorer/unemployment` presents eight cards, in order: Unemployment overview, Regions, Age groups and Gender, linking to `/overview`, `/regions`, `/age` and `/gender` under that hub, then the four labour detail cards 05–08 described below. The sidebar repeats this order. Titles, descriptions and coverage belong to each page; card figures and years come from served facts. Only the overview card uses the national unemployment-rate sparkline. The other cards show their source-derived annual coverage without implying a single regional, age or gender aggregate.

All four pages reuse the existing line chart, table, RangeStrip, series selector and Excel action. Each page fixes its own main comparison, replacing the former seven-option breakdown selector. The unemployment overview alone has centred, wrapping editorial text tabs: Overview, Urban/rural, Education and Long-term unemployment. Its indicator dropdown is removed: the national list contains indicator checkboxes, with self-employed and hired employees beneath Employed people. Employment rate is omitted. Urban and rural parents select their own unemployment rate; other indicators are children, including the same employment subcategories. Long-term indicator parents select Georgia, with only Men/Women as children. Education has unemployment rate only and retains the existing Total/Women/Men segmented tabs above search. Selecting a percentage clears all people counts and selecting a people count clears all percentages; ticking a series in the other unit shows a one-line status notice at the top of the list naming what was cleared, and the next same-unit tick or the bulk toggle removes it. Multiple series with the same unit remain unlimited. Bulk selection uses the current unit: the denominator and bulk action cover the top-level rows of that unit, ticked rows under a caret show as `ქვეკატეგორიები N`, and when every row of the unit is nested (people counts on sex/settlement) those rows are the scope. Search never scopes it. Age groups retain their single-indicator dropdown and their own default pair (above). Elsewhere, except for Gender's Men/Women default (below), only the applicable unemployment-rate reference is selected by default; it remains pinned, selectable and removable. URL settings and language changes preserve the indicators, supporting tab, education sex, years, selection and view. Changed coverage is fitted to loaded years and announced accessibly. Former single-explorer links migrate to the matching page; removed metrics normalize to unemployment rate and mixed-unit links keep the last valid selected unit. A page's hash cannot switch it into another main section.

The national overview header keeps its fixed title and subtitle across all four tabs, followed by the one-line latest value described in the GDP overview extension, for the active indicator (owner decision D2, 2026-10-07). Every unemployment page carries the same line: the active indicator for Georgia, or for the region on a region page; the age page names its first selected group. The survey/breakdown note stays omitted from the overview header; the source note and methodology link remain below the chart.

The Gender amendment requested on 2026-10-07 removes its indicator dropdown and former single-indicator headline; the page keeps only the shared latest-value line described below. Men and Women select their own unemployment rate and expand to the other seven existing indicators, including employment rate, following the Urban/rural panel. The national unemployment-rate reference remains first and selectable; Men and Women unemployment rates are selected with it by default (owner decision D9, 2026-10-07). Links carrying their own indicator or selection keep their meaning, and the default never writes to a pristine URL. The existing checkbox panel keeps percentages and people counts separate, with search-independent bulk selection, complete group/indicator labels in charts, tables and Excel exports, and saved selections preserved across language changes. This amendment adds no data or employment-status estimates.

The labour detail amendment approved on 2026-10-20 adds four national pages after Gender, as hub cards 05–08 and in the same order in the sidebar: Jobs by industry (`/industries`), Hours worked (`/hours`), Informal jobs (`/informal`) and Young people not in work or study (`/young-people`). Each card shows its page total's sparkline, latest figure and coverage from served facts; the four existing cards do not change. The pages follow the Education topic workspace (§39): one unit per page, so no tabs and no measure switch; chart or table, the range strip and Excel; one flat searchable list under small headings (Everyone / Women / Men on Jobs; Everyone / Women / Men / Towns / Villages on Hours; Informal jobs (Georgia, Women, Men, Towns, Villages; the owner removed the unused-labour rates on 2026-10-20); Ages 15–24 / Ages 15–29), with the page total first and the only row selected by default, pinned, selectable and removable. Row names carry no prefix in the list and their heading outside it (`Women — Construction`). Industries keep their Economy sector colour under Everyone and its shade-helper steps under the other headings; each page total is ink. Under the heading sits only the latest line, which fits one line on a 375px phone in both languages: `Employed · 2025: 1,389.7 thousand`, `Usual weekly hours · 2025: 41.0`, `Informal share of non-farm jobs · 2025: 28.3%` and `Aged 15–24, not in work or study · 2025: 17.6%`. A year without a value is a gap, a dash or a blank Excel cell, never zero; Men — Households as employers on Hours has no values and stays listed with a dash. Bounded decisions: `docs/superpowers/specs/2026-10-20-labour-detail-design.md`.

The national context below the workspace appears only on the national overview's Overview tab and uses the existing stacked-column chart for employed, unemployed and outside-labour-force counts. It uses exact national source values over the active years, with one-decimal display, independently of the main selected groups. Survey-estimate limitations and original-source methodology remain visible. No paired-dot plot, scatterplot or new chart library belongs to this version. The age heatmap below is the approved exception. The authoritative scope is `Project_Definition.md` §2D; bounded decisions are in `docs/superpowers/specs/2026-10-04-unemployment-reuse-explorer-design.md`.

## 28. Trade hub and national goods Overview

Approved on 2026-10-08, extended with Products on 2026-10-09; scope owner: `Project_Definition.md` §2E. All Trade routes and their English mirrors reuse the editorial shell. The hub has Overview, Trading partners, Products, Domestic exports, Services trade and Trade composition cards, with data-derived coverage. Services uses its own turnover sparkline; the existing goods cards retain their context. Its place in the sidebar is set in §6.7; these six children appear only in the active Trade context.

The Overview workspace reuses the existing line chart, table, annual range strip, series aside and Excel button. Four checkbox rows remain in this order: `საგარეო სავაჭრო ბრუნვა` / Total trade (ink), `ექსპორტი` / Exports (editorial green), `იმპორტი` / Imports (editorial blue), `სავაჭრო სალდო` / Trade balance (editorial muted brown). Only turnover is selected initially and it is removable. Search never narrows bulk selection or the denominator of four. Default mode is line and the range derives from all loaded annual observations.

Choose one million/billion USD display scale from all four indicators over the active years; changing checkboxes cannot change that scale. The table shows selected indicators and annual amounts without share or change columns. Preserve all years, mode and explicit empty selections in URL state and across languages.

Below the workspace, four end-year figures remain independent of selection; an absent end-year observation is a dash. Below them, reuse the signed column chart for one balance series, with no overlay, over the same years. It remains present in main-table and empty-selection modes. Explain that negative means imports exceed exports and positive means exports exceed imports; avoid favorable/unfavorable color judgments. Both charts, summaries and table declare USD units.

The native three-sheet Excel workbook follows selected indicators and years, with USD amount headings, neutral signed formatting, actual-record basis, unspecified publication status, both formulas and original-source links. The public methodology explains nominal USD and FOB/CIF valuation. Sources, language alternates, breadcrumbs and coverage match the accepted national goods subset. Bounded Overview spec: `docs/superpowers/specs/2026-10-07-trade-overview-design.md`.

### 28.1 Trading partners

Approved 2026-10-08: trends first, one active Total trade / Exports / Imports / Balance measure, existing line/table/range workspace and series aside. No unit or lead line sits under the heading (§17): the chart toolbar names the active measure and Million/Billion USD scale, and the source note declares nominal US dollars; line-chart amount ticks show numbers only. Only Georgia total is selected initially, first and removable; years and catalogue counts derive from accepted facts. Countries and Country groups are text browsing tabs above local search. They share one unlimited selection: selected opposite-tab rows remain visible and removable before the active choices, and global Clear / Select all, counts, table, URL and Excel include both kinds. Search resets on browsing-tab changes and does not rebuild the chart. Reuse the editorial palette with stable identity-based assignment and independently readable labels.

The end-year ranking below the workspace ignores checkbox selection and selector search. Show ten numerical countries first and allow the complete catalogue, with unavailable observations unranked; show all five groups. Each row has a horizontal amount bar, readable USD value and same-year national share for turnover/exports/imports. Balance bars use a neutral centered zero axis, rank by absolute magnitude and have no share column. Below 640px the share column is headed `წილი` / `Share` (the note above the table says what it is a share of), and below 768px the ranking header and months label are 11px. Groups overlap: show the note when browsing or selecting groups, with no pie, stacked composition or summed group total. Missing amounts stay gaps/dashes/blank Excel cells; published zero remains zero. Preserve selected measure, both kinds, years, mode and empty state through reload, language changes, history and active sidebar clicks. Scope and details: `docs/superpowers/specs/2026-10-08-trade-partners-design.md`.

### 28.2 Products

Products uses a full-width chart at the top, visible on entry at 1366×768 and 390×844 in both languages. The compact heading and Exports/Imports/Add products row precede Line/Table, USD unit and Excel controls. Owner scope amendment, 2026-10-10: the page displays only the 2020–2025 source block, one entry per product. Only removable Georgia total is initially selected, restricted to the same loaded years, in Exports/Line mode. Selected labels follow the plot: four on desktop, two on phones, with +N more opening Selected. Labels use compact 28px desktop / 36px phone controls, bounded width, truncated names and visible code; the full name remains available in the tooltip and accessible remove label. The common coverage is shown once in the page header; period suffixes are omitted from product labels. The range, source/definition note and independent end-year ranking follow. The USD display scale depends on the active flow and resolved years, not which lines are selected within those years. No permanent catalogue aside is present.

Available chart years follow the first and last numerical observation across the committed selection in the active flow, inside the current source period. Keep genuine internal gaps and published zero/negative values. An entirely unavailable selection uses its published observation years across flows, including products published for only one flow; amounts stay unavailable. An empty selection retains the current-period range. Refit manual ranges with the existing range rules. Chart, table, slider, saved link and workbook share the resolved range. The Products hub card and metadata describe the current period; other Trade pages retain their own coverage.

Add products mounts a native modal dialog with Browse categories / All products / Selected tabs, local multilingual name/code/alias search, global Clear/Select all and complete current-period catalogue count, pinned removable national reference and eight category tiles or at most 25 result rows. The modal owns a draft; Compare commits it, while Close, Escape and backdrop clicks discard it. Close receives initial focus; keyboard navigation stays inside, background scrolling is locked and opener focus/scroll are restored. Categories are navigation groups only. Product names and codes appear in the picker, tooltips, table, ranking and Excel. Historical source versions remain preserved separately behind the public projection. Missing years remain gaps/dashes/blank cells, and zero/negative amounts retain their values.

The table pages selected series in groups of 25; Excel includes the entire selection. Reuse the partner ranking below: top ten numerical products initially, expanding to one 25-row sequence of ranked then unavailable versions. Shares use the matching national goods total; negative product amounts use a centered neutral axis while retaining shares. Saved links preserve committed flow, mode, years and unlimited/empty selections through the versioned catalogue-bound compact selection encoding. Scope and details: `docs/superpowers/specs/2026-10-09-trade-products-design.md`.

### 28.3 Domestic exports

Approved 2026-10-10: one Domestic exports page with Overview / Countries / Products text tabs. Reuse `TradeOverview`, `TradePartners`, `TradeProducts`, their selectors, charts, tables, rankings and native Excel workbooks through small additive dataset options; existing pages retain their defaults. Overview compares Total exports, Domestic exports and Re-exports for 2014–2025, with only removable Total exports selected initially, three end-year figures and no trade-balance chart. Total exports keeps the Exports green; Domestic exports wear editorial slate (`#4A707A`) and Re-exports ochre (`#A5822B`), never the Overview's Imports blue or Balance brown. Countries compares one Domestic exports / Re-exports measure at a time, with only removable Georgia total initially selected and the same 2014–2025 range. Groups are absent. Products uses the current picker, full-width chart and 25-row table/ranking paging for 2020–2025; its only flow is Domestic exports, and Other commodities is a selectable residual without an invented code. Shares use the corresponding domestic or re-export national amount.

Derive coverage, counts and defaults from loaded observations. Saved links retain the active view, years, display mode and unlimited or explicitly empty selection through reload, history and language changes; switching views remembers the view's last comparison. Search never narrows bulk selection or export. Missing re-export counterparts remain gaps/dashes/blank Excel cells. State the domestic-value-added limitation, reviewed subtraction and selected-product/remainder limits in the existing source-note area. Keep the established editorial and mobile layouts; no new visual system is introduced.

Keep one page-level tab row. Countries places its small Domestic exports / Re-exports controls below search in the series panel, following the existing municipality/region control style; never add a second measure-tab row beneath the page tabs. Products has no flow tab because Domestic exports is implicit; Add products remains above its chart.

### 28.4 Services trade

Approved 2026-10-11, navigation amended 2026-10-12 and countries layout approved 2026-10-14 (`docs/superpowers/specs/2026-10-11-trade-services-design.md`, amended here). The Services trade page and English mirror use one heading with no line beneath it (§17; the source note declares nominal USD) and one text-tab row: Overview / Total services trade / Services exports / Services imports / Services balance. Reuse `TradeOverview` and `TradePartners` through their explicit services dataset options, the shared Trade tab state, series panel, charts, tables, annual range controls, ranking and native Excel. The fifth hub card and active sidebar child follow Domestic exports, with services turnover and loaded coverage.

Overview offers Total services trade, Services exports, Services imports and Services balance, with four independent end-year figures and the signed balance context chart. Each measure tab opens the current comparison, defaulting to Service types from Overview. A Service types / Countries text-tab row appears above search in the existing series panel (below the chart on mobile). Types retain the removable national total and twelve types. Countries retain the removable Georgia services total, 149 named countries and four labelled other/unknown entries from the published country-total files. Types and Countries remember separate selections while measure, years and chart/table mode carry across the switch; no country-group view is added. Each view initially selects only its applicable total, in line mode over all loaded years. Selection is unlimited; search never scopes bulk actions, counts, ranking or Excel. The independent end-year ranking shows all twelve types or the top ten named countries with Show all; residual entries remain selectable but are excluded from country rankings. Non-balance shares use the matching same-year national services total, while Balance uses absolute magnitude, signed neutral bars and no share. Scale follows the full relevant catalogue over the active range independently of checkbox selection.

In both Service types and Countries, the Download button sits below the series list.

Saved links retain view, active measure, years, mode and explicit empty selections through reload, history, language changes and active sidebar links; switching views remembers the last comparison. Missing values remain gaps, dashes and blank workbook cells; zero stays numerical. Keep `services.total` and service-type identities separate from goods. Service country identities keep the source period and are not aliases of goods-country histories. Explain resident/non-resident definitions, the unavailable 2020 maintenance/repair export, exact formulas, country holds and the distinct NBG vintage in the existing methodology. No new component family or visual system is introduced.

### 28.5 Trade composition

Approved 2026-10-14 (`docs/superpowers/specs/2026-10-14-trade-composition-design.md`), with an owner-requested control-position amendment on the same date. The sixth hub card and last active Trade sidebar child open Trade composition and its English mirror, with data-derived 2000–2025 coverage and a national-exports sparkline. Keep one heading, the approved one-line lead and exactly one Exports / Imports text-tab row above the workspace. Goods groups / Economic categories sit below search in the series panel and wrap readably on phones. The first view shows ten SITC sections; the second shows seven published BEC categories, without reducing them to a pure three-way capital/intermediate/consumer split.

Reuse `TradePartners`, its navigation and series-controls slots, the series panel, charts, table, annual range strip, ranking, native Excel and existing Trade section state. The first release shows nominal USD only, with no percent-chart toggle. Each classification initially selects only the removable Georgia total, first in its selector, in Exports/Line mode over all loaded years. Selection is unlimited and may be explicitly empty; search never scopes bulk actions, counts, ranking or Excel. End-year category amounts and shares use the matching national total; unavailable or zero denominators yield no share. Missing values stay gaps/dashes/blank workbook cells, while published zero and negative amounts retain their meaning. Public workbooks omit percentage, publication-status and internal metadata columns.

Saved links retain `section=sitc` or `section=bec`, flow, years, mode and explicitly empty selections through reload, history, language changes and active sidebar links. Switching classifications remembers each comparison and keeps focus on the selected classification tab in the series panel, visible below the phone header after the remembered chart/table layout settles. Both compact datasets are loaded statically; tab changes perform no fetch. Sources and definitions remain below the chart; preserve the warm editorial system and add no summary paragraph beneath the heading.

## 29. Demography surfaces

The sidebar's last dataset link (§6.7), `დემოგრაფია`, opens a hub at `/explorer/demography`: the shared hub cards numbered 01–04, where a page that is not yet published is a non-clickable `მალე` card. The Population card carries Georgia's series as a sparkline broken at the census re-base; the Migration card carries a net-migration sparkline (not broken, since migration counts do not break at the re-base) and the footer `{year}: წმინდა მიგრაცია {net} · {first}–{last}`. The Births, deaths and fertility card carries a births sparkline and the footer `{year}: {births} დაბადება · {first}–{last}`. The Age and sex card carries a line of Georgia's share aged 65 and over and the footer `{year}: {share} aged 65+ · {first}–{last}` (Georgian `{year}: 65+ — {share} · {first}–{last}`). All four cards are live; none is a `მალე` card.

**Population** is the Budget municipalities page set (§20) showing persons instead of money: an index at `/explorer/demography/population` and one page for Georgia (`/georgia`), for each of the 11 regions (`/region/{id}`) and for each of the 63 municipalities other than Tbilisi (`/{slug}`, the Budget slugs). It introduces no new surface type. The index is `MunicipalitiesIndex`; a place page's heading, two-column shell and a region's list of municipalities are `EntityHeading`, `EntityWorkspaceShell` and `EntityMemberList`, moved out of the Budget place pages and shared with them; inside them sit the editorial line chart, table, range strip, series panel, hero and side KPIs and Excel action. Tbilisi is one place, `region.tbilisi`, with one page: its row in the municipality list, its polygon and city dot on the map and its municipality row in the picker all open `/region/tbilisi`, and the municipality previous/next ring skips it. The 75 place pages are a closed set (an unknown id or slug is a 404) and each exists under `/en`. The sidebar's Population entry stays current on the index and on every page under it. Density has no chart, map or toggle anywhere in the set: it is a second line under Georgia's and each region's persons on the index, one of the index's four key figures (the densest region's), a key figure on each region's page (Georgia's page shows the densest region's) and a column in Excel.

**Index.** Under the breadcrumb row (coverage `{first}–{last} · 1 იანვრის მდგომარეობით`) come the serif H1 `მოსახლეობა` and the unit line `ადამიანი, 1 იანვარს`, then the Budget index layout (§20): on the left the municipality map with its legend, two notes and the four key figures, on the right the ranked list, side by side from 1100px of column width and stacked below it. No row of buttons sits above the map and nothing on it selects. It is `MunicipalityMap` as §20 describes it: clicking or pressing Enter on a municipality opens that place's page (on touch the first tap previews it in the strip under the map, `{name} · {persons} ადამიანი, 1 იანვარი {year} →`, which opens the same page), hovering or focusing a shape and its list row highlight each other, and the single tab stop with 64 targets, the green city dots and the hatched occupied areas are unchanged. It always draws the 64 municipalities whichever list tab is open and shows the latest loaded year only, in the same six-step ramp and equal-count buckets; the legend caption (`ადამიანი, 1 იანვარი {year}`) says persons, the group label names the measure and the year, and the accessible names carry the persons figure. Two muted notes sit under it: the census note (from 2025 the figures rest on the 2024 census, so maps for 2024 and 2025 are not comparable and the map shows the latest year only) and the density note (density is the 1 January population divided by one fixed March-2014 area, occupied territories excluded; Tbilisi's area is read from the reviewed mapping, 504.24 km² in Geostat's convention, not the 726 km² often cited).

**Key figures and list.** `ძირითადი ინდიკატორები` are four figures: Georgia's population with its basis sentence, the largest region with its share of Georgia, the densest region in persons per km², and the smallest municipality. The list has the tabs `მუნიციპალიტეტები` (default) and `რეგიონები`, `ადამიანი` where the Budget index prints `₾`, a search over Georgian and English names (a municipality's region too) and a count. Municipalities: 64 rows ranked by persons, each with rank, name, region, bar and persons. Regions: Georgia first and unranked, then the 11 regions ranked, each with its municipality count and persons; Georgia and the regions carry their density under the persons (`2,715.7/კმ²`). Every row links to its place's page, the tab is restored from `#lvl=region`, and the source note names Geostat, links the methodology page and carries the map-boundary attribution of §20.

**Place pages.** Each opens with the breadcrumb row (`მთავარი / მონაცემები / დემოგრაფია / მოსახლეობა /`, then a municipality's region, then the place; coverage from the place's own years, which start in 2004 for Georgia and in 2015 for every other place) and the Budget place heading `მოსახლეობა — {place} ▾`: the place name is the trigger of the picker, which also opens on ⌘K and lists Georgia first, then the 11 regions in value order each with its municipalities, every entry opening its own page. A meta line follows: for Georgia its region and municipality counts and years; for a region its municipality count and for a municipality its region, then for both its rank by persons among the 11 or the 64 and the 1 January date of the latest year; the line does not follow the range. Regions and municipalities add `← {previous} · {next} →` neighbours in registry order within their own level, wrapping; Georgia has none.

**Workspace.** The Budget place-page shell: the chart column and, from 1100px of column width, a sticky 340px aside, which stacked below it gains the 2px ink top rule. The left column holds `ხაზი / ცხრილი` with the unit line, the chart or table (on phones with the legend of latest values and the return-to-chart pill, §8.3, §7.14), the range strip over the place's own years with the 2025 marker, the source note with the methodology link, the census note and, on a region page with municipalities, `რეგიონის მუნიციპალიტეტები`: its municipalities ranked by persons, each a link, as on the Budget region page. The aside holds the tick-list, `ჩამოტვირთვა` and `← მოსახლეობა`, the way back to the index. `ძირითადი ინდიკატორები` follow the workspace.

**Tick-list, chart, table and Excel.** The tick-list is the standard series panel (§7.6, §7.7) and holds the place and its parts: Georgia's parts are its 11 regions and a region's its municipalities; a municipality has none, and neither has Tbilisi, a region whose one municipality is itself. Only the place is ticked at first (the applicable total: first, selectable, removable); the parts follow ranked by persons in the end year of the active range, ties by registry order, each row with its swatch, name and persons in full. Selection is unlimited and kept in the address; ticking a part draws its line and adds its table row; the bulk control and the `სერიები {selected} / {all}` count cover the whole list, never the search result. The chart is the editorial line chart (§8.3) with the re-base break; its axis is in thousands (`ათ.` / `k`) over the ticked series only, and the tooltip prints full persons. The table lists the place first as its total row, then the ticked parts, in full persons, with no change column, `—` for a year without a value and the census note in its caption. There is no share measure and no compare mode, and the empty-selection and empty-range notices are the Budget ones (§7.9). `ჩამოტვირთვა` creates the three-sheet workbook (§15) of the ticked places and the range: the re-base is marked in the 2025 column header and in the data sheet's basis column, density is blank for municipalities, and the place is in the file name (`fiscal-demography-population-batumi-2015-2026-en.xlsx`; the place part is `region-adjara` for a region and `georgia` for Georgia).

**Key indicators.** `ძირითადი ინდიკატორები` use the hero-plus-three-side anatomy of §7.11–7.12 and describe the place of the page for the end year of the active range; the hero label names it. Georgia: its population in full persons with the basis sentence, then the largest region (persons and share of Georgia), the densest region (persons per km²) and the smallest municipality. A region: its population with its share of Georgia, its rank among the 11, its density with its rank, and its number of municipalities. A municipality: its population with its share of its region, its rank among the 64, its share of Georgia, and its region. A figure that is a series carries a `Sparkline` over the active range, drawn as two segments across the re-base. If the end year is before 2015, every figure that needs a region or municipality value prints `—` and says regional data starts in 2015. No figure states a change. Georgia's page and each region's page show a density, so they carry the index's density note (the **Index** paragraph above), in the same words, at the foot of the key indicators, under their note; a municipality's page shows no density and carries no note.

**State** follows §6.3. A place page keeps `m` (line or table), `r` (the range) and `sel` (the ticked places, Tbilisi as `region.tbilisi`) through the shared municipal state; the index keeps `lvl=region` for its Regions tab. Search text is never written to the address.

**The census re-base** applies wherever a population-based value is drawn: a marked series is drawn in two segments, never joined across 1 January 2025; a dashed vertical rule (`4 3`) sits between the 2024 and 2025 positions with the short label `აღწერით გადათვლა` (11px mono, on the side with room); tables carry a 2px ink rule left of the 2025 column with the label on its header, and in the phone year-rows layout (§8.4) a 2px ink rule between the 2025 and 2024 rows with the label under 2025; the range strip marks 2025, its label shifted by its position so it stays inside the strip (§7.4); the chart tooltip and workbooks name each year's basis in plain words, and the index map carries the basis in its census note. No growth, change or rank movement is shown for any pair of years that spans the re-base.

**Place colour.** These pages add no colour token. A place wears one colour on every page it appears on, and no page draws two lines in one colour. Georgia is `ink`; a region takes the editorial palette by its registry order; a municipality keeps the palette colour its sort position gives it unless that is its region's colour, in which case it takes the next palette colour that neither the region nor a sibling wears and that is not `#94856D`, the grey that "other" wears. On the served data exactly four municipalities move: Sighnaghi, Khoni, Martvili and Dmanisi. Known limitation: the palette holds two near-twin greys, `#8A7B65` and `#94856D` (about 4 on CIE76). The walk never gives out the second, so they appear together on one region page only, Imereti, where Tskaltubo and Terjola wear them by their registry positions, when both lines are ticked; every line still has a swatch, a label and a named tooltip row, so colour is never its only carrier (§13). Bounded decisions: `docs/superpowers/specs/2026-10-04-demography-section-design.md` and `docs/superpowers/specs/2026-10-04-demography-population-design.md`.

### 29.1 Migration

One page, `/explorer/demography/migration` (under `/en` in English), with no place pages: every migration row belongs to Georgia. It is the Trade / Unemployment page shell (`ExplorerPage`, `PageHeader` with coverage `{first}–{last} · წლიური`, serif H1 `მიგრაცია`, a lead sentence in Trade's summary style (`რამდენი ადამიანი შემოვიდა საქართველოში და გავიდა ქვეყნიდან ყოველ წელს, მოქალაქეობის მიხედვით.`), the workspace, `ძირითადი ინდიკატორები`, `SourceNote`) with no buttons above the workspace. It adds no surface type; its one addition to the colour system is the six `citizenship.*` series tokens of §4.2.

**Chart.** The shared `StackedColumnChart` with `periodsPerYear={1}`: for each of the six citizenship groups arrivals are a positive segment and departures a negative one, in the group's §7 colour, so the bars rise above and fall below a zero line. Values are drawn in thousands (axis `ათასი ადამიანი`) and every printed value, in the tooltip, caption and segment label (`შემოსვლა · რუსეთი`, `გასვლა · რუსეთი`), is in whole persons. The segment label keeps the direction (`შემოსვლა · რუსეთი`, `გასვლა · რუსეთი`) for the caption and screen readers, but the hover readout is different: each row is an arrow (`ArrowUp` for arrivals, `ArrowDown` for departures) in the group's colour, the group's name, and the number without a sign, with all arrivals by size first and then all departures by size, every row shown (twelve at most, no `+N სხვა` line). Only the overlay keeps its sign (`formatOverlayValue`). The overlay is the net migration of the selected groups and sex, the ink line with an end dot, labelled `წმინდა მიგრაცია` when all six groups are selected (it then equals Geostat's published net) and `წმინდა მიგრაცია (არჩეული ჯგუფები)` otherwise; the hero and the chart readout print its sign explicitly (`+`, `−`). At every width a `legend` key above the chart names the selected groups and the net line, in that order. Migration counts do not break at the 1 January 2025 census re-base, so there is no census marker, break or dashed rule on this page, and no sentence names a cause or an event.

**Toolbar and aside.** Left, the chart/table switch `სვეტები / ცხრილი`; right, the joined icon-only `SegmentedTabs` (Lucide `Users`, `Mars`, `Venus`, 18px, 1.5 stroke, as the economic-sectors measure tabs) named `ყველა / მამაკაცები / ქალები` for assistive technology and the control tooltip, which filters the chart, table, indicators and workbook. The aside is the standard series panel with six rows in fixed order (Georgia, Russia, Turkey, Azerbaijan, Ukraine and the computed remainder, labelled `სხვა ქვეყნები` (owner decision, 2026-10-09; the source note, methodology and workbook say it is computed), never labelled a country). Each row reads "arrivals / departures" for the end year: the shared row renders its meta before its value, so arrivals are the labelled meta and departures the value. **All six groups are selected by default**, a documented departure from "only the applicable total starts selected" for the same reason as the inflation categories page: the chart shows the parts of a whole. Search matches the Georgian and English group names, and the bulk controls and `სერიები {selected} / 6` count cover all six. With none selected the empty-selection `Callout` shows.

**Table.** `ExplorerTable` for one direction at a time, chosen with `SegmentedTabs` `შემოსვლა / გასვლა / წმინდა`: the selected groups plus a total row (`ჯამი` with all six selected, `არჩეულთა ჯამი` otherwise), years as columns; departures are positive counts. On the Net tab the shared table formatting prints negatives with `−` and positives without a sign.

**Key indicators.** The usual layout of §8.5: the title left and `არჩეული პერიოდი: {start}–{end}` right (one year when they are equal). For the end year of the range and the sex filter, not affected by the group selection: a hero with the net of the end year (signed, red when negative), under it the 3px two-part bar of arrivals (ink) and departures (accent) with an `ArrowUp` arrivals figure left and an `ArrowDown` departures figure right in 11px mono, then one paragraph: the neutral sentence followed by the cumulative net over the range. Three side figures with sparklines: arrivals, departures and foreign citizens' share of arrivals (the total minus the Georgia group, one decimal, computed by Fiscal.ge); each one's detail reads `{start}: {value at the range start}` and is empty for a single year. Its state is the hash keys `view`, `start`, `end`, `sel`, `sex` and `dir`, restored after load with every change replacing the history entry (§6.3); `start` and `end` are the shared year-range keys, and the default address also carries `range=all`.

**Workbook.** One `ჩამოტვირთვა` download for the active range, group selection and sex filter, in the three-sheet model of §15, citing both Geostat originals (tables 31 and 33); the definition of the computed group sits in the Summary subtitle, because the Sources sheet has no free-text line, and that row is fitted to its text (§15) so a short range shows it in full. Bounded decisions: `docs/superpowers/specs/2026-10-04-demography-migration-design.md`.

### 29.2 Births, deaths and fertility

Approved 2026-10-09 (`docs/superpowers/specs/2026-10-04-demography-births-deaths-design.md`). It adds no surface type and no chart: it reuses the Population place pages and index, `StackedColumnChart`, `EditorialLineChart`, `ExplorerTable` and the three-sheet workbook of §15. Births and deaths carry no census marker and no sentence names a cause; the total fertility rate, the age-specific rates and life expectancy carry the 2025 census re-base like the Population chart.

**Place section.** Every Population place page (Georgia, each region, each of the 63 municipalities) ends with one `დაბადებები და გარდაცვალებები` section, anchor `#births-deaths`, after the key figures. It describes that place only. The shared `StackedColumnChart` draws births up (`vital.births`) and deaths down (`vital.deaths`) from a zero line, with the natural increase as the ink line over them, and at every width a `legend` key above the chart names births, deaths and natural increase; there is no range strip and no census marker. The section title is followed directly by the chart, with no lead line. `სვეტები / ცხრილი` switches between the chart and `ExplorerTable`. Below it are the key figures (natural increase as the hero; births, deaths and births per 100 deaths) and one streak sentence (`{year} წლიდან ყოველ წელს გარდაცვალებათა რიცხვი დაბადებათა რიცხვს აღემატება.`; when deaths led only in the latest year, `{year} წელს გარდაცვალებათა რიცხვი დაბადებათა რიცხვს აღემატებოდა.`; or the sentence for the year births led, or for equal counts). The section has its own `ჩამოტვირთვა` Excel workbook and a link to the national page.

**National page.** `/explorer/demography/births-deaths` (under `/en` in English) is one scrolling page with no tabs, no range or year control and no hash state of its own (the reused places list keeps its `lvl` hash), in the Migration page shell (§29.1). It has its own sidebar entry, `შობადობა და სიკვდილიანობა` (`Births and deaths` in English). It has three blocks. First the places block, which is the Population index layout (`MunicipalitiesIndex`: map, legend, four key figures, ranked list with municipality and region tabs and search) coloured and ranked by births per 100 deaths in 2025; the key figures are the births, the deaths, Georgia's births per 100 deaths and the number of municipalities with more deaths than births, and every row opens that place's page at `#births-deaths`. Then `ნაყოფიერება`: the total fertility rate as a line with the census marker, and the age-specific rates by age of the mother as one line per year, 2014 (`#3D5A98`) and 2025 (`#B3402A`) coloured and named in a legend, the other years in `#94856D`; each is a line chart with a `ხაზი / ცხრილი` switch, and one Excel download covers both fertility charts. Last `სიცოცხლის მოსალოდნელი ხანგრძლივობა დაბადებისას`: three lines, total in ink, men in `sex.male` and women in `sex.female`, with the census marker, the same `ხაზი / ცხრილი` switch and its own Excel download.

### 29.3 Age and sex

Approved 2026-10-10 (`docs/superpowers/specs/2026-10-04-demography-age-sex-design.md`). It follows the Births pattern: one national page and a block at the end of the Georgia and region Population pages. It adds no surface type and no chart library: it reuses `RegionIndex` and `RegionMap`, the shared `HeatmapTable` (§9.1, §27), `SegmentedTabs`, the shared `YearPicker` (§7.15), `TextTab`, `SourceNote`, `Callout`, the three-sheet workbook of §15 and the `sex.male` and `sex.female` tokens of §4.2. The one new drawing is the population pyramid. No sentence names a cause.

**National page.** `/explorer/demography/age-sex` (under `/en` in English) is one scrolling page with no top-level tabs, in the Migration page shell (§29.1): `PageHeader` with coverage `{first}–{last} · წლიური და 2024 წლის აღწერა`, the serif H1 `ასაკი და სქესი`, one lead sentence, then three parts, each under a `SectionTitle`, in this order: the pyramid, the heat map and the regional glance. The pyramid and the heat map have a source note (naming the methodology page) and their own `ჩამოტვირთვა`; the regional glance has the Regions index's source note and no download. It has its own sidebar entry, `ასაკი და სქესი`. Part state lives in the hash (§6.3, keys `year`, `cmp`, `measure`), written with replace.

1. **`საქართველოს მოსახლეობის პირამიდა`** is Georgia's pyramid for one 1 January. There are no year buttons. One control line carries two year pickers (`YearPicker`, §7.15) of one fixed width side by side (full width, stacked, on phones), each with a small visible label, then the measure tabs `%` / `ადამიანი` (shares of the year's total by default). Each opens a four-column grid of years, 2004 top-left, in which 2025 carries the accent `*` and a footer line reads `* 2025 — აღწერით გადათვლა` (owner decision 2026-10-11, replacing native selects whose open list the browser draws). The `წელი` picker lists every year from 2004, the latest selected; choosing the year that is currently compared drops the comparison. The `შედარება წელთან` picker has a full-width `არცერთი` row above the grid (the default, comparison off) and then every year but the one shown; choosing a year turns the comparison on and `არცერთი` turns it off. The comparison year is drawn as a 1.5px ink outline over the bars and both years share one scale. When the two years lie on either side of the 2025 re-base, a `Callout` says the pyramid shows shares only and no difference is computed, the `ადამიანი` tab is inert (`aria-disabled`, with the reason as its tooltip) and the pyramid is drawn in shares; within one side of the re-base nothing is restricted. The national pyramid has no `პირამიდა / ცხრილი` switch and no table twin: the figure is always shown, each row is a labelled unit with its counts, and the whole series is in the heat map and the downloads. Under the figure one mono line prints the 0–14, 15–64 and 65+ shares and the women per 100 men.
2. **`ასაკი წლების მიხედვით`** is the shared `HeatmapTable`: 18 age groups (85+ at the top) by 2004–2026, each cell printing and shaded by that group's share of the year's population, in Unemployment's six equal-width `MAP_RAMP` bins from zero to the largest share. It scrolls inside its own frame and opens on the newest years, as on Unemployment. The optional `breakYear` draws the 2px ink rule left of the 2025 column and prints the break label on its header, and a caption says the re-base moved some groups' shares. One neutral sentence explains how to read the diagonals. It has no chart/table switch (the table is its own text form) and no tooltip.
3. **`65 წლის და უფროსი მოსახლეობის წილი რეგიონების მიხედვით`** is a regional glance at the foot of the page: the Unemployment Regions index (`RegionIndex`) in its optional no-links mode (`RegionMapMetric.hrefForRegion` absent). The region map is shaded in the six-step ramp by the share aged 65 and over in the 2024 census, beside the searchable ranked list (descending, ties by registry order) and three figures (Georgia's share, the oldest region, the youngest region). The legend and the accessible names say `აღწერა 2024`. Nothing here is a link: the map shapes are plain `role="img"` groups with no tab stop, the list rows are plain rows without an arrow, and there is no touch preview strip; hovering a shape or a row (and the search) still highlight and filter. The no-links mode exists for this part only; the Unemployment and Regional economies indexes keep their links, arrow keys and touch preview. The ranked list is the text form, so this part has no chart/table switch and no download.

**The pyramid** (`PopulationPyramid`, drawn from the pure `lib/explorer/pyramidLayout.ts`) is one SVG, centred, at most 640px wide on the national page. It measures its container with a `ResizeObserver` and sets its viewBox to the measured width, so its 11px mono labels never scale; before measurement and on the server it lays out at 520px, with a minimum of 320px and no horizontal scroll. Its height depends on the rows only, so the svg's CSS height is fixed to it and the unmeasured and measured drawings occupy the same box (nothing below moves on hydration). Men are on the left in `sex.male`, women on the right in `sex.female`; the 18 groups run up the 44px centre gutter, `0–4` at the bottom and `85+` at the top. Rows are 22px apart and bars 18px tall; a hairline rule at each step of a nice scale (4 to 7 intervals per side, 0 at the edge of the centre gutter) marks the scale, with the labels under the plot. A header row above the drawing carries a swatch, the label and the share or total for each sex, in ink; where the two labels do not fit side by side (Georgian persons at 320px) it wraps onto two lines rather than overlapping. A tinted band behind the five oldest rows is labelled `65+ · {share}%`. Each row is one focusable unit with an aria-label such as `25–29: მამაკაცები 123,456, ქალები 130,000, სულ 253,456 (7.3%)`; one row is the tab stop, ↑/↓ move between rows and Home/End jump to the ends, focus is the 2px accent ring, and hover or focus shows the `ChartTooltip` (the comparison year's values too when it is on). Sex is carried by side and label, not only by colour. Nothing animates. The place block's pyramid has a table twin (`PyramidTable`); the national pyramid does not (see §29.3 above).

**Place block.** After `#births-deaths`, the Georgia page and each of the 11 region pages end with one `ასაკი და სქესი · აღწერა, 2024 წლის 14 ნოემბერი` section, anchor `#age-sex`. It describes that place only, from the 2024 census (one date, never drawn on the annual timeline). A municipality's page has no block: no municipal age rows are served. Under the heading, the text tabs `ყველა / ქალაქი / სოფელი` and the measure tabs `%` / `ადამიანი` sit on one row, and `პირამიდა / ცხრილი` below them; shares are of the displayed settlement's own total. The census pyramid is the same component as the national one, without the year pickers or comparison, and the table twin has the same columns. Under it are the source note and the section's own `ჩამოტვირთვა`, then three key figures for the whole place, which do not change with the settlement tab: the hero `65 წლის და უფროსი` (share aged 65+), and the side figures `აღწერილი მოსახლეობა` (people counted) and `ქალაქის მოსახლეობა` (share living in cities). The section ends with a link to the national page, which on Georgia's block reads `საქართველოს პირამიდა ყოველი წლისთვის, 2004 წლიდან` and on a region's `რეგიონების შედარება და საქართველოს პირამიდა ყოველი წლისთვის`. State is local to the section and kept out of the address. Only this place's census rows reach the browser.

**The census re-base.** Annual figures carry the re-base like the Population chart: the heat map carries the 2px rule and the label on the 2025 column header, the Year and Compared with pickers star 2025 and explain the star in their footer, and nothing is subtracted across 2024 and 2025. The census counts of 14 November 2024 appear only in the place block and the regional glance, labelled with their date.

**Workbooks.** Every download keeps the three-sheet model of §15 with basis status and source hyperlinks and no internal columns. The pyramid's readable sheet lists the 18 groups with men, women and total for the year (plus the comparison year's columns when it is on); shares sit in the data sheet, because a readable sheet has one number format. The heat-map workbook lists groups by years as shares, with the data sheet carrying persons, share and basis. The place block's workbook lists the 18 groups for the place and the chosen settlement, with the census date in the subtitle. The data sheet's basis column marks the re-base year in the annual workbooks. The page has no MCP tool, bulk file or Dataset markup; the structured data is the breadcrumb list only.

**Accessibility and responsive.** Every figure is `role="img"` or a named group; the place block's pyramid has a table twin, and the national pyramid's rows carry their counts in their names; the heat map scrolls inside its own frame and nothing overflows the page horizontally at 320 and 390px, the two widths the browser tests check.

## 30. External flows hub and Money from abroad

Approved on 2026-10-10; scope owner: `Project_Definition.md` §2F. The sidebar's `საგარეო ნაკადები` / External flows link follows Trade and precedes Energy and food (§6.7); its Money from abroad, Foreign investment, Current account, Foreign debt and Reserves children appear only in the active External flows context. The hub at `/explorer/external` reuses the shared hub cards: 01 Money from abroad (sparkline of transfers received, data-derived coverage), 02 Foreign investment (sparkline of the FDI total), 03 Current account (sparkline of the current-account balance), 04 Foreign debt and 05 Reserves (sparklines of their totals, with coverage such as `2006–2026 (ივნ.)` / `2006–2026 (Jun)`).

Money from abroad follows Trading partners (§28.1): trends first, then the end-year country ranking; it has no summary-figures block. Two text tabs above the workspace choose one direction, `შემოსული` / Received (initial) or `გასული` / Sent; it applies to every line, the ranking and the table. One series list holds the all-country transfer total (first, selected initially, removable), the range end year's top 10 countries in ranking order, and `სხვა ქვეყნები` / Other countries: the total less those ten, so the list adds up to the total. There are no browsing tabs and no personal-transfers estimate. Search never scopes Clear / Select all or the count.

Coverage marks reuse existing chart and table support rather than new components. A partial-month value (2019) is a hollow point on the line (an optional chart-series flag, off by default), carries the chart hover's and the table's `არასრ.` / partial mark, explained in a note under the chart, and the ranking and Excel print its month count. The January 2010 microfinance change is explained in methodology only; the chart and table carry no break marker. Missing values are gaps, dashes and blank Excel cells. The ranking states amounts in million USD whatever the chart's scale; it lists the same top 10 and ends with Other countries, unranked, with its share; there is no show-all list. As on Trading partners, ranking rows do not toggle the selection. The page footer and methodology cite the National Bank of Georgia. Approved spec: `docs/superpowers/specs/2026-10-10-money-from-abroad-design.md`.

### 30.1 Foreign investment

Approved on 2026-10-10 (`docs/superpowers/specs/2026-10-10-foreign-investment-design.md`). The page reuses the Money from abroad layout: one short line under the heading, then three centred text tabs `ქვეყნებით` / By country (initial), `დარგებით` / By sector and `რეგიონებით` / By region, then the trends workspace, then the end-year ranking. There is no summary-figures block and no note under the chart; the only line under it is the source note citing Geostat. Each tab's series list starts with the FDI total (selected initially, removable); By country follows it with the range end year's top 10 countries and `სხვა ქვეყნები` / Other countries (the total less those ten), By sector and By region with every sector or region. Switching tabs resets the selection to the total and fits the range strip to that tab's years. The ranking is the shared external ranking: million USD and share of the total; a negative value keeps its minus sign and share and draws an empty bar. Missing years (the six regions before 2016) are gaps, dashes and blank Excel cells. The page footer and methodology cite Geostat.

### 30.2 Current account

Approved on 2026-10-10 (`docs/superpowers/specs/2026-10-10-current-account-design.md`). One short line under the heading, then three centred text tabs `სალდო` / Balance (initial), `შემოსული` / Money in and `გასული` / Money out, then the workspace. Balance draws the reused `StackedColumnChart`: goods, services, primary income and secondary income net values stack above or below zero and the current-account balance is the ink overlay line; the aside is a read-only key (five rows with swatch and end-year value, no checkboxes) followed by Excel. Money in and Money out draw lines with the Money from abroad series panel: the total first, selected initially and removable, then the four parts; the two tabs share one selection. A `% მშპ-ში` / % of GDP measure pill switches every tab between nominal USD and percent of nominal GDP in USD; preliminary GDP years are named in the source line, as on Debt. The five series keep fixed colours on every tab: balance ink, goods `#3D5A98`, services `#1F6E56`, primary income `#A5822B`, secondary income `#7A4E8C`. There is no summary-figures block, no ranking and no note under the chart; the source line and methodology cite the National Bank of Georgia.

### 30.3 Foreign debt

Approved on 2026-10-15 (`docs/superpowers/specs/2026-10-15-foreign-debt-reserves-design.md`). The page reuses the Money and banks workspace (§34): under the heading only the latest-value line, kept to one line at 375px with the short label and unit (`საგარეო ვალი · 2026 (ივნ.): 28.17 მლრდ $`), then the line chart or table, year range strip, series list on the right and the three-sheet Excel action, with no tabs and no note under the chart beyond the one source line. The measure switch is the icon-only `SegmentedTabs`: a `$` glyph for amounts (initial) and Lucide `ChartPie` for % of GDP, with the names as tooltip and accessible name, and the unit caption (`მლრდ აშშ დოლარი` / `billion USD`, or `%`) beside it. The list is one flat list of six rows, nothing collapsed: the total (selected initially, first, removable), then government, banks, companies, loans between related companies and the National Bank (Duru, 2026-10-15); it has no search box. The measure, years, selection and chart/table mode live in the URL.

Values are 31 December amounts, 2006–2025, plus one 2026 point dated 30 June: the latest amount on a date, not a full year. It is the one exception to yearly-only data. It is a hollow point (`hollowPreliminary`), its month shows in the hover and in the table column header (`2026 (ივნ.)` / `2026 (Jun)`), and it has no % of GDP value, so that view ends in 2025. % of GDP divides by the served nominal GDP in USD; preliminary GDP years are named in the source line, as on Current account. Missing values are gaps and dashes, never zeros. No exchange rate or GEL conversion appears.

### 30.4 Reserves

Approved on 2026-10-15, same spec. Reserves repeats §30.3 with the total, then foreign currency, gold and SDRs in the same flat list, coverage 1995–2025 plus one point dated 30 September 2026 (`2026 (სექტ.)` / `2026 (Sep)`). Gold before 2024 is a published zero and reads `0`, not a gap. The % of GDP view starts in 1996, the first GDP year, so 1995 is a gap there, and ends in 2025.

## 31. Wages surfaces

The Wages hub at `/explorer/wages` reuses the budget hub cards: Wages overview, Industries and Regions, in that order, with coverage from served facts. Only the overview card carries a sparkline (the Georgia average) and a latest figure; the others show their own coverage. The sidebar lists the same three pages under `ხელფასები`, after Unemployment.

All three pages reuse the Unemployment workspace: the latest-value line for the Georgia average, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Every series is GEL per month, so there is no unit switch and any selection shares one axis; averages show one decimal and the median whole lari, as Geostat prints them. Under the H1 is only the latest-value line (§17): no summary or nominal note; the gross, not-inflation-adjusted basis is stated in the methodology and the Excel subtitle. Missing years are gaps and dashes, never zero.

- **Wages overview** has no tabs (owner amendment, 2026-10-10). Its series list puts Women, Men, Public and Non-public under the Georgia average as caret-expanded subcategories, reusing the Unemployment overview's nested rows, and the Median as its own row; the selection count covers the two top-level rows and nested ticks are counted separately. The Georgia average is the default, removable reference and the chart keeps its 1995 start, so later groups begin as gaps; the source note names the median's tax-record source. No pay gap is drawn.
- **Industries** has the compact native dropdown from the unemployment age page for the group (All employees, Women, Men, Public, Non-public, Business, Non-business, Median). The list is the group's all-activities total, selected by default, and each section that group publishes. The Business and Non-business groups carry a one-line definition of the non-business group. Below the workspace, the unemployment age heatmap shows every listed section by year for the group and active years, independently of the chart selection; long section names wrap in its row header.
- **Regions** reuses the eleven-region map and ranked list, coloured by the latest average wage, with the occupied-territory overlays, and nothing below them; a map or list region opens its own page (owner amendment, 2026-10-10). A region page follows the Unemployment region page: `ხელფასები — {region}` heading with the region picker and previous/next links, the region's average wage selected by default and the Georgia average as a removable second line, the region's own years, Excel and the head-office caveat.

URL state (Industries group, chart/table, years and selection, including an empty one) survives reloads and language switches. The authoritative scope is `Project_Definition.md` §2G; bounded decisions are in `docs/superpowers/specs/2026-10-09-wages-explorer-design.md`.

## 32. Living standards surfaces

The Living standards hub at `/explorer/living-standards` reuses the budget hub cards: Income, Spending, Poverty and Inequality, in that order, each with a sparkline (Georgia's total income per household, its consumption spending per household, Georgia's poverty-line rate, the Gini coefficient by total income), its latest figure and its coverage from served facts. The hub heading has one short line under it and nothing else. The sidebar lists the four pages under `ცხოვრების დონე`, after Wages. The former `/explorer/poverty` addresses redirect permanently to the new ones.

Poverty, Inequality and the Income and Spending area pages reuse the Wages workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17). Missing years are gaps and dashes, never zero, and the only line under the chart is the source note.

- **Income** and **Spending** are index pages (2026-10-12), as the Wages Regions index is. Under the heading the one latest-value line (Georgia per household), then the shared `RegionIndex` map and ranked list, without its overview block, which colour the eleven regions by the section total in the latest year all of them have, for the chosen measure (kept in the URL as `per`). The Per household / Per person icon switch sits above the map, aligned to its right edge within the map column, like the chart measure controls. Georgia is the list's first, unranked row. Georgia and each region, on the map or in the list, are plain links to their own pages, carrying only the per person choice in the hash (`#per=person`). There is no chart workspace on the index. Its one source line is the `RegionIndex` footer: Geostat's Household Incomes and Expenditures Survey, the unit and the map year, and the geoBoundaries credit.
- **Income and Spending area pages** (`/explorer/living-standards/{income|spending}/regions/[id]`, Georgia (`georgia`) and the eleven regions, twelve each) follow the Wages region pages: the heading `Income — [Guria ▾]` / `შემოსავლები — [გურია ▾]` (Spending likewise) with the `RegionPicker`, which lists Georgia first and whose all-regions entry returns to the index, and the previous/next links on the right, in the order Georgia, then the regions (wrapping around); the picker and links carry the per person choice too. One latest-value line, the section total per household with `· Guria` added; no map; then the chart workspace, with no area `h2` (the heading names the area): Chart | Table on the left of the controls row and the measure icons on the right, the chart or table, RangeStrip, series panel and Excel, and the source line without the boundaries credit. The series list holds total income (or consumption spending) with its parts nested under it, then the money that is not income (or not consumption) with its parts; Georgia's ends with Towns and Villages, the section total for each, unticked by default and in fixed colours no other line uses. Years run from the area's first (2002 for Georgia, 2011 for a region, or 2019 for the four later regions). Values show one decimal in lari a month. Changing per household / per person keeps the ticked lines and the mode and years, clamped to the new coverage. The breadcrumb is Living standards / Income / Guria, and the sidebar keeps Income (or Spending) active.
- **Poverty** has three centred text tabs, as on Money from abroad: `სიღარიბის ზღვარი` / Poverty line (initial), `ფარდობითი სიღარიბე` / Relative poverty and `საერთაშორისო ზღვრები` / International lines. Each tab has its own list. Poverty line puts towns, villages, the three age groups, women and men under Georgia as caret-expanded subcategories; Relative poverty does the same for towns and villages under each of the 60% and 40% lines. Every value is a percent of the population at one decimal, so any selection shares one axis. Switching tabs selects that tab's first series alone and keeps the years, clamped to the tab's coverage (the international lines end in 2024). On the International lines tab the source note names the World Bank.
- **Inequality** has no tabs. Its list holds the six Gini coefficients in Geostat's order, with total income first; values show two decimals on a 0–1 scale.

Lists of at most eight rows show no search box (the shared selector's threshold). URL state (tab, per household / per person, chart/table, years and selection, including an empty one) survives reloads and language switches. The authoritative scope is `Project_Definition.md` §2H; bounded decisions are in `docs/superpowers/specs/2026-10-11-living-standards-design.md` and `docs/superpowers/specs/2026-10-10-poverty-inequality-design.md`.

## 33. Energy and food surfaces

The Energy and food hub at `/explorer/energy-food` reuses the budget hub cards: Energy supply, Electricity, Energy use, Food self-sufficiency and Farming, in that order, each with a sparkline of the page's main series (total supply, total production, final consumption, wheat, farm output), its latest figure and the coverage of that series' group from served facts. The sidebar lists the five pages under `ენერგეტიკა და სურსათი`, after External flows.

All five pages reuse the Poverty workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17), and the only line under the chart is the source note. Missing years are gaps and dashes, never zero.

- **No page has tabs** (owner decision, 2026-10-11). Each page has one chart and one series list; breakdowns nest under the total they break down (fuels under supply and imports, plants under production, users under final consumption, meats under meat) as caret-expanded subcategories. Only the page's main total is selected by default (domestic supply, total production, final consumption, wheat); it stays first, selectable and removable.
- **Units.** Energy supply and Energy use show thousand tonnes of oil equivalent and Electricity shows GWh, at one decimal; Food self-sufficiency shows whole-number percents, so its table passes the shared table's optional `percentDecimals` as 0. On the energy pages axis ticks and table cells carry numbers only and the chart panel names the unit; food ticks and cells keep their `%` sign. The latest-value line adds ` GWh` (Electricity) or `%` (food) to its value, and on Energy supply and Electricity it ends with the latest imports (and exports) as a short note.
- **Colour.** The reference series is drawn in ink and the others take the editorial palette by their position in the list, so no colour repeats on a page. Energy supply has 16 non-reference series, two more than the palette holds, so the hub appends two hexes already used for economic sectors, `#0D89C2` and `#474A02`.
- **Farming** (owner approval, 2026-10-20). The 41 rows sit flat under five small headings that name their unit (Farm output, million ₾; Harvests, thousand tonnes; Livestock, thousand head; Meat, milk and eggs; Farm-gate prices, ₾ per kg), all visible from the start, with no carets, tabs or icon switches. The chart shows one group at a time with the Business one-unit rule (`lib/explorer/unitList.ts`): a group is a heading and its unit, so harvests and meat (both thousand tonnes) and milk and eggs stay separate charts, while the twelve prices share one ₾ axis whose panel reads "₾ per kg (milk per litre, eggs per piece)". Ticking a row of another group replaces the selection, and the years narrow to that group's coverage. Colours restart within each group. The list caption gives the year only; each row shows its latest figure in its own precision (one decimal, prices two). The latest-value line reads farm output with ` million ₾` / ` მლნ ₾`.
- **State.** Chart or table, the years and the selection (including an empty one) live in the URL hash through the shared hook `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches.

Only yearly data is shown. Household energy prices are excluded because Geostat publishes them half-yearly. The authoritative scope is `Project_Definition.md` §2I; bounded decisions are in `docs/superpowers/specs/2026-10-11-energy-food-design.md` and, for Farming, `docs/superpowers/specs/2026-10-20-farming-design.md`.

## 34. Money and banks surfaces

The Money and banks hub at `/explorer/money` reuses the budget hub cards: Money supply, Loans and deposits, Interest rates and Bank health, in that order, each with a sparkline of its first series (broad money M3, all loans, the National Bank rate, bad loans), its latest figure and its coverage from served facts. The sidebar lists the four pages under `ფული და ბანკები`, after Inflation.

All four pages reuse the Poverty workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17). Missing years are gaps and dashes, never zero, and the only line under the chart is the source note.

No money page has a tab row. Money supply and Loans and deposits switch measure with the icon-only measure switch of §7.2a (`SegmentedTabs` with icon options and `ControlTooltip`), at the right of the chart controls row after the unit caption: `₾` for the amounts, and Lucide `ChartPie` (% of GDP) or `CircleDollarSign` (share in foreign currency). Each icon keeps its localized name (`მოცულობა` / Amount, `მშპ-სთან შეფარდებით` / Compared with GDP, `წილი უცხოურ ვალუტაში` / Share in foreign currency) as accessible name and tooltip; the group is `მაჩვენებელი` / Measure. The unit caption stays beside the switch (`მლრდ ₾` or `%`), since the icons carry no text. On a share measure the latest-value line names the measure's first series and value (for example `ფართო ფული (M3), მშპ-ის % · 2025: 55.1%`), so touch readers see which measure is on.

- **Money supply** shows M3, M2, M1 and M0 in billion GEL; the % of GDP icon shows the same four series as a percentage of Fiscal.ge's national GDP at current prices (the debt page's GDP and share-of-GDP calculation), with the same ids, so the selection stays as it is. These values are calculated by Fiscal.ge; on % of GDP the source line adds the GDP source and names preliminary GDP years, as on the debt page. NBG's own M3 and M2 ratios stay in the dataset but are not shown.
- **Loans and deposits** opens on the amounts (all loans with lari and foreign currency nested under it, all deposits with lari and foreign currency nested under it, then deposits of people and of companies and organisations; all loans and all deposits are selected); the foreign-currency icon switches to the share in foreign currency of loans and of deposits. Any selected loan carries to the loans share and any selected deposit to the deposits share; back on the amounts, each share carries to its total.
- **Interest rates** has no tabs. Its list holds the National Bank rate, the average rate on loans and the average rate on deposits, with lari and foreign currency nested under each average.
- **Bank health** has no tabs. Its list holds bad loans, return on assets, return on equity, the capital ratio and the Tier 1 ratio, with bad loans selected; capital is a gap before 2014.

Each measure mixes one unit, so any selection shares one axis. Amounts show in billion GEL with the site's GEL formatting (Excel keeps million GEL); percents show one decimal, and the National Bank rate two. Switching measure carries the selection as above (or selects the measure's default when nothing carries) and keeps the years, clamped to the measure's coverage (% of GDP starts in 1996, with the GDP series). The deposit totals, the two foreign-currency shares and the % of GDP values are calculated by Fiscal.ge; Excel marks them, and on % of GDP its Sources sheet adds Geostat's GDP files. The two bank-health series breaks (2022 and 2023) are explained on the methodology page, never drawn as a gap, and no change is computed across them. The lists hold at most eight rows, so they show no search box. URL state (the measure under the `tab` key, chart/table, years and selection, including an empty one) survives reloads and language switches. The authoritative scope is `Project_Definition.md` §2J; bounded decisions are in `docs/superpowers/specs/2026-10-11-money-banks-design.md`.

## 35. Business surfaces

The Business hub at `/explorer/business` reuses the budget hub cards: Sales, Jobs, Investment and profit, Firms opened and closed and Regions, in that order. The first four carry an `ink` sparkline of firms' sales, people employed, investment and new firms, the latest figure and their coverage from served facts; Regions shows only its map years. The sidebar lists the five pages under `ბიზნესი`, after Economy and before Inflation, within the existing hub group and with no new spacing. A twelfth hub makes the phone footer one row taller (the mobile-fit bound is 584px).

The four topic pages reuse the Money and banks workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17), and the only line under the chart is the source note. Missing years are gaps and dashes, never zero. No business page has a tab row.

- **Sales** and **Jobs** list All firms (the ink reference, selected) and then Geostat's three firm sizes under a `საწარმოს ზომა` / Firm size heading and its 14 activity groups under a `დარგი` / Industry heading. The headings are the optional per-row `heading` of the shared flat series panel, each naming the group of rows under it for screen readers; a list without it renders unchanged.
- **Investment and profit** lists Investment in fixed assets (selected), Profit and Loss, each with the three sizes and 14 industries nested under it as caret-expanded subcategories, and no net figure. Profit and Loss are both positive amounts, as Geostat prints them.
- **Firms opened and closed** has no measure switch: one list holds the counts under a `რაოდენობა` / Number heading (Active, New and Closed firms with the 18 NACE sections nested under each, and Geostat's unknown activity last) and then the rates under a `აქტიურ საწარმოებთან შეფარდებით · %` / `Compared with active firms · %` heading (New and Closed firms with the sections and no unknown activity, because its published rates are a reclassification bucket's and can pass 100%). New and Closed firms are both selected by default (the approved exception to the single default). Counts and rates follow the one-unit rule below; a section death rate that Geostat did not publish for 2016 and 2019 is a gap.
- **Regions** is an index, as the Living standards Income index is. Under the heading is the latest-value line, then the shared `RegionIndex` map and ranked list of the 11 regions coloured by the latest year's value, with the occupied-territory overlays and Georgia as the list's first, unranked row. An icon switch above the map, aligned to its right edge, chooses `₾` sales (initial) or Lucide `Users` jobs, kept in the index's hash (`#m=jobs`); on jobs, the map and list links open each area page with its jobs selected (`#sel=business.employed.<area>`). There is no chart workspace; the one source line is the `RegionIndex` footer, with the head-office caveat and the geoBoundaries credit. Values show in billion GEL and thousand people to one decimal.
- **Area pages** (`/explorer/business/regions/[id]`, Georgia and the 11 regions, 12 per locale) follow the Living standards area pages: `ბიზნესი — [გურია ▾]` / `Business — [Guria ▾]` with the `RegionPicker` (Georgia first, an all-regions entry returning to the index) and previous/next links, one latest-value line with `· Guria` added, no map, no area `h2`, and the chart workspace with Chart | Table on the left of the controls row and the unit caption on the right, with no measure switch. The one list holds three headings that name their units: `ბრუნვა, ინვესტიციები, მოგება და ზარალი · მლნ ₾` (Sales, selected initially, Investment, Profit, Loss), `დასაქმებულები · ათასი ადამიანი` (Jobs) and `საწარმოების რაოდენობა` (Active, New and Closed firms). The picker and previous/next links carry the selection, moved to the other area, and the all-regions entry opens the jobs map when Jobs is selected. Regions run 2006–2025 for money and jobs; Georgia's sales and jobs run 1999–2025 and its investment, profit and loss 2006–2025; firms run 2014–2024.

**One unit at a time.** On Firms and the area pages, where one list mixes units, a chart shows one unit: ticking a row of another unit replaces the selection with that row, ticking within the unit adds as usual, and selecting all from an empty list selects the first heading's top-level rows. The chart, unit caption, table, tooltip and Excel follow the selection's unit, and the year range spans that unit's coverage (the whole list's when nothing is selected), keeping the chosen years clamped to it when the unit changes. Each list row shows its own unit's end-year value, so these lists' captions give the year only.

**Series names and colours.** A nested row in the chart legend, tooltip and table is named in full, `Parent — Child` (for example `Investment — Construction`), while the list row keeps the short name. The reference series is ink. An industry wears its economic-sector colour (§4.2) under every parent, with Geostat's combined Industry group wearing manufacturing's and unknown activity the shared "other" colour. So that the same industry under two parents still reads apart in the chart, each parent's nested series take one stroke: the first parent's solid, the second's dashed and the third's dotted (Investment, Profit, Loss; Active, New, Closed firms; among the rates, New and Closed firms), patterned lines without an end dot as the chart's dashed lines have. The swatches in the list and legend stay solid. The three firm sizes and each measure's total (investment, profit, loss; active, new and closed firms and their rates) have fixed colours that no industry wears, each at least CIEDE2000 11 from every sector in the list it appears in; a rate wears its count's colour, since the two never share a chart, and on an area page Jobs, alone in its unit, is ink.

**State and units.** Chart/table, years and selection, including an empty one (and the Regions index's map measure under `m`), live in the URL hash through `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches. The four topic lists exceed the shared selector's threshold and show a search box; area pages list eight rows and show none. On every business page, topic and area pages alike (Georgia included), the chart, table and series list show amounts in million GEL to one decimal, the unit Geostat prints and Excel exports, so even a small industry's or region's amount reads as a number. The latest-value lines and hub cards read amounts with the site's amount formatting (billion GEL to one decimal from 1 billion GEL, million GEL below), and the Regions index map and list keep billion GEL. People show in thousands to one decimal, firm counts whole numbers, rates one decimal.

Only yearly data is shown; Geostat's 2026 quarterly rows are not served. The methodology page states the 2006 coverage change, that the 11 survey regions do not add up to Georgia, and that betting turnover is counted in Arts, entertainment and recreation. The authoritative scope is `Project_Definition.md` §2K; bounded decisions are in `docs/superpowers/specs/2026-10-14-business-design.md`.

## 36. Health surfaces

The Health and social protection hub at `/explorer/health` reuses the budget hub cards: Doctors and hospitals, Illnesses and Causes of death, in that order, each with a sparkline of Georgia's headline series (doctors, respiratory diseases, all deaths), its latest figure and its coverage from served facts. The sidebar lists the three pages under `ჯანდაცვა და სოციალური დაცვა`, after Living standards. The hub shows no `მალე` card for pensions or social help.

Doctors and hospitals and Illnesses reuse the Money and banks workspace; the Causes of death area pages reuse the Living standards area pages. All of them use the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17), worded in the site's measure pattern, and the only line under the chart is the source note. Missing years are gaps and dashes, never zero, except in the causes-of-death table, where a published `0` is a count. No page has a tab row.

- **Doctors and hospitals** switches between two views with the icon-only measure switch of §7.2a (`SegmentedTabs` with icon options and `ControlTooltip`), at the right of the chart controls row after the unit caption: Lucide `Users` (Staff, initial) and `Hospital` (Hospitals and clinics). Both lists are flat, with small headings (the optional `heading` of `FlatSeriesPanel`) and no carets. Staff lists `ექიმები` / Doctors (the total, then Geostat's 14 specialities) and `საექთნო პერსონალი` / Nursing staff (the total, medical nurses and midwives); the four nurse groups Geostat stopped publishing after 2011 are not listed. Hospitals and clinics lists `დაწესებულებები` / Facilities (hospitals and out-patient clinics, counts), `საწოლები` / Beds (hospital beds, a count of beds) and `ვიზიტები · მილიონი` / Visits · million (out-patient visits, one decimal). Its rows are in three units, so the panel caption gives the year only and a chart shows one unit at a time: ticking a row of another unit replaces the selection (as on Business). Each view selects its first series when chosen and keeps the years, clamped to the view's coverage. The latest-value line names the view's first series.
- **Illnesses** has one list in two groups, each introduced by a small caption above its first row (the optional `heading` of `FlatSeriesPanel`, which prints a group's caption once and leaves a list without headings unchanged): `დაავადებათა ჯგუფები` / Disease groups, 19 Geostat disease groups in thousands of new cases, then `ცალკეული დაავადებები` / Single diseases, six diseases Geostat counts in persons and the page shows in thousands (diabetes and anaemia from 2016). The combined nervous system and sense organs group is its own line for 2002–2005, ending where the nervous system, eye and ear groups begin. Geostat publishes no total of all new cases and the page adds none, so the default selection is the five disease groups with the largest value in the latest year; they stay removable. The latest-value line names the new respiratory cases, whatever is selected.
- **Causes of death** is an index: under the heading the one latest-value line (Georgia's death rate per 1,000 people), then the shared `RegionIndex` map and ranked list, which colour the 11 regions by Geostat's death rate in the latest year they all have, with the occupied-territory overlays. Georgia is the list's first, unranked row; Georgia and each region, on the map or in the list, link to their own page. There is no chart workspace and no measure switch, and its one source line is the `RegionIndex` footer.
- **Causes-of-death area pages** (`/explorer/health/causes-of-death/regions/[id]`, Georgia and the 11 regions, twelve in all) follow the Living standards area pages: the heading `სიკვდილის მიზეზები — [გურია ▾]` / `Causes of death — [Guria ▾]` with the `RegionPicker` and the previous/next links, one latest-value line (all deaths, with `· Guria` added), no map, then the chart workspace. The list holds All deaths (selected), then the 20 causes by ICD-10 chapter in plain words, with COVID-19 from 2020; the Roman numerals appear only on the methodology page. Values are persons.

**Counting changes.** A recorded counting change that touches a selected series appears as a gap in the line and a dashed rule labelled `ახალი აღრიცხვა` / New counting, and as a marked year in the table, as on the Population pages. On a phone, a label that repeats the label of a break drawn just before it is left out and the rule stays. The 2006 split of the nervous system, eye and ear group is told by its series and has no rule.

**Units and colour.** Axis ticks and table cells carry numbers only and the chart panel names the unit; the table shows the most decimals among the selected series, while the list and tooltip show each series to its own. Values show as Geostat publishes them. The reference series (doctors, all deaths) is drawn in ink and the others take the editorial palette by their position in the list.

**State.** The measure (under the `tab` key, Doctors and hospitals only), chart/table, years and selection (including an empty one) live in the URL hash through the shared hook `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches. The lists of at most eight rows show no search box.

Only yearly data is shown and the pages state no causes. Excel keeps the stored units and per-cell number formats. The authoritative scope is `Project_Definition.md` §2L; bounded decisions are in `docs/superpowers/specs/2026-10-15-health-design.md`.

## 37. Housing surfaces

The Housing and construction hub at `/explorer/housing` reuses the budget hub cards: Building permits, Completed buildings, Home prices and Regions, in that order. The first three carry an `ink` sparkline of all permits, all completed buildings and the home price index, the latest figure and their coverage from served facts; Regions shows only its map years. The sidebar lists the four pages under `საცხოვრებელი და მშენებლობა`, directly after Business and before Inflation, within the existing hub group and with no new spacing.

The three topic pages and the area pages reuse the Business workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17), and the only line under the chart is the source note. Missing years are gaps and dashes, never zero. No housing page has a tab row or a measure switch.

- **Building permits** and **Completed buildings** list the same rows under two headings that name their unit, `რაოდენობა` / Number (All buildings, the ink reference, selected, then Geostat's building types) and `ფართობი · ათასი მ²` / Floor area · thousand m² (the same rows). Types follow Geostat's column order; a type Geostat left out of a year's sheet is a gap, and children's holiday camps exist on Permits only.
- **Home prices** lists three headings: `ფასების ინდექსი · 2020 = 100` / Price index (All homes, selected, ink; Flats; Detached houses), `თბილისი, ახალი ბინები · ლარი 1 მ²-ზე` / Tbilisi new flats · GEL per m² and `თბილისი, ახალი კერძო სახლები · ლარი 1 მ²-ზე` / Tbilisi new houses · GEL per m² (ten districts each). Each year is Geostat's fourth-quarter value, and the district prices are asking prices (the methodology page says both). The Tbilisi house-price lines are dashed (patterned, without an end dot, as the chart's other dashed lines), so a district's house row reads apart from its flat row, which wears the same colour; the swatches stay solid.
- **Regions** is an index, as the Business Regions index is. Under the heading is the latest-value line, then the shared `RegionIndex` map and ranked list of the 11 regions coloured by the latest year's permitted floor area, with the occupied-territory overlays and Georgia as the list's first, unranked row. There is no map switch and no chart workspace. The list shows bare numbers (thousand m² to one decimal) with the unit named once in the legend; the one source line is the `RegionIndex` footer with the geoBoundaries credit.
- **Area pages** (`/explorer/housing/regions/[id]`, Georgia and the 11 regions, 12 per locale) follow the Business area pages: `საცხოვრებელი და მშენებლობა — [გურია ▾]` / `Housing and construction — [Guria ▾]` with the `RegionPicker` (Georgia first, an all-regions entry returning to the index) and previous/next links, one latest-value line with `· Guria` added, no map, no area `h2`, and the chart workspace with Chart | Table on the left of the controls row and the unit caption on the right. The list holds eight rows under four headings, in order `მშენებლობის ნებართვები · რაოდენობა` / Building permits · number, `ექსპლუატაციაში მიღებული ობიექტები · რაოდენობა` / Completed buildings · number, `მშენებლობის ნებართვები · ფართობი, ათასი მ²` / Building permits · floor area, thousand m² and `ექსპლუატაციაში მიღებული ობიექტები · ფართობი, ათასი მ²` / Completed buildings · floor area, thousand m². Each heading lists `ყველა შენობა` / All buildings and `საცხოვრებელი შენობები` / Residential buildings, with no prefix in the row names; permits by number, all buildings, is selected and ink. In the chart, table and Excel a row's name carries its heading's text before the unit (`ყველა შენობა — მშენებლობის ნებართვები`), as a Tbilisi district's does on Home prices. It shows no search box. The picker and previous/next links carry the selection, moved to the other area (a homes row stays a homes row).

**One unit at a time.** Where one list mixes units, a chart shows one unit: ticking a row of another unit replaces the selection with that row, ticking within the unit adds as usual, and selecting all from an empty list selects the rows of the first heading's unit. The chart, unit caption, table, tooltip and Excel follow the selection's unit, and the year range spans that unit's coverage (the whole list's when nothing is selected), keeping the chosen years clamped to it when the unit changes. Each list row shows its own unit's end-year value, so the caption gives the year only. The rule is the shared `lib/explorer/unitList.ts` (`keepOneUnit` and the hash and coverage helpers), moved there from Business, whose behaviour is unchanged.

**Series colours.** The reference series is ink. A building type wears one colour under both headings and on both pages, keyed by its place in Geostat's order; four types (culture, pharmacies, holiday camps and other) have fixed colours so that none of the 17 repeats. A district wears one colour under flats and houses. On the area pages a row's colour follows its place among the four, so the number and the floor area of the same objects share it.

**Units.** Counts are whole numbers, floor area is stored in m² and shown in thousand m² to one decimal in charts, tables and lists (million m² to one decimal, thousand m² below one million, in the latest-value lines), the index has one decimal and prices are whole GEL per m². Axis ticks and table cells carry numbers only and the chart panel names the unit.

**State.** Chart/table, years and selection, including an empty one, live in the URL hash through `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches. The three topic lists exceed the shared selector's threshold and show a search box; area pages list eight rows and show none.

Only yearly data is shown; Geostat's 2026 columns and quarterly workbooks are not served, and the pages state no causes. The methodology page says that permits and completions are not comparable year for year, that the index is based on the 2020 average, and that the district figures are asking prices of new homes. The authoritative scope is `Project_Definition.md` §2M; bounded decisions are in `docs/superpowers/specs/2026-10-16-housing-design.md`.

## 38. Crime and justice surfaces

The Crime and justice hub at `/explorer/crime` reuses the budget hub cards: Recorded crimes, Convictions, Prisons, Victims and Road accidents, in that order, each with a sparkline of its page's default series (the page total; accidents on Road accidents), its latest figure and its coverage from served facts. The sidebar lists the five pages under `დანაშაული და მართლმსაჯულება`, after Health and social protection.

All five pages reuse the Health and Business workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under the H1 is only the latest-value line (§17), worded in the site's measure pattern with the page total's published count whichever measure is shown (`Recorded crimes · 2025: 54,134`, in Georgian with `რეგისტრირებული დანაშაული` as the measure); Road accidents adds the people killed as the line's note (`469 killed`). The only line under the chart is the source note, which names the agency Geostat credits for that table. Missing years are gaps and dashes, never zero; a published `0` is a count of zero. No page has a tab row and none has a map.

- **Measure switch.** Every page has the icon-only measure switch of §7.2a (`SegmentedTabs` with icon options and `ControlTooltip`), at the right of the chart controls row after the unit caption: Lucide `Hash` (Number, initial) and `Users` (Per 100,000 people). Switching keeps the selection, years and chart/table mode. The per-100,000 view divides each count by Georgia's population on 1 January of the same year, times 100,000, and shows one decimal; it is calculated on the page and is not in the data files. 2001–2003 have no rate and are gaps in the line and dashes in the table, and the unit caption reads `100 000 მოსახლეზე` / `per 100,000 people`.
- **Lists.** Each page is one flat list under small headings (the optional `heading` of `FlatSeriesPanel`) with no carets; the page total comes first, without a heading, and is the only series selected on arrival. Recorded crimes: all recorded crimes, then Type of crime (Geostat's 11 groups). Convictions: people convicted, then Type of crime (11), Age (five bands), Sex and Sentence (seven sentences). Prisons: all prisoners, then Sex, Age (adults, juveniles) and Status (sentenced, awaiting trial; from 2010). Victims: all victims, then Sex (with not stated), Age (four bands and not stated) and Citizenship (five groups). Road accidents: Accidents (road accidents, accidents caused by drunk driving) and People (killed, injured), with road accidents selected. The lists of Recorded crimes, Convictions and Victims, which exceed the shared selector's threshold, show a search box; Prisons and Road accidents show none. Series names carry no prefixes.
- **One unit per chart.** Road accidents counts accidents and people, so a chart shows one unit at a time: ticking a row of the other unit replaces the selection, by the shared `keepOneUnit` rule of `lib/explorer/unitList.ts` that Business and Housing also use. Its panel caption gives the year only in the Number view, where the rows have two units. The rule reads the stored units, so it applies in the per-100,000 view too.

**Counting changes.** `registration_2018` is drawn on every recorded-crime series, and `drunk_driving_coverage_2025` on accidents caused by drunk driving only. In the per-100,000 view the census recalculation of the 2025 population (`census_recalculation_2025`) is drawn whenever any series is selected. Each shows as a gap in the line and a dashed rule labelled `ახალი აღრიცხვა` / new counting, and as a marked year in the table, as on Health. A change of reporting agency (prisons, victims) is not a break and is told on the methodology page.

**Units and colour.** Axis ticks and table cells carry numbers only and the chart panel names the unit (crimes, persons, accidents or per 100,000 people). Counts show as whole numbers, rates with one decimal. The page total (the reference series) is drawn in ink and the others take the editorial palette by their position in the list.

**State.** The measure (under the `tab` key), chart/table, years and selection (including an empty one) live in the URL hash through the shared hook `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches.

**Excel.** One workbook per page and measure, in the reader's language, with the Summary, Data and Sources sheets: the active measure's selected series and years, explicit units, blank cells for missing values and validated links to the archived Geostat workbooks. A per-100,000 workbook adds the population table to its sources and says in its Summary that the rates are calculated by fiscal.ge.

Only yearly data is shown and the pages state no causes. The authoritative scope is `Project_Definition.md` §2N; bounded decisions are in `docs/superpowers/specs/2026-10-16-crime-design.md`.

## 39. Education surfaces

The Education hub at `/explorer/education` (`განათლება`) reuses the budget hub cards: Schools, Kindergartens, Universities and Vocational colleges, in that order, each with a sparkline of a Georgia series (pupils, kindergarten children, university students, vocational admissions), its latest figure and its coverage from served facts, for example `2025/26 · 644.2 thousand · 2000/01–2025/26`. The sidebar lists the four pages under `განათლება`, after Health and social protection. No page has a tab row or a measure switch, and no icon switch is added anywhere in the hub.

Schools and Kindergartens reuse the Population page set (§29): the same index, the same place pages and the same 11 region ids and 63 municipality slugs. Universities and Vocational colleges reuse the Business topic workspace (§35). All of them use the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under each H1 is only the latest-value line (§17), and the only line under the chart is the source note (`Source: Geostat, higher education · persons · 2011/12–2025/26 · updated date · Methodology and sources`). Every row of a series list is visible from the start under small headings (the optional `heading` of `FlatSeriesPanel`), with no caret-nested rows. Missing years are gaps, dashes and blank Excel cells, never zero; a text `…` or `-` (or a blank) in Geostat's table produces no point at all. A zero that Geostat's vocational sheet formats as a dash inside a field's years is stored and shown as 0 (see methodology "Gaps").

- **Schools index** (`/explorer/education/schools`): under the heading the one latest-value line (`2025/26: 644.2 thousand pupils in 2,292 schools`, Georgia's national figures), then the shared `MunicipalitiesIndex`, shaded by pupils in the latest school year, with the occupied-territory overlays. Georgia is the list's first, unranked row, and Georgia, each region and each municipality link to their own page; Tbilisi opens `region/tbilisi`. There is no chart workspace, no key-figure block, and the one source line names the source, the map's school year and the boundaries credit.
- **Kindergartens index** (`/explorer/education/kindergartens`) is the same page shaded by children (`2025/26: 130,337 children, 1,717 public kindergartens`). The kindergartens are public ones only, which the source line says.
- **Place pages** (`/explorer/education/{schools|kindergartens}/georgia`, `/region/[id]`, `/[slug]`; 75 per set and language) follow the Population place pages: the heading `სკოლები — [გურია ▾]` / `Schools — [Guria ▾]` with the `EntityPicker` (through `EntityHeading`) and the previous and next links, one latest-value line with the place after a middle dot (`2025/26: 13,743 pupils · Guria`), the chart workspace and, on a region's page, its municipalities ranked by the index's measure (Tbilisi lists none). The list has three headings: Schools holds Pupils, Teachers (Teachers, Women, Men) and Schools; Georgia's Schools page also lists the public and private split Geostat publishes only nationally (pupils, teachers and schools). Kindergartens holds Children, Staff and Kindergartens, one row each. The default is the first heading's total (Pupils, Children), drawn in ink; each heading's total is the only total on its chart. Pupils and teachers read in persons, schools and kindergartens in institutions, and Georgia's pupils in thousands to one decimal on every Georgia surface (latest line, list, chart, table, tooltip, Excel), the unit named in the chart panel and over the list (`thousand pupils`).
- **One heading at a time.** A place page charts the rows of one heading: ticking a row under another heading replaces the selection with that row, and a saved link that mixes headings keeps only its first row's heading. The chart, table, range strip and Excel follow that heading, and the years refit to its coverage (teachers start in 2016/17 in a region). Outside the list a row is named `Heading — Row` (`Teachers — Women`), and a row that bears its heading's name stays alone (`Teachers`).
- **Moving between places.** The place picker and the previous and next links carry the Chart | Table mode, the years and the selection to the place they open, so a view is compared place to place. A row the target does not list becomes its counterpart there (Georgia's pupils and a place's pupils swap; public and private become the measure's total), and the target refits the years to its own coverage. The language switch keeps the whole hash.
- **Universities** (`/explorer/education/universities`): the line `2025/26: 195,426 university students`. One list of persons under three headings, Students, Newly admitted and Graduates, each with the same 16 rows: All, Bachelor, Master, Professional programmes, Public universities, Private universities, Women, Men and the eight fields of study. The Students total is selected. All 48 rows are visible and the shared search box filters them without changing the select-all action or the `selected / all` count. Any mix of rows can be charted together, the range strip shows the years any selected row has (all listed years when nothing is selected), and the list reads at the range's last year: each row shows its latest value up to that year, and a heading whose rows end earlier names their year, as Business's area list does (`Graduates · 2024/25`, since graduates end a school year before students). Graduates sit under the school year they end (`2024/25` holds the graduates of calendar year 2025), so a Students-and-Graduates mix spans 2010/11–2025/26 with gaps, not zeros.
- **Vocational colleges** (`/explorer/education/vocational`): the line `2025: 19,690 admitted to vocational colleges`. Two headings, Admitted and Graduates, each with All, Women, Men and Geostat's nine current fields of study, 24 rows in all with search on. Years are plain calendar years (`2025`), never school years. A field is a gap before the year Geostat first lists it and after its last, because the zeros Geostat prints outside a field's span are not served; the nine old fields are kept in the data file with `shown=false` and never reach a page, the client or Excel. Admitted All is selected.

**School years.** Schools, Kindergartens and Universities count by school year; it is stored as its starting year and labelled `2025/26` on the chart axis, tooltip, table, range strip, latest-value line, hub card, source line and Excel (file names use `2025-26`). Vocational colleges are labelled with the calendar year. The labelling goes through the `formatPeriod` option of the chart and range strip and the `yearLabel` option of the table, so no chart component is forked.

**Series changes.** Two recorded definition changes (the kindergarten staff definition from 2020/21 and the master's level from 2015/16) are explained on the methodology page and in the data file's series-break record. The charts draw no gap or rule for them and no change is computed across them.

**Places without a page.** Abkhazia AR, Akhalgori, Eredvi, Tighva and Kurta are inside Geostat's region and Georgia rows, so they stay in the data and are never drawn, listed or linked; municipal codes `05`, `42`, `43`, `46` and `64` stay excluded. An unknown place id or slug is a 404.

**Units and colour.** Axis ticks and table cells carry numbers only and the chart panel names the unit. Every series has a fixed colour: the default total is ink and the others take the editorial palette by their position in the list, as on Business. Values show as Geostat publishes them; Fiscal.ge computes no share, ratio or growth.

**State.** Chart | Table, years and selection (including an empty one) live in the URL hash through the shared hook `components/explorer-shell/use-hash-state.ts`, and survive reloads and language switches. Every index, topic and place page carries one Dataset JSON-LD node (a place page as a slice of its index); a school year runs into the next calendar year, so `2005/06–2025/26` covers 2005–2026.

Only annual data is shown, Excel keeps the stored units and one number format per file with blank missing cells, and the pages state no causes. The authoritative scope is `Project_Definition.md` §2O; bounded decisions are in `docs/superpowers/specs/2026-10-16-education-design.md`.

## 40. Science and culture surfaces

The Science and culture hub at `/explorer/science-culture` (`მეცნიერება და კულტურა`) reuses the budget hub cards: Research, Patents, Museums and Theatres, in that order, each with a sparkline of its default Georgia series (researchers, invention applications from Georgian applicants, museum visitors, theatre audience), its latest figure and its coverage from served facts, for example `2025 · 1,998.9 · 2005–2025`. The sidebar lists the four pages under `მეცნიერება და კულტურა`, after Education and before Crime and justice. No page has a tab row, a measure switch or an icon switch.

All four pages reuse the Housing and Business workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under each H1 is only the latest-value line (§17), which fits one line at 375px (`2024: 14,046 researchers`, `2025: 79 invention applications from Georgia`, `2025: 620.3 thousand theatre-goers`), and the only line under the chart is the source note. Every measure sits under a small heading of the list (the optional `heading` of `FlatSeriesPanel`) with every row visible from the start and no caret-nested rows; series names carry no prefix, and outside the list (legend, tooltip, table, Excel) a row is named `Heading — Row`. Missing years are gaps, dashes and blank Excel cells, never zero; Geostat's `…` and blank cells produce no point. A `-` is a published none (`0`) in the researcher, R&D staff, patent and staff tables, and a gap in the theatre events rows before 2021.

- **Research** (`/research`, Georgia, 2019–2024): headings Researchers (All researchers, Women, Men), By degree, By field, By age, All R&D staff, Institutions and Spending · million GEL. All researchers is selected and ink. All people headings count persons and chart together; the list exceeds the shared selector's threshold and shows a search box.
- **Patents** (`/patents`, Georgia, 2016–2025): four headings, Invention applications, Invention patents granted, Utility model applications and Utility model patents granted, each with Georgian applicants, Foreign applicants and International route. Invention applications from Georgian applicants is selected and ink. All twelve rows count applications or patents and chart together.
- **Museums** (`/museums`) is an index, as Housing's Regions is: under the heading the latest-value line (`2025: 2.0 million museum visitors`, million to one decimal), then the shared `RegionIndex` map and ranked list of the 11 regions coloured by the latest year's visitors, with the occupied-territory overlays and Georgia as the list's first, unranked row. Georgia and every region link to their own page. There is no map switch and no chart workspace, and the one source line is the `RegionIndex` footer with the geoBoundaries credit.
- **Museum area pages** (`/museums/[id]`, Georgia and the 11 regions, 12 per locale, 2005–2025) follow the Housing area pages: `მუზეუმები — [გურია ▾]` / `Museums — [Guria ▾]` with the `RegionPicker` (Georgia first, an all-regions entry returning to the index) and previous and next links. The latest-value line names the figure only (`2025: 164.9 thousand visitors`); the region is in the heading. The list holds four headings with one row each, Visitors · thousand, Group tours · thousand (Geostat's excursions), Exhibitions and Museums; Visitors is selected and ink on every page. Georgia's page adds the six museum types under Museums and a fifth heading Staff (2020–2025: All staff, Women, Men, Permanent, On contract and three age groups), which Geostat publishes nationally only. The picker and the links carry the selection to the other area; a row that exists only on Georgia's page falls back to Visitors.
- **Theatres** (`/theatres`, Georgia, 2006–2025): headings Audience · thousand, Shows (in Georgia, away from the home stage, abroad), Events (the same three, 2021–2025), Theatres (all theatres and four types), Seats · thousand and Staff (2020–2025, the eight museum staff rows). Audience is selected and ink. Shows, events and theatres count units and chart together.

**One unit at a time.** Where a list mixes units (Research, Museums, Theatres), the chart shows one: ticking a row of another unit replaces the selection with that row (`changeUnitListSelection`, the Housing rule of §37), and the chart, unit caption, table, tooltip, years and Excel follow the selection's unit. Rows under headings that share a unit chart together.

**New counting.** Geostat's theatre audience for 2006–2020 counts performances only and from 2021 all events held in the country (`theatre_audience_2021`). The audience series shows a gap at 2021 and a dashed rule labelled `ახალი აღრიცხვა` / new counting, and the table marks the year, as on Crime (§38); no change is computed across it. No other series carries a mark; the 2019/2020 change of research collector is told on the methodology page.

**Units and colour.** Axis ticks and table cells carry numbers only and the chart panel names the unit. Counts are whole numbers; visitors, group tours, audience and seats are in thousands to one decimal and research spending in million ₾ to one decimal. A page's default series is ink and every other series takes the editorial palette by its place in the list.

**State.** Chart | Table, years and selection (including an empty one) live in the URL hash through `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches. Every page carries Dataset JSON-LD.

Only yearly data is shown, Excel keeps the stored units with blank missing cells, and the pages state no causes. The authoritative scope is `Project_Definition.md` §2P; bounded decisions are in `docs/superpowers/specs/2026-10-20-science-culture-design.md`.

## 41. Environment and climate surfaces

The Environment and climate hub at `/explorer/environment` (`გარემო და კლიმატი`) reuses the budget hub cards: Greenhouse gases, Air pollution, City air quality, Temperature and rain, Water, Waste and Forests, in that order, each with a sparkline of its page's default series (the greenhouse-gas total, carbon monoxide, Rustavi's main PM10 station, Georgia's temperature, water put into the pipes, Georgia's waste collected and Georgia's timber cut), its latest figure and its coverage from served facts. City and area pages have no card. The sidebar lists the seven pages under `გარემო და კლიმატი`, after Energy and food and before Demography. No page has a tab row or a measure switch, and no icon switch is added anywhere in the hub.

The pages with a chart reuse the Crime and Housing workspace: the latest-value line, the editorial line chart, table, RangeStrip, right-hand series panel and three-sheet Excel action. Under each H1 is only the latest-value line (§17), which fits one line at 375px, and the only line under the chart is the source note, which names the agency Geostat credits for that table (`Source: Geostat, Ministry of Environmental Protection and Agriculture · million tonnes CO₂ eq. · 2000–2022 · Methodology and sources`). Every measure is a row of the right-hand list under a small heading (the optional `heading` of `FlatSeriesPanel`) that names its unit, with the page total first and nothing under a caret. Series names carry no prefixes.

- **Greenhouse gases** (`/greenhouse-gases`, 2000–2022): the line `Greenhouse gases · 2022: 20.1 million tonnes`. Total (selected, ink) and Total after forests absorb, then By sector (Energy, Industry, Agriculture, Waste, and Forests and land, which is below zero and drawn against the usual zero rule), Energy in detail (stationary combustion, transport, leaks from gas and coal), By gas (carbon dioxide, methane, nitrous oxide), Fluorinated gases in thousand tonnes (HFCs, SF₆) and Per person in tonnes.
- **Air pollution** (`/air-pollution`, 2013–2024): the line `Carbon monoxide · 2024: 86.4 thousand tonnes`. One heading per pollutant, carbon monoxide first and then Geostat's order (nitrogen oxides, sulphur dioxide, ammonia, volatile organic compounds, all dust, PM10, PM2.5), each with Total, From factories, power plants and homes and From vehicles, all in thousand tonnes. The page has no single total: the eight pollutant totals are selected on arrival and none is the ink reference.
- **City air quality** (`/air-quality`, 2005–2025) is an index of nine city cards (§6.6) in Geostat's order: Tbilisi, Kutaisi, Batumi, Rustavi, Zestaponi, Zugdidi, Akhaltsikhe, Telavi and Mestia. Each card carries the PM10 yearly average at the city's first station as a sparkline with its latest value (Zestaponi's its dust, TSP, average) and opens the city's page. The line under the heading names the city with the highest PM10 yearly average in the latest year. There is no chart workspace.
- **City pages** (`/air-quality/[city]`, nine per locale, 16 stations in all) follow the Inflation city pages: `ჰაერის ხარისხი — [რუსთავი ▾]` / `Air quality — [Rustavi ▾]` with the city picker (an all-cities entry returning to the index) and previous/next links, then one latest-value line naming the first station's latest PM10 average. The list has four headings: the PM10, PM2.5 and nitrogen dioxide yearly averages (µg/m³) and Days over the daily PM10 limit (days), each listing the city's stations by the street or place Geostat names them, and each average then its **Yearly limit**. The limit rows are grey and dashed (`EditorialLineChart` `dashed`), taken from Geostat's printed limits (PM2.5 25 to 2019, 20 from 2020) and drawn only over the years the city has a station value for that measure. PM10 at every station plus the PM10 limit are selected on arrival; the three averages share one unit and can be charted together. Zestaponi's manual station lists dust (TSP), sulphur dioxide, nitrogen dioxide and manganese dioxide averages with no limit rows, and selects dust.
- **Temperature and rain** (`/climate`, 1990, 1995, then 2000–2024): the line gives Georgia's latest yearly average temperature (10.3°C in 2024) and, as its note, the year's difference from the 1961–1990 average (`+1.9 vs 1961–1990`). Three headings, Yearly average temperature (°C), Difference from the 1961–1990 average (°C) and Rain and snow in the year (mm), each listing Georgia (temperature selected, ink), Tbilisi and the two regions Geostat names in its block titles, by name (`Guria (warmest region)`). 1990 and 1995 stand between gaps and show as dots.
- **Water** (`/water`, 2015–2025): the line `Water lost in pipes · 2025: 64.4%`. Water in million m³ (Put into the pipes, selected; Lost on the way; Reached users; Supplied to households), Water lost (%), People (million) and Share of people (%) with piped water, sewers and wastewater treatment, and Household use per person (m³).
- **Waste** (`/waste`, 2015–2024) and **Forests** (`/forests`, 2010–2024) are indexes, as Housing's Regions is: the latest-value line (`Waste collected · 2024: 1.18 million tonnes`, `Timber cut · 2024: 376,215 m³`), then the shared `RegionIndex` map and ranked list of the 11 regions coloured by the latest year's waste collected or timber cut, with the occupied-territory overlays and Georgia as the list's first, unranked row. Georgia and each region, on the map or in the list, open their own page. Tbilisi has no timber figure, so the Forests map draws its shape without a value or rank (no data), through a small optional addition to the shared map builder that leaves every other map unchanged. There is no chart workspace.
- **Area pages** (`/waste/[id]` and `/forests/[id]`, Georgia and the 11 regions, 12 per topic and locale) follow the Housing area pages: `ნარჩენები — [გურია ▾]` / `Waste — [Guria ▾]` (and `ტყეები` / Forests) with the `RegionPicker` (Georgia first, an all-regions entry returning to the index) and previous/next links, one latest-value line and the chart workspace. Waste lists Waste collected in thousand tonnes (selected) and, on Georgia's page, Per person (kg). Forests lists Timber in m³ (Timber cut, selected; Illegal logging found); Georgia's page adds the same two in protected areas (illegal logging from 2013), forest and field fires and area burnt (2013–2024). Tbilisi's Forests page lists illegal logging only and selects it.

**One unit at a time.** Where a list mixes units, a chart shows one unit: ticking a row of another unit replaces the selection with that row, by the shared `keepOneUnit` rule of `lib/explorer/unitList.ts` that Business, Housing and Crime also use.

**Values and gaps.** Values show as Geostat's tables print them (the stored 17.66 shows as 17.7, 44.5 µg/m³ as 45) in the list, chart, table, tooltip and Excel; the sum checks use the stored value, and Fiscal.ge computes no share, ratio or growth. A year without a value is a gap in the line, a dash in the table and a blank Excel cell, never zero; a year with a value between two gaps shows as a dot. Geostat's `-` is a zero only where its legend says magnitude nil (illegal logging).

**Units and colour.** Axis ticks and table cells carry numbers only and the chart panel names the unit. Every series has a fixed colour: the page total is drawn in ink and the others take the editorial palette by their position in the list; limit lines are grey and dashed.

**State.** Chart | Table, years and selection (including an empty one) live in the URL hash through the shared hook `components/explorer-shell/use-hash-state.ts` and survive reloads and language switches. Lists that exceed the shared selector's threshold show a search box.

Only yearly data is shown and the pages state no causes. The methodology page says what CO₂ equivalent is, what the limit lines are, which regions are the warmest, coldest, wettest and driest, and quotes Geostat's footnotes. The authoritative scope is `Project_Definition.md` §2Q; bounded decisions are in `docs/superpowers/specs/2026-10-20-environment-design.md`.
