/**
 * Owner-approved (2026-07-09) program successions: one drill-down series per PROGRAM,
 * continuous across tavi-VI code rotations, ministry mergers/splits and renumberings.
 *
 * Georgia's organizational codes are unstable: the same program hops codes when its
 * ministry is merged/renamed (35 02 social protection became 27 02 in the 2019
 * super-ministry merger), when a ministry renumbers its programs (defence 29 08 -> 29 07
 * in 2024), and the state-wide payments institution changes its OWN code almost yearly
 * (49 -> 51 -> 58 -> 62 -> 60 -> 56 -> 54 -> 56 -> 55 -> 56 -> 57), rotating every program
 * under it. Before this table, each code fragment surfaced as a separate drill-down
 * series (e.g. external debt service appeared as six one-to-two-year series).
 *
 * An entry maps the rows of `code` under `parentItemId` for `startYear..endYear` onto the
 * canonical identity `targetCode|parentItemId|targetEraKey` — the identity of the series'
 * LATEST code segment. Evidence standard (methodology §7.4 label-diff procedure): the
 * source-year label must be identical to the target program's label, or a documented
 * slight rename of it. Perimeter CHANGES are not successions and stay separate series —
 * e.g. 30 01 "public order + border" (2012-2018) is deliberately NOT joined to the
 * post-border-split 30 01 "public order" (2019+).
 *
 * Resolution is single-step (generateAdminSpendingFacts.programItemId): a redirected row
 * resolves directly to the FINAL canonical identity; entries must therefore point at the
 * end of a chain, never at an intermediate segment. Entries for one (code, parent) must
 * not overlap in years, and a target's own semantic eras still separate its other
 * reuses (e.g. 25 07's 2025 tourism era is the tourism chain's canonical identity while
 * 25 07's 2019-2024 school rows redirect away to 25 06).
 *
 * The succession is drill-down-only: category aggregation reads leaf rows and never
 * consults this table, so reconciliation is untouched.
 */

export type ProgramSuccession = {
  /** Source-year tavi-VI program code whose rows join the canonical series. */
  code: string;
  /** Category the source rows classify into (successions never cross categories). */
  parentItemId: string;
  startYear: number;
  endYear: number;
  /** Canonical (latest) code of the series. */
  targetCode: string;
  /** Era key of the canonical identity when the target code carries semantic eras. */
  targetEraKey?: string;
  /** Label/evidence note carried into the fact's mapping_notes. */
  note: string;
};

const REGIONAL = "admin_spending.regional_development_infrastructure";
const HEALTH = "admin_spending.health_social_affairs";
const EDUCATION = "admin_spending.education_science_youth";
const JUSTICE = "admin_spending.justice";
const DEFENCE = "admin_spending.defence";
const ECONOMY = "admin_spending.economy_sustainable_development";
const ENVIRONMENT = "admin_spending.environment_agriculture";
const SPORT = "admin_spending.sport";
const CULTURE = "admin_spending.culture";
const OTHER = "admin_spending.other_costs";
const DEBT = "admin_spending.debt_service";

const note = (text: string) =>
  `Program code succession joined to the canonical series (owner-approved 2026-07-09). ${text}`;

export const PROGRAM_SUCCESSIONS: ProgramSuccession[] = [
  // ======================= 2019 IDPs/Labour/Health super-ministry merger ======================
  // Identical program labels across the merger; only the ministry (and so the code) changed.
  { code: "35 02", parentItemId: HEALTH, startYear: 2006, endYear: 2018, targetCode: "27 02",
    note: note("Social protection: 35 02 (2006-2018, Labour/Health ministry; pre-2012 via legacy joins) -> 27 02 (2019+), identical label მოსახლეობის სოციალური დაცვა.") },
  { code: "35 03", parentItemId: HEALTH, startYear: 2006, endYear: 2018, targetCode: "27 03",
    note: note("Health care: 35 03 (2006-2018; pre-2012 via legacy joins) -> 27 03 (2019+), identical label მოსახლეობის ჯანმრთელობის დაცვა.") },
  { code: "34 02", parentItemId: HEALTH, startYear: 2006, endYear: 2018, targetCode: "27 06",
    note: note("IDP support: 34 02 IDP maintenance in settlements (2006-2018, IDP ministry; pre-2012 via legacy joins) -> 27 06 IDP & migrant support (2019+). Owner-traced successor (2026-07-06): the ministry's programs consolidated into institution 27; 27 06's perimeter also covers migrants.") },

  // ============================ 2019 penitentiary move to Justice =============================
  { code: "27 01", parentItemId: JUSTICE, startYear: 2012, endYear: 2018, targetCode: "26 02", targetEraKey: "penitentiary_system",
    note: note("Penitentiary system: 27 01 under the Corrections ministry (2012-2018) -> 26 02 under Justice (2019+), identical label.") },

  // ======================= 2018 Energy ministry merger into Economy ===========================
  { code: "36 03", parentItemId: ECONOMY, startYear: 2014, endYear: 2017, targetCode: "24 14",
    note: note("Electricity transmission grid: 36 03 under the Energy ministry (2014-2017) -> 24 14 under Economy (2018+), identical label. 36 03's 2012-2013 reuse (energy infrastructure) stays split off via its legacy era.") },

  // ================= 2018 Agriculture + Environment merger (codes 37 -> 31) ===================
  { code: "37 05", parentItemId: ENVIRONMENT, startYear: 2017, endYear: 2017, targetCode: "31 05",
    note: note("Unified agro-project: 37 05 under the Agriculture ministry (2017) -> 31 05 under Environment & Agriculture (2018+), identical label.") },
  { code: "37 07", parentItemId: ENVIRONMENT, startYear: 2017, endYear: 2017, targetCode: "31 06", targetEraKey: "irrigation_modernization",
    note: note("Irrigation modernization: 37 07 (2017, '… and agro-sector development support') -> 31 06 (2020+), slight rename of the same melioration program.") },
  { code: "31 07", parentItemId: ENVIRONMENT, startYear: 2018, endYear: 2019, targetCode: "31 06", targetEraKey: "irrigation_modernization",
    note: note("Irrigation modernization: 31 07 (2018-2019, label identical to 2017's 37 07) -> 31 06 (2020+). 31 07 was recycled for environmental supervision from 2020, which stays a separate identity.") },

  // ============================ 2024 defence renumbering ======================================
  { code: "29 08", parentItemId: DEFENCE, startYear: 2017, endYear: 2023, targetCode: "29 07", targetEraKey: "defence_capabilities",
    note: note("Defence capabilities development: 29 08 (2017-2023) -> 29 07 (2024+), identical label.") },
  { code: "29 09", parentItemId: DEFENCE, startYear: 2018, endYear: 2023, targetCode: "29 08", targetEraKey: "logistics",
    note: note("Logistics support: 29 09 (2018-2023, incl. the ლოგისტიკური/ლოჯისტიკური spelling drift) -> 29 08 (2024+), same program.") },

  // ==================== regional-infrastructure code shuffle (2025) ===========================
  { code: "25 07", parentItemId: REGIONAL, startYear: 2019, endYear: 2024, targetCode: "25 06", targetEraKey: "school_infrastructure",
    note: note("School/kindergarten construction-rehabilitation: 25 07 (2019-2024) -> 25 06 (2025), identical label.") },
  { code: "25 08", parentItemId: REGIONAL, startYear: 2023, endYear: 2024, targetCode: "25 07", targetEraKey: "tourism_infrastructure",
    note: note("Tourism infrastructure improvement: 25 08 (2023-2024) -> 25 07 (2025), identical label.") },

  // ===================== sport development across five reorganizations ========================
  // One continuous function (methodology §7.5's worked example of code fragmentation):
  // standalone Sport ministry -> Culture+Sport (2018) -> Education mega-ministry (2019-2021) ->
  // Culture+Sport (2022-2024) -> standalone Sport ministry (2025). Renames of one program.
  { code: "39 02", parentItemId: SPORT, startYear: 2010, endYear: 2017, targetCode: "34 02",
    note: note("Sport development: 39 02 (2010-2017, incl. 2010-2011 legacy-join points) -> 34 02 (2025).") },
  { code: "33 05", parentItemId: SPORT, startYear: 2018, endYear: 2018, targetCode: "34 02",
    note: note("Sport development: 33 05 under Culture+Sport (2018) -> 34 02 (2025).") },
  { code: "32 12", parentItemId: SPORT, startYear: 2019, endYear: 2019, targetCode: "34 02",
    note: note("Sport development: 32 12 under the Education mega-ministry (2019) -> 34 02 (2025).") },
  { code: "32 11", parentItemId: SPORT, startYear: 2020, endYear: 2021, targetCode: "34 02",
    note: note("Sport development: 32 11 under the Education mega-ministry (2020-2021) -> 34 02 (2025).") },
  { code: "33 07", parentItemId: SPORT, startYear: 2022, endYear: 2024, targetCode: "34 02",
    note: note("Sport development: 33 07 under Culture+Sport (2022-2024) -> 34 02 (2025).") },

  // ==================== culture development support across reorganizations ====================
  // Identical label ("კულტურის განვითარების ხელშეწყობა") in every source year.
  { code: "32 10", parentItemId: CULTURE, startYear: 2019, endYear: 2019, targetCode: "33 02", targetEraKey: "culture_development",
    note: note("Culture development support: 32 10 under the Education mega-ministry (2019) -> 33 02 (2025).") },
  { code: "32 09", parentItemId: CULTURE, startYear: 2020, endYear: 2021, targetCode: "33 02", targetEraKey: "culture_development",
    note: note("Culture development support: 32 09 under the Education mega-ministry (2020-2021) -> 33 02 (2025).") },
  { code: "33 05", parentItemId: CULTURE, startYear: 2022, endYear: 2024, targetCode: "33 02", targetEraKey: "culture_development",
    note: note("Culture development support: 33 05 under Culture+Sport (2022-2024) -> 33 02 (2025).") },

  // ========================= Millennium Challenge Georgia (compact II) ========================
  // Identical label; the code moved with each education-ministry renumbering. The 2018 label
  // adds "მეორე პროექტი" (second project) — the same compact.
  { code: "32 06", parentItemId: EDUCATION, startYear: 2014, endYear: 2015, targetCode: "32 09", targetEraKey: "millennium_challenge_second_project",
    note: note("Millennium Challenge Georgia: 32 06 (2014-2015) -> 32 09 (2018). 32 06 was recycled for other education programs from 2016, which stay separate identities.") },
  { code: "32 07", parentItemId: EDUCATION, startYear: 2016, endYear: 2016, targetCode: "32 09", targetEraKey: "millennium_challenge_second_project",
    note: note("Millennium Challenge Georgia: 32 07 (2016) -> 32 09 (2018). Replaces the former era-split-and-drop of this point: it is the same program as 2017's 32 08, not an unrelated one-off.") },
  { code: "32 08", parentItemId: EDUCATION, startYear: 2017, endYear: 2017, targetCode: "32 09", targetEraKey: "millennium_challenge_second_project",
    note: note("Millennium Challenge Georgia: 32 08 (2017) -> 32 09 (2018).") },

  // ==================== state-wide payments institution code rotation =========================
  // The institution's own code changes almost yearly (49 -> 51 -> 58 -> 62 -> 60 -> 56 -> 54 ->
  // 56 -> 55 -> 56 -> 57), rotating every program code under it while labels stay identical.
  // Canonical identity = the 2025 (57 xx) code segment.

  // ---- External debt service & repayment -> 57 01 (debt_service) ----
  { code: "49 01", parentItemId: DEBT, startYear: 2012, endYear: 2012, targetCode: "57 01", note: note("External debt service: 49 01 (2012).") },
  { code: "51 01", parentItemId: DEBT, startYear: 2013, endYear: 2013, targetCode: "57 01", note: note("External debt service: 51 01 (2013).") },
  { code: "58 01", parentItemId: DEBT, startYear: 2014, endYear: 2015, targetCode: "57 01", note: note("External debt service: 58 01 (2014-2015).") },
  { code: "62 01", parentItemId: DEBT, startYear: 2016, endYear: 2016, targetCode: "57 01", note: note("External debt service: 62 01 (2016).") },
  { code: "60 01", parentItemId: DEBT, startYear: 2017, endYear: 2017, targetCode: "57 01", note: note("External debt service: 60 01 (2017).") },
  { code: "56 01", parentItemId: DEBT, startYear: 2018, endYear: 2024, targetCode: "57 01", note: note("External debt service: 56 01 (2018, 2020-2021, 2024).") },
  { code: "54 01", parentItemId: DEBT, startYear: 2019, endYear: 2019, targetCode: "57 01", note: note("External debt service: 54 01 (2019).") },
  { code: "55 01", parentItemId: DEBT, startYear: 2022, endYear: 2023, targetCode: "57 01", note: note("External debt service: 55 01 (2022-2023).") },

  // ---- Domestic debt service & repayment -> 57 02 (debt_service) ----
  { code: "49 02", parentItemId: DEBT, startYear: 2012, endYear: 2012, targetCode: "57 02", note: note("Domestic debt service: 49 02 (2012).") },
  { code: "51 02", parentItemId: DEBT, startYear: 2013, endYear: 2013, targetCode: "57 02", note: note("Domestic debt service: 51 02 (2013).") },
  { code: "58 02", parentItemId: DEBT, startYear: 2014, endYear: 2015, targetCode: "57 02", note: note("Domestic debt service: 58 02 (2014-2015).") },
  { code: "62 02", parentItemId: DEBT, startYear: 2016, endYear: 2016, targetCode: "57 02", note: note("Domestic debt service: 62 02 (2016).") },
  { code: "60 02", parentItemId: DEBT, startYear: 2017, endYear: 2017, targetCode: "57 02", note: note("Domestic debt service: 60 02 (2017).") },
  { code: "56 02", parentItemId: DEBT, startYear: 2018, endYear: 2024, targetCode: "57 02", note: note("Domestic debt service: 56 02 (2018, 2020-2021, 2024).") },
  { code: "54 02", parentItemId: DEBT, startYear: 2019, endYear: 2019, targetCode: "57 02", note: note("Domestic debt service: 54 02 (2019).") },
  { code: "55 02", parentItemId: DEBT, startYear: 2022, endYear: 2023, targetCode: "57 02", note: note("Domestic debt service: 55 02 (2022-2023).") },

  // ---- Transfers to autonomous republics & municipalities -> 57 04 (other_costs) ----
  // 2021+ renames "ადგილობრივი თვითმმართველი ერთეულები" to "მუნიციპალიტეტები" (same transfers).
  { code: "49 04", parentItemId: OTHER, startYear: 2012, endYear: 2012, targetCode: "57 04", note: note("Municipal transfers: 49 04 (2012).") },
  { code: "51 04", parentItemId: OTHER, startYear: 2013, endYear: 2013, targetCode: "57 04", note: note("Municipal transfers: 51 04 (2013).") },
  { code: "58 04", parentItemId: OTHER, startYear: 2014, endYear: 2015, targetCode: "57 04", note: note("Municipal transfers: 58 04 (2014-2015).") },
  { code: "62 04", parentItemId: OTHER, startYear: 2016, endYear: 2016, targetCode: "57 04", note: note("Municipal transfers: 62 04 (2016).") },
  { code: "60 04", parentItemId: OTHER, startYear: 2017, endYear: 2017, targetCode: "57 04", note: note("Municipal transfers: 60 04 (2017).") },
  { code: "56 04", parentItemId: OTHER, startYear: 2018, endYear: 2024, targetCode: "57 04", note: note("Municipal transfers: 56 04 (2018, 2020-2021, 2024).") },
  { code: "54 04", parentItemId: OTHER, startYear: 2019, endYear: 2019, targetCode: "57 04", note: note("Municipal transfers: 54 04 (2019).") },
  { code: "55 04", parentItemId: OTHER, startYear: 2022, endYear: 2023, targetCode: "57 04", note: note("Municipal transfers: 55 04 (2022-2023).") },

  // ---- Funded pension scheme co-financing -> 57 11 (other_costs); scheme started 2018 ----
  // 56 12 carries the pension program ONLY in 2018 (from 2020 the code is the municipal-reforms
  // line), hence the single-year range.
  { code: "56 12", parentItemId: OTHER, startYear: 2018, endYear: 2018, targetCode: "57 11", note: note("Pension co-financing: 56 12 (2018, the scheme's first year).") },
  { code: "54 11", parentItemId: OTHER, startYear: 2019, endYear: 2019, targetCode: "57 11", note: note("Pension co-financing: 54 11 (2019).") },
  { code: "56 11", parentItemId: OTHER, startYear: 2020, endYear: 2024, targetCode: "57 11", note: note("Pension co-financing: 56 11 (2020-2021, 2024). 56 11's 2018 use (international treaty obligations) is a different line and stays separate.") },
  { code: "55 11", parentItemId: OTHER, startYear: 2022, endYear: 2023, targetCode: "57 11", note: note("Pension co-financing: 55 11 (2022-2023).") },

  // ---- Donor-financed state-wide payments -> 57 14 (other_costs) ----
  { code: "49 14", parentItemId: OTHER, startYear: 2012, endYear: 2012, targetCode: "57 14", note: note("Donor-financed payments: 49 14 (2012).") },
  { code: "51 11", parentItemId: OTHER, startYear: 2013, endYear: 2013, targetCode: "57 14", note: note("Donor-financed payments: 51 11 (2013).") },
  { code: "58 10", parentItemId: OTHER, startYear: 2014, endYear: 2015, targetCode: "57 14", note: note("Donor-financed payments: 58 10 (2014-2015).") },
  { code: "62 12", parentItemId: OTHER, startYear: 2016, endYear: 2016, targetCode: "57 14", note: note("Donor-financed payments: 62 12 (2016).") },
  { code: "60 12", parentItemId: OTHER, startYear: 2017, endYear: 2017, targetCode: "57 14", note: note("Donor-financed payments: 60 12 (2017).") },
  { code: "56 13", parentItemId: OTHER, startYear: 2018, endYear: 2024, targetCode: "57 14", note: note("Donor-financed payments: 56 13 (2018, 2020-2021, 2024).") },
  { code: "54 12", parentItemId: OTHER, startYear: 2019, endYear: 2019, targetCode: "57 14", note: note("Donor-financed payments: 54 12 (2019).") },
  { code: "55 13", parentItemId: OTHER, startYear: 2022, endYear: 2023, targetCode: "57 14", note: note("Donor-financed payments: 55 13 (2022-2023).") },

  // ---- 2020-2022 pilot-regions integrated development program -> 55 14 (other_costs) ----
  { code: "56 14", parentItemId: OTHER, startYear: 2021, endYear: 2021, targetCode: "55 14", note: note("Pilot-regions program: 56 14 (2021) -> 55 14 (2022), identical label; the program ended with 2022.") },
];

export function findProgramSuccession(
  code: string,
  parentItemId: string,
  year: number,
): ProgramSuccession | undefined {
  return PROGRAM_SUCCESSIONS.find(
    (succession) =>
      succession.code === code &&
      succession.parentItemId === parentItemId &&
      year >= succession.startYear &&
      year <= succession.endYear,
  );
}
