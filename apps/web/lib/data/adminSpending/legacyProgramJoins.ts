/**
 * Owner-approved (2026-07-07) mapping of pre-2012 organizational lines onto modern
 * (2012+) tavi-VI program drill-down series.
 *
 * Georgia's budget switched to PROGRAM budgeting with the 2012 budget. Before that, each
 * institution's depth-2 rows are organizational units (departments, LEPLs, financing lines),
 * not programs. Where a modern qualifying program's function is carried by one (or a few)
 * pre-2012 line(s) with continuous label/value evidence, the owner approved joining those
 * years into the modern series ("map as many programs as long as they existed"):
 *
 *  - Tier A (clean 1:1 or trivially-summable): roads, health programs, social/pensions,
 *    sport, common courts, IDP maintenance, foreign policy.
 *  - Tier B (perimeter approximates the 2012+ program; owner chose the composition):
 *    general education = schools + support units (resource centers, curriculum, teacher
 *    development, mandaturi, textbooks — as each existed per year); higher education =
 *    university/research support + science + national exams center (+ constitutionalism
 *    center where present) — mirroring the 2012 program's subprogram perimeter.
 *
 * Mechanics: extractAnnualReportYears injects, per join, ONE synthetic depth-2 row whose
 * amount is the sum of the source rows. The row keeps the PRIMARY source code and the source
 * institution for provenance, and is marked isLeafCode=false so it never participates in
 * category aggregation or reconciliation (2008-2011 category totals are byte-identical to the
 * institution-level pipeline). generateAdminSpendingFacts resolves the row's identity through
 * this table (targetCode|targetParentItemId|default), so the point lands in the modern series
 * while officialCode/officialLabel keep source-year truth.
 *
 * NOT mapped (owner-reviewed): defence 29 01 and MIA 30 xx (pre-2012 = one whole-ministry
 * line), prisons dept (modern 27 01 2012 point is the 3.4M policy program; the department's
 * successor is the dropped 27 02 criminal-justice-reform legacy program), and the MODERN series
 * 25 03 municipal / 25 04 water / 32 03 vocational / 26 01 justice / 24 01 economy / 36 03
 * energy (perimeter or aggregation mismatch). Those are 2012+ series codes — NOT to be confused
 * with the pre-2012 SOURCE codes below, which reuse the same numbers for different programs
 * under the old numbering (e.g. the 2009-2011 roads source lines are literally coded 25 03 /
 * 25 04, and 2007's schools line is 32 03).
 */

export type LegacyProgramJoin = {
  year: number;
  /**
   * Depth-2 codes of the source-year rows summed into the injected point. The FIRST code is
   * the primary: the injected row carries it as its official code for provenance. All codes
   * must share one institution prefix.
   */
  sourceCodes: string[];
  /** Georgian display label; defaults to the primary source row's official label. */
  labelKaOverride?: string;
  /**
   * Replaces the component sum as the point's amount (must not exceed it). Used only for the
   * owner-approved 2006 Social Insurance Fund split, where one printed line bundles pensions
   * and the state health programmes and the report narrative supplies the split figure.
   */
  amountThousandGelOverride?: number;
  /**
   * Expected LIVE actuals (thousand GEL) of the source rows, in sourceCodes order. Validated at
   * injection time, so a re-extraction that shifts a source value fails loudly instead of
   * silently invalidating a modelled split whose override constants depend on those values.
   */
  componentActualsThousandGel?: number[];
  /** Modern program code whose series the point joins. */
  targetCode: string;
  /** The modern series' parent category (also stamped on the emitted fact). */
  targetParentItemId: string;
  /** English provenance note carried into the fact's mapping_notes. */
  note: string;
};

const REGIONAL = "admin_spending.regional_development_infrastructure";
const HEALTH = "admin_spending.health_social_affairs";
const EDUCATION = "admin_spending.education_science_youth";
const FOREIGN = "admin_spending.foreign_affairs";
const SPORT = "admin_spending.sport";
const OTHER = "admin_spending.other_costs";

const note = (text: string) =>
  `Pre-2012 organizational line(s) joined to this modern program series (owner-approved 2026-07-07). ${text}`;

// Shared display labels for multi-line merges (one constant per series so a wording fix cannot
// drift between years).
const EDUCATION_JOIN_LABEL_KA = "ზოგადსაგანმანათლებლო სკოლები + დამხმარე საგანმანათლებლო ერთეულები";
const HIGHER_ED_JOIN_LABEL_KA =
  "უმაღლესი/კვლევითი დაწესებულებების ხელშეწყობა + სამეცნიერო კვლევები + გამოცდების ეროვნული ცენტრი";
const FOREIGN_JOIN_LABEL_KA =
  "საგარეო საქმეთა სამინისტროს აპარატი + დიპლომატიური წარმომადგენლობები + საერთაშორისო ორგანიზაციები";

// 2006 pre-reform Social Insurance Fund split (owner decision 2026-07-07): the fund's single
// line bundles pensions AND the state health programmes; the report narrative gives the health
// figure. Deriving both carve-outs from the same three figures keeps them complementary BY
// CONSTRUCTION (social + health === fund + agency), and componentActualsThousandGel pins the
// live staging values these constants were derived from.
const FUND_2006_THOUSAND_GEL = 630_504.7; // 35 22 actual (staging)
const AGENCY_2006_THOUSAND_GEL = 55_916.1; // 35 23 actual (staging)
const HEALTH_IN_FUND_2006_THOUSAND_GEL = 123_500.0; // report narrative: health programmes inside the fund

/**
 * Deduplicated source codes of a year's joins. The 2006/2007 detail-pass whitelist in
 * scripts/extract-annual-report-pdf.ts derives from this, so this table stays the single
 * source of truth for which pre-2012 lines must be staged.
 */
export function legacyJoinSourceCodes(year: number): string[] {
  return [
    ...new Set(LEGACY_PROGRAM_JOINS.filter((join) => join.year === year).flatMap((join) => join.sourceCodes)),
  ];
}

export const LEGACY_PROGRAM_JOINS: LegacyProgramJoin[] = [
  // ============================ 2006-2007 (detail-section recoveries) ========================
  // Source rows come from the reports' per-ministry detail sections (parseDetailProgramRows;
  // whitelists in scripts/extract-annual-report-pdf.ts). 2006 is the year BEFORE the
  // social/health financing reform: state pensions AND the state health programmes both ran
  // through the Social Insurance Fund's single line, split below per the report narrative
  // (owner decision 2026-07-07).

  // ---- Roads -> 25 02 ------------------------------------------------------------------------
  { year: 2006, sourceCodes: ["26 14"], targetCode: "25 02", targetParentItemId: REGIONAL,
    note: note("2006: 26 14 Roads Department (181,243.0k) under the Economic Development ministry; the report narrative confirms transport spending of 181.2M.") },
  { year: 2007, sourceCodes: ["26 14"], targetCode: "25 02", targetParentItemId: REGIONAL,
    note: note("2007: 26 14 (277,086.6k) under the Economic Development ministry, identical label to the modern series.") },

  // ---- Social protection / pensions -> 35 02 -------------------------------------------------
  { year: 2006, sourceCodes: ["35 22", "35 23"], targetCode: "35 02", targetParentItemId: HEALTH,
    labelKaOverride: "სოციალური დაზღვევის ერთიანი სახელმწიფო ფონდი + სოციალური დახმარებისა და დასაქმების სააგენტო (ჯანდაცვის პროგრამების გარეშე)",
    componentActualsThousandGel: [FUND_2006_THOUSAND_GEL, AGENCY_2006_THOUSAND_GEL],
    amountThousandGelOverride: FUND_2006_THOUSAND_GEL + AGENCY_2006_THOUSAND_GEL - HEALTH_IN_FUND_2006_THOUSAND_GEL,
    note: note("2006 split: 35 22 Social Insurance Fund (630,504.7k) + 35 23 social assistance agency (55,916.1k) MINUS the state health programmes financed inside the fund (123,500.0k per the report narrative) = 562,920.8k.") },
  { year: 2007, sourceCodes: ["35 26"], targetCode: "35 02", targetParentItemId: HEALTH,
    note: note("2007: 35 26 (699,886.4k; pensions subprogram 497,416.3k) — the post-reform consolidated social-programmes line.") },

  // ---- State health programmes -> 35 03 ------------------------------------------------------
  { year: 2006, sourceCodes: ["35 22"], targetCode: "35 03", targetParentItemId: HEALTH,
    labelKaOverride: "ჯანმრთელობის დაცვის სახელმწიფო პროგრამები (სოციალური დაზღვევის ფონდის შემადგენლობაში)",
    componentActualsThousandGel: [FUND_2006_THOUSAND_GEL],
    amountThousandGelOverride: HEALTH_IN_FUND_2006_THOUSAND_GEL,
    note: note("2006 split: the state health programmes ran inside the 35 22 Social Insurance Fund; the report narrative gives 123.5M for health programmes. Complements the 35 02 split exactly (562,920.8 + 123,500.0 = fund + agency).") },
  { year: 2007, sourceCodes: ["35 27"], targetCode: "35 03", targetParentItemId: HEALTH,
    note: note("2007: 35 27 (158,571.2k) — the post-reform consolidated health-programmes line.") },

  // ---- General education -> 32 02 (schools + support units, as each existed) -----------------
  { year: 2006, sourceCodes: ["32 03", "32 05"], targetCode: "32 02", targetParentItemId: EDUCATION,
    labelKaOverride: EDUCATION_JOIN_LABEL_KA,
    note: note("2006 merge: 32 03 schools financing (187,396.5k) + 32 05 resource centers (1,441.4k) = 188,837.9k. Curriculum, teacher-development, mandaturi and textbook units did not yet exist as separate lines.") },
  { year: 2007, sourceCodes: ["32 03", "32 05"], targetCode: "32 02", targetParentItemId: EDUCATION,
    labelKaOverride: EDUCATION_JOIN_LABEL_KA,
    note: note("2007 merge: 32 03 schools (201,396.2k) + 32 05 resource centers (2,685.8k) = 204,082.0k.") },

  // ---- Higher education & science -> 32 04 ----------------------------------------------------
  { year: 2006, sourceCodes: ["32 10", "32 15"], targetCode: "32 04", targetParentItemId: EDUCATION,
    labelKaOverride: HIGHER_ED_JOIN_LABEL_KA,
    note: note("2006 merge: 32 10 university programme (29,845.1k) + 32 15 science support (17,334.1k) = 47,179.2k. The exams center had no separate line yet.") },
  { year: 2007, sourceCodes: ["32 10", "32 15", "32 20"], targetCode: "32 04", targetParentItemId: EDUCATION,
    labelKaOverride: HIGHER_ED_JOIN_LABEL_KA,
    note: note("2007 merge: 32 10 university/research support (39,690.1k) + 32 15 science (22,128.5k) + 32 20 exams center (2,480.4k) = 64,299.0k.") },

  // ---- Foreign policy -> 28 01 -----------------------------------------------------------------
  { year: 2006, sourceCodes: ["28 01", "28 02", "28 03"], targetCode: "28 01", targetParentItemId: FOREIGN,
    labelKaOverride: FOREIGN_JOIN_LABEL_KA,
    note: note("2006 merge: 9,204.1k + 27,603.1k + 6,831.8k = 43,639.0k.") },
  { year: 2007, sourceCodes: ["28 01", "28 02", "28 03"], targetCode: "28 01", targetParentItemId: FOREIGN,
    labelKaOverride: FOREIGN_JOIN_LABEL_KA,
    note: note("2007 merge: 9,194.9k + 35,742.9k + 12,880.8k = 57,818.6k.") },

  // ---- Common courts -> 09 01 ------------------------------------------------------------------
  { year: 2006, sourceCodes: ["09 02"], targetCode: "09 01", targetParentItemId: OTHER,
    note: note("2006: 09 02 'common courts' (26,315.5k).") },
  { year: 2007, sourceCodes: ["09 02"], targetCode: "09 01", targetParentItemId: OTHER,
    note: note("2007: 09 02 (28,530.5k).") },

  // ---- IDP maintenance in settlements -> 34 02 --------------------------------------------------
  { year: 2006, sourceCodes: ["34 04"], targetCode: "34 02", targetParentItemId: HEALTH,
    note: note("2006: 34 04 IDP maintenance in settlements (15,571.3k).") },
  { year: 2007, sourceCodes: ["34 04"], targetCode: "34 02", targetParentItemId: HEALTH,
    note: note("2007: 34 04 (20,386.1k).") },

  // ============================ 2008-2011 (institution-table years) ==========================

  // ---- Roads -> 25 02 (identical label in every source year) --------------------------------
  { year: 2008, sourceCodes: ["26 11"], targetCode: "25 02", targetParentItemId: REGIONAL,
    note: note("2008: 26 11 (272,337.1k) under the Economic Development ministry, which ran roads before the Regional Development ministry existed.") },
  { year: 2009, sourceCodes: ["25 03"], targetCode: "25 02", targetParentItemId: REGIONAL,
    note: note("2009: 25 03 (509,192.1k).") },
  { year: 2010, sourceCodes: ["25 04"], targetCode: "25 02", targetParentItemId: REGIONAL,
    note: note("2010: 25 04 (549,874.9k).") },
  { year: 2011, sourceCodes: ["25 04"], targetCode: "25 02", targetParentItemId: REGIONAL,
    note: note("2011: 25 04 (580,842.4k).") },

  // ---- State health programmes -> 35 03 -----------------------------------------------------
  { year: 2008, sourceCodes: ["35 22"], targetCode: "35 03", targetParentItemId: HEALTH,
    note: note("2008: 35 22 (226,484.8k).") },
  { year: 2009, sourceCodes: ["35 18"], targetCode: "35 03", targetParentItemId: HEALTH,
    note: note("2009: 35 18 (285,559.4k).") },
  { year: 2010, sourceCodes: ["35 11"], targetCode: "35 03", targetParentItemId: HEALTH,
    note: note("2010: 35 11 (329,222.7k).") },
  { year: 2011, sourceCodes: ["35 12"], targetCode: "35 03", targetParentItemId: HEALTH,
    note: note("2011: 35 12 (277,224.8k).") },

  // ---- Social programmes / pensions -> 35 02 ------------------------------------------------
  { year: 2008, sourceCodes: ["35 21"], targetCode: "35 02", targetParentItemId: HEALTH,
    note: note("2008: 35 21 (990,001.4k).") },
  { year: 2009, sourceCodes: ["35 17"], targetCode: "35 02", targetParentItemId: HEALTH,
    note: note("2009: 35 17 (1,142,659.6k).") },
  { year: 2010, sourceCodes: ["35 10"], targetCode: "35 02", targetParentItemId: HEALTH,
    // The 2010 source label cell is contaminated by the report's ####### column overflow.
    labelKaOverride: "სოციალური პროგრამები",
    note: note("2010: 35 10 (1,166,622.4k); label cleaned of the source's ####### overflow.") },
  { year: 2011, sourceCodes: ["35 09", "35 10", "35 11"], targetCode: "35 02", targetParentItemId: HEALTH,
    labelKaOverride: "საპენსიო უზრუნველყოფა + სოციალური დახმარებები + სოციალური რეაბილიტაცია",
    note: note("2011 merge: 35 09 pensions (987,324.5k) + 35 10 social assistance (220,329.4k) + 35 11 social rehabilitation and child care (11,732.2k) = 1,219,386.1k — the three lines the 2012 '35 02' program combined.") },

  // ---- Sport development -> 39 02 (same code and label; ministry created 2010) --------------
  { year: 2010, sourceCodes: ["39 02"], targetCode: "39 02", targetParentItemId: SPORT,
    note: note("2010: 39 02 (28,539.7k), same code and label as the 2012-2017 series.") },
  { year: 2011, sourceCodes: ["39 02"], targetCode: "39 02", targetParentItemId: SPORT,
    note: note("2011: 39 02 (34,277.2k), same code and label as the 2012-2017 series.") },

  // ---- Common courts -> 09 01 ----------------------------------------------------------------
  { year: 2008, sourceCodes: ["09 02"], targetCode: "09 01", targetParentItemId: OTHER,
    note: note("2008: 09 02 'common courts' (32,689.9k); the modern series' code is 09 01.") },
  { year: 2009, sourceCodes: ["09 02"], targetCode: "09 01", targetParentItemId: OTHER,
    note: note("2009: 09 02 (35,195.8k).") },
  { year: 2010, sourceCodes: ["09 02"], targetCode: "09 01", targetParentItemId: OTHER,
    note: note("2010: 09 02 (30,609.4k).") },
  { year: 2011, sourceCodes: ["09 02"], targetCode: "09 01", targetParentItemId: OTHER,
    note: note("2011: 09 02 (29,885.5k).") },

  // ---- IDP maintenance in settlements -> 34 02 ----------------------------------------------
  { year: 2008, sourceCodes: ["34 04"], targetCode: "34 02", targetParentItemId: HEALTH,
    note: note("2008: 34 04 IDP/refugee maintenance (24,522.1k).") },
  { year: 2009, sourceCodes: ["34 04"], targetCode: "34 02", targetParentItemId: HEALTH,
    note: note("2009: 34 04 (22,215.0k).") },
  { year: 2010, sourceCodes: ["34 04"], targetCode: "34 02", targetParentItemId: HEALTH,
    note: note("2010: 34 04 (25,818.5k).") },
  { year: 2011, sourceCodes: ["34 03"], targetCode: "34 02", targetParentItemId: HEALTH,
    note: note("2011: 34 03 (23,925.1k).") },

  // ---- Foreign policy -> 28 01 (apparatus + missions + international organisations) ----------
  { year: 2008, sourceCodes: ["28 01", "28 02", "28 03"], targetCode: "28 01", targetParentItemId: FOREIGN,
    labelKaOverride: FOREIGN_JOIN_LABEL_KA,
    note: note("2008 merge: 28 01 apparatus (11,464.7k) + 28 02 diplomatic missions (41,230.2k) + 28 03 international organisations (4,376.1k) = 57,071.0k — the components the 2012 '28 01' program combined.") },
  { year: 2009, sourceCodes: ["28 01", "28 02", "28 03"], targetCode: "28 01", targetParentItemId: FOREIGN,
    labelKaOverride: FOREIGN_JOIN_LABEL_KA,
    note: note("2009 merge: 11,091.5k + 49,925.3k + 5,014.6k = 66,031.4k.") },
  { year: 2010, sourceCodes: ["28 01", "28 02", "28 03"], targetCode: "28 01", targetParentItemId: FOREIGN,
    labelKaOverride: FOREIGN_JOIN_LABEL_KA,
    note: note("2010 merge: 9,490.8k + 53,384.8k + 5,033.2k = 67,908.8k.") },
  { year: 2011, sourceCodes: ["28 01", "28 02", "28 03"], targetCode: "28 01", targetParentItemId: FOREIGN,
    labelKaOverride: FOREIGN_JOIN_LABEL_KA,
    note: note("2011 merge: 14,171.9k + 56,810.0k + 3,562.0k = 74,543.9k.") },

  // ---- General education -> 32 02 (owner: schools + support units, mirroring the 2012
  //      program's subprograms: schools financing, teacher development, mandaturi/safe
  //      environment, textbooks, curriculum — as each unit existed in the source year) --------
  { year: 2008, sourceCodes: ["32 09", "32 02", "32 05"], targetCode: "32 02", targetParentItemId: EDUCATION,
    labelKaOverride: EDUCATION_JOIN_LABEL_KA,
    note: note("2008 merge: 32 09 schools (280,729.1k) + 32 02 resource centers (3,558.8k) + 32 05 curriculum center (1,763.7k) = 286,051.6k. Teacher-development, mandaturi and textbook units did not yet exist as separate lines.") },
  { year: 2009, sourceCodes: ["32 09", "32 02", "32 05", "32 06"], targetCode: "32 02", targetParentItemId: EDUCATION,
    labelKaOverride: EDUCATION_JOIN_LABEL_KA,
    note: note("2009 merge: 32 09 schools (318,757.2k) + 32 02 resource centers (3,787.2k) + 32 05 curriculum (1,299.5k) + 32 06 teacher development (2,425.9k) = 326,269.8k.") },
  { year: 2010, sourceCodes: ["32 09", "32 02", "32 05", "32 06", "32 19", "32 20"], targetCode: "32 02", targetParentItemId: EDUCATION,
    labelKaOverride: EDUCATION_JOIN_LABEL_KA,
    note: note("2010 merge: 32 09 schools (343,092.1k) + 32 02 resource centers (4,122.9k) + 32 05 curriculum (2,546.2k) + 32 06 teacher development (8,673.3k) + 32 19 mandaturi (2,838.4k) + 32 20 textbooks (4,083.0k) = 365,355.9k.") },
  { year: 2011, sourceCodes: ["32 09", "32 02", "32 05", "32 06", "32 07"], targetCode: "32 02", targetParentItemId: EDUCATION,
    labelKaOverride: EDUCATION_JOIN_LABEL_KA,
    note: note("2011 merge: 32 09 schools (316,059.0k) + 32 02 resource centers (4,123.7k) + 32 05 curriculum (2,070.9k) + 32 06 teacher development (18,188.6k) + 32 07 mandaturi (8,651.3k) = 349,093.5k.") },

  // ---- Higher education & science -> 32 04 (university/research support + science + exams
  //      center + constitutionalism center where present — the 2012 program's subprograms) ----
  { year: 2008, sourceCodes: ["32 12", "32 13", "32 04"], targetCode: "32 04", targetParentItemId: EDUCATION,
    labelKaOverride: HIGHER_ED_JOIN_LABEL_KA,
    note: note("2008 merge: 32 12 university/research support (47,154.7k) + 32 13 science (31,164.8k) + 32 04 exams center (6,443.3k) = 84,762.8k.") },
  { year: 2009, sourceCodes: ["32 12", "32 13", "32 04"], targetCode: "32 04", targetParentItemId: EDUCATION,
    labelKaOverride: HIGHER_ED_JOIN_LABEL_KA,
    note: note("2009 merge: 52,471.8k + 39,638.8k + 7,387.4k = 99,498.0k.") },
  { year: 2010, sourceCodes: ["32 12", "32 13", "32 04", "32 18"], targetCode: "32 04", targetParentItemId: EDUCATION,
    labelKaOverride: HIGHER_ED_JOIN_LABEL_KA,
    note: note("2010 merge: 52,281.5k + 37,918.2k + 9,029.0k + 32 18 constitutionalism center (135.7k) = 99,364.4k.") },
  { year: 2011, sourceCodes: ["32 12", "32 13", "32 04", "32 10"], targetCode: "32 04", targetParentItemId: EDUCATION,
    labelKaOverride: HIGHER_ED_JOIN_LABEL_KA,
    note: note("2011 merge: 55,972.0k + 21,158.8k + 16,776.7k + 32 10 constitutionalism center (841.1k) = 94,748.6k.") },
];

