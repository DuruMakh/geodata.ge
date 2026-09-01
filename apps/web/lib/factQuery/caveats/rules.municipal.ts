// apps/web/lib/factQuery/caveats/rules.municipal.ts
import { ADJARA_REGION_ID, MUNICIPAL_COUNTRY_ID } from "../../data/municipal/types";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "../types";
import type { MunicipalWarningType } from "../../data/municipal/types";
import type { CaveatContext, CaveatRule } from "./engine";

const EXCLUDED = new Set<string>(AGGREGATE_ONLY_MUNICIPAL_CODES);
const COUNTRY_ID = MUNICIPAL_COUNTRY_ID;
const ADJARA_ID = ADJARA_REGION_ID;
const TOTAL_SERIES = "municipal.total";

/**
 * Quality-state rules read warningType, never showWarning. Khulo (code 11) 2024
 * carries warningType "source_actual_missing" with showWarning false: a
 * display-flag rule would serve its fallback figure with no warning at all.
 */
function hasWarningType(context: Pick<CaveatContext, "municipalTotalInputs">, type: MunicipalWarningType) {
  return context.municipalTotalInputs.some((row) => row.warningType === type);
}

function affectedByWarningType(
  context: Pick<CaveatContext, "municipalTotalInputs">,
  type: MunicipalWarningType,
) {
  return context.municipalTotalInputs.filter((row) => row.warningType === type).map((row) => `${row.municipalityCode}:${row.year}`);
}

export const MUNICIPAL_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "municipality_not_territorial",
    severity: "severe",
    messageKa: "მითითებული კოდის ბიუჯეტი ტერიტორიულად მიკუთვნებადი ხარჯი არ არის და გამორიცხულია.",
    messageEn: "The named code's budget is not territorially attributable spending and is excluded.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    // The five codes are already absent from every served registry and fact file
    // (methodology "Public exclusion decision"), so this rule is never about
    // filtering output — it only fires when a query explicitly names one.
    applies: (c) => c.entityIds.some((id) => EXCLUDED.has(id)),
    affects: (c) => c.entityIds.filter((id) => EXCLUDED.has(id)),
  },
  {
    code: "municipal_country_scope",
    severity: "note",
    messageKa: "საქართველოს მუნიციპალური აგრეგატი მოიცავს 69 გადამოწმებულ ბიუჯეტს და აჭარის ნეტო კორექციას; რეგიონული მწკრივები ამ ჯამს არ ქმნიან.",
    messageEn: "The Georgia municipal aggregate covers 69 reviewed budgets plus the net Adjara adjustment; regional rows do not sum to it.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    // Gated on datasetId, matching the precedent already in this catalogue
    // (rules.national.ts's revenue_2004_total_scope gates on
    // "national-revenue"; rules.ministries.ts's program_coverage_partial
    // gates on "ministries", with the same failure mode documented inline
    // there). COUNTRY_ID ("country.georgia") is the exact entityId spec 7.2
    // assigns every national observation, and this rule has no other
    // condition - without the gate, any caller populating entityIds with the
    // national entity id (as queryNational legitimately could, since that IS
    // its entity) would spuriously inherit a caveat about the municipal
    // aggregate.
    applies: (c) => c.datasetId === "municipal-expenditure" && c.entityIds.includes(COUNTRY_ID),
    affects: () => [COUNTRY_ID],
  },
  {
    code: "adjara_consolidation_applied",
    severity: "note",
    messageKa: "შედეგი იყენებს აჭარის რესპუბლიკური გადახდების ნეტო კორექციას, ერთხელ.",
    messageEn: "The result applies the net Adjara republican adjustment once.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    // Fires when the total series is explicitly requested, AND for
    // share_of_total_pct on any series for Adjara: percentages always divide by
    // public_total_gel, and for Adjara that denominator is always the
    // consolidated total even when the total series is never named in
    // seriesIds (methodology "Adjara consolidated adjustment": "the Adjara and
    // Georgia total line, percentages, comparisons and Excel workbook total
    // use the consolidated denominator"). Deliberately NOT triggered by a
    // plain amount_gel functional-category request, whose numerator is the
    // unconsolidated municipal-only functional sum and was never adjusted.
    applies: (c) => c.entityIds.includes(ADJARA_ID) && (c.seriesIds.includes(TOTAL_SERIES) || c.measure === "share_of_total_pct"),
    affects: () => [ADJARA_ID],
  },
  {
    code: "municipal_functions_no_republican_crosswalk",
    severity: "note",
    messageKa: "ფუნქციური კატეგორიები მხოლოდ მუნიციპალურია; რესპუბლიკური ფუნქციური განაწილება არ არსებობს და არ არის გამოგონილი.",
    messageEn: "Functional categories are municipal-only; no republican functional allocation exists and none is invented.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    // Gated on datasetId for the same reason as municipal_country_scope above:
    // COUNTRY_ID collides with the national entityId, and this rule has no
    // other condition that would stop it firing on a national-shaped context.
    applies: (c) =>
      c.datasetId === "municipal-expenditure" &&
      (c.entityIds.includes(ADJARA_ID) || c.entityIds.includes(COUNTRY_ID)) &&
      c.seriesIds.some((id) => id !== TOTAL_SERIES),
    affects: (c) => c.entityIds.filter((id) => id === ADJARA_ID || id === COUNTRY_ID),
  },
  {
    code: "municipal_total_definition_changed",
    severity: "severe",
    messageKa: "შედარების წერტილები საჯარო ჯამის სხვადასხვა განსაზღვრებას იყენებს; თანაზომადი ზრდა არ გამოითვლება.",
    messageEn: "The comparison endpoints use different public-total definitions; no like-for-like growth is produced.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => c.comparison !== null && c.comparison.fromDefinition !== c.comparison.toDefinition,
    affects: (c) => (c.comparison ? [`${c.comparison.fromYear}->${c.comparison.toYear}`] : []),
  },
  {
    code: "municipal_source_actual_missing",
    severity: "severe",
    messageKa: "საჭირო ფაქტობრივი გადახდების მაჩვენებელი მიუწვდომელია; გამოყენებულია გადამოწმებული ფუნქციური ჯამი.",
    messageEn: "The required payment actual is unavailable; the reviewed functional total is used instead.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    // Reads warningType, never showWarning: Khulo 2024 has showWarning false
    // (it never trips the GEL 1M review-difference rule, since there is no
    // official total to compare its fallback against) but still needs this
    // disclosure every time its fallback figure is served.
    applies: (c) => hasWarningType(c, "source_actual_missing"),
    affects: (c) => affectedByWarningType(c, "source_actual_missing"),
  },
  {
    code: "municipal_source_version_difference",
    severity: "severe",
    messageKa: "ფუნქციური და ჯამური მონაცემები წყაროს სხვადასხვა ვერსიიდანაა; შეჯერება იძულებით არ ხდება.",
    messageEn: "Functional and total inputs come from documented differing source versions; they are not forcibly reconciled.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => hasWarningType(c, "source_version_difference"),
    affects: (c) => affectedByWarningType(c, "source_version_difference"),
  },
  {
    code: "municipal_financing_outside_functional",
    severity: "note",
    messageKa: "საჯარო ჯამი მოიცავს ფინანსურ კომპონენტებს, რომლებიც ათ ფუნქციაზე არ არის განაწილებული.",
    messageEn: "The public total includes financing components not distributed across the ten functions.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) => hasWarningType(c, "financing_outside_functional"),
    affects: (c) => affectedByWarningType(c, "financing_outside_functional"),
  },
  {
    code: "municipal_functional_total_gap",
    severity: "note",
    messageKa: "ფუნქციური წილები საჯარო ჯამს სრულად არ ფარავს; 100%-მდე ნორმალიზება არ ხდება.",
    messageEn: "Functional shares do not cover the applicable public total and are never normalised to 100%.",
    methodologyRef: "municipal-functional-annual-2015-2025.md",
    applies: (c) =>
      c.measure === "share_of_total_pct" &&
      c.municipalTotalInputs.some((row) => row.reconciliationDifferenceGel !== null && row.reconciliationDifferenceGel !== 0),
    affects: (c) =>
      c.municipalTotalInputs
        .filter((row) => row.reconciliationDifferenceGel !== null && row.reconciliationDifferenceGel !== 0)
        .map((row) => `${row.municipalityCode}:${row.year}`),
  },
  {
    code: "per_resident_coverage_limited",
    severity: "severe",
    messageKa: "ერთ მცხოვრებზე გაანგარიშება მხოლოდ 2025 წლის მუნიციპალურ/რეგიონულ ჯამებზეა დაშვებული.",
    messageEn: "Per-resident values are supported only for the approved 2025 municipal and region totals.",
    methodologyRef: "municipal-population-regional-gdp.md",
    // Approved coverage is 2025, municipality/region entities, and the public
    // total series only (municipal-population-regional-gdp.md: "budget_per_resident_gel
    // = 2025 public_total_gel / 2025 population_persons"). The Georgia
    // aggregate is excluded even at year 2025 with the total series requested:
    // "The Georgia aggregate receives no per-resident value because its
    // numerator includes five aggregate-only municipal budgets without a
    // territorial population assignment" - a wrong-entity case that a
    // year/series check alone would not catch.
    applies: (c) =>
      c.measure === "gel_per_resident" &&
      (c.years.some((year) => year !== 2025) || c.seriesIds.some((id) => id !== TOTAL_SERIES) || c.entityIds.includes(COUNTRY_ID)),
    affects: (c) => [
      ...c.years.filter((year) => year !== 2025).map(String),
      ...c.seriesIds.filter((id) => id !== TOTAL_SERIES),
      ...c.entityIds.filter((id) => id === COUNTRY_ID),
    ],
  },
];
