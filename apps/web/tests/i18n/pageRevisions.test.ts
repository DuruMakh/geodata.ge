import { describe, expect, it, vi } from "vitest";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import { validatePageRevisions } from "../../lib/i18n/validation";
import { pageHref } from "../../lib/i18n/routes";
import sitemap from "../../lib/seo/sitemap";

describe("reviewed English page dates", () => {
  it("requires real dates for exactly the public route inventory", async () => {
    const paths = await listPublicPagePaths();
    expect(validatePageRevisions(await loadPageRevisions(), paths)).toEqual([]);
    expect(validatePageRevisions({ "/": "2026-02-30" }, ["/"])).not.toEqual([]);
    expect(validatePageRevisions({}, ["/"])).toEqual(["Missing page revision: /"]);
    expect(validatePageRevisions({ "/en": "2026-09-06" }, [])).toEqual(["Unknown page revision: /en"]);
  });
  it("pairs every sitemap URL and keeps English dates at least as recent as facts and translation", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge");
    try {
      const [paths, revisions, entries] = await Promise.all([listPublicPagePaths(), loadPageRevisions(), sitemap()]);
      expect(entries).toHaveLength(paths.length * 2);
      for (const path of paths) {
        const ka = new URL(path, "https://fiscal.ge").href;
        const en = new URL(pageHref(path, "en"), "https://fiscal.ge").href;
        const original = entries.find(entry => entry.url === ka)!;
        const english = entries.find(entry => entry.url === en)!;
        expect(original.alternates?.languages).toEqual({ ka, en, "x-default": ka });
        expect(english.alternates).toEqual(original.alternates);
        const oldDate = original.lastModified ? new Date(original.lastModified).toISOString().slice(0, 10) : "";
        expect(new Date(english.lastModified!).toISOString().slice(0, 10)).toBe([oldDate, revisions[path]].sort().at(-1));
      }
    } finally { vi.unstubAllEnvs(); }
  });
});
