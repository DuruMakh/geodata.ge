export const DEMOGRAPHY_HUB_PATH = "/explorer/demography";

/**
 * The four Demography pages in hub order, and the one place that decides which are live. A name stays a
 * coming-soon marker until its data, page, methodology and tests exist together; flipping `live` is the
 * last step of the plan that ships the page. `labelKey` is its sidebar label (a `common` message).
 */
export const DEMOGRAPHY_PAGES = [
  { id: "population", path: "/explorer/demography/population", live: true, titleKey: "populationTitle", descriptionKey: "populationDescription", labelKey: "common.demographyPopulation" },
  { id: "age-sex", path: "/explorer/demography/age-sex", live: false, titleKey: "ageSexTitle", descriptionKey: "ageSexDescription", labelKey: "common.demographyAgeSex" },
  { id: "migration", path: "/explorer/demography/migration", live: false, titleKey: "migrationTitle", descriptionKey: "migrationDescription", labelKey: "common.demographyMigration" },
  { id: "births-deaths", path: "/explorer/demography/births-deaths", live: false, titleKey: "birthsDeathsTitle", descriptionKey: "birthsDeathsDescription", labelKey: "common.demographyBirthsDeaths" },
] as const;

export const LIVE_DEMOGRAPHY_PAGES = DEMOGRAPHY_PAGES.filter((page) => page.live);
