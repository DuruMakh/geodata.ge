// Schema.org vocabulary for the published datasets: the measures each one
// carries, the keywords it should be found by, and how its figures were
// obtained. These are the Google-recommended Dataset properties that describe
// the data itself rather than a single page, so they are keyed by dataset and
// shared by every page that renders that dataset — a municipality subset
// measures exactly what the municipal dataset measures.
//
// The measure ids are NOT retyped here: `Measure` and `DatasetId` are imported
// from the query layer, which validates every served request against the same
// enums. `schemas.ts` already carries the warning that a second hand-maintained
// copy silently drifts, so this module owns only the SEO-facing prose — the
// Georgian labels, descriptions, keywords and provenance sentence — and takes
// the identifiers from the one place that defines them.
//
// Which measures each dataset carries still mirrors `catalogue.json`, and
// `datasetVocabulary.enums.test.ts` asserts that against the query enums.

import type { DatasetId, Measure } from "../factQuery/types";

/** Every published dataset except `ministries`, which has no page of its own. */
export type FiscalDatasetId = Exclude<DatasetId, "ministries">;

export type MeasureJsonLd = {
  "@type": "PropertyValue";
  /** The machine id; `name` carries the label a person reads. */
  propertyID: Measure;
  name: string;
  description: string;
  unitText: string;
};

const MEASURES: Record<Measure, Omit<MeasureJsonLd, "@type" | "propertyID">> = {
  amount_gel: {
    name: "თანხა (ლარი)",
    description: "თანხა ნომინალურ ლარში, მიმდინარე ფასებში.",
    unitText: "GEL",
  },
  share_of_total_pct: {
    name: "წილი ჯამში (%)",
    description: "წილი შესაბამის ჯამში, პროცენტებში.",
    unitText: "%",
  },
  share_of_gdp_pct: {
    name: "წილი მშპ-ში (%)",
    description: "წილი მთლიან შიდა პროდუქტში, პროცენტებში.",
    unitText: "%",
  },
  gel_per_resident: {
    name: "თანხა ერთ მოსახლეზე (ლარი)",
    description: "თანხა ერთ მოსახლეზე, ნომინალურ ლარში.",
    unitText: "GEL",
  },
  rate_percent: {
    name: "საპროცენტო განაკვეთი (%)",
    description: "საპროცენტო განაკვეთი წლიურად, პროცენტებში.",
    unitText: "%",
  },
};

// Georgian terms carry the site's own audience; the English terms are how the
// same data is searched for internationally. Keywords are metadata, so both
// belong on a Georgian page.
export const DATASETS: Record<
  FiscalDatasetId,
  { measures: readonly Measure[]; keywords: readonly string[]; measurementTechnique: string }
> = {
  "national-expenditure": {
    measures: ["amount_gel", "share_of_total_pct", "share_of_gdp_pct"],
    keywords: [
      "ბიუჯეტი",
      "სახელმწიფო ბიუჯეტი",
      "ხარჯები",
      "საქართველო",
      "Georgia",
      "state budget",
      "government expenditure",
      "public finance",
    ],
    measurementTechnique:
      "გადამოწმებული ამოღება ბიუჯეტის შესრულების ოფიციალური გამოქვეყნებული ანგარიშებიდან.",
  },
  "national-revenue": {
    measures: ["amount_gel", "share_of_total_pct", "share_of_gdp_pct"],
    keywords: [
      "ბიუჯეტი",
      "შემოსავლები",
      "გადასახადები",
      "საქართველო",
      "Georgia",
      "budget revenue",
      "tax revenue",
      "public finance",
    ],
    measurementTechnique:
      "გადამოწმებული ამოღება ბიუჯეტის შესრულების ოფიციალური გამოქვეყნებული ანგარიშებიდან.",
  },
  "municipal-expenditure": {
    measures: ["amount_gel", "share_of_total_pct", "gel_per_resident"],
    keywords: [
      "ბიუჯეტი",
      "მუნიციპალიტეტი",
      "ადგილობრივი ბიუჯეტი",
      "ხარჯები",
      "საქართველო",
      "Georgia",
      "municipal budget",
      "local government finance",
    ],
    measurementTechnique:
      "გადამოწმებული ამოღება მუნიციპალური ბიუჯეტების შესრულების ოფიციალური გამოქვეყნებული ანგარიშებიდან.",
  },
  "government-debt": {
    measures: ["amount_gel", "share_of_gdp_pct", "rate_percent"],
    keywords: [
      "სახელმწიფო ვალი",
      "ვალის მომსახურება",
      "საქართველო",
      "Georgia",
      "government debt",
      "public debt",
      "debt service",
    ],
    measurementTechnique:
      "გადამოწმებული ამოღება ფინანსთა სამინისტროს ოფიციალური სავალო პუბლიკაციებიდან.",
  },
  "general-government-balance": {
    measures: ["share_of_gdp_pct", "amount_gel"],
    keywords: [
      "დეფიციტი",
      "პროფიციტი",
      "ფისკალური ბალანსი",
      "საქართველო",
      "Georgia",
      "fiscal deficit",
      "general government balance",
    ],
    measurementTechnique:
      "გადამოწმებული ამოღება საერთაშორისო სავალუტო ფონდის გამოქვეყნებული მაჩვენებლებიდან.",
  },
};

/**
 * `omit` drops a measure the published catalogue says this entity does not
 * carry — `catalogue.json` qualifies some measures with a `measureNotes`
 * entry, and claiming one an entity never has would be a false claim.
 */
export function variableMeasuredFor(
  datasetId: FiscalDatasetId,
  omit: readonly Measure[] = [],
): readonly MeasureJsonLd[] {
  return DATASETS[datasetId].measures
    .filter((measure) => !omit.includes(measure))
    .map((propertyID) => ({
      "@type": "PropertyValue",
      propertyID,
      ...MEASURES[propertyID],
    }));
}

export function keywordsFor(datasetId: FiscalDatasetId): readonly string[] {
  return DATASETS[datasetId].keywords;
}

export function measurementTechniqueFor(datasetId: FiscalDatasetId): string {
  return DATASETS[datasetId].measurementTechnique;
}
