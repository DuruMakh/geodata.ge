# Municipalities UI (design)

Date: 2026-08-03
Status: approved design
Scope: UI only. **No change to the served municipal dataset, its Prisma schema,
or the import.** The one data-layer touch is a geometry provenance swap (§4) in
the landing geo module, which the municipal dataset does not depend on.

## 1. Why this exists

`docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md` (Spec 1)
shipped the municipal dataset as data only: 10 functions × 64 municipalities ×
11 years (2015-2025), plus 704 total rows, served in both csv and db mode, with
no route reading it. `apps/web/lib/explorer/sections.ts` still carries
`municipalities: { href: null }` and the `მალე` marker is inert on the live site.

This spec is the second of the two. It builds the section: an index with a map
and a ranked list, a page per municipality, and a page per region.

Spec 1 deliberately deferred three things to this spec. All three are resolved
here: map geometry (§4), the replacement for per-capita (§5.3, §6.4), and
warning placement (§8).

## 2. Decisions taken during brainstorming

Recorded because each closes an option that looks open from the code.

1. **The map is a region choropleth, not a municipality one.** Spec 1 §4.3 left
   the ADM2 shape join as research with a possible "none of these fit" outcome.
   Region-level geometry already exists in the repo, so the whole section ships
   unblocked at ADM1 grain. A municipality-level map is a separate future spec;
   it is not owed by this one.
2. **One measure: absolute GEL.** No measure pill. See §5.3.
3. **Divergence callout on municipality pages only**, year-scoped. See §8.
4. **Reuse the existing chart, range strip and table**; write a new model layer
   underneath them. See §9.
5. **Region geometry moves from GADM to geoBoundaries `gbOpen`** before anything
   is built on it. See §4.1.

Standing rule from Spec 1's brainstorming, still in force: where the uploaded
design file (`docs/Design HTML files/მუნიციპალიტეტების ბიუჯეტი.html`, outside
the repo) conflicts with the shipped app, **the app wins**. The file predates the
WCAG contrast fix and the shell work, and its per-capita measures are not
supportable. It is a reference for layout and copy, not a source of truth.

## 3. Routes, navigation, URL state

Three route files, 76 static pages, all prerendered.

```text
/explorer/municipalities                 index — map, ranked list, KPIs
/explorer/municipalities/[code]          64 pages; code = official 2-digit code (04 = თბილისი)
/explorer/municipalities/region/[id]     11 pages; id = region id minus prefix (region.imereti → imereti)
```

`[code]` is the registry's stable identifier. The alternative — a latin slug —
would need a reviewed transliteration column added to the municipality registry,
which is a Spec 1 data change for a cosmetic URL gain. Accepted cost: the URL is
opaque (`/explorer/municipalities/04`). `region` is a static segment and cannot
collide with a two-digit code.

`generateStaticParams` produces all 75 entity routes at build time. The section
stays fully static in both csv and db mode, like every other route.

### 3.1 Navigation

All three surfaces read the one canonical list in `lib/explorer/sections.ts`:

- `municipalities.href` flips from `null` to `/explorer/municipalities`. The
  sidebar row becomes a real link and loses its `მალე` badge by construction —
  `section-nav.tsx` already branches on a null href.
- Hub card 03 stops being the dead card: it gains the `→`, an `ink` sparkline of
  the municipal total series, and a `{latestYear} · {total}` footer, matching
  cards 01 and 02 (DESIGN.md §6.7). The sparkline is `ink` for the same reason
  theirs are — it traces a total, and §4.2 gives every total series `ink`.
- The four indicator teasers (`უმუშევრობა`, `ინფლაცია`, `ეკონომიკური ზრდა`,
  `დემოგრაფია`) keep their `მალე` markers. They are the only ones left.

Breadcrumbs extend the existing per-route pattern:
`მთავარი / მონაცემები / ბიუჯეტი / მუნიციპალიტეტები`, plus the entity name on a
municipality or region page. The right-hand coverage slot reads
`2015–2025 · განახლდა {date}`, computed from the served facts.

### 3.2 URL state

Reuses the hash vocabulary of DESIGN.md §6.3 rather than inventing a second one:

```text
/explorer/municipalities#lvl=region
/explorer/municipalities/04#m=line&sh=1&r=2015-2025&sel=id1,id2
```

`m` mode, `sh` share, `r` range, `sel` selection — same keys and meanings as the
budget explorer. `lvl` is new, exists only on the index, and takes `muni`
(default) or `region`. Search text stays out of the URL: it is a transient
filter, not a view worth sharing.

Parsing follows the existing contract: unknown values fall back to defaults,
ranges clamp to the loaded years. `parseMunicipalHash` and
`serializeMunicipalHash` live in `lib/explorer/urlState.ts` beside the budget
pair, so the hash key vocabulary stays in one file.

## 4. Map geometry

### 4.1 Provenance

`apps/web/lib/landing/georgiaGeo.ts` already carries region rings for the
landing hero, sourced from **GADM level 1**. GADM permits academic and other
non-commercial use, but separately forbids redistribution without prior
permission — and publishing a website hands the coordinates to every visitor's
browser, which is redistribution regardless of the site being free.

The first task of the implementation replaces those 12 rings with
**geoBoundaries `gbOpen/GEO/ADM1`**, verified against the geoBoundaries API on
2026-08-03:

| Field | Value |
|---|---|
| `boundaryLicense` | **Creative Commons Attribution 3.0** |
| `licenseSource` | `commons.wikimedia.org/wiki/File` |
| `boundaryYearRepresented` | 2015 |
| `admUnitCount` | 12 |
| Release pin | `9469f09` |

**It is CC BY 3.0, not Public Domain.** CC BY explicitly permits redistribution,
including commercially, which is exactly the term GADM withholds — so the swap
solves the problem — but it *requires attribution*. Attribution is therefore part
of this task, not an optional nicety:

- The index map's source note names geoBoundaries and the licence.
- `georgiaGeo.ts`'s header comment records source, licence and release pin.
- The same attribution covers the **ADM0 outline already in that file**, which
  is from the same source and is likewise unattributed today.

`boundaryYearRepresented: 2015` is after the 2014 reform, and `admUnitCount: 12`
matches Georgia's twelve top-level regions exactly — so unlike the ADM2 problem
Spec 1 hit there is no unit mismatch and no reform-era reconciliation.

The `GeoRegion` type, the `regions` array shape, and every consumer stay as they
are. Only the ring coordinates and the file's provenance comment change.

All 12 features are simple `Polygon`s with one ring each, totalling 3,720 points.
Douglas-Peucker at tolerance **0.006°** reduces this to 1,194 points (~15 KB of
path data, about 1.25px of error at 1400px render width), which is the budget
this spec assumes.

### 4.2 The join

Twelve ADM1 shapes, eleven served regions. The join is keyed on **`shapeISO`**,
not `shapeName`. This is not a style preference: geoBoundaries spells
`Samtskhe–Javakheti` with an **en dash** (U+2013) and calls the seventh region
`Racha-Lechkhumi and Kvemo Svaneti`, neither of which matches the strings in
`georgiaGeo.ts`. A name join would fail silently on exactly those two.

| `shapeISO` | `shapeName` | Resolves to |
|---|---|---|
| `GE-TB` | Tbilisi | `region.tbilisi` |
| `GE-AJ` | Adjara | `region.adjara` |
| `GE-GU` | Guria | `region.guria` |
| `GE-IM` | Imereti | `region.imereti` |
| `GE-KA` | Kakheti | `region.kakheti` |
| `GE-MM` | Mtskheta-Mtianeti | `region.mtskheta_mtianeti` |
| `GE-RL` | Racha-Lechkhumi and Kvemo Svaneti | `region.racha_lechkhumi_kvemo_svaneti` |
| `GE-SZ` | Samegrelo-Zemo Svaneti | `region.samegrelo_zemo_svaneti` |
| `GE-SJ` | Samtskhe–Javakheti | `region.samtskhe_javakheti` |
| `GE-KK` | Kvemo Kartli | `region.kvemo_kartli` |
| `GE-SK` | Shida Kartli | `region.shida_kartli` |
| `GE-AB` | Abkhazia | `no_data: occupied_territory` |

This satisfies Spec 1 §4.3's rule at region grain, and §7 asserts it in both
directions: every shape resolves to a region or to a stated no-data reason, and
every served region resolves to exactly one shape.

**The Tskhinvali region behaves differently and must be said out loud.** It is
not a separate ADM1 shape — de jure it lies inside შიდა ქართლი and
მცხეთა-მთიანეთი. Those two therefore render as ordinary data-bearing shapes
whose totals exclude the four affected municipal bodies (`42`, `43`, `46`, `64`).
That caveat goes into the region source note as text (§7.3); it cannot be
carried by a map colour.

### 4.3 Rendering

`lib/explorer/municipalGeo.ts` holds a pure equirectangular projection with a
`cos(lat)` correction, mapping lon/lat to a fixed viewBox, plus the join table
and a `buildRegionShapes()` that returns `{ regionId | null, noDataReason, d }`.

Paths are projected and rounded **at build time** in the server component and
passed down as strings, so the index ships a few KB of `d` attributes rather
than the ~40 KB coordinate table. The client component receives only paths,
values and labels.

## 5. Index page (`/explorer/municipalities`)

H1 `რას ხარჯავენ საქართველოს მუნიციპალიტეტები`, lead paragraph, then two
columns — map left, list right at 336px — collapsing to one column below 1100px,
where the aside's left border becomes a `2px ink` top rule exactly as the budget
explorer's aside already does (DESIGN.md §6.4).

### 5.1 Map

Eleven data-bearing regions coloured by 2025 `public_total_gel`, quantile-classed
into the design's six-step terracotta ramp. Quantiles rather than equal
intervals: with eleven values spanning 22× (თბილისი 2,108M → რაჭა-ლეჩხუმი 96M),
equal intervals would put nine regions in one bucket.

აფხაზეთი renders as the explicit no-data shape — `#E5DBC9` fill, dashed
`#C4B69C` stroke — with the legend line
`ოკუპირებული ტერიტორია — მონაცემები არ არის`.

Five green dots mark the self-governing cities (`is_self_governing_city` is true
for exactly თბილისი, ბათუმი, ქუთაისი, ფოთი, რუსთავი) and link straight to those
municipality pages, so the map is an entry point to both grains. Coordinates come
from `GEORGIA_GEO.cityMarkers`, which already carries all five.

Hover gives the design's anchored tooltip (region name over value) plus a
one-line readout at the right of the legend row, which reads
`გადაატარე კურსორი რუკაზე` at rest. Clicking a region opens its region page.

The map header reads `რეგიონები რუკაზე · 2025`, not the design file's
`ყველა მუნიციპალიტეტი რუკაზე` — the map is regions, and the header must not
promise a grain it does not have.

Beneath the map, the geometry attribution required by §4.1:
`საზღვრები: geoBoundaries (gbOpen GEO ADM1), CC BY 3.0.`

### 5.2 List

The list carries the grain the map cannot.

- `TextTab` pair `მუნიციპალიტეტები` / `რეგიონები`, matching how the analysis
  view already renders grouping switches. (Mode switches use `SegmentedTabs`;
  this is a grouping switch, per DESIGN.md §7.2a/§7.2b.)
- Search filtering on both municipality and region name, with a clear control.
- `N / 64` count, and the design's empty state when a query matches nothing.
- Rows: mono rank, name over region sub-label, a 3px terracotta bar relative to
  the leader, mono value, `→`. Sorted by 2025 `public_total_gel` descending.
- Region rows show `{N} მუნიციპალიტეტი` as their sub-label and link to region
  pages.

Hover is shared between the two columns in one direction each. Hovering a list
row highlights the region that contains it on the map. Hovering a map region
highlights every list row belonging to it, without scrolling the list — a
scroll jump on hover makes the list unusable when moving the cursor across the
map.

### 5.3 Measure

One measure: absolute GEL. No measure pill.

The design file defaults its map to per-capita and offers `ერთ სულზე ₾` /
`სულ ₾` pills. Spec 1 §8 rules per-capita out — the archived population column
stops in 2021 and its provenance is unreviewed — so the pill loses one of its
two options and is removed rather than left as a control with a single state.

### 5.4 KPIs

Four, in the DESIGN.md §7.11 analysis-headline variant (serif, four per row, two
per row below 1100px). All computed from served facts; nothing hardcoded.

| Label | Value | Detail |
|---|---|---|
| `მუნიციპალური ხარჯი` | latest-year total, 5.63 მლრდ ₾ | `{year} · 64 მუნიციპალიტეტი` |
| `ზრდა {firstYear}-დან` | +176% | `2.03 → 5.63 მლრდ ₾` |
| `თბილისის წილი` | 37.5% | `დანარჩენი 63 ერთეული — 62.5%` |
| `უმსხვილესი სფერო` | 31.5% | `ეკონომიკური საქმიანობა` |

The third replaces the design's `ერთ სულზე`. The fourth replaces its `სხვაობა`,
which was a max/min ratio — 125× on absolute values, a statement that თბილისი is
large rather than a finding. Concentration says the same thing truthfully in one
number.

The first three KPIs read `public_total_gel`, the official headline. The fourth
is necessarily computed on `functional_sum_gel`, because a function's share can
only be a share of the functional total (§8). The values coincide nationally in
2025, but the rule is stated so a future year with divergence does not produce a
share that fails to reconcile with the headline above it.

## 6. Municipality page (`/explorer/municipalities/[code]`)

### 6.1 Header

H1 `როგორ ხარჯავს ბიუჯეტს {displayNameKa}`, with the name as the trigger for the
entity picker. Meta line: `{region} · {rank} ადგილი 64-დან {latestYear} წელს`,
replacing the design's per-capita rank line.

`← {prev}` / `{next} →` walk the registry's official `municipality_sort_id`.
That order is roughly region-grouped in the source (codes `06` and `07` are both
აჭარა), so stepping through it stays geographically coherent.

### 6.2 Entity picker

The design's grouped list: regions as headers with their municipalities beneath,
searchable, `⌘K` / `Ctrl+K` to open, `Escape` to close and return focus to the
trigger, clicking a region header opens that region's page.

Built as a plain popover with roving focus and `aria-expanded` on the trigger,
not a full command palette. It is the most expensive interactive element in this
spec and it earns its place: with 64 entities, prev/next and a trip back to the
index are not sufficient navigation.

### 6.3 Workspace

Mirrors the budget explorer, which is the point of reusing its parts:

- `SegmentedTabs` for `ხაზი` / `ცხრილი`.
- `% წილი` pill and unit note, then `EditorialLineChart` or `ExplorerTable`.
- `RangeStrip` beneath, over 2015-2025, with the range quick chips.
- Aside: the ten functions as a flat checkbox list with search, select-all, a
  mono latest value per row, the over-limit `Callout`, a CSV button, and
  `← ყველა მუნიციპალიტეტი`.

Chart cap is the existing `MAX_CHART_SERIES = 6`; the table always shows all ten.
Default selection is **top 5 by latest year in range, with no total series** —
the AGENTS.md guardrail, which deliberately overrides the design file's pinned
`__total` entry. Derived totals are not selectable series here any more than they
are on the budget side; totals live in the `სულ` row and the KPI.

The aside is a flat list, not the budget explorer's `SeriesPanel`. Municipal
functions have no hierarchy, so the panel's program expansion, caret locking and
`hasChildren` machinery would all be dead weight.

**`municipal.defence` is a real structural break**, not a data gap: ~9.7M ₾ in
2023, 12,081 ₾ in 2024, 0 in 2025. These are genuine zeros, not nulls, so the
chart draws the line down to zero rather than breaking it. The null-splitting
rule of DESIGN.md §8.3 does not apply.

### 6.4 KPIs

Four, same variant as the index.

| Label | Source |
|---|---|
| `ოფიციალური ბიუჯეტი` | `public_total_gel` at range end |
| `ზრდა {startYear}-დან` | change across the selected range |
| `უმსხვილესი სფერო` | largest function's share at range end |
| `წილი მუნიციპალურ ხარჯებში` | this municipality's share of the national municipal total |

The fourth replaces the design's per-capita KPI: it is the size-independent
placement figure that per-capita was there to provide.

### 6.5 Below the workspace

- **Movers board** per DESIGN.md §7.13: grid `24px 1fr 96px 72px`, two columns
  `ყველაზე მზარდი` / `ყველაზე ნელი ზრდა`. A bottom mover that is still growing
  keeps the `ნელი ზრდა` wording — never call growth a loss.
- **`პერიოდის შედარება`**: total plus ten functions, from / change / to across
  the selected range. The budget explorer has no comparison table, so this is
  the one element here without a counterpart elsewhere in the app. It is
  included because with only ten functions the municipality page is otherwise
  thinner than the budget pages, and it answers "what changed over the period"
  in a single view.

## 7. Region pages (`/explorer/municipalities/region/[id]`)

Same workspace as a municipality page, fed by the roll-up: each function summed
across member municipalities, and **both totals summed independently** so the two
measures stay separate at region grain.

### 7.1 The member list

What a region page has that a municipality page cannot: its member
municipalities, ranked, each with its latest-year total and a link through. The
chart shows what the region spends on; the member list shows who spends it.

Meta line: `{N} მუნიციპალიტეტი · {rank} ადგილი 11-დან`. Prev/next walk the
taxonomy `sortOrder`. The picker is shared with the municipality page.

KPIs are the same four as §6.4, with region denominators: the rank is out of 11
rather than 64, and `წილი მუნიციპალურ ხარჯებში` is the region's share of the
national municipal total.

### 7.2 Georgian

Two details that need handling rather than papering over.

- **Ordinals.** Rank 1 is `პირველი ადგილი`, not `მე-1 ადგილი`. One helper, unit
  tested, used by both page types.
- **Genitive region names.** The headline needs `იმერეთის`, not `იმერეთი`, and
  deriving Georgian genitives mechanically is the trap that already made
  `display_name_ka` a reviewed field rather than a computed one (Spec 1 §4). So
  the eleven genitive forms are reviewed once and stored — but **as a UI-side
  constant** in `lib/explorer/municipalLabels.ts`, keyed by region id, **not** in
  `data/taxonomy/municipal-regions.json`.

  The reason is cost. `municipal-regions.json` is mirrored by the
  `MunicipalRegion` Prisma model and parity-checked on `{id, kaLabel, sortOrder}`
  (`servedData.ts`). Adding a field there means a schema change, a migration, an
  import-script change, a live `npm run data:import` against Supabase, a
  `mirrorRows.ts` change and a parity re-verification — a database migration
  inside a UI spec, for one word in one headline. The genitive is display copy
  consumed by exactly one component; it belongs with the UI.

  A unit test asserts the constant covers all eleven region ids, so a future
  region can never render an undefined headline.

### 7.3 Source note

Region pages carry the roll-up caveats verbatim, because a region total is
otherwise read as complete territorially attributed spending:

- აჭარა excludes the Adjara autonomous republic's own budget.
- შიდა ქართლი and მცხეთა-მთიანეთი exclude the four affected municipal bodies.
- A roll-up is the sum of publicly served municipal budgets only.

## 8. The two totals, and warnings

`public_total_gel` and `functional_sum_gel` are different measures and are never
reconciled by adjusting a category. On the served data they differ at all on 548
of 704 rows, exceed the GEL 1M warning threshold on 45 rows across 12
municipalities, and reach 13.5% at worst (სამტრედია 2016). At national roll-up
the divergence stays under 1.9% and is exactly zero in 2015 and 2025 — 2015
because every row that year uses `portal_functional_total_fallback`, where the
official total *is* the functional sum by construction.

### 8.1 Where each number appears

| Where | Number | Label |
|---|---|---|
| First KPI, municipality and region pages | `public_total_gel` | `ოფიციალური ბიუჯეტი`, detail `{year} · ფინანსთა სამინისტროს ჯამი` |
| Index list, index KPIs, map colour | `public_total_gel` | the official headline |
| Table `სულ` row, chart total, CSV | `functional_sum_gel` | unit note reads `ათი ფუნქციის ჯამი` |

### 8.2 The callout

A `Callout` appears directly under the workspace on a **municipality page**, and
only when `show_warning` is true for at least one year inside the selected range.
It names the years and the amount, using the methodology's public wording for the
row's `warning_type`. Changing the range so that no warning year is selected
removes it.

Region pages get **no callout**. Their two totals are summed independently and
can still diverge, but warning type and reconciliation wording are
municipality-grain provenance that cannot be attributed honestly to the
aggregate. Aggregating member warnings would also create a near-permanent
banner on heavily visited regions. The standing two-measures source note remains.

Every municipal surface — index, municipality, region — carries the standing
one-line source note explaining that the official headline and the functional sum
are different measures, whether or not a callout is showing.

## 9. Architecture and data layer

The existing explorer's presentation components are already generic; its model
layer is what is welded to budget facts. That is the seam this spec builds on.

**Reused unchanged:** `EditorialLineChart` (takes `{years, series: ChartSeries[],
share}`), `RangeStrip` (`{years, range, onChange}`), `Sparkline`, and the
editorial primitives `Callout`, `SegmentedTabs`, `TextTab`, `SourceNote`,
`Overline`, `SectionTitle`, `SwatchBar`.

**Two decoupling changes**, both removing a coupling rather than adding one:

1. `ExplorerTable` takes `scope: ExplorerScope` and uses it in exactly one place,
   to look up a column header from a three-entry record. It becomes
   `firstColumnLabel: string`, with the lookup moved to its one caller
   (`explorer-view.tsx`).

2. **The value unit must become a parameter.** `formatBn` renders billions with
   two fixed decimals, and both `ExplorerTable` (cell values, total row) and
   `EditorialLineChart` (axis unit string, tooltip values) hardcode it. At
   municipal magnitudes that is unusable: ლენტეხი's 16.9M total renders as
   `0.02` and every one of its ten functions renders as `0.00`. The chart's axis
   *decimal count* already adapts (`decimalsFor`), but its divisor and the
   literal `მლრდ` label do not.

   `format.ts` gains a `ValueUnit = { divisor, label, decimals }` with exported
   `UNIT_BN` (1e9, `მლრდ`, 2) and `UNIT_MLN` (1e6, `მლნ`, 1), plus
   `formatInUnit(value, unit)`. Both components take a `unit: ValueUnit` prop;
   the existing budget callers pass `UNIT_BN`, preserving current output exactly,
   and the municipal explorer passes `UNIT_MLN`.

**One signature change:** `buildHubCards(facts)` gains a second parameter for the
municipal total series, because hub card 03 stops being blank (§3.1) and its
sparkline and footer must be derived from served facts like cards 01 and 02.

### 9.3 Category colours

`lib/explorer/colors.ts` has no `municipal.*` entries, so `colorForItem` would
fall back to positional palette cycling — which contradicts DESIGN.md §4.2's rule
that category colours are stable tokens. Ten tokens are added, reusing the
existing semantic colours so a concept keeps its colour across the whole site:

| Function | Token | Shared with |
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

All ten values are distinct, so no two functions collide on a chart. DESIGN.md
§4.2 gains the same table.

**Not reused:** `buildExplorerModel`, `useExplorerState` and the budget hash
functions. They are built around sides, groupings and a national item×year grain;
the municipal grain is municipality×function×year with two totals and no side.
Widening them would push conditionals into a 579-line module that three shipped
routes depend on, for no gain — see AGENTS.md "Surgical Changes" and "Simplicity
First". `SeriesPanel` is likewise not reused (§6.3).

### 9.1 New modules

```text
lib/explorer/municipalData.ts    pure model builders: ExplorerTableRow[]/ChartSeries[]
                                 for an entity, index rows, region roll-ups, KPIs,
                                 movers, comparison rows
lib/explorer/municipalGeo.ts     projection, the shape↔region join, buildRegionShapes()
lib/explorer/urlState.ts         gains parseMunicipalHash / serializeMunicipalHash

components/municipalities/
  municipalities-index.tsx       client: level tabs, search, list, shared hover state
  region-map.tsx                 client: choropleth, tooltip, hover readout
  municipal-explorer.tsx         client: shared workspace for municipality and region
  entity-picker.tsx              client: the ⌘K popover
  municipal-indicators.tsx       KPIs, movers board, comparison table
```

`municipalData.ts` and `municipalGeo.ts` are pure — no React, no I/O — so both
are unit-testable directly against the served CSVs.

### 9.2 Payload

Pages are server components calling the existing `loadServedMunicipalData()`,
which Spec 1 already kept out of `ExplorerData` for this reason. Each page
receives only what it needs:

- Municipality page: its own 110 function facts and 11 total facts, the
  registry (64 small rows) for the picker and rank context, and the taxonomy.
- Region page: its members' facts, plus the same registry and taxonomy.
- Index: latest-year totals only, plus the projected shape paths.

The full 7,744-row corpus is never shipped to a client.

## 10. Testing

### 10.1 Unit (vitest, `tests/explorer/`)

New `municipalData.test.ts` and `municipalGeo.test.ts`:

- The region↔shape join is **total in both directions**: 12 shapes resolve to 11
  served regions plus exactly one explicit no-data (`აფხაზეთი`), and every served
  region resolves to exactly one shape.
- The projection is deterministic and bounded — same input, same path string,
  every point inside the viewBox.
- The two totals are never conflated: a municipality-year where they differ
  produces a different number in the KPI than in the `სულ` row.
- Region roll-ups sum both totals independently, and the ten functions sum to
  the region's `functional_sum_gel`.
- Warning selection is range-scoped: a range excluding all warning years shows
  no callout; one including them names the right years.
- Default selection is top 5 by latest year and contains no derived total.
- The Georgian ordinal helper, including the `პირველი` case.
- `formatInUnit` in both units, and a regression asserting `UNIT_BN` output is
  byte-identical to the current `formatBn` for the existing budget callers.
- All ten `municipal.*` colour tokens resolve, and no two are equal.
- The genitive constant covers all eleven region ids (§7.2).
- Hash round-trip for `lvl` and the reused keys; unknown values fall back,
  ranges clamp.

### 10.2 Data validation (`npm run data:validate`)

Gains the same join assertion, so a change to the registry or the region
taxonomy fails the data gate rather than only a component test. This is the
assertion Spec 1 §7 deferred to this spec.

### 10.3 Browser (`tests/browser/municipalities.spec.ts`)

- Index: map and legend render, list tabs switch grain, search filters and
  clears, a row click reaches the right municipality page.
- Municipality page: mode switch, series toggle past the six-series cap shows
  the limit callout, range change updates the chart.
- Warning callout present on თბილისი (9 warning years), absent on a clean
  municipality such as თელავი.
- Region page shows its member list, and the member count matches the registry.
- Shell: the sidebar `მუნიციპალიტეტები` row is a link with no `მალე`, and hub
  card 03 links to the implemented route.

## 11. Documents updated in this change

- `DESIGN.md` §4.2 (the ten `municipal.*` colour tokens), §6.2 (route list),
  §6.7 (hub-card table row and sidebar wording), plus a new section specifying
  the municipal surfaces.
- `AGENTS.md` Current Project State — municipal flips from data-only to routed.
- `docs/data-methodology/municipal-functional-annual-2015-2025.md` — the region
  shape join keyed on `shapeISO`, and its provenance and licence.
- `apps/web/lib/landing/georgiaGeo.ts` header comment — provenance of the region
  rings changes from GADM to geoBoundaries `gbOpen` ADM1, with the CC BY 3.0
  attribution and release pin covering both the rings and the ADM0 outline.

`Project_Definition.md` is updated in this branch so the v1 scope entry records
the municipal index, municipality pages, and region roll-ups implemented here.

## 12. Explicitly not shipping

- **A municipality-level (ADM2) map.** Deferred with its research task intact;
  see §2, decision 1. Nothing in this spec depends on it.
- **Per-capita anything.** Spec 1 §8 stands. A reviewed Geostat population
  dataset is a separate future spec.
- **The six selected-detail rows.** Still unimported, per Spec 1 §2.
- **Comparison between municipalities on one chart.** The section compares a
  municipality against its own history and ranks it against the others; it does
  not plot two municipalities together. That is a different product.

## 13. Definition of done

1. `npm run check` green (lint, typecheck, unit tests, data validation).
2. `npm run build` green, and `GEODATA_DATA_SOURCE=db npm run build` green.
3. `npm run test:browser` green, including the new municipalities spec.
4. Methodology and scope docs updated in the same change (§11).
5. CI green before merge.
