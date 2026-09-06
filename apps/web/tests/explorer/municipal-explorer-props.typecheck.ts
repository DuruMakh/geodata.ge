import type { MunicipalExplorerProps } from "../../components/municipalities/municipal-explorer";

const common = {
  presentation: { locale: "ka" as const, messages: {}, englishLabels: {} },
  title: "title",
  triggerLabel: "trigger",
  metaLine: "meta",
  entityId: "entity",
  functions: [],
  functionFacts: [],
  totalFacts: [],
  workbookBasename: "workbook",
  workbookSources: [],
  siteOrigin: "https://fiscal.ge",
  pickerCountry: { id: "country.georgia" as const, nameKa: "საქართველო" as const, valueGel: 0, budgetCount: 69 as const },
  pickerGroups: [],
  sourceNote: "source",
};

const country: MunicipalExplorerProps = {
  ...common,
  metrics: { kind: "country", budgetCount: 69 },
};

const ranked: MunicipalExplorerProps = {
  ...common,
  metrics: { kind: "ranked", nationalTotalByYear: {}, rankByYear: {}, rankOutOf: 64 },
  navigation: { prev: { label: "previous", href: "/previous" }, next: { label: "next", href: "/next" } },
};

const countryWithRankedContext: MunicipalExplorerProps = {
  ...country,
  // @ts-expect-error Country views must not receive ranked context.
  nationalTotalByYear: {},
};

// @ts-expect-error Ranked views require complete previous/next navigation.
const rankedWithoutNavigation: MunicipalExplorerProps = {
  ...common,
  metrics: { kind: "ranked", nationalTotalByYear: {}, rankByYear: {}, rankOutOf: 64 },
};

void ranked;
void countryWithRankedContext;
void rankedWithoutNavigation;
