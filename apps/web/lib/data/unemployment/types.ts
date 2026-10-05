export type UnemploymentIndicator = "unemployment_rate" | "unemployed" | "employment_rate" | "employed" | "participation_rate" | "labour_force" | "outside_labour_force" | "population_15_plus" | "long_term_unemployed" | "long_term_unemployment_rate" | "long_term_unemployed_share";
export type UnemploymentBreakdown = "national" | "sex" | "settlement" | "age" | "region" | "education" | "long_term";
export type UnemploymentSex = "total" | "women" | "men";
export type UnemploymentObservation = {
  year: number; frequency: "annual"; dimension: UnemploymentBreakdown;
  groupId: string; groupLabelEn: string; sex: UnemploymentSex;
  indicatorId: UnemploymentIndicator; unit: "percent" | "thousand_persons";
  value: string; publishedValue: string; basis: "actual";
  valueStatus: "survey_estimate"; methodologyEpoch: "ilo19_20"; role: "primary";
  sourceId: string; sourceSheet: string; sourceCell: string;
  sourceGroupLabel: string; sourceLabel: string; sourceNumberFormat: string;
  lastReviewedAt: string;
};
export type ServedUnemploymentObservation = Omit<UnemploymentObservation, "value" | "publishedValue"> & { value: number; publishedValue: number };
export type ClientUnemploymentObservation = Pick<ServedUnemploymentObservation, "dimension" | "groupId" | "sex" | "indicatorId" | "year" | "value" | "publishedValue" | "sourceId">;
export type UnemploymentGroupDefinition = { id: string; labelKa: string; labelEn: string; sortOrder: number };

export const CORE_UNEMPLOYMENT_INDICATORS: UnemploymentIndicator[] = ["unemployment_rate", "unemployed", "employment_rate", "employed", "participation_rate", "labour_force", "outside_labour_force", "population_15_plus"];
export const EDUCATION_UNEMPLOYMENT_INDICATORS: UnemploymentIndicator[] = ["unemployment_rate", "employment_rate", "participation_rate"];
export const LONG_TERM_UNEMPLOYMENT_INDICATORS: UnemploymentIndicator[] = ["long_term_unemployment_rate", "long_term_unemployed", "long_term_unemployed_share"];
export function unemploymentIndicators(breakdown: UnemploymentBreakdown): UnemploymentIndicator[] {
  return breakdown === "education" ? EDUCATION_UNEMPLOYMENT_INDICATORS : breakdown === "long_term" ? LONG_TERM_UNEMPLOYMENT_INDICATORS : CORE_UNEMPLOYMENT_INDICATORS;
}
export function unemploymentIsRate(indicator: UnemploymentIndicator): boolean {
  return indicator.endsWith("_rate") || indicator === "long_term_unemployed_share";
}
export function unemploymentObservationKey(fact: Pick<UnemploymentObservation, "dimension" | "groupId" | "sex" | "indicatorId" | "year">): string {
  return [fact.dimension, fact.groupId, fact.sex, fact.indicatorId, fact.year].join(":");
}
