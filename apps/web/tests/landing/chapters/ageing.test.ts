import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../../lib/data/demography/types";
import { loadServedMunicipalData } from "../../../lib/data/servedData";
import { buildMunicipalListRows } from "../../../lib/explorer/municipalData";
import { buildAgeingChapter } from "../../../lib/landing/chapters/ageing";
import { buildMunicipalChapter } from "../../../lib/landing/chapters/municipalRelief";
import type { ReliefPlace } from "../../../lib/landing/chapters/types";

const place = (code: string): ReliefPlace => ({ code, name: code, totalGel: 1, perResidentGel: 1, rank: 1, city: false });

let facts: ServedDemographyObservation[];
let places: ReliefPlace[];

beforeAll(async () => {
  facts = (await loadServedDemographyData()).facts;
  const data = await loadServedMunicipalData();
  const list = buildMunicipalListRows({
    municipalities: data.municipalities,
    regionLabels: new Map(data.regions.map((region) => [region.id, region.kaLabel])),
    totalFacts: data.totalFacts,
    populationFacts: data.populationFacts,
    adjaraBudgetAdjustments: data.adjaraBudgetAdjustments,
    year: 2025,
  });
  places = buildMunicipalChapter(list.municipalities, 2025, { locale: "ka", englishLabels: {}, messages: {} }).places;
}, 60_000);

const fact = (seriesId: string, geographyId: string, year: number, value: number, extra: Partial<ServedDemographyObservation> = {}): ServedDemographyObservation => ({
  seriesId,
  geographyId,
  year,
  value,
  unit: "persons",
  estimateBasis: "registered",
  status: "published",
  sourceId: "source.test",
  sourceLocator: "test",
  lastReviewedAt: "2026-10-01",
  ...extra,
});

describe("buildAgeingChapter with served data", () => {
  it("pyramid is the latest population_by_age_sex year against the first", () => {
    const { pyramid } = buildAgeingChapter(facts, places);
    expect(pyramid.year).toBe(2026);
    expect(pyramid.baseYear).toBe(2004);
    expect(pyramid.ages).toHaveLength(18);
    expect(pyramid.ages[0]).toBe("0–4");
    expect(pyramid.ages.at(-1)).toBe("85+");
    for (const list of [pyramid.men, pyramid.women, pyramid.baseMen, pyramid.baseWomen]) expect(list).toHaveLength(18);
    expect(pyramid.men[17]).toBe(19083);
    expect(pyramid.women[17]).toBe(49131);
  });

  it("65+ share from population_age_band", () => {
    const chapter = buildAgeingChapter(facts, places);
    expect(chapter.oldShare.year).toBe(2026);
    expect(chapter.oldShare.share).toBeCloseTo(0.1808, 4);
    expect(chapter.oldShareBase.year).toBe(2004);
    expect(chapter.oldShareBase.share).toBeCloseTo(0.1407, 4);
    expect(chapter.ageing).toBe(true);
  });

  it("women per 100 men and oldest women per man, latest year", () => {
    const chapter = buildAgeingChapter(facts, places);
    expect(chapter.womenPer100Men).toBeCloseTo(108.8, 1);
    expect(chapter.oldestWomenPerMan).toBeCloseTo(2.6, 1);
  });

  it("life expectancy and fertility take their own latest year", () => {
    const chapter = buildAgeingChapter(facts, places);
    expect(chapter.lifeExpectancy).toEqual({ year: 2025, total: 76.0, women: 80.6, men: 71.4 });
    expect(chapter.fertility).toEqual({ year: 2025, rate: 1.53 });
  });

  it("migration is the consecutive net series", () => {
    const { migration } = buildAgeingChapter(facts, places);
    expect(migration.years[0]).toBe(2012);
    expect(migration.years.at(-1)).toBe(2025);
    expect(migration.net).toHaveLength(migration.years.length);
    expect(migration.net.at(-1)).toBe(17127);
    expect(migration.net.reduce((sum, value) => sum + value, 0)).toBe(-26795);
  });

  it("births per place are aligned with the relief places", () => {
    const chapter = buildAgeingChapter(facts, places);
    expect(chapter.births.year).toBe(2025);
    expect(chapter.births.births).toBe(37867);
    expect(chapter.births.deaths).toBe(44319);
    expect(chapter.births.places).toHaveLength(places.length);
    expect(chapter.births.places[places.findIndex((item) => item.code === "06")]).toEqual({ births: 2630, deaths: 1779 });
  });
});

// A pyramid in which every age group holds one person per sex, so only the shares matter.
function pyramidFixture(year: number): ServedDemographyObservation[] {
  const groups = ["age_0", "age_1_4", ...["5_9", "10_14", "15_19", "20_24", "25_29", "30_34", "35_39", "40_44", "45_49", "50_54", "55_59", "60_64", "65_69", "70_74", "75_79", "80_84"].map((age) => `age_${age}`), "age_85_plus", "total"];
  return (["male", "female"] as const).flatMap((sex) => groups.map((ageGroup) => fact("demography.population_by_age_sex", "country.georgia", year, 1, { sex, ageGroup })));
}

describe("buildAgeingChapter births and gaps", () => {
  const vital = (seriesId: string, geographyId: string, value: number, year = 2025) => fact(seriesId, geographyId, year, value);
  const base = [...pyramidFixture(2000), ...pyramidFixture(2010)];
  const band = (year: number, ageGroup: string, value = 1) => fact("demography.population_age_band", "country.georgia", year, value, { sex: "total", ageGroup });
  const bandsOf = (olderBase: number, olderLatest: number) => [
    band(2000, "band_0_14", 20), band(2000, "band_15_64", 80 - olderBase), band(2000, "band_65_plus", olderBase),
    band(2010, "band_0_14", 20), band(2010, "band_15_64", 80 - olderLatest), band(2010, "band_65_plus", olderLatest),
  ];
  const bands = bandsOf(20, 15);
  const georgiaVital = [vital("demography.live_births", "country.georgia", 1), vital("demography.deaths", "country.georgia", 1)];
  const rest = [
    fact("demography.life_expectancy_total", "country.georgia", 2020, 70),
    fact("demography.life_expectancy_female", "country.georgia", 2020, 75),
    fact("demography.life_expectancy_male", "country.georgia", 2020, 65),
    fact("demography.total_fertility_rate", "country.georgia", 2020, 2),
    fact("demography.net_migration", "country.georgia", 2019, 5, { sex: "total" }),
    fact("demography.net_migration", "country.georgia", 2020, -2, { sex: "total" }),
  ];

  it("ageing is false when the 65+ share falls", () => {
    const chapter = buildAgeingChapter(
      [...base, ...bands, ...rest, ...georgiaVital],
      [],
    );
    expect(chapter.oldShare.share).toBeCloseTo(0.15, 6);
    expect(chapter.oldShareBase.share).toBeCloseTo(0.2, 6);
    expect(chapter.ageing).toBe(false);
    const rising = buildAgeingChapter([...base, ...bandsOf(15, 20), ...rest, ...georgiaVital], []);
    expect(rising.ageing).toBe(true);
  });

  it("a place without vital rows is null, and a code not on the grid is ignored", () => {
    const facts = [
      ...base,
      ...bands,
      ...rest,
      vital("demography.live_births", "country.georgia", 100),
      vital("demography.deaths", "country.georgia", 90),
      vital("demography.live_births", "06", 10),
      vital("demography.deaths", "06", 8),
      vital("demography.live_births", "05", 7),
      vital("demography.deaths", "05", 6),
    ];
    const chapter = buildAgeingChapter(facts, [place("06"), place("07")]);
    expect(chapter.births).toEqual({ year: 2025, births: 100, deaths: 90, places: [{ births: 10, deaths: 8 }, null] });
  });

  it("throws when the 65+ share years differ from the pyramid years", () => {
    const shifted = (latest: number, first: number) => [
      band(first, "band_0_14", 20), band(first, "band_15_64", 60), band(first, "band_65_plus", 20),
      band(latest, "band_0_14", 20), band(latest, "band_15_64", 65), band(latest, "band_65_plus", 15),
    ];
    expect(() => buildAgeingChapter([...base, ...shifted(2009, 2000), ...rest, ...georgiaVital], [])).toThrow(/65\+ share is for 2009 but the pyramid is for 2010/);
    expect(() => buildAgeingChapter([...base, ...shifted(2010, 2001), ...rest, ...georgiaVital], [])).toThrow(/65\+ base share is for 2001 but the pyramid base is 2000/);
  });

  it("throws with the series id when a required series has no year", () => {
    expect(() => buildAgeingChapter([...base, ...bands, ...rest], [])).toThrow(/demography\.live_births/);
    expect(() => buildAgeingChapter(facts.filter((row) => row.seriesId !== "demography.total_fertility_rate"), places)).toThrow(/demography\.total_fertility_rate/);
  });
});
