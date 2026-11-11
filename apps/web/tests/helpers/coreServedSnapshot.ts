// apps/web/tests/helpers/coreServedSnapshot.ts
//
// The packaged snapshot as it was while only the twelve core pages were served: no topic datasets, and every other
// navigation page website-only. Every topic page is served now (lib/factQuery/servedPages.ts), so the catalogue
// search's page-linking rules are tested on that wider page list. Kept apart from factQuerySnapshot.ts, which most
// test files import, because building the page list loads the snapshot build module.
import { buildWebsitePages } from "../../lib/factQuery/buildSnapshot";
import { CORE_SERVED_PAGES } from "../../lib/factQuery/servedPages";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { testSnapshot } from "./factQuerySnapshot";

export async function coreServedSnapshot(): Promise<FactQuerySnapshot> {
  return {
    ...testSnapshot(),
    topics: { datasets: [], sourceIds: [], basisCodes: [], statusCodes: [], units: {} },
    website: { pages: await buildWebsitePages(CORE_SERVED_PAGES) },
  };
}
