# Chart Share Picture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A labelled `გაზიარება` / `Share` button under every main chart that downloads, copies or device-shares a branded PNG picture of the chart as currently selected.

**Architecture:** On click, a hidden `ShareCard` (title, unit line, legend, a fresh copy of the page's chart forced to its desktop geometry, source, logo) mounts off-screen at 1200 px, `modern-screenshot` (loaded with `import()`) turns it into a PNG at scale 2, and the chosen action runs. `SourceNote` gains an optional `action` slot that holds the button; `useChartLayout` and `PopulationPyramid` read an optional geometry context.

**Tech Stack:** Next.js 16 client components, React 19, TypeScript strict, Tailwind v4, `lucide-react`, `modern-screenshot@4.7.0`, Vitest (server-rendered markup tests), Playwright (Chromium, `CI=1`).

**Spec:** `docs/superpowers/specs/2026-10-24-chart-share-picture-design.md`

All paths below are relative to `apps/web/` unless they start with `docs/` or are repo-root files (`DESIGN.md`, `Project_Definition.md`).

## Global Constraints

- Sharing sends the picture only. No link-sharing or social-network buttons anywhere.
- Button: under the chart, at the right end of the source line, outlined, Lucide `Share2` icon plus visible word `გაზიარება` / `Share`. Never in the chart's control row.
- Menu items, in this order: `სურათის ჩამოტვირთვა` / `Download picture` (always); `სურათის კოპირება` / `Copy picture` (only if `navigator.clipboard?.write` and `window.ClipboardItem` exist); `გაზიარება…` / `Share…` (only if `navigator.canShare?.({ files: [probe] })` is true for a PNG file). Icons: `Download`, `Copy`, `Share`.
- Messages: working `სურათი მზადდება…` / `Making the picture…`; copied `სურათი დაკოპირდა` / `Picture copied`; error `სურათი ვერ მომზადდა — სცადეთ თავიდან.` / `The picture could not be made — try again.` A cancelled share (`AbortError`) shows nothing.
- Picture: paper background, 1200 px CSS width at scale 2 (2400 px PNG), height follows content; order: serif title, one line `unit · start–end`, legend (colour bar + full series name, wraps; omitted for maps and the pyramid), the chart in desktop geometry even on phones, ink rule, source left + `public/fiscal-ge-logo.svg` and `fiscal.ge` right. Page language. In table mode the picture still shows the chart.
- File name: `fiscal-<stem>.png`, `-en` suffix on English (mirror `workbookFilename`).
- `modern-screenshot` is imported only through `import()` at click time; first-load JavaScript of a page must not grow by the library.
- Every existing render stays byte-for-byte the same where the new optional props/context are absent.
- Out of scope: Budget analysis page visuals, landing visuals, hub-card sparklines, tables as pictures.
- Follow `DESIGN.md` tokens; menu surface `tile`, 1px `hairline` border, 2px radius, tooltip shadow `0 4px 16px rgba(30,27,22,0.10)`; targets ≥44 px tall below 768 px.

## Review Focus

1. **Phone-made picture** must still be the wide desktop drawing (a phone viewport with `mobileWidth` state must not leak into the card). Pinned by Task 4's phone download test (PNG width 2400 and the card's chart SVG `data-geometry="desktop"`).
2. **Repeated clicks / double click** while a picture is being made must not start a second render or leave two cards mounted. Pinned by Task 3's `busy` guard and Task 4's double-click test (exactly one download).
3. **Menu dismissal and focus**: Escape, outside click and choosing an item close the menu and return focus to the button; the menu never stays open over the chart. Pinned in Task 4.
4. **Many series** (Budget explorer with all ministries ticked): legend wraps, nothing is cut, picture grows taller. Pinned by Task 5's Budget-explorer test (select all, download succeeds, PNG height > the 2-series picture's height).
5. **English page** produces English text and the `-en` file name. Pinned by Task 4's English download test.

---

### Task 1: Desktop geometry override for charts

**Files:**
- Modify: `components/main-explorer/chart-frame.tsx` (`useChartLayout`, new context export)
- Modify: `components/demography/population-pyramid.tsx` (the `useLayoutEffect` that sets `phone`)
- Test: `tests/explorer/chartFrame.test.tsx`

**Interfaces:**
- Produces: `export const ChartGeometryContext = createContext<"screen" | "desktop">("screen")` in `chart-frame.tsx`. Under `"desktop"`, `useChartLayout()` returns `mobileWidth: null` from the first render (initial state `null`, effect does not measure), and `PopulationPyramid` keeps `phone` false.

- [ ] **Step 1: Write the failing tests** in `tests/explorer/chartFrame.test.tsx`:

```tsx
it("a chart under the desktop geometry context draws only its desktop drawing, unhidden", () => {
  const chart = <EditorialLineChart years={[2024, 2025]} series={[{ id: "a", label: "A", color: "#1E1B16", vals: [1, 2] }]} share={false} unit={{ divisor: 1, label: "₾", decimals: 0 }} shareLabel="%" />;
  const markup = renderGeorgianMarkup(<ChartGeometryContext.Provider value="desktop">{chart}</ChartGeometryContext.Provider>);
  expect(markup).toContain('data-geometry="desktop"');
  expect(markup).not.toContain('data-geometry="mobile"');
  expect(markup).not.toContain("max-[768px]:hidden");
});

it("without the context a chart still renders both drawings before measuring", () => {
  const markup = renderGeorgianMarkup(<EditorialLineChart /* same props */ />);
  expect(markup).toContain('data-geometry="desktop"');
  expect(markup).toContain('data-geometry="mobile"');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/explorer/chartFrame.test.tsx` — expect the first test to FAIL (import missing / mobile drawing present).
- [ ] **Step 3: Implement** the context and read it with `useContext` in `useChartLayout` (initial state `null` when `"desktop"`; skip the measuring effect) and in `PopulationPyramid`'s effect (`setPhone(false)` when `"desktop"`).
- [ ] **Step 4: Run** the same file — PASS. Also run `npx vitest run tests/explorer/editorialLineChart.test.ts tests/explorer/ageSexSection.test.tsx` — PASS unchanged.
- [ ] **Step 5: Commit** `feat: let a chart be forced to its desktop drawing`.

### Task 2: Picture helpers and the library

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm install modern-screenshot@4.7.0 --save-exact`)
- Modify: `lib/explorer/workbookModel.ts` (add `pictureFilename` next to `workbookFilename`)
- Create: `lib/explorer/chartPicture.client.ts`
- Test: `tests/explorer/workbookModel.test.ts` (or the existing test that covers `workbookFilename`; find it with `grep -rl workbookFilename tests`)

**Interfaces:**
- Produces:
  - `pictureFilename(stem: string, locale: Locale): string` → `fiscal-${stem}${locale === "en" ? "-en" : ""}.png`
  - `renderPicture(node: HTMLElement): Promise<Blob>` — awaits `document.fonts.ready`, then `domToBlob(node, { scale: 2, backgroundColor: <paper from getComputedStyle(document.documentElement).getPropertyValue("--paper")>, type: "image/png" })` from a dynamic `import("modern-screenshot")`.
  - `downloadPicture(blob: Blob, filename: string): void` — object URL + temporary `<a download>`, same as `downloadWorkbook`.
  - `copyPicture(blob: Promise<Blob>): Promise<void>` — `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])` (pass the promise; Safari needs the write to start inside the click).
  - `sharePicture(blob: Blob, filename: string, title: string): Promise<"shared" | "cancelled">` — `navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title })`; `AbortError` → `"cancelled"`, other errors rethrow.
  - `canCopyPicture(): boolean`, `canSharePicture(): boolean` (probe with `new File([""], "probe.png", { type: "image/png" })`).

- [ ] **Step 1: Write the failing test**

```ts
it("names pictures like workbooks", () => {
  expect(pictureFilename("wages-overview-1995-2025", "ka")).toBe("fiscal-wages-overview-1995-2025.png");
  expect(pictureFilename("wages-overview-1995-2025", "en")).toBe("fiscal-wages-overview-1995-2025-en.png");
});
```

- [ ] **Step 2: Run** the test file — FAIL (`pictureFilename` not exported).
- [ ] **Step 3: Install the library and implement** `pictureFilename` and `chartPicture.client.ts` per the Interfaces block. The client file is the only importer of `modern-screenshot`, and only via `import()`.
- [ ] **Step 4: Run** the test file and `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat: picture helpers for chart sharing`.

### Task 3: Source-line slot, share card and share button

**Files:**
- Modify: `components/ui/editorial.tsx` (`SourceNote` gets `action?: ReactNode`)
- Create: `components/explorer-shell/share-card.tsx`
- Create: `components/explorer-shell/chart-share-button.tsx`
- Modify: `lib/i18n/messages/ka/controls.json`, `lib/i18n/messages/en/controls.json`
- Test: `tests/explorer/editorial.test.tsx`, create `tests/explorer/chartShare.test.tsx`

**Interfaces:**
- Consumes: `ChartGeometryContext` (Task 1); everything in `chartPicture.client.ts` and `pictureFilename` (Task 2).
- Produces:
  - `SourceNote({ children, testId, action })`: without `action` the output is unchanged; with it, a wrapper `<div data-testid="source-row" class="flex items-start justify-between gap-4">` holds the unchanged `<p>` and `<div class="flex-none">{action}</div>`.
  - `type ShareLegendItem = { label: string; color: string }`
  - `ShareCard({ title, caption, legend, source, chart }: { title: string; caption: string; legend?: ShareLegendItem[]; source: string; chart: ReactNode })` — fixed `w-[1200px]` box, `data-testid="share-card"`, wraps `chart` in `<ChartGeometryContext.Provider value="desktop">`. Logo `<img src="/fiscal-ge-logo.svg" alt="">` + `fiscal.ge`.
  - `ChartShareButton(props: ShareCardProps & { fileStem: string; testId?: string })` (default `testId` `"chart-share"`; the button has `data-testid={testId}`, menu `${testId}-menu`, items `${testId}-download|copy|native`, live region `${testId}-status`).
  - Messages (both locales, keys under `controls.share.*`): `button`, `download`, `copy`, `native`, `working`, `copied`, `error`, `menu` (menu's accessible name: `სურათის გაზიარება` / `Share picture`). Exact copy from Global Constraints.

- [ ] **Step 1: Write the failing tests**

```tsx
// editorial.test.tsx
it("SourceNote without an action renders exactly as before", () => {
  expect(renderToStaticMarkup(<SourceNote testId="s">x</SourceNote>))
    .toBe('<p data-testid="s" class="text-xs leading-relaxed text-[var(--muted)] max-[768px]:[&amp;_a]:py-1">x</p>');
});
it("SourceNote with an action puts it at the right of the text", () => {
  const html = renderToStaticMarkup(<SourceNote testId="s" action={<button>b</button>}>x</SourceNote>);
  expect(html).toMatch(/^<div data-testid="source-row"[^>]*justify-between/);
  expect(html).toContain('<p data-testid="s"');
  expect(html.indexOf("<button>b</button>")).toBeGreaterThan(html.indexOf(">x</p>"));
});

// chartShare.test.tsx
it("the share card carries title, unit line, legend, source and the brand", () => {
  const html = renderGeorgianMarkup(<ShareCard title="ხელფასები" caption="₾ თვეში · 1995–2025" legend={[{ label: "საშუალო", color: "#1E1B16" }]} source="წყარო: საქსტატი" chart={<svg data-geometry="desktop" />} />);
  for (const text of ["ხელფასები", "₾ თვეში · 1995–2025", "საშუალო", "#1E1B16", "წყარო: საქსტატი", "/fiscal-ge-logo.svg", "fiscal.ge"]) expect(html).toContain(text);
});
it("a closed share button is a labelled disclosure with no menu", () => {
  const html = renderGeorgianMarkup(<ChartShareButton title="t" caption="c" source="s" chart={<svg />} fileStem="x" />);
  expect(html).toContain('data-testid="chart-share"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("გაზიარება");
  expect(html).not.toContain('data-testid="chart-share-menu"');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/explorer/editorial.test.tsx tests/explorer/chartShare.test.tsx` — FAIL.
- [ ] **Step 3: Implement.** Button: `h-9 max-[768px]:h-11 px-3 inline-flex items-center gap-2 border border-[var(--control)] rounded-[2px] text-[12.5px] font-semibold text-[var(--ink)] hover:bg-[var(--tint)]`, `aria-expanded`, `aria-controls`. Menu: absolute under the button, right-aligned, `role` omitted (a plain list of buttons in a `<div aria-label>`), dismissed by Escape and by `pointerdown` outside (follow `components/ui/year-picker.tsx`'s listeners), ArrowUp/ArrowDown move focus between items, focus returns to the button on close. Capability checks run when the menu opens (client only, so hydration matches). On an item: set `busy` (ignore further clicks while busy), mount `ShareCard` through `createPortal` into `document.body` inside a `fixed left-[-10000px] top-0` wrapper, wait two `requestAnimationFrame`s, `renderPicture`, run the action, unmount the card, close the menu. Copy passes `renderPicture(...)`'s promise straight to `copyPicture`. Status text in a polite live region like `ExcelDownloadButton`; `copied` clears after 3 s.
- [ ] **Step 4: Run** the two test files and `npm run i18n:check` — PASS.
- [ ] **Step 5: Commit** `feat: chart share button and share picture card`.

### Task 4: First page and the browser tests

**Files:**
- Modify: `components/wages/wages-explorer.tsx` (the `SourceNote` under the chart panel)
- Create: `tests/browser/chart-share.spec.ts`

**Interfaces:**
- Consumes: `ChartShareButton` (Task 3).
- Produces: the wiring pattern every later task copies:

```tsx
const chart = <EditorialLineChart /* the page's existing props */ />;
// … the chart panel renders {chart} where it rendered the element before …
<SourceNote testId="source-label" action={<ChartShareButton title={title} caption={`${unitLabel} · ${model.range.start}–${model.range.end}`}
  legend={lineSeries.map(({ label, color }) => ({ label, color }))} source={<the page's source message string>} chart={chart}
  fileStem={<the page's workbook stem>} />}>…unchanged…</SourceNote>
```

- [ ] **Step 1: Write the browser tests** in `tests/browser/chart-share.spec.ts` against `/explorer/wages/overview` (helper: read PNG width/height from bytes 16–23 of the downloaded file):
  - `download makes a 2400 px wide PNG named after the page` — click `chart-share`, menu visible, `chart-share-download` click → download `suggestedFilename()` is `fiscal-wages-overview-1995-2025.png` (take the years from the page's range label, not hardcoded), width 2400.
  - `the English page names the file with -en` — `/en/explorer/wages/overview`, file name ends `-en.png`, button text `Share`.
  - `a phone still gets the wide picture` — viewport 390×844, width 2400.
  - `a double click on download produces one file` — dblclick the item; exactly one `download` event within 5 s; one `share-card` at most ever in the DOM.
  - `copy puts a PNG on the clipboard` — `context.grantPermissions(["clipboard-read", "clipboard-write"])`, click copy, status reads `სურათი დაკოპირდა`, `navigator.clipboard.read()` has an item with type `image/png`.
  - `Escape and an outside click close the menu and return focus` — open, Escape → menu hidden, button focused; open, click the page heading → menu hidden.
  - `the share item is hidden where the browser cannot share files` — Chromium on Linux has no `navigator.share`: `chart-share-native` count 0.
  - `the button is not in the chart's control row` — `chart-panel` first row contains no `chart-share`; `source-row` does.
- [ ] **Step 2: Build and serve once** (CLAUDE.md): `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, start on port 3100 in its own process group; run `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/chart-share.spec.ts` — FAIL (no button yet).
- [ ] **Step 3: Wire** `wages-explorer.tsx` with the pattern above (stem as in `lib/explorer/wagesWorkbook.ts`; source = the same `t(...)` source message the page shows).
- [ ] **Step 4: Rebuild (stop the server first), rerun the spec** — PASS. Open the downloaded picture and compare it with mockup `3-shared-picture.png` by eye.
- [ ] **Step 5: Commit** `feat: share picture on the Wages pages`.

### Task 5: Wire the Budget, Economy, Business, Housing, Living standards, Inflation, Money, Debt and Deficit pages

**Files (modify, one `SourceNote` each, pattern from Task 4):**
`components/main-explorer/explorer-view.tsx`, `components/debt/debt-explorer.tsx`, `components/deficit/deficit-explorer.tsx`, `components/gdp/gdp-overview.tsx`, `components/economic-sectors/economic-sectors-explorer.tsx`, `components/business/business-explorer.tsx`, `components/business/business-area-explorer.tsx`, `components/housing/housing-explorer.tsx`, `components/housing/housing-area-explorer.tsx`, `components/household/household-explorer.tsx`, `components/poverty/poverty-explorer.tsx`, `components/inflation/inflation-overview.tsx`, `components/inflation/inflation-categories.tsx`, `components/inflation/inflation-products.tsx`, `components/inflation/inflation-cities.tsx`, `components/money-banks/money-banks-explorer.tsx`, `components/external/current-account.tsx`, `components/external/external-position.tsx`, `components/external/foreign-investment.tsx`, `components/external/money-from-abroad.tsx`, `components/trade/trade-overview.tsx`, `components/trade/trade-partners.tsx`, `components/trade/trade-products.tsx`
- Test: `tests/browser/chart-share.spec.ts` (add cases)

Where a panel switches between a line and a stacked chart, `chart` is whichever the line mode would draw for the current state. Legend comes from the series given to that chart. `fileStem` is the stem the page's workbook builder uses.

- [ ] **Step 1: Add browser tests**: Budget explorer `/explorer` (expenditure): tick all rows with the bulk action, download → width 2400 and height greater than the default-selection picture's height (Review Focus 4); trade overview (stacked columns) download → width 2400.
- [ ] **Step 2: Run** the new cases against a fresh build — FAIL.
- [ ] **Step 3: Wire** the listed files.
- [ ] **Step 4: Rebuild, rerun** `chart-share.spec.ts` — PASS; `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat: share picture on budget, economy and finance pages`.

### Task 6: Wire the remaining hubs, maps and pyramid, and pin coverage

**Files (modify):** `components/unemployment/unemployment-explorer.tsx`, `components/unemployment/labour-explorer.tsx`, `components/health/health-explorer.tsx`, `components/health/health-deaths-explorer.tsx`, `components/social/social-explorer.tsx`, `components/social/social-place-explorer.tsx`, `components/education/education-explorer.tsx`, `components/education/education-place-explorer.tsx`, `components/science-culture/science-culture-explorer.tsx`, `components/science-culture/museum-area-explorer.tsx`, `components/crime/crime-explorer.tsx`, `components/internet/internet-explorer.tsx`, `components/internet/internet-area-explorer.tsx`, `components/transport/transport-explorer.tsx`, `components/transport/transport-area-explorer.tsx`, `components/energy-food/energy-food-explorer.tsx`, `components/environment/environment-explorer.tsx`, `components/demography/demography-migration.tsx` (the chart's `SourceNote`, not the second one), `components/demography/marriage-explorer.tsx`, `components/regional-economies/regional-economies-index.tsx` (`RegionIndex`: chart = the `RegionMap` element, no legend; caption = the map's metric legend text and year; stem from the page), `components/municipalities/municipalities-index.tsx` (chart = `MunicipalityMap`, no legend), `components/demography/age-sex-section.tsx` and `components/demography/age-sex-explorer.tsx` (chart = `PopulationPyramid`, no legend).
- Create: `tests/explorer/chartShareCoverage.test.ts`
- Test: `tests/browser/chart-share.spec.ts` (add cases)

**Interfaces:**
- Consumes: Task 3 and Task 4 pattern. `ChartShareButton` takes an optional `testId` where a page has two buttons.

- [ ] **Step 1: Write the coverage test** (reads source files with `fs`):

```ts
it("every chart panel has a share button", () => {
  for (const file of chartPanelFiles()) expect(read(file), file).toContain("<ChartShareButton");
});
it("the region map, municipality map and pyramid pages have one", () => {
  for (const file of ["components/regional-economies/regional-economies-index.tsx", "components/municipalities/municipalities-index.tsx", "components/demography/age-sex-section.tsx", "components/demography/age-sex-explorer.tsx"]) expect(read(file), file).toContain("<ChartShareButton");
});
it("the picture library is only loaded on demand", () => {
  for (const file of allSourceFiles()) expect(read(file), file).not.toMatch(/from ["']modern-screenshot["']/);
  expect(read("lib/explorer/chartPicture.client.ts")).toContain('import("modern-screenshot")');
});
```

`chartPanelFiles()` = files under `components/` containing `data-testid="chart-panel"`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/chartShareCoverage.test.ts` — FAIL listing the unwired files.
- [ ] **Step 3: Add browser cases**: `/explorer/wages/regions` (map) and `/explorer/demography/age-sex` (pyramid) download → width 2400 on a 390-wide phone viewport too.
- [ ] **Step 4: Wire** the listed files; rerun the coverage test — PASS; rebuild and rerun `chart-share.spec.ts` — PASS.
- [ ] **Step 5: Commit** `feat: share picture on every chart page`.

### Task 7: Documents

**Files:**
- Modify: `DESIGN.md` (new §7.17 "Share picture": button, menu, picture layout, file name; Lucide list in §7.2a's icon standard gains `Share2`, `Download`, `Copy`, `Share`; §6.6 shadow list gains the share menu)
- Modify: `Project_Definition.md` §2 (dated line: chart pages offer a picture of the current chart — download, copy, device share — approved by Duru 2026-10-24; not link sharing)
- Modify: `next.config.ts` only if the browser run logged a CSP report for the picture (`img-src` + `blob:`)

- [ ] **Step 1: Edit** the documents with the spec's values.
- [ ] **Step 2: Run** any test that pins DESIGN.md text (`grep -rl "DESIGN.md" tests`) — PASS.
- [ ] **Step 3: Commit** `docs: share picture in the design system and scope`.

### Task 8: Preview for Duru, then the done-check

- [ ] **Step 1:** Screenshots of the button and an opened menu (desktop and phone) plus three downloaded pictures (line, stacked, map) into `/mnt/project-files/chart-share/preview/`; post them with a decision card ("Clickable preview" / "Screenshots only" / "Looks good, go ahead"). Push the branch for a Vercel preview only if Duru picks it (no PR). Ask Duru to try Share… from an iPhone and an Android phone on the preview.
- [ ] **Step 2:** After Duru's OK: merge `main`, then run once `npm run check`, `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, and the full browser suite against the built server (CLAUDE.md). Investigate any failure; do not repeat passing gates.
- [ ] **Step 3:** Draft PR, CI green, merge per Duru's "push merge sync".
