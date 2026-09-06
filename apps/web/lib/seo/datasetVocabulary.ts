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

import type { DatasetId, Measure } from "../factQuery/types";
import type { Locale } from "../i18n/types";

/** Every published dataset except `ministries`, which has no page of its own. */
export type FiscalDatasetId = Exclude<DatasetId, "ministries">;

type Localized = Record<Locale, string>;

export type MeasureJsonLd = {
  "@type": "PropertyValue";
  /** The machine id; `name` carries the label a person reads. */
  propertyID: Measure;
  name: string;
  description: string;
  unitText: string;
};

const MEASURES: Record<Measure, { name: Localized; description: Localized; unitText: string }> = {
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
    measures: readonly Measure[];
    keywords: Record<Locale, readonly string[]>;
    measurementTechnique: Localized;
  }
> = {
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
 * `omit` drops a measure the published catalogue says this entity does not
 * carry — `catalogue.json` qualifies some measures with a `measureNotes`
 * entry, and claiming one an entity never has would be a false claim.
 */
export function variableMeasuredFor(
  datasetId: FiscalDatasetId,
  locale: Locale,
  omit: readonly Measure[] = [],
): readonly MeasureJsonLd[] {
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

export function keywordsFor(datasetId: FiscalDatasetId, locale: Locale): readonly string[] {
  return DATASETS[datasetId].keywords[locale];
}

export function measurementTechniqueFor(datasetId: FiscalDatasetId, locale: Locale): string {
  return DATASETS[datasetId].measurementTechnique[locale];
}
