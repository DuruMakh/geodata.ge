# GeoData.ge Design System — Editorial

Version: 4.1
Last updated: 2026-08-07
Status: Production visual system for GeoData.ge Budget Explorer v1
Scope: Budget Explorer product UI, charts, tables, controls, export surfaces, responsive behavior, and future pages that reuse the Budget Explorer shell.

---

## 1. Source of Truth

This file defines the production design system for GeoData.ge v1. It **replaces DESIGN.md v3.x (the Apple-like Light/Night system) in full**. The editorial direction is the approved production direction.

`DESIGN.md` v4.1 is the canonical visual and behavioral source of truth. The earlier `editorial-v2` HTML prototype package was intentionally removed as superseded in 2026-08. Retained concept files under `docs/Design HTML files/` are contextual inputs only unless a current product spec explicitly promotes them; they do not override this file or current route contracts.

Confirmed product references:

- `Project_Definition.md`

This file owns production visuals. Current product specs may record deliberate feature-level carve-outs, which must be reflected here when they become durable; the platform shell and route IA are specified in §6.2/§6.7 and `docs/superpowers/specs/2026-07-28-explorer-shell-and-workspace-design.md`.

Superseded and must not appear in production:

- The Apple-like Light/Night system (DESIGN.md v3.x), including `#0071e3` primary, card/shadow surfaces, 24px radii, gradient headline cards, the SF Pro stack, the theme toggle, and the iOS view switch.
- Crypto/terminal, neon, and marketing-homepage directions.

## 2. Product Scope Boundary

GeoData.ge v1 is a Georgian-first national budget explorer for annual data. It is not a broad public-data catalog.

V1 includes: the budget hub, multi-year explorer (line + table) with fields/ministries grouping, single-year analysis view, CSV export, Georgian-first UI, minimal public source label, internal provenance metadata.

V1 excludes: data catalog, capital/debt explorers, admin UI, public API, uploads, sub-annual data, automated document extraction, clickable drilldown pages (series selection in the explorer is not drilldown).

Municipal budgets are an implemented v1 **section** in this branch at `/explorer/municipalities` (§2.1, §6.2, §20): an index with a municipality-grain map and ranked list, 64 municipality pages, and 11 region roll-up pages, reachable from the sidebar and hub card 03 (§6.7). Production verification follows merge and deployment; this branch state is not evidence that the map is live. The four teaser datasets in the sidebar (`უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა`, `დემოგრაფია`) remain markers only, with no data at all. Nothing about a marker may be styled as if it were live.

Every visual decision should support a focused budget product, not a generic dashboard.

### 2.1 Actual Data Coverage (data-driven, never hardcoded)

Year ranges in the UI always derive from loaded facts. Current reviewed coverage:

- Expenditure by public spending fields: **2005–2025** (13 fields per year, 12-month actual execution).
- Expenditure by ministries (administrative view): **2005–2025** categories; major-program drill-down rows exist from 2012 (partial) and are contiguous 2017–2025.
- Revenue: **2005–2025** (11 top-level categories).
- Municipal expenditure by functional category: **2015–2025** (10 main functions, 64 municipalities across 11 data-bearing regions, plus the official total-payments headline). Five municipal bodies associated with occupied territories are excluded from the public dataset. Implemented in this branch at `/explorer/municipalities` (§20); production deployment remains unverified as described above.
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
  control: "#C9BEA9"      # control borders (checkbox, pill, search underline)
  accent: "#B3402A"       # terracotta: active states, focus, negative values
  positive: "#1F6E56"     # positive change
  negative: "#B3402A"     # negative change (shared with accent by design)
```

Rules:

- `paper` is the only background for the landing page and the explorer content column. Never introduce white panels.
- **Exception: the explorer sidebar** (`ink` background, §6.7) — a persistent navigation shell beside the content column, not a panel within it. This does not generalize: `paper` remains the only background for every panel, block, or surface inside the content column.
- Selection/hover emphasis is always `tint`, never shadow or border color change.
- `tile` is reserved for tooltips, treemap tiles, and budget hub cards (§6.6).
- The two `ink-fg-*` tokens exist only on the `ink` shell surface (§6.7); never use them on paper. **These lines are the single definition of both hex values** — §16 mirrors the paper tokens only, so a value change is one edit here plus one in `apps/web/app/globals.css`.
- Both ink tokens clear WCAG AA on `ink`: `ink-fg-faint` measures **4.77:1** for the 8.5–9.5px text it carries (brand sub-line, `მონაცემები /` overline, rail label, `მალე` badge) and `ink-fg-muted` measures **6.34:1** for its 12–12.5px labels. They are a deliberate two-step hierarchy — an ~8.5 CIE L\* gap, so faint still reads dimmer than muted. Any future move has to keep **both** above 4.5:1 **and** that gap; raising one alone collapses the pair. (The pair was raised from `#7A7060` / `#8F8676`, where faint sat at 3.53:1.)
- The paper pair answers to the same floor: `faint` measures **4.52:1** on `paper` and **4.83:1** on `tile`, and `muted` **5.54:1** / **5.92:1**. `faint` is the dimmest paper tier, not decoration — it carries the page-header coverage line (10.5px), hub card footers (10px) and the `გეგმა` planned tag (9px), all small text, all owed 4.5:1. `tests/explorer/themeTokens.test.ts` asserts both, mirroring the ink-pair guard. (The token was darkened from `#A89C88`, which sat at 2.42:1. The paper two-step is necessarily tighter than the ink pair's — `muted` is itself only 5.54:1, so the L\* gap is ~5.6, not 8.5. Restoring a wider step means moving `muted` down first.)
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

Municipal functions (`municipal.*`) reuse the semantic colour of the same concept
on the budget side, so a category keeps one colour across the whole site:

| Function | Token | Shares with |
|---|---|---|
| `municipal.social_protection` | `#B3402A` | `spending.social_protection` |
| `municipal.health` | `#1F6E56` | `spending.health` |
| `municipal.education` | `#3D5A98` | `spending.education` |
| `municipal.housing_communal` | `#B08A2E` | `spending.infrastructure_regional_development` |
| `municipal.defence` | `#7A4E8C` | `spending.defence` |
| `municipal.public_order_safety` | `#4A707A` | `spending.public_order_safety` |
| `municipal.economic_affairs` | `#C26E4C` | `spending.economic_affairs` |
| `municipal.environment` | `#2F4B3A` | `spending.agriculture_environment` |
| `municipal.recreation_culture` | `#9C3D5E` | `spending.culture` |
| `municipal.general_public_services` | `#5B5347` | `spending.general_public_services` |

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
- Year ranges are one style everywhere: an **unspaced en dash** (`2005–2025`, U+2013). Not an em dash, not spaced. This covers the coverage label (§6.2), the source note (§7.10), and the range strip (§7.4).

## 6. Layout System

### 6.1 Page Shell

```yaml
page:
  background: paper
  maxWidth: "1240px"
  padding: "30px 28px 72px"   # mobile: "24px 20px 64px"
```

No screen card, no outer container. Content sits directly on paper.

**Exception: the explorer shell** (§6.7) — `/explorer` and its three sections use a sidebar + content-column layout instead, with different max-width and padding. This page shell applies to the landing page (§19) only.

### 6.2 Information Architecture

The landing lives at `/` (მთავარი — see §19). Everything else is the data platform: a budget hub and its sections, all mounted under `/explorer` inside the shell of §6.7.

```text
/explorer                              budget hub — the four sections as cards
/explorer/expenditure                  ხარჯები           multi-year expenditure explorer (fields/ministries grouping)
/explorer/revenue                      შემოსავლები       multi-year revenue explorer
/explorer/municipalities               მუნიციპალიტეტები  index — municipality-grain map, ranked list, KPIs (§20)
/explorer/municipalities/[code]                          64 municipality pages
/explorer/municipalities/region/[id]                     11 region roll-up pages
/explorer/analysis                     ანალიზი           single-year analysis view (own side switch, grouping switch
                                                          for expenditure, and year selector)
```

The section **is the route** — not React state, not a hash key. Sections are reached from the sidebar's nested list under `ბიუჯეტი` (§6.7) or from the hub cards; there are no in-page nav tabs. Section order is fixed and identical in both places: `ხარჯები`, `შემოსავლები`, `მუნიციპალიტეტები`, `ანალიზი`.

Every surface under `/explorer` opens with the **breadcrumb row** (§6.7): `მთავარი / მონაცემები / ბიუჯეტი` on the hub, `მთავარი / მონაცემები / ბიუჯეტი / <section>` on a section. Its right slot is a mono **coverage** label — `{minYear}–{maxYear} · განახლდა {YYYY-MM-DD}` for the route's active scope, not the user's selection (the range strip owns that, and the two facts live at different altitudes).

On the section routes, under the page title, sits the **deck line**: a mono lead value (latest-year total for the explorer, `year · N კატეგორია · სულ X` for analysis) plus a colored YoY delta and the phrase `წინა წელთან`. The hub has no deck line — it opens with the serif H1 `საქართველოს ბიუჯეტი` and a plain lead paragraph.

### 6.3 URL State (deep linking)

The section lives in the route (§6.2). Everything else about a screen serializes into the URL hash so any view is shareable:

```text
/explorer/expenditure#g=fields&m=line&sh=1&r=2005-2025&sel=id1,id2   (explorer sections)
/explorer/analysis#as=expenditure&ag=ministries&ay=2024              (analysis)
```

Keys: `g` grouping (expenditure only), `m` mode, `sh` share measure, `r` range, `sel` selection; `as` analysis side, `ag` analysis grouping, `ay` analysis year. The hash never carries `nav`.

Restore on load with validation (unknown values fall back to defaults; ranges clamp to loaded years).

Links shared before the route split still work: `/explorer#nav=expenditure|revenue|analysis` is honored once by a client component mounted on the hub, which reads the hash on mount and `router.replace`s to the matching route with `nav` stripped and the rest of the hash preserved.

The landing links into `/explorer` (hero CTA, card 01, card 03, footer) and `/explorer/analysis` (card 02, footer).

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

- Border radius: **0–3px everywhere** (buttons 2px, tooltip 3px). Exception: the `% წილი` measure pill and slider handles/ticks use `999px`.
- Shadows: only the chart tooltip (`0 4px 16px rgba(30,27,22,0.10)`) and slider handles (`0 1px 3px rgba(30,27,22,0.15)`). Nothing else casts a shadow.
- Swatches are **14×3px bars**, never dots or rounded squares.
- **Exception: budget hub cards** (`tile` bg, 1px `hairline` border, radius 0, hover `tint`, no shadow). Four peer destinations with no natural reading order are the one place containment beats rules — a rule stack implies a sequence that is not there. Cards remain forbidden everywhere else; this exception does not generalize to panels, KPI blocks, or any other surface.

### 6.7 Shell and Sidebar

Everything under `/explorer` renders inside a persistent shell: a dark sidebar on the left, the content column beside it (max-width 1180px, **centred** in the space left over, page padding `20px` / `34px` at ≥768px). Centring matters past ~1500px: left-aligned, the column strands the whole surplus as one blank margin on the right. Implementation: `apps/web/components/shell/`.

**Sidebar (expanded, ≥900px).** 232px, `ink` background, radius 0, sticky at `top: 0` with full viewport height so it holds while the long explorer page scrolls. Dividers on ink are `rgba(247,242,233,0.12)`; the active row background is `rgba(247,242,233,0.07)`.

- Brand block → `/`: serif `GeoData` in `paper`, mono `ღია მონაცემები` (8.5px, 0.1em) beneath in `ink-fg-faint`.
- `მონაცემები /` overline: mono 9.5px, 0.12em, `ink-fg-faint`.
- `ბიუჯეტი` — the active dataset: `2px accent` left border, active-row background, sans 12.5/600 in `paper`. Not a link; it is where you already are.
- Its four sections nest beneath it (below).
- `უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა`, `დემოგრაფია` — `ink-fg-muted` labels with a `მალე` badge (1px `#6C6860` border — **3.09:1** on `ink`, above the WCAG 1.4.11 3:1 floor for a component boundary — 2px radius, mono 9px, `ink-fg-faint`). Markers only: not links, not focusable, no route, no data.
- Foot, above a 1px divider: `← მთავარი`. No version string.
- Top-right: the collapse toggle — a 26px box, 1px `rgba(247,242,233,0.18)` border, mono glyph `«` (expanded) / `»` (collapsed).

**Section list** (`section-nav.tsx`, nested under `ბიუჯეტი`). Each entry is a route link. Active: accent `▸` marker, `paper` text at weight 600, active-row background, `aria-current="page"`. Inactive: `ink-fg-muted`, marker held in transparent so labels do not shift. All four sections — `ხარჯები`, `შემოსავლები`, `მუნიციპალიტეტები`, `ანალიზი` — render this way; none is a `მალე` marker. Deleting this one component and its single usage reverts navigation to hub-and-breadcrumb only; nothing else imports it.

**Collapsed rail (≥900px).** 52px, same `ink` surface, radius 0:

- The toggle stays in place at the top, glyph flipped to `»`.
- Below it, the context line runs vertically down the rail: `მონაცემები · ბიუჯეტი`, mono 9.5px, `ink-fg-faint`, 0.1em, via `writing-mode: vertical-rl` plus `rotate(180deg)` so it reads **bottom-to-top**. It carries the same two facts the expanded overline and active row carry, which is why the section list can disappear without losing orientation.
- At the foot, an 8×8 `accent` square is the collapsed `← მთავარი` link, with a 26×26 hit area, `aria-label="მთავარი"`, and a `title` tooltip.
- **Sections are not reachable while collapsed** — the list is unmounted, not hidden. A 52px rail cannot carry Georgian section names, and reducing them to invented initials would trade one extra click for three ambiguous glyphs. Collapse is a reading posture: it hands the width back to the data and keeps only orientation and escape.

Width transitions at `base` (§14) and snaps under `prefers-reduced-motion: reduce`. The choice persists in `localStorage` under `geodata:sidebar-collapsed`, read after mount; a storage denial falls back to expanded rather than breaking the render.

**Below 900px.** The sidebar becomes a full-width top bar (brand + toggle). The toggle opens the same nav as an **in-flow panel directly below the bar**: it is content-height, it pushes the page content down, and it has no backdrop. It is deliberately not the full-height sheet the design spec asked for — nothing is overlaid, so nothing needs covering. `Escape` closes it and hands focus back to the toggle. Expanded/collapsed is a **desktop-only** state: a persisted collapse preference is ignored below 900px rather than applied as an unexplained narrow rail, so the `«` glyph does double duty — collapse on desktop, close the panel on mobile.

**Accessibility, and the deviations on record.**

- The toggle exposes `aria-expanded` and a label that flips between `პანელის ჩაკეცვა` and `პანელის გაშლა`. It carries **no `aria-controls`**. On desktop the collapse unmounts the nav, so there is no element to point at; below 900px that is not true — the nav stays mounted and is merely `display:none` — so this is a real gap at mobile widths, not a fully justified omission. Closing it means giving the nav a stable id and keeping it mounted in both desktop states.
- There is **no focus trap** on the mobile panel, by decision. A trap is the contract for a modal that covers the page; this panel is in flow and obscures nothing, so trapping would strand keyboard users in a region they can simply tab past. `Escape` to close plus focus return to the trigger is the whole contract.

**Breadcrumb page header** (`page-header.tsx`). One row with a `2px ink` bottom rule, rendered per route (the final crumb differs per route, and a server layout cannot read the child route). Crumbs: sans 10.5px uppercase 600 in `muted`, current crumb in `ink`, separators `/` in accent. `მთავარი` links to `/`; `მონაცემები` is plain text with no route; `ბიუჯეტი` links to the hub on section routes and is plain text on the hub. Right slot: the mono 10.5px `faint` coverage label of §6.2 — the loaded range of the route's active scope, so it tracks the grouping, and the union of both sides on the hub.

**Budget hub (`/explorer`).** Breadcrumb, serif H1 `საქართველოს ბიუჯეტი`, lead paragraph, then four cards in a 2×2 grid (one column below 768px, max-width 860px), then the standard source note (§7.10). Card anatomy, in order: mono index in accent with `→` right-aligned, serif 18px title, 11.5px `muted` description, graphic, mono 10px `faint` footer.

| # | Card | Graphic | Footer | Links to |
|---|------|---------|--------|----------|
| 01 | `ხარჯები` | total expenditure series, `Sparkline` at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/expenditure` |
| 02 | `შემოსავლები` | total revenue series, same at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/revenue` |
| 03 | `მუნიციპალიტეტები` | total municipal series, `Sparkline` at 200×34 in `ink` | `{latestYear} · {total}` | `/explorer/municipalities` |
| 04 | `ანალიზი` | none | `{latestYear} · {n} კატეგორია` | `/explorer/analysis` |

All three sparklines are `ink` because each traces a **total** (a side total for cards 01/02, the municipal total for card 03), and §4.2 gives every `*.total` series `ink`. `accent` is not free chrome here: `#B3402A` is the token of `spending.social_protection` and `revenue.vat`, so an accent total would draw one quantity in another category's color.

Every figure on the hub — series, footers and card 03's description counts alike — is computed at build time from the same served facts the section pages use, so the hub cannot drift from the pages behind it. Nothing on it is hardcoded.

## 7. Core Components

Specs below are contracts; visual proof lives in the reference files.

### 7.1 Header / Nav

The landing header (§19) only — surfaces under `/explorer` use the sidebar of §6.7 and its breadcrumb page header instead, and have no nav tabs.

Baseline-aligned row: serif brand left (`GeoData`), nav tabs center, mono context label right; `2px ink` bottom rule. Nav tab: sans 13px; active = ink, weight 600, `2px accent` bottom border touching the header rule; inactive = muted, weight 500.

### 7.2a Mode Control

A segmented control, used **only** for `ხაზი / ცხრილი` in the chart controls row: inline-flex, 1px `control` border, 2px radius, overflow hidden. Segments are mono 10.5px with 0.04em tracking and `6px 13px` padding; the divider between them is the shared 1px `control` border. Active segment: `ink` background, `paper` text. Inactive: `muted` on transparent, hover `tint` + `ink`. The group has `role="group"` with a Georgian label; each segment keeps `aria-pressed`.

A boxed either/or switch is the honest affordance for choosing which view of the same data you are looking at. A filter is not that — do not box the tab groups of §7.2b.

### 7.2b Grouping Tabs

Text-only, sans 12.5px; active = ink 600 with `text-decoration: underline`, 2px thickness, accent color, `text-underline-offset: 4px`. No backgrounds. In the **explorer**, the grouping tabs (`სფეროები / უწყებები`, expenditure only) live in the series aside, directly under the `სერიები` header row (gap 18px, 12px padding-bottom, 1px `row-border` bottom rule). In the **analysis view**, the side tabs (`ხარჯები / შემოსავლები`) and grouping tabs use this same style, separated by a 1px×13px `control` vertical divider.

### 7.3 Measure Pill (% წილი)

Height 27px, pill radius, 1px `control` border, transparent bg, muted text. Active: ink bg, paper text, ink border, `aria-pressed`. This is the only pill in the system. Share = share of the side's total; there is no GDP measure.

### 7.4 Range Quick Chips (1წ / 5წ / 10წ / ყველა)

Mono 11px text links; active = ink 600 underlined (accent underline); inactive = muted 400. `5წ` shows only when >5 loaded years, `10წ` only when >10.

### 7.5 Range Slider

24px-high rail: 3px `hairline-soft` track, accent fill at 40% opacity between handles, 15px round handles (paper fill, 2px accent border, handle shadow). The rail is clean — no per-year tick dots. Handles are buttons with `role="slider"`, aria value attributes, and Arrow/Home/End keyboard support. Mono min/max year labels below.

### 7.6 Series Row (aside panel)

Row: 1px `row-border` bottom border; hover/selected bg `tint`; a 2px accent left rail marks expanded ministries and program rows. Toggle button (`aria-pressed`): 14px square checkbox (1.5px `control` border; checked = the row's series-colour fill + paper ✓), swatch bar shown for selected and unselected rows, sans 12.5/500 label clamped to 2 lines, latest value mono 11 muted right-aligned. Ministries rows add a caret button (`▸/▾`, `aria-expanded`) that expands the ministry's major programs; program rows are indented, sans 11.5/400 in `body` color. Program rows show names only — official program codes stay in the data layer (they fragment across reorganizations) and are not surfaced.

### 7.7 Search

The shared selector order is: optional grouping tabs, search, an action/status row, then the series list. The action/status row places `გასუფთავება` / `ყველას მონიშვნა` on the left and `სერიები {selected} / {all}` on the right. Search never scopes the count or bulk action; selection remains unlimited.

Underline-only input: h34, no box, 1px `control` bottom border, transparent bg, sans 13px, radius 0. Placeholder in ministries grouping: `ძებნა — უწყება ან პროგრამა`. A query with no matches shows `0 შედეგი — შეცვალე საძიებო ტექსტი.` While searching in ministries grouping, ministries with matching programs auto-expand to show only matching programs (their caret is locked open); a ministry matched by name still honors its caret and expands to all of its programs. The query is panel-local state and resets on ANY scope switch — nav (ხარჯები↔შემოსავლები) and grouping alike; typing must not re-render the chart.

### 7.8 CSV Button

CSV remains dataset-owned below the selector and is not part of the shared selector contract.

Full-width block, h38, ink bg, paper text, sans 12.5/600, radius 2px. Hover: opacity 0.85. Label: `CSV ჩამოტვირთვა`. Must export exactly the visible filtered dataset with the metadata columns of §15.

### 7.9 Callout / Notice

Tint bg, `2px accent` left border, sans 11.5–12.5px, `body` color, max-width 560px. Used for empty selection, no-growth-data, and load-error states.

### 7.10 Source Note

Sans 12px, muted, plain paragraph under the primary panel and at the end of the analysis view. Pattern:

```text
მონაცემები: გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები (საქართველოს ფინანსთა სამინისტრო). <coverage note> · 12-თვიანი ფაქტობრივი შესრულება. <classification note> ბოლო განახლება: YYYY-MM-DD.
```

Coverage notes state actual loaded ranges (e.g. `ხარჯვითი მონაცემები: 2005–2025`, `შემოსავლების მონაცემები: 2005–2025`).

The classification note is a required data-trust disclosure — year totals are official, but the category split is GeoData's own mapping and must say so on every expenditure surface:

- fields: `კატეგორიებად დაყოფა GeoData-ის კლასიფიკაციაა ოფიციალური ფუნქციური (COFOG) კოდების მიხედვით.`
- ministries: `უწყებრივი დაჯგუფება GeoData-ისაა ბიუჯეტის შესრულების ანგარიშების პროგრამული კლასიფიკაციის მიხედვით.`
- revenue: none (revenue categories are the official budget-classification lines).

### 7.11 KPI Block

No card: overline label, serif value, muted detail line. Two variants: analysis headlines (serif 34, four per row) and indicators side KPIs (serif 24, stacked with `hairline-soft` separators, value left / detail right on one baseline).

**Sparkline.** Every side KPI carries one, left-aligned under the value/detail row with a 6px top margin. Pure SVG, no client state, safe from a server component (`components/ui/sparkline.tsx`).

- 64×16 by default, 1.2px stroke with round caps and joins, 1px inset so the stroke never clips. No axis, no end dot, no fill.
- The domain is the min/max of the non-null values; an all-equal series draws a flat mid line rather than pinning to an edge.
- Nulls split the polyline into segments and are **never bridged**, matching the chart rule of §8.3. Fewer than two non-null points renders nothing rather than a misleading flat line.
- `aria-hidden`: the KPI value and detail line already carry the meaning, and a 64px decoration has nothing to add to a screen reader.

| KPI | Series plotted | Color |
|-----|----------------|-------|
| `ყველაზე დიდი ზრდა` | that row's values across the selected period | its category color |
| `ყველაზე ნელი ზრდა` | that row's values across the selected period | its category color |
| `ყველაზე დიდი წილი` | that row's **share of the year total** | `accent` |

The third is deliberately a different metric: the KPI states a percentage, so the sparkline traces that percentage — which is also why it reads jagged next to two smooth level lines. Years where either side is null, or the total is zero, produce a null point. The hero KPI (§7.12) keeps its gauge and gets no sparkline. The same component draws the hub graphics at 200×34 (§6.7).

### 7.12 Hero KPI (indicators)

The first indicator (`პერიოდის ცვლილება`) is a hero block: overline, serif 62px value (accent-negative if the period change is negative), then a 3px two-segment gauge (ink = base year total share, accent = delta), mono `year · amount` labels at both ends, and an editorial sentence with mono-set delta and CAGR values:

```text
2005–2025 წლებში ჯამური ხარჯები გაიზარდა X მლრდ ₾-ით — საშუალო წლიური ზრდა +Y%.
```

### 7.13 Mover Row

Grid `24px 1fr 96px 72px`: mono rank (`01`), sans label (ellipsized), 3px horizontal bar (track `hairline-soft`, fill positive/negative color, width relative to max |change|), mono % right-aligned. Board = two columns: `ყველაზე მზარდი` / `ყველაზე ნელი ზრდა`. If a "bottom mover" is still positive growth, the copy stays `ყველაზე ნელი ზრდა` — never call growth a loss.

## 8. Multi-Year Explorer

Canonical contract: this section and the reusable component contracts in §7.

### 8.1 Defaults

Side: expenditure. Grouping: fields. Mode: line. Measure: nominal GEL. Range: full available per scope. Selection: **the applicable total only** per scope (fields, ministries, revenue, municipalities, and regions each keep their own selection and range). The total is first, ink-coloured, selectable, and removable. Series selection is unlimited; search filters visible rows only and never scopes the count or bulk action.

### 8.2 Layout

```yaml
workspace:
  display: grid
  columns: "minmax(0,1fr) 292px"   # <1100px: one column, aside below with 2px ink top rule
  gap: "40px"
```

Left: segmented control + unit note + measure pill row → chart or table → range strip → source note. Right (aside, sticky, 1px hairline left border, 26px padding-left): `სერიები` overline, grouping tabs (expenditure only, §7.2b), search, action-left/status-right row, series rows (scroll ≤430px), dataset-owned CSV button.

### 8.3 Line Chart

SVG on paper (no plot frame), viewBox 920×320: a dot lattice for the grid (below), `1px ink` line at zero, 1px `hairline` y-axis line; axis labels mono 11px muted (y labels right-aligned outside the plot, 74px left padding); year labels thinned to ≤12 (first anchored start, last anchored end); series polylines 2.2px round-joined with a 3.5px dot on the final point only; no in-plot direct labels. Hover/pointer: 1px `control` vertical guide, ring markers (paper fill, 2px series stroke), tooltip (tile bg, 1px hairline border, radius 3, tooltip shadow, mono year + swatch/label/value rows; flips side past 60% width). `role="img"` + Georgian aria-label. SVG text sets fonts via `style` (the `font-family` presentation attribute does not resolve `var()`).

**Dot lattice.** It replaces the horizontal gridlines outright — the dot field *is* the grid, not decoration behind one.

- `#C9BEA9` (the `control` value) at opacity 0.6, radius 0.7. Literal hex, matching the rest of this chart: `var()` does not resolve in SVG presentation attributes.
- Pitch is derived from the active scale, never fixed: **2 columns per year interval** (`plotWidth / (2 × (n − 1))`) and **3 rows per gridline step** (`stepPx / 3`), so every third row lands exactly on a labelled y value and every second column on a year.
- Density guards: a sub-division pitch below 12px falls back to one column per year, or one row per step, independently. A negative domain can produce many gridline steps, and dots must never smear into a tone. With `n ≤ 1` there is no interval to divide and no lattice is drawn.
- Drawn as one `<pattern patternUnits="userSpaceOnUse">` with the circle at the tile center and the pattern origin offset back by half a pitch, so dot centers land exactly on the plot's grid intersections with no edge clipping — a pattern, not ~500 `<circle>` elements.
- The `1px ink` line at zero stays: it is load-bearing for negative domains. The `hairline-soft` horizontal gridlines are gone.

Data-reality rules (the prototype's snapshot had none of these; production data does):

- **Negative values** (e.g. `revenue.other_taxes` 2019–2020) extend the y-domain below zero: both bounds snap to one shared gridline step so 0 always sits on a gridline; the ink line stays at zero, not at the plot floor.
- **Interior gaps** (e.g. programs with no 2015 facts) split the polyline into segments — never bridge a missing year; an isolated point renders as a small dot.
- **Empty range**: a non-empty selection with zero points in the active range shows the callout `არჩეული სერიებისთვის ამ დიაპაზონში მონაცემები არ არის…` instead of a fabricated axis (table mode shows the same callout instead of a total-only table).
- **Narrow screens**: the chart scrolls horizontally inside its own container (min-width 720px) instead of scaling its type below the §13 floor; hover state is clamped when the years array shrinks.

### 8.4 Table Mode

Columns: `<first col> | years… | ცვლილება | წილი <end-year>`. First column header by scope: `სფერო` (fields), `უწყება` (ministries), `საბიუჯეტო მუხლი` (revenue). Header: overline style, `2px ink` bottom rule. Rows: 1px `hairline-soft` borders, tint hover; swatch bar + sans label left; numerals mono right-aligned; latest-year column weight 600; change colored positive/negative (minus sign `−`). When selected, the dataset total row uses its exact scope label (`მთლიანი ხარჯი`, `მთლიანი შემოსავლები`, or `მთლიანი ბიუჯეტი`) with a `2px ink` top rule, weight 600, and share `100.0%`; it is absent when deselected. Horizontal scroll with sticky first column and sticky right change/share columns (paper bg, 1px `hairline-soft` edge shadows).

### 8.5 Below-Chart Sections (`ძირითადი ინდიკატორები`, order fixed)

1. Hero KPI (`პერიოდის ცვლილება`, §7.12) + three side KPIs (`ყველაზე დიდი ზრდა`, `ყველაზე ნელი ზრდა`, `ყველაზე დიდი წილი`) in a `1.35fr | 1fr` grid split by a hairline. Side KPIs rank **all top-level scope items** — the same population as the movers board, so the identical headings can never contradict each other on one screen. The `ყველაზე დიდი ზრდა` GEL delta requires a positive start value (a delta measured against a negative base is a correction unwind, not growth).
2. Movers board (top 3 / bottom 3 across all scope items).
3. `პერიოდის შედარება` — table `<first col> | start year | ცვლილება | end year`, with the exact-labeled total row first only when it is selected, fixed layout with 44% label column. This table (only) is scoped to the user's selected series.

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

**Completeness rule:** the ranking lists EVERY official row of the year — including zero and negative lines (e.g. `revenue.other_taxes` 2019–2020) — so the rows always reconcile with the `სულ` headline, and the category counts in the headline/deck count all rows. Shares are of the true year total (negative rows get a negative share and no bar). Only the geometry sections (treemap, every-100, radar, field) draw positive rows exclusively.

## 10. Revenue Adaptation

No separate revenue direction. Same shell, tokens, controls, chart/table treatment, analysis order, CSV and source patterns. Change only labels, taxonomy, revenue series tokens (§4.2), source wording, tooltips, CSV metadata.

## 11. Content and Copy

Voice: precise, civic, archival. Georgian is primary; English only for compact technical labels (`CSV`).

Canonical terms: `ხარჯები`, `შემოსავლები`, `ანალიზი`, `სერიები`, `ხაზი`, `ცხრილი`, `სფეროები`, `უწყებები`, `% წილი`, `დიაპაზონი`, `მთლიანი ხარჯი`, `მთლიანი შემოსავლები`, `მთლიანი ბიუჯეტი`, `სულ` (single-year analysis), `ძირითადი ინდიკატორები`, `პერიოდის ცვლილება`, `ყველაზე მზარდი`, `ყველაზე ნელი ზრდა`, `პერიოდის შედარება`, `სტრუქტურა სფეროების მიხედვით`, `ყოველი 100 ლარი`, `ბიუჯეტის რადარი`, `ბიუჯეტის ველი`, `სრული რეიტინგი`, `CSV ჩამოტვირთვა`, `გეგმა`.

Units always shown: `მლრდ ₾`, `მლნ ₾`, `%`. Numbers use `en-US` grouping, fixed decimals (bn: 2, mln: 1, %: 1). Amounts ≥ ~1bn display in `მლრდ ₾`, below in `მლნ ₾`. Negative sign is `−` (minus, not hyphen) in deltas.

Page titles are editorial sentences, not labels: `როგორ იხარჯება საქართველოს ბიუჯეტი`, `როგორ ივსება საქართველოს ბიუჯეტი`, `<year> წლის ბიუჯეტის სურათი — სად მიდის საჯარო ფული / საიდან მოდის საჯარო ფული`.

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

Mobile (<768px): page padding `24px 20px 64px`; page title 30px; hero value 44px; year selector scrolls horizontally; tables scroll horizontally (min-width preserved, sticky columns active); Every 100 GEL stays 10×10 — shrink cells, never cell count; controls ≥30px tall (prefer 36px+).

Breakpoint behavior keys off the page container width (ResizeObserver or CSS container/media queries), matching the reference prototype.

The shell adds one breakpoint of its own at **900px** (§6.7). It governs the sidebar only — above it the sidebar is a column, below it a top bar with an in-flow nav panel — and does not change the content column's own breakpoints above. The hub card grid drops to one column below 768px.

The workspace's own breakpoints measure the **content column**, not the viewport (`@container` on the centred column in `main-explorer.tsx`). With a 232px sidebar in front of it the two differ by more than the 292px aside costs, so a viewport query keeps the two-column layout past the width the chart can fit and the chart clips inside its own frame.

**Chart width between 900 and 1019px — an accepted deviation from the §8.3 label size.** In that band the sidebar leaves the column 600–719px, under the chart frame's 720px minimum. The chart shrinks to fit there rather than scrolling, so the rendered axis label falls to **7.2px at 900px** (from 8.6px). This is a deliberate trade of label size for a whole chart, approved for this band only. Two things it does not change: below 900px the sidebar becomes a top bar, the column is wide again, and phones keep the 720px minimum and the horizontal scroll; and the 11px in §8.3 is a viewBox unit, so the rendered size has always tracked the frame — it is 8.6px at 1020px and 9.7px at 1440px, reaching 11px only where the chart is widest.

## 13. Accessibility

- All controls have accessible names; toggles expose pressed/selected state (`aria-pressed`, `aria-expanded`); slider handles expose `role="slider"` with value attributes and keyboard support.
- SVG charts: `role="img"` + Georgian accessible label; SVG-only data must also exist in table/tooltip/summary.
- Focus visible (accent ring) on paper.
- Never color-only meaning: swatch + label + value.
- Respect `prefers-reduced-motion`.
- Chart labels ≥10px mono only for axes; interactive text ≥12px; body ≥12px.
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
  --faint: #776E5C;
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

`apps/web/app/globals.css` ships these plus the two ink-surface tokens `--ink-fg-muted` and `--ink-fg-faint` (§6.7). Their values are defined once, in §4.1, and are deliberately not repeated here — the pair is contrast-constrained (§4.1), and a change to either should be a one-line edit, not a hunt.

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

- No cards, panels with backgrounds, container shadows, or radii above 3px (pill exceptions only). The single card exception is the budget hub's four cards (§6.6); it does not generalize.
- No white surfaces; no gradients anywhere.
- No blue `#0071e3` or any v3.x Apple token; no night theme or theme toggle.
- No dots/rounded-square swatches — bars only.
- No bar/stacked chart modes; only `ხაზი` and `ცხრილი`.
- No GDP-share measure; `% წილი` is share of the side total.
- No official program codes in the series panel (names only).
- No emoji, no decorative icons; the system is typographic (caret `▸/▾` and checkmark `✓` glyphs are part of the control language).
- No drilldown anywhere.

## 18. Design QA Checklist

1. Page is paper-backed with no cards or shadows (tooltip/slider-handle exceptions only; the budget hub's four cards are the one card exception, §6.6).
2. Every `/explorer` surface opens with the breadcrumb row's 2px ink rule; major sections open with 2px rules; sections are routes reached from the sidebar (§6.7), not in-page nav tabs.
3. All numerals are mono; all display values serif; overlines uppercase sans 11/600.
4. Explorer default: line mode, nominal GEL, full range, total-only selection, and unrestricted line rendering.
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
16. URL hash round-trips: reloading a deep link restores grouping, mode, share, range, selection, and analysis year; the section comes from the route, and a legacy `#nav=` link on `/explorer` redirects to it with the rest of the hash intact.
17. No v3.x (Apple) or older terminal/neon styling anywhere.

## 19. Landing Page (მთავარი)

Lives at `/`; reuses the editorial shell (§6.1), tokens, and type scale. Implementation: `apps/web/components/landing/`, geo data in `apps/web/lib/landing/georgiaGeo.ts`, budget-derived values computed server-side in `apps/web/lib/landing/landingData.ts` from the same active facts as the explorer.

Section order (top to bottom):

1. **Header** — editorial header (§7.1) with page links instead of tabs: `მთავარი` (active, accent underline) and `ექსპლორერი` → `/explorer`; right slot shows the mono revenue year range (hidden on mobile).
2. **Hero — living relief** — Three.js dotted map of Georgia (exact ADM0 outline, analytic elevation, population-scaled city squares emitting ripple waves, Tbilisi national pulse every 45s, peak labels Shkhara/Mkinvartsveri, city hover readout, mouse parallax). **The map is the hero's main subject and is maximized**: the figure is full-bleed (spans the viewport, escaping the 1240px column) and the camera keeps the reference's viewing angle but fits its distance at runtime so the country's real dot bounds fill the canvas at any aspect (margins ≈9%/6%, refit on resize). Headline (`როგორ ივსება და იხარჯება საქართველოს ბიუჯეტი`) overlays top-right on ≥768px, staying in the content grid, and sits above the map on mobile; CTA `დაიწყე ბიუჯეტით` → `/explorer`. The hero's height is not fixed: the camera fits inside a fixed virtual frame (340px <768, 500px <1100, `min(78vh, 820px)` ≥1100), then the canvas is cropped to the map's projected vertical band via a camera view offset — the map never rescales, and the key-numbers section starts immediately under the last dots. The headline overlay's measured height is a hard floor so the copy can never overflow into the stats. `prefers-reduced-motion` renders a still frame; WebGL failure shows a mono fallback note.
3. **Key numbers** — three hardcoded country figures (population 3.7 მლნ, area 69.7 ათ. კმ², nominal GDP 104.6 მლრდ ₾ · 2025 preliminary, per Geostat), serif 46px values, maintained by hand in `landing-page.tsx`. The section sits 40/56px below the full-bleed hero.
4. **სამი გზა მონაცემებამდე** — three rule-topped cards, all data live: 01 multi-year explorer (total-revenue + VAT sparkline) → `/explorer`; 02 single-year picture (30-cell expenditure waffle, §4.2 colors) → `/explorer/analysis`; 03 open CSV (real header + two active-fact rows in a tint block) → `/explorer`.
5. **Footer** — brand + tagline + `info@geodata.ge`; nav links (explorer, analysis); data/license notes (source, last-updated date, CC BY 4.0); mono bottom bar.

Landing QA: waffle renders exactly 30 cells; sparkline endpoints match the loaded revenue range; CSV preview shows real active-fact rows; hero canvas mounts or the fallback note shows; no cards or shadows.

## 20. Municipal Surfaces

Reference implementation: `apps/web/components/municipalities/`, routes under `apps/web/app/explorer/municipalities/`. The section reuses the shell (§6.7) and the existing explorer machinery — `EditorialLineChart`, `RangeStrip`, `Callout`, `SourceNote`, `SwatchBar` — rather than inventing new surface types; `municipality-map.tsx` is the dedicated static SVG map component.

**Municipality-grain static SVG map.** The index choropleth renders a deterministic, vendored OpenStreetMap snapshot as 60 municipality polygons plus five green city markers: Tbilisi `04`, Batumi `06`, Kutaisi `20`, Poti `32`, and Rustavi `48`. Codes `06`, `20`, `32`, and `48` are marker-only; Tbilisi `04` is the sole polygon-plus-marker duplicate; the union is exactly the 64 publicly served municipality codes. Each polygon or marker opens `/explorer/municipalities/[code]` directly. The six-step terracotta ramp is quantile-classed by the latest available official municipal total. Pointer and keyboard activity synchronizes the exact municipality between map and ranked list; switching to the Regions list leaves the map at municipality grain and region rows remain inert toward map highlighting.

The two reviewed occupied-area overlays render above the municipality fills as pale, non-interactive SVG paths with no public label, tooltip, link, keyboard focus, map text, or legend entry. The source note links `© OpenStreetMap contributors` to `https://www.openstreetmap.org/copyright` and states `ODbL` without adding occupied-territory wording. Natural Earth overlay provenance remains repository documentation because that source is public domain. Codes `05`, `42`, `43`, `46`, and `64` remain excluded from the public registry, facts, aggregates, rankings, and all interactive map targets: their raw budgets belong to Georgian municipal bodies operating outside those territories and serving displaced communities, so they are not territorially attributable spending inside the named municipalities. Full geometry and licence provenance is documented in `docs/data-methodology/municipal-functional-annual-2015-2025.md`; the approved behavior is specified in `docs/superpowers/specs/2026-08-07-municipality-map-upgrade-design.md`.

**One public total.** `მთლიანი ბიუჯეტი` uses `public_total_gel` in the selector, chart, table, KPIs, comparisons, percentage denominator, and numeric CSV total row. The ten functions remain unchanged; their shares can sum below or above 100%. No residual category or reconciliation warning appears in the explorer. The methodology document explains the source-version and financing differences.

**Unit: `მლნ ₾`, not `მლრდ ₾`.** Municipal budgets run one to three orders of magnitude below the national totals the rest of the explorer charts in billions; a billions axis would round most municipal functions to `0.0`. The municipal chart and table pass `UNIT_MLN` (`lib/explorer/format.ts` — one decimal, million GEL) to the same `EditorialLineChart`/`ExplorerTable` the budget explorer passes `UNIT_BN` to. KPI values, list rows, and the entity picker use `formatAmount`, which already auto-selects `მლნ ₾` below ~1bn GEL on its own.
