# Explorer Export and Methodology Links Design

## Goal

Make the CSV download control visually consistent across every budget explorer
surface, and restrict public methodology navigation to the homepage promotion
and shared footer only.

## Scope

- Keep the existing CSV download behavior, file contents, and filenames.
- Give the municipality entity/region export control the same visual placement
  and styling as the expenditure and revenue explorer export control.
- Remove methodology promotions from the budget hub, expenditure, revenue,
  analysis, and municipality index routes.
- Keep the homepage methodology promotion and the shared footer methodology
  link unchanged.
- Keep direct methodology pages and their internal navigation available.

## Approach

The existing expenditure and revenue series panel is the visual reference: the
full-width dark CSV button sits directly below the series selector. Municipality
detail pages already use the same placement, so the implementation will align
their button classes and test selector with that reference rather than adding a
new component.

Explorer-wide methodology promotions are rendered in three places: the budget
hub page, the municipality index page, and the main explorer component that
serves expenditure, revenue, and analysis. Remove those renderings and the
now-unused imports and derived copy. The landing page and `SiteFooter` are not
changed.

## Verification

- Browser checks prove that CSV remains downloadable from expenditure and a
  municipality detail page, and that both controls share the same classes.
- Browser checks prove that every explorer route has no methodology promotion
  or methodology link, while the homepage promotion and footer link remain.
- Typecheck, lint, and the targeted browser tests pass.

## Boundaries

This change does not remove the `/methodology` routes or their own internal
links. It only removes paths into methodology from non-homepage product pages.
