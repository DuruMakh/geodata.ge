import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { LIVE_METHODOLOGY_IDS } from "../../lib/methodology/types";

const paths = Object.keys(JSON.parse(readFileSync(path.resolve(process.cwd(), "../../data/localization/en/page-revisions.json"), "utf8")));
const origin = "https://fiscal.ge";
const englishPath = (path: string) => path === "/" ? "/en" : `/en${path}`;
let originalFilenames: Record<string, string>;
test.beforeAll(async () => {
  // Every live dataset, not a hand-listed subset: Geostat names the Georgian
  // basket-weights file in Georgian script, and an omitted manifest would read
  // as untranslated Georgian on the English page.
  const rows = await Promise.all(LIVE_METHODOLOGY_IDS.map(id => loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), id)));
  originalFilenames = Object.fromEntries(rows.flat().map(row => [row.source_id, row.official_filename]));
});

// The only Georgian fragments allowed on English pages are the language switch
// and an explicitly marked original filename that matches its reviewed manifest.
for (const route of paths) test(`paired discovery and English content: ${route}`, async ({ page }) => {
  for (const locale of ["ka", "en"] as const) {
    const target = locale === "en" ? englishPath(route) : route;
    const response = await page.goto(target);
    expect(response?.status()).toBe(200);
    const initialHtml = await response!.text();
    const expected = { canonical: origin + target, ka: origin + route, en: origin + englishPath(route), locale };
    for (const initial of [true, false]) {
      const result = await page.evaluate(({ html, initial, originals, locale }) => {
        const root = initial ? new DOMParser().parseFromString(html, "text/html") : document;
        const failures: string[] = [];
        const checkText = (body: HTMLElement) => {
          const walker = root.createTreeWalker(body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode, parent = node.parentElement, text = node.textContent?.trim() ?? "";
            if (!parent || parent.closest("script,style") || !/\p{Script=Georgian}/u.test(text)) continue;
            if (text === "ქართული" && parent.closest('[data-testid="language-switch"]')) continue;
            const original = parent.closest('[data-original-language="filename"][lang="ka"][data-source-id]');
            if (original && originals[original.getAttribute("data-source-id")!] === text) continue;
            failures.push(text);
          }
          for (const element of root.querySelectorAll("[aria-label],[title],[placeholder],img[alt]")) for (const attribute of ["aria-label", "title", "placeholder", "alt"]) {
            const text = element.getAttribute(attribute) ?? "";
            if (/\p{Script=Georgian}/u.test(text) && !(text === "ქართული" && element.closest('[data-testid="language-switch"]'))) failures.push(`${attribute}: ${text}`);
          }
        };
        if (locale === "en") checkText(root.body);
        const jsonLd = [...root.querySelectorAll('script[type="application/ld+json"]')].map(element => JSON.parse(element.textContent!));
        return {
          lang: root.documentElement.lang,
          canonicals: [...root.querySelectorAll('link[rel="canonical"]')].map(element => element.getAttribute("href")),
          alternates: Object.fromEntries([...root.querySelectorAll('link[rel="alternate"][hreflang]')].map(element => [element.getAttribute("hreflang"), element.getAttribute("href")])),
          title: root.title, description: root.querySelector('meta[name="description"]')?.getAttribute("content"),
          ogLocale: root.querySelector('meta[property="og:locale"]')?.getAttribute("content"),
          ogImage: root.querySelector('meta[property="og:image"]')?.getAttribute("content"),
          ogAlt: root.querySelector('meta[property="og:image:alt"]')?.getAttribute("content"),
          twitterImage: root.querySelector('meta[name="twitter:image"]')?.getAttribute("content"),
          breadcrumbs: jsonLd.filter(item => item["@type"] === "BreadcrumbList").flatMap(item => item.itemListElement.map((entry: { item: string }) => entry.item)),
          jsonLd, failures,
        };
      }, { html: initialHtml, initial, originals: originalFilenames, locale });
      expect(result.lang).toBe(locale);
      expect(result.canonicals).toEqual([expected.canonical]);
      expect(result.alternates).toEqual({ ka: expected.ka, en: expected.en, "x-default": expected.ka });
      expect(result.title.length).toBeGreaterThan(8);
      expect(result.description?.length).toBeGreaterThan(30);
      expect(result.ogLocale).toBe(locale === "en" ? "en_GB" : "ka_GE");
      expect(new URL(result.ogImage!).pathname).toBe(`${locale === "en" ? "/en" : ""}/opengraph-image`);
      expect(new URL(result.twitterImage!).pathname).toBe(`${locale === "en" ? "/en" : ""}/opengraph-image`);
      expect(result.failures, `${target} ${initial ? "initial HTML" : "browser"}`).toEqual([]);
      if (locale === "en") {
        expect(`${result.title} ${result.description} ${result.ogAlt} ${JSON.stringify(result.jsonLd)}`).not.toMatch(/\p{Script=Georgian}/u);
        for (const url of result.breadcrumbs) expect(new URL(url).pathname).toMatch(/^\/en(?:\/|$)/);
      }
    }
    await expect(page.locator("h1")).toHaveCount(1);
    if (locale === "en") {
      const links = await page.locator('a[href^="/"]').evaluateAll(elements => elements.filter(element => !element.closest('[data-testid="language-switch"]')).map(element => element.getAttribute("href")!));
      expect(links.filter(href => /^\/(?:explorer|methodology|about|connect)(?:[/?#]|$)/.test(href))).toEqual([]);
      expect(links.filter(href => /^\/en\/(?:mcp|downloads|robots\.txt|sitemap\.xml|llms\.txt)(?:[/?#]|$)/.test(href))).toEqual([]);
    }
  }
});

test("sitemap contains every paired HTML page and both social images are real PNG files", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  expect(urls.sort()).toEqual(paths.flatMap(path => [origin + path, origin + englishPath(path)]).sort());
  for (const route of ["/opengraph-image", "/en/opengraph-image"]) {
    const response = await request.get(route);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  }
});
