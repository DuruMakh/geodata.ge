# Explorer interaction consistency: specification

Date: 2026-09-17
Status: Draft for user review. Scope and packaging were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 3 of 8. This spec fixes behaviour only; spec 8 later unifies the hash code behind it.

## 1. Outcome and scope

The newer explorers behave like the established ones when a reader changes state, shares a link or uses Back:

1. URL hash writes never stamp a pristine URL and never flood browser history.
2. Clearing the debt selection can be undone from the same control.
3. Sector search and screen-reader announcements follow the site's shared behaviour.
4. The economy hub heading and the GDP and sectors coverage lines match every other explorer.
5. DESIGN.md §6.3 documents the hash keys each section actually uses.

### 1.1 User-approved decisions (2026-09-17)

- Packaging only.

### 1.2 Decisions taken in this spec

- **Keys keep their names.** GDP and sectors keep their hash keys (`indicator`, `view`, `currency`, `measure`, `range`/`start`/`end`), and DESIGN.md documents them. Migrating them to `m`/`r` would break shared links and change pinned tests (`tests/browser/gdp-overview.spec.ts:61`, `:64`), for no reader benefit.
- **Write rule.** `replaceState` for every change, except discrete top-level switches that a spec asks Back/Forward to step through: the sectors measure and view, as today (`tests/browser/economic-sectors.spec.ts:164-182`).
- **"Select all" restores the default on debt.** On the debt panel it restores the active family's default selection, following the inflation categories precedent (commit `d7c2612ef`).
- **Deficit `sh` default stays documented.** Deficit keeps treating a missing `sh` as percent, because its default measure is % of GDP. DESIGN.md records this rather than changing link behaviour.

## 2. URL hash writes

### 2.1 Evidence

- **Established rule.** The budget explorer skips the mount write, so a default state never "clobber[s] an incoming deep link (and stamp[s] pristine URLs)" (`components/main-explorer/use-explorer-state.ts:181-193`). Debt, deficit and municipal follow it.
- **Hash stamped on load.** GDP writes `#${serializeGdpHash(state)}` as soon as it is ready (`components/gdp/gdp-overview.tsx:58-60`), so a clean `/explorer/economy/gdp` becomes `…#indicator=real&view=line&currency=gel&range=all` on first load. Both inflation pages do the same (`components/inflation/inflation-overview.tsx:61-63`, `components/inflation/inflation-categories.tsx:87-89`).
- **History flood on sectors.** The sectors `update` calls `pushState` on every change (`components/economic-sectors/use-economic-sectors-state.ts:41-51`). The range strip fires `onChange` once per year boundary crossed during a drag (`components/main-explorer/range-strip.tsx:80-91`) and once per arrow key press (`:143-148`). A back-and-forth drag or a held arrow key adds entries without bound, and each Back step restores an intermediate range.
- **Undocumented `x` key.** Inflation categories write `x` (expanded divisions, `lib/explorer/inflationCategories.ts:456`, `:465`), which neither the categories spec (`:216`) nor DESIGN.md mentions.

### 2.2 Change

- **GDP and both inflation pages:**
  - Skip the first write after the parsed state is applied (the budget explorer's pattern).
  - Later writes use `replaceState`.
  - A deep link is still parsed and applied as before.
- **Sectors:**
  - `update(change, history)` takes `"push"` or `"replace"`.
  - Measure and view changes push; range and selection changes replace.
  - The mount path writes nothing.
  - `popstate` and `hashchange` restore stays as it is (`:33-34`).
- **Errors:** every write is wrapped in the same try/catch as the budget explorer, since history can be unavailable in embedded contexts.

### 2.3 Tests

- **Browser, pristine URLs:** loading each of `/explorer/economy/gdp`, `/explorer/inflation/overview` and `/explorer/inflation/categories` without a hash leaves `location.hash === ""` after `expectAppReady`. A deep link with a hash still restores its state (existing tests stay).
- **Browser, sectors history:**
  1. Record `history.length`.
  2. Click a measure (+1).
  3. Drag a range handle across at least five years (+0).
  4. Press ArrowRight five times on a handle (+0).
  5. Go back: the previous measure returns.

  The existing measure back/forward test (`economic-sectors.spec.ts:164-182`) stays.
- **Unit:** the sectors state hook, if it is unit-tested, asserts which operations push and which replace.

## 3. Debt "Clear" — `components/debt/debt-series-panel.tsx:94-98`

Evidence:

- The panel passes `allSelected={false}`, `onToggleAll={() => onSelectionChange([])}` and `allowSelectAll={false}`.
- The selector hides its bulk button when nothing is selected and select-all is disallowed (`components/main-explorer/series-selector.tsx:65`). After "Clear" the bulk control disappears, and the hash keeps the empty `sel=` across a reload (`lib/explorer/debtUrlState.ts:52`).
- The same defect was fixed for inflation categories in `d7c2612ef`, with a browser test ("clearing the selection can be undone from the same control").
- `tests/explorer/debtRoute.test.tsx:368` currently pins the suppressed control.

Change:

- Remove `allowSelectAll={false}`.
- `onToggleAll` clears when anything is selected, and otherwise restores `getDefaultDebtSelection(activeFamily)` (`lib/explorer/debtExplorer.ts:83`).
- `allSelected` is true when the selection equals that default.
- The count text is unchanged (`სერიები {selected} / 9`).

Tests:

- Rewrite `debtRoute.test.tsx:368` as "offers the bulk control on an empty selection and restores the family default".
- Add a browser test in `tests/browser/debt.spec.ts`: click `series-toggle-all` down to an empty selection, then back up to the stock total.

## 4. Sector search and announcements

### 4.1 Search — `components/economic-sectors/sector-series-panel.tsx:35-41`

Evidence: the panel lowercases and substring-matches `${labelKa} ${labelEn} ${classificationCode}` with the runtime locale. Every other panel uses `matchesLabelQuery(query, values)` (`lib/i18n/search.ts`), which applies NFC normalisation and `en` lowercasing.

Change: `matches(r)` becomes `matchesLabelQuery(query, [r.labelKa, r.labelEn, r.classificationCode ?? ""])`. The Total GDP row stays pinned, which is the site's total-row pattern.

Test: a unit test of the panel covers a Georgian label query, an English label query, a NACE code (`J`) and a non-matching query that still shows the Total GDP row.

### 4.2 Announcements — `components/economic-sectors/economic-sectors-explorer.tsx:117-122`

Evidence: a permanent `role="status"` element re-announces `sectors.rangeChanged` on every range change. GDP announces only when the indicator changes, from state set by the change handler (`components/gdp/gdp-overview.tsx:46`, `:152`).

Change: sectors follow the GDP pattern. An `announcement` state is set when the measure changes, carrying the measure context; range changes are not announced, because the range strip's slider values already are. `sectors.rangeChanged` is removed if nothing else uses it.

Test: a unit test asserts that changing the range leaves the status text unchanged, and that changing the measure updates it.

## 5. Heading and coverage line

Evidence:

- `lib/pages/economy.tsx:43` renders the economy hub H1 at a fixed `text-[40px]`, without the `text-[30px] … min-[768px]:text-[40px] leading-[1.15] tracking-[-0.01em]` classes every other explorer heading uses (e.g. `components/debt/debt-explorer.tsx:148`).
- The GDP coverage line prints `{min}–{max} · {YYYY-MM-DD}` (`components/gdp/gdp-overview.tsx:112-115`), and so does the sectors one (`lib/pages/economic-sectors.tsx:42`).
- Debt, deficit and inflation use `main.updated` with `formatDisplayDate` in English (`components/debt/debt-explorer.tsx:121-124`).

Change:

- The economy H1 uses the shared heading classes.
- GDP and sectors build `{first}–{last} · main.updated {date}`, formatting the date with `formatDisplayDate(date, "en")` in English and keeping ISO in Georgian, exactly as debt does.

Tests:

- The GDP and sectors route tests assert "Updated" in English and `განახლდა` in Georgian.
- A browser check at 390px asserts the economy H1 computes `font-size: 30px`.

## 6. DESIGN.md §6.3 (`:325-337`)

Replace the single key list with the shared keys, plus a per-section table:

| Section | Keys | Notes |
|---|---|---|
| Expenditure, revenue, analysis | `g`, `m`, `sh`, `r`, `sel`; `as`, `ag`, `ay` | As today |
| Debt | `f`, `m`, `sh`, `r`, `sel` | `f` is the family; an empty `sel=` is a deliberate clear |
| Deficit | `m`, `sh`, `r`, `sel` | Missing `sh` means percent (the section defaults to % of GDP) |
| GDP | `indicator`, `view`, `currency`, `range=all` or `start`/`end` | |
| Economic sectors | `measure`, `view`, `sel`, `range=all` or `start`/`end` | Measure and view changes push a history entry |
| Inflation overview | `i`, `m`, `r=YYYY-MM-YYYY-MM`, `sel`, `t` | As the overview spec |
| Inflation categories | `i`, `m`, `r`, `sel`, `t`, `x` | `x` lists expanded divisions |

Add the write rules from §1.2: a pristine URL is never stamped, continuous changes replace, and only listed discrete switches push.

## 7. Non-goals

- Renaming any hash key.
- Changing the deficit `sh` default.
- The deficit (one row) and inflation overview (four rows) panels that hide the bulk control; they are within the five-row bar set in `d7c2612ef`.
- Unifying the seven hash codecs (spec 8).

## 8. Verification and acceptance

Feedback while editing:

```bash
npx vitest run tests/explorer/debtRoute.test.tsx tests/explorer/economicSectors.test.ts tests/explorer/gdpOverview.test.ts
```

```bash
npx playwright test tests/browser/economic-sectors.spec.ts tests/browser/gdp-overview.spec.ts tests/browser/inflation-overview.spec.ts tests/browser/inflation-categories.spec.ts tests/browser/debt.spec.ts
```

Done-check: `npm run check`, `npm run build` and `npm run test:browser` on the production-build recipe.

Acceptance, in both locales:

- pristine URLs stay clean
- a range drag on sectors adds no history entries
- debt "Clear" can be undone from the same control
- sector search matches `J` and both label languages
- the sectors status region is silent on range changes
- the economy H1 is 30px on phones
- GDP and sectors coverage lines read "Updated …" in English

## 9. Authority and next step

This spec owns the bounded decisions in §1. DESIGN.md stays the owner of URL-state rules and is amended in the same change. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-explorer-interaction-consistency.md`.
