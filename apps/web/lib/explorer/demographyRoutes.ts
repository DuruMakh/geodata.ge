export const DEMOGRAPHY_HUB_PATH = "/explorer/demography";
/** The Population index, the one definition of its address: its place pages and the page list below build on it. */
export const POPULATION_PATH = "/explorer/demography/population";
export const MIGRATION_PATH = "/explorer/demography/migration";
export const BIRTHS_DEATHS_PATH = "/explorer/demography/births-deaths";

/**
 * The four Demography pages in hub order, and the one place that decides which are live. A name stays a
 * coming-soon marker until its data, page, methodology and tests exist together; flipping `live` is the
 * last step of the plan that ships the page. `labelKey` is its sidebar label (a `common` message).
 */
export const DEMOGRAPHY_PAGES = [
  { id: "population", path: POPULATION_PATH, live: true, titleKey: "populationTitle", descriptionKey: "populationDescription", labelKey: "common.demographyPopulation" },
  { id: "age-sex", path: "/explorer/demography/age-sex", live: false, titleKey: "ageSexTitle", descriptionKey: "ageSexDescription", labelKey: "common.demographyAgeSex" },
  { id: "migration", path: MIGRATION_PATH, live: true, titleKey: "migrationTitle", descriptionKey: "migrationDescription", labelKey: "common.demographyMigration" },
  { id: "births-deaths", path: BIRTHS_DEATHS_PATH, live: false, titleKey: "birthsDeathsTitle", descriptionKey: "birthsDeathsDescription", labelKey: "common.demographyBirthsDeaths" },
] as const;

export const LIVE_DEMOGRAPHY_PAGES = DEMOGRAPHY_PAGES.filter((page) => page.live);
