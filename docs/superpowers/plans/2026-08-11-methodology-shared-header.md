# Methodology Shared Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the existing public-site header above the methodology hub and all three live methodology articles, with neither navigation link active on methodology routes.

**Architecture:** Extract the landing page's current header markup into a server-safe `SiteHeader` component whose optional `active` prop controls `aria-current` and the accent underline. The landing keeps `active="home"`; the methodology layout renders the same component without an active destination and derives its year label from the already-cached served landing data.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript strict mode, Tailwind v4, Playwright 1.60.

## Global Constraints

- The visual target is the supplied 1640×98 landing-header screenshot: serif `GeoData`, centered `მთავარი` / `ექსპლორერი`, mono coverage at right, and the existing 2px ink rule.
- Methodology remains a separate destination: neither link receives the accent underline or `aria-current`, and no methodology tab is added.
- `/explorer` routes retain their sidebar shell and do not receive this public header.
- Coverage copy is derived from loaded facts through `buildLandingModel`; do not hardcode `2005–2025` in production code.
- Preserve the existing mobile wrapping and hidden coverage label below 768px.
- No new dependency, icon, raster asset, route, footer change, or unrelated refactor.

---

### Task 1: Extract and render the shared public header

**Files:**
- Create: `apps/web/components/site/site-header.tsx`
- Modify: `apps/web/components/landing/landing-page.tsx:49-73`
- Modify: `apps/web/app/methodology/layout.tsx:1-3`
- Test: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Produces: `SiteHeader({ active, yearsLabel, testId }: { active?: "home" | "explorer"; yearsLabel: string; testId: string }): React.ReactElement`.
- Consumes: `loadServedLandingData(): Promise<LandingData>` and `buildLandingModel(data): LandingModel`, whose `yearsLabel` is derived from served facts.
- Preserves: `data-testid="landing-header"` on `/` and adds `data-testid="methodology-header"` on all live methodology routes.

- [ ] **Step 1: Write the failing browser regression**

Add this test to `apps/web/tests/browser/methodology.spec.ts`:

```ts
test("public header keeps landing active and leaves methodology navigation inactive", async ({ page }) => {
  await page.goto("http://localhost:3100/");
  const landingHeader = page.getByTestId("landing-header");
  await expect(landingHeader.getByRole("link", { name: "მთავარი" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const path of [
    "/methodology",
    "/methodology/expenditure",
    "/methodology/revenue",
    "/methodology/municipalities",
  ] as const) {
    await page.goto(`http://localhost:3100${path}`);
    const header = page.getByTestId("methodology-header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: "მთავარი" })).toHaveAttribute("href", "/");
    await expect(header.getByRole("link", { name: "ექსპლორერი" })).toHaveAttribute(
      "href",
      "/explorer",
    );
    await expect(header.locator("[aria-current]")).toHaveCount(0);
    await expect(header).toContainText("2005–2025");

    const headerBox = await header.boundingBox();
    const headingBox = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(headingBox!.y);
  }
});
```

This catches four user-visible breaks: a missing header, incorrect links, a false active state, or placement below the page H1.

- [ ] **Step 2: Run the test and verify RED**

Run from `apps/web`:

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts --grep "public header keeps landing active"
```

Expected: the landing assertion passes, then the first methodology route fails because `methodology-header` does not exist.

- [ ] **Step 3: Create the shared component**

Create `apps/web/components/site/site-header.tsx`:

```tsx
import Link from "next/link";

type SiteHeaderProps = {
  active?: "home" | "explorer";
  yearsLabel: string;
  testId: string;
};

function navLinkClass(isActive: boolean) {
  return isActive
    ? "-mb-3.5 border-b-2 border-[var(--accent)] pb-3 text-[13px] font-semibold text-[var(--ink)]"
    : "-mb-3.5 border-b-2 border-transparent pb-3 text-[13px] font-medium text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)]";
}

export function SiteHeader({ active, yearsLabel, testId }: SiteHeaderProps) {
  return (
    <header
      data-testid={testId}
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b-2 border-[var(--ink)] pb-3.5 min-[768px]:gap-5"
    >
      <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.01em]">
        GeoData
      </span>
      <nav aria-label="ნავიგაცია" className="flex gap-4 min-[768px]:gap-[26px]">
        <Link
          href="/"
          aria-current={active === "home" ? "page" : undefined}
          className={navLinkClass(active === "home")}
        >
          მთავარი
        </Link>
        <Link
          href="/explorer"
          aria-current={active === "explorer" ? "page" : undefined}
          className={navLinkClass(active === "explorer")}
        >
          ექსპლორერი
        </Link>
      </nav>
      <span className="hidden font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)] min-[768px]:inline">
        {yearsLabel}
      </span>
    </header>
  );
}
```

- [ ] **Step 4: Replace only the landing header markup**

Import `SiteHeader` in `apps/web/components/landing/landing-page.tsx` and replace the current `<header data-testid="landing-header">…</header>` with:

```tsx
<SiteHeader active="home" yearsLabel={model.yearsLabel} testId="landing-header" />
```

Keep the existing outer `main`, max-width wrapper, padding, hero, links, and all remaining landing content unchanged.

- [ ] **Step 5: Render the header from the methodology layout**

Replace `apps/web/app/methodology/layout.tsx` with:

```tsx
import { SiteHeader } from "../../components/site/site-header";
import { loadServedLandingData } from "../../lib/data/servedData";
import { buildLandingModel } from "../../lib/landing/landingData";

export default async function MethodologyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const model = buildLandingModel(await loadServedLandingData());

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-[22px] min-[768px]:px-7 min-[768px]:pt-[30px]">
        <SiteHeader yearsLabel={model.yearsLabel} testId="methodology-header" />
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Run focused GREEN verification**

Run from `apps/web`:

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts --grep "public header keeps landing active"
npm.cmd run lint
npm.cmd run typecheck
```

Expected: the new browser test passes on all five visited routes; lint and typecheck exit 0.

- [ ] **Step 7: Run affected and full repository gates**

Run from `apps/web`:

```powershell
npm.cmd run test:browser -- tests/browser/methodology.spec.ts tests/browser/landing.spec.ts
npm.cmd run check
npm.cmd run build
```

Expected: all affected browser assertions pass; `check` exits 0; the build produces the same 90 static routes without a Turbopack whole-project NFT warning. If the Windows Playwright process lingers after printing every `ok` line, record the assertion result separately from the teardown timeout.

- [ ] **Step 8: Perform visual design QA against the supplied screenshot**

Use the in-app browser at a 1640px desktop viewport. Capture the implemented methodology header and compare it at the same 1640×98 crop against `C:/Users/Mylaptop/AppData/Local/Temp/codex-clipboard-8edd2af6-7e1f-4c9a-9e3e-a8f0a26b7cd8.png`. Run `product-design:design-qa`, write `design-qa.md` at the repository root, and require `final result: passed`. Fix P0/P1/P2 differences in padding, baseline alignment, type weight, rule placement, active underline, or coverage positioning; do not expand scope for P3 polish.

- [ ] **Step 9: Review and commit**

Run:

```powershell
git diff --check
git status --short
git diff -- apps/web/components/site/site-header.tsx apps/web/components/landing/landing-page.tsx apps/web/app/methodology/layout.tsx apps/web/tests/browser/methodology.spec.ts design-qa.md
```

Confirm every changed line traces to the approved shared-header requirement, generated preview artifacts remain ignored, and neither methodology link has an active state. Then commit:

```powershell
git add -- apps/web/components/site/site-header.tsx apps/web/components/landing/landing-page.tsx apps/web/app/methodology/layout.tsx apps/web/tests/browser/methodology.spec.ts design-qa.md docs/superpowers/plans/2026-08-11-methodology-shared-header.md
git commit -m "feat(methodology): add shared public header"
```

