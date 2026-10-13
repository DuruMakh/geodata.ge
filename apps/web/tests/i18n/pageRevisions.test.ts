import { describe, expect, it } from "vitest";
import { listPublicPagePaths } from "../../lib/i18n/inventory.server";
import { loadPageRevisions } from "../../lib/i18n/page-revisions.server";
import { validatePageRevisions } from "../../lib/i18n/validation";

describe("reviewed English page dates", () => {
  it("requires real dates for exactly the public route inventory", async () => {
    const paths = await listPublicPagePaths();
    expect(validatePageRevisions(await loadPageRevisions(), paths)).toEqual([]);
    expect(validatePageRevisions({ "/": "2026-02-30" }, ["/"])).not.toEqual([]);
    expect(validatePageRevisions({}, ["/"])).toEqual(["Missing page revision: /"]);
    expect(validatePageRevisions({ "/en": "2026-09-06" }, [])).toEqual(["Unknown page revision: /en"]);
  });
});
