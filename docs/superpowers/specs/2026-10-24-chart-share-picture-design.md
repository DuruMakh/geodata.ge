# Chart share button: download, copy or share the chart as a picture

Date: 2026-10-24
Status: Draft for Duru's review. Decisions so far, all made by Duru in the thread "Add share button to charts" on 2026-10-24 (Tbilisi time):

- 18:04: sharing sends the **picture** of the chart, never a link to fiscal.ge. No Facebook or X "post a link" buttons.
- 18:08: agreed the menu of three actions (download, copy, share) and the picture layout shown in the mockups.
- 18:17: the button must not sit in the chart's control row, because the measure icons there would be mistaken for it.
- 18:36: picked placement **B**: a labelled button under the chart, at the right end of the source line.

The redesign canvas (https://claude.ai/artifact/NTvuHd3oasbXxkNcZto2Wz) draws no share button, so this follows the current editorial style in `DESIGN.md`. Mockups: `/mnt/project-files/chart-share/mockups/` (`3-shared-picture.png`, `B-desktop-under-chart.png`, `B-phone-under-chart.png`; the menu in `1-desktop-menu-open.png`, which shows the menu on the rejected placement).

## 1. Intended result

A reader looking at a chart on fiscal.ge can take that exact chart away as a picture: the series, years and measure they picked. They can save it as a file, paste it into a post, or (where the device allows) send it straight to an app. The picture always says what it shows and where it came from, so a reposted picture still credits fiscal.ge and the official source.

Success means:

- Every page with a main chart shows the button under the chart.
- The picture matches what is on screen (same series, colours, years, measure) and is sharp enough for social feeds.
- It works on phones and computers in Chrome, Edge, Safari and Firefox. Actions a browser cannot do are hidden, never shown broken.
- Nothing about the page's data, speed on load, or other controls changes.

## 2. What the reader sees

**The button.** Below the chart, at the right end of the source line: an outlined button with the Lucide `Share2` icon and the word `გაზიარება` / `Share`. It is a labelled button (not icon-only) so it cannot be confused with the data icons above the chart. On phones it stays at the right of the source text; the source text wraps beside it.

**The menu.** Clicking opens a small menu under the button:

| Item | Georgian / English | Shown when | What it does |
| --- | --- | --- | --- |
| Download | `სურათის ჩამოტვირთვა` / `Download picture` | always | Saves a PNG file, e.g. `fiscal-ge-loans-deposits-1996-2025.png` |
| Copy | `სურათის კოპირება` / `Copy picture` | the browser can put pictures on the clipboard | Copies the picture; the reader pastes it into a Facebook, X, LinkedIn or Telegram post (Ctrl+V) |
| Share | `გაზიარება…` / `Share…` | the device can share files (phones; Windows; Safari on Mac) | Opens the device's own share sheet with the picture attached: Facebook, Messenger, Instagram, WhatsApp, Telegram, Mail… |

While the picture is being made the chosen item reads `სურათი მზადდება…` / `Making the picture…`. After a copy, a short `სურათი დაკოპირდა` / `Picture copied` confirmation appears. If anything fails: `სურათი ვერ მომზადდა — სცადეთ თავიდან.` / `The picture could not be made — try again.` (same tone as the Excel button). Cancelling the phone share sheet is not an error and shows nothing.

**The picture** (mockup `3-shared-picture.png`), on the paper background, 1200 px wide drawn at double sharpness (a 2400 px wide PNG); its height follows the content, about 1200 × 670 for a typical chart, which suits Facebook, X and LinkedIn feeds:

1. Page title (serif), e.g. `სესხები და დეპოზიტები`.
2. One line: unit and years, e.g. `მლრდ ₾ · 1996–2025`.
3. Legend: a colour bar and the full name of each selected series, wrapping onto more lines when there are many. Charts that already carry their own key (maps, the age pyramid) skip it.
4. The chart, always in the wide desktop drawing, even when made on a phone (Duru agreed, 18:08).
5. A rule, then the source on the left (as on the page, without the methodology link) and the Fiscal.ge logo with `fiscal.ge` on the right.

The picture follows the page language. In table view the button still makes the chart picture for the same series and years.

## 3. Where it appears

Every page whose main chart sits in a chart panel: 43 page templates across all hubs (Budget explorer, Debt, Deficit, Economy, Business, Housing, Inflation, Money and banks, Unemployment, Wages, Living standards, Health and social protection, Education, Science and culture, Crime, Internet, Trade, External flows, Energy and food, Environment, Transport, Demography). One template often serves many URLs (every region or municipality page), so this covers most of the site's chart pages.

Also: the region map pages (one shared component behind 12 region index pages), the municipality map, and the age and sex pyramid. A page with two charts gets one button under each.

**Not in this change:** the Budget **analysis** page (single-year treemap, radar, budget field and ranking), the landing page's hero visuals, sparklines on hub cards, and tables as pictures. They can follow later if wanted.

## 4. How it works (technical)

All of it runs in the reader's browser when they click. No server, no new page, no data leaves the browser except what the reader chooses to share.

1. **Making the picture.** On click, a hidden `ShareCard` (title, unit line, legend, chart, source, logo) is mounted off-screen at a fixed 1200 px width, using the site's own CSS and fonts. The chart inside is a fresh copy of the page's chart element, told to draw its desktop geometry (see 2). After fonts and layout settle, `modern-screenshot` (MIT, no dependencies, maintained, a fork of `html-to-image` with Safari fixes) turns the card into a PNG blob at scale 2. The library is loaded only on click (`import()`), like the Excel writer, so page weight on load does not change. The card is unmounted afterwards.
2. **Desktop drawing on phones.** `useChartLayout` (`components/main-explorer/chart-frame.tsx`) and the pyramid's own media query gain one optional context, `ChartGeometryContext`, defaulting to "follow the screen". Inside the share card it says "desktop", so the line, column and pyramid charts draw their 920-wide desktop geometry. Default behaviour, and every existing test, is unchanged.
3. **Actions.** Download: an object URL on a temporary link with the file name. Copy: `navigator.clipboard.write([new ClipboardItem({"image/png": blobPromise})])`, passing the promise so Safari keeps the click's permission. Share: `navigator.share({ files: [file], title })` after `navigator.canShare({ files: [file] })`; an `AbortError` (reader cancelled) is silent. Feature checks decide which items are shown, once the menu opens.
4. **Menu behaviour.** A disclosure button (`aria-expanded`, `aria-controls`) with a list of buttons. Escape and a click outside close it and return focus to the button; arrow keys move between items. Targets are at least 44 px tall below 768 px (DESIGN.md §12). Status and errors are announced through a polite live region, as on the Excel button.
5. **Wiring per page.** `SourceNote` (`components/ui/editorial.tsx`) gains an optional `action` slot rendered at the right of the source text; without it, output is byte-for-byte unchanged. Each chart page passes `<ChartShareButton>` with the page title, the unit and years line, the legend items (from the series it already gives the chart), the chart element, the plain source text and a file-name slug. Pages already hold all of these.
6. **File name.** `fiscal-ge-<page-slug>-<start>-<end>.png`, ASCII only, from the route slug, not the Georgian title.

## 5. Reuse

- **As is:** the chart components (`EditorialLineChart`, `StackedColumnChart`, `PopulationPyramid`, `RegionMap`, `MunicipalityMap`), `SourceNote` text, page titles and units, `lucide-react` icons (`Share2`, `Download`, `Copy`, `Share`), the brand logo `public/fiscal-ge-logo.svg`, the fonts in `apps/web/assets/fonts`, the role tokens, and the Excel button's working and error pattern and messages style.
- **Small additions:** an optional `action` slot on `SourceNote`; an optional geometry context read by `useChartLayout` and `PopulationPyramid`.
- **New:** `ChartShareButton` with its menu, `ShareCard`, a small client helper that renders the card and performs the three actions, and the `modern-screenshot` dependency. Considered and rejected: building the picture by hand on a canvas (would need our own font embedding and style copying for every chart type, more code and more Safari risk) and re-drawing each chart type for the picture (a second copy of every chart).

## 6. Design system and documents

- `DESIGN.md`: a new component section "Share picture" (button, menu, picture layout, icon mapping in the Lucide section). §6.6 lists the menu among the few things that cast the tooltip shadow, since it floats over content.
- `Project_Definition.md` §2: a dated line that chart pages offer a picture of the current chart (download, copy, device share), approved by Duru on 2026-10-24, and that this is not link sharing.
- Content Security Policy (`next.config.ts`, report-only today): add `blob:` to `img-src` if the browser reports the picture rendering against it.

## 7. Verification

- Unit tests (Vitest): the file-name slug; the share card's legend and unit line; `SourceNote` unchanged without `action`; the geometry context defaults.
- Component behaviour: menu opens and closes (Escape, outside click), items hidden when the browser lacks clipboard or file sharing, error message on a failed render.
- Browser tests (Playwright, Chromium): on a line chart, a stacked chart, a map and the pyramid, "Download picture" produces a PNG 2400 px wide whose file name matches the page; on a phone-sized viewport the picture is still the wide layout; copy works with clipboard permission granted; the button exists on every chart page in the existing page sweep.
- Manual check before release: Safari on iPhone (share sheet to Facebook and Messenger) and Chrome on Android, by Duru on the Vercel preview.
- The definition of done in `CLAUDE.md`: `npm run check`, `npm run build`, `npm run test:browser`, run once at the end, after Duru's OK on the preview.

## 8. Risks

- **Safari** sometimes draws fonts late in the first picture. Mitigation: wait for `document.fonts.ready` and render with modern-screenshot's built-in Safari handling; the browser test cannot run WebKit here, so Duru's iPhone check on the preview is part of acceptance.
- **Very many series** (for example 40 ministries ticked) make a tall legend. The picture grows taller rather than cutting names; no limit is added.
- **Facebook on a computer** has no direct picture button by design (§1); the menu's Copy item covers it.
