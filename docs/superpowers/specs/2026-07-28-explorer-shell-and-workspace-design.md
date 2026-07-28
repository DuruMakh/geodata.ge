# Explorer Shell and Workspace Redesign — Design

Date: 2026-07-28
Status: approved for planning
Supersedes: nothing. Extends `DESIGN.md` v4.1.

## 1. Context

The owner supplied three screenshots and a reference bundle (`GeoData.html`, an Editorial v2
mock unpacked to a 232px-sidebar shell plus a budget hub and a revenue explorer). The reference
is directional, not pixel-binding.

Two distinct changes are bundled here:

- **A shell and IA change.** GeoData becomes a data platform whose first dataset is the budget:
  a persistent left sidebar, a budget hub page, breadcrumbs, and real routes per section.
- **Three workspace changes** inside the multi-year explorer: a dot lattice behind the chart, a
  segmented mode control, and sparklines under all three side KPIs.

The range strip was in the owner's original list and was then explicitly withdrawn — it ships
unchanged.

## 2. Scope decisions

Approved by the owner during brainstorming:

- **Municipalities enters project scope** as a named future section. `Project_Definition.md` §2
  moves "Municipal transfers explorer" out of Excluded. No municipal data is built here.
- **The four teaser datasets** (უმუშევრობა, ინფლაცია, ეკონომიკური ზრდა, დემოგრაფია) are
  coming-soon markers only. No data, no routes, not clickable.
- **Hub cards are permitted**, carving an explicit exception into the `DESIGN.md` no-cards rule.
- **Section navigation lives in the sidebar** (nested under ბიუჯეტი), not as in-page tabs. The
  owner may later prefer hub-and-breadcrumb navigation with no switcher at all, so the switcher
  is built as one self-contained component that can be deleted without touching anything else.
- **No fabricated content.** The reference's `12 სტატია`, the pull-quote, `64 ერთეული`, and
  `v2.1.0` are mock strings and are not shipped. Every figure on the hub is derived from the
  served data at build time.
- **Delivery is a single pass**, not staged.

## 3. Information architecture and routes

```
/explorer              budget hub
/explorer/expenditure  ხარჯები       multi-year explorer, expenditure side
/explorer/revenue      შემოსავლები   multi-year explorer, revenue side
/explorer/analysis     ანალიზი       single-year snapshot
```

`nav` stops being React state and becomes the route. This is the only structural change to the
state layer; everything else is presentational.

Section order is **ხარჯები, შემოსავლები, მუნიციპალიტეტები (მალე), ანალიზი**, identical in the
sidebar and the hub. This deviates from the reference (which puts revenue first) because the
product's default side is expenditure and its headline question is "სად მიდის საჯარო ფული".

### 3.1 File structure

```
app/explorer/layout.tsx              server — sidebar + main frame
app/explorer/page.tsx                server — hub
app/explorer/expenditure/page.tsx    server — loads data, renders <MainExplorer nav="expenditure">
app/explorer/revenue/page.tsx        server — same, nav="revenue"
app/explorer/analysis/page.tsx       server — same, nav="analysis"
components/shell/data-sidebar.tsx    client — usePathname, mobile sheet state
components/shell/section-nav.tsx     client — the deletable switcher
components/shell/page-header.tsx     server — breadcrumb row + coverage label
components/hub/budget-hub.tsx        server — the four cards
components/ui/sparkline.tsx          server-safe — pure SVG
```

The layout renders only the sidebar. Each page renders its own breadcrumb through `PageHeader`,
because the final crumb differs per route and a server layout cannot read the child route.

Each section route calls `loadServedExplorerData()` and ships the same client payload the single
`/explorer` page ships today. Three static pages instead of one; per-page cost is unchanged
because only one loads at a time. The hub uses the lighter `loadServedLandingData()` and ships no
client payload at all — its cards are static SVG rendered on the server.

### 3.2 URL state and back-compatibility

`serializeExplorerHash` drops `nav`. Everything else in the hash is untouched: `grouping`, `m`,
`sh`, `r`, `sel`, and the analysis parameters. Shared links continue to work inside a section.

`parseExplorerHash` keeps accepting `nav` so `/explorer` can honour legacy links. The hub is a
server component and cannot read a hash, so the redirect lives in a small client component
(`components/shell/legacy-hash-redirect.tsx`) mounted on the hub: on mount it reads
`window.location.hash`, and if it carries `nav=expenditure|revenue|analysis` it `router.replace`s
to the matching route with `nav` stripped and the rest of the hash preserved. It renders nothing.

`sitemap.ts` gains the three section routes. Each route sets its own `title`, `description`, and
canonical URL.

## 4. Shell

### 4.1 Sidebar

232px, `--ink` background, sticky, full viewport height so it holds while the long explorer page
scrolls.

- Brand block: serif `GeoData` in `--paper`, mono `ღია მონაცემები` beneath in `--ink-fg-faint`.
- `მონაცემები /` overline, mono, letter-spaced.
- `ბიუჯეტი` — active dataset. Its four sections nest beneath it (§4.2).
- `უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა`, `დემოგრაფია` — `--ink-fg-muted` label with a
  `მალე` badge (1px `#3A362E` border, 2px radius, mono 9px). Not links, not focusable.
- Foot: `← მთავარი`. No version string.

Two dark-surface colours are not in the current token set and are added to `DESIGN.md` §4.1
rather than inlined as hex:

```
--ink-fg-muted: #8F8676   /* inactive labels on ink */
--ink-fg-faint: #7A7060   /* overlines, badges, tertiary text on ink */
```

Dividers on ink use `rgba(247,242,233,0.12)`; the active row background is
`rgba(247,242,233,0.07)`.

### 4.2 Section switcher (`section-nav.tsx`)

Nested list under ბიუჯეტი. Each entry is a `next/link` to its route. Active state: accent `▸`
marker, `--paper` text at weight 600, `rgba(247,242,233,0.07)` background, `aria-current="page"`.
Inactive: `--ink-fg-muted`, no marker. `მუნიციპალიტეტები` renders in the same list as a
non-interactive row with the `მალე` badge and `aria-disabled="true"`.

Deleting this component and its single usage in `data-sidebar.tsx` reverts navigation to
hub-and-breadcrumb only. Nothing else imports it.

### 4.3 Responsive

- ≥900px: sidebar as specified, content column beside it, max-width 1180px.
- <900px: the sidebar collapses to a slim top bar (brand + menu button). Tapping opens the nav as
  a full-height sheet; `«` closes it. Focus is trapped while open, `Escape` closes, and the
  trigger regains focus on close. Content gets the full width.

The reference has no small-screen behaviour — its sidebar stays 232px at every width. This
section is designed here, not inherited.

### 4.4 Page header (`page-header.tsx`)

Breadcrumb row with a `2px --ink` bottom rule. Crumbs: `მთავარი` (link) `/` `მონაცემები` (plain
text, no route) `/` `ბიუჯეტი` (link to hub on section pages, plain text on the hub) `/`
`<section>` (current, `--ink`). Separators in accent.

Right side: mono `{minYear} — {maxYear} · განახლდა {lastUpdatedAt}` — the dataset's **coverage**,
not the user's selection. The range strip keeps showing the selection and its own min/max labels;
the two facts live at different altitudes (page vs. control) and do not contradict each other.

Coverage is the loaded year range of the route's **active scope**, so it tracks the grouping:
`fields` and `revenue` on their section routes, `ministries` when the expenditure route is grouped
by უწყებები, and the analysis route's active side/grouping combination. On the hub, where no
scope is active, coverage is the union of the expenditure and revenue ranges.

## 5. Hub page

Breadcrumb, serif H1 `საქართველოს ბიუჯეტი`, deck paragraph, then four cards in a 2×2 grid
(single column under 768px), max-width 860px, then the standard source note.

Card: `--tile` background, 1px `--hairline` border, **radius 0**, hover `--tint`. Contents in
order: mono index in accent with `→` right-aligned, serif 18 title, 11.5px `--muted` description,
graphic, mono footer.

| # | Card | Graphic | Footer | Links to |
|---|------|---------|--------|----------|
| 01 | ხარჯები | total expenditure series | `{latestYear} · {total}` | `/explorer/expenditure` |
| 02 | შემოსავლები | total revenue series | `{latestYear} · {total}` | `/explorer/revenue` |
| 03 | მუნიციპალიტეტები | none | none | nothing — `მალე` badge, `aria-disabled` |
| 04 | ანალიზი | none | `{latestYear} · {n} კატეგორია` | `/explorer/analysis` |

`{latestYear}` on card 04 is the analysis view's default year (latest year of the expenditure
`fields` scope) and `{n}` is that year's top-level category count — the two numbers the analysis
route shows on arrival with its own defaults.

Every figure is computed at build time from the same served facts the section pages use, so the
hub cannot drift from the pages behind it. The 01/02 graphics are the real total series drawn
through `Sparkline` at card width.

The `ანალიზი` description is rewritten to describe the destination that exists — the single-year
snapshot with structure, ranking, and Every 100 GEL — replacing the reference's editorial-section
framing.

The `მუნიციპალიტეტები` card carries the `მალე` badge in place of the `→`, renders no figure and
no graphic, and is not a link. It must not be stylable as live: muted title colour, no hover
state.

## 6. Chart panel

### 6.1 Dot lattice

Replaces the horizontal gridlines. The dot field **is** the grid, not decoration behind one.

- Colour `#C9BEA9` (`--control`) at opacity 0.6, radius 0.7. Literal hex, matching the existing
  chart code — `var()` is not used for SVG presentation attributes in this file.
- Pitch is derived from the active scale, not fixed:
  - columns: **2 per year interval** → `colPitch = plotWidth / (2 × (n − 1))`
  - rows: **3 per gridline step** → `rowPitch = stepPx / 3`
  - so every third row lands exactly on a labelled y value, and every second column on a year.
- Density guards: if `colPitch < 12` fall back to 1 column per year; if `rowPitch < 12` fall back
  to 1 row per step. A negative domain can produce many gridline steps, and dots must never
  smear into a tone.
- `n ≤ 1`: no lattice. There is no interval to divide.
- Implementation: one `<pattern patternUnits="userSpaceOnUse">` with the circle at the tile
  centre (`cx=colPitch/2`, `cy=rowPitch/2`) and the pattern origin offset back by half a pitch
  (`x = PAD_L − colPitch/2`, `y = PAD_T − rowPitch/2`), so dot centres land exactly on
  `PAD_L + i·colPitch` / `PAD_T + j·rowPitch` with no edge clipping. A pattern, not ~500
  `<circle>` elements.

Retained unchanged: the 1px `--ink` line at zero (load-bearing for negative domains), the 1px
`--hairline` y-axis line, mono axis labels, year-label thinning, hover crosshair and tooltip,
gap segmentation, and the horizontal-scroll container.

Removed: the `--hairline-soft` horizontal gridlines.

### 6.2 Mode control

`ხაზი / ცხრილი` becomes a segmented control: inline-flex, 1px `--control` border, 2px radius,
overflow hidden, mono 10.5px with 0.04em tracking, 6px/13px padding. Active segment `--ink`
background with `--paper` text; inactive `--muted` on transparent, hover `--tint` + `--ink`.
Divider between segments is the shared 1px `--control` border. Both segments keep
`aria-pressed` and their existing test ids.

The grouping tabs in the series aside (`სფეროები / უწყებები`) and the analysis view's side and
grouping tabs keep the text-underline style. A segmented box is the honest affordance for an
either/or view switch; a filter is not that. `DESIGN.md` §7.2 splits into two specs.

### 6.3 Range strip

Unchanged. Explicitly withdrawn from scope by the owner after review.

## 7. Indicators

### 7.1 `Sparkline` component

Pure SVG, no client state, usable from server components.

```
props: { values: (number | null)[]; color: string; width?: number; height?: number }
```

- Default 64×16, 1px inset so a 1.2px stroke never clips.
- Domain is the min/max of the non-null values; an all-equal series draws a flat mid line.
- Nulls split the polyline into segments — never bridged, matching the main chart's rule.
- Fewer than two non-null points renders nothing rather than a misleading flat line.
- No axis, no end dot, no fill. `aria-hidden="true"`: the KPI value and detail line already carry
  the meaning, and a 64px decoration has nothing to add to a screen reader.

### 7.2 Placement

One sparkline under each of the three side KPIs, below the value/detail row, left-aligned, 6px
top margin.

| KPI | Series plotted | Colour |
|-----|----------------|--------|
| ყველაზე დიდი ზრდა | that row's values across the selected period | its category colour |
| ყველაზე ნელი ზრდა | that row's values across the selected period | its category colour |
| ყველაზე დიდი წილი | that row's **share of total** per year | `--accent` |

The third is deliberately a different metric: the KPI states a percentage, so the sparkline traces
that percentage. Share per year is `row.valuesByYear[y] / totalRow.valuesByYear[y]`, computed in
`indicators.tsx` — no data-layer change. Years where either side is null or the total is zero
produce a null point.

The hero `პერიოდის ცვლილება` block keeps its two-segment gauge and gets no sparkline.

## 8. State layer changes

`useExplorerState` takes `nav` as an argument instead of owning it as state. `handleNavChange`
and the `NAV_ITEMS` array are removed; navigation is `next/link`. The hash writer no longer emits
`nav`.

Analysis state stays in the same hook. Splitting it out is adjacent work, not required by this
change, and is left alone per the surgical-changes rule.

`MainExplorer` loses its header markup (moved to `PageHeader`) and its nav tab row.

## 9. Documentation updates

Required in the same change:

- `DESIGN.md`: §4.1 two ink-surface tokens; §6.2 IA rewritten for hub + routes; §6.3 URL state
  minus `nav`; §6.6 explicit hub-card exception to the no-cards rule; new §6.7 shell and sidebar;
  §7.2 split into mode control and grouping tabs; §7.11 sparklines; §8.3 dot lattice.
- `Project_Definition.md`: §2 moves municipalities from Excluded to a named future section.
- `AGENTS.md`: "Current Project State" gets the new IA and route structure.

## 10. Tests

- The 12 explorer browser tests swap nav-tab clicks for route navigation.
- `landing.spec.ts` asserts `/explorer/analysis` instead of `/explorer#nav=analysis`.
- New: hub renders four cards; `მუნიციპალიტეტები` is not a link and carries `მალე`; legacy
  `#nav=` on `/explorer` redirects to the matching route preserving the rest of the hash; each
  side KPI renders a sparkline; the chart renders a dot pattern and no `--hairline-soft`
  gridlines; the sidebar collapses to a top bar below 900px.
- `visual-reference.spec.ts` reference screenshots are refreshed.

## 11. Out of scope

- Municipal budget data, and any route for it.
- Any real data behind the four teaser datasets.
- Landing page restyle. Only its links change: header `ექსპლორერი` and the path cards point at
  `/explorer`, and `#nav=analysis` becomes `/explorer/analysis`.
- Range strip changes.
- Splitting analysis state out of `useExplorerState`.
- A collapsed desktop sidebar rail. `«` exists only as the mobile sheet's close control.

## 12. Rejected alternatives

- **In-page section tabs (option B).** One click to switch sides, but two competing navigation
  systems on screen. Rejected in favour of sidebar nesting; the owner's likely fallback is fewer
  controls, not different ones.
- **Shell-only wrap, keeping `MainExplorer` intact.** `nav` would live in the route and in the
  hash state machine simultaneously; the hash writer would stamp `#nav=revenue` onto
  `/explorer/expenditure` and break the back button and shared links.
- **Dots behind retained gridlines.** Two grid systems doing one job.
- **Dots with no gridlines and no lattice alignment** (the literal reference). Floating y labels
  make mid-plot values an eyeball estimate, which is worse with a negative domain.
- **Staged delivery.** Offered and declined.

## 13. Success criteria

1. `/explorer` renders the hub; the three section routes render their views; the legacy
   `#nav=` redirect lands on the right route with the rest of the hash intact.
2. A link shared from a section still restores grouping, mode, measure, range, and selection.
3. The chart shows a scale-aligned dot lattice with every third row on a labelled value, the ink
   zero line intact, and no horizontal gridlines.
4. All three side KPIs show a sparkline; the third traces share, not level.
5. No figure anywhere on the hub is hardcoded.
6. `npm run check`, `npm run build`, and `npm run test:browser` pass.
7. `DESIGN.md`, `Project_Definition.md`, and `AGENTS.md` are updated in the same change.
