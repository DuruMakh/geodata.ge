import { beforeAll, describe, expect, it } from "vitest";
import { loadServedMunicipalData, type MunicipalData } from "../../lib/data/servedData";
import { ADJARA_REGION_ID } from "../../lib/data/municipal/types";
import {
  aggregateFactsForEntity,
  applyAdjaraBudgetAdjustment,
  buildMunicipalListRows,
  regionFactsFor,
} from "../../lib/explorer/municipalData";
import { REGION_GENITIVE_KA } from "../../lib/explorer/municipalLabels";
import {
  adjaraDescriptionKa,
  georgiaDescriptionKa,
  municipalityDescriptionKa,
  regionBudgetTitleKa,
  regionDescriptionKa,
  type RankedEntitySeoInput,
} from "../../lib/seo/municipalMetadata";

let data: MunicipalData;

beforeAll(async () => {
  data = await loadServedMunicipalData();
});

function coverage() {
  const years = Array.from(new Set(data.totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  return { firstYear: years[0]!, latestYear: years.at(-1)! };
}

function requiredRank(rank: number | null): number {
  if (rank === null) throw new Error("Ranked SEO fixture requires a rank");
  return rank;
}

function largestFunctionInput(
  functionFacts: MunicipalData["functionFacts"],
  totalFacts: MunicipalData["totalFacts"],
  latestYear: number,
) {
  const latestTotalGel = totalFacts.find((row) => row.year === latestYear)!.publicTotalGel;
  const largest = functionFacts
    .filter((row) => row.year === latestYear)
    .sort((left, right) => right.amountGel - left.amountGel)[0]!;
  return {
    latestTotalGel,
    largestCategoryKa: data.functions.find((row) => row.id === largest.categoryId)!.kaLabel,
    largestCategoryShare: largest.amountGel / latestTotalGel,
  };
}

function municipalityInputs(): RankedEntitySeoInput[] {
  const { firstYear, latestYear } = coverage();
  const regionLabels = new Map(data.regions.map((region) => [region.id, region.kaLabel]));
  const list = buildMunicipalListRows({
    municipalities: data.municipalities,
    regionLabels,
    totalFacts: data.totalFacts,
    adjaraBudgetAdjustments: data.adjaraBudgetAdjustments,
    year: latestYear,
  });

  return data.municipalities.map((municipality) => {
    const functionFacts = data.functionFacts.filter(
      (row) => row.municipalityCode === municipality.code,
    );
    const totalFacts = data.totalFacts.filter((row) => row.municipalityCode === municipality.code);
    return {
      nameKa: municipality.nameKa,
      firstYear,
      latestYear,
      rank: requiredRank(list.municipalities.find((row) => row.id === municipality.code)!.rank),
      rankOutOf: 64,
      ...largestFunctionInput(functionFacts, totalFacts, latestYear),
    };
  });
}

function regionInputs(): Array<
  | { kind: "ranked"; input: RankedEntitySeoInput }
  | { kind: "adjara"; input: Omit<RankedEntitySeoInput, "largestCategoryKa" | "largestCategoryShare"> }
> {
  const { firstYear, latestYear } = coverage();
  const regionLabels = new Map(data.regions.map((region) => [region.id, region.kaLabel]));
  const list = buildMunicipalListRows({
    municipalities: data.municipalities,
    regionLabels,
    totalFacts: data.totalFacts,
    adjaraBudgetAdjustments: data.adjaraBudgetAdjustments,
    year: latestYear,
  });

  return data.regions.map((region) => {
    const members = regionFactsFor(
      region.id,
      data.municipalities,
      data.functionFacts,
      data.totalFacts,
    );
    const rolled = aggregateFactsForEntity(region.id, members.functionFacts, members.totalFacts);
    const own =
      region.id === ADJARA_REGION_ID
        ? {
            ...rolled,
            totalFacts: applyAdjaraBudgetAdjustment(rolled.totalFacts, data.adjaraBudgetAdjustments),
          }
        : rolled;
    const common = {
      nameKa: REGION_GENITIVE_KA[region.id]!,
      firstYear,
      latestYear,
      rank: requiredRank(list.regions.find((row) => row.id === region.id)!.rank),
      rankOutOf: 11 as const,
      latestTotalGel: own.totalFacts.find((row) => row.year === latestYear)!.publicTotalGel,
    };
    return region.id === ADJARA_REGION_ID
      ? { kind: "adjara" as const, input: common }
      : {
          kind: "ranked" as const,
          input: { ...common, ...largestFunctionInput(own.functionFacts, own.totalFacts, latestYear) },
        };
  });
}

describe("municipal entity SEO copy", () => {
  it("keeps all 64 municipality descriptions unique and within the search-snippet range", () => {
    const descriptions = municipalityInputs().map(municipalityDescriptionKa);
    expect(descriptions).toHaveLength(64);
    expect(new Set(descriptions).size).toBe(64);
    expect(descriptions.every((text) => text.length >= 120 && text.length <= 160)).toBe(true);
  });

  it("keeps all 11 region descriptions unique and within the search-snippet range", () => {
    const descriptions = regionInputs().map(({ kind, input }) =>
      kind === "adjara" ? adjaraDescriptionKa(input) : regionDescriptionKa(input),
    );
    expect(descriptions).toHaveLength(11);
    expect(new Set(descriptions).size).toBe(11);
    expect(descriptions.every((text) => text.length >= 120 && text.length <= 160)).toBe(true);
  });

  it("describes Adjara's consolidated six-municipality total without inventing a functional share", () => {
    const adjara = regionInputs().find((row) => row.kind === "adjara")!;
    const description = adjaraDescriptionKa(adjara.input);
    expect(description).toContain("6 მუნიციპალიტეტ");
    expect(description).toContain("შიდა ტრანსფერ");
    expect(description).not.toContain("ყველაზე დიდი ფუნქციური");
  });

  it("states the 69-unit Georgia total and Adjara adjustment within the snippet range", () => {
    const { firstYear, latestYear } = coverage();
    const description = georgiaDescriptionKa({
      firstYear,
      latestYear,
      latestTotalGel: data.countryTotalFacts.find((row) => row.year === latestYear)!.publicTotalGel,
    });
    expect(description).toContain("69");
    expect(description).toContain("აჭარის");
    expect(description).toContain("შიდა ტრანსფერ");
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("uses a shorter unique region title", () => {
    expect(regionBudgetTitleKa("იმერეთის", 2015, 2025)).toBe(
      "იმერეთის ბიუჯეტი 2015–2025 | Fiscal.ge",
    );
  });
});
