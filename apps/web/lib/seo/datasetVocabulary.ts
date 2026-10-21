// Schema.org vocabulary for the published datasets: the measures each one
// carries, the keywords it should be found by, and how its figures were
// obtained. These are the Google-recommended Dataset properties that describe
// the data itself rather than a single page, so they are keyed by dataset and
// shared by every page that renders that dataset — a municipality subset
// measures exactly what the municipal dataset measures.
//
// Every string here reaches the page, so it is localized: an English page
// carries no Georgian, which `tests/browser/bilingual-seo.spec.ts` enforces
// inside JSON-LD as well as in visible text.
//
// The measure ids are NOT retyped here: `Measure` and `DatasetId` are imported
// from the query layer, which validates every served request against the same
// enums. `schemas.ts` already carries the warning that a second hand-maintained
// copy silently drifts, so this module owns only the SEO-facing prose and takes
// the identifiers from the one place that defines them.
//
// Which measures each dataset carries still mirrors `catalogue.json`, and
// `datasetVocabulary.enums.test.ts` asserts that against the query enums.

import { GDP_QUERY_SERIES } from "../factQuery/gdpSeries";
import type { InflationMeasure } from "../factQuery/inflationSeries";
import type { ProductQueryMeasure } from "../factQuery/inflationProductSeries";
import type { DatasetId, Measure } from "../factQuery/types";
import type { Locale } from "../i18n/types";
import type { MethodologyDatasetId } from "../methodology/types";

/**
 * Every published dataset except `ministries`, which has no page of its own,
 * and the inflation datasets, whose measures are described by their pages (`TopicDatasetId`).
 */
export type FiscalDatasetId = Exclude<DatasetId, "ministries" | "inflation" | "inflation-products">;

/**
 * Datasets whose pages name the series they show: inflation, which the query layer serves with its own measure
 * vocabulary, and the topics that have no query-layer measures at all. Their keywords and technique live here;
 * `variableMeasured` comes from the page (`explorerDatasetJsonLd`), which knows its series' labels.
 */
export type TopicDatasetId =
  | Exclude<MethodologyDatasetId, "expenditure" | "revenue" | "municipalities" | "debt" | "gdp" | "economic-sectors" | "regional-economies" | "demography">
  | "inflation-products";

/** An official statistics producer whose published figures a dataset is read from. */
export type SourceAgencyId = "geostat" | "nbg" | "ssa" | "mof" | "treasury";

const SOURCE_AGENCIES: Record<SourceAgencyId, { name: Localized; url: string }> = {
  geostat: {
    name: { ka: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)", en: "National Statistics Office of Georgia (Geostat)" },
    url: "https://www.geostat.ge",
  },
  nbg: {
    name: { ka: "საქართველოს ეროვნული ბანკი", en: "National Bank of Georgia" },
    url: "https://nbg.gov.ge",
  },
  ssa: {
    name: { ka: "სოციალური მომსახურების სააგენტო", en: "Social Service Agency" },
    url: "https://ssa.moh.gov.ge",
  },
  mof: {
    name: { ka: "საქართველოს ფინანსთა სამინისტრო", en: "Ministry of Finance of Georgia" },
    url: "https://mof.ge",
  },
  treasury: {
    name: { ka: "სახაზინო სამსახური", en: "State Treasury of Georgia" },
    url: "https://www.treasury.ge",
  },
};

export type SourceAgencyJsonLd = { "@type": "Organization"; name: string; url: string };

/** Every dataset a page can render Dataset JSON-LD for. */
export type SeoDatasetId = FiscalDatasetId | TopicDatasetId;
type FiscalMeasure = Exclude<Measure, InflationMeasure | ProductQueryMeasure>;

type Localized = Record<Locale, string>;

export type MeasureJsonLd = {
  "@type": "PropertyValue";
  /** The machine id; `name` carries the label a person reads. */
  propertyID: string;
  name: string;
  description: string;
  unitText: string;
};

const MEASURES: Record<FiscalMeasure, { name: Localized; description: Localized; unitText: string }> = {
  real_growth_pct: {
    name: { ka: "წლიური რეალური ზრდა (%)", en: "Annual real growth (%)" },
    description: {
      ka: "წლიური მოცულობის ცვლილება, ფასების ეფექტის გარეშე.",
      en: "Annual change in volume, excluding price effects.",
    },
    unitText: "%",
  },
  value: {
    name: { ka: "გამოქვეყნებული მაჩვენებელი", en: "Published value" },
    description: {
      ka: "ერთეული განსაზღვრულია სერიით.",
      en: "Unit and price basis are defined by each series.",
    },
    unitText: "series-specific",
  },
  amount_gel: {
    name: { ka: "თანხა (ლარი)", en: "Amount (GEL)" },
    description: {
      ka: "თანხა ნომინალურ ლარში, მიმდინარე ფასებში.",
      en: "Amount in nominal GEL, at current prices.",
    },
    unitText: "GEL",
  },
  share_of_total_pct: {
    name: { ka: "წილი ჯამში (%)", en: "Share of total (%)" },
    description: {
      ka: "წილი შესაბამის ჯამში, პროცენტებში.",
      en: "Share of the relevant total, in percent.",
    },
    unitText: "%",
  },
  share_of_gdp_pct: {
    name: { ka: "წილი მშპ-ში (%)", en: "Share of GDP (%)" },
    description: {
      ka: "წილი მთლიან შიდა პროდუქტში, პროცენტებში.",
      en: "Share of gross domestic product, in percent.",
    },
    unitText: "%",
  },
  share_of_region_gdp_pct: {
    name: { ka: "რეგიონის მშპ-ში წილი (%)", en: "Share of regional GDP (%)" },
    description: {
      ka: "ეკონომიკური საქმიანობის დამატებული ღირებულების წილი იმავე რეგიონის სრულ მშპ-ში, პროცენტებში.",
      en: "Economic-activity GVA as a percentage of the same region's complete market-price GDP.",
    },
    unitText: "%",
  },
  gel_per_resident: {
    name: { ka: "თანხა ერთ მოსახლეზე (ლარი)", en: "Amount per resident (GEL)" },
    description: {
      ka: "თანხა ერთ მოსახლეზე, ნომინალურ ლარში.",
      en: "Amount per resident, in nominal GEL.",
    },
    unitText: "GEL",
  },
  rate_percent: {
    name: { ka: "საპროცენტო განაკვეთი (%)", en: "Interest rate (%)" },
    description: {
      ka: "საპროცენტო განაკვეთი წლიურად, პროცენტებში.",
      en: "Interest rate per annum, in percent.",
    },
    unitText: "%",
  },
};

export const DATASETS: Record<
  FiscalDatasetId,
  {
    measures: readonly FiscalMeasure[];
    keywords: Record<Locale, readonly string[]>;
    measurementTechnique: Localized;
  }
> = {
  "economic-sectors": {
    measures: ["amount_gel", "share_of_gdp_pct", "real_growth_pct"],
    keywords: {
      ka: ["ეკონომიკის სექტორები", "დამატებული ღირებულება", "მშპ"],
      en: ["Georgia", "economic sectors", "gross value added", "real growth"],
    },
    measurementTechnique: {
      ka: "საქსტატის წლიური ეროვნული ანგარიშები; სექტორული დამატებული ღირებულება და მთლიანი მშპ.",
      en: "Reviewed Geostat annual national accounts: activity GVA at basic prices, market-price GDP shares and real volume growth.",
    },
  },
  "regional-economies": {
    measures: ["amount_gel", "share_of_region_gdp_pct"],
    keywords: {
      ka: ["რეგიონული ეკონომიკა", "რეგიონული მშპ", "დამატებული ღირებულება"],
      en: ["Georgia", "regional economies", "regional GDP", "gross value added"],
    },
    measurementTechnique: {
      ka: "საქსტატის წლიური რეგიონული ანგარიშები; საქმიანობების დამატებული ღირებულება საბაზისო ფასებში და რეგიონული მშპ საბაზრო ფასებში.",
      en: "Reviewed Geostat annual regional accounts: activity GVA at basic prices and regional GDP at market prices.",
    },
  },
  "gdp-overview": {
    measures: ["value"],
    keywords: {
      ka: ["მშპ", "ეკონომიკა", "საქართველო"],
      en: ["Georgia", "GDP", "real GDP growth", "GDP per capita"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატისა და მსოფლიო ბანკის წლიური ეროვნული ანგარიშებიდან.",
      en: "Reviewed extraction of published annual national accounts from Geostat and the World Bank, with explicit units and source status.",
    },
  },
  "national-expenditure": {
    measures: ["amount_gel", "share_of_total_pct", "share_of_gdp_pct"],
    keywords: {
      ka: ["ბიუჯეტი", "სახელმწიფო ბიუჯეტი", "ხარჯები", "საქართველო"],
      en: ["Georgia", "state budget", "government expenditure", "public finance"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება ბიუჯეტის შესრულების ოფიციალური გამოქვეყნებული ანგარიშებიდან.",
      en: "Reviewed extraction from the official published budget execution reports.",
    },
  },
  "national-revenue": {
    measures: ["amount_gel", "share_of_total_pct", "share_of_gdp_pct"],
    keywords: {
      ka: ["ბიუჯეტი", "შემოსავლები", "გადასახადები", "საქართველო"],
      en: ["Georgia", "budget revenue", "tax revenue", "public finance"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება ბიუჯეტის შესრულების ოფიციალური გამოქვეყნებული ანგარიშებიდან.",
      en: "Reviewed extraction from the official published budget execution reports.",
    },
  },
  "municipal-expenditure": {
    measures: ["amount_gel", "share_of_total_pct", "gel_per_resident"],
    keywords: {
      ka: ["ბიუჯეტი", "მუნიციპალიტეტი", "ადგილობრივი ბიუჯეტი", "ხარჯები", "საქართველო"],
      en: ["Georgia", "municipal budget", "local government finance", "municipality"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება მუნიციპალური ბიუჯეტების შესრულების ოფიციალური გამოქვეყნებული ანგარიშებიდან.",
      en: "Reviewed extraction from the official published municipal budget execution reports.",
    },
  },
  "government-debt": {
    measures: ["amount_gel", "share_of_gdp_pct", "rate_percent"],
    keywords: {
      ka: ["სახელმწიფო ვალი", "ვალის მომსახურება", "საქართველო"],
      en: ["Georgia", "government debt", "public debt", "debt service"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება ფინანსთა სამინისტროს ოფიციალური სავალო პუბლიკაციებიდან.",
      en: "Reviewed extraction from the Ministry of Finance's official debt publications.",
    },
  },
  "general-government-balance": {
    measures: ["share_of_gdp_pct", "amount_gel"],
    keywords: {
      ka: ["დეფიციტი", "პროფიციტი", "ფისკალური ბალანსი", "საქართველო"],
      en: ["Georgia", "fiscal deficit", "general government balance", "budget balance"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საერთაშორისო სავალუტო ფონდის გამოქვეყნებული მაჩვენებლებიდან.",
      en: "Reviewed extraction from the International Monetary Fund's published indicators.",
    },
  },
};

/**
 * `sources` credits the official producers a topic's figures are read from; a page whose figures come from a
 * different set (a % of GDP view, one external-flows page) names its own.
 */
const TOPIC_DATASETS: Record<TopicDatasetId, { keywords: Record<Locale, readonly string[]>; measurementTechnique: Localized; sources: readonly SourceAgencyId[] }> = {
  inflation: {
    keywords: {
      ka: ["ინფლაცია", "სამომხმარებლო ფასების ინდექსი", "საქართველო"],
      en: ["Georgia", "inflation", "consumer price index", "CPI"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის ყოველთვიური სამომხმარებლო ფასების ინდექსის ოფიციალური გამოქვეყნებული ფაილებიდან.",
      en: "Reviewed extraction from Geostat's official published monthly consumer price index files.",
    },
    // Geostat's CPI and the National Bank of Georgia's inflation target.
    sources: ["geostat", "nbg"],
  },
  "inflation-products": {
    keywords: {
      ka: ["ინფლაცია", "პროდუქტების ფასები", "სამომხმარებლო კალათა", "საქართველო"],
      en: ["Georgia", "product inflation", "consumer prices", "consumer basket"],
    },
    measurementTechnique: {
      ka: "წლიური ცვლილება არის საქსტატის წინა წლის იმავე თვესთან შედარებული ინდექსი გამოკლებული 100. დაგროვილ ცვლილებას Fiscal.ge ითვლის თითოეული გამოქვეყნებული თვიური ინდექსის გამრავლებით არჩეული საწყისი წლის წინა დეკემბრიდან; გამოტოვებული თვე სრულ პერიოდს მიუწვდომელს ხდის.",
      en: "Annual change is Geostat's same-month-of-prior-year index minus 100. Cumulative change is compounded by Fiscal.ge from every published previous-month index since December before the selected first year; missing months leave the full span unavailable.",
    },
    sources: ["geostat"],
  },
  trade: {
    keywords: {
      ka: ["საგარეო ვაჭრობა", "ექსპორტი", "იმპორტი", "საქართველო"],
      en: ["Georgia", "external trade", "exports", "imports"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის საგარეო ვაჭრობის ოფიციალური გამოქვეყნებული მონაცემებიდან.",
      en: "Reviewed extraction from Geostat's official published external trade data.",
    },
    sources: ["geostat"],
  },
  "external-flows": {
    keywords: {
      ka: ["ფულადი გზავნილები", "პირდაპირი უცხოური ინვესტიციები", "მიმდინარე ანგარიში", "საქართველო"],
      en: ["Georgia", "money transfers", "foreign direct investment", "current account"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქართველოს ეროვნული ბანკისა და საქსტატის ოფიციალური გამოქვეყნებული სტატისტიკიდან.",
      en: "Reviewed extraction from the official published statistics of the National Bank of Georgia and Geostat.",
    },
    sources: ["nbg", "geostat"],
  },
  money: {
    keywords: {
      ka: ["ფულის მასა", "სესხები", "დეპოზიტები", "საპროცენტო განაკვეთები", "საქართველო"],
      en: ["Georgia", "money supply", "loans", "deposits", "interest rates"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქართველოს ეროვნული ბანკის ოფიციალური გამოქვეყნებული მონეტარული და საფინანსო სტატისტიკიდან.",
      en: "Reviewed extraction from the National Bank of Georgia's official published monetary and financial statistics.",
    },
    sources: ["nbg"],
  },
  business: {
    keywords: {
      ka: ["ბიზნესი", "საწარმოები", "ბრუნვა", "დასაქმებულები", "ინვესტიციები", "საქართველო"],
      en: ["Georgia", "business", "firms", "turnover", "employment", "investment"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის ბიზნეს სტატისტიკის ოფიციალური გამოქვეყნებული ფაილებიდან.",
      en: "Reviewed extraction from Geostat's official published business statistics files.",
    },
    sources: ["geostat"],
  },
  "expenditure-types": {
    keywords: {
      ka: ["ხარჯები ეკონომიკური კლასიფიკაციით", "შრომის ანაზღაურება", "სუბსიდიები", "სოციალური უზრუნველყოფა", "ინვესტიცია", "საქართველო"],
      en: ["Georgia", "government spending by type", "public wage bill", "interest", "subsidies", "social benefits", "public investment"],
    },
    measurementTechnique: {
      ka: "ფინანსთა სამინისტროს ზოგადი მთავრობის ოპერაციები (GFSM 2001); ხარჯები ეკონომიკური კლასიფიკაციით და მშპ-ის წილები.",
      en: "Reviewed Ministry of Finance general government operations (GFSM 2001): spending by economic type and shares of GDP.",
    },
    sources: ["mof", "geostat"],
  },
  "gdp-expenditure": {
    keywords: {
      ka: ["მშპ დანახარჯების მიხედვით", "მოხმარება", "ინვესტიცია", "ექსპორტი", "იმპორტი", "საქართველო"],
      en: ["Georgia", "GDP by expenditure", "consumption", "investment", "exports", "imports"],
    },
    measurementTechnique: {
      ka: "საქსტატის წლიური ეროვნული ანგარიშები; მშპ-ის გამოყენების კატეგორიები მიმდინარე ფასებში, მშპ-ის წილები და რეალური ზრდა.",
      en: "Reviewed Geostat annual national accounts: GDP by categories of use at current prices, GDP shares and real volume growth.",
    },
    sources: ["geostat"],
  },
  "tax-breaks-refunds": {
    keywords: {
      ka: ["საგადასახადო შეღავათები", "საგადასახადო დანახარჯები", "დღგ", "გადასახადის დაბრუნება", "საქართველო"],
      en: ["Georgia", "tax breaks", "tax expenditures", "VAT", "tax refunds"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება ფინანსთა სამინისტროს საგადასახადო დანახარჯების ანგარიშიდან და სახაზინო სამსახურის გამოქვეყნებული მონაცემებიდან.",
      en: "Reviewed extraction from the Ministry of Finance's Tax Expenditure Report and the State Treasury's published figures.",
    },
    sources: ["mof", "treasury"],
  },
  housing: {
    keywords: {
      ka: ["მშენებლობის ნებართვები", "ექსპლუატაციაში მიღებული ობიექტები", "საცხოვრებლის ფასები", "მშენებლობა", "საქართველო"],
      en: ["Georgia", "housing", "construction", "building permits", "completed buildings", "home prices"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის მშენებლობისა და საცხოვრებელი უძრავი ქონების ფასების ოფიციალური გამოქვეყნებული ფაილებიდან.",
      en: "Reviewed extraction from Geostat's official published construction and residential property price files.",
    },
    sources: ["geostat"],
  },
  unemployment: {
    keywords: {
      ka: ["უმუშევრობა", "დასაქმება", "სამუშაო ძალა", "საქართველო"],
      en: ["Georgia", "unemployment", "employment", "labour force"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის სამუშაო ძალის გამოკვლევის ოფიციალური გამოქვეყნებული შედეგებიდან.",
      en: "Reviewed extraction from the official published results of Geostat's Labour Force Survey.",
    },
    sources: ["geostat"],
  },
  wages: {
    keywords: {
      ka: ["ხელფასები", "საშუალო თვიური ხელფასი", "საქართველო"],
      en: ["Georgia", "wages", "average monthly earnings", "median earnings"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის ხელფასების ოფიციალური გამოქვეყნებული წლიური სტატისტიკიდან.",
      en: "Reviewed extraction from Geostat's official published annual earnings statistics.",
    },
    sources: ["geostat"],
  },
  poverty: {
    keywords: {
      ka: ["სიღარიბე", "უთანასწორობა", "ჯინის კოეფიციენტი", "საქართველო"],
      en: ["Georgia", "poverty", "inequality", "Gini coefficient"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის სიღარიბისა და უთანასწორობის ოფიციალური გამოქვეყნებული სტატისტიკიდან.",
      en: "Reviewed extraction from Geostat's official published poverty and inequality statistics.",
    },
    sources: ["geostat"],
  },
  "household-income": {
    keywords: {
      ka: ["შინამეურნეობები", "შემოსავლები", "ხარჯები", "საქართველო"],
      en: ["Georgia", "household income", "household spending"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის შინამეურნეობების შემოსავლებისა და ხარჯების ოფიციალური გამოქვეყნებული სტატისტიკიდან.",
      en: "Reviewed extraction from Geostat's official published household income and spending statistics.",
    },
    sources: ["geostat"],
  },
  "energy-food": {
    keywords: {
      ka: ["ენერგეტიკა", "ელექტროენერგია", "სურსათი", "საქართველო"],
      en: ["Georgia", "energy balance", "electricity", "food balance"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის ოფიციალური გამოქვეყნებული ენერგეტიკული ბალანსებიდან და სასურსათო ბალანსებიდან.",
      en: "Reviewed extraction from Geostat's official published energy balances and food balance sheets.",
    },
    sources: ["geostat"],
  },
  health: {
    keywords: {
      ka: ["ჯანდაცვა", "ექიმები", "საავადმყოფოები", "დაავადებები", "სიკვდილის მიზეზები", "საქართველო"],
      en: ["Georgia", "health", "doctors", "hospitals", "illnesses", "causes of death"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის ჯანდაცვისა და გარდაცვალების ოფიციალური გამოქვეყნებული სტატისტიკიდან.",
      en: "Reviewed extraction from Geostat's official published healthcare and deaths statistics.",
    },
    sources: ["geostat"],
  },
  crime: {
    keywords: {
      ka: ["დანაშაული", "მსჯავრდებულები", "პატიმრები", "დაზარალებულები", "საგზაო-სატრანსპორტო შემთხვევები", "საქართველო"],
      en: ["Georgia", "crime", "convictions", "prisoners", "victims", "road accidents"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის სისხლის სამართლის ოფიციალური გამოქვეყნებული სტატისტიკიდან; 100 000 მოსახლეზე მაჩვენებელს fiscal.ge ითვლის 1 იანვრის მოსახლეობიდან.",
      en: "Reviewed extraction from Geostat's official published criminal justice statistics; rates per 100,000 people are calculated by fiscal.ge from the population on 1 January.",
    },
    sources: ["geostat"],
  },
  internet: {
    keywords: {
      ka: ["ინტერნეტი", "კომპიუტერი", "მობილური ტელეფონი", "სმარტფონი", "ონლაინ შესყიდვები", "საქართველო"],
      en: ["Georgia", "internet", "computers", "mobile phones", "smartphones", "online shopping"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის შინამეურნეობებში საინფორმაციო და საკომუნიკაციო ტექნოლოგიების გამოყენების წლიური კვლევის ოფიციალური გამოქვეყნებული ცხრილებიდან.",
      en: "Reviewed extraction from the official published tables of Geostat's annual survey of ICT usage in households.",
    },
    sources: ["geostat"],
  },
  education: {
    keywords: {
      ka: ["განათლება", "სკოლები", "მოსწავლეები", "საბავშვო ბაღები", "უნივერსიტეტები", "პროფესიული კოლეჯები", "საქართველო"],
      en: ["Georgia", "education", "schools", "pupils", "kindergartens", "universities", "vocational colleges"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის განათლების ოფიციალური გამოქვეყნებული სტატისტიკიდან.",
      en: "Reviewed extraction from Geostat's official published education statistics.",
    },
    sources: ["geostat"],
  },
  "social-protection": {
    keywords: {
      ka: ["სოციალური დაცვა", "პენსიები", "საარსებო შემწეობა", "სოციალური პაკეტი", "სოციალური გასაცემლები", "საქართველო"],
      en: ["Georgia", "social protection", "pensions", "subsistence allowance", "social package", "social payments"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება სოციალური მომსახურების სააგენტოს ყოველთვიური სტატისტიკიდან: დეკემბრის რაოდენობები და 12 თვის თანხების ჯამი; საშუალოებს, წილებს მოსახლეობაში, 2025 წლის ფასებსა და მშპ-სთან შეფარდებას Fiscal.ge ითვლის საქსტატის მონაცემებით.",
      en: "Reviewed extraction from the Social Service Agency's monthly statistics: December counts and the sum of 12 monthly amounts; averages, shares of residents, 2025 prices and shares of GDP are calculated by Fiscal.ge with Geostat data.",
    },
    sources: ["ssa", "geostat"],
  },
  environment: {
    keywords: {
      ka: ["სათბურის გაზები", "ჰაერის დაბინძურება", "ჰაერის ხარისხი", "ტემპერატურა", "ნალექი", "წყალი", "ნარჩენები", "ტყეები", "საქართველო"],
      en: ["Georgia", "environment", "climate", "greenhouse gases", "air pollution", "air quality", "temperature", "rainfall", "water", "waste", "forests"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის გარემოს დაცვის ოფიციალური გამოქვეყნებული სტატისტიკიდან, ისე, როგორც ცხრილები ბეჭდავს.",
      en: "Reviewed extraction from Geostat's official published environment statistics, as its tables print them.",
    },
    sources: ["geostat"],
  },
  "science-culture": {
    keywords: {
      ka: ["მეცნიერება", "კულტურა", "მკვლევარები", "პატენტები", "მუზეუმები", "თეატრები", "საქართველო"],
      en: ["Georgia", "science", "culture", "researchers", "patents", "museums", "theatres"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის მეცნიერებისა და კულტურის ოფიციალური გამოქვეყნებული სტატისტიკიდან.",
      en: "Reviewed extraction from Geostat's official published science and culture statistics.",
    },
    sources: ["geostat"],
  },
  transport: {
    keywords: {
      ka: ["ტრანსპორტი", "ავტოპარკი", "ავტომობილები", "მგზავრთბრუნვა", "ტვირთბრუნვა", "რკინიგზა", "საქართველო"],
      en: ["Georgia", "transport", "vehicles", "cars", "passenger-km", "tonne-km", "railway", "registered vehicles"],
    },
    measurementTechnique: {
      ka: "გადამოწმებული ამოღება საქსტატის ტრანსპორტისა და გარემოს მდგომარეობის ინდიკატორების ოფიციალური გამოქვეყნებული ცხრილებიდან.",
      en: "Reviewed extraction from Geostat's official published transport and environmental indicator tables.",
    },
    sources: ["geostat"],
  },
};

/** A dataset whose figures are official statistics Fiscal.ge reads from a named producer (`sourceAgenciesFor`). */
export function isTopicDatasetId(id: string): id is TopicDatasetId {
  return Object.hasOwn(TOPIC_DATASETS, id);
}

export function isFiscalDatasetId(datasetId: SeoDatasetId): datasetId is FiscalDatasetId {
  return datasetId in DATASETS;
}

/**
 * `omit` drops a measure the published catalogue says this entity does not
 * carry — `catalogue.json` qualifies some measures with a `measureNotes`
 * entry, and claiming one an entity never has would be a false claim.
 */
export function variableMeasuredFor(
  datasetId: FiscalDatasetId,
  locale: Locale,
  omit: readonly Measure[] = [],
): readonly MeasureJsonLd[] {
  if (datasetId === "gdp-overview")
    return Object.entries(GDP_QUERY_SERIES).map(([propertyID, s]) => ({
      "@type": "PropertyValue",
      propertyID,
      name: locale === "ka" ? s.labelKa : s.labelEn,
      description: locale === "ka" ? s.definitionKa : s.definitionEn,
      unitText: s.unit,
    }));
  return DATASETS[datasetId].measures
    .filter((measure) => !omit.includes(measure))
    .map((propertyID) => ({
      "@type": "PropertyValue",
      propertyID,
      name: MEASURES[propertyID].name[locale],
      description: MEASURES[propertyID].description[locale],
      unitText: MEASURES[propertyID].unitText,
    }));
}

export function keywordsFor(datasetId: SeoDatasetId, locale: Locale): readonly string[] {
  return (isFiscalDatasetId(datasetId) ? DATASETS[datasetId] : TOPIC_DATASETS[datasetId]).keywords[locale];
}

/** The official producers a dataset's figures are read from, as schema.org Organizations; none for the fiscal datasets. */
export function sourceAgenciesFor(datasetId: SeoDatasetId, locale: Locale, override?: readonly SourceAgencyId[]): readonly SourceAgencyJsonLd[] {
  const ids = override ?? (isFiscalDatasetId(datasetId) ? [] : TOPIC_DATASETS[datasetId].sources);
  return ids.map((id) => ({ "@type": "Organization", name: SOURCE_AGENCIES[id].name[locale], url: SOURCE_AGENCIES[id].url }));
}

export function measurementTechniqueFor(datasetId: SeoDatasetId, locale: Locale): string {
  return (isFiscalDatasetId(datasetId) ? DATASETS[datasetId] : TOPIC_DATASETS[datasetId]).measurementTechnique[locale];
}
