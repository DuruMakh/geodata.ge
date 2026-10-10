import type { MethodologyContent } from "../../types";

export const DEMOGRAPHY_METHODOLOGY: MethodologyContent = {
  id: "demography",
  slug: "demography",
  title: "Demography",
  summary: "Population on 1 January for Georgia, its 11 regions and 64 municipalities, 2004–2026, density by region, international migration by citizenship, 2012–2025, and registered births and deaths, 2014–2025, with Georgia’s fertility and life expectancy.",
  reviewedAt: "2026-10-10",
  archiveManifestId: "demography",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/demography.md"],
  disclosure: "Official annual Geostat observations. Fiscal.ge computes the shares and ranks; because of the 1 January 2025 census re-base no change is computed. Fiscal.ge also adds up the citizenships other than five named countries into one group and computes net migration for selected groups and the foreign citizens’ share. For births and deaths Fiscal.ge computes births per 100 deaths and the count of municipalities where deaths exceeded births.",
  keyFacts: [
    { label: "Coverage", valueKind: "coverage" },
    { label: "Frequency", valueKind: "frequency", value: "Annual" },
    { label: "Unit", valueKind: "unit", value: "persons / persons per km² / persons per year / children per woman / years" },
  ],
  sections: [
    { id: "scope", kind: "scope", title: "Coverage", paragraphs: ["The page covers Georgia, its 11 regions and 64 municipalities. Georgia’s population is available for 2004–2026 and the regions’ and municipalities’ for 2015–2026; density is published for Georgia and the regions. Occupied territories are excluded. Tbilisi is the one place that is both a region and a municipality, and it carries the same figures at both levels. Migration covers Georgia only, 2012–2025: immigrants and emigrants by sex and by six citizenship groups, and net migration. Births, deaths and natural increase cover Georgia from 2014 and the regions and municipalities from 2015, to 2025. The total fertility rate, fertility by mother’s age and life expectancy at birth cover Georgia only, 2014–2025."] },
    { id: "sources", kind: "sources", title: "Sources and basis", paragraphs: [
      "Source: Geostat, population on 1 January by region and self-governed unit, and density by region. Population is stored to the person; Geostat’s table displays it in thousands.",
      "Density is the 1 January population divided by one fixed area as of March 2014, occupied territories excluded. For Tbilisi the area is 504.24 km², not the 726 km² often cited. Municipalities have no official area, so municipal density is not published.",
      "The basis follows the year: 2004–2014 were re-estimated in 2018, 2015–2024 were estimated before the 2024 census, and from 2025 the figures are based on the 2024 census.",
      "Migration: Geostat, immigrants and emigrants by sex and citizenship, and net migration, from Ministry of Internal Affairs border records. An immigrant is recorded at the border, stays at least 183 days within the following 12 months and was not a usual resident before; an emigrant is the mirror case. Georgia, Russia, Turkey, Azerbaijan and Ukraine are shown on their own; every other citizenship, stateless persons, not stated and Geostat’s own Other are added up by Fiscal.ge into one group, so it means the same in every year.",
      "Births and deaths: Geostat, live births, deaths and natural increase by region and self-governed unit, and, for Georgia, age-specific and total fertility rates and life expectancy at birth by sex. Events are counted when registered in the reference year; Georgian citizens registered abroad are included. From 2014 Geostat publishes registered data rather than retro-projections. The crude birth and death rates and the infant mortality rate come in the same release and are kept in the archive but not shown.",
    ] },
    { id: "validation", kind: "validation", title: "Validation", paragraphs: [
      "Original Excel hashes and byte sizes are fixed. The 11 regions, and separately the 64 municipalities, sum to Georgia’s figure in every year, and Tbilisi carries the same number as a region and as a municipality.",
      "The six citizenship groups add up to Geostat’s total in every year, direction and sex, men and women add up to both sexes, and arrivals minus departures equal the published net migration.",
      "Births minus deaths equal the published natural increase for every place and year, the 11 regions and the 64 municipalities each add up to Georgia, and five times the sum of the seven age-specific rates, per 1,000 women, equals the total fertility rate to within 0.005.",
    ] },
    { id: "limitations", kind: "limitations", title: "Limitations", paragraphs: [
      "On 1 January 2025 Geostat re-based the population to the 2024 census. The re-base is not the same everywhere: some municipalities lose population and others gain it. Figures for 2024 and 2025 are therefore not compared, and the page computes no growth, change or change in rank. Maps show the latest year only.",
      "Migration counts and the counts of births and deaths do not change at the census re-base; the fertility rates and life expectancy use the population and do. Citizenship is not country of birth or of residence, and the pages state no causes. Projections and the age-and-sex structure are not yet published.",
    ] },
    { id: "archive", kind: "archive", title: "Original sources", paragraphs: ["Twelve untouched Geostat Excel files: population on 1 January by region and self-governed unit, density by region, immigrants and emigrants by sex and citizenship, net migration, live births, deaths and natural increase by self-governed unit, fertility rates, life expectancy at birth by sex, and the crude birth, crude death and infant mortality rates."] },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};
