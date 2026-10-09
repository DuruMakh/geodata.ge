import type { MethodologyContent } from "../../types";

export const DEMOGRAPHY_METHODOLOGY: MethodologyContent = {
  id: "demography",
  slug: "demography",
  title: "Demography",
  summary: "Population on 1 January for Georgia, its 11 regions and 64 municipalities, 2004–2026, density by region, and international migration by citizenship, 2012–2025.",
  reviewedAt: "2026-10-09",
  archiveManifestId: "demography",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/demography.md"],
  disclosure: "Official annual Geostat observations. Fiscal.ge computes the shares and ranks; because of the 1 January 2025 census re-base no change is computed. Fiscal.ge also adds up the citizenships other than five named countries into one group and computes net migration for selected groups and the foreign citizens’ share.",
  keyFacts: [
    { label: "Coverage", valueKind: "coverage" },
    { label: "Frequency", valueKind: "frequency", value: "Annual" },
    { label: "Unit", valueKind: "unit", value: "persons / persons per km² / persons per year" },
  ],
  sections: [
    { id: "scope", kind: "scope", title: "Coverage", paragraphs: ["The page covers Georgia, its 11 regions and 64 municipalities. Georgia’s population is available for 2004–2026 and the regions’ and municipalities’ for 2015–2026; density is published for Georgia and the regions. Occupied territories are excluded. Tbilisi is the one place that is both a region and a municipality, and it carries the same figures at both levels. Migration covers Georgia only, 2012–2025: immigrants and emigrants by sex and by six citizenship groups, and net migration."] },
    { id: "sources", kind: "sources", title: "Sources and basis", paragraphs: [
      "Source: Geostat, population on 1 January by region and self-governed unit, and density by region. Population is stored to the person; Geostat’s table displays it in thousands.",
      "Density is the 1 January population divided by one fixed area as of March 2014, occupied territories excluded. For Tbilisi the area is 504.24 km², not the 726 km² often cited. Municipalities have no official area, so municipal density is not published.",
      "The basis follows the year: 2004–2014 were re-estimated in 2018, 2015–2024 were estimated before the 2024 census, and from 2025 the figures are based on the 2024 census.",
      "Migration: Geostat, immigrants and emigrants by sex and citizenship, and net migration, from Ministry of Internal Affairs border records. An immigrant is recorded at the border, stays at least 183 days within the following 12 months and was not a usual resident before; an emigrant is the mirror case. Georgia, Russia, Turkey, Azerbaijan and Ukraine are shown on their own; every other citizenship, stateless persons, not stated and Geostat’s own Other are added up by Fiscal.ge into one group, so it means the same in every year.",
    ] },
    { id: "validation", kind: "validation", title: "Validation", paragraphs: [
      "Original Excel hashes and byte sizes are fixed. The 11 regions, and separately the 64 municipalities, sum to Georgia’s figure in every year, and Tbilisi carries the same number as a region and as a municipality.",
      "The six citizenship groups add up to Geostat’s total in every year, direction and sex, men and women add up to both sexes, and arrivals minus departures equal the published net migration.",
    ] },
    { id: "limitations", kind: "limitations", title: "Limitations", paragraphs: [
      "On 1 January 2025 Geostat re-based the population to the 2024 census. The re-base is not the same everywhere: some municipalities lose population and others gain it. Figures for 2024 and 2025 are therefore not compared, and the page computes no growth, change or change in rank. Maps show the latest year only.",
      "Migration counts do not change at the census re-base. Citizenship is not country of birth or of residence, and the page states no causes. Projections, age and sex, births and deaths are not yet published.",
    ] },
    { id: "archive", kind: "archive", title: "Original sources", paragraphs: ["Four untouched Geostat Excel files: population on 1 January by region and self-governed unit, density by region, immigrants and emigrants by sex and citizenship, and net migration."] },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};
