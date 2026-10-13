import type { Measure } from "../factQuery/types";
import type { Locale } from "../i18n/types";
import { pageHref } from "../i18n/routes";
import {
  isFiscalDatasetId,
  keywordsFor,
  measurementTechniqueFor,
  type SeoDatasetId,
  type SourceAgencyId,
  sourceAgenciesFor,
  variableMeasuredFor,
} from "./datasetVocabulary";
import { seoMessage } from "./strings";

export type BreadcrumbItem = {
  name: string;
  path: `/${string}` | "/";
};

export type DatasetJsonLdInput = SourceCreditInput & {
  locale: Locale;
  origin: string;
  path: `/methodology/${string}` | `/en/methodology/${string}`;
  datasetId: SeoDatasetId;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  /** Null for a dataset with no bulk file: its node then claims no distribution. */
  downloadPath: `/downloads/data/${string}.csv` | null;
  /** Measures the published catalogue says this entity does not carry. */
  omitMeasures?: readonly Measure[];
  /** Published JSON companions to the CSV, in the order they should be listed. */
  jsonDownloadPaths?: readonly `/downloads/data/${string}.json`[];
};

/** Fiscal.ge is the creator of every dataset it compiles; the official producers it reads from are credited here. */
type SourceCreditInput = {
  /** The official producers this page's figures come from, when they differ from its dataset's (`TOPIC_DATASETS`). */
  sources?: readonly SourceAgencyId[];
  /** Also name the producers as `provider`, for a page that has always credited them that way. */
  creditSourcesAsProvider?: boolean;
  /** The source files the figures were read from, listed after the producers. */
  isBasedOn?: readonly string[];
};

export type ExplorerDatasetJsonLdInput = SourceCreditInput & {
  locale: Locale;
  origin: string;
  path: `/${string}`;
  datasetId: SeoDatasetId;
  name: string;
  description: string;
  /** A year, or a `YYYY-MM` month for a monthly dataset. */
  firstYear: number | string;
  lastYear: number | string;
  dateModified: string;
  /** The place the data covers; Georgia when left out. */
  spatialCoverageName?: string;
  downloadPath?: `/downloads/data/${string}.csv`;
  /**
   * Set on an entity page whose data is a slice of a larger published dataset.
   * A subset belongs to its parent, not directly to the catalog, so this and
   * `includedInDataCatalog` are mutually exclusive.
   */
  partOf?: { path: `/${string}`; name: string; description: string };
  /** Set on the parent dataset to name the subsets it is made of. */
  hasParts?: readonly { path: `/${string}`; name: string; description: string }[];
  /** True when spatialCoverageName is a place inside Georgia, not the country. */
  withinGeorgia?: boolean;
  /** Measures the published catalogue says this entity does not carry. */
  omitMeasures?: readonly Measure[];
  /**
   * The methodology page describing this same dataset, where one exists. The
   * pair carries a Dataset node each for one dataset, so naming the canonical
   * description page keeps a consumer from having to guess which is which.
   */
  sameAsPath?: `/methodology/${string}`;
  /**
   * The names of the series the page shows. A dataset with query-layer measures takes them from the vocabulary
   * instead; a topic dataset (`TopicDatasetId`) names its series here or claims none.
   */
  variableMeasured?: readonly string[];
};

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
}

/**
 * A node's `@id` follows the page's language, as its `url`, `name` and
 * `description` do: the Georgian and English pages describe one dataset in two
 * documents, and one `@id` carrying two names and two URLs would be merged or
 * dropped by a consumer. An explorer page carries other content beside its
 * Dataset, so its node takes a fragment; a methodology page's node is the page.
 */
function localizedUrl(origin: string, path: string, locale: Locale): string {
  return absoluteUrl(origin, pageHref(path, locale));
}

function explorerDatasetId(origin: string, path: string, locale: Locale): string {
  return `${localizedUrl(origin, path, locale)}#dataset`;
}

function catalogId(origin: string, locale: Locale): string {
  return `${localizedUrl(origin, "/methodology", locale)}#catalog`;
}

/**
 * The catalog node is rendered on /methodology only, so a reference to it from
 * any other page has to describe itself: a bare `@id` resolves to a node with
 * no `@type` for a validator reading a single page in isolation.
 */
export function catalogReference(origin: string, locale: Locale) {
  return {
    "@type": "DataCatalog",
    "@id": catalogId(origin, locale),
    name: seoMessage(locale, "seo.catalogName"),
    url: localizedUrl(origin, "/methodology", locale),
  };
}

/**
 * The Google-recommended Dataset properties that describe the data rather than
 * the page: what it measures, what it is found by, how it was obtained, and
 * that reading it costs nothing.
 */
function datasetVocabulary(
  datasetId: SeoDatasetId,
  locale: Locale,
  omitMeasures?: readonly Measure[],
  pageMeasures?: readonly string[],
) {
  const variableMeasured = pageMeasures ?? (isFiscalDatasetId(datasetId) ? variableMeasuredFor(datasetId, locale, omitMeasures) : null);
  return {
    keywords: keywordsFor(datasetId, locale),
    ...(variableMeasured ? { variableMeasured } : {}),
    measurementTechnique: measurementTechniqueFor(datasetId, locale),
    isAccessibleForFree: true,
  };
}

/** `isBasedOn` (and `provider` where asked) naming the official producers, then any source files. */
function sourceCredit(datasetId: SeoDatasetId, locale: Locale, input: SourceCreditInput) {
  const agencies = sourceAgenciesFor(datasetId, locale, input.sources);
  const isBasedOn = [...agencies, ...(input.isBasedOn ?? [])];
  return {
    ...(isBasedOn.length > 0 ? { isBasedOn } : {}),
    ...(input.creditSourcesAsProvider && agencies.length > 0 ? { provider: agencies.length === 1 ? agencies[0] : agencies } : {}),
  };
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function siteJsonLd(origin: string, locale: Locale = "ka") {
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
          availableLanguage: ["ka", "en"],
        },
        description: seoMessage(locale, "seo.organizationDescription"),
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
        inLanguage: ["ka", "en"],
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
  datasetPaths: readonly (`/methodology/${string}` | `/en/methodology/${string}`)[],
  locale: Locale = "ka",
  explorerDatasetPaths: readonly `/${string}`[] = [],
) {
  return {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": catalogId(origin, locale),
    name: seoMessage(locale, "seo.catalogName"),
    description: seoMessage(locale, "seo.catalogDescription"),
    url: localizedUrl(origin, "/methodology", locale),
    inLanguage: ["ka", "en"],
    publisher: { "@id": `${origin}/#organization` },
    dataset: [
      // A methodology dataset is identified by its page URL; an explorer
      // dataset shares its page with other content and carries a fragment.
      ...datasetPaths.map((path) => ({ "@id": localizedUrl(origin, path, locale) })),
      ...explorerDatasetPaths.map((path) => ({ "@id": explorerDatasetId(origin, path, locale) })),
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
    "@id": localizedUrl(input.origin, input.path, input.locale),
    name: input.name,
    description: input.description,
    url: localizedUrl(input.origin, input.path, input.locale),
    inLanguage: ["ka", "en"],
    temporalCoverage: `${input.firstYear}/${input.lastYear}`,
    spatialCoverage: { "@type": "Place", name: seoMessage(input.locale, "seo.country") },
    dateModified: input.dateModified,
    creator: { "@id": `${input.origin}/#organization` },
    publisher: { "@id": `${input.origin}/#organization` },
    includedInDataCatalog: catalogReference(input.origin, input.locale),
    license: "https://creativecommons.org/licenses/by/4.0/",
    ...datasetVocabulary(input.datasetId, input.locale, input.omitMeasures),
    ...sourceCredit(input.datasetId, input.locale, input),
    ...(input.downloadPath === null ? {} : {
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
          inLanguage: ["ka", "en"],
          contentUrl: absoluteUrl(input.origin, jsonPath),
        })),
      ],
    }),
  };
}

export function explorerDatasetJsonLd(input: ExplorerDatasetJsonLdInput) {
  if (input.description.length < 50) {
    throw new Error("Dataset description must contain at least 50 characters");
  }
  const url = localizedUrl(input.origin, input.path, input.locale);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": explorerDatasetId(input.origin, input.path, input.locale),
    name: input.name,
    description: input.description,
    url,
    inLanguage: ["ka", "en"],
    temporalCoverage: `${input.firstYear}/${input.lastYear}`,
    spatialCoverage: {
      "@type": "Place",
      name: input.spatialCoverageName ?? seoMessage(input.locale, "seo.country"),
      // Naming the country a municipality or region sits in is the only
      // geography we can state truthfully: the repository's map geometry is
      // SVG path data in a projected viewBox, not the WGS84 latitude and
      // longitude a schema.org GeoShape box would require.
      ...(input.withinGeorgia
        ? {
            containedInPlace: {
              "@type": "Country",
              name: seoMessage(input.locale, "seo.country"),
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
    ...datasetVocabulary(input.datasetId, input.locale, input.omitMeasures, input.variableMeasured),
    ...sourceCredit(input.datasetId, input.locale, input),
    ...(input.sameAsPath
      ? { sameAs: localizedUrl(input.origin, input.sameAsPath, input.locale) }
      : {}),
    // A subset is reachable from the catalog through its parent, so it claims
    // one relationship or the other and never both.
    ...(input.partOf
      ? {
          isPartOf: {
            "@type": "Dataset",
            "@id": explorerDatasetId(input.origin, input.partOf.path, input.locale),
            url: localizedUrl(input.origin, input.partOf.path, input.locale),
            name: input.partOf.name,
            description: input.partOf.description,
            license: "https://creativecommons.org/licenses/by/4.0/",
            creator: { "@type": "Organization", "@id": `${input.origin}/#organization`, name: "Fiscal.ge" },
          },
        }
      : { includedInDataCatalog: catalogReference(input.origin, input.locale) }),
    ...(input.hasParts
      ? {
          hasPart: input.hasParts.map((part) => ({
            "@type": "Dataset",
            "@id": explorerDatasetId(input.origin, part.path, input.locale),
            url: localizedUrl(input.origin, part.path, input.locale),
            name: part.name,
            description: part.description,
            license: "https://creativecommons.org/licenses/by/4.0/",
            creator: { "@type": "Organization", "@id": `${input.origin}/#organization`, name: "Fiscal.ge" },
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
