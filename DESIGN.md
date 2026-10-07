# Fiscal.ge Design System — Editorial

Version: 4.1
Last updated: 2026-10-07
Status: Production visual system for Fiscal.ge
Scope: Explorer product UI (budget, economy, inflation and unemployment), charts, tables, controls, export surfaces, responsive behavior, and future pages that reuse the Budget Explorer shell.

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

Fiscal.ge is a Georgian-first explorer of reviewed annual budget and economy data plus monthly national inflation. It is not a broad public-data catalog. `Project_Definition.md` §2 owns scope; this section only frames the visual system.

Included: the budget hub, multi-year explorer (line + table) with fields/ministries grouping, single-year analysis view, the one-chart Government Debt explorer, the one-series general-government deficit explorer, the Economy hub (GDP overview, national sectors, regional economies), the Inflation hub (overview, categories, cities), the annual unemployment explorer, methodology pages, the `/connect` page, Excel workbook export, Georgian-first UI with an English mirror (§2.2), minimal public source label, internal provenance metadata.

Excluded: data catalog, capital explorer, admin UI, a public API beyond the read-only MCP and static publications, uploads, sub-annual data other than inflation (§25), automated document extraction, clickable drilldown pages (series selection in the explorer is not drilldown). The Government Debt explorer does not alter the existing `spending.debt_service` expenditure series.

Municipal budgets are a budget **section** at `/explorer/municipalities` (§2.1, §6.2, §20): an index with a municipality-grain map and ranked list, 64 municipality pages, 11 region roll-up pages, and one explicit Georgia aggregate page, reachable from the sidebar and hub card 03 (§6.7). The annual unemployment explorer is active at `/explorer/unemployment` and its English mirror. The `დემოგრაფია` teaser remains a marker with no public data or route.

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

**Exception: the explorer shell** (§6.7) — `/explorer` and its six sections use a sidebar + content-column layout instead, with different max-width and padding. This page shell applies to the landing page (§19) only.

### 6.2 Information Architecture

The landing lives at `/` (მთავარი — see §19). Everything else is the data platform: the Budget, Economy and Inflation hubs and their sections, all mounted under `/explorer` inside the shell of §6.7. Every route below also exists under `/en` (§2.2).

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
/explorer/economy/regions                               All Regions map and ranked list (§26)
/explorer/economy/regions/[id]                          11 regional-economy detail pages (§26)
/explorer/inflation                   ინფლაცია          Inflation hub (§25)
/explorer/inflation/overview                            Monthly national CPI overview (§25)
/explorer/inflation/categories                          COICOP categories and contributions (§25.1)
/explorer/inflation/cities                              Inflation by city: Georgia page (§25.3)
/explorer/inflation/cities/[city]                       Inflation in one city (§25.3)
/explorer/unemployment                უმუშევრობა        Unemployment hub (§27)
/explorer/unemployment/overview                         National overview and supporting tabs (§27)
/explorer/unemployment/regions                          Region-only map and linked list (§27)
/explorer/unemployment/regions/[id]                     Region indicators and trends (§27)
/explorer/unemployment/age                              Age-group comparisons (§27)
/explorer/unemployment/gender                           Women/men comparisons (§27)
```

Outside `/explorer` sit the two editorial pages, `/about` (§23) and `/connect`, the MCP connection page (§24), and the methodology centre at `/methodology` and `/methodology/[dataset]` (§21).

Public municipality routes use the explicit lowercase-ASCII `[slug]` registry. Numeric municipality codes remain internal data, geometry, and join identifiers; they are not the public route identity.

The section **is the route** — not React state, not a hash key. Sections are reached from the sidebar's nested list under `ბიუჯეტი` (§6.7) or from the hub cards; there are no in-page nav tabs. Section order is fixed and identical in both places: `ხარჯები`, `შემოსავლები`, `მუნიციპალიტეტები`, `ანალიზი`, `ვალი`, `დეფიციტი`.

Every surface under `/explorer` opens with the **breadcrumb row** (§6.7): `მთავარი / მონაცემები / ბიუჯეტი` on the hub, `მთავარი / მონაცემები / ბიუჯეტი / <section>` on a section. Municipality entity pages extend that hierarchy through their real region before the municipality name (`… / მუნიციპალიტეტები / იმერეთი / ჭიათურა`); the visible trail and `BreadcrumbList` JSON-LD use the same region route. Its right slot is a mono **coverage** label — `{range} · განახლდა {YYYY-MM-DD}` (English `Updated {d Month yyyy}`) for the route's active scope, not the user's selection (the range strip owns that, and the two facts live at different altitudes). One formatter (`lib/explorer/coverageLabel.ts`) writes it on every route, all four hubs included; the range uses the unspaced en dash for month ranges as well as years.

On the section routes, under the page title, sits the **deck line**: a mono lead value (latest-year total for the explorer, `year · N კატეგორია · სულ X` for analysis) plus a colored YoY delta and the phrase `წინა წელთან`. The hub has no deck line — it opens with the serif H1 `საქართველოს ბიუჯეტი` and a plain lead paragraph.

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
| Economic sectors | `measure`, `view`, `sel`, `range=all` or `start`/`end` | — |
| Inflation overview | `i` indicator, `m` mode, `r=YYYY-MM-YYYY-MM`, `sel`, `t` table series | — |
| Inflation categories | `i`, `m`, `r`, `sel`, `t`, `x` expanded divisions | — |
| Inflation cities | `m`, `r`, `sel` (place slugs on the Georgia page; `total`, `01`–`12` on a city page), `t` table line | — |

Write rules: loading a page never adds state to its URL, so a pristine URL stays clean. After that, every change replaces the current history entry, except the discrete switches a section's spec asks Back to step through, which push one — today only the economic sectors measure and view.

Restore on load with validation (unknown values fall back to defaults; ranges clamp to loaded years; repeated selection IDs collapse to their first occurrence).

Links shared before the route split still work: `/explorer#nav=expenditure|revenue|analysis` is honored once by a client component mounted on the hub, which reads the hash on mount and `router.replace`s to the matching route with `nav` stripped and the rest of the hash preserved.

The landing links into the four dataset hubs (hero CTA → `/explorer`, the four-dataset row, the footer) and into the budget sections from its ledger (§19).

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
- **Exception: budget hub cards** (`tile` bg, 1px `hairline` border, radius 0, hover `tint`, no shadow). Six peer destinations with no natural reading order are the one place containment beats rules — a rule stack implies a sequence that is not there. Cards remain forbidden everywhere else; this exception does not generalize to panels, KPI blocks, or any other surface.

### 6.7 Shell and Sidebar

Everything under `/explorer` renders inside a persistent shell: a dark sidebar on the left, the content column beside it (max-width 1180px, **centred** in the space left over, page padding `20px` / `34px` at ≥768px). Centring matters past ~1500px: left-aligned, the column strands the whole surplus as one blank margin on the right. Implementation: `apps/web/components/shell/`.

**Sidebar (expanded, ≥900px).** 232px, `ink` background, radius 0, sticky at `top: 0` with full viewport height so it holds while the long explorer page scrolls. Dividers on ink are `rgba(247,242,233,0.12)`; the active row background is `rgba(247,242,233,0.07)`.

- Brand block → `/`: the reversed mark at approximately 30px, followed by live serif text `Fiscal.ge` in `paper` and live mono text `ღია მონაცემები` (8.5px, 0.1em) beneath in `ink-fg-faint`. This identity is shared by the expanded desktop sidebar and the mobile top bar.
- `მონაცემები /` overline: mono 9.5px, 0.12em, `ink-fg-faint`.
- Four dataset links, in order: `ბიუჯეტი` → `/explorer`, `ეკონომიკა` → `/explorer/economy`, `ინფლაცია` → `/explorer/inflation`, `უმუშევრობა` → `/explorer/unemployment`. The active dataset wears a `2px accent` left border, active-row background and sans 12.5/600 in `paper`; inactive ones are `ink-fg-muted`.
- Only the active dataset's sections nest beneath it: the six budget sections (below), Economy's GDP / sectors / regions, Inflation's overview / categories / cities, or Unemployment's national overview / regions / age groups / gender, all in the section-row style below.
- `დემოგრაფია` — `ink-fg-muted` labels with a `მალე` badge (1px `#6C6860` border — **3.09:1** on `ink`, above the WCAG 1.4.11 3:1 floor for a component boundary — 2px radius, mono 9px, `ink-fg-faint`), rendered at reduced emphasis (opacity 0.6) so it never reads as a live row. Markers only: not links, not focusable, no route, no data.
- Foot, above a 1px divider: `← მთავარი`. No version string.
- Top-right: the collapse toggle — a 26px box, 1px `rgba(247,242,233,0.18)` border, Lucide `ChevronsLeft` (expanded) / `ChevronsRight` (collapsed) (§7.2a). `ChevronsLeft`/`ChevronsRight` are desktop-only; below 900px the toggle is the Lucide `Menu` / `X` pair (accessible name `მენიუ` / `Menu`, 44×44, no border).

**Section list** (`section-nav.tsx`, nested under `ბიუჯეტი`). Each entry is a route link. Active: accent `▸` marker, `paper` text at weight 600, active-row background, `aria-current="page"`. Inactive: `ink-fg-muted`, marker held in transparent so labels do not shift. All six sections — `ხარჯები`, `შემოსავლები`, `მუნიციპალიტეტები`, `ანალიზი`, `ვალი`, `დეფიციტი` — render this way; none is a `მალე` marker. Deleting this one component and its single usage reverts navigation to hub-and-breadcrumb only; nothing else imports it.

**Collapsed rail (≥900px).** 52px, same `ink` surface, radius 0:

- The toggle stays in place at the top, icon flipped to `ChevronsRight`.
- Below it, the context line runs vertically down the rail, naming the active dataset (`მონაცემები · ბიუჯეტი`, or the Economy / Inflation equivalent), mono 9.5px, `ink-fg-faint`, 0.1em, via `writing-mode: vertical-rl` plus `rotate(180deg)` so it reads **bottom-to-top**. It carries the same two facts the expanded overline and active row carry, which is why the section list can disappear without losing orientation.
- Beneath it, the compact language switch; at the foot, a Lucide `House` icon is the collapsed `← მთავარი` link, with a 26×26 hit area, `aria-label="მთავარი"`, and a `title` tooltip. The collapsed rail remains logo-free.
- **Sections are not reachable while collapsed** — the list is unmounted, not hidden. A 52px rail cannot carry Georgian section names, and reducing them to invented initials would trade one extra click for three ambiguous glyphs. Collapse is a reading posture: it hands the width back to the data and keeps only orientation and escape.

Width transitions at `base` (§14) and snaps under `prefers-reduced-motion: reduce`. The choice persists in `localStorage` under `geodata:sidebar-collapsed`, read after mount; a storage denial falls back to expanded rather than breaking the render.

**Below 900px** (owner decision D3, 2026-10-07). The sidebar becomes a full-width top bar (brand + `☰` toggle, ~56px, safe-area aware) that stays pinned to the top of the viewport while the page scrolls, so the menu is always one tap away. The toggle opens the same nav as a panel hanging directly below the bar, capped at the viewport height minus the bar and scrolling on its own; there is no backdrop. `Escape` closes it and hands focus back to the toggle; a tap outside the bar or on a link closes it. Every panel row — datasets, sections, the language switch and `← მთავარი`, which is a full row — is at least 44px tall. Expanded/collapsed is a **desktop-only** state: a persisted collapse preference is ignored below 900px rather than applied as an unexplained narrow rail, and the mobile toggle only opens and closes the panel.

**Accessibility, and the deviations on record.**

- The toggle exposes `aria-expanded`. On desktop its label flips between `პანელის ჩაკეცვა` and `პანელის გაშლა`; below 900px it is `მენიუ` / `Menu` and points with `aria-controls` to the mounted `data-sidebar-navigation` panel. The collapsed desktop rail omits `aria-controls` because that panel is unmounted.
- There is **no focus trap** on the mobile panel, by decision. A trap is the contract for a modal; this panel is non-modal — no backdrop, the page behind it stays reachable, and a tap outside dismisses it — so trapping would strand keyboard users in a region they can simply tab past. `Escape` to close plus focus return to the trigger is the whole contract.

**Breadcrumb page header** (`page-header.tsx`). One row with a `2px ink` bottom rule, rendered per route (the final crumb differs per route, and a server layout cannot read the child route). Crumbs: sans 10.5px uppercase 600 in `muted`, current crumb in `ink`, separators `/` in accent. `მთავარი` links to `/`; `მონაცემები` is plain text with no route; `ბიუჯეტი` links to the hub on section routes and is plain text on the hub. Right slot: the mono 10.5px `faint` coverage label of §6.2 — the loaded range of the route's active scope, so it tracks the grouping, and the union of both sides on the hub. Unemployment region pages end the trail with the region name.

Below 768px (owner decision D10, 2026-10-07) the trail is replaced by a single back-link to the nearest linked parent (`← ბიუჯეტი`), sans 11px uppercase with a 44px target. From 768px the full trail shows; the `BreadcrumbList` JSON-LD is the same at every width.

The crumbs carry `BreadcrumbTrail`'s semantics, not its markup: a `<nav aria-label="Breadcrumb">` landmark, `aria-hidden` separators, and `aria-current="page"` on the final crumb. They deliberately do **not** reuse the component itself — `BreadcrumbTrail` renders its own `BreadcrumbJsonLd`, and these routes already emit one, so reusing it would ship two structured-data blocks per page. Marking the current page by colour alone, in a paragraph of spans, is what this replaced: on the site's largest set of routes the trail was not a landmark and read as a run-on string with the slashes announced.

**Footer.** Every `/explorer` route renders `SiteFooter` (§19) at the foot of the content column — inside it, not beside the sidebar — with the pages' own horizontal padding so its rule lines up with the content above. The footer uses the compact lockup at approximately 150px and retains its trust, navigation, contact, and CC BY 4.0 licence content (anatomy in §19). Explorer and methodology-article footers name the relevant dataset's source institutions; review dates remain in the page's existing source note or article header. They do not repeat the site-wide latest review date as if it applied to that dataset. Generic footers explicitly label the landing model's `updatedAt` as the latest source review across Fiscal.ge. These routes are the site's main SEO landing targets, and the footer is where the licence, contact address and methodology link live (§21).

**Budget hub (`/explorer`).** Breadcrumb, serif H1 `საქართველოს ბიუჯეტი`, a concise lead covering budgets, debt and deficit, then six cards in a two-column grid (one column below 768px, max-width 860px), then the standard source note (§7.10). Card anatomy, in order: mono index in accent with `→` right-aligned, serif 18px title, 11.5px `muted` description, graphic, mono 10px `faint` footer. The sparkline draws at 200×34 from 768px and at the full card width below it; a card without a graphic keeps the empty 34px band so footers align.

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

Vertically centered logo row: lockup left, navigation centered independently of the side content, language switch right; no coverage-year label or bottom rule. From 900px, equal outer grid columns keep navigation at the header's true midpoint. Below 900px, a single compact row contains the standalone logo symbol on the left, a centered bold Fiscal.ge wordmark without a tagline, and an icon-only Menu button on the right. The button retains a localized accessible name. The button expands navigation links and the KA / EN language switch beneath it; the language switch stays inside this panel, with each language target at least 44×44px. In the panel, `მონაცემები` is a label over the four dataset links (`ბიუჯეტი`, `ეკონომიკა`, `ინფლაცია`, `უმუშევრობა`); from 900px the single `მონაცემები` → `/explorer` link stays (owner decision D3, 2026-10-07). Escape closes the panel and returns focus to the button; following a link or crossing the desktop breakpoint closes it. Nav tab: sans 13px; active = ink, weight 600, `2px accent` text underline with a `5px` offset; inactive = muted, weight 500. The landing page marks `მთავარი` active. `/about` marks `მიზანი` active. Methodology routes mark neither `მთავარი` nor `მონაცემები` nor `მიზანი` active and render no `aria-current`, because methodology remains inactive as a separate destination; no methodology tab is added.

The English hero heading uses two explicit lines: `Georgia` followed by `in numbers`. English hero statistics and city population labels abbreviate thousand as `k` (for example, `69.7 k km²`).

### 7.2a Mode Control

A segmented control for `ხაზი / ცხრილი` in the chart controls row, and the bounded national-sector measure switch: inline-flex, 1px `control` border, 2px radius. Text segments are mono 10.5px with 0.04em tracking and `6px 13px` padding; the divider between them is the shared 1px `control` border. Active segment: `ink` background, `paper` text. Inactive: `muted` on transparent, hover `tint` + `ink`. The group has `role="group"` with a localized label; each segment keeps `aria-pressed`. Icon segments use 36×36px targets and allow tooltips outside the border; text-only groups retain overflow clipping.

### Functional icon standard — Lucide

Lucide (`lucide-react`) is the project's chosen functional icon family. Use named imports of only the required icons, not a dynamic all-icons registry or another icon library. Default: 18×18px, 1.5px stroke, `currentColor`, no decorative fill, gradients or animation. Keep button sizes, focus rings and existing ink/paper/tint states from their owning controls; do not restyle the application to match an icon library. The dependency version is pinned in the package manifest/lockfile. Lucide's ISC licence permits commercial use; retain its packaged licence notices.

Icon-only controls must keep a localized accessible name on the button/link; the SVG itself is decorative (`aria-hidden`). Measure controls show the full label on hover and keyboard-visible focus, with Escape dismissal and hoverable tooltip content. Mouse/touch clicks must not latch the tooltip open after the pointer leaves. Touch users can read the selected measure's explanation beneath the heading. Reuse `SegmentedTabs` and `ControlTooltip` for this pattern.

National-sector mapping: literal `₾` for nominal GEL, Lucide `ChartPie` for share of GDP, `ChartNoAxesCombined` for real growth. The chart icon denotes a measure, not a promise of positive growth. Existing functional menu/close, sidebar collapse/expand and compact home controls use Lucide `Menu`, `X`, `ChevronsLeft`, `ChevronsRight`, and `House`. Logos, brand assets, maps and actual data visualizations are not UI icons and remain unchanged. Conventional checkbox marks, textual carets and arrows embedded in prose remain typographic; do not add decorative icons or indiscriminately replace text with symbols.

A boxed either/or switch is the honest affordance for choosing which view of the same data you are looking at. A filter is not that — do not box the tab groups of §7.2b.

### 7.2b Grouping Tabs

Text-only, sans 12.5px; active = ink 600 with `text-decoration: underline`, 2px thickness, accent color, `text-underline-offset: 4px`. No backgrounds. In the **explorer**, the grouping tabs (`სფეროები / სამინისტროები`, expenditure multi-year only) live in the series aside, directly under the `სერიები` header row (gap 18px, 12px padding-bottom, 1px `row-border` bottom rule). Below 1100px of column width they lead the chart panel instead, above the `ხაზი / ცხრილი` row, with the same state and URL key `g` (owner decision D4, 2026-10-07). In the **analysis view**, the side tabs (`ხარჯები / შემოსავლები`) and grouping tabs use this same style, separated by a 1px×13px `control` vertical divider.

### 7.3 Measure Pill (% მშპ-ში)

Height 27px from 768px and 36px below it, pill radius, 1px `control` border, transparent bg, muted text. Active: ink bg, paper text, ink border, `aria-pressed`. This is the only pill control in the national multi-year explorer (the return-to-chart pill of §7.14 is a scroll shortcut, not a control of the data). Active `% მშპ-ში` divides every national revenue or expenditure amount, including the derived total, by Geostat's same-year nominal GDP at current prices. The denominator is independent of series selection. Missing same-year GDP renders a gap. Municipal explorers retain their `% წილი` pill as share of the active municipality, region, or Georgia budget total, and single-year analysis retains composition shares. There is no separate GDP explorer page.

Active, the label is preceded by a decorative `✓` (not part of the accessible name; `aria-pressed` carries the state), and the unit caption beside the pill is not shown, so caption and pill never repeat the same text; inactive, the caption names the current unit (`მლრდ ₾`). The municipal `% წილი` pill follows the same rule; below 768px its amount caption shortens to `მლნ ₾` so the pill stays on the controls row.

### 7.4 Range Quick Chips (5წ / 10წ / ყველა)

Mono 11px text links; active = ink 600 underlined (accent underline); inactive = muted 400. `5წ` shows only when >5 loaded years, `10წ` only when >10.

When the strip carries a boundary marker (e.g. `პროგნოზი`), the rail gains top margin so the label clears the chips, and the label is shifted by its position so it stays inside the strip.

There is **no one-year chip**. Every figure in `ძირითადი ინდიკატორები` is a
start-to-end delta, so a range of one year zeroed the entire section — a headline
`0.0%`, movers falling back to row order, and a single category named both the
largest and the slowest growing. The rail handles can still collapse the range to
one year, which is what the §8.5 guard covers.

### 7.5 Range Slider

24px-high rail: 3px `hairline-soft` track, accent fill at 40% opacity between handles, 15px round handles (paper fill, 2px accent border, handle shadow). The rail is clean — no per-year tick dots. Below 768px the rail is inset 8px on both sides so a handle at rest sits outside the edge-swipe zone. On monthly strips the readout's month and year are each a native select (dotted underline), so an exact month is one tap away; a pick beyond the other handle snaps to it. Handles are buttons with `role="slider"`, aria value attributes, and Arrow/Home/End keyboard support. Mono min/max year labels below.

### 7.6 Series Row (aside panel)

Row: 1px `row-border` bottom border; hover/selected bg `tint`; a 2px accent left rail marks expanded ministries and program rows. Toggle button (`aria-pressed`): 14px square checkbox (1.5px `control` border; checked = the row's series-colour fill + paper ✓), swatch bar shown for selected and unselected rows, sans 12.5/500 label clamped to 2 lines, latest value mono 11 muted right-aligned. Values and metas are `muted` at full opacity. An optional visible header names the row values (inflation categories: basket share · active tab value, `პპ` for contributions). Ministries rows add a caret button (`▸/▾`, `aria-expanded`, a 22px column with a 26px hit area) that expands the ministry's major programs; program rows are indented, sans 11.5/400 in `body` color. Program rows show names only — official program codes stay in the data layer (they fragment across reorganizations) and are not surfaced.

### 7.7 Search

The shared selector order is: optional grouping tabs (moved above the chart below 1100px, §7.2b), search, an action/status row, then the series list. The action/status row places `გასუფთავება` / `ყველას მონიშვნა` on the left. Ordinary scopes show `სერიები {selected} / {all}` on the right; ministries show `ძირითადი {selected} / {all} · პროგრამები {selectedPrograms}`. The bulk indicator is a three-state checkbox: empty (`aria-checked="false"`), partial with a centered ink dash (`aria-checked="mixed"`), or ink-filled with a paper checkmark (`aria-checked="true"`). Empty selects all; partial and full states clear all. Search never scopes the count or bulk action; selection remains unlimited. The search field is shown only when the list has more than ten rows (`SEARCHABLE_MIN_ROWS`); debt, deficit, the inflation overview and the Georgia inflation-cities list have none.
Both the count's denominator and the bulk action cover the **top-level rows
only** — the total and its categories, the rows the panel lists before any caret
is opened. Collapsed major programs are neither counted nor selected by
`ყველას მონიშვნა`, so the ministries' `ძირითადი` denominator reads `/ 15`, not
`/ 63`. The separate `პროგრამები` figure counts every selected program, including
one whose caret is later collapsed, so the status never understates the chart.
A program is still selectable individually once its caret is open; `გასუფთავება`
clears everything, programs included.

Underline-only input: h34, no box, 1px `control` bottom border, transparent bg, sans 13px, radius 0. Search inputs are `type="search"` with `enterkeyhint="search"`; on stacked layouts focusing the field scrolls it to the top of the viewport so results stay above the on-screen keyboard. The placeholder is `ძებნა` / `Search` in every series panel, the products list and the municipal and regional indexes (all underline fields, h34); heading pickers keep their descriptive placeholder. A query with no matches shows `კატეგორია ვერ მოიძებნა — შეცვალე საძიებო ტექსტი.` The total row stays pinned regardless of the query, so this message names the categories that missed rather than claiming zero results — it would otherwise render directly above a visible `მთლიანი ხარჯი`. While searching in ministries grouping, ministries with matching programs auto-expand to show only matching programs (their caret is locked open); a ministry matched by name still honors its caret and expands to all of its programs. The query is panel-local state and resets on ANY scope switch — nav (ხარჯები↔შემოსავლები) and grouping alike; typing must not re-render the chart.

### 7.8 Excel Button

Excel remains dataset-owned below the selector and is not part of the shared selector contract.

Full-width block, h38, ink bg, paper text, sans 12.5/600, radius 2px. Hover: opacity 0.85. Label: `ჩამოტვირთვა`; while creating the file it is disabled and reads `Excel მზადდება…`; failures show `ფაილი ვერ მომზადდა — სცადეთ თავიდან.` below the action. There is one public action, no public explorer CSV action or format menu. It creates a Fiscal.ge `.xlsx` file for the active range, selected series, grouping, and measure; selector search never narrows it. The three visible sheets are `მარტივი ცხრილი`, `მონაცემები`, and `წყაროები` (§15).

### 7.9 Callout / Notice

Tint bg, `2px accent` left border, sans 11.5–12.5px, `body` color, max-width 560px. Used for empty selection, no-growth-data, and load-error states.

### 7.10 Source Note

Sans 12px, muted, plain paragraph under the primary panel and at the end of the analysis view. Pattern:

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

Left: segmented control + unit note + measure pill row → chart or table → range strip → source note. Right (aside, sticky, 1px hairline left border, 26px padding-left): `სერიები` overline, grouping tabs (expenditure only, §7.2b), search, action-left/status-right row, series rows, dataset-owned Excel button. The series list scrolls inside a ≤430px box only in the sticky two-column aside (≥1100px); stacked, the list flows with the page (owner decision D4, 2026-10-07).

### 8.3 Line Chart

SVG on paper (no plot frame), viewBox 920×320: a dot lattice for the grid (below), `1px ink` line at zero, 1px `hairline` y-axis line; axis labels mono 11px muted (y labels right-aligned outside the plot; left padding 74 minimum, widened to fit the widest label so no label clips); year labels thinned to ≤12 (first anchored start, last anchored end); series polylines 2.2px round-joined with a 3.5px dot on the final point only; no in-plot direct labels. Hover/pointer: 1px `#C9BEA9` vertical guide (the same chart-local hex as the lattice, §below), ring markers (paper fill, 2px series stroke), tooltip (tile bg, 1px hairline border, radius 3, tooltip shadow, mono year + swatch/label/value rows; flips side past 60% width). The tooltip is bounded because selection is unlimited: series with no value at the hovered year are dropped rather than shown as `—`, the rest are ranked by value descending, at most 10 are listed, and any remainder becomes a `+N სხვა` line. It is capped at the height of the plot it sits in, since the chart's `overflow-x` frame would otherwise clip it. Touch: a tap pins the readout for the tapped period until the same period is tapped again or a tap lands outside; from 768px the pinned tooltip sits in the top corner of the visible frame, away from the finger. Below 768px every readout (tap, hover, keyboard) renders instead as an in-flow panel directly under the chart, 12px, with the tooltip's header, rows, order and `+N` line; from 768px the floating tooltip is unchanged. `role="img"` + Georgian aria-label. SVG text sets fonts via `style`, as house style for chart code.

**Dot lattice.** It replaces the horizontal gridlines outright — the dot field *is* the grid, not decoration behind one.

- `#C9BEA9` at opacity 0.6, radius 0.7. Literal hex from `lib/explorer/colors.ts`, matching the rest of this chart. An undefined custom property renders black, so chart code never references a token `app/globals.css` does not define. This was once the `control` value and is now chart-local: `control` darkened to `#95846A` to clear the 3:1 non-text floor on both paper and tint (§4.1), which governs control boundaries, not grid decoration. Darkening the lattice with it would turn the dot field into a tone.
- Pitch is derived from the active scale, never fixed: **2 columns per year interval** (`plotWidth / (2 × (n − 1))`) and **3 rows per gridline step** (`stepPx / 3`), so every third row lands exactly on a labelled y value and every second column on a year.
- Density guards: a sub-division pitch below 12px falls back to one column per year, or one row per step, independently. A negative domain can produce many gridline steps, and dots must never smear into a tone. With `n ≤ 1` there is no interval to divide and no lattice is drawn.
- Drawn as one `<pattern patternUnits="userSpaceOnUse">` with the circle at the tile center and the pattern origin offset back by half a pitch, so dot centers land exactly on the plot's grid intersections with no edge clipping — a pattern, not ~500 `<circle>` elements.
- The `1px ink` line at zero stays: it is load-bearing for negative domains. The `hairline-soft` horizontal gridlines are gone.

Data-reality rules (the prototype's snapshot had none of these; production data does):

- **Axis scale**: the gridline step is chosen from 1/2/2.5/5×10ⁿ for 4–7 intervals, and the top/bottom is the first gridline past the data (+5% headroom). Amount axes only use whole multiples of the unit's printed precision.
- **Negative values** (e.g. `revenue.other_taxes` 2019–2020) extend the y-domain below zero: both bounds snap to one shared gridline step so 0 always sits on a gridline; the ink line stays at zero, not at the plot floor.
- **Interior gaps** (e.g. programs with no 2015 facts) split the polyline into segments — never bridge a missing year; an isolated point renders as a small dot.
- **Empty range**: a non-empty selection with zero points in the active range shows the callout `არჩეული სერიებისთვის ამ დიაპაზონში მონაცემები არ არის…` instead of a fabricated axis (table mode shows the same callout instead of a total-only table).
- **Narrow screens** (<768px, the §12 mobile breakpoint; owner decision D1, 2026-10-07): the chart draws a phone geometry at the frame's own width (one viewBox unit per CSS pixel, height 0.72 × width within 220–320px), so axis text renders at 11px and nothing scrolls. Year/month labels are thinned to whatever fits without collision, always labelling the first and the latest period; the y ticks print numbers only and the amount unit is printed once above the axis (share axes keep `%`). Before the browser measures, both geometries are in the HTML and CSS shows the phone one, so a phone never paints the desktop chart first. From 768px the 920×320 drawing is unchanged; where its 720px minimum still exceeds the frame (768–776px) it scrolls, opens at the latest period (and again after a range or series change), and keeps a sticky copy of the y-axis labels at the frame's left edge. Hover state is clamped when the years array shrinks. The chart frame's accessible name is `მრავალწლიანი გრაფიკი`; `— ჰორიზონტალურად გადაადგილებადი` is added only when the frame actually scrolls.
- **Phone legend** (owner decision D4, 2026-10-07): below 768px, with two or more lines, a wrapped legend sits directly under the frame — 14×3 swatch, label, and the value in the last period drawn with its unit (11px `muted`, value `ink` mono). While the tap readout is open the legend is hidden; it returns when the readout closes.

### 8.4 Table Mode

National columns: `<first col> | years… | ცვლილება | წილი მშპ-ში <end-year>`. First column header by scope: `სფერო` (fields), `უწყება` (ministries), `საბიუჯეტო მუხლი` (revenue). Header: overline style, `2px ink` bottom rule. Rows: 1px `hairline-soft` borders, tint hover; swatch bar + sans label left; numerals mono right-aligned; latest-year column weight 600; change colored positive/negative (minus sign `−`). When selected, the national dataset total row uses its exact scope label (`მთლიანი ხარჯი` or `მთლიანი შემოსავლები`) with a `2px ink` top rule, weight 600, and its calculated GDP share rather than `100.0%`; it is absent when deselected. Municipal tables retain `წილი <end-year>` and the selected `მთლიანი ბიუჯეტი` row at `100.0%`. Horizontal scroll with sticky first column and sticky right change/share columns (paper bg, 1px `hairline-soft` edge shadows). Below 768px of table width (owner decision D5, 2026-10-07) a table of one to three series lists one row per year, newest first, with the series as columns (swatch above a wrapping name in the header, values right-aligned mono, the latest row semibold); municipal change and latest share become summary rows above the years. Four or more series keep the year columns: the first column wraps at 12px and is capped at 40% of the scroller, the change/share columns scroll with the years instead of staying pinned, columns size to their values, status marks sit under their number, and the table opens scrolled to the latest year. Headers and row labels wrap at spaces (`overflow-wrap: break-word`); a word breaks mid-word only when it cannot fit its column.

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

Row of mono 12px year buttons. Keep all years on one line when space permits; from 768px continue the sequence on additional lines without horizontal scrolling. Below 768px (§12) the buttons sit on one horizontally scrolling row that opens with the active year in view, each target at least 36px tall. Active: ink 600 + 2px accent underline. Planned year: mono superscript tag `გეგმა` in faint next to the label; keep the tag in the active state.

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

Bubble scatter, viewBox 920×380: x = share of total, y = growth vs previous year, radius = `6 + sqrt(value/max)·16`, color = solid category token with a 2px paper-colored separation stroke. Y-axis bounds round outward to multiples of 10 percentage points. Ordinary ranges up to a 100-point span label every 10-point interval; unusually wide historical ranges use a readable `1/2/5 × 10ⁿ` interval no smaller than 10 points, targeting about eight intervals and preventing overlapping labels. Zero-growth line `1px ink`; grid `hairline-soft`; y-axis line `hairline`; axis labels mono 10px. Category names are not printed beside circles; hovering or keyboard-focusing a circle shows its full category name, amount and growth (`ცვლილება +11.7%`) in the chart tooltip. Below 768px the field draws at the frame width (height 0.85 × width, 260–380px) without scrolling; a tap pins a circle (ink ring) and its readout sits under the field. The SVG is an accessible named group and every focusable circle is a named image, so assistive technology can identify points individually. If previous-year data is missing, show the callout: `წინა წლის მონაცემები არ არის ხელმისაწვდომი — ზრდის მაჩვენებლები ამ წლისთვის ვერ გამოჩნდება. აირჩიე უფრო გვიანი წელი.`

### 9.7 Full Ranking

Table columns: `<scope header> | მლრდ ₾ | წილი | ცვლილება`, sorted by GEL descending, top-level categories of the active grouping only. Rank as mono `01`-style index + swatch + label; a 120px 3px share bar (category color on `hairline-soft` track) next to the mono share; change colored positive/negative. On narrow mobile layouts the table fits without horizontal scrolling: labels show the first two words plus `…` with the full name available on hover, `მლრდ ₾` stays on one line, and the share bar is hidden while its numeric share remains visible. Desktop retains the full label and share bar.

**Completeness rule:** the ranking lists EVERY official row of the year — including zero and negative lines (e.g. `revenue.other_taxes` 2019–2020) — so the rows always reconcile with the `სულ` headline, and the category counts in the headline/deck count all rows. Shares are of the true year total (negative rows get a negative share and no bar). Only the geometry sections (treemap, every-100, radar, field) draw positive rows exclusively.

## 10. Revenue Adaptation

No separate revenue direction. Same shell, tokens, controls, chart/table treatment, analysis order, Excel and source patterns. Change only labels, taxonomy, revenue series tokens (§4.2), source wording, tooltips, and meaningful workbook columns.

## 11. Content and Copy

Voice: precise, civic, archival. Georgian is primary; English only for compact technical labels (`Excel`).

Canonical terms: `ხარჯები`, `შემოსავლები`, `ანალიზი`, `სერიები`, `ხაზი`, `ცხრილი`, `სფეროები`, `უწყებები`, `% მშპ-ში` (national multi-year), `% წილი` (municipal), `დიაპაზონი`, `მთლიანი ხარჯი`, `მთლიანი შემოსავლები`, `მთლიანი ბიუჯეტი`, `სულ` (single-year analysis), `ძირითადი ინდიკატორები`, `პერიოდის ცვლილება`, `ყველაზე მზარდი`, `ყველაზე ნელი ზრდა`, `პერიოდის შედარება`, `სტრუქტურა სფეროების მიხედვით`, `ყოველი 100 ლარი`, `ბიუჯეტის რადარი`, `ბიუჯეტის ველი`, `სრული რეიტინგი`, `ჩამოტვირთვა`, `გეგმა`.

Units always shown: `მლრდ ₾`, `მლნ ₾`, `%`. Numbers use `en-US` grouping and a `−` (minus, not hyphen) sign. Georgian editorial prose uses the same format as figures — decimal point and comma thousands (`104.6`, `67.2%`, `28,235`), never the Georgian-locale `104,6` / `28 235`. In mono figures the `₾` sign is set in the UI sans face (`withLari`, `components/ui/lari.tsx`), because Geist Mono has no lari glyph. Amounts ≥ ~1bn display in `მლრდ ₾`, below in `მლნ ₾`. Percentages carry 1 decimal.

**A funded line never renders the same as an unfunded one.** Precision is derived, not fixed, and that rule is what decides it:

- **Columns and chart axes** share one unit across every cell, which is what makes them comparable, so `unitFor()` picks the decimals once from every value the surface can show — all series, all years, never the current selection or range, or the numbers would reformat while the reader drags the range strip. It takes the fewest decimals that keep the surface's smallest non-zero value distinguishable from zero, up to a per-scope cap: **1** for fields and revenue, which are genuinely billions-scale, and **2** for municipalities (1 on 39 of the 64 pages, 2 on the other 25) and for ministries, whose drill-down programs are billions-scale only in name — at 1 decimal 45 of them collapse into 16 distinct values.
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

Mobile (<768px): page padding `24px 20px 64px`; page title 30px; hero value 44px; year selector scrolls horizontally on one row, opening at the active year (§9.1); tables of up to three series list years as rows, newest first, and wider tables scroll horizontally, opening on the latest year (sticky first column capped at 40%; right-hand columns not pinned, §8.4); tables keep keyboard-focusable, visibly focused, accessibly named scrolling containers; charts fit the width (§8.3) and keep their focusable named region. Stacked layouts (<1100px) show the floating return-to-chart pill after a selection made while the chart is off-screen (§7.14), and phones show a legend with latest values under multi-line charts (§8.3). The user removed the visible horizontal-scrolling instruction site-wide on 2026-10-07. Every 100 GEL stays 10×10 — shrink cells, never cell count; controls ≥30px tall (prefer 36px+); the bulk toggle fills its 44px row, series-row carets answer taps 12px below the row (44px) without changing the row, and text links that act as controls are 44px tall. No informational text is below 11px (§5.2).

Breakpoint behavior keys off the page container width (ResizeObserver or CSS container/media queries), matching the reference prototype.

The shell adds one breakpoint of its own at **900px** (§6.7). It governs the sidebar only — above it the sidebar is a column, below it a pinned top bar with a drop-down nav panel — and does not change the content column's own breakpoints above. The hub card grid drops to one column below 768px.

The workspace's own breakpoints measure the **content column**, not the viewport (`@container` on the centred column in `main-explorer.tsx`). With a 232px sidebar in front of it the two differ by more than the 292px aside costs, so a viewport query keeps the two-column layout past the width the chart can fit and the chart clips inside its own frame.

**Chart width between 900 and 1019px — an accepted deviation from the §8.3 label size.** In that band the sidebar leaves the column 600–719px, under the chart frame's 720px minimum. The chart shrinks to fit there rather than scrolling, so the rendered axis label falls to **7.2px at 900px** (from 8.6px). This is a deliberate trade of label size for a whole chart, approved for this band only. Two things it does not change: below 900px the sidebar becomes a top bar, the column is wide again, and phones (<768px) draw the phone geometry of §8.3 instead; and the 11px in §8.3 is a viewBox unit, so the rendered size has always tracked the frame — it is 8.6px at 1020px and 9.7px at 1440px, reaching 11px only where the chart is widest.

## 13. Accessibility

- All controls have accessible names; toggles expose pressed/selected state (`aria-pressed`, `aria-checked`, `aria-expanded`); slider handles expose `role="slider"` with value attributes and keyboard support. Slider handles keep the 15 px visual dot but expose a 30 × 30 px interactive target.
- Static SVG charts: `role="img"` + Georgian accessible label. Charts with focusable data points use a named `group` with individually named point images instead. SVG-only data must also exist in table/tooltip/summary.
- Focus visible (accent ring) on paper.
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

Do not:

- No cards, panels with backgrounds, container shadows, or radii above 3px (pill exceptions only). The single card exception is the budget hub's six cards (§6.6); it does not generalize.
- No white surfaces; no gradients anywhere.
- No blue `#0071e3` or any v3.x Apple token; no night theme or theme toggle.
- No dots/rounded-square swatches — bars only.
- No bar/stacked chart modes; only `ხაზი` and `ცხრილი`.
- National `% მშპ-ში` is share of same-year nominal GDP; municipal `% წილი` and single-year composition remain shares of their applicable budget total.
- No official program codes in the series panel (names only).
- No emoji or decorative icons; functional icons use Lucide under §7.2a. Caret `▸/▾` and checkmark `✓` glyphs remain part of the typographic control language.
- No drilldown anywhere.

## 18. Design QA Checklist

1. Page is paper-backed with no cards or shadows (tooltip, slider-handle and return-to-chart pill exceptions only; the budget hub's six cards are the one card exception, §6.6).
2. Every `/explorer` surface opens with the breadcrumb row's 2px ink rule; major sections open with 2px rules; sections are routes reached from the sidebar (§6.7), not in-page nav tabs.
3. All numerals are mono; all display values serif; overlines uppercase sans 11/600.
4. Explorer default: line mode, nominal GEL, full range, total-only selection, and unrestricted line rendering.
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

Section order is fixed: shared header → living-relief hero → country figures → four-dataset row → expenditure → revenue → municipalities → Government Debt → general-government deficit → methodology and first sources → retained footer.

**Header and hero.** The header uses the responsive lockups of §7.1, keeps `მთავარი` as the active page and `მონაცემები` → `/explorer`. The living-relief map remains the full-bleed primary visual with its existing camera fitting, city behavior, reduced-motion still frame, accessible description, and WebGL fallback. Below 768px it is a static-only, reduced-motion capture selected for narrow, medium, or wide mobile widths; mobile must not request or mount the Three.js runtime. From 768px the existing WebGL relief remains interactive, retains 8.6px terrain spacing and the 2× renderer-density cap, and begins after `load` during browser idle time with a 1.5-second timeout. The hero receives no additional logo. Visible hero copy is exactly `საქართველოს მონაცემების პორტალი`, H1 `საქართველო ციფრებში`, and CTA `გაეცანი მონაცემებს` → `/explorer` (English: `/en/explorer`). The hero CTA and every ledger section link are at least 44px tall targets. The figure reserves the compact, settled map band from first paint: `calc(29vw + 48px)` below 768px, `calc(22.7vw + 57px)` from 768px, and the camera-fit bounds in `.landing-hero-frame` from 1100px. The existing virtual camera frames (340px, 500px, and `clamp(560px, 78vh, 820px)`) still determine the map's scale and crop. The static mobile image or desktop canvas receives that exact height; initialization must not resize the outer figure or move the country figures below it. At standard text sizes, keep the reserved band within 10px of the rendered visual at the tested responsive sizes, without clipping the map or adding a large blank area. From 768px, copy and figure share a grid row: the copy stays at its existing top/right alignment, and its intrinsic height plus 24px of clearance can enlarge the row for text-only zoom without overlapping the country figures.

**Brand metadata.** Organization structured data uses the reviewed mark at `/fiscal-ge-logo.svg` with its intrinsic 520×650 dimensions. App Router owns `favicon.ico`, `icon.svg`, and `apple-icon.png`. The generated 1200×630 social image combines the horizontal lockup with the reversed mark; it is the site sharing image, not a hero asset.

**Country figures.** Three maintained snapshots remain in one row: `მოსახლეობა` — `3.9 მლნ`, `2026 წლის 1 იანვარი · საქსტატი`; `ფართობი` — `69.7 ათ. კმ²`, `საქართველოს ტერიტორია`; `ეკონომიკის ზომა` — `104.6 მლრდ ₾`, `ნომინალური მშპ · 2025, წინასწარი`. A narrow mobile caption may shorten visually, but assistive technology retains the full caption.

**Four-dataset row** (owner decision D3, 2026-10-07). Four text links to the hubs — `ბიუჯეტი`, `ეკონომიკა`, `ინფლაცია`, `უმუშევრობა` — each with one latest figure computed from served facts (spending total, nominal GDP, annual inflation, unemployment rate) as `{measure} · {period}: {value}`. Two columns below 768px, four from 768px. It is a row of links with no graphic, so it does not reintroduce the excluded post-hero graphics or the old three-path card below.

**Annual data ledger.** `#data` has no top rule, annual masthead, shared-year label, or reserved masthead spacing. The expenditure, revenue, and municipality ledger sections contain, in order: decorative index; dataset overline; question-led H2; concise latest-year description; real explorer link; an applicable total between two strong ink rules; latest year and truthful actual/planned/mixed status; and a semantic table of exactly four latest-year rows with amount and share. The first dataset section has no ordinary top border, avoiding a doubled rule; later sections retain their hairline top borders. Government Debt and deficit follow the same index/copy/data grid but use compact metric layouts suited to their measures instead of forcing them into the four-row budget table. There is no post-hero graphic, chart, map, canvas, SVG data visualization, prior-year comparison, change callout, old three-path card, About block, Excel preview, or separate methodology promotion.

The exact dataset contracts are:

1. `სახელმწიფო ხარჯები`; H2 `როგორ იხარჯება საქართველოს ბიუჯეტი`; total `მთლიანი ხარჯი`; first column `სფერო`; `ხარჯების მონაცემები →` → `/explorer/expenditure`.
2. `ნაერთი ბიუჯეტის შემოსულობები`; H2 `როგორ ფინანსდება საქართველოს ბიუჯეტი`; total `მთლიანი შემოსულობები`; first column `მუხლი`; `შემოსავლების მონაცემები →` → `/explorer/revenue`.
3. `მუნიციპალური ბიუჯეტები`; H2 `როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები`; total `საქართველოს მუნიციპალური ჯამი`; first column `უდიდესი მუნიციპალური ბიუჯეტები`; `მუნიციპალური მონაცემები →` → `/explorer/municipalities`.
4. `სახელმწიფო ვალი`; H2 `რამდენია საქართველოს მთავრობის ვალი`; latest actual total Government Debt stock plus its domestic and external amounts and shares; `ვალის მონაცემები →` → `/explorer/debt`.
5. `ზოგადი მთავრობის დეფიციტი`; H2 `რამდენია საქართველოს ბიუჯეტის დეფიციტი`; main label `დეფიციტი მშპ-სთან მიმართებით`; latest actual deficit as percent of GDP followed by the last three actual annual percentages; `დეფიციტის მონაცემები →` → `/explorer/deficit`.

National budget sections apply actual-over-planned selection before deriving the latest year, applicable total, status, and descending top four; stable category ID breaks ties. Municipal latest year and denominator come from the reviewed `country.georgia` public-total fact, while the descending top four come from all eligible public municipality totals for that year; municipality code breaks ties. The municipal total is never the sum of the four displayed rows. Debt uses the latest actual stock year and its explicit total, domestic, and external series. Deficit uses the latest actual observation and never promotes a projection into the homepage headline. All labels come from the reviewed glossary, municipality registry, or fixed public debt/deficit taxonomy; amounts use `formatAmount` and shares use the one-decimal `formatShare` contract.

**Methodology and footer.** The sixth section is index `06`, H2 `მეთოდოლოგია და პირველწყაროები`, the introduction `თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს, კლასიფიკაციის წესსა და გადამოწმების შედეგს.`, and four steps: official-document preservation; classification and transformation rule; reconciliation and quality check; downloadable data. At desktop the heading, introduction, and `მეთოდოლოგიის ნახვა →` link stay together in the left copy column, with the four steps alone in the right column; below 850px the copy comes first and the steps follow in reading order. The link targets `/methodology`. The shared footer follows immediately with its approximately 150px compact lockup, the tagline `საქართველოს საჯარო ფინანსები და ეკონომიკა — ნათლად, გადამოწმებულად, ღიად.`, contact, and the navigation `ბიუჯეტი · ეკონომიკა · ინფლაცია · უმუშევრობა · მეთოდოლოგია · AI-კავშირი · მიზანი` (owner decision D3, 2026-10-07). Source/update and the CC BY 4.0 licence share one fine-print paragraph with no `მონაცემები` heading. Below 768px the links form a two-column grid of 44px rows and the footer's top margin is 40px. This footer anatomy applies wherever `SiteFooter` renders.

**Responsive contract.** At ≥850px, each ledger reads index → copy → data in three columns and the three budget tables align. Below 850px, every data section and the methodology section stack in DOM order; total and year remain on one row where space permits; the three country figures remain one compact row; tables and fiscal metrics stay inside their parent without horizontal scrolling. Below 768px, each country-stat unit occupies the second line of an equal-height value block so font loading cannot move the unit or stagger the captions. At ≤380px, side padding and type scale tighten, country-stat labels reserve two lines, and a 320px viewport must have `scrollWidth === clientWidth`.

Landing QA: verify exact copy, metadata, destination links, ordered H2s, data-derived total/year/status and four rows for each budget dataset, the latest actual debt split, and the latest actual deficit plus its three-year actual history; verify a static-only hero with no WebGL request below 768px and one canvas or fallback from 768px; verify the absence of old paths/About/promo and all post-hero SVG/canvas graphics; at desktop, 390px, and 320px verify one-row figures, strong total rules, consistent ledger rhythm, semantic tables, unit wrap, content containment, and zero document overflow.

## 20. Municipal Surfaces

Reference implementation: `apps/web/components/municipalities/`, routes under `apps/web/app/explorer/municipalities/`. The section reuses the shell (§6.7) and the existing explorer machinery — `EditorialLineChart`, `RangeStrip`, `Callout`, `SourceNote`, `SwatchBar` — rather than inventing new surface types; `municipality-map.tsx` is the dedicated static SVG map component.

**Municipality-grain static SVG map.** The index choropleth renders a deterministic, vendored OpenStreetMap snapshot as 60 municipality polygons plus five green city markers: Tbilisi `04`, Batumi `06`, Kutaisi `20`, Poti `32`, and Rustavi `48`. Codes `06`, `20`, `32`, and `48` are marker-only; Tbilisi `04` is the sole polygon-plus-marker duplicate; the union is exactly the 64 publicly served municipality codes. Each polygon or marker resolves its internal numeric code through the explicit route registry and opens `/explorer/municipalities/[slug]` on a mouse click or keyboard activation. On touch (owner decision D7, 2026-10-07) the first tap selects and highlights the municipality and shows a one-line in-flow strip directly under the map — `{name} · {budget per resident} ერთ მოსახლეზე →`, a real link at least 44px tall; a second tap on the same place, or the strip, opens the page. Map targets whose longer side is under 24px on a 350px-wide map, and the five city markers, get invisible touch disks up to 32px across, sized so that two small neighbours' disks never overlap; the disks respond only to coarse pointers and are hidden from assistive technology. The map is **one tab stop**, not 65: targets carry a roving `tabindex`, so Tab enters the group and arrow keys (plus Home/End) move within it — the ranked list below is reachable without traversing the whole map. Tbilisi resolves to a single accessible target: the green marker is the encoding the legend names, so the `04` polygon stays drawn and pointer-interactive, co-highlighting with its marker and opening the same page on click, but is `aria-hidden` and unfocusable. That leaves **64 map targets**, one per served municipality, each announced once. The six-step terracotta ramp is quantile-classed by 2025 budget per resident, using the reviewed 1 January 2025 Geostat population denominator. Legend endpoints use whole-GEL budget per resident; the minimum and maximum stay on one row at the ramp's two ends, and the ramp narrows on phones. Each target's accessible name includes budget per resident and total budget. The map carries no separate heading or floating data popup — the legend and the SVG's accessible name state the measure, and the ranked list and index source note retain the values, measure and year. Pointer and keyboard activity synchronizes the exact municipality between map and ranked list; switching to the Regions list leaves the map at municipality grain and region rows remain inert toward map highlighting.

**Index list hierarchy.** Municipality and region rows remain ranked and sorted by displayed total budget; rank numbers, bars, and primary formatted amounts all continue to use that total. A smaller whole-GEL budget-per-resident line is supporting context only, labelled `ერთ მოსახლეზე` — the one per-resident term site-wide (map strip, list and legend alike). Region values divide the displayed region total by the summed 2025 population of member municipalities, so Adjara uses its consolidated numerator. The Georgia row remains first on the Regions tab and has no per-resident value because its numerator contains five aggregate-only budgets with no territorial population assignment. Both existing tab panels are server-rendered so the Georgia and 11 region destinations remain ordinary crawlable links in the initial HTML; the inactive Regions panel uses the native `hidden` state, so the default municipality view and tab interaction are visually unchanged. The KPI strip reports the median of the 64 municipality-level 2025 per-resident values. Below 768px the ranked list has no inner scroll height; the page scrolls it.

**Index source note.** The index closes with the standard `SourceNote` (§7.10), like every other data surface: it names the Ministry of Finance as the source, states that the map encodes budget per resident for 2025, and explains the 64-vs-69 split — the map and list cover the 64 served municipalities while the pinned `საქართველო` row is the 69-unit roll-up plus Adjara republican payments, which is why the region rows do not sum to it. Its review date comes from `latestReviewedAtForMunicipalFacts`. This is the note, not a methodology link: per §21 the methodology route reaches these pages through the footer only.

**Search surfaces answer.** All three — the series panel, the index list, and the entity picker — respond to a non-matching query rather than going blank. The picker renders the index's own empty state after its empty listbox (`ვერაფერი მოიძებნა` as a live status plus a `ძებნის გასუფთავება` button); before this it collapsed to a 0-height listbox with no options, no count, and no way to clear the query except selecting the text. A forward Tab from the combobox reaches that button, Enter clears the query and returns focus to the combobox, and the next forward Tab closes the non-modal picker and continues through the page.

**Entity summary.** Every municipality and region route renders a concise, server-derived Georgian summary after the range/source note and before `ძირითადი ინდიკატორები`; the chart keeps its existing starting position. Municipality summaries name the latest reviewed total, rank out of 64, largest latest-year function, and its share of the public total. Ordinary region summaries use the parallel rank-out-of-11 and function facts. Adjara instead names the six municipalities plus the net republican budget because its functional rows cover only the municipal portion. The summary always prints its year explicitly and does not change when the reader narrows the interactive chart range. Municipality and region pages keep their previous/next links; below 768px each is a 44px-tall target.

The two reviewed occupied-area overlays render above the municipality fills as pale, non-interactive SVG paths with no public label, tooltip, link, keyboard focus, map text, or legend entry. The source note links `© OpenStreetMap contributors` to `https://www.openstreetmap.org/copyright` and states `ODbL` without adding occupied-territory wording. Natural Earth overlay provenance remains repository documentation because that source is public domain. Codes `05`, `42`, `43`, `46`, and `64` remain excluded from the public registry, standalone facts, regional aggregates, rankings, picker/list/map/member rows, and standalone Excel values. Their raw budgets belong to Georgian municipal bodies operating outside those territories and serving displaced communities, so they are not territorially attributable spending inside the named municipalities; they appear only inside the dedicated Georgia aggregate. Full geometry and licence provenance is documented in `docs/data-methodology/municipal-functional-annual-2015-2025.md`; the approved behavior is specified in `docs/superpowers/specs/2026-08-07-municipality-map-upgrade-design.md`.

**Georgia aggregate.** `/explorer/municipalities/georgia` reuses the municipal chart, table, `% წილი`, range, selector, comparisons, movers, and Excel surfaces over the 69-series country aggregate plus Adjara republican actual payments net of transfers to territorial budgets. In the index's `რეგიონები` tab, `საქართველო` is pinned before the 11 value-ranked region rows; in the entity picker it is the first option, before all regions and municipalities. The exact H1 is `როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები`, with `საქართველოს მუნიციპალიტეტები` as the picker trigger. The country page states `69 მუნიციპალური საბიუჯეტო ერთეული + აჭარის ა.რ.`, derives `2015–2025` from loaded facts, selects only `მთლიანი ბიუჯეტი` by default, and has no fake rank, map, member list, or previous/next navigation.

The Georgia page's total and function rows are dedicated `country.georgia` facts, not a synthetic municipality. Countrywide totals and municipality/region shares use the adjusted country denominator. Municipality and region ranks remain 64/11. The 11 region rows do not reconcile to the Georgia row because codes `05`, `42`, `43`, `46`, and `64` have no territorial region assignment and are included only in the country aggregate; both the index and country source notes explain this boundary. Adjara remains one region, not an extra republic entity.

**One public total.** `მთლიანი ბიუჯეტი` uses `public_total_gel` in the selector, chart, table, KPIs, comparisons, percentage denominator, and Excel total row. For Adjara and Georgia this is the consolidated total. The ten functions remain unchanged and municipality-classified only; their shares can sum below or above 100%. No residual category, proportional republic allocation, or reconciliation warning appears in the explorer. The Georgia workbook uses the public entity label `საქართველო` and contains only the country total and ten country-level functions for each year; it never exposes the internal identifier `country.georgia`, a standalone value or selectable entity for an aggregate-only code, or an Adjara republic entity. Its `წყაროები` sheet may cite the underlying official originals, including those five aggregate-only bodies, solely as provenance rather than public data rows.

**Unit: `მლნ ₾`, not `მლრდ ₾`.** Municipal budgets run one to three orders of magnitude below the national totals the rest of the explorer charts in billions; a billions axis would hide most municipal functions after rounding. The municipal chart and table pass `UNIT_MLN` (`lib/explorer/format.ts` — whole million GEL) to the same `EditorialLineChart`/`ExplorerTable` the budget explorer passes `UNIT_BN` to. KPI values, list rows, and the entity picker use `formatAmount`, which already auto-selects `მლნ ₾` below ~1bn GEL on its own.

## 21. Methodology Surfaces

Approved visual and behavioral specification: `docs/superpowers/specs/2026-08-11-methodology-portal-design.md`. Approved preview: `design-shotgun/methodology-portal-2026-08-11/variant-d.html` (Editorial Fieldbook).

The public structure is `/methodology` plus live category pages for expenditure, revenue, municipalities, Government Debt, GDP, national economic sectors, regional economies, and inflation. Methodology is not a top-header item. Discovery comes from the numbered landing methodology section and the retained site-footer link; since every `/explorer` route renders `SiteFooter` too (§6.7), the footer path is available on the data surfaces as well. Explorer and about pages do not repeat methodology promotions, contextual links, or long introductory SEO copy inside their analytical content: the footer link sits below the content rather than inside it.

Methodology surfaces reuse this document's paper, ink-rule, typography, radius, shadow, and accessibility contracts. The hub uses rule-separated dataset rows rather than cards; below 768px each row's arrow shares the title line. Category pages use layered, curated public explanation, an explicit official-versus-Fiscal.ge disclosure, sticky contents, a four-step source-to-data journey, and a searchable archive of untouched upstream originals. Below 1100px, where the contents list is not sticky, a small `სარჩევი ↑` / `Contents ↑` link — a bordered paper button with no shadow — stays at the bottom of the screen while the article scrolls and jumps back to the list. Complete canonical decisions and retrieval/hash provenance remain internal records and downloadable manifest integrity data. Future datasets are non-clickable `მალე` markers only; the upcoming one is named `დემოგრაფია`, as in the sidebar (§6.7).

The approved public visibility is dataset-specific: expenditure hides its historical-decision group; revenue hides its validation group, technical appendix, and later classification, validation, and limitations sections; municipalities hide the full decision record, appendix, and later classification, validation, and limitations sections; Government Debt uses only concise scope, source, limitation, and archive sections. Archive tables visibly show `Year | Original source/file | Format | Size | Download`. Below 760px the year filter wraps onto more rows (no sideways scroll) and each source is a stacked block (year · title · file name · publisher) with a full-width download link at least 44px tall showing format and size. The archive search uses the §7.7 placeholder `ძებნა`.

## 22. Not-found Recovery

Unknown HTML routes retain their HTTP 404 status and use a minimal editorial recovery surface. It uses the existing paper, ink, body, muted, tint, and accent-focus tokens: a compact Fiscal.ge identifier, one Georgian H1, a short explanation, and ordinary visible links to the homepage, the four dataset hubs (`ბიუჯეტი`, `ეკონომიკა`, `ინფლაცია`, `უმუშევრობა`) and methodology; the English page mirrors them. Below 768px it has no top spacer. It does not load data, reuse the application shell, add an illustration, or introduce a separate visual system.

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

Economy is a peer below Budget in the explorer sidebar. Its hub reuses the budget cards and links to three live sections. GDP overview reuses the existing chart, table, range strip, text tabs and Excel button. The four indicator tabs are centred, wrapping `TextTab`s across the workspace (Real GDP, Nominal GDP, GDP growth, GDP per capita). Nominal measures have GEL/USD pills in the chart toolbar at the share-control position. There is no right-side display/series panel, new chart renderer or additional KPI system. Under the H1 sits a one-line latest value for the active indicator — `{indicator} · {year}: {value}[ · წინასწარი]` (owner decision D2, 2026-10-07) — then the unit line; heading, tabs and chart panel sit on compact spacing (16px under the unit line, 12px under the tabs) so the chart or table reads without scrolling. See `docs/superpowers/specs/2026-09-10-gdp-overview-design.md`. Existing Budget components remain authoritative over previews.

The three live Economy hub cards use the same card anatomy: a 200×34 sparkline and a data-derived footer naming its measure and period. GDP overview traces real GDP and its footer states the latest nominal GDP (`{year} · ნომინალური მშპ {amount}`); Sectors traces the latest year's top three sectors' combined share of GDP using those same three sectors throughout the history; Regional economies traces the latest year's largest region's nominal GDP. The Sectors footer marks preliminary latest-year figures.

## 25. Inflation Surfaces

Inflation is the third dataset in the explorer sidebar (Budget, Economy, Inflation), with the same active-row, nested-section, collapse, keyboard and mobile behaviour. Its hub reuses the budget hub cards: `ინფლაციის მიმოხილვა`, `კატეგორიები`, `პროდუქტები` and `ქალაქები` are all live. There is no separate basket card. The collapsed rail reads `მონაცემები / ინფლაცია`.

The overview follows the GDP overview's header — the one-line latest value for the active indicator (D2) and the unit line under the H1, centred, wrapping `TextTab` indicator tabs directly above the workspace (`წლიური ინფლაცია`, `თვიური ინფლაცია`, `ფასების ინდექსი`) — over the Budget explorers' workspace: `ხაზი / ცხრილი`, chart or table, range strip, series panel with the download at its foot, source note. The series panel adds a reference row (the NBG target) with a dashed swatch; its chart line is dashed accent with no end dot, and it appears only on annual inflation. Inflation values are never coloured good/bad; rate changes are in percentage points. The header's coverage label (§6.2) states the active tab's months, since the index tab reaches further back than the change tabs.

Monthly axes: the line chart and range strip take a periods-per-year hint. Axis labels fall on calendar years (thinned to twelve); lattice columns group months at calendar boundaries under the 12px floor (§8.3); range chips are `5წ / 10წ / ყველა` counted in months (no one-year chip); arrows step a month, PageUp/PageDown a year. Year charts and strips render unchanged.

`ცხრილი` for monthly data is a years (newest first) × months grid with ExplorerTable's anatomy (§8.4), one series at a time (a `TextTab` picker when several are selected). Percentage tabs tint cells on a five-step scale — deflation blue `#DCE4F2`, then `#F1EADC`, `#EBCDBB`, `#D9967C`, and accent `#B3402A` with paper text — every pair ≥ 4.5:1; values are always printed and a legend names the bins. The index tab is untinted. Annual inflation adds a `წლის საშუალო` column (December 12-month average).

`ძირითადი ინდიკატორები` on this page shows the latest published month: the §8.5 hero (value, 3px gauge on a 0–15% scale against the target in force, dashed target mark, one sentence) and three side KPIs with sparklines (core inflation, monthly inflation, 12-month average). No movers board and no period comparison. See `docs/superpowers/specs/2026-09-11-inflation-overview-design.md`.

### 25.1 Categories

`კატეგორიები` is the second inflation section, at `/explorer/inflation/categories`. It repeats the overview's anatomy exactly — latest-value line (the annual headline, or the monthly one on the monthly tab) and unit line under the H1, centred, wrapping `TextTab`s, the same workspace, range strip, series panel and indicators — with three differences.

**Three tabs, landing on the third.** `წლიური ინფლაცია`, `თვიური ინფლაცია`, `წვლილი ინფლაციაში`. The rate tabs keep the order a reader knows from the overview, but the page lands on the contribution tab: the section exists for the decomposition. The three tabs have three coverages (2005-01, 2004-01, 2013-01) and the overview's range-transition rule handles them unchanged. The mode toggle reads `სვეტები / ცხრილი` on the contribution tab and `ხაზი / ცხრილი` on the rate tabs.

**A two-level series panel.** The ministries pattern: 12 division rows, each expanding to its subgroups, with the count line `ჯგუფები {selected} / 12 · ქვეჯგუფები {selectedSubgroups}` so a selected subgroup is never hidden by the division count. Every row carries its basket weight for the latest year, right-aligned in a quieter mono than the value; a row with no weight shows `—`, as does a category with no value on the active tab. All 12 divisions are selected by default — a deliberate, documented departure from the "only the total is selected by default" rule, since a stack of one series is meaningless. The selection is shared across all three tabs, so the departure covers the rate tabs too: this dataset has no total series to fall back to (55 rows = 12 divisions + 43 subgroups), and carrying the selection across a tab switch is what the overview does. Ticking a division clears its selected subgroups and vice versa — the two levels overlap, and summing both would show part of the basket twice while the residual quietly absorbed the duplicate.

**A stacked column chart** (`StackedColumnChart`), the only form in which "the parts add up to the published whole" is visible. Months on the x axis under the dot-lattice thinning rule (§8.3); percentage points on the y; positive segments stack up from a drawn ink zero line and negative segments down; the published headline runs over the stack as an ink line; the final segment is the residual `დანარჩენი` = published headline − Σ(selected contributions), so the stack closes exactly on the published figure at any selection. Columns are centred in equal bands (half-band inset) and axis numbers use the shared `en-US` grouping (`5,000`). Annual periods are laid out as years (year-rule labels, two lattice columns per year) and monthly periods by calendar boundary, so the same chart serves the annual unemployment context (§27). A visually-hidden list repeats each segment's latest value so the chart is never colour-only; the svg itself carries `role="img"`, which makes its children presentational, so per-segment `<title>`s would be unreadable and are not drawn.

**Category colour.** Twelve stable division colours from the editorial palette, keeping each concept's colour site-wide (§4.2) — health `#1F6E56`, education `#3D5A98`, transport `#C26E4C`, housing `#A5822B`, food `#B3402A`, alcohol and tobacco `#9C3D5E`, clothing `#7A4E8C`, furnishings `#8A7B65`, communication `#4A707A`, recreation `#4E5D74`, restaurants `#8C5A32`, miscellaneous `#2F4B3A` — with the residual on the existing neutral `#94856D`. Subgroups inherit their division's colour; because the residual absorbs everything unselected, a readable stack never needs 43 distinct colours.

The month grid gains contribution bins (`0 / 0.25 / 0.75 / 1.5` pp) on the same five-step tint scale, with a legend in `პპ`, and has no annual-average column: Geostat publishes no annual average per category. Below 768px its category tabs become a native select (at least 44px tall) with the same state and URL key `t`. The indicators block carries **four different measures, not one ranked four ways**: the hero is the largest contributor of the latest published month with its price change and basket share, then `ყველაზე გაძვირებული` (highest annual change, as a rate, contribution as detail), `ყველაზე გაიაფებული` (lowest annual change — relabelled `ყველაზე ნაკლებად გაძვირებული` when nothing fell), and `ინფლაციის სიგანე` (`10 / 12` divisions rising, sparkline of that count). Divisions only. A negative value is described as `გაიაფდა`, never coloured as good or bad. See `docs/superpowers/specs/2026-09-12-inflation-categories-design.md`.

### 25.2 Individual products

`პროდუქტები` is the third inflation section, at `/explorer/inflation/products`. It uses the existing editorial page header and two-column explorer workspace. The left column begins with the monthly-observation line chart in **annual inflation** mode, with the standard year range strip directly beneath it. A single 36px `TrendingUp` Lucide button in the chart heading switches to or from a Fiscal.ge-derived cumulative change; its accessible name and tooltip are localized, but the button carries no visible word. There is no separate annual button, monthly tab or chart/table switch. The right column contains the existing selector anatomy with icon-sized product cutouts, official names, latest annual values, bilingual search, Clear and an Excel action at the foot. On stacked layouts the selector list shows its top ten (plus any selected products) with the rest behind `მეტი პროდუქტი`; search covers all products. Products are sorted by the latest published annual rate, with missing rates last; right-panel search never changes selection totals or the lower list.

Below the workspace, the established one-hero-plus-three-side indicators show the last selected product's latest annual rate on the cohort min–max scale, that product's selected-years cumulative change, and the highest and lowest latest annual product rates across the whole current cohort. Names, exact periods and unavailable explanations remain visible. A “Browse products” heading and independent bilingual search precede the complete illustrated product table, without a dividing rule or row counter. The table places selected-years cumulative change before latest annual change and ranks matching products by the selected-range cumulative value, highest first, with incomplete histories last; it re-ranks when the selected years change. `More products` works within matching results. It is a semantic table, not a product-card grid. On phones, the workspace stacks chart then selector; the table scrolls within its own region without hiding either rate column (short column headers; the periods are stated in the visible table caption). Below 768px the rate columns are sized to their headers (normal tracking) and names are 12px, so whole words wrap with no mid-word break at 390px and wider. Object illustrations are small transparent cutouts beside names and never function as UI icons or data evidence. See `docs/superpowers/specs/2026-09-27-inflation-products-explorer-design.md`.

### 25.3 Cities

The section is a **Georgia page** at `/explorer/inflation/cities` and **one page per city** at `/explorer/inflation/cities/{tbilisi|kutaisi|batumi|gori|telavi|zugdidi}`. Both show annual inflation only (under the H1 the latest-value line for Georgia or the city total, then the unit line; no tabs) and repeat the overview's workspace, range strip, series panel, month grid, Excel action and indicators.

**Heading picker.** Both open with `ინფლაცია ქალაქებში — {place} ▾`, the place being the regions page's trigger (accent text, dashed accent underline, Lucide `ChevronDown`). It opens `CityPicker`, `RegionPicker`'s anatomy: search combobox, listbox, arrow keys and Enter, Escape or an outside click to close and refocus the trigger, the empty-search state and hint. `საქართველო` is first, styled as the "all" row; the six cities follow in Geostat's order; the current page is `aria-current`. City pages add `← {previous} · {next} →` on the right in the fixed order, wrapping, each link a 44px-tall target below 768px; the Georgia page has none. There is no category select anywhere in the section.

**Georgia page.** Seven lines on the total: `საქართველო` first in ink as the benchmark, then the six cities, all selected by default — an owner-approved departure from the "only the total" rule; the count reads `სერიები {selected} / 7`. Indicators: hero = the city with the highest annual rate with its distance from Georgia in `პპ`; `ყველაზე დაბალი`; `ქალაქებს შორის სხვაობა` (36-month sparkline); `ეროვნულზე მაღალი` (`{n} / 6`, sparkline). Georgia is never ranked.

**City page.** The city's `სულ` in ink plus the 12 divisions in the Categories page's colours; only `სულ` is selected by default (`სერიები 1 / 13`). Georgia's line is not drawn. Coverage follows the city (Zugdidi from December 2016). Indicators: hero = the city's total with Georgia's beside it; `ყველაზე გაძვირებული`, `ყველაზე ნაკლებად გაძვირებული` / `ყველაზე გაიაფებული`, `ინფლაციის სიგანე` (`{n} / 12`, sparkline), each division against Georgia's same division in `პპ`.

**Shared rules.** Every difference subtracts the printed one-decimal figures. The month grid shows `წლის საშუალო` for a total line only; Zugdidi's late start leaves empty cells, never filled values. One standing note under the source says some prices are recorded once and applied to every city.

**City colours** (§4.2): Tbilisi `#B3402A`, Kutaisi `#3D5A98`, Batumi `#1F6E56`, Gori `#A5822B`, Telavi `#7A4E8C`, Zugdidi `#4A707A`, each ≥ 3:1 against paper and tint.

See `docs/superpowers/specs/2026-09-26-inflation-cities-design.md` as amended by `docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md`.


## National economic sectors extension

Sector table labels wrap within a bounded sticky column, preserving full names and space for values on narrow screens. Below 768px every explorer table wraps its labels (§8.4); above it, this behavior is opt-in.

Below the complete sector workspace, show four end-year highlights in the **same hero-plus-three-side-KPIs composition as Budget and municipality detail indicators** (§7.11–7.12): `1.35fr | 1fr` above the 1100px content breakpoint, stacked below it, not four equal columns or boxed cards. Largest nominal sector is the left hero (62px/44px numeral with a smaller GEL unit), with its GDP-share gauge and full sector name. The right column has a hairline divider, three stacked 24px figures, right-aligned details and existing 64×16 Sparklines: highest real annual growth, largest decline (slowest growth if none decline), and top-three combined GDP share. The sparklines trace the selected year's winning sectors from the first available year through that year; the top-three trace retains those same three members historically. Missing years break lines; a single point draws no fake trend. Exclude GDP from rankings; use all activities, never checked rows. Expose selected year, annual real-growth scope, source, unavailable growth and preliminary status. Full names remain in accessible text; missing-data explanations wrap instead of hiding the first available year. No movers board or period-comparison section is added.

Display name: `სექტორები` / `Sectors` on the page, Economy card, sidebar and workbook title. Use concise explanations under the heading, with shared intrinsic height across the three measures so switching never shifts the chart; narrow screens may wrap without clipping text. Do not repeat `% მშპ-ში`, growth or GEL unit labels in a separate row under the line/table buttons. Preserve chart-axis units, table caption units and standalone row values. Rank the selector, table and workbook rows by the active measure's value in the selected final year, descending; keep GDP first, missing values last and stable classification order for ties. Detailed accounting caveats remain in methodology, source notes and machine-readable definitions.

The Economy hub also links to national economic sectors. Reuse the existing editorial workspace, line chart, table, year strip, paper series panel and Excel action. Do not reproduce prototype styling or add top indicator tabs. A compact joined toolbar control switches nominal GEL, share of GDP and real growth. Only Total GDP is selected initially; it stays first and removable. All 20 sectors are selectable without a selection limit. Search does not restrict bulk actions or counts. Nominal values display their unit explicitly; percentage measures retain signed values, and preliminary observations are marked in charts, tables and workbooks. Coverage and range bounds come from the active measure's facts. Regional sectors are not part of this page. Bounded decisions: `docs/superpowers/specs/2026-09-11-economic-sectors-design.md`.

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

The Economy hub links to `/explorer/economy/regions`. Its index uses 11 region-level SVG boundaries and a value-ranked list; both open ordinary region links. Municipality boundaries and city markers are not drawn on this regional view. The map keeps the reviewed occupied-area overlays non-interactive and uses one keyboard stop per region with arrow-key movement. The index has no multi-region comparison chart. On touch (owner decision D7, 2026-10-07) the first tap on a region previews it in the same in-flow strip under the map as §20 (`{region} · {map value} →`), and a second tap or the strip opens the page; regions under 24px (Tbilisi) get a coarse-pointer touch disk. This applies to the Unemployment regions map too. The legend keeps its minimum and maximum on one row at the ramp's two ends; the ramp narrows on phones.

Region detail pages (Economy and Unemployment) show `← {previous} · {next} →` in the fixed region order beside the H1, as inflation city pages do (§25.3); below 768px each link is a 44px-tall target.

Each `/explorer/economy/regions/[id]` page reuses the editorial line chart, table, range strip, unlimited series panel, region picker, highlights and Excel action. Total regional GDP is first, selected by default and removable; all 20 NACE Rev. 2 activities are selectable. Activities wear the sector colours above; total regional GDP is ink. The joined measure control has exactly two choices: nominal GEL, shown with the literal `₾`, and share of that selected region's GDP, shown with Lucide `ChartPie`. There is no share of Georgia, real-growth, per-capita, USD, forecast or 2025 control.

Activity amounts are gross value added at basic prices. The share denominator is the same region and year's complete GDP at market prices and never changes with series selection. Net product taxes explain why activity shares need not sum to 100%. The end-year highlights use all 20 activities independently of chart selection. Georgian and English pages, three-sheet Excel workbooks, methodology originals, Dataset JSON-LD, the read-only query tool and central JSON/CSV files all carry the same 2010–2024 boundary. Bounded decisions: `docs/superpowers/specs/2026-09-13-regional-economies-design.md`.

## 27. Annual unemployment explorer

The age-page amendment approved on 2026-10-07 keeps its native indicator dropdown with all eight existing measures. Group options into rates (%) and counts (thousand persons). Following the user’s visual feedback, keep the original compact, underlined native select and label, without a boxed control, custom chevron or explanatory text beneath it. The Indicator label is screen-reader-only on the age page, and the survey/classification note above its workspace is omitted, as requested. The age page, hub coverage, saved ranges, tables and exports start in 2020 and contain only the eleven modern age groups; the national row and headline are removed. Age labels stay in chronological order, and the youngest available group (15–19) and the first prime-age group (25–29) are selected initially (owner decision D9, 2026-10-07). Explicitly empty selections remain empty; obsolete shared selections restore that pair.

Below the age workspace, show a semantic HTML heatmap table for all ages, independent of chart selection, using the active indicator and years. Print one-decimal values with percent or thousand-person units and preserve missing cells as dashes. A single sequential terracotta scale of six equal-width bins from zero to the maximum of all shown values, using the map ramp (paper tint to the full accent), applies to every cell. The five lighter bins carry ink text and the darkest (full accent) bin carries paper text; every pairing is at least 4.5:1. At narrow widths, contain horizontal scrolling within the table, open it scrolled to the newest year, keep age labels visible and allow keyboard scrolling. The heatmap remains visible in table mode or with no chart series selected. It adds no new chart library.

The region name is an accent-coloured, dashed-underlined button inside the region page's H1, matching Economy's regional heading. Clicking it opens the reused region picker. There is no separate region-name dropdown beneath the title. This presentation was approved on 2026-10-06.

The Regions sidebar item stays active on its index and detail pages. Historical comparison instructions describe indicator and group selection rather than the index map. Wrapped Georgian series labels shrink and break within their column, keeping a gap before values. Shared Economy/Unemployment region maps track pointer and keyboard focus independently; leaving the map with the pointer restores the focused region's map/list highlight.

The regional amendment approved on 2026-10-06 reuses Economy's map/list workspace at `/explorer/unemployment/regions`: eleven linked region outlines, reviewed non-interactive occupied overlays, six sequential colour buckets, synchronized hover/focus, arrow-key movement, bilingual search and a rate-ranked list. Both map and list open a region's separate static page. Map values, legend and accessible labels are unemployment percentages for the latest source year. Summary figures show published-region count, national unemployment rate and available period. A supporting comparison link retains the historical combined groups and former shared settings.

Region detail pages use the overview's indicator checkbox panel, line chart, table, range strip and Excel action, plus Economy's region picker and previous/next links (§26). The indicator dropdown is removed from regional detail and comparison views. Only the selected region's unemployment rate is initially selected; it remains first, selectable and removable. Nine source-supported indicators are available, omitting employment rate. Hired and self-employed counts expand beneath Employed, matching the overview, and cover 2020–2025. A note explains that coverage and the small unclassified remainder. Selecting the parent with either child preserves the parent's longer history with gaps for unavailable child values; selecting only children fits to their published years. Percentage/count selection and bulk actions follow the overview rules. The title identifies the region, coverage comes from its own observations and the source note explains earlier combined groups. No combined observations are assigned to modern-region history. The regional comparison retains country and historic group identities behind index hash links. Age groups keep their existing controls; Gender follows the amendment below.

The bounded 2026-10-04 design, with navigation amended on 2026-10-05 and overview selection amended on 2026-10-06, reuses the budget hub cards and economic-sectors workspace. The hub at `/explorer/unemployment` presents four cards, in order: Unemployment overview, Regions, Age groups and Gender; they link to `/overview`, `/regions`, `/age` and `/gender` under that hub. The sidebar repeats this order. Titles, descriptions and coverage belong to each page; card figures and years come from served facts. Only the overview card uses the national unemployment-rate sparkline. The other cards show their source-derived annual coverage without implying a single regional, age or gender aggregate.

All four pages reuse the existing line chart, table, RangeStrip, series selector and Excel action. Each page fixes its own main comparison, replacing the former seven-option breakdown selector. The unemployment overview alone has centred, wrapping editorial text tabs: Overview, Urban/rural, Education and Long-term unemployment. Its indicator dropdown is removed: the national list contains indicator checkboxes, with self-employed and hired employees beneath Employed people. Employment rate is omitted. Urban and rural parents select their own unemployment rate; other indicators are children, including the same employment subcategories. Long-term indicator parents select Georgia, with only Men/Women as children. Education has unemployment rate only and retains the existing Total/Women/Men segmented tabs above search. Selecting a percentage clears all people counts and selecting a people count clears all percentages; ticking a series in the other unit shows a one-line status notice at the top of the list naming what was cleared, and the next same-unit tick or the bulk toggle removes it. Multiple series with the same unit remain unlimited. Bulk selection uses the current unit: the denominator and bulk action cover the top-level rows of that unit, ticked rows under a caret show as `ქვეკატეგორიები N`, and when every row of the unit is nested (people counts on sex/settlement) those rows are the scope. Search never scopes it. Age groups retain their single-indicator dropdown and their own default pair (above). Elsewhere, except for Gender's Men/Women default (below), only the applicable unemployment-rate reference is selected by default; it remains pinned, selectable and removable. URL settings and language changes preserve the indicators, supporting tab, education sex, years, selection and view. Changed coverage is fitted to loaded years and announced accessibly. Former single-explorer links migrate to the matching page; removed metrics normalize to unemployment rate and mixed-unit links keep the last valid selected unit. A page's hash cannot switch it into another main section.

The national overview header keeps its fixed title and subtitle across all four tabs, followed by the one-line latest value described in the GDP overview extension, for the active indicator (owner decision D2, 2026-10-07). Every unemployment page carries the same line: the active indicator for Georgia, or for the region on a region page; the age page names its first selected group. The survey/breakdown note stays omitted from the overview header; the source note and methodology link remain below the chart.

The Gender amendment requested on 2026-10-07 removes its indicator dropdown and former single-indicator headline; the page keeps only the shared latest-value line described below. Men and Women select their own unemployment rate and expand to the other seven existing indicators, including employment rate, following the Urban/rural panel. The national unemployment-rate reference remains first and selectable; Men and Women unemployment rates are selected with it by default (owner decision D9, 2026-10-07). Links carrying their own indicator or selection keep their meaning, and the default never writes to a pristine URL. The existing checkbox panel keeps percentages and people counts separate, with search-independent bulk selection, complete group/indicator labels in charts, tables and Excel exports, and saved selections preserved across language changes. This amendment adds no data or employment-status estimates.

The national context below the workspace appears only on the national overview's Overview tab and uses the existing stacked-column chart for employed, unemployed and outside-labour-force counts. It uses exact national source values over the active years, with one-decimal display, independently of the main selected groups. Survey-estimate limitations and original-source methodology remain visible. No paired-dot plot, scatterplot or new chart library belongs to this version. The age heatmap below is the approved exception. The authoritative scope is `Project_Definition.md` §2D; bounded decisions are in `docs/superpowers/specs/2026-10-04-unemployment-reuse-explorer-design.md`.
