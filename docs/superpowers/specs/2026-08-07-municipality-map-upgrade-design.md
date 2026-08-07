# Municipality Map Upgrade Design

**Date:** 2026-08-07
**Status:** Approved and implemented; merge and production verification pending
**Scope:** Replace the municipalities index's region-grain map with a municipality-grain map.

## 1. Goal

Upgrade `/explorer/municipalities` so the map shows the reviewed municipality geometry from the approved preview. Each served municipality must be directly reachable from the map, while the existing ranked lists, KPIs, municipality pages, region pages, and editorial visual system remain intact.

The result must remain a static, fast, Georgian-first SVG choropleth. It must not depend on a live geometry API or introduce a general-purpose map framework.

## 2. Existing Product State

The index currently renders 12 region-level shapes: 11 data-bearing regions plus a no-data Abkhazia shape. Five self-governing cities are represented by markers. Region shapes navigate to region roll-up pages, while municipalities are opened from the ranked list or city markers.

This design changes only the map grain. The existing 64 municipality pages, 11 region pages, Municipality/Region list tabs, KPIs, search, source notes, and budget-data rules remain in scope and retain their current behavior unless this specification says otherwise.

## 3. Decisions

1. Clicking a municipality polygon or city marker immediately opens `/explorer/municipalities/[code]`.
2. The map always colors municipalities by the latest available official municipal budget year. No year selector is added.
3. The Municipality/Region ranked-list tabs and region routes remain. Selecting the Regions tab does not change the map back to region shapes.
4. Map features and municipality list rows highlight each other on pointer hover and keyboard focus.
5. The hover/focus tooltip contains the municipality's Georgian name, formatted official budget amount, and a visual arrow icon (`→`) only. Its accessible description names the action explicitly.
6. No persistent selected state is needed because activation navigates immediately.
7. The browser's rectangular SVG focus outline must not appear. Keyboard focus is shown by strengthening the actual polygon boundary or drawing a circular marker focus treatment.
8. Abkhazia and the Tskhinvali region remain visually distinct, non-interactive overlays. They have no labels, tooltip, click behavior, keyboard focus, or legend entry.
9. Batumi, Kutaisi, Poti, Rustavi, and Tbilisi retain the green city markers approved in the preview.

## 4. Chosen Geometry Approach

Use a vendored, immutable snapshot of the approved OpenStreetMap municipality geometry and the approved Natural Earth occupied-area overlays.

The application must not fetch boundaries at runtime. A deterministic preparation step will validate, simplify, project, and serialize the reviewed source geometry into static SVG path data. This preserves the approved shapes, avoids network failures and upstream drift, and fits the existing statically generated Next.js application.

### 4.1 Alternatives considered

**Official NAPR/NSDI boundaries.** Georgia's National Spatial Data Infrastructure lists an official `Administrative Boundary of Municipality` dataset. It may become the preferred long-term source, but its download/API access and redistribution terms are not yet sufficiently clear for the current implementation. Adopting it now could also change geometry that the user has already reviewed. Record it as a future source candidate, not a current dependency.

**Runtime geometry service or map framework.** Loading boundaries through an API, Overpass, or a general map library would add availability, payload, hydration, and geometry-drift risks without providing a requested capability. It is rejected for this static choropleth.

## 5. Geometry and Provenance Contract

The checked-in geometry snapshot is reviewed product data and must include:

- 60 unique municipality polygon features, each joined to a valid public municipality code.
- Four marker-only municipality codes: Batumi `06`, Kutaisi `20`, Poti `32`, and Rustavi `48`.
- Tbilisi code `04` represented by both its polygon and city marker; both activate the same route.
- Exactly 64 unique served municipality codes across polygons and approved markers.
- No publicly excluded municipality code exposed as an interactive target.
- The corrected Zugdidi municipality relation and shape approved in the preview.
- The OpenStreetMap relation ID for each polygon.
- A provenance manifest containing the snapshot date, source URLs, licence, feature count, code crosswalk, and deterministic source/output hashes.

Geometry may be simplified to control payload size, but simplification must not visibly change the approved silhouette, adjacency, occupied-area presentation, or recognizable municipality shapes.

OpenStreetMap geometry is licensed under ODbL and requires attribution. The public source note must include a linked notice equivalent to `Boundaries: © OpenStreetMap contributors, ODbL.` It must not add occupied-territory wording. Natural Earth vector data is public domain; its provenance remains recorded in the repository even though public attribution is not required.

## 6. Architecture and Data Flow

### 6.1 Static geometry preparation

A deterministic preparation module or script will:

1. Read the reviewed vendored GeoJSON snapshot.
2. Validate geometry types, feature identifiers, municipality-code coverage, duplicate rules, and provenance metadata.
3. Apply the approved simplification tolerance.
4. Project geometry into the municipality map's SVG coordinate system.
5. Emit compact path strings and occupied-area overlay paths for application use.

The generated artifact is committed and verified for a clean fixed point. Re-running generation without source or configuration changes must produce no diff.

### 6.2 Server composition

The municipalities index server page continues to load the canonical municipal dataset. It joins the latest-year official total to each geometry code, computes the existing choropleth buckets, formats legend endpoints, and passes only display-ready shapes and marker positions to the client.

Missing budget facts, unmapped public codes, duplicate geometry codes, or invalid paths are build-time errors. They must not be silently converted to zero or omitted.

### 6.3 Client map

Introduce a dedicated `MunicipalityMap` client component. Do not overload `RegionMap` with mutually exclusive region- and municipality-grain behavior.

The component owns only presentation and interaction:

- pointer hover and focus state;
- anchored tooltip placement;
- list/map highlight synchronization;
- keyboard activation;
- direct municipality navigation callbacks;
- responsive rendering.

It receives projected SVG paths and values. It does not parse raw GeoJSON, compute projections, fetch data, or own budget-domain logic.

Once the new component and its coverage replace every index use of the region map, remove municipality-index-specific region-map implementation and tests that no longer describe the product. Retain shared ADM1 geometry used by other surfaces. Region list and region detail behavior remain.

## 7. Visual and Interaction Design

### 7.1 Choropleth

Use the existing six-step terracotta map ramp and latest-year official municipal totals. Maintain the warm editorial paper background, thin internal boundaries, square geometry, and no card or shadow around the map. The tooltip remains the permitted raised surface.

The occupied-area overlays render after municipality fills so no municipal budget color is visible through them. They remain visually distinct using the approved pale treatment, but they carry no public text or legend key.

### 7.2 Pointer and keyboard behavior

Pointer hover and keyboard focus use the same active-municipality state. The active polygon gets a stronger real-shape stroke; a city marker gets a circular focus/hover treatment. The native rectangular SVG outline is suppressed only for map targets and replaced with the accessible shape-following treatment.

Every interactive feature has an accessible name containing the Georgian municipality name, latest-year budget value, and action. DOM/tab order is deterministic and follows Georgian alphabetical order rather than upstream source order. Enter and Space activate the same route as a click; Space must not scroll the page.

### 7.3 Tooltip

The tooltip is anchored to the active geometry and kept inside the SVG bounds at desktop and narrow viewport widths. Its visible content is:

- municipality name in Georgian;
- latest-year official budget amount;
- `→` icon.

The icon is decorative to assistive technology because the feature's accessible name already describes the action.

### 7.4 Map and list synchronization

Hovering or focusing a municipality polygon or marker highlights the corresponding municipality ranked-list row when it is present. Hovering or focusing a municipality list row highlights the exact polygon or marker. Activating either opens the same municipality route.

When the Regions list tab is active, municipality map interactions continue to work, but region list rows do not attempt to highlight municipality geometry.

### 7.5 Touch behavior

A touch activation navigates immediately. No second tap, persistent selection, bottom sheet, or intermediate detail panel is added.

## 8. Error Handling

There is no runtime geometry request and therefore no geometry loading or retry state.

Development and build validation must fail with a specific error when:

- a served municipality code is missing;
- an unknown or excluded code is interactive;
- a required source relation or path is duplicated unexpectedly;
- a path is empty or non-finite;
- a marker-only exception changes without an explicit contract update;
- source hashes or generated output do not match the manifest.

The user-facing page continues to use the existing budget-data error behavior. This feature does not create a new runtime fallback map because an incomplete map would be materially misleading.

## 9. Verification

### 9.1 Unit and data-contract tests

- Exactly 60 unique polygon codes.
- Exactly four marker-only codes: `06`, `20`, `32`, and `48`.
- Tbilisi `04` is the sole approved polygon-plus-marker duplicate.
- Exactly 64 unique public municipality codes across polygons and markers.
- All geometry codes resolve to the canonical municipality registry.
- No excluded code is an interactive target.
- Every path is valid and non-empty.
- Latest-year totals and color buckets join correctly.
- Occupied overlays are present and excluded from interaction metadata.
- OpenStreetMap attribution and provenance metadata remain present.
- Geometry generation reaches a clean deterministic fixed point.
- The generated municipality and occupied-overlay path payload remains at or below 350 KB uncompressed.

### 9.2 Browser tests

- Polygon and city-marker clicks navigate directly to the correct municipality page.
- Enter and Space activation work for polygon and marker targets.
- Pointer and focus tooltips contain the correct Georgian name, amount, and arrow.
- Tooltip positioning remains inside the map after narrow-screen resize.
- Municipality map/list highlighting works in both directions.
- All 64 municipality routes are reachable through the map's polygon/marker targets.
- The rectangular SVG focus outline is absent; polygon and circular marker focus indicators remain visible.
- Occupied overlays have no role, tab index, tooltip, or activation.
- Municipality/Region list switching and existing region routes still work.

### 9.3 Visual verification

Capture desktop and mobile screenshots and compare them against the approved preview. Explicitly inspect:

- the corrected Zugdidi shape;
- Tbilisi and all five city markers;
- municipality border continuity;
- Abkhazia and the Tskhinvali overlay presentation;
- absence of occupied-area text and legend entries;
- absence of rectangular focus boxes;
- map fit and tooltip containment at narrow widths.

Run the repository's required lint, typecheck, unit/data validation, production build, and Playwright suites before delivery.

## 10. Documentation Updates

Implementation must update the durable project documentation that currently describes a region-grain map:

- `DESIGN.md` section 20;
- `AGENTS.md` current project state;
- municipal methodology/provenance documentation where geometry and licensing are described.

The documentation must distinguish the 64 publicly served municipalities from the broader administrative registry and retain the existing excluded-code rationale.

## 11. Non-goals

- No year selector or animated year transitions.
- No pan, zoom, basemap, roads, settlements, or geographic search.
- No region-shape toggle.
- No new municipality or region detail-page content.
- No per-capita measures or integration of the separate population research package.
- No runtime OpenStreetMap, Overpass, Natural Earth, or NSDI request.
- No change to municipal budget definitions, official-versus-functional totals, source data, or excluded public codes.
- No occupied-area labels, tooltips, links, or legend explanation.
- No redesign of the ranked list, KPIs, shell, or editorial theme.

## 12. Completion Criteria

The upgrade is complete when the municipality index renders the approved municipality geometry, all 64 served municipality pages are directly reachable through polygons or approved markers, map/list interaction and keyboard behavior match this specification, occupied areas remain unlabeled and non-interactive, required attribution and provenance are present, all focused and full repository checks pass, and the production deployment is verified separately after merge.
