# Services measure tabs — local verification

The owner's 2026-10-12 request replaces the Service types tab with Total services trade, Services exports, Services imports and Services balance, alongside Overview. The service-type sidebar no longer repeats those measure controls. The four comparisons share the existing selection, years and view settings; existing saved links retain their format.

Reuse: existing TextTab, TradeOverview, TradePartners, comparison state, charts, tables, ranking and Excel. Small additions allow TradePartners to render the page navigation, the section hook to restore a chosen measure, and TextTab to receive a DOM ID for focus restoration. No new component family or data changes.

Verified on the final local build:

- Production build and postbuild publication checks passed; both Services routes are static.
- Full browser suite: 1,261 passed, including all 14 Services cases and the shared Partners/Domestic controls. Services covers both languages at 390, 768 and 1440 pixels, saved selections, empty selections, navigation, missing values and real Excel downloads.
- Keyboard regression reproduced a lost-focus failure before the correction; the same case passed afterward. Overview/comparison changes now restore focus to the chosen tab without scrolling. Initial loading and history navigation do not request focus.
- Focused unit checks after the correction: 3 files, 10 passed. Scoped lint and TypeScript checks passed.
- The full `npm run check` attempt passed lint/typecheck and 3,797 unit cases, with 13 skipped, but two unrelated cases timed out. Both exact cases passed individually with their existing time limits: the separate HS4 source identity case and the bilingual sitemap revision case. Data validation and localization checks subsequently passed separately. The original combined command therefore remains recorded as exit 1; it was not rerun.
- The earlier development-browser run had one cold navigation timeout. All Services cases passed against the finished production build.
- Independent review found no blocking issues in the tabs change or the subsequent focus correction. Georgian phone and English desktop screenshots were inspected; all twelve Services screenshots were refreshed from the final build.

Preview: `http://127.0.0.1:3218/en/explorer/trade/services`. This verification concerns the local worktree and preview.
