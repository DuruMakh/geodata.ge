import type { UnemploymentBreakdown } from "../data/unemployment/types";

export const UNEMPLOYMENT_SECTIONS = [
  { id: "overview", href: "/explorer/unemployment/overview", breakdown: "national", labelKey: "common.unemploymentOverview" },
  { id: "regions", href: "/explorer/unemployment/regions", breakdown: "region", labelKey: "common.unemploymentRegions" },
  { id: "age", href: "/explorer/unemployment/age", breakdown: "age", labelKey: "common.unemploymentAge" },
  { id: "gender", href: "/explorer/unemployment/gender", breakdown: "sex", labelKey: "common.unemploymentGender" },
] as const;

export type UnemploymentSectionId = typeof UNEMPLOYMENT_SECTIONS[number]["id"];
export const NATIONAL_UNEMPLOYMENT_VIEWS: UnemploymentBreakdown[] = ["national", "settlement", "education", "long_term"];

export function unemploymentBreakdownsForSection(section: UnemploymentSectionId): readonly UnemploymentBreakdown[] {
  return section === "overview" ? NATIONAL_UNEMPLOYMENT_VIEWS : [UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.breakdown];
}

export function unemploymentSectionForBreakdown(breakdown: string | null) {
  return UNEMPLOYMENT_SECTIONS.find(section => section.breakdown === breakdown) ?? UNEMPLOYMENT_SECTIONS[0];
}
