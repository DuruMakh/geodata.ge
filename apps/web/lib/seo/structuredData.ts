import type { Measure } from "../factQuery/types";
import {
  type FiscalDatasetId,
  keywordsFor,
  measurementTechniqueFor,
  variableMeasuredFor,
} from "./datasetVocabulary";

const CATALOG_NAME = "Fiscal.ge — ბიუჯეტის მონაცემები";
const MUNICIPAL_PARENT_NAME = "საქართველოს მუნიციპალიტეტების ბიუჯეტები";

export type BreadcrumbItem = {
  name: string;
  path: `/${string}` | "/";
};

export type DatasetJsonLdInput = {
  origin: string;
  path: `/methodology/${string}`;
  datasetId: FiscalDatasetId;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  downloadPath: `/downloads/data/${string}.csv`;
  /** Measures the published catalogue says this entity does not carry. */
  omitMeasures?: readonly Measure[];
  /** Published JSON companions to the CSV, in the order they should be listed. */
  jsonDownloadPaths?: readonly `/downloads/data/${string}.json`[];
};

export type ExplorerDatasetJsonLdInput = {
  origin: string;
  path: `/${string}`;
  datasetId: FiscalDatasetId;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  spatialCoverageName: string;
  downloadPath?: `/downloads/data/${string}.csv`;
  /**
   * Set on an entity page whose data is a slice of a larger published dataset.
   * A subset belongs to its parent, not directly to the catalog, so this and
   * `includedInDataCatalog` are mutually exclusive.
   */
  partOfPath?: `/${string}`;
  /** Set on the parent dataset to name the subsets it is made of. */
  hasPartPaths?: readonly `/${string}`[];
  /** True when spatialCoverageName is a place inside Georgia, not the country. */
  withinGeorgia?: boolean;
  /** Measures the published catalogue says this entity does not carry. */
  omitMeasures?: readonly Measure[];
  /**
   * The methodology page describing this same dataset, where one exists. The
   * two pages carry a Dataset node each for one dataset, so naming the
   * canonical description page here keeps a consumer from having to guess
   * which of the pair is the dataset's identity.
   */
  sameAsPath?: `/methodology/${string}`;
};

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
}

/** Explorer datasets are identified by a `#dataset` fragment on their page URL. */
function explorerDatasetId(origin: string, path: string): string {
  return `${absoluteUrl(origin, path)}#dataset`;
}

/**
 * The catalog node lives on /methodology, so a reference to it from any other
 * page has to describe itself: a bare `@id` resolves to a node with no `@type`
 * for a validator reading one page in isolation.
 */
function catalogReference(origin: string) {
  return {
    "@type": "DataCatalog",
    "@id": `${origin}/methodology#catalog`,
    name: CATALOG_NAME,
    url: `${origin}/methodology`,
  };
}

/**
 * The Google-recommended Dataset properties that describe the data rather than
 * the page: what it measures, what it is found by, how it was obtained, and
 * that reading it costs nothing.
 */
function datasetVocabulary(datasetId: FiscalDatasetId, omitMeasures?: readonly Measure[]) {
  return {
    keywords: keywordsFor(datasetId),
    variableMeasured: variableMeasuredFor(datasetId, omitMeasures),
    measurementTechnique: measurementTechniqueFor(datasetId),
    isAccessibleForFree: true,
  };
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function siteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Fiscal.ge",
        url: origin,
        email: "info@fiscal.ge",
        contactPoint: {
          "@type": "ContactPoint",
          email: "info@fiscal.ge",
          contactType: "general inquiries",
          availableLanguage: "ka",
        },
        description:
          "Fiscal.ge საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებულ მონაცემებს ქართულად აქვეყნებს.",
        logo: {
          "@type": "ImageObject",
          url: `${origin}/fiscal-ge-logo.svg`,
          width: 520,
          height: 650,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Fiscal.ge",
        url: origin,
        inLanguage: "ka",
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };
}

export function breadcrumbJsonLd(origin: string, items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(origin, item.path),
    })),
  };
}

/**
 * The catalog lists the site's top-level datasets. Entity subsets are reached
 * through their parent's `hasPart`, so they are deliberately not listed here:
 * a catalog names datasets, not every slice of one.
 */
export function dataCatalogJsonLd(
  origin: string,
  datasetPaths: readonly `/methodology/${string}`[],
  explorerDatasetPaths: readonly `/${string}`[] = [],
) {
  return {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": `${origin}/methodology#catalog`,
    name: CATALOG_NAME,
    description:
      "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემების კატალოგი.",
    url: `${origin}/methodology`,
    inLanguage: "ka",
    publisher: { "@id": `${origin}/#organization` },
    dataset: [
      // A methodology dataset is identified by its page URL; an explorer
      // dataset shares its page with other content and carries a fragment.
      ...datasetPaths.map((path) => ({ "@id": absoluteUrl(origin, path) })),
      ...explorerDatasetPaths.map((path) => ({ "@id": explorerDatasetId(origin, path) })),
    ],
  };
}

export function datasetJsonLd(input: DatasetJsonLdInput) {
  if (input.description.length < 50) {
    throw new Error("Dataset description must contain at least 50 characters");
  }
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": absoluteUrl(input.origin, input.path),
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.origin, input.path),
    inLanguage: "ka",
    temporalCoverage: `${input.firstYear}/${input.lastYear}`,
    spatialCoverage: { "@type": "Place", name: "საქართველო" },
    dateModified: input.dateModified,
    creator: { "@id": `${input.origin}/#organization` },
    publisher: { "@id": `${input.origin}/#organization` },
    includedInDataCatalog: catalogReference(input.origin),
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...datasetVocabulary(input.datasetId, input.omitMeasures),
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: absoluteUrl(input.origin, input.downloadPath),
      },
      // Only a different FORMAT of this same dataset belongs here. A related
      // but distinct published dataset (ministries.json beside national
      // expenditure) is linked for humans on the page instead: claiming it as
      // a distribution would tell a machine the two are the same data.
      ...(input.jsonDownloadPaths ?? []).map((jsonPath) => ({
        "@type": "DataDownload" as const,
        encodingFormat: "application/json",
        contentUrl: absoluteUrl(input.origin, jsonPath),
      })),
    ],
  };
}

export function explorerDatasetJsonLd(input: ExplorerDatasetJsonLdInput) {
  if (input.description.length < 50) {
    throw new Error("Dataset description must contain at least 50 characters");
  }
  const url = absoluteUrl(input.origin, input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: "ka",
    temporalCoverage: `${input.firstYear}/${input.lastYear}`,
    spatialCoverage: {
      "@type": "Place",
      name: input.spatialCoverageName,
      // Naming the country a municipality or region sits in is the only
      // geography we can state truthfully: the repository's map geometry is
      // SVG path data in a projected viewBox, not the WGS84 latitude and
      // longitude a schema.org GeoShape box would require.
      ...(input.withinGeorgia
        ? {
            containedInPlace: {
              "@type": "Country",
              name: "საქართველო",
              identifier: {
                "@type": "PropertyValue",
                propertyID: "ISO 3166-1 alpha-2",
                value: "GE",
              },
            },
          }
        : {}),
    },
    dateModified: input.dateModified,
    creator: { "@id": `${input.origin}/#organization` },
    publisher: { "@id": `${input.origin}/#organization` },
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...datasetVocabulary(input.datasetId, input.omitMeasures),
    ...(input.sameAsPath ? { sameAs: absoluteUrl(input.origin, input.sameAsPath) } : {}),
    // A subset is reachable from the catalog through its parent, so it claims
    // one relationship or the other and never both.
    ...(input.partOfPath
      ? {
          isPartOf: {
            "@type": "Dataset",
            "@id": explorerDatasetId(input.origin, input.partOfPath),
            name: MUNICIPAL_PARENT_NAME,
            url: absoluteUrl(input.origin, input.partOfPath),
          },
        }
      : { includedInDataCatalog: catalogReference(input.origin) }),
    ...(input.hasPartPaths
      ? {
          hasPart: input.hasPartPaths.map((path) => ({
            "@id": explorerDatasetId(input.origin, path),
          })),
        }
      : {}),
    ...(input.downloadPath
      ? {
          distribution: [
            {
              "@type": "DataDownload",
              encodingFormat: "text/csv",
              contentUrl: absoluteUrl(input.origin, input.downloadPath),
            },
          ],
        }
      : {}),
  };
}
