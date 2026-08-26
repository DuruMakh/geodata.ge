import { formatAmount, formatShare } from "../explorer/format";
import { georgianOrdinal } from "../explorer/municipalLabels";

export type RankedEntitySeoInput = {
  nameKa: string;
  firstYear: number;
  latestYear: number;
  latestTotalGel: number;
  rank: number;
  rankOutOf: 64 | 11;
  largestCategoryKa: string;
  largestCategoryShare: number;
};

export function municipalityDescriptionKa(input: RankedEntitySeoInput): string {
  return (
    `${input.nameKa}ს ფაქტობრივი ბიუჯეტი ${input.latestYear}: ${formatAmount(input.latestTotalGel)}; ` +
    `ადგილი ${georgianOrdinal(input.rank)}/${input.rankOutOf}. ` +
    `უდიდესი ფუნქცია: ${input.largestCategoryKa} (${formatShare(input.largestCategoryShare)}). ` +
    `${input.firstYear}–${input.latestYear}.`
  );
}

export function regionDescriptionKa(input: RankedEntitySeoInput): string {
  return (
    `${input.nameKa} მუნიციპალური ბიუჯეტი ${input.latestYear}: ${formatAmount(input.latestTotalGel)}; ` +
    `ადგილი: ${georgianOrdinal(input.rank)} ${input.rankOutOf}-დან. ` +
    `უმსხვილესი ფუნქცია: ${input.largestCategoryKa} (${formatShare(input.largestCategoryShare)}). ` +
    `${input.firstYear}–${input.latestYear}.`
  );
}

export function adjaraDescriptionKa(
  input: Omit<RankedEntitySeoInput, "largestCategoryKa" | "largestCategoryShare"> & {
    municipalityCount: number;
  },
): string {
  return (
    `აჭარის გაერთიანებული ბიუჯეტი ${input.latestYear}: ${formatAmount(input.latestTotalGel)}; ` +
    `ადგილი: ${georgianOrdinal(input.rank)} ${input.rankOutOf}-დან. ` +
    `მოიცავს ${input.municipalityCount} მუნიციპალიტეტსა და აჭარის ა.რ. ბიუჯეტს, შიდა ტრანსფერების გამოკლებით. ` +
    `${input.firstYear}–${input.latestYear}.`
  );
}

export function georgiaDescriptionKa(input: {
  firstYear: number;
  latestYear: number;
  latestTotalGel: number;
  budgetUnitCount: number;
}): string {
  return (
    `საქართველოს მუნიციპალური ბიუჯეტები ${input.latestYear}: ${formatAmount(input.latestTotalGel)}. ` +
    `ჯამი მოიცავს ${input.budgetUnitCount} ერთეულს და აჭარის ა.რ. გადასახდელებს შიდა ტრანსფერების გამოკლებით. ` +
    `${input.firstYear}–${input.latestYear}.`
  );
}

export function regionBudgetTitleKa(
  regionGenitiveKa: string,
  firstYear: number,
  lastYear: number,
): string {
  return `${regionGenitiveKa} ბიუჯეტი ${firstYear}–${lastYear} | Fiscal.ge`;
}
