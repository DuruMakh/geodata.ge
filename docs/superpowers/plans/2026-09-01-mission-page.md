# Mission Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the current /about content with the approved Georgian-first მიზანი page, expose მიზანი in the shared public header and footer, and preserve the static data and SEO contract.

**Architecture:** Keep /about as the canonical URL and keep the page as a server-rendered App Router page. Reuse loadServedLandingData, buildLandingContext, SiteHeader, and SiteFooter; add no new data source, API, client state, or page-specific runtime. Implement the approved D direction with existing Fiscal.ge tokens and Tailwind classes: an ink cover followed by one continuous article.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, strict TypeScript, Tailwind CSS v4, existing Fiscal.ge custom components, Playwright browser tests, and Vitest checks.

**Spec:** design-shotgun/mission-2026-09-01/brief.md and the approved visual reference design-shotgun/mission-2026-09-01/variant-d.html.

## Global Constraints

- The production visual direction follows the canonical DESIGN.md v4.1 contract.
- The interface is the warm editorial statistical annual defined in DESIGN.md v4.1: single paper theme, ink rules, serif display with mono numerals, one terracotta accent, no theme toggle.
- Keep the route /about; do not create a new /mission route or change sitemap URL ownership.
- Visible page title, shared header link, footer link, and page identity are მიზანი.
- /about has no visible breadcrumb and emits no about-page breadcrumb JSON-LD; the root site JSON-LD and canonical/Open Graph metadata remain present.
- Use the existing SiteHeader, SiteFooter, fiscalMetadata, loadServedLandingData, and buildLandingContext; do not add a new data layer or dependency.
- Preserve the existing shared footer trust content, including info@fiscal.ge, source/update copy, CC BY 4.0, and its compact logo. Change only the About navigation label to მიზანი.
- Keep the supplied copy in its approved order and wording, including ექსელის and the final word გამოყენებადი.
- Keep the D visual rules: ink cover first, no cover tagline, no მთავარი / მიზანი breadcrumb, no ჩვენი მიზანი / ტექსტი label, one uninterrupted article, no chapter headings or numbered text sections, and a terracotta left rule only on the final large bold sentence.
- Preserve keyboard-visible focus, readable Georgian text, reduced-motion compatibility, and zero horizontal page overflow at 320px, 390px, 767px, 768px, and desktop widths.
- Do not modify historical SEO specs or unrelated explorer/methodology behavior.

---

## File Map

- Modify apps/web/components/site/site-header.tsx — add the shared /about navigation link labelled მიზანი, add the mission active state, and make the three-link mobile row fit without overflow.
- Modify apps/web/components/site/site-footer.tsx — rename the existing /about footer link from Fiscal.ge-ის შესახებ to მიზანი; keep all other footer trust content unchanged.
- Modify apps/web/app/about/page.tsx — replace the old trust/section grid with the approved mission cover and continuous four-paragraph article while keeping build-time landing context.
- Create apps/web/tests/browser/about.spec.ts — lock the page copy, navigation, cover, closing-line treatment, no-breadcrumb rule, footer, accessibility landmarks, and responsive overflow.
- Modify apps/web/tests/browser/methodology.spec.ts — extend the shared public-header assertions for the new მიზანი link and its route-specific active state.
- Modify apps/web/tests/browser/landing.spec.ts — prove the landing page exposes the new shared მიზანი link and keep existing header/footer geometry assertions valid.
- Modify apps/web/tests/browser/seo.spec.ts — remove /about from the visible/structured breadcrumb-alignment loop while retaining its canonical metadata coverage.
- Modify apps/web/tests/browser/main-explorer.spec.ts — update the stale comment that currently refers to /about as the BreadcrumbTrail example; explorer breadcrumb behavior itself remains unchanged.
- Modify apps/web/tests/seo/agentFiles.test.ts — assert that the current agent-facing navigation calls the page Mission — Fiscal.ge while keeping the /about target.
- Modify apps/web/public/llms.txt — rename the current /about navigation label to Mission — Fiscal.ge without changing its URL or scope description.
- Modify DESIGN.md — add the durable /about / მიზანი visual and responsive contract after the existing Not-found Recovery section.
- Do not modify apps/web/app/sitemap.ts — /about remains the same canonical public route.

## Canonical Copy

The page implementation and the new browser test must use these four paragraphs in this exact order:

    საქართველოში ეკონომიკის, სახელმწიფო ფინანსების, რეგიონების, ვაჭრობის, ბიზნესისა და სხვა მნიშვნელოვანი მიმართულებების შესახებ დიდი რაოდენობით საჯარო მონაცემები არსებობს. თუმცა ეს ინფორმაცია სხვადასხვა უწყების ვებგვერდებზე, ექსელის ფაილებში, ანგარიშებსა და რთულ ცხრილებშია გაფანტული. ხშირად ერთი მარტივი პასუხის მისაღებადაც კი საჭიროა რამდენიმე წყაროს მოძიება, მონაცემების ჩამოტვირთვა, დამუშავება და ერთმანეთთან შედარება.

    პრობლემა მხოლოდ ინფორმაციის მოძიება არ არის. არსებული მონაცემები ხშირად წარმოდგენილია ისეთი ფორმით, რომელიც სპეციალური ცოდნის გარეშე რთულად გასაგებია. ასევე რთულია სხვადასხვა წლის მონაცემების, სხვადასხვა რეგიონისა თუ ეკონომიკური მაჩვენებლების ერთმანეთთან შედარება და საერთო სურათის დანახვა. შედეგად, საჯაროდ ხელმისაწვდომი მონაცემების მნიშვნელოვანი ნაწილი პრაქტიკაში მხოლოდ ადამიანთა მცირე წრისთვის არის მარტივად გამოსაყენებელი.

    fiscal.ge სწორედ ამ პრობლემის გადასაჭრელად შეიქმნა. ჩვენი მიზანია საქართველოს შესახებ საჯაროდ ხელმისაწვდომი ეკონომიკური და ფინანსური მონაცემების დიდი ნაწილი ერთ სივრცეში მოვაქციოთ, დავალაგოთ, ერთმანეთთან დავაკავშიროთ და მარტივი, ვიზუალურად გასაგები ფორმით წარმოვადგინოთ.

    გვინდა, მომხმარებელს რამდენიმე საათის ძიების ნაცვლად, რამდენიმე წამში შეეძლოს საჭირო მონაცემის პოვნა, მისი შედარება და კონტექსტის დანახვა. ჩვენი მიზანია, საქართველოს მონაცემები იყოს არა მხოლოდ საჯარო, არამედ რეალურად ხელმისაწვდომი, გასაგები და გამოყენებადი.

The last sentence in the fourth paragraph must be a separate strong block for the approved visual treatment, but it must remain after the preceding sentence in the same paragraph reading order.

### Task 1: Lock the approved behavior with browser tests

**Files:**
- Create: apps/web/tests/browser/about.spec.ts
- Modify: apps/web/tests/browser/methodology.spec.ts:46-80
- Modify: apps/web/tests/browser/landing.spec.ts:681-689
- Modify: apps/web/tests/browser/seo.spec.ts:503-526
- Modify: apps/web/tests/browser/main-explorer.spec.ts:1208

**Interfaces:**
- Consumes: the existing TEST_BASE_URL/BASE_URL Playwright setup and the about-header, site-footer, mission-cover, mission-copy, and mission-closing test IDs defined by the page implementation.
- Produces: a browser contract that fails against the current About page and precisely describes the new public behavior.

- [ ] **Step 1: Add the failing About-page test.**

Create apps/web/tests/browser/about.spec.ts with a 390px and 1366px run. Define the exact four strings from the Canonical Copy section, navigate to /about, and assert:

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("მიზანი");
    await expect(page.getByTestId("mission-copy").locator("p")).toHaveCount(4);
    for (const [index, copy] of missionCopy.entries()) {
      await expect(page.getByTestId("mission-copy").locator("p").nth(index)).toHaveText(copy);
    }
    await expect(page.getByTestId("mission-copy").locator("h2")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(0);
    await expect(page.getByText("ჩვენი მიზანი / ტექსტი", { exact: true })).toHaveCount(0);
    await expect(page.getByText("საჯარო მონაცემი უნდა მუშაობდეს ადამიანისთვის.", { exact: true })).toHaveCount(0);

Also assert the shared navigation contract: მიზანი links to /about and carries aria-current="page"; მთავარი links to /; მონაცემები links to /explorer; the footer contains exactly one /about link labelled მიზანი; the title is მიზანი — Fiscal.ge; and the page contains the final word გამოყენებადი.

- [ ] **Step 2: Add visual and responsive assertions that initially fail.**

On the 390px run, assert the document has no horizontal overflow, mission-cover fits inside the viewport, the cover is visible before mission-copy, and the footer follows the main content. On both viewports, inspect the closing styles and require:

    const closingStyles = await page.getByTestId("mission-closing").evaluate((element) => {
      const strong = element.querySelector("strong")!;
      const parent = getComputedStyle(element);
      const final = getComputedStyle(strong);
      return {
        parentTopBorder: parent.borderTopWidth,
        parentLeftBorder: parent.borderLeftWidth,
        finalLeftBorder: final.borderLeftWidth,
        finalLeftBorderColor: final.borderLeftColor,
      };
    });

    expect(closingStyles).toEqual({
      parentTopBorder: "0px",
      parentLeftBorder: "0px",
      finalLeftBorder: "4px",
      finalLeftBorderColor: "rgb(179, 64, 42)",
    });

- [ ] **Step 3: Update existing shared-header and breadcrumb expectations.**

In methodology.spec.ts, add the მიზანი link assertion for all public headers and make the /about case expect aria-current="page" only on მიზანი; methodology routes must continue to have no active navigation link. In landing.spec.ts, assert the landing header exposes მიზანი with href="/about" while მთავარი remains active. Remove only the /about tuple from the SEO test that requires visible and structured breadcrumbs to match; keep the /about representative canonical/Open Graph test. Update the explorer test comment so it no longer claims About owns the breadcrumb example.

- [ ] **Step 4: Run the focused tests and confirm the expected red state.**

Run from apps/web:

    npm.cmd run test:browser -- tests/browser/about.spec.ts tests/browser/methodology.spec.ts tests/browser/landing.spec.ts tests/browser/seo.spec.ts

Expected: the new About test fails because the current page still exposes Fiscal.ge-ის შესახებ, the old section grid, the breadcrumb, and no მიზანი header link. Existing methodology/landing tests may fail only where the new shared link is not yet implemented. Do not change production code in this step.

### Task 2: Add the shared მიზანი navigation without changing existing destinations

**Files:**
- Modify: apps/web/components/site/site-header.tsx:3-60
- Modify: apps/web/components/site/site-footer.tsx:41-46

**Interfaces:**
- Consumes: the existing active, yearsLabel, and testId props and the existing navLinkClass helper.
- Produces: a three-link public header with route-aware active state and a footer link whose visible label matches the page identity.

- [ ] **Step 1: Extend the header active-state type and add the route link.**

Change the active prop union to "home" | "explorer" | "mission". Add a third Link after the existing /explorer link:

    <Link
      href="/about"
      aria-current={active === "mission" ? "page" : undefined}
      className={navLinkClass(active === "mission")}
    >
      მიზანი
    </Link>

Keep მთავარი and მონაცემები hrefs and active behavior unchanged.

- [ ] **Step 2: Make the mobile nav a full-width row.**

Keep the desktop nav as an auto-width row with the existing 26px gap. Below 768px, make the nav occupy the next full row, align links to the right, use an 18px gap, and add only the existing paper hairline as its top separator. Retain the current 118px compact logo and ensure the three labels do not overflow at 320px or 390px.

- [ ] **Step 3: Mark /about active and rename the footer link.**

In apps/web/app/about/page.tsx, pass active="mission". In site-footer.tsx, preserve href="/about" and replace only the visible text Fiscal.ge-ის შესახებ with მიზანი.

- [ ] **Step 4: Run the shared-header tests.**

Run:

    npm.cmd run test:browser -- tests/browser/methodology.spec.ts tests/browser/landing.spec.ts

Expected: all shared header/footer assertions pass; the About page content assertions from Task 1 remain red until Task 3.

- [ ] **Step 5: Commit the shared navigation change.**

    git add apps/web/components/site/site-header.tsx apps/web/components/site/site-footer.tsx apps/web/tests/browser/methodology.spec.ts apps/web/tests/browser/landing.spec.ts
    git commit -m "feat: add mission navigation"

### Task 3: Replace the About page with the approved Mission surface

**Files:**
- Modify: apps/web/app/about/page.tsx:1-74

**Interfaces:**
- Consumes: loadServedLandingData() and buildLandingContext() for yearsLabel and updatedAt; the extended SiteHeader active="mission" prop; the unchanged SiteFooter.
- Produces: a static /about page with one H1, one ink cover, one continuous article, and the existing shared footer.

- [ ] **Step 1: Replace the About metadata with mission metadata.**

Keep path: "/about" and use:

    export const metadata = fiscalMetadata({
      title: "მიზანი — Fiscal.ge",
      description:
        "Fiscal.ge-ის მიზანია საქართველოს საჯარო ეკონომიკური და ფინანსური მონაცემები ერთ სივრცეში მოაქციოს და მარტივი, გასაგები ფორმით წარმოადგინოს.",
      path: "/about",
    });

- [ ] **Step 2: Remove the old breadcrumb and section-grid content.**

Delete the BreadcrumbTrail import and render call. Delete the old sections array and its six-section grid; do not carry the old About headings into the new page. This removes the visible breadcrumb and its page-specific breadcrumb JSON-LD while leaving the root layout site JSON-LD and fiscalMetadata output intact.

- [ ] **Step 3: Render the shared header with the Mission active state.**

Keep loadServedLandingData and buildLandingContext exactly as the source of model.yearsLabel and model.updatedAt. Render:

    <SiteHeader active="mission" yearsLabel={model.yearsLabel} testId="about-header" />

- [ ] **Step 4: Implement the ink cover from Variant D.**

Add a section with data-testid="mission-cover" and aria-labelledby="mission-title". Use var(--ink), var(--paper), and var(--accent), not new colors. On desktop, use a three-column grid equivalent to 170px minmax(0, 1fr) 210px with a 40px gap, approximately 310px minimum height, and 38px 40px 43px padding. Render:

    <div aria-hidden="true">
      <strong>01</strong>
      <span>FISCAL.GE<br />OPEN DATA</span>
    </div>
    <h1 id="mission-title">მიზანი</h1>
    <span>{model.updatedAt.slice(0, 4)}<br />MISSION NOTE</span>

The cover must not include საჯარო მონაცემი უნდა მუშაობდეს ადამიანისთვის. At mobile widths, collapse to the approved stacked layout: compact index row, large title, then year/MISSION NOTE metadata. Keep all text inside the viewport.

- [ ] **Step 5: Implement the continuous article with the corrected copy.**

Add an article with data-testid="mission-copy", aria-label="მიზნის ტექსტი", a maximum reading width of approximately 760px, 16px desktop body text, 15px mobile body text, and the existing Georgian body/display font variables. Render exactly four direct paragraphs using the Canonical Copy section above. Do not add h2 headings, chapter numbers, ჩვენი მიზანი / ტექსტი, or any other introductory label. Apply the terracotta drop cap only to the first paragraph as shown in Variant D.

- [ ] **Step 6: Apply the final-line treatment without a top rule.**

Give the fourth paragraph data-testid="mission-closing". Keep the normal sentence first, then render the final sentence as a block-level strong after it:

    <p data-testid="mission-closing" className="mt-[39px] py-[25px] pb-[27px] text-[16px] leading-[1.96] text-[var(--body)] max-[767.99px]:mt-[31px] max-[767.99px]:py-[20px] max-[767.99px]:pb-[23px] max-[767.99px]:text-[15px] max-[767.99px]:leading-[1.88]">
      გვინდა, მომხმარებელს რამდენიმე საათის ძიების ნაცვლად, რამდენიმე წამში შეეძლოს საჭირო მონაცემის პოვნა, მისი შედარება და კონტექსტის დანახვა.
      <strong className="mt-[21px] block border-l-4 border-[var(--accent)] pl-[25px] font-[family-name:var(--font-display)] text-[clamp(25px,3.2vw,38px)] font-semibold leading-[1.45] tracking-[-0.02em] text-[var(--ink)] max-[767.99px]:mt-[18px] max-[767.99px]:pl-[18px] max-[767.99px]:text-[23px]">ჩვენი მიზანია, საქართველოს მონაცემები იყოს არა მხოლოდ საჯარო, არამედ რეალურად ხელმისაწვდომი, გასაგები და გამოყენებადი.</strong>
    </p>

The paragraph itself must have no top border and no left border. The strong must have only a 4px var(--accent) left border, left padding matching the approved desktop/mobile treatment, and the large serif display style. Do not add a border above the paragraph.

- [ ] **Step 7: Keep the shared footer after the article.**

Render SiteFooter updatedAt={model.updatedAt} after main, preserving its existing contact, source, update, navigation, licence, and compact-logo content. The footer’s /about link will display მიზანი because of Task 2.

- [ ] **Step 8: Re-run the focused About tests.**

    npm.cmd run test:browser -- tests/browser/about.spec.ts tests/browser/methodology.spec.ts tests/browser/landing.spec.ts tests/browser/seo.spec.ts

Expected: all focused page, header, footer, metadata, no-breadcrumb, copy-order, border-style, and mobile-overflow assertions pass.

- [ ] **Step 9: Commit the page implementation.**

    git add apps/web/app/about/page.tsx apps/web/tests/browser/about.spec.ts apps/web/tests/browser/seo.spec.ts apps/web/tests/browser/main-explorer.spec.ts
    git commit -m "feat: redesign about page as mission"

### Task 4: Synchronize current agent-facing copy, design documentation, and full verification

**Files:**
- Modify: apps/web/public/llms.txt:27
- Modify: apps/web/tests/seo/agentFiles.test.ts:7-43
- Modify: DESIGN.md after ## 22. Not-found Recovery

**Interfaces:**
- Consumes: the final /about route and the approved D visual contract.
- Produces: consistent current navigation copy for people, search metadata, agent discovery, and the canonical design record.

- [ ] **Step 1: Rename the current agent-facing navigation label.**

Change only this line in apps/web/public/llms.txt:

    - [Mission — Fiscal.ge](https://fiscal.ge/about) — the site's purpose and public-data boundaries.

Do not change the URL or the requiredTargets inventory. In agentFiles.test.ts, add assertions that the new label exists and the old About Fiscal.ge label does not.

- [ ] **Step 2: Record the durable Mission visual contract.**

Update the existing section 7.1 header paragraph so it explicitly includes /about among the public-site header surfaces and states that /about marks მიზანი active while methodology remains inactive. Then append a ## 23. Mission Surface (მიზანი) section to DESIGN.md covering this exact behavior: /about remains the URL; the shared header links are მთავარი, მონაცემები, and მიზანი; only მიზანი is active on /about; no visible breadcrumb is rendered; the cover is an ink block with paper title, terracotta 01, FISCAL.GE / OPEN DATA, and a data-derived review year plus MISSION NOTE; the copy is one continuous four-paragraph article; the final strong sentence alone carries the terracotta left rule; the shared footer remains unchanged apart from the visible navigation label; and the page has no horizontal overflow at the documented mobile breakpoints.

- [ ] **Step 3: Run the unit/SEO checks.**

From apps/web:

    npm.cmd test -- tests/seo/agentFiles.test.ts tests/seo/routes.test.ts

Expected: the /about target remains in the exact 87-route inventory, the agent file still links only to public sitemap pages, and the new Mission — Fiscal.ge label is present.

- [ ] **Step 4: Run the full repository check.**

    npm.cmd run check

Expected: lint, strict typecheck, all Vitest tests, and all data validation checks pass. No data files or database import are part of this UI change.

- [ ] **Step 5: Build the static application.**

    npm.cmd run build

Expected: the static build succeeds and includes /about; no runtime data/API requirement is introduced.

- [ ] **Step 6: Run the full browser suite and inspect visual output.**

    npm.cmd run test:browser

Review /about at 390px, 767px, 768px, and desktop widths in the browser. Confirm the dark cover, continuous article, final left rule, shared header active state, footer label, keyboard focus, no console errors, and no document overflow. The implementation is complete only when these browser results and the full check/build results are green.

- [ ] **Step 7: Commit the synchronized documentation and agent copy.**

    git add apps/web/public/llms.txt apps/web/tests/seo/agentFiles.test.ts DESIGN.md
    git commit -m "docs: document mission page contract"

## Handoff

After the plan is approved for execution, run it from a clean codex/* implementation branch/worktree. Do not push or merge as part of this plan alone. Once implementation and verification are complete, use the repository’s normal review and delivery workflow only when separately authorized.
