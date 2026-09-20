// apps/web/tests/factQuery/caveats/registered.test.ts
//
// Every caveat a query returns must come from the registered catalogue.
//
// GDP and economic sectors shipped building their caveats inline, so their
// codes never reached ai-grounding-and-caveats.md or the localized service
// messages - and documented.test.ts, which iterates CAVEAT_RULES, had no way to
// see a code that was never registered. This closes that gap from the other
// side: it reads what the queries actually emit.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { CAVEAT_RULES } from "../../../lib/factQuery/caveats";
import { SECTOR_QUERY_MEASURES } from "../../../lib/factQuery/economicSectorsSeries";
import { GDP_QUERY_SERIES } from "../../../lib/factQuery/gdpSeries";
import { serviceMessage } from "../../../lib/factQuery/localization";
import { queryEconomicSectors } from "../../../lib/factQuery/queryEconomicSectors";
import { queryGdp } from "../../../lib/factQuery/queryGdp";
import { queryInflation } from "../../../lib/factQuery/queryInflation";
import type { Caveat, FactQueryResponse, FactQuerySnapshot } from "../../../lib/factQuery/types";

const FACT_QUERY_DIR = path.join(process.cwd(), "lib", "factQuery");

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function expectRegistered(response: FactQueryResponse, label: string): Caveat[] {
  if (response.kind === "error") throw new Error(`${label}: ${response.error.messageEn}`);
  for (const caveat of response.meta.caveats) {
    const rule = CAVEAT_RULES.find((candidate) => candidate.code === caveat.code);
    expect(rule, `${label} emitted unregistered caveat ${caveat.code}`).toBeDefined();
    // Verbatim from the service messages, so the documented text is the text a client receives.
    expect(caveat.messageKa, `${label} ${caveat.code} messageKa`).toBe(serviceMessage(snapshot, "ka", rule!.messageKey));
    expect(caveat.messageEn, `${label} ${caveat.code} messageEn`).toBe(serviceMessage(snapshot, "en", rule!.messageKey));
  }
  return response.meta.caveats;
}

describe("caveats come only from the registered catalogue", () => {
  it("registers every caveat GDP emits across its whole coverage", () => {
    const years = Array.from(new Set(snapshot.gdpOverview.facts.map((fact) => fact.year))).sort((a, b) => a - b);
    const caveats = expectRegistered(queryGdp(snapshot, { seriesIds: Object.keys(GDP_QUERY_SERIES), years }), "query_gdp");
    // Not vacuous: the full range carries preliminary, SNA-break and World Bank cells.
    expect(caveats.map((caveat) => caveat.code).sort()).toEqual([
      "gdp_historical_method",
      "gdp_preliminary",
      "gdp_world_bank_history",
      "gdp_world_bank_preliminary_basis",
    ]);
  });

  it("registers every caveat economic sectors emit for each measure", () => {
    const { facts, registry } = snapshot.economicSectors;
    const years = Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b);
    for (const measure of Object.keys(SECTOR_QUERY_MEASURES)) {
      const caveats = expectRegistered(
        queryEconomicSectors(snapshot, { seriesIds: registry.map((series) => series.id), years, measure }),
        `query_economic_sectors ${measure}`,
      );
      // Exactly one: a budget rule firing on a sector cell (a negative growth rate
      // read as a revenue correction, say) would show up here.
      expect(caveats.map((caveat) => caveat.code), measure).toEqual(["sectors_preliminary"]);
    }
  });

  it("registers every caveat inflation emits", () => {
    const divisions = snapshot.inflation.groups.filter((group) => group.level === "division").map((group) => group.id);
    const codes = new Set(
      [
        ...expectRegistered(queryInflation(snapshot, { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2025-01", toPeriod: "2025-12" }), "contributions"),
        ...expectRegistered(queryInflation(snapshot, { seriesIds: ["cpi.target"], measure: "target_pct", fromPeriod: "2014-01", toPeriod: "2015-06" }), "target"),
        ...expectRegistered(queryInflation(snapshot, { seriesIds: ["cpi.headline", "cpi.core"], measure: "yoy_pct", fromPeriod: "2024-01", toPeriod: "2024-12" }), "rates"),
      ].map((caveat) => caveat.code),
    );
    expect([...codes].sort()).toEqual(["inflation_contribution_derived", "inflation_contribution_residual", "inflation_target_unverified_before_2015"]);
  });

  it("builds no caveat inline in a query module", () => {
    // A caveat needs a severity; an error envelope does not. A query module that
    // spells one out is constructing a caveat the catalogue cannot see.
    const modules = readdirSync(FACT_QUERY_DIR).filter((file) => /^(query\w+|compare|rank)\.ts$/.test(file));
    expect(modules.length).toBeGreaterThan(5);
    const inline = modules.filter((file) => readFileSync(path.join(FACT_QUERY_DIR, file), "utf8").includes("severity"));
    expect(inline).toEqual([]);
  });
});
