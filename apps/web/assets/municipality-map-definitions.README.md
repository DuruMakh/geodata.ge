# Municipality map definitions

This generated SVG holds the exact reviewed municipal and occupied-area paths from `data/geometry/municipality-map-paths.json`.
It is imported by the interactive map so Next emits a content-hashed, same-origin asset. The map renders each path through an SVG `<use>` element and keeps current budget paint, hatching, strokes, keyboard behavior, and accessible metadata in the page.

Run `npm run data:prepare-municipality-geometry` from `apps/web` to regenerate this file and the source manifest. `npm run data:check-municipality-geometry` verifies byte-for-byte parity.
