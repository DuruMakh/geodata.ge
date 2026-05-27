# GeoData.ge V1 UI Design System Implementation

Date: 2026-05-28
Status: Approved for implementation planning

## 1. Decision Summary

GeoData.ge v1 production UI will follow the current `DESIGN.md` and the confirmed HTML references:

- `docs/Design HTML files/multiyear-apple.html`
- `docs/Design HTML files/singleyear-apple.html`

Those files are the visual source of truth for layout, theme behavior, controls, chart treatment, spacing, and section order. Older neon/terminal production styling is legacy and should be removed from the visible v1 UI unless a future approved design explicitly reintroduces it.

The implementation approach is a lean token-first conversion:

1. Create the reusable theme and component foundation.
2. Convert the production screens one by one using that foundation.
3. Verify every screen against `DESIGN.md` and the two confirmed HTML references.

This is not a broad design-system platform project. The reusable layer exists only to keep the full v1 UI pass consistent, maintainable, and testable.

## 2. Goals

- Implement the approved Light/Night visual system in production React.
- Convert the full v1 UI experience, not only the first viewport.
- Preserve existing budget data loading, explorer model building, CSV export, planned/actual semantics, and source context unless a UI requirement forces a narrow adjustment.
- Remove unconfirmed visible UI modes from production.
- Keep Georgian-first readability and responsive behavior as release criteria.

## 3. Non-Goals

- Do not create a generic public-data platform shell.
- Do not add a marketing homepage.
- Do not add clickable drilldown pages.
- Do not add admin UI, public API, user uploads, municipal transfers, capital projects, debt explorer, quarterly/monthly data, or automated production extraction.
- Do not keep the old neon/terminal styling as the default production look.
- Do not expose unconfirmed multi-year modes in the production UI.

## 4. Source-of-Truth Rules

Implementation must follow this priority order:

1. `docs/Design HTML files/multiyear-apple.html`
2. `docs/Design HTML files/singleyear-apple.html`
3. `DESIGN.md`
4. Existing production app behavior and data contracts
5. Earlier planning docs

For visual details, the confirmed HTML references win over `DESIGN.md`. If a mismatch is found, update `DESIGN.md` before or during implementation so future agents inherit the corrected contract.

If the older planning docs mention a dark, neon, terminal-like visual direction, treat that as superseded for production UI by `DESIGN.md`.

## 5. Confirmed Production UI Scope

### 5.1 Global Shell

The app uses a centered `1200px` product shell with:

- Review/page header.
- Light/Night theme toggle.
- Primary screen card.
- Product top bar inside the screen card.
- Expenditure/Revenue segmented switch.
- Multi-year/Single-year view switch.
- Minimal source/update context.

The theme switch changes tokens only. It must not change layout, chart geometry, section order, available controls, or data state.

### 5.2 Multi-Year Explorer

The production multi-year explorer includes:

- Line mode.
- Table mode.
- `% წილი` measure toggle.
- Chart panel with mode tabs inside the plot frame.
- Legend.
- Range strip.
- Series side panel with search, stable color chips, selected states, latest values, and CSV button.
- Below-chart sections: KPI cards, top movers board, and formula/start-end analysis.

The production multi-year explorer does not expose:

- Bar mode.
- Stacked mode.
- Full measure dropdown.
- Share-of-GDP control unless a future confirmed design adds it.

Existing data/model code can keep supporting unused modes internally if removing them would add unnecessary risk, but the visible v1 UI should not show them.

### 5.3 Single-Year Snapshot

The production single-year snapshot order is:

1. Year selector pills.
2. Four headline cards.
3. Full-width structure/treemap section.
4. Full-width Every 100 GEL section.
5. Budget Radar.
6. Budget Field.
7. Full ranking.

The old `SpendingPetals` production section is replaced by Budget Radar.

Every 100 GEL is a 100-cell visual explainer with no side list in v1. Exact values remain available in ranking, tooltips, table, and CSV where applicable.

### 5.4 Revenue Adaptation

Revenue uses the same visual system as expenditure:

- Same shell.
- Same themes.
- Same controls.
- Same chart/table treatment.
- Same single-year section order.

Only labels, taxonomy, data, source wording, tooltips, and CSV metadata change.

## 6. Component Foundation

Create only practical reusable pieces needed by the approved UI:

- `ThemeToggle`
- `SegmentedControl`
- `ViewSwitch`
- `MeasureToggle`
- `YearPills`
- `ScreenCard`
- `ContentSection`
- `ChartPanel`
- `SeriesPanel`
- `TableSurface`
- Compact status/empty-state surfaces where current UI states need restyling

These components should be small and local to the web app. Avoid a broad component-library abstraction.

## 7. Token and Theme Implementation

Move the current app away from hard-coded neon Tailwind classes and onto CSS custom properties matching `DESIGN.md`:

- Core colors: primary, active primary, semantic states, stable series colors.
- Light theme surface/canvas/text/hairline/grid/shadow tokens.
- Night theme surface/canvas/text/hairline/grid/shadow tokens.
- Single-year headline card gradient tokens.
- Typography stack with Georgian support.
- Radius, spacing, and motion tokens.

Theme persistence:

- Store theme in `localStorage`.
- Default to `light`.
- Apply theme through a stable attribute such as `data-theme`.
- Avoid data reloads or selection resets on theme change.

## 8. Data Flow

The UI conversion should preserve the current data flow:

1. `app/page.tsx` loads facts, glossary entries, and source documents.
2. `MainExplorer` owns interactive state: side, view mode, visible chart mode, measure/share toggle, years, selections, and CSV action.
3. Existing explorer builders produce the rows, chart points, summary, single-year model, and source context.
4. Chart, table, ranking, and CSV views consume the same filtered data model.

Implementation may introduce a small adapter layer if needed to translate current model names into presentation props, but chart components should not own budget business logic.

## 9. Implementation Order

1. Global CSS and theme persistence.
   - Verify: both Light and Night render in the app shell without data state changes.

2. Product shell and top controls.
   - Verify: shell matches the confirmed HTML structure; Expenditure/Revenue and Multi-year/Single-year remain functional.

3. Multi-year chart/table workspace.
   - Verify: only Line/Table are visible; `% წილი` toggle works; CSV remains connected to active filtered data.

4. Series panel and range strip.
   - Verify: search, selection, stable colors, latest values, limit messaging, and CSV placement work.

5. Below-chart multi-year sections.
   - Verify: KPI cards, movers board, and start/end formula analysis use real model data and approved wording.

6. Single-year snapshot sections.
   - Verify: year pills, four headline cards, treemap, Every 100 GEL, Budget Radar, Budget Field, and ranking appear in the approved order.

7. Responsive and accessibility pass.
   - Verify: desktop, tablet, and mobile layouts work in both themes; Georgian labels do not clip; controls expose accessible selected/pressed state.

## 10. Testing and Verification

Run relevant automated checks:

- `npm run lint`
- `npm run test`
- `npm run build`

Run browser verification after implementation:

- Open the local app.
- Check Light and Night theme.
- Check multi-year default state.
- Check Line/Table mode switching.
- Check `% წილი` toggle.
- Check series search and selection.
- Check CSV action still produces data.
- Check single-year mode and section order.
- Check desktop and mobile screenshots.

Do not claim completion without verification evidence.

## 11. Success Criteria

The full v1 UI pass is successful when:

- Production UI follows `DESIGN.md` and the two confirmed HTML references.
- Light and Night share the same layout and controls.
- The older neon/terminal styling is no longer visible in production UI.
- Multi-year production exposes only Line and Table.
- The measure dropdown is replaced by the confirmed `% წილი` toggle.
- CSV and source/update context remain visible and data-connected.
- Single-year mode uses the approved section order and Budget Radar.
- Every 100 GEL renders exactly 100 cells and no side list.
- Revenue reuses the same visual system as expenditure.
- Georgian labels remain readable across desktop and mobile.
- Automated tests/build and browser visual checks pass.
