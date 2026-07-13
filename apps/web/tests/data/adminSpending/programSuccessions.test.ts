import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateAdminSpendingFacts } from "../../../lib/data/adminSpending/generateAdminSpendingFacts";
import { extractAdminSpendingOfficialRows } from "../../../lib/data/adminSpending/extractWorkbooks";
import { PROGRAM_SUCCESSIONS, type ProgramSuccession } from "../../../lib/data/adminSpending/programSuccessions";
import type { AdminSpendingFact } from "../../../lib/data/adminSpending/types";

/**
 * Guards for PROGRAM_SUCCESSIONS (owner-approved 2026-07-09): every drill-down series must be
 * ONE program shown continuously across tavi-VI code rotations. These tests lock the succession
 * table's structure, the continuity of every canonical series in the real data, and the value of
 * every point the successions recovered (points that were invisible before because their code
 * segment never reached the threshold on its own).
 */

// Mirrors makeProgramItemId in generateAdminSpendingFacts.ts.
function canonicalItemId(succession: ProgramSuccession): string {
  const identityKey = `${succession.targetCode}|${succession.parentItemId}|${succession.targetEraKey ?? "default"}`;
  const hash = createHash("sha1").update(identityKey).digest("hex").slice(0, 8);
  return `admin_program.${succession.targetCode.replaceAll(" ", "_")}.${hash}`;
}

let cachedProgramFacts: AdminSpendingFact[] | null = null;
function programFacts(): AdminSpendingFact[] {
  cachedProgramFacts ??= generateAdminSpendingFacts(extractAdminSpendingOfficialRows()).filter(
    (fact) => fact.level === "major_program",
  );
  return cachedProgramFacts;
}

describe("PROGRAM_SUCCESSIONS structure", () => {
  it("has disjoint year ranges per (code, parent) and no self-targeting entries", () => {
    for (const entry of PROGRAM_SUCCESSIONS) {
      expect(entry.startYear).toBeLessThanOrEqual(entry.endYear);
      expect(entry.targetCode).not.toBe(entry.code);
    }
    const byCodeParent = new Map<string, ProgramSuccession[]>();
    for (const entry of PROGRAM_SUCCESSIONS) {
      const key = `${entry.code}|${entry.parentItemId}`;
      byCodeParent.set(key, [...(byCodeParent.get(key) ?? []), entry]);
    }
    for (const entries of byCodeParent.values()) {
      const ordered = [...entries].sort((a, b) => a.startYear - b.startYear);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index].startYear).toBeGreaterThan(ordered[index - 1].endYear);
      }
    }
  });

  it("groups every chain onto a single final target (single-step resolution cannot fragment)", () => {
    // Resolution is single-step, so every member of a chain must point directly at the chain's
    // final identity: if A -> B exists, no entry B -> C may exist with the SAME target identity
    // semantics... concretely, two entries whose targets differ must never share a target code +
    // era with one of the sources being the other's target in overlapping years.
    for (const entry of PROGRAM_SUCCESSIONS) {
      const targetsOwnSource = PROGRAM_SUCCESSIONS.filter(
        (other) =>
          other.code === entry.targetCode &&
          other.parentItemId === entry.parentItemId &&
          (entry.targetEraKey ?? "default") === "default" &&
          (other.targetEraKey ?? "default") === "default",
      );
      // A default-identity target may not itself be redirected in ANY year — that would mean the
      // chain has a newer final code and this entry points at an intermediate segment.
      expect(targetsOwnSource).toEqual([]);
    }
  });

  it("materializes every succession entry as at least one drill-down fact in its canonical identity", () => {
    const facts = programFacts();
    const unmaterialized = PROGRAM_SUCCESSIONS.filter((entry) => {
      const expectedItemId = canonicalItemId(entry);
      return !facts.some(
        (fact) =>
          fact.itemId === expectedItemId &&
          fact.year >= entry.startYear &&
          fact.year <= entry.endYear,
      );
    }).map((entry) => `${entry.code} ${entry.startYear}-${entry.endYear} -> ${entry.targetCode}`);
    expect(unmaterialized).toEqual([]);
  }, 30_000);

  it("anchors every canonical identity with at least one fact carrying the target code itself", () => {
    const facts = programFacts();
    const unanchored = PROGRAM_SUCCESSIONS.filter((entry) => {
      const expectedItemId = canonicalItemId(entry);
      return !facts.some((fact) => fact.itemId === expectedItemId && fact.officialCode === entry.targetCode);
    }).map((entry) => `${entry.code} -> ${entry.targetCode}`);
    expect(unanchored).toEqual([]);
  }, 30_000);
});

describe("succession-joined series continuity (real data)", () => {
  // canonical code (+ era key) -> expected continuous year range of the merged series.
  const EXPECTED_SERIES: Array<{
    targetCode: string;
    parentItemId: string;
    targetEraKey?: string;
    years: [number, number];
    label: string;
  }> = [
    { targetCode: "27 02", parentItemId: "admin_spending.health_social_affairs", years: [2006, 2025], label: "social protection" },
    { targetCode: "27 03", parentItemId: "admin_spending.health_social_affairs", years: [2006, 2025], label: "health care" },
    { targetCode: "27 06", parentItemId: "admin_spending.health_social_affairs", years: [2006, 2025], label: "IDP support" },
    { targetCode: "26 02", parentItemId: "admin_spending.justice", targetEraKey: "penitentiary_system", years: [2012, 2025], label: "penitentiary" },
    { targetCode: "24 14", parentItemId: "admin_spending.economy_sustainable_development", years: [2014, 2025], label: "transmission grid" },
    { targetCode: "31 05", parentItemId: "admin_spending.environment_agriculture", years: [2017, 2025], label: "agro-project" },
    { targetCode: "31 06", parentItemId: "admin_spending.environment_agriculture", targetEraKey: "irrigation_modernization", years: [2017, 2025], label: "irrigation" },
    { targetCode: "29 07", parentItemId: "admin_spending.defence", targetEraKey: "defence_capabilities", years: [2017, 2025], label: "defence capabilities" },
    { targetCode: "29 08", parentItemId: "admin_spending.defence", targetEraKey: "logistics", years: [2018, 2025], label: "logistics" },
    { targetCode: "25 06", parentItemId: "admin_spending.regional_development_infrastructure", targetEraKey: "school_infrastructure", years: [2019, 2025], label: "school construction" },
    { targetCode: "25 07", parentItemId: "admin_spending.regional_development_infrastructure", targetEraKey: "tourism_infrastructure", years: [2023, 2025], label: "tourism infrastructure" },
    { targetCode: "34 02", parentItemId: "admin_spending.sport", years: [2010, 2025], label: "sport development" },
    { targetCode: "33 02", parentItemId: "admin_spending.culture", targetEraKey: "culture_development", years: [2019, 2025], label: "culture development" },
    { targetCode: "32 09", parentItemId: "admin_spending.education_science_youth", targetEraKey: "millennium_challenge_second_project", years: [2014, 2018], label: "Millennium Challenge" },
    { targetCode: "57 01", parentItemId: "admin_spending.debt_service", years: [2012, 2025], label: "external debt service" },
    { targetCode: "57 02", parentItemId: "admin_spending.debt_service", years: [2012, 2025], label: "domestic debt service" },
    { targetCode: "57 04", parentItemId: "admin_spending.other_costs", years: [2012, 2025], label: "municipal transfers" },
    { targetCode: "57 11", parentItemId: "admin_spending.other_costs", years: [2018, 2025], label: "pension co-financing" },
    { targetCode: "57 14", parentItemId: "admin_spending.other_costs", years: [2012, 2025], label: "donor-financed payments" },
    { targetCode: "55 14", parentItemId: "admin_spending.other_costs", years: [2021, 2022], label: "pilot regions" },
  ];

  it.each(EXPECTED_SERIES)(
    "shows $label ($targetCode) as one continuous series over $years",
    ({ targetCode, parentItemId, targetEraKey, years: [startYear, endYear] }) => {
      const itemId = canonicalItemId({ targetCode, parentItemId, targetEraKey } as ProgramSuccession);
      const factYears = programFacts()
        .filter((fact) => fact.itemId === itemId)
        .map((fact) => fact.year)
        .sort((a, b) => a - b);
      const expectedYears = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
      expect(factYears).toEqual(expectedYears);
    },
    30_000,
  );

  it("emits one fact per (year, identity) — successions never overlap within a year", () => {
    const seen = new Set<string>();
    for (const fact of programFacts()) {
      const key = `${fact.year}:${fact.itemId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  }, 30_000);

  it("locks the value of every succession-recovered point (previously below-threshold segments)", () => {
    // These 34 points were invisible before the successions: their code segment never reached
    // 100M GEL in a 2017+ year on its own, so the old per-code identities were dropped. A drift
    // here means a source re-extraction changed a value or a succession range shifted.
    const RECOVERED_POINTS: Array<[number, string, number]> = [
      // External debt service (49/51/58/62 xx -> 57 01)
      [2012, "49 01", 227_847_700],
      [2013, "51 01", 564_712_800],
      [2014, "58 01", 638_953_100],
      [2015, "58 01", 543_800_000],
      [2016, "62 01", 502_549_400],
      // Domestic debt service -> 57 02
      [2012, "49 02", 150_706_900],
      [2013, "51 02", 133_550_300],
      [2014, "58 02", 140_181_300],
      [2015, "58 02", 187_223_700],
      [2016, "62 02", 237_636_300],
      // Municipal transfers -> 57 04
      [2012, "49 04", 1_173_756_100],
      [2013, "51 04", 1_068_455_500],
      [2014, "58 04", 1_055_565_400],
      [2015, "58 04", 1_242_414_800],
      [2016, "62 04", 905_190_600],
      // Donor-financed payments -> 57 14
      [2012, "49 14", 37_160_000],
      [2013, "51 11", 25_573_900],
      [2014, "58 10", 6_757_600],
      [2015, "58 10", 25_194_100],
      [2016, "62 12", 65_083_900],
      [2019, "54 12", 51_418_500],
      [2022, "55 13", 36_457_478],
      [2023, "55 13", 47_305_603],
      // Funded pension co-financing -> 57 11 (the scheme's first, sub-threshold year)
      [2018, "56 12", 79_601_669],
      // Pilot-regions program -> 55 14
      [2021, "56 14", 25_895_400],
      // Irrigation modernization -> 31 06
      [2018, "31 07", 45_962_694],
      [2019, "31 07", 83_565_800],
      // Millennium Challenge -> 32 09
      [2014, "32 06", 14_881_200],
      [2015, "32 06", 33_850_200],
      [2016, "32 07", 62_364_400],
      // Culture development support -> 33 02
      [2019, "32 10", 74_508_600],
      [2020, "32 09", 68_658_100],
      [2021, "32 09", 71_914_100],
      // Tourism infrastructure's 2025 point: the chain's own canonical segment (era-resolved,
      // not succession-redirected), recovered because the joined chain qualifies via 2023-2024.
      [2025, "25 07", 61_766_300],
    ];

    const facts = programFacts();
    for (const [year, officialCode, amountGel] of RECOVERED_POINTS) {
      const matches = facts.filter((fact) => fact.year === year && fact.officialCode === officialCode);
      expect(matches, `${year} ${officialCode}`).toHaveLength(1);
      expect(matches[0].amountGel, `${year} ${officialCode}`).toBe(amountGel);
      // Succession-redirected points carry the succession provenance note; the one canonical-
      // segment point in this table (2025 tourism) keeps the generic threshold note.
      if (!(year === 2025 && officialCode === "25 07")) {
        expect(matches[0].mappingNotes).toContain("Program code succession");
      }
    }
    expect(RECOVERED_POINTS).toHaveLength(34);
  }, 30_000);
});
