# Mobile UX owner decisions D1–D11 (2026-10-07)

Status: approved by the owner on 2026-10-07 ("fix all you mention in your review"), implemented in PR #158 (merged 2026-10-08 as b0dd8339). Code comments that cite "owner decision Dn" refer to this record. The review itself, with before/after screenshots, is the owner's private report (not stored in the repository). `DESIGN.md` owns the resulting rules (search it for "owner decision Dn"); this file records only what was decided and why.

| | Decision | Where it lives now |
|---|---|---|
| D1 | Fit charts to the phone width. Below 768px, charts are drawn at screen width with fewer year labels instead of scrolling a 720px drawing, so the latest years, the axis and the latest value are on the first screen. A tap reads a period; the readout appears under the chart. | `DESIGN.md`; `editorial-line-chart.tsx`, `chart-frame.tsx`, `app/globals.css` |
| D2 | Show the latest value under the page title, as one line (for example "Unemployment rate · 2025: 13.9%"), on GDP, inflation and unemployment, as the sectors pages already did. | `DESIGN.md` §17; `latest-value-line.tsx`, `lib/explorer/latestValue.ts` |
| D3 | Navigation: a pinned ☰ menu bar on data pages below 900px, the same ☰ icon as the landing page, 44px menu rows, and the dataset hubs listed in the landing menu, on the landing page (with one current figure each) and in the footer. | `DESIGN.md`; `data-sidebar.tsx`, `landing-page.tsx`, `landingDatasets.ts`, `site-footer-view.tsx`, `lib/navigation/datasetHubs.ts` |
| D4 | Series picking on phones: the series list flows with the page (no inner scroll box), a floating "↑ chart" pill appears after a choice made while the chart is off-screen, and a short legend with each line's latest value sits under multi-line charts. Desktop is unchanged. | `DESIGN.md` §7.14; `chart-selection-aids.tsx`, `series-selector.tsx` |
| D5 | Tables on phones: years as rows, newest first, for tables of up to about three series (like the inflation month grid); wider tables keep year columns but open at the latest year. | `DESIGN.md`; `explorer-table.tsx` |
| D6 | Replace the analysis treemap on phones with one stacked bar plus the existing colour list. The treemap stays on tablet and desktop. | `DESIGN.md` (analysis structure) |
| D7 | Map taps: the first tap highlights a place and shows a one-line preview under the map, the second opens its page; small places get larger invisible tap areas. | `use-touch-preview.ts`, `lib/explorer/mapTouchTargets.ts` |
| D8 | Minimum text of 11px on phones and comfortable tap sizes (pills and menu rows 36–44px), with sizes that follow the phone's text-size setting. | `DESIGN.md` (phone floor); `series-selector.tsx` |
| D9 | The Gender and Age pages open with the comparison they are named for: Gender with Men and Women beside the national rate; Age with the youngest published group beside the first prime-age group (15–19 and 25–29 today). | `lib/explorer/unemploymentState.ts`; `Project_Definition.md` §2D |
| D10 | Short breadcrumbs on phones: a single "← parent" link instead of the full trail; the full trail stays on desktop. | `DESIGN.md` (breadcrumbs); `components/shell/page-header.tsx` |
| D11 | The "other/unclassified" bucket is left out of the growth rankings ("slowest growth −100%"); it stays in the tables. | `components/main-explorer/indicators.tsx` |

Follow-up choices the owner made on 2026-10-08, after the fixes were shown: the footer tagline was dropped; the draft Georgian wording was kept as written; no footnote was added for D11; the Georgian font is not preloaded (titles would paint about 0.5 s sooner but every page's first paint 0.3–0.6 s later); publishing meant opening the pull request and merging it.
