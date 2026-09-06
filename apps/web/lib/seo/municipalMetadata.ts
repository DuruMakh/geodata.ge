import { formatAmount, formatShare } from "../explorer/format";
import { georgianOrdinal } from "../explorer/municipalLabels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import kaMunicipal from "../i18n/messages/ka/municipal.json";

export type RankedEntitySeoInput = {
  name: string;
  firstYear: number;
  latestYear: number;
  latestTotalGel: number;
  rank: number;
  rankOutOf: 64 | 11;
  largestCategory: string;
  largestCategoryShare: number;
};

function rankedValues(input: Omit<RankedEntitySeoInput, "largestCategory" | "largestCategoryShare">, presentation?: Presentation) {
  const locale = presentation?.locale ?? "ka";
  return { name: input.name, latest: input.latestYear, amount: formatAmount(input.latestTotalGel, locale), rank: locale === "en" ? input.rank : georgianOrdinal(input.rank), count: input.rankOutOf, first: input.firstYear };
}

export function municipalityDescription(input: RankedEntitySeoInput, presentation?: Presentation): string {
  return message(presentation?.messages ?? kaMunicipal, "municipal.metaMunicipalityDescription", {
    ...rankedValues(input, presentation), function: input.largestCategory, share: formatShare(input.largestCategoryShare),
  });
}

export function regionDescription(input: RankedEntitySeoInput, presentation?: Presentation): string {
  return message(presentation?.messages ?? kaMunicipal, "municipal.metaRegionDescription", {
    ...rankedValues(input, presentation), function: input.largestCategory, share: formatShare(input.largestCategoryShare),
  });
}

export function adjaraDescription(
  input: Omit<RankedEntitySeoInput, "largestCategory" | "largestCategoryShare"> & {
    municipalityCount: number;
  },
  presentation?: Presentation,
): string {
  return message(presentation?.messages ?? kaMunicipal, "municipal.metaAdjaraDescription", { ...rankedValues(input, presentation), members: input.municipalityCount });
}

export function georgiaDescription(input: {
  firstYear: number;
  latestYear: number;
  latestTotalGel: number;
  budgetUnitCount: number;
}, presentation?: Presentation): string {
  return message(presentation?.messages ?? kaMunicipal, "municipal.metaCountryDescription", { first: input.firstYear, latest: input.latestYear, amount: formatAmount(input.latestTotalGel, presentation?.locale ?? "ka"), count: input.budgetUnitCount });
}

export function regionBudgetTitle(
  name: string,
  firstYear: number,
  lastYear: number,
  presentation?: Presentation,
): string {
  return message(presentation?.messages ?? kaMunicipal, "municipal.metaRegionTitle", { name, first: firstYear, last: lastYear });
}
