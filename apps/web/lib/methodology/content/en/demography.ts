import type { MethodologyContent } from "../../types";

export const DEMOGRAPHY_METHODOLOGY: MethodologyContent = {
  id: "demography",
  slug: "demography",
  title: "Demography",
  summary: "Population on 1 January for Georgia, its 11 regions and 64 municipalities, 2004–2026, density by region, international migration by citizenship, 2012–2025, and registered births and deaths, 2014–2025, with Georgia’s fertility and life expectancy, the population by age and sex: Georgia 2004–2026 and the 2024 census for Georgia and the 11 regions, and registered marriages and divorces: Georgia 1994–2025, its regions and municipalities 2009–2025.",
  metaDescription: "Population of Georgia, its regions and municipalities, density, international migration, births and deaths, age and sex, and marriages and divorces.",
  reviewedAt: "2026-10-20",
  archiveManifestId: "demography",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/demography.md"],
  disclosure: "Official annual Geostat observations. Fiscal.ge computes the shares and ranks; because of the 1 January 2025 census re-base no change is computed. Fiscal.ge also adds up the citizenships other than five named countries into one group and computes net migration for selected groups and the foreign citizens’ share. For births and deaths Fiscal.ge computes births per 100 deaths and the count of municipalities where deaths exceeded births. For age and sex Fiscal.ge adds the published ages 0 and 1–4 into one 0–4 group and computes shares, the share aged 65 and over and women per 100 men. Marriages and divorces per 1,000 residents are calculated by Fiscal.ge from the counts and Geostat’s mid-year population, Geostat’s own method for its crude rates.",
  keyFacts: [
    { label: "Coverage", valueKind: "coverage" },
    { label: "Frequency", valueKind: "frequency", value: "Annual" },
    { label: "Unit", valueKind: "unit", value: "persons / persons per km² / persons per year / children per woman / years / marriages, divorces / per 1,000 residents" },
  ],
  sections: [
    { id: "scope", kind: "scope", title: "Coverage", paragraphs: ["The page covers Georgia, its 11 regions and 64 municipalities. Georgia’s population is available for 2004–2026 and the regions’ and municipalities’ for 2015–2026; density is published for Georgia and the regions. Occupied territories are excluded. Tbilisi is the one place that is both a region and a municipality, and it carries the same figures at both levels. Migration covers Georgia only, 2012–2025: immigrants and emigrants by sex and by six citizenship groups, and net migration. Births, deaths and natural increase cover Georgia from 2014 and the regions and municipalities from 2015, to 2025. The total fertility rate, fertility by mother’s age and life expectancy at birth cover Georgia only, 2014–2025. Population by five-year age group and sex covers Georgia, 2004–2026; the 2024 census adds the 11 regions, with urban and rural settlements, on one date, 14 November 2024. Marriages and divorces cover Georgia from 1994 and the regions and municipalities from 2009, to 2025; the average ages at marriage and divorce and the length of a marriage ended by divorce cover Georgia only."] },
    { id: "sources", kind: "sources", title: "Sources and basis", paragraphs: [
      "Source: Geostat, population on 1 January by region and self-governed unit, and density by region. Population is stored to the person; Geostat’s table displays it in thousands.",
      "Density is the 1 January population divided by one fixed area as of March 2014, occupied territories excluded. For Tbilisi the area is 504.24 km², not the 726 km² often cited. Municipalities have no official area, so municipal density is not published.",
      "The basis follows the year: 2004–2014 were re-estimated in 2018, 2015–2024 were estimated before the 2024 census, and from 2025 the figures are based on the 2024 census.",
      "Migration: Geostat, immigrants and emigrants by sex and citizenship, and net migration, from Ministry of Internal Affairs border records. An immigrant is recorded at the border, stays at least 183 days within the following 12 months and was not a usual resident before; an emigrant is the mirror case. Georgia, Russia, Turkey, Azerbaijan and Ukraine are shown on their own; every other citizenship, stateless persons, not stated and Geostat’s own Other are added up by Fiscal.ge into one group, so it means the same in every year.",
      "Births and deaths: Geostat, live births, deaths and natural increase by region and self-governed unit, and, for Georgia, age-specific and total fertility rates and life expectancy at birth by sex. Events are counted when registered in the reference year; Georgian citizens registered abroad are included. From 2014 Geostat publishes registered data rather than retro-projections. The crude birth and death rates and the infant mortality rate come in the same release and are kept in the archive but not shown.",
      "Age and sex: Geostat, population on 1 January by five-year age group and sex, and the 2024 census population by region, self-governed unit, five-year age group, urban and rural settlement and sex. Census counts are one date and are never placed on the annual timeline; the 1 January 2025 estimate is not the census count.",
      "Marriages and divorces: Geostat, marriages and divorces registered by region and self-governed unit, mid-year population, and, for Georgia, the average age of spouses (all and first marriages), of divorced people and the average length of a marriage ended by divorce. Since 2017 a marriage under 18 cannot be registered, which lifts the average ages slightly; marriages where both spouses are foreign citizens living abroad are not counted. Before 2009 Geostat’s place figures are on older borders (Tbilisi grew in 2007, and until 2008 they include Akhalgori and other now-occupied areas), so places start in 2009.",
    ] },
    { id: "validation", kind: "validation", title: "Validation", paragraphs: [
      "Original Excel hashes and byte sizes are fixed. The 11 regions, and separately the 64 municipalities, sum to Georgia’s figure in every year, and Tbilisi carries the same number as a region and as a municipality.",
      "The six citizenship groups add up to Geostat’s total in every year, direction and sex, men and women add up to both sexes, and arrivals minus departures equal the published net migration.",
      "Births minus deaths equal the published natural increase for every place and year, the 11 regions and the 64 municipalities each add up to Georgia, and five times the sum of the seven age-specific rates, per 1,000 women, equals the total fertility rate to within 0.005.",
      "The age groups add up to the published total in every year and sex, the three broad age groups equal the sums of their five-year groups, and the census age groups add up to the census totals of Georgia and of each region.",
      "From 2009 the regions and municipalities add up to Georgia’s marriages and divorces in every year except 2018, when Geostat’s Georgia total holds 86 divorces no region does; they stay in Georgia’s total only. Every rate recomputed for Georgia and the regions is within 0.05 of the rate Geostat publishes, except two 2018 regional divorce rates that follow that year’s different split.",
    ] },
    { id: "limitations", kind: "limitations", title: "Limitations", paragraphs: [
      "On 1 January 2025 Geostat re-based the population to the 2024 census. The re-base is not the same everywhere: some municipalities lose population and others gain it. Figures for 2024 and 2025 are therefore not compared, and the page computes no growth, change or change in rank. Maps show the latest year only.",
      "Migration counts and the counts of births and deaths do not change at the census re-base; the fertility rates, life expectancy and marriages and divorces per 1,000 residents use the population and do; the counts of marriages and divorces do not. Citizenship is not country of birth or of residence, and the pages state no causes. Projections, single years of age and municipal age structure are not published.",
    ] },
    { id: "archive", kind: "archive", title: "Original sources", paragraphs: ["Twenty untouched Geostat Excel files: population on 1 January by region and self-governed unit, population on 1 January by age group and sex, the 2024 census population by age, settlement and sex, density by region, immigrants and emigrants by sex and citizenship, net migration, live births, deaths and natural increase by self-governed unit, fertility rates, life expectancy at birth by sex, the crude birth, crude death and infant mortality rates, mid-year population by self-governed unit, marriages and divorces by self-governed unit, the average age of spouses and of divorced people, and the average length of marriage."] },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};
