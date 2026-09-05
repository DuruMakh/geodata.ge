# Fiscal.ge Bilingual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Follow active-session delegation instructions before dispatching workers.

**Goal:** Establish reviewed language data and static language-aware routing without changing reviewed figures or Georgian behaviour.

**Architecture:** Pure locale/link helpers and scoped message dictionaries sit beside a build-only translation inventory/catalogue loader. Separate Georgian and English root documents share chrome and page implementations. All later website and AI tasks consume the interfaces defined here.

**Tech Stack:** Existing Next.js 16.2.11, React 19.2.8, TypeScript, Zod, Vitest, and Playwright; Node 24.x.

**Spec:** [Approved design](../specs/2026-09-05-fiscal-bilingual-design.md). Read the [master plan](2026-09-05-fiscal-bilingual.md) for ordering, complete constraints, commands, and release gates.

## Global Constraints

- Georgian stays at all existing page addresses; English equivalents use `/en`.
- There is no request-time language middleware and no use of request headers or cookies to choose page content.
- `/mcp` remains the sole request-time application route.
- Do not translate IDs or hash keys.
- English text does not silently fall back to Georgian or a technical identifier.
- Runtime visitors never receive an automatic translation.
- The master plan's remaining global constraints apply unchanged. All application paths are repository-relative; application commands run in `apps/web`.

## Task F1: Record a reproducible baseline and route/content inventory

**Files:** Read `AGENTS.md`, `CLAUDE.md`, `apps/web/AGENTS.md`, `DESIGN.md`, `Project_Definition.md`, `apps/web/{package.json,playwright.config.ts}`, and the approved spec. Evidence only: `.tmp/bilingual/baseline/`. No application mutation in this task.

**Interfaces:** Produce `baseline.md` containing checked commit, data source, test counts, route list, build duration, known failures, sample URLs, and saved artifact locations; `baseline-manifest.json` containing existing public download hashes/sizes. Later measurements use these exact files.

- [x] Recheck the checkout, branch, worktrees, existing changes, and available local port with the master-plan inspection commands. Keep the existing linked worktree; do not create a second worktree or reset it. If dependencies are absent, run `npm ci` in `apps/web` once.
- [x] Read the installed `node_modules/next/dist/docs/` guides for root layouts, route groups, and `global-not-found`; if that package lacks the docs, use current official documentation through Context7. Confirm the planned experimental flag against the installed version before route edits.
- [x] Run `npm run check` and `npm run build` sequentially, then the existing reference fixture. Record actual counts, exits, build duration, and the prerendered/request-time route list. Diagnose pre-existing failures separately; never claim them caused by localization or erase their expectations.
- [x] Start this checkout's production server using the master-plan isolated-port procedure. Run the existing browser suite against it and save representative screens at 390 and 1440 pixels. Include homepage, expenditure ministries, municipal index/detail/region/country, analysis, debt, deficit, methodology, About, and connection.
- [x] Save the existing publication manifest and sample Georgian workbooks, using the actual download events. Record the raw machine CSV hashes and a representative original archive hash from each archive family. These are parity baselines, not new canonical data.

```powershell
# Repository root: evidence directory, not a tracked source directory
New-Item -ItemType Directory -Force -Path '.tmp/bilingual/baseline'
git rev-parse HEAD

# apps/web, after the baseline build
Copy-Item -LiteralPath 'public/downloads/data/manifest.json' -Destination '../../.tmp/bilingual/baseline/baseline-manifest.json'
Get-FileHash -Algorithm SHA256 -LiteralPath 'public/downloads/data/national-expenditure.csv'
```

- [x] List current pages with `rg --files app -g 'page.tsx'`, and public Georgian text owners with `rg -l '[\p{Georgian}]' app components lib`. Inspect strings in SVG/brand assets and `public/llms.txt` too. Classify visible strings, accessibility strings, generated prose, source descriptions, technical codes, and explicitly retained original text. Do not translate an entire source file just because it contains Georgian characters.

**Done:** baseline is tied to a commit and a server from this checkout. This task produces evidence and therefore needs no artificial code change or commit.

## Task F2: Define language, message, link, and search primitives

**Files:** Create `apps/web/lib/i18n/{types,routes,messages,messages.server,search}.ts`, `apps/web/lib/i18n/provider.tsx`, `apps/web/lib/i18n/messages/{ka,en}/common.json`; create `apps/web/tests/i18n/{routes,messages,search}.test.ts`. Do not move routes yet.

**Interfaces:**

```ts
export type Locale = 'ka' | 'en';
export type Messages = Readonly<Record<string, string>>;
export type MessageScope = 'common'; // each W task adds its named implemented scope
export type TemplateValues = Readonly<Record<string, string | number>>;

export function splitLanguagePath(pathname: string): { locale: Locale; pathname: string };
export function pageHref(href: string, locale: Locale): string;
export function switchLanguageHref(location: { pathname: string; search: string; hash: string }, target: Locale): string;
export async function getMessages(locale: Locale, scopes: readonly MessageScope[]): Promise<Messages>;
export function message(messages: Messages, key: string, values?: TemplateValues): string;
export function matchesLabelQuery(query: string, values: readonly string[]): boolean;
export function I18nProvider(props: { locale: Locale; messages: Messages; children: React.ReactNode }): React.ReactElement;
export function useI18n(): { locale: Locale; messages: Messages };
```

Declarations above belong in their named responsibility files, not one combined utility. `getMessages` lives in `messages.server.ts` for server/build-side loading; `message`, route helpers, label matching, and context are browser-safe. Scoped dictionaries use flat, section-prefixed keys. `common` owns all chrome and shared control labels. Literal wording is checked against existing Georgian copy before extraction.

- [x] Add the following tests, with imports from the corresponding new helper file. Include root `/en`, English-to-Georgian, a shared hash, code routes, repeated prefix prevention, and an external URL.

```ts
it('changes only the page language', () => {
  const hash = '#g=ministries&m=table&r=2020-2025&sel=admin_spending.defence';
  expect(switchLanguageHref({ pathname: '/explorer/expenditure', search: '?source=share', hash }, 'en'))
    .toBe(`/en/explorer/expenditure?source=share${hash}`);
  expect(pageHref('/en/explorer/debt', 'ka')).toBe('/explorer/debt');
  expect(pageHref('/en/explorer/debt', 'en')).toBe('/en/explorer/debt');
  expect(pageHref('/', 'en')).toBe('/en');
  expect(pageHref('/mcp', 'en')).toBe('/mcp');
  expect(pageHref('/downloads/data/manifest.json', 'en')).toBe('/downloads/data/manifest.json');
  expect(pageHref('https://mof.ge', 'en')).toBe('https://mof.ge');
  expect(pageHref('mailto:info@fiscal.ge', 'en')).toBe('mailto:info@fiscal.ge');
});

it('uses exact message parameters and fails on an untranslated key', () => {
  expect(message({ 'common.selected': 'Selected {count} of {total}' }, 'common.selected', { count: 2, total: 9 }))
    .toBe('Selected 2 of 9');
  expect(() => message({}, 'common.selected')).toThrow('common.selected');
});

it('finds either reviewed language without broadening matching', () => {
  expect(matchesLabelQuery('BATUMI', ['ბათუმი', 'Batumi'])).toBe(true);
  expect(matchesLabelQuery('ბათუმი', ['ბათუმი', 'Batumi'])).toBe(true);
  expect(matchesLabelQuery('Gori', ['ბათუმი', 'Batumi'])).toBe(false);
});
```

- [x] Run `npx vitest run tests/i18n/routes.test.ts tests/i18n/messages.test.ts tests/i18n/search.test.ts`; confirm the new behaviour is absent.
- [x] Implement prefix removal only for the exact `/en` segment, then add a prefix only for public page families: `/`, `/about`, `/connect`, `/explorer` and descendants, `/methodology` and descendants. Leave other resources and external links unchanged. Preserve suffixes by separating pathname, query, and hash before normalization. Never turn `/english` into `/glish` or `/en/en/...` into a normal route silently.

```ts
export function splitLanguagePath(pathname: string): { locale: Locale; pathname: string } {
  if (pathname === '/en') return { locale: 'en', pathname: '/' };
  if (pathname.startsWith('/en/')) return { locale: 'en', pathname: pathname.slice(3) };
  return { locale: 'ka', pathname };
}

export function switchLanguageHref(location: { pathname: string; search: string; hash: string }, target: Locale): string {
  return `${pageHref(location.pathname, target)}${location.search}${location.hash}`;
}

export function matchesLabelQuery(query: string, values: readonly string[]): boolean {
  const normalized = query.normalize('NFC').trim().toLocaleLowerCase('en');
  return normalized === '' || values.some(value => value.normalize('NFC').toLocaleLowerCase('en').includes(normalized));
}
```

- [x] Implement `message` using `{name}` interpolation. Missing messages or required parameters fail clearly during tests/build; they never fall back to a Georgian key or ID. Add compile-time types for messages and build-time key/parameter parity in F3. `getMessages` imports only requested scope files and merges distinct prefixed keys; duplicate keys fail validation. Keep original-language fragments as separate marked elements, not HTML injected into a dictionary.
- [x] Implement the provider as a small client context using React's `createContext`, `useContext`, and a required explicit value. Shared chrome receives `common`; page client roots receive `common` plus only that page's implemented scopes. Child providers get a complete scoped value rather than implicitly pulling all languages into the root bundle.
- [x] Run the focused tests and `npm run typecheck`. Inspect preservation tests for resources and fragments, then commit the named new files with `feat: add bilingual locale and message primitives`.

**Done:** a locale is explicit, page links are deterministic, resources are untouched, and both-language search uses reviewed strings without introducing fuzzy matches.

> F1/F2 verified on 2026-09-05: baseline 1,574 unit tests and 281 browser tests; 44 new helper/context tests; full updated check 1,618 tests; production build and publication parity passed. Evidence is under `.tmp/bilingual/`. The browser-safe formatter and server dictionary loader are split into separate modules.

## Task F3: Build and review the translation catalogue and coverage validator

**Files:** Create `data/localization/en/{labels,programme-history,sources,documents}.json`; `apps/web/lib/i18n/{catalogue.server,inventory.server,labels,validation}.ts`; `apps/web/scripts/check-localization.ts`; `apps/web/tests/i18n/{catalogue,coverage,labels}.test.ts`. Modify `apps/web/lib/factQuery/buildSnapshot.ts` only to export its existing manifest-document loader under `loadManifestDocuments`; do not alter snapshot output yet. Modify `apps/web/package.json` to add `i18n:check` and run it in `prebuild` and `check` after required source preparation. Record review coverage in `docs/data-methodology/bilingual-presentation.md`.

**Interfaces:**

```ts
export type ReviewedText = { text: string; reviewedAt: string };
export type EnglishCatalogue = {
  labels: Record<string, ReviewedText>;
  programmeHistory: Record<string, Record<string, ReviewedText & { originalKa: string }>>;
  sources: Record<string, { name: ReviewedText; derivation: ReviewedText | null }>;
  documents: Record<string, {
    title: ReviewedText; publisher: ReviewedText; attribution: ReviewedText | null;
    documentLanguage: 'ka' | 'en' | 'mul' | null;
  }>;
};
export type TranslationInventory = {
  pagePaths: string[]; labelIds: string[]; sourceIds: string[]; documentIds: string[];
  programmeHistory: Array<{ seriesId: string; year: number; originalKa: string }>;
};
export async function loadEnglishCatalogue(repositoryRoot: string): Promise<EnglishCatalogue>;
export async function loadTranslationInventory(): Promise<TranslationInventory>;
export async function listPublicPagePaths(): Promise<string[]>;
export function validateCatalogue(catalogue: EnglishCatalogue, inventory: TranslationInventory): string[];
export function publicLabel(locale: Locale, id: string, labelKa: string, englishLabels: Readonly<Record<string, string>>): string;
export function pickEnglishLabels(catalogue: EnglishCatalogue, ids: readonly string[]): Record<string, string>;
export function validateMessages(ka: Messages, en: Messages): string[];
export async function checkLocalization(): Promise<{ errors: string[]; routeCount: number; labelCount: number }>;
```

Store these types in `types.ts`; pure label and validation functions must not import the `.server` loaders. The inventory loader uses existing served-data loaders and `loadManifestDocuments`, not `buildFactQuerySnapshot`: the future snapshot depends on the catalogue, so calling it from catalogue validation would create a cycle.

- [ ] Add tests using a minimal in-memory catalogue/inventory: a missing label, blank label, missing document, invalid review date, missing programme year, changed `originalKa`, mismatched message parameters, and a complete valid pair. Do not access production data to test a missing-key branch.

```ts
it('requires an English display name without changing the Georgian name', () => {
  const english = { 'spending.education': 'Education' };
  expect(publicLabel('ka', 'spending.education', 'განათლება', english)).toBe('განათლება');
  expect(publicLabel('en', 'spending.education', 'განათლება', english)).toBe('Education');
  expect(() => publicLabel('en', 'spending.health', 'ჯანდაცვა', english)).toThrow('spending.health');
});

it('detects a lost interpolation variable', () => {
  expect(validateMessages({ 'x.count': '{count} / {total}' }, { 'x.count': '{count}' })).not.toEqual([]);
  expect(validateMessages({ 'x.count': '{count} / {total}' }, { 'x.count': '{count} of {total}' })).toEqual([]);
});
```

- [ ] Run `npx vitest run tests/i18n/catalogue.test.ts tests/i18n/coverage.test.ts tests/i18n/labels.test.ts`, confirm the expected failures, then implement strict catalogue loading with the existing Zod dependency. Require nonblank reviewed text and valid ISO review dates. Report failures with catalogue path and stable identity.
- [ ] Implement inventory construction from the same closed public route lists, served series/derived totals, current and historical programme names, six dataset identities, municipal and regional names, source registry, and full public archive documents. Include source-only aggregate entities where actually exposed. `documentId` for ordinary methodology archive rows is their `source_id`; package-manifest document IDs must come from the existing manifest loader. Do not join a source name to a document by translating the name.
- [ ] Define `listPublicPagePaths()` as the inventory's page portion using shared route lists and loaded regions, not a second hardcoded municipality list. It returns unprefixed public paths including all live methodology pages and excludes protocol/resources. It must be usable before the English catalogue exists.
- [ ] Seed and review the catalogue in four batches: national/ministry categories; all served programmes and historical variants; municipal/region/debt/deficit labels; source and document descriptions. Existing English values are seeds, not automatically approved terminology. Retain the official Georgian names verbatim in historical guard records.

```json
{
  "spending.education": { "text": "Education", "reviewedAt": "2026-09-05" },
  "spending.defence": { "text": "Defence", "reviewedAt": "2026-09-05" }
}
```

Use the actual review date when authoring; the sample does not authorize marking unseen translations reviewed. Each batch must reconcile to the loaded inventory. Check established English institutional names against official sources when unclear. Identify documentary language only from evidence; retain `null` when unknown. Review long-source explanations and fiscal terminology with the relevant methodology, not a word-for-word substitution.
- [ ] Add `publicLabel` and `pickEnglishLabels`; return plain strings to client components and omit review metadata. Both languages use identical selected IDs; Georgian labels stay current. Include whole-word or exact allowances for source quotations in a maintained exception list inside `validation.ts`, with reasons and contexts; do not globally suppress Georgian-script detection.

```ts
export function publicLabel(locale: Locale, id: string, labelKa: string, englishLabels: Readonly<Record<string, string>>): string {
  if (locale === 'ka') return labelKa;
  const label = englishLabels[id];
  if (!label?.trim()) throw new Error(`Missing English label: ${id}`);
  return label;
}
```

- [ ] Wire `checkLocalization()` to validate the loaded catalogue and every currently implemented message-scope pair. The CLI supports `--check` (nonzero exit on errors) and `--inventory` (print IDs/counts without requiring translated files). As W/A tasks add scopes and methodology/service templates, they register their validators here. Retain a final full-coverage gate in V1; early checks must not describe untranslated page components as complete.
- [ ] Run `npm run i18n:check`, focused tests, and `npm run typecheck`. Confirm the same original data objects fed through CSV-shaped and mirror-shaped fixtures produce the same English map, without requiring live credentials. Commit the named files with `feat: validate reviewed English presentation catalogue`.

**Done:** catalogue records cover every exposed identity and historical variant. All consumers have one English display authority; numerical imports, archive bytes, and the mirror are unchanged.

## Task F4: Migrate the route roots and install the language switch

**Files:** Move existing public page/layout trees into `apps/web/app/(ka)/`; move home, About, connection, explorer, and methodology pages, preserving their existing public paths. Keep root protocol/metadata resources at their addresses. Create `apps/web/app/(ka)/layout.tsx`, `apps/web/app/(en)/en/layout.tsx`, `apps/web/app/global-not-found.tsx`, `apps/web/components/site/{root-document,language-switch}.tsx`, and `apps/web/lib/pages/expenditure.tsx`. Create the first English wrapper at `apps/web/app/(en)/en/explorer/expenditure/page.tsx`; convert its Georgian counterpart to the same shared renderer. Remove the obsolete top-level `apps/web/app/layout.tsx` and `not-found.tsx` after their responsibilities are transferred. Modify `apps/web/{next.config.ts,app/globals.css}` only for the root/404 necessities; modify `components/site/{site-header,site-footer}.tsx`, `components/shell/{data-sidebar,section-nav,page-header,legacy-hash-redirect}.tsx`, and `lib/explorer/sections.ts`. Test `apps/web/tests/i18n/routeInventory.test.ts`, `apps/web/tests/browser/bilingual-navigation.spec.ts`, and existing `tests/seo/{routes,nextConfig,agentFiles}.test.ts`.

**Interfaces:** `RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }): React.ReactElement`; `LanguageSwitch({ compact?: boolean }): React.ReactElement` consumes F2's provider. `renderExpenditurePage(locale: Locale): Promise<React.ReactElement>` and `expenditurePageMetadata(locale: Locale): Promise<Metadata>` own the existing expenditure page body/metadata. Later W tasks populate localized body strings. All existing server data loaders keep their current API.

- [ ] Add browser tests for original Georgian addresses, English document language, keyboard-operable switch, unchanged explorer hash, mobile/expanded/collapsed navigation, normal resources, and unknown URLs. Use the real existing URL state syntax; compare the full hash after hydration, not only immediately after navigation.

```ts
test('switches language and restores the same selected expenditure view', async ({ page }) => {
  const hash = '#g=ministries&m=table&r=2020-2025&sel=admin_spending.defence';
  await page.goto(`/explorer/expenditure${hash}`);
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  const normalizedHash = new URL(page.url()).hash;
  await page.getByTestId('language-switch').getByRole('link', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  expect(new URL(page.url()).pathname).toBe('/en/explorer/expenditure');
  expect(new URL(page.url()).hash).toBe(normalizedHash);
});
```

- [ ] Confirm failure against the baseline, then move the Georgian route files with explicit paths, updating their relative imports. Preserve `generateStaticParams`, `dynamicParams`, metadata exports, and data projections. Do not replace dynamic-entity pages with a catch-all renderer. Source-inspection tests should follow the shared renderer when code moves, while behavioural expectations stay intact.
- [ ] Extract font/style/site-analytics setup into shared root presentation. The two async root layouts load `await getMessages(locale, ['common'])` and pass literal languages; place `I18nProvider` inside `RootDocument` using the loaded common messages and page children. `RootDocument` itself remains synchronous. Enable `experimental.globalNotFound: true` and implement the self-contained bilingual 404 with its own HTML/body, styling, language-marked sections, real 404 status, noindex, and links to each language's home/explorer/methodology. Test unknown paths under `/`, `/en`, and invalid entity segments in the production build.

```tsx
// app/(en)/en/explorer/expenditure/page.tsx
import { renderExpenditurePage, expenditurePageMetadata } from '../../../../../lib/pages/expenditure';
export const generateMetadata = () => expenditurePageMetadata('en');
export default function Page() { return renderExpenditurePage('en'); }
```

- [ ] Add the switch to the public header and all sidebar postures. Render a real plain anchor even before JavaScript runs; once the browser location is available, preserve its query and current hash in the href. Refresh from `window.location` on `hashchange`, focus, pointer-down, context-menu, and activation so state is current even when `history.replaceState` emitted no event. Set the anchor's actual href synchronously before default activation; do not depend solely on a later React state update. Preserve modifier-click, open-new-tab, and copy-link behaviour. Use normal cross-root document navigation; avoid setting `html.lang` only after hydration.
- [ ] Normalize `usePathname()` through `splitLanguagePath` before determining active nav, legacy destinations, and expanded sidebar sections. Use `pageHref` at every chrome link. Add English code-to-slug redirects from the same `MUNICIPALITY_ROUTES` array, retaining the existing Georgian entries. Browser-test fragment preservation through the redirects because the server never receives the fragment.
- [ ] Run the focused navigation/SEO tests, `npm run typecheck`, and `npm run build`. Confirm only `/mcp` runs at request time. Resolve root metadata files and icons without duplicate/conflicting routes; retain current shared resource URLs and security headers. Keep unimplemented English page content private on the branch until W tasks complete it.
- [ ] Commit the explicit moved/added/modified files with `feat: add static language roots and preserve explorer state`.

**Done:** the route foundation and first English page are demonstrably static, Georgian addresses still work, and changing language preserves analytical state. This is infrastructure completion, not an English launch.
