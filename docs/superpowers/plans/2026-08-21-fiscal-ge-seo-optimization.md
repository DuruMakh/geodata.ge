# Fiscal.ge SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fiscal.ge consistently indexable, understandable, and competitive for Georgian-language national and municipal budget searches without creating thin pages or weakening data provenance.

**Architecture:** Keep the site fully static. Add a small server-only SEO layer for metadata and JSON-LD, generate stable reviewed CSV distributions during the existing prebuild pipeline, improve semantic links and Georgian explanatory copy in existing routes, and treat Fiscal.ge/Search Console configuration as explicit owner-run release steps with live proof.

**Tech Stack:** Next.js 16 App Router, strict TypeScript, React 19, existing editorial Tailwind v4 system, Vitest, Playwright, Vercel Domains, Google Search Console.

**Spec:** `docs/superpowers/specs/2026-08-21-fiscal-ge-seo-optimization-design.md`

## Global Constraints

- Start implementation from current `origin/main`, which includes Fiscal.ge branding from PR #64; do not implement from detached audit commit `4778df71`.
- Canonical production origin is exactly `https://fiscal.ge`.
- Do not change or redirect `geodata-ge.vercel.app`; the owner will configure that separate preview surface later.
- Preserve the fully static build and CSV/database build-time parity contract.
- Do not add a CMS, blog, English routes, filter landing pages, or unreviewed 2026 plan data.
- Do not introduce an analytics vendor without a separate privacy/product decision.
- All year ranges and latest-year statements derive from served facts.
- Georgian municipality and region grammar must use reviewed/canonical labels as defined in the spec.
- Stable public CSVs retain source/basis metadata and begin with the UTF-8 BOM.
- Original-source rights metadata remains distinct from Fiscal.ge's CC BY 4.0 processed-data license.
- No new client JavaScript is permitted solely for SEO markup or explanatory copy.
- Publishing follows `codex/* branch -> commits -> push -> draft PR -> required CI -> review/resolved conversations -> merge -> delete branch -> deployment -> live verification`.

---

### Task 1: Start from the Fiscal.ge production base and lock the canonical origin

**Files:**
- Modify: `apps/web/lib/siteUrl.ts`
- Modify: `apps/web/tests/lib/siteUrl.test.ts`
- Modify: `docs/deployment.md`
- Test: live host checks after owner configuration

**Interfaces:**
- Consumes: Vercel Production custom domain `fiscal.ge` and current `resolveSiteUrl()` environment resolution.
- Produces: deterministic `https://fiscal.ge` metadata origin across production metadata, robots, and sitemap output.

- [ ] **Step 1: Create an isolated implementation worktree from current main**

Use the `superpowers:using-git-worktrees` skill to create a new isolated worktree and branch named `codex/fiscal-seo` from `origin/main`. After the skill returns the exact worktree path, change into that worktree and run:

```powershell
git rev-parse HEAD
git branch --show-current
git status --short
```

Expected: `HEAD` is at or after `2c5c1403efbea3bea2d18a34bdb856cd7aef4e2c`, the branch is `codex/fiscal-seo`, and `git status --short` is empty. Do not reuse the detached planning checkout.

- [ ] **Step 2: Strengthen the site-origin tests**

Update `apps/web/tests/lib/siteUrl.test.ts` so the production example is Fiscal.ge and add normalization coverage:

```ts
it("uses the explicit Fiscal.ge production origin", () => {
  setEnv({
    NEXT_PUBLIC_SITE_URL: "https://fiscal.ge/",
    VERCEL_PROJECT_PRODUCTION_URL: "geodata-ge.vercel.app",
  });
  expect(resolveSiteUrl()).toBe("https://fiscal.ge");
});

it("does not retain a path in the explicit production origin", () => {
  setEnv({ NEXT_PUBLIC_SITE_URL: "https://fiscal.ge/explorer" });
  expect(() => resolveSiteUrl()).toThrow(/origin/i);
});
```

- [ ] **Step 3: Run the focused test and confirm the new validation fails**

Run:

```powershell
cd apps/web
npm.cmd test -- tests/lib/siteUrl.test.ts
```

Expected: the path-validation test fails because the current resolver only strips trailing slashes.

- [ ] **Step 4: Validate that the configured value is an origin**

In `apps/web/lib/siteUrl.ts`, keep the current resolution order but validate explicit values:

```ts
function normalizedOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS origin without a path, query, or hash");
  }
  return url.origin;
}

export function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalizedOrigin(explicit);

  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionHost) return `https://${vercelProductionHost.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm.cmd test -- tests/lib/siteUrl.test.ts
```

Expected: all site URL tests pass.

- [ ] **Step 6: Update the deployment runbook**

In `docs/deployment.md`:

- record `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` as required in Production;
- state that `geodata-ge.vercel.app` is excluded from this production SEO task and will be configured separately as a preview surface;
- remove any implication that the alternate hostname is current production evidence;
- retain Fiscal.ge as the production inspection URL.

- [ ] **Step 7: Complete the owner-only Vercel configuration**

Set the Production environment value:

```text
NEXT_PUBLIC_SITE_URL=https://fiscal.ge
```

Do not change the Vercel project hostname or add a redirect/middleware rule for it.

- [ ] **Step 8: Verify the canonical origin live**

Run after redeployment:

```powershell
node -e 'for(const u of ["https://fiscal.ge/","https://fiscal.ge/robots.txt","https://fiscal.ge/sitemap.xml","https://fiscal.ge/explorer/revenue"]){const r=await fetch(u);const t=await r.text();console.log(JSON.stringify({u,status:r.status,hasFiscal:t.includes("https://fiscal.ge"),hasOldHost:t.includes("geodata-ge.vercel.app")}))}'
```

Expected:

Expected: all four URLs return 200. Robots, sitemap, and HTML metadata contain Fiscal.ge and do not contain the old hostname.

- [ ] **Step 9: Commit the canonical-origin contract**

```powershell
git add apps/web/lib/siteUrl.ts apps/web/tests/lib/siteUrl.test.ts docs/deployment.md
git commit -m "fix: lock the Fiscal.ge canonical origin"
```

---

### Task 2: Centralize Georgian metadata and add the social preview image

**Files:**
- Create: `apps/web/lib/seo/metadata.ts`
- Create: `apps/web/tests/seo/metadata.test.ts`
- Create: `apps/web/app/opengraph-image.tsx`
- Create: `apps/web/assets/fonts/NotoSerifGeorgian-SemiBold.woff2`
- Create: `apps/web/assets/fonts/OFL.txt`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/explorer/page.tsx`
- Modify: `apps/web/app/explorer/expenditure/page.tsx`
- Modify: `apps/web/app/explorer/revenue/page.tsx`
- Modify: `apps/web/app/explorer/analysis/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/georgia/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/app/methodology/page.tsx`
- Modify: `apps/web/app/methodology/[dataset]/page.tsx`

**Interfaces:**
- Consumes: route path, Georgian title/description, loaded fact years, `resolveSiteUrl()`, canonical municipality and region labels.
- Produces: `fiscalMetadata(input): Metadata`, `coverageFromYears(rows)`, and consistent social metadata.

- [ ] **Step 1: Write failing metadata tests**

Create `apps/web/tests/seo/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { coverageFromYears, fiscalMetadata, municipalityBudgetTitleKa } from "../../lib/seo/metadata";

describe("Fiscal.ge SEO metadata", () => {
  it("derives coverage without assuming input order", () => {
    expect(coverageFromYears([{ year: 2025 }, { year: 2004 }, { year: 2012 }])).toEqual({
      firstYear: 2004,
      lastYear: 2025,
    });
  });

  it("builds canonical, Open Graph, and large Twitter metadata", () => {
    const metadata = fiscalMetadata({
      title: "საქართველოს ბიუჯეტის ხარჯები 2004–2025 | Fiscal.ge",
      description: "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯები სფეროებისა და უწყებების მიხედვით, 2004–2025.",
      path: "/explorer/expenditure",
    });
    expect(metadata.alternates?.canonical).toBe("/explorer/expenditure");
    expect(metadata.openGraph).toMatchObject({
      siteName: "Fiscal.ge",
      locale: "ka_GE",
      url: "/explorer/expenditure",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("uses the full official municipality name for possessive budget copy", () => {
    expect(municipalityBudgetTitleKa("ქალაქ თბილისის მუნიციპალიტეტი", 2015, 2025)).toBe(
      "ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი 2015–2025 | Fiscal.ge",
    );
  });

  it("rejects a municipality name outside the closed official naming contract", () => {
    expect(() => municipalityBudgetTitleKa("თბილისი", 2015, 2025)).toThrow(/მუნიციპალიტეტი/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd apps/web
npm.cmd test -- tests/seo/metadata.test.ts
```

Expected: FAIL because `lib/seo/metadata.ts` does not exist.

- [ ] **Step 3: Implement the metadata helpers**

Create `apps/web/lib/seo/metadata.ts`:

```ts
import type { Metadata } from "next";

const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Fiscal.ge — საქართველოს ბიუჯეტის მონაცემები",
};

type FiscalMetadataInput = {
  title: string;
  description: string;
  path: `/${string}` | "/";
  type?: "website" | "article";
};

export function coverageFromYears(rows: readonly { year: number }[]) {
  if (rows.length === 0) throw new Error("SEO coverage requires at least one served year");
  const years = rows.map((row) => row.year);
  return { firstYear: Math.min(...years), lastYear: Math.max(...years) };
}

export function fiscalMetadata({ title, description, path, type = "website" }: FiscalMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: "Fiscal.ge",
      locale: "ka_GE",
      url: path,
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE.url] },
  };
}

export function municipalityBudgetTitleKa(nameKa: string, firstYear: number, lastYear: number): string {
  if (!nameKa.endsWith("მუნიციპალიტეტი")) {
    throw new Error(`Official municipality name must end in მუნიციპალიტეტი: ${nameKa}`);
  }
  return `${nameKa}ს ბიუჯეტი ${firstYear}–${lastYear} | Fiscal.ge`;
}
```

- [ ] **Step 4: Make every route use the approved title patterns**

Replace repeated metadata objects with `fiscalMetadata()`. Use these exact title results:

```text
საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge
საქართველოს ბიუჯეტის მონაცემები | Fiscal.ge
საქართველოს ბიუჯეტის ხარჯები {firstYear}–{lastYear} | Fiscal.ge
საქართველოს ბიუჯეტის შემოსავლები {firstYear}–{lastYear} | Fiscal.ge
საქართველოს ბიუჯეტის ანალიზი — {latestYear} ფაქტი | Fiscal.ge
საქართველოს მუნიციპალიტეტების ბიუჯეტები {firstYear}–{lastYear} | Fiscal.ge
{officialMunicipalityName}ს ბიუჯეტი {firstYear}–{lastYear} | Fiscal.ge
{REGION_GENITIVE_KA[id]} მუნიციპალიტეტების ბიუჯეტები {firstYear}–{lastYear} | Fiscal.ge
საქართველოს მუნიციპალური ბიუჯეტების ჯამი {firstYear}–{lastYear} | Fiscal.ge
ბიუჯეტის მონაცემთა მეთოდოლოგია და პირველწყაროები | Fiscal.ge
{content.titleKa} — მეთოდოლოგია და მონაცემები | Fiscal.ge
```

For analysis, derive `latestYear` from loaded facts by converting the current static metadata export to `generateMetadata()`.

- [ ] **Step 5: Add the branded 1200×630 image**

Download Noto Serif Georgian SemiBold from the official Google Fonts repository, store the exact WOFF2 as `apps/web/assets/fonts/NotoSerifGeorgian-SemiBold.woff2`, and store the matching SIL Open Font License text as `apps/web/assets/fonts/OFL.txt`. Record the upstream URL and SHA-256 in a code comment beside the font load.

Create `apps/web/app/opengraph-image.tsx` with `ImageResponse`, using the approved editorial tokens and the repository-local font:

```tsx
import { ImageResponse } from "next/og";

const notoSerifGeorgian = fetch(
  new URL("../assets/fonts/NotoSerifGeorgian-SemiBold.woff2", import.meta.url),
).then((response) => response.arrayBuffer());

export const alt = "Fiscal.ge — საქართველოს ბიუჯეტის მონაცემები";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const fontData = await notoSerifGeorgian;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F7F2E9", color: "#1E1B16", padding: "72px 82px", borderTop: "16px solid #1E1B16", fontFamily: "Noto Serif Georgian" }}>
      <div style={{ display: "flex", fontSize: 34, letterSpacing: "0.04em" }}>FISCAL.GE</div>
      <div style={{ display: "flex", maxWidth: 940, fontSize: 72, lineHeight: 1.12 }}>საქართველოს ბიუჯეტის მონაცემები</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, color: "#55503F" }}>
        <span style={{ width: 72, height: 8, background: "#B3402A" }} />
        გადამოწმებული · მრავალწლიანი · ღია
      </div>
    </div>,
    { ...size, fonts: [{ name: "Noto Serif Georgian", data: fontData, weight: 600 }] },
  );
}
```

The production image must have no external runtime font request.

- [ ] **Step 6: Update root metadata defaults**

In `apps/web/app/layout.tsx`, set the Georgian default description, title template, canonical social image, and Twitter card:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: { default: "Fiscal.ge", template: "%s" },
  description: "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული, მრავალწლიანი და ღია მონაცემები.",
};
```

Route helpers own the complete Open Graph/Twitter objects so shallow metadata merging cannot drop the image.

- [ ] **Step 7: Run focused metadata tests and build**

```powershell
npm.cmd test -- tests/seo/metadata.test.ts tests/lib/siteUrl.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Expected: all tests pass; `/opengraph-image` builds; every route remains static.

- [ ] **Step 8: Commit metadata and social presentation**

```powershell
git add apps/web/lib/seo apps/web/tests/seo apps/web/app apps/web/assets/fonts
git commit -m "feat: optimize Georgian search metadata"
```

---

### Task 3: Add safe JSON-LD for the site, breadcrumbs, and datasets

**Files:**
- Create: `apps/web/components/seo/json-ld.tsx`
- Create: `apps/web/lib/seo/structuredData.ts`
- Create: `apps/web/tests/seo/structuredData.test.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/components/shell/page-header.tsx`
- Modify: `apps/web/app/explorer/page.tsx`
- Modify: explorer detail route files listed in Task 2
- Modify: `apps/web/app/methodology/page.tsx`
- Modify: `apps/web/app/methodology/[dataset]/page.tsx`

**Interfaces:**
- Consumes: `resolveSiteUrl()`, visible breadcrumb crumbs, `METHODOLOGY_CONTENT`, derived coverage, reviewed dates, and stable download descriptors from Task 4.
- Produces: safe JSON-LD scripts for `Organization`, `WebSite`, `BreadcrumbList`, `DataCatalog`, and `Dataset`.

- [ ] **Step 1: Write failing structured-data tests**

Create `apps/web/tests/seo/structuredData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, datasetJsonLd, siteJsonLd } from "../../lib/seo/structuredData";

describe("Fiscal.ge structured data", () => {
  it("links the website to the Fiscal.ge publisher", () => {
    const graph = siteJsonLd("https://fiscal.ge");
    expect(graph["@graph"]).toEqual(expect.arrayContaining([
      expect.objectContaining({ "@type": "Organization", "@id": "https://fiscal.ge/#organization" }),
      expect.objectContaining({ "@type": "WebSite", "@id": "https://fiscal.ge/#website", inLanguage: "ka" }),
    ]));
  });

  it("uses absolute ordered breadcrumb URLs", () => {
    const data = breadcrumbJsonLd("https://fiscal.ge", [
      { name: "მთავარი", path: "/" },
      { name: "ბიუჯეტი", path: "/explorer" },
    ]);
    expect(data.itemListElement).toEqual([
      expect.objectContaining({ position: 1, item: "https://fiscal.ge/" }),
      expect.objectContaining({ position: 2, item: "https://fiscal.ge/explorer" }),
    ]);
  });

  it("describes a downloadable CC BY 4.0 dataset", () => {
    const data = datasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/methodology/expenditure",
      name: "საქართველოს სახელმწიფო ბიუჯეტის ხარჯები",
      description: "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯების გადამოწმებული მრავალწლიანი მონაცემები სფეროების მიხედვით.",
      firstYear: 2004,
      lastYear: 2025,
      dateModified: "2026-08-20",
      downloadPath: "/downloads/data/national-expenditure.csv",
    });
    expect(data).toMatchObject({
      "@type": "Dataset",
      temporalCoverage: "2004/2025",
      license: "https://creativecommons.org/licenses/by/4.0/",
      distribution: [expect.objectContaining({ "@type": "DataDownload", encodingFormat: "text/csv" })],
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

```powershell
npm.cmd test -- tests/seo/structuredData.test.ts
```

Expected: FAIL because the structured-data module does not exist.

- [ ] **Step 3: Implement pure structured-data builders**

Create `apps/web/lib/seo/structuredData.ts` with these exported interfaces:

```ts
export type BreadcrumbItem = { name: string; path: `/${string}` | "/" };

export type DatasetJsonLdInput = {
  origin: string;
  path: `/methodology/${string}`;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  downloadPath: `/downloads/data/${string}.csv`;
};

export function siteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${origin}/#organization`, name: "Fiscal.ge", url: origin, email: "info@fiscal.ge" },
      { "@type": "WebSite", "@id": `${origin}/#website`, name: "Fiscal.ge", url: origin, inLanguage: "ka", publisher: { "@id": `${origin}/#organization` } },
    ],
  };
}
```

Implement `breadcrumbJsonLd`, `dataCatalogJsonLd`, and `datasetJsonLd` from the exact spec contract. Dataset descriptions shorter than 50 characters must throw. `downloadPath` becomes an absolute `contentUrl` using `new URL(downloadPath, origin).href`.

- [ ] **Step 4: Add a safe JSON-LD renderer**

Create `apps/web/components/seo/json-ld.tsx`:

```tsx
export function JsonLd({ data, testId }: { data: object; testId?: string }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script data-testid={testId} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
```

Add a test that passes `{"name":"</script><script>alert(1)</script>"}` and confirms the serialized text contains no literal `<`.

- [ ] **Step 5: Render the site graph once**

In `apps/web/app/layout.tsx`, render:

```tsx
<JsonLd data={siteJsonLd(resolveSiteUrl())} testId="site-json-ld" />
```

Place it inside `<body>` before `{children}`. It remains server-rendered and adds no client bundle.

- [ ] **Step 6: Share visible and machine-readable breadcrumbs**

Extend `PageHeader` with an optional `structuredData` rendering input or render `JsonLd` in each page using the same crumb array. Do not maintain two separately written breadcrumb lists.

The resolved machine hierarchy is:

```text
მთავარი -> ბიუჯეტი -> ხარჯები
მთავარი -> ბიუჯეტი -> შემოსავლები
მთავარი -> ბიუჯეტი -> ანალიზი
მთავარი -> ბიუჯეტი -> მუნიციპალიტეტები -> {entity}
მთავარი -> მეთოდოლოგია -> {dataset}
```

- [ ] **Step 7: Add catalog and dataset graphs**

On `/methodology`, render `DataCatalog` with the three canonical dataset page URLs.

On each `/methodology/[dataset]` page, map the dataset to its stable download:

```ts
const DOWNLOADS = {
  expenditure: "/downloads/data/national-expenditure.csv",
  revenue: "/downloads/data/national-revenue.csv",
  municipalities: "/downloads/data/municipal-expenditure.csv",
} as const;
```

Use `deriveMethodologyCoverage()` and `content.reviewedAt`; do not hardcode coverage years.

- [ ] **Step 8: Run focused tests, typecheck, and build**

```powershell
npm.cmd test -- tests/seo/structuredData.test.ts tests/methodology/catalog.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Expected: tests pass; built HTML contains the expected JSON-LD; route rendering remains static.

- [ ] **Step 9: Commit structured data**

```powershell
git add apps/web/components/seo apps/web/lib/seo apps/web/tests/seo apps/web/app apps/web/components/shell/page-header.tsx
git commit -m "feat: describe Fiscal.ge datasets for search"
```

---

### Task 4: Generate stable public CSV dataset distributions

**Files:**
- Create: `apps/web/lib/data/publicDatasetExports.ts`
- Create: `apps/web/scripts/prepare-public-datasets.ts`
- Create: `apps/web/tests/data/publicDatasetExports.test.ts`
- Modify: `apps/web/package.json`
- Modify: `.gitignore`
- Modify: `apps/web/components/methodology/methodology-article.tsx`
- Modify: `apps/web/tests/browser/methodology.spec.ts`

**Interfaces:**
- Consumes: reviewed canonical imports and existing CSV parsing/escaping helpers.
- Produces: three deterministic BOM-prefixed CSVs under `apps/web/public/downloads/data/` and visible methodology download links.

- [ ] **Step 1: Write failing export tests**

Create `apps/web/tests/data/publicDatasetExports.test.ts` with temporary output paths and assert:

```ts
expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
expect(expenditureRows.every((row) => row.side === "expenditure")).toBe(true);
expect(revenueRows.every((row) => row.side === "revenue")).toBe(true);
expect(municipalHeaders).toEqual(expect.arrayContaining(["year", "municipality_code", "category_id", "amount_gel", "basis", "source_id"]));
expect(validation.status).toBe("PASS");
```

Also assert expenditure and revenue row counts equal the matching rows in `data/imports/budget-facts-2004-2025.csv`, and municipal output equals the concatenation contract defined below.

- [ ] **Step 2: Define the municipal distribution schema**

Use one normalized municipal file with these exact columns:

```text
year,entity_id,row_type,category_id,functional_code,amount_gel,basis,source_id
```

Rows:

- municipality function facts: `entity_id=municipality_code`, `row_type=function`;
- municipality totals: `entity_id=municipality_code`, `row_type=total`, `category_id=municipal.total`, `amount_gel=public_total_gel`;
- Georgia function facts: `entity_id=country.georgia`, `row_type=function`;
- Georgia totals: `entity_id=country.georgia`, `row_type=total`, `category_id=municipal.total`, `amount_gel=public_total_gel`.

Do not invent region facts or redistribute Adjara republican functions.

- [ ] **Step 3: Run the focused test and verify failure**

```powershell
npm.cmd test -- tests/data/publicDatasetExports.test.ts
```

Expected: FAIL because the generator is missing.

- [ ] **Step 4: Implement deterministic generation and check modes**

Export:

```ts
export type PublicDatasetId = "national-expenditure" | "national-revenue" | "municipal-expenditure";
export type PublicDatasetValidation = {
  status: "PASS";
  datasetId: PublicDatasetId;
  rowCount: number;
  bytes: number;
  sha256: string;
  firstYear: number;
  lastYear: number;
};

export async function preparePublicDatasets(input: {
  repositoryRoot: string;
  publicRoot: string;
  reportPath: string;
  mode: "write" | "check";
}): Promise<readonly PublicDatasetValidation[]>;
```

Use existing CSV utilities; do not introduce a dependency. Sort national rows by `year,side,item_id` and municipal rows by `year,entity_id,row_type,category_id`. Prefix serialized text with `\uFEFF`.

- [ ] **Step 5: Add the script wrapper**

Create `apps/web/scripts/prepare-public-datasets.ts` following `prepare-methodology-archives.ts`, accepting exactly one of `--write` or `--check`, writing the report to:

```text
data/reports/public-dataset-validation.json
```

- [ ] **Step 6: Wire generation into existing commands**

Update `apps/web/package.json`:

```json
"predev": "npm run data:prepare-methodology-archives && npm run data:prepare-public-datasets",
"prebuild": "npm run data:prepare-methodology-archives && npm run data:prepare-public-datasets",
"data:validate": "tsx scripts/validate-data-files.ts && npm run data:check-national-gdp && npm run data:check-municipal-population && npm run data:check-methodology-archives && npm run data:check-public-datasets",
"data:prepare-public-datasets": "tsx scripts/prepare-public-datasets.ts --write",
"data:check-public-datasets": "tsx scripts/prepare-public-datasets.ts --check"
```

Add `apps/web/public/downloads/data/` to the root `.gitignore` beside generated methodology downloads.

- [ ] **Step 7: Add visible methodology download links**

Pass the dataset download descriptor to `MethodologyArticle` and render one Georgian link:

```text
სრული დამუშავებული მონაცემები — CSV
```

Display coverage, UTF-8/Excel compatibility, and CC BY 4.0. Keep original-source archive downloads separately labeled.

- [ ] **Step 8: Add browser coverage**

In `apps/web/tests/browser/methodology.spec.ts`, request all three stable URLs and assert HTTP 200, CSV content type, BOM bytes, and expected first header.

- [ ] **Step 9: Run the data checks and fixed-point verification**

```powershell
npm.cmd test -- tests/data/publicDatasetExports.test.ts
npm.cmd run data:prepare-public-datasets
npm.cmd run data:check-public-datasets
npm.cmd run data:prepare-public-datasets
npm.cmd run data:check-public-datasets
```

Expected: PASS twice; hashes and byte sizes remain unchanged on the second run.

- [ ] **Step 10: Commit stable dataset distributions**

```powershell
git add .gitignore apps/web/package.json apps/web/lib/data/publicDatasetExports.ts apps/web/scripts/prepare-public-datasets.ts apps/web/tests/data/publicDatasetExports.test.ts apps/web/components/methodology/methodology-article.tsx apps/web/tests/browser/methodology.spec.ts
git commit -m "feat: publish stable budget dataset downloads"
```

---

### Task 5: Make municipality and core-route discovery fully crawlable

**Files:**
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/components/municipalities/entity-picker.tsx`
- Modify: `apps/web/components/municipalities/municipality-map.tsx`
- Modify: `apps/web/components/landing/landing-page.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/components/main-explorer/explorer-view.tsx`
- Modify: `apps/web/components/analysis/analysis-view.tsx`
- Modify: `apps/web/tests/browser/landing.spec.ts`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`

**Interfaces:**
- Consumes: existing route builders and client state behavior.
- Produces: ordinary `href` discovery for all indexable destinations without changing keyboard, focus, filtering, or map behavior.

- [ ] **Step 1: Write browser assertions for real links**

Add assertions before implementation:

```ts
await expect(page.getByTestId("municipal-list-row").first()).toHaveAttribute("href", /\/explorer\/municipalities\/\d+/);
await expect(page.getByTestId("picker-municipality").first()).toHaveAttribute("href", /\/explorer\/municipalities\/\d+/);
await expect(page.getByTestId("landing-shell").getByRole("link", { name: /ხარჯ/ })).toHaveAttribute("href", "/explorer/expenditure");
```

Retain existing click/navigation assertions.

- [ ] **Step 2: Run focused browser tests and verify failure**

```powershell
npm.cmd run test:browser -- tests/browser/landing.spec.ts tests/browser/municipalities.spec.ts tests/browser/municipal-entity.spec.ts
```

Expected: the `href` assertions fail because list/picker destinations are buttons.

- [ ] **Step 3: Convert index rows to links**

In `municipalities-index.tsx`, import `Link`, add this pure destination helper, and replace each navigational row's outer `button` with `Link` using the helper result:

```tsx
function hrefForRow(row: MunicipalListRow): string {
  if (row.kind === "country") return "/explorer/municipalities/georgia";
  if (row.kind === "region") return `/explorer/municipalities/region/${row.id.replace("region.", "")}`;
  return `/explorer/municipalities/${row.id}`;
}
```

Move the current `data-testid`, pointer/focus handlers, class string, and child spans unchanged from the `button` to `<Link href={hrefForRow(row)}>`. Remove only `type="button"` and the `onClick` router call.

Remove the now-unused `useRouter` and `open*` callbacks only from this component.

- [ ] **Step 4: Give picker options hrefs without breaking combobox behavior**

Add a pure `hrefForOption(option)` helper and render country, region, and municipality options as `Link` elements with `role="option"`. Keep `onClick` closing behavior, `tabIndex={-1}`, `aria-selected`, keyboard Enter routing, and focus return. Use `router.push(hrefForOption(option))` only for keyboard selection; pointer users follow the link.

- [ ] **Step 5: Preserve map interaction with adjacent-link coverage**

Do not wrap SVG paths in nested interactive elements. Keep map activation unchanged and prove that every map entity code exists in the adjacent list-link set.

- [ ] **Step 6: Deep-link the homepage**

Change the three data pathways so the visible calls to action resolve to:

```text
/explorer/expenditure
/explorer/analysis
/explorer/revenue
```

Add a direct municipality pathway link to `/explorer/municipalities` in the existing product navigation area; do not add a new card system.

- [ ] **Step 7: Add contextual methodology links**

Expenditure and analysis expenditure context link to `/methodology/expenditure`; revenue links to `/methodology/revenue`; municipal pages link to `/methodology/municipalities`. Reuse the existing methodology promo style.

- [ ] **Step 8: Run focused unit/browser tests**

```powershell
npm.cmd run typecheck
npm.cmd run test:browser -- tests/browser/landing.spec.ts tests/browser/municipalities.spec.ts tests/browser/municipal-entity.spec.ts
```

Expected: tests pass; link semantics exist; keyboard and click navigation still work.

- [ ] **Step 9: Commit semantic navigation**

```powershell
git add apps/web/components apps/web/tests/browser
git commit -m "fix: expose crawlable Fiscal.ge navigation"
```

---

### Task 6: Add Georgian search-intent copy and the trust page

**Files:**
- Create: `apps/web/components/seo/seo-introduction.tsx`
- Create: `apps/web/lib/seo/content.ts`
- Create: `apps/web/app/about/page.tsx`
- Create: `apps/web/tests/seo/content.test.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: core explorer and municipal route files from Task 2
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `apps/web/components/analysis/analysis-view.tsx`
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx`
- Modify: `apps/web/components/site/site-footer.tsx`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/tests/browser/landing.spec.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`

**Interfaces:**
- Consumes: loaded coverage, entity labels, basis status, methodology paths, and approved glossary language.
- Produces: concise server-rendered Georgian page summaries plus `/about`.

- [ ] **Step 1: Write content-model tests**

Create tests that assert:

```ts
expect(expenditureIntroduction({ firstYear: 2004, lastYear: 2025 })).toContain("საქართველოს ბიუჯეტის ხარჯები");
expect(expenditureIntroduction({ firstYear: 2004, lastYear: 2025 })).toContain("ფაქტობრივ");
expect(municipalityIntroduction({ nameKa: "ქალაქ თბილისის მუნიციპალიტეტი", firstYear: 2015, lastYear: 2025 })).toContain("ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი");
expect(allCoreIntroductions.every((text) => text.length >= 180 && text.length <= 900)).toBe(true);
```

The test prevents empty keyword labels and excessively long prose.

- [ ] **Step 2: Implement pure Georgian content functions**

Create `apps/web/lib/seo/content.ts` with functions for:

```ts
expenditureIntroduction(coverage)
revenueIntroduction(coverage)
analysisIntroduction(latestYear)
municipalitiesIntroduction(coverage)
municipalityIntroduction(entityCoverage)
regionIntroduction(entityCoverage)
```

Use the exact semantics in the spec. Text must state that figures are reviewed actual execution where the served facts are actual; do not claim all future facts will always be actual.

- [ ] **Step 3: Render copy without client JavaScript**

Create `SeoIntroduction` as a server-compatible presentational component containing a paragraph and methodology link. Render it near each page H1 or immediately before the main workspace. Do not hide the text in a collapsed disclosure or tab.

- [ ] **Step 4: Add the homepage explanation**

Add a compact section with this content structure:

```text
რა არის Fiscal.ge?
საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული, მრავალწლიანი მონაცემები.
ოფიციალური სამართლებრივი დოკუმენტი უცვლელად რჩება პირველწყაროდ; Fiscal.ge მონაცემებს ადარებად, გასაგებად და ჩამოსატვირთად აწყობს.
```

Link `პირველწყაროები და მეთოდოლოგია` to `/methodology`.

- [ ] **Step 5: Create `/about`**

The page contains these visible sections:

```text
Fiscal.ge-ის შესახებ
რას ვაქვეყნებთ
როგორ ვამოწმებთ მონაცემებს
შესწორებების პოლიტიკა
როგორ მიუთითოთ წყარო
ლიცენზია და პირველწყაროების უფლებები
კონტაქტი
```

Required facts:

- Fiscal.ge is an independent Georgian-first budget-data explorer.
- Processed Fiscal.ge datasets are CC BY 4.0 with attribution.
- Original documents retain the rights/status recorded in each source manifest.
- Suspected errors are reported to `info@fiscal.ge`.
- Corrections update the reviewed data/methodology and last-reviewed date; silent numerical corrections are not permitted.

Do not name a legal entity, founder, editorial board, or partner unless the owner supplies and approves that public identity.

- [ ] **Step 6: Add About discovery**

Add `/about` to the footer and sitemap. Use metadata:

```text
Title: Fiscal.ge-ის შესახებ — მონაცემები, წყაროები და შესწორებები
Description: როგორ ამოწმებს და აქვეყნებს Fiscal.ge საქართველოს საბიუჯეტო მონაცემებს, როგორ მიუთითოთ წყარო და როგორ გვაცნობოთ შესაძლო შეცდომა.
```

- [ ] **Step 7: Add browser assertions**

Prove core introductions are visible without interaction, `/about` is reachable from the footer, the contact email is correct, the CC BY 4.0 distinction is visible, and `/about` is included in the sitemap.

- [ ] **Step 8: Run focused tests and Georgian copy review**

```powershell
npm.cmd test -- tests/seo/content.test.ts
npm.cmd run test:browser -- tests/browser/landing.spec.ts tests/browser/main-explorer.spec.ts tests/browser/municipal-entity.spec.ts
```

Then have a Georgian-fluent reviewer approve the six content functions and `/about` text. Record corrections in the PR; do not merge unreviewed Georgian copy.

- [ ] **Step 9: Commit search-intent content**

```powershell
git add apps/web/components/seo apps/web/lib/seo/content.ts apps/web/app apps/web/components/site/site-footer.tsx apps/web/tests
git commit -m "feat: add Georgian SEO content and trust page"
```

---

### Task 7: Add SEO regression coverage and the Search Console runbook

**Files:**
- Create: `apps/web/tests/seo/routes.test.ts`
- Create: `docs/seo/search-console-runbook.md`
- Create: `docs/seo/baseline-template.md`
- Modify: `apps/web/app/sitemap.ts`
- Modify: `apps/web/app/robots.ts`
- Modify: `apps/web/tests/browser/landing.spec.ts`

**Interfaces:**
- Consumes: route inventory, Fiscal.ge origin, metadata/schema builders, Search Console owner access.
- Produces: automated route invariants and a repeatable indexing baseline.

- [ ] **Step 1: Add route-inventory tests**

Test the sitemap result directly with loaded data and assert:

```ts
expect(urls).toHaveLength(87); // prior 86 public HTML pages plus /about
expect(new Set(urls).size).toBe(urls.length);
expect(urls.every((url) => url.startsWith("https://fiscal.ge/"))).toBe(true);
expect(urls).toContain("https://fiscal.ge/about");
expect(urls.some((url) => url.includes("#") || url.includes("?"))).toBe(false);
```

If current `origin/main` contains a different verified pre-SEO HTML-page count at implementation time, update the numeric expectation and document the exact inventory difference in the test comment. Do not weaken the test to `greaterThan(0)`.

- [ ] **Step 2: Test representative rendered head output**

In Playwright, verify homepage, expenditure, analysis, municipalities, municipality `04`, one region, methodology, one dataset page, and `/about` for:

```ts
await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/fiscal\.ge/);
await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/fiscal\.ge\//);
await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
```

- [ ] **Step 3: Create the Search Console runbook**

`docs/seo/search-console-runbook.md` records:

1. Verify the `fiscal.ge` Domain property using DNS.
2. Submit `https://fiscal.ge/sitemap.xml`.
3. Inspect the ten representative URLs listed in the spec.
4. Record whether the user-declared canonical and Google-selected canonical match.
5. Record page indexing state and referring sitemap.
6. Request indexing for the representative pages only after live tests pass.
7. Confirm Google-selected canonicals match Fiscal.ge on the representative sample.
8. Export Performance report data monthly with Georgian query, page, device, and country dimensions.

- [ ] **Step 4: Create the baseline template**

`docs/seo/baseline-template.md` contains a dated table for:

```text
Sitemap URLs
Indexed URLs
Excluded URLs by reason
Clicks
Impressions
CTR
Average position
Branded query clicks/impressions
Non-branded query clicks/impressions
Top 20 queries
Top 20 landing pages
Mobile/desktop split
Core Web Vitals route groups
```

It also records the exact Search Console export date range and property.

- [ ] **Step 5: Run focused SEO tests**

```powershell
npm.cmd test -- tests/seo
npm.cmd run test:browser -- tests/browser/landing.spec.ts
```

Expected: all route/head invariants pass.

- [ ] **Step 6: Commit regression coverage and operations docs**

```powershell
git add apps/web/tests/seo apps/web/app/sitemap.ts apps/web/app/robots.ts apps/web/tests/browser/landing.spec.ts docs/seo
git commit -m "test: protect Fiscal.ge search indexing"
```

---

### Task 8: Measure page experience and make only evidence-backed payload reductions

**Files:**
- Create: `docs/seo/performance-baseline.md`
- Modify only if a measured issue traces directly to an existing SEO route payload.
- Test: current browser suites for any modified route family.

**Interfaces:**
- Consumes: live Fiscal.ge routes, PageSpeed/Lighthouse results, built HTML sizes, Search Console Core Web Vitals when available.
- Produces: before/after evidence and bounded payload corrections.

- [ ] **Step 1: Capture live transfer and HTML baselines**

Run a Node HTTPS probe for:

```text
/
/explorer/expenditure
/explorer/revenue
/explorer/analysis
/explorer/municipalities
/explorer/municipalities/04
/methodology
/methodology/expenditure
/about
```

Record status, Brotli bytes, decompressed HTML characters, script count, and cache headers in `docs/seo/performance-baseline.md`.

- [ ] **Step 2: Capture mobile Lighthouse/PageSpeed evidence**

For one URL in each route family, record LCP, INP/TBT, CLS, performance score, SEO score, and the test timestamp. Distinguish lab data from Search Console field data.

- [ ] **Step 3: Compare with the no-regression contract**

Fail the SEO release if any representative route increases decompressed HTML or transferred JavaScript by more than 10% without an explained content requirement.

- [ ] **Step 4: Apply only bounded corrections**

Allowed corrections in this task:

- remove duplicated serialized data introduced by SEO work;
- keep JSON-LD server-only;
- avoid sending complete crumb/catalog data twice;
- defer an existing inactive visualization import where current route tests already define behavior.

If the municipality index or explorer needs a structural client/server split, stop and create a separate performance design/spec. Do not hide that rewrite inside SEO implementation.

- [ ] **Step 5: Re-run affected tests and baselines**

Run the route family's unit/browser tests and recapture the exact same live/lab metrics on the preview deployment.

- [ ] **Step 6: Commit evidence or bounded fixes**

```powershell
git add docs/seo/performance-baseline.md
git commit -m "docs: record Fiscal.ge SEO performance baseline"
```

If bounded code fixes were required, stage only their exact files and use `perf: reduce Fiscal.ge route payload` as a separate commit.

---

### Task 9: Full verification, PR delivery, production proof, and Search Console handoff

**Files:**
- Modify only if a verification failure directly traces to this SEO implementation.

**Interfaces:**
- Consumes: all completed SEO tasks and owner access to GitHub, Vercel, DNS, and Search Console.
- Produces: merged implementation, matching production deployment, verified live Fiscal.ge behavior, and a dated search baseline.

- [ ] **Step 1: Run the complete local verification stack**

From `apps/web`:

```powershell
npm.cmd run data:check-public-datasets
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
git diff --check
```

Expected: all commands exit 0. Record exact test counts and build route inventory in the PR.

- [ ] **Step 2: Inspect the final diff**

```powershell
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Confirm there are no generated download files, build outputs, unrelated data changes, or branding reversions.

- [ ] **Step 3: Push and open a draft PR**

```powershell
git push -u origin codex/fiscal-seo
gh pr create --draft --base main --head codex/fiscal-seo --title "feat: optimize Fiscal.ge for Georgian search" --body-file docs/seo/pr-description.md
```

Create `docs/seo/pr-description.md` before this command with scope, canonical-origin behavior, title/schema changes, download hashes/counts, Georgian copy review evidence, performance baseline, and local verification. Remove the temporary PR-description file before the final implementation commit unless the project decides it is durable documentation.

- [ ] **Step 4: Wait for and resolve required review**

Require all protected checks green. Inspect every review thread, make only evidence-backed corrections, rerun affected tests, and resolve conversations. Mark the PR ready only after the Georgian copy review and Vercel owner configuration are complete.

- [ ] **Step 5: Merge and delete the branch**

Merge only after required CI is green. Delete the remote branch through the PR merge flow. Do not bypass checks or push the implementation directly to `main`.

- [ ] **Step 6: Verify the production deployment, not only the hook**

Confirm Vercel `READY` and matching merge SHA. Check live:

```text
https://fiscal.ge/
https://fiscal.ge/robots.txt
https://fiscal.ge/sitemap.xml
https://fiscal.ge/opengraph-image
https://fiscal.ge/explorer/expenditure
https://fiscal.ge/explorer/revenue
https://fiscal.ge/explorer/analysis
https://fiscal.ge/explorer/municipalities
https://fiscal.ge/explorer/municipalities/04
https://fiscal.ge/explorer/municipalities/region/imereti
https://fiscal.ge/methodology
https://fiscal.ge/methodology/expenditure
https://fiscal.ge/downloads/data/national-expenditure.csv
https://fiscal.ge/about
```

Require HTTP 200, Fiscal.ge canonical, expected title/H1, JSON-LD, social image, no runtime console errors, and working internal links. Validate the three CSV BOMs and hashes.

- [ ] **Step 7: Complete Search Console handoff**

Follow `docs/seo/search-console-runbook.md`, submit the sitemap, inspect the representative URLs, and create the first dated baseline using `docs/seo/baseline-template.md`.

If Google has not crawled the site yet, record `pending crawl` rather than claiming indexing success. Schedule the first comparison after 28 complete days of Search Console data.

- [ ] **Step 8: Report final evidence**

Report:

- worktree and branch used;
- commits and merged SHA;
- required CI status;
- Vercel deployment ID and matching SHA;
- live Fiscal.ge canonical-origin verification;
- sitemap URL count;
- structured-data validation result;
- stable download row counts/hashes/BOM checks;
- Search Console submission/inspection state;
- baseline date and any still-unverified ranking boundary.

Do not report ranking improvement until Search Console data demonstrates it.
