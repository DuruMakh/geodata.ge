# Municipal data → serving layer (design)

Date: 2026-08-02
Status: approved design, amended 2026-08-03
Scope: data only. No UI ships in this spec.

## 1. Why this exists

`docs/Raw Data/Municipalities/combined-annual-2015-2025/` holds a finalized, validated
research package covering 69 official municipal rows for 2015-2025. Its methodology doc
(`docs/data-methodology/municipal-functional-annual-2015-2025.md`) records status `PASS`
and states plainly that the package "is not imported into the GeoData.ge application or
serving database."

This spec makes it a served dataset on the same terms as expenditure and revenue, so that a
later UI spec has something real to render. It is the first of two specs; the second covers
the municipalities UI (index map, list, municipality and region pages).

The work is authorized by the user on 2026-08-02. `Project_Definition.md` §2 currently lists
"Municipal budgets explorer, and any municipal data or route" as excluded from v1 and says
building it out needs explicit approval. That approval is now given and the scope documents
are updated as part of this change (§9).

## 2. What ships

Ten main functional categories per municipality per year. Nothing else.

- Period: 2015-2025, eleven years.
- Geography: 64 publicly served municipalities. The two autonomous republic budgets and five
  municipal bodies associated with occupied territories stay outside the public dataset.
- Currency: nominal GEL. Basis: `actual`.
- Grain: 10 functions × 64 municipalities × 11 years = **7,040 functional rows**, dense.
- Plus **704 total rows**: 11 years × 64 municipalities.

### Explicitly not shipping

- The six selected-detail rows (`7.1.1`, `7.4.5.1`, `7.5.1`, `7.8.1`, `7.8.2`, `7.9.1`,
  4,554 rows). They stay in the raw package, unimported. The methodology doc will say this
  is a decision, not an oversight.
- Population. See §8.
- Any sub-annual data. The package is annual by design.

Dropping the details removes the non-additivity hazard entirely: the ten main functions are
mutually exclusive and sum exactly to `functional_sum_gel`, so there is no way for a consumer
to double-count and no invariant to enforce at read time.

## 3. Function mapping

`functional_code` maps to a semantic `category_id` at the import boundary. The raw package is
never rewritten, so its recorded SHA-256 hashes and PASS validation report stay valid.

| Sort | Code | `category_id` | Georgian label |
|---:|---|---|---|
| 1 | 7.1 | `municipal.general_public_services` | საერთო დანიშნულების სახელმწიფო მომსახურება |
| 2 | 7.2 | `municipal.defence` | თავდაცვა |
| 3 | 7.3 | `municipal.public_order_safety` | საზოგადოებრივი წესრიგი და უსაფრთხოება |
| 4 | 7.4 | `municipal.economic_affairs` | ეკონომიკური საქმიანობა |
| 5 | 7.5 | `municipal.environment` | გარემოს დაცვა |
| 6 | 7.6 | `municipal.housing_communal` | საბინაო-კომუნალური მეურნეობა |
| 7 | 7.7 | `municipal.health` | ჯანმრთელობის დაცვა |
| 8 | 7.8 | `municipal.recreation_culture` | დასვენება, კულტურა და რელიგია |
| 9 | 7.9 | `municipal.education` | განათლება |
| 10 | 7.10 | `municipal.social_protection` | სოციალური დაცვა |

Rationale for renaming rather than keeping `municipal_function.7_1`: `AGENTS.md` Data Rules
require stable lowercase ASCII semantic IDs and every shipped taxonomy follows that
(`spending.health`, `revenue.vat`, `admin_spending.education_science_youth`). The code-derived
IDs also sort wrong lexically (`7_1`, `7_10`, `7_2`), which would force a separate sort key
into every consumer. `functional_code` is retained as a data-layer column.

`municipal.defence` and `municipal.public_order_safety` are small at municipal level but are
official main functions. They ship. Omitting them would leave a silent hole in the total,
which the Data Rules forbid.

## 4. Municipality registry

A new reviewed file, one row per municipality:

| Field | Meaning |
|---|---|
| `municipality_code` | Official code, stored as text so leading zeros survive |
| `municipality_sort_id` | Official sort order from the source |
| `name_ka` | Official long form, e.g. `ქალაქ თბილისის მუნიციპალიტეტი` |
| `display_name_ka` | Short form for map and list, e.g. `თბილისი` |
| `region_id` | Semantic region ID, see below |
| `is_self_governing_city` | Boolean; the design renders these as dots on the map |

There is deliberately no `map_shape_id`. See §4.3.

`display_name_ka` is a reviewed editorial field, not a derived one. Stripping
`ქალაქ …ის მუნიციპალიტეტი` mechanically produces wrong Georgian for several units, so each
short form is reviewed once and stored.

### Five official rows excluded from public serving

The raw MoF package contains five real budget series under municipality codes `05`, `42`,
`43`, `46`, and `64`. Source review established that these are budgets of Georgian municipal
bodies operating outside the occupied territories and serving displaced communities, not
territorially attributable municipal expenditure delivered inside those occupied areas.

By user decision on 2026-08-03, those five codes are retained unchanged in the raw source
archive but excluded from the GeoData.ge municipality registry, function facts, total facts,
regional aggregates, rankings, and future municipality UI. The exclusion is applied at the
raw-to-served generation boundary so regeneration cannot silently restore the rows.

`05 აჟარის` is Azhara / Upper Abkhazia, not Adjara. Its removal leaves no publicly served
municipality in `region.abkhazia`, so that region is not part of the municipal data taxonomy.
Future map geometry may still render occupied territory with an explicit no-data treatment.

### Regions

Eleven data-bearing regions with semantic IDs (`region.tbilisi`, `region.adjara`,
`region.imereti`, `region.kvemo_kartli`, `region.samegrelo_zemo_svaneti`,
`region.shida_kartli`, `region.guria`, `region.kakheti`, `region.mtskheta_mtianeti`,
`region.samtskhe_javakheti`, `region.racha_lechkhumi_kvemo_svaneti`).

Municipality counts: Tbilisi 1, Adjara 6, Kakheti 8, Imereti 12,
Samegrelo-Zemo Svaneti 9, Shida Kartli 4, Kvemo Kartli 7, Guria 3, Samtskhe-Javakheti 6,
Mtskheta-Mtianeti 4, Racha-Lechkhumi and Kvemo Svaneti 4 — 64 in total.

No region column exists anywhere in the source data — this is genuinely new reviewed
mapping, assigned from the official administrative division and reviewed once.

A region roll-up is the sum of publicly served municipal budgets in that region. For აჭარა it
therefore does **not** include the Adjara autonomous republic's own budget, which the package
excludes. Shida Kartli and Mtskheta-Mtianeti likewise exclude the four affected municipal
bodies assigned to them in the raw source package. These caveats must appear in region source
notes because the totals are otherwise read as complete territorially attributed spending.

### 4.3 Map shape join — deferred to Spec 2

The join is **not** in this spec. Resolving it during planning on 2026-08-02 turned up two
blockers that make it a research task with a possible "none of these fit" outcome:

- The design file's geometry cites `bumbeishvili/geojson-georgian-regions`. That repository
  has **no license** — GitHub reports the license field as null, so it is all-rights-reserved
  and cannot be vendored.
- The obvious open replacement, geoBoundaries `gbOpen/GEO/ADM2`, is Public Domain (sourced
  from Wikimedia Commons) but represents **2007** and carries **68 units**. It does not match
  the 64-unit public serving registry one-to-one and predates the 2014 reform that created the
  self-governing cities.

Neither is adoptable without review, and none of the tabular work below depends on the
answer. The join therefore moves to the first task of Spec 2, where the geometry is actually
consumed and a wrong join is visible on screen rather than only in a test.

When it lands, the rule stands: every shape resolves to a municipality or to an explicit
`no_data` reason — occupied territory (Abkhazia, Tskhinvali region) or non-budget unit — and
every municipality resolves to exactly one shape. No shape silently unmapped, mirroring the
existing rule that no official row disappears silently from totals.

## 5. Fact files in `data/imports/`

Both UTF-8 **without** BOM. The Georgian-CSV BOM rule covers files intended for direct human
opening in Excel and explicitly keeps internal machine-CSV encoding separate. `data/imports/`
is the machine tier and its existing files carry no BOM (verified on
`budget-facts-2005-2025.csv` and `admin-spending-facts-2005-2025.csv`, both of which contain
Georgian text). The human-review tier is the raw package under `docs/Raw Data/`, which
already carries its BOM and is not modified here.

**`municipal-function-facts-2015-2025.csv`** — 7,040 rows.
Year, municipality code, `category_id`, `functional_code`, amount GEL, basis, and the
provenance columns the research package already carries (source family, source file, source
URL, transformation, last reviewed at).

**`municipal-total-facts-2015-2025.csv`** — 704 rows.
`public_total_gel`, `public_total_measure`, the four official components
(`expenses_gel`, `nonfinancial_asset_growth_gel`, `financial_asset_growth_gel`,
`liability_decrease_gel`), `functional_sum_gel`, `reconciliation_difference_gel`,
`warning_amount_gel`, `show_warning`, `warning_type`, plus provenance.

### The two totals

These are different measures and the serving layer keeps them separate, never reconciled by
adjusting a category.

- `public_total_gel` is the official MoF headline and the downstream UI total for the selector,
  chart, table, KPIs, comparisons, percentage denominator, and numeric CSV total row.
- `functional_sum_gel` is the sum of the ten served functions and remains reconciliation data;
  it is not a public explorer total or percentage denominator.

They differ on 45 municipality-years by more than GEL 1 million, because functional
classification does not distribute financial-asset growth or liability repayment. That is a
real property of the source, not an error.

This is unlike expenditure and revenue, where the derived sum already *is* the official
total: every official row there is mapped, `spending.other_unclassified` catches the
remainder, so the two numbers coincide and the distinction never had to surface. No change is
needed on those pages.

`show_warning` and `warning_type` retain internal reconciliation classifications
(`source_version_difference`, `financing_outside_functional`,
`reconciliation_review_required`). The serving layer ships the flags for validation; the
explorer does not render them.

## 6. Prisma models and import

Three models mirroring the registry and the two fact files. `npm run data:import` gains the
municipal dataset with the same row-by-row CSV↔DB parity check the existing datasets use.
The database is never edited directly (`docs/data-methodology/database-import.md`).

## 7. Validation

Added to `npm run data:validate`:

- 7,040 functional rows; 704 total rows; both dense (11 × 64, and 10 × 64 × 11).
- No duplicate keys; no null, non-numeric, or negative functional amounts.
- Every municipality resolves to exactly one region; every region has at least one
  municipality.
- Every municipality resolves to exactly one region; region IDs are a closed set of eleven.
  (The map-shape join is asserted in Spec 2, per §4.3.)
- Warning counts match the methodology exactly: 24 `source_version_difference`,
  21 `financing_outside_functional`, 1 `source_actual_missing` (Khulo 2024, non-warning).
- For every municipality-year, the ten functions sum to `functional_sum_gel`.
- Encoding regression: both output CSVs are UTF-8 with no BOM, matching the other
  `data/imports/` files, and round-trip Georgian text unchanged.

## 8. Population

Not shipped.

The archived MoF portal export in the raw package carries a `Population` column for all 69 municipalities,
2015-2021 (Tbilisi 1,115,689 → 1,202,731, consistent with Geostat). It is empty from 2022.

It stays out of `data/imports/` for two reasons. It stops four years short of 2025, so it
cannot support a latest-year per-capita measure, which is what the design's map defaults to.
And its provenance is unreviewed — Georgia's registered-population and Geostat
resident-population figures diverge substantially, and the package author explicitly recorded
that no population adjustment is applied rather than use the column that was present.

Putting an unreviewed column into the canonical serving source would break the project's own
data rules. It is recorded here as a named candidate dataset: sourcing municipal population
2015-2025 from Geostat, reviewing it, and adding a per-capita measure is a separate future
spec.

Consequence for the UI spec: map measures are absolute GEL and growth, not per capita, and
the design file's two per-capita KPIs and its `ერთ სულზე მე-N ადგილი` rank lines are replaced
with measures the data supports.

## 9. Documents updated in this change

- `docs/data-methodology/municipal-functional-annual-2015-2025.md` — status flips from "not
  imported"; new sections for the function mapping, the region mapping, the map-shape join,
  the detail-rows exclusion, and population.
- `Project_Definition.md` §2 — municipal data and route move from Excluded to Included.
- `DESIGN.md` §2 and §2.1 — the municipal `მალე` marker language is replaced; coverage gains
  the municipal line.
- `AGENTS.md` Current Project State — data rollout status gains municipalities.

`DESIGN.md` §6.7 and `apps/web/lib/explorer/sections.ts` still carry
`municipalities: { href: null }`. That stays until the UI spec ships the route; flipping it
here would put a live link in front of a page that does not exist.

## 10. Open items

None blocking. Map geometry provenance was the one open item; it was investigated on
2026-08-02 and moved out of this spec entirely — see §4.3.

## 11. Definition of done

- `npm run check` green (lint, typecheck, unit tests, data validation).
- `npm run data:import` parity PASSED against Supabase.
- `GEODATA_DATA_SOURCE=db npm run build` green.
- No UI change: `npm run test:browser` unchanged and green.
- Methodology and scope docs updated in the same change.
