// apps/web/lib/factQuery/topics/hierarchy.ts
//
// The reviewed totals and breakdowns of the topic datasets (full review R37): a total the page prints beside its parts
// without nesting them (Total running costs beside Wages and salaries), and one parent's parts that make up several
// breakdowns (students by level, by ownership, by sex and by field). `rank` reads the links: a total never ranks beside
// its own parts, and one breakdown of a parent ranks at a time. Every link is checked against the figures on each build.
// Build-time only: runtime code never imports it (tests/factQuery/purity.test.ts).
import type { TopicDatasetBuild, TopicSeriesNote } from "./types";

/**
 * One reviewed link: `parentSeriesId` becomes the parent of `seriesIds` (it may already be), and `breakdown` names the
 * page's breakdown they make up when the parent has several (it may span headings: All researchers, under its own,
 * is one occupation of All R&D staff). `proof` is what the build checks, at every place and year
 * where the parent and all its parts are printed:
 * - "sum": the parts add up to the parent, within 0.01% (the rounding of printed parts), less the `subtracted` series
 *   (imports, which GDP subtracts: GDP = consumption + investment + exports - imports);
 * - "between": the parent, a rate, share or average of the whole, lies between its parts, as an aggregate of them must;
 * - "within": the parts add up to no more than the parent (within 0.01%): a breakdown that leaves a remainder unstated
 *   in some years (vocational students by field: the source also counted its earlier list of fields, which no page
 *   shows, so the fields fall short of the total for admissions 2016-2020 and graduates 2016-2022);
 * - "label": the figures cannot be checked (the real growth of Total investment, whose only growth part is Buildings
 *   and equipment), so the same total and parts must be a proven "sum" at another measure of the dataset (their amounts
 *   in GEL), or the build stops.
 * A `subtracted` series loses its parent (it is no part of the total) and records the total it is subtracted from, and
 * whether the figures add up so (amounts and shares; a growth rate does not). `note` is a sentence the named series'
 * value definition adds, saying what the link means for a client (GDP subtracts imports; the fields fall short).
 */
export type TopicHierarchyLink = {
  datasetId: string; parentSeriesId: string; seriesIds: readonly string[]; breakdown?: string; subtracted?: readonly string[];
  proof: "sum" | "between" | "within" | "label"; note?: TopicSeriesNote & { seriesIds: readonly string[] };
};

const ids = (prefix: string, parts: readonly string[], suffix = "") => parts.map((part) => `${prefix}${part}${suffix}`);
const RUNNING_COSTS = ["compensation", "goods_services", "interest", "subsidies", "grants", "social_benefits", "other"];
const SOCIAL_PACKAGE = ["disability", "survivors", "war_participants", "political_repression", "other"];
const DISABILITY = ["disability_children", "disability_severe", "disability_significant", "disability_moderate"];
const FIELDS = ["education", "humanities_arts", "social_business_law", "science", "engineering", "agriculture", "health_welfare", "services"];
const STAFF = (prefix: string): TopicHierarchyLink[] => [
  { datasetId: `science-culture-${prefix}s`, parentSeriesId: `science_culture.${prefix}_staff.total`, seriesIds: ids(`science_culture.${prefix}_staff.`, ["women", "men"]), breakdown: "sex", proof: "sum" },
  { datasetId: `science-culture-${prefix}s`, parentSeriesId: `science_culture.${prefix}_staff.total`, seriesIds: ids(`science_culture.${prefix}_staff.`, ["permanent", "contract"]), breakdown: "contract", proof: "sum" },
  { datasetId: `science-culture-${prefix}s`, parentSeriesId: `science_culture.${prefix}_staff.total`, seriesIds: ids(`science_culture.${prefix}_staff.`, ["age_under25", "age_25_54", "age_55_plus"]), breakdown: "age", proof: "sum" },
];

export const TOPIC_HIERARCHY: readonly TopicHierarchyLink[] = [
  ...["nominal", "share_of_gdp"].flatMap((measure): TopicHierarchyLink[] => [
    { datasetId: "expenditure-types", parentSeriesId: `spending_type.expense.${measure}`, seriesIds: ids("spending_type.", RUNNING_COSTS, `.${measure}`), proof: "sum" },
    { datasetId: "economy-expenditure", parentSeriesId: `gdp_use.consumption.${measure}`, seriesIds: ids("gdp_use.", ["households", "npish", "government"], `.${measure}`), proof: "sum" },
    { datasetId: "economy-expenditure", parentSeriesId: `gdp_use.investment.${measure}`, seriesIds: ids("gdp_use.", ["fixed_capital", "inventories"], `.${measure}`), proof: "sum" },
  ]),
  ...["nominal", "share_of_gdp", "real_growth"].flatMap((measure): TopicHierarchyLink[] => {
    const proof = measure === "real_growth" ? "between" : "sum";
    return [
      { datasetId: "economy-expenditure", parentSeriesId: `gdp_use.government.${measure}`, seriesIds: ids("gdp_use.", ["government_individual", "government_collective"], `.${measure}`), proof },
      { datasetId: "economy-expenditure", parentSeriesId: `gdp_use.exports.${measure}`, seriesIds: ids("gdp_use.", ["exports_goods", "exports_services"], `.${measure}`), proof },
      { datasetId: "economy-expenditure", parentSeriesId: `gdp_use.imports.${measure}`, seriesIds: ids("gdp_use.", ["imports_goods", "imports_services"], `.${measure}`), proof },
    ];
  }),
  // GDP by expenditure: GDP is consumption, investment and exports less imports, so imports is no part of it.
  ...["nominal", "share_of_gdp", "real_growth"].map((measure): TopicHierarchyLink => ({
    datasetId: "economy-expenditure", parentSeriesId: `economy.gdp_total.${measure}`, seriesIds: ids("gdp_use.", ["consumption", "investment", "exports"], `.${measure}`),
    subtracted: [`gdp_use.imports.${measure}`], proof: measure === "real_growth" ? "label" : "sum",
    note: { key: "definitions.topicGdpLessImports", values: {}, seriesIds: [`economy.gdp_total.${measure}`, `gdp_use.imports.${measure}`] },
  })),
  { datasetId: "economy-expenditure", parentSeriesId: "gdp_use.consumption.real_growth", seriesIds: ["gdp_use.households_npish.real_growth", "gdp_use.government.real_growth"], proof: "between" },
  { datasetId: "economy-expenditure", parentSeriesId: "gdp_use.investment.real_growth", seriesIds: ["gdp_use.fixed_capital.real_growth"], proof: "label" },
  { datasetId: "money-borrowers", parentSeriesId: "borrowers.households", seriesIds: ["borrowers.people", "borrowers.individual_entrepreneurs"], proof: "sum" },
  { datasetId: "unemployment-overview", parentSeriesId: "long_term_unemployed", seriesIds: ["long_term_unemployed.men", "long_term_unemployed.women"], proof: "sum" },
  { datasetId: "unemployment-overview", parentSeriesId: "long_term_unemployed_share", seriesIds: ["long_term_unemployed_share.men", "long_term_unemployed_share.women"], proof: "between" },
  { datasetId: "unemployment-overview", parentSeriesId: "long_term_unemployment_rate", seriesIds: ["long_term_unemployment_rate.men", "long_term_unemployment_rate.women"], proof: "between" },
  ...["recipients", "amount", "avg_monthly"].flatMap((measure): TopicHierarchyLink[] => {
    const proof = measure === "avg_monthly" ? "between" : "sum";
    return [
      { datasetId: "health-social-package", parentSeriesId: `social.social_package.total.${measure}`, seriesIds: ids("social.social_package.", SOCIAL_PACKAGE, `.${measure}`), proof },
      { datasetId: "health-social-package", parentSeriesId: `social.social_package.disability.${measure}`, seriesIds: ids("social.social_package.", DISABILITY, `.${measure}`), proof },
    ];
  }),
  { datasetId: "health-funded-pension", parentSeriesId: "social.funded_pension.contributions.amount", seriesIds: ids("social.funded_pension.", ["contributions_private", "contributions_public", "contributions_state"], ".amount"), proof: "sum" },
  { datasetId: "science-culture-museums", parentSeriesId: "science_culture.museums", seriesIds: ids("science_culture.museums.type_", ["memorial", "history", "art", "reserve", "literature", "other"]), proof: "sum" },
  { datasetId: "science-culture-theatres", parentSeriesId: "science_culture.theatres.total", seriesIds: ids("science_culture.theatres.type_", ["drama", "puppet", "opera_ballet", "youth"]), proof: "sum" },
  ...STAFF("museum"), ...STAFF("theatre"),
  { datasetId: "science-culture-research", parentSeriesId: "science_culture.rd_staff.total", seriesIds: ["science_culture.researchers.total", ...ids("science_culture.rd_staff.", ["technicians", "support", "not_specified"])], breakdown: "occupation", proof: "sum" },
  { datasetId: "science-culture-research", parentSeriesId: "science_culture.researchers.total", seriesIds: ids("science_culture.researchers.", ["women", "men"]), proof: "sum" },
  { datasetId: "transport-passengers", parentSeriesId: "transport.passengers.rail", seriesIds: ["transport.passengers.rail_domestic", "transport.passengers.rail_international"], proof: "sum" },
  { datasetId: "transport-freight", parentSeriesId: "transport.freight_tonnes.rail", seriesIds: ids("transport.freight_tonnes.rail_", ["domestic", "exports", "imports", "transit"]), proof: "sum" },
  { datasetId: "transport-freight", parentSeriesId: "transport.freight_tonnes.seaports", seriesIds: ids("transport.freight_tonnes.seaports_", ["liquid", "general", "dry"]), proof: "sum" },
  ...["students", "admitted", "graduates"].flatMap((group): TopicHierarchyLink[] => {
    const [parentSeriesId, prefix] = [`education.he_${group}.total`, `education.he_${group}.`];
    return [
      { datasetId: "education-universities", parentSeriesId, seriesIds: ids(prefix, ["level_bachelor", "level_master", "level_professional"]), breakdown: "level", proof: "sum" },
      { datasetId: "education-universities", parentSeriesId, seriesIds: ids(prefix, ["public", "private"]), breakdown: "ownership", proof: "sum" },
      { datasetId: "education-universities", parentSeriesId, seriesIds: ids(prefix, ["women", "men"]), breakdown: "sex", proof: "sum" },
      { datasetId: "education-universities", parentSeriesId, seriesIds: ids(`${prefix}field_`, FIELDS), breakdown: "field", proof: "sum" },
    ];
  }),
  // Two breakdowns of one total each, printed under one heading.
  ...(["sex", "sector"] as const).map((breakdown): TopicHierarchyLink => ({
    datasetId: "wages-overview", parentSeriesId: "average_monthly_nominal_earnings",
    seriesIds: ids("average_monthly_nominal_earnings.", breakdown === "sex" ? ["women", "men"] : ["public", "non_public"]), breakdown, proof: "between",
  })),
  { datasetId: "education-schools", parentSeriesId: "education.teachers.total", seriesIds: ids("education.teachers.", ["public", "private"]), breakdown: "ownership", proof: "sum" },
  { datasetId: "education-schools", parentSeriesId: "education.teachers.total", seriesIds: ids("education.teachers.", ["women", "men"]), breakdown: "sex", proof: "sum" },
  // The fields fall short of the total up to the last year the source counted its earlier list of fields
  // (docs/data-methodology/education-annual.md, Vocational colleges): 2020 for admissions, 2022 for graduates.
  ...([["vet_admitted", 2020], ["vet_graduates", 2022]] as const).flatMap(([group, lastYear]): TopicHierarchyLink[] => {
    const fields = ids(`education.${group}.field_`, ["agriculture_vet", "arts_humanities", "business_law", "education", "engineering", "health_welfare", "ict", "services", "social_journalism"]);
    return [
      { datasetId: "education-vocational", parentSeriesId: `education.${group}.total`, seriesIds: ids(`education.${group}.`, ["women", "men"]), breakdown: "sex", proof: "sum" },
      { datasetId: "education-vocational", parentSeriesId: `education.${group}.total`, breakdown: "field", proof: "within", seriesIds: fields,
        note: { key: "definitions.topicVetOldFields", values: { lastYear }, seriesIds: fields } },
    ];
  }),
  { datasetId: "living-standards-poverty", parentSeriesId: "poverty.absolute", seriesIds: ids("poverty.absolute.settlement.", ["urban", "rural"]), breakdown: "settlement", proof: "between" },
  { datasetId: "living-standards-poverty", parentSeriesId: "poverty.absolute", seriesIds: ids("poverty.absolute.age.", ["0_17", "18_64", "65_plus"]), breakdown: "age", proof: "between" },
  { datasetId: "living-standards-poverty", parentSeriesId: "poverty.absolute", seriesIds: ids("poverty.absolute.sex.", ["female", "male"]), breakdown: "sex", proof: "between" },
  ...["per_household", "per_capita"].flatMap((measure): TopicHierarchyLink[] => [
    { datasetId: "living-standards-income", parentSeriesId: `income.total.${measure}`, seriesIds: ids("income.total.settlement.", ["urban", "rural"], `.${measure}`), breakdown: "settlement", proof: "between" },
    { datasetId: "living-standards-spending", parentSeriesId: `spending.consumption.${measure}`, seriesIds: ids("spending.consumption.settlement.", ["urban", "rural"], `.${measure}`), breakdown: "settlement", proof: "between" },
  ]),
];

const SUM_TOLERANCE = 1e-4;

/** A series id's measure, its last part (`gdp_use.investment.real_growth` → `real_growth`), and the id without it. */
const measureOf = (seriesId: string) => seriesId.slice(seriesId.lastIndexOf(".") + 1);
const stemOf = (seriesId: string) => seriesId.slice(0, Math.max(seriesId.lastIndexOf("."), 0));

/**
 * A dataset with its reviewed links applied. A link naming a series the dataset does not serve, a part in another unit,
 * a part linked twice, or figures that do not bear the link out stops the build.
 */
export function applyTopicHierarchy(build: TopicDatasetBuild, links: readonly TopicHierarchyLink[] = TOPIC_HIERARCHY): TopicDatasetBuild {
  const { datasetId } = build.page;
  const own = links.filter((link) => link.datasetId === datasetId);
  if (!own.length) return build;
  const values = new Map(build.facts.flatMap((fact) => (fact.value === null ? [] : [[`${fact.entityId}\u0000${fact.seriesId}\u0000${fact.year}`, fact.value] as const])));
  const seriesOf = (seriesId: string) => {
    const found = build.series.find((series) => series.seriesId === seriesId);
    if (!found) throw new Error(`${datasetId}: reviewed hierarchy names ${seriesId}, which is not served`);
    return found;
  };
  const linked = new Map<string, TopicHierarchyLink>();
  const subtractedFrom = new Map<string, { seriesId: string; sum: boolean }>();
  const notes = new Map<string, TopicSeriesNote>();
  for (const link of own) {
    const parent = seriesOf(link.parentSeriesId);
    const subtracted = link.subtracted ?? [];
    if (subtracted.length && link.proof !== "sum" && link.proof !== "label") throw new Error(`${datasetId}: ${link.parentSeriesId} subtracts series, which only a "sum" proof checks`);
    for (const seriesId of [...link.seriesIds, ...subtracted]) {
      if (seriesOf(seriesId).unit !== parent.unit) throw new Error(`${datasetId}: ${seriesId} is not in the unit of ${link.parentSeriesId}`);
      if (linked.has(seriesId) || subtractedFrom.has(seriesId)) throw new Error(`${datasetId}: ${seriesId} is linked twice`);
      if (subtracted.includes(seriesId)) subtractedFrom.set(seriesId, { seriesId: link.parentSeriesId, sum: link.proof === "sum" });
      else linked.set(seriesId, link);
    }
    for (const seriesId of link.note?.seriesIds ?? []) {
      if (seriesOf(seriesId).note !== undefined || notes.has(seriesId)) throw new Error(`${datasetId}: ${seriesId} already has a note`);
      notes.set(seriesId, { key: link.note!.key, values: link.note!.values });
    }
    if (link.proof === "label") {
      const sameStems = (mine: readonly string[], theirs: readonly string[]) => mine.every((seriesId) => theirs.some((part) => stemOf(part) === stemOf(seriesId)));
      const provenBySum = own.some((other) => other.proof === "sum" && measureOf(other.parentSeriesId) !== measureOf(link.parentSeriesId)
        && stemOf(other.parentSeriesId) === stemOf(link.parentSeriesId)
        && sameStems(link.seriesIds, other.seriesIds) && sameStems(subtracted, other.subtracted ?? []));
      if (!provenBySum) throw new Error(`${datasetId}: ${link.parentSeriesId} is linked to ${link.seriesIds.join(", ")} by label only, and no sum link proves the same total and parts at another measure`);
      continue;
    }
    let checked = 0;
    for (const entity of build.entities) {
      for (const year of new Set(build.facts.map((fact) => fact.year))) {
        const at = (seriesId: string) => values.get(`${entity.entityId}\u0000${seriesId}\u0000${year}`);
        const total = at(link.parentSeriesId), parts = link.seriesIds.map(at), less = subtracted.map(at);
        if (total === undefined || [...parts, ...less].some((part) => part === undefined)) continue;
        const known = parts as number[];
        const net = known.reduce((sum, part) => sum + part, 0) - (less as number[]).reduce((sum, part) => sum + part, 0);
        const holds = link.proof === "sum"
          ? Math.abs(total - net) <= SUM_TOLERANCE * Math.abs(total)
          : link.proof === "within"
            ? known.every((part) => part >= 0) && net <= total * (1 + SUM_TOLERANCE)
            : total >= Math.min(...known) - 1e-9 && total <= Math.max(...known) + 1e-9;
        if (!holds) throw new Error(`${datasetId}: ${link.parentSeriesId} is not the ${{ sum: "sum", within: "sum or more", between: "aggregate" }[link.proof]} of ${link.seriesIds.join(", ")}${subtracted.length ? ` less ${subtracted.join(", ")}` : ""} at ${entity.entityId} ${year}`);
        checked += 1;
      }
    }
    if (!checked) throw new Error(`${datasetId}: no place and year prints ${link.parentSeriesId} and all of ${link.seriesIds.join(", ")}`);
  }
  return {
    ...build,
    series: build.series.map((series) => {
      const link = linked.get(series.seriesId), total = subtractedFrom.get(series.seriesId), note = notes.get(series.seriesId);
      const noted = note === undefined ? series : { ...series, note };
      if (total !== undefined) return { ...noted, parentSeriesId: null, subtractedFrom: total };
      return link ? { ...noted, parentSeriesId: link.parentSeriesId, ...(link.breakdown === undefined ? {} : { breakdown: link.breakdown }) } : noted;
    }),
  };
}
