export type BreadcrumbItem = {
  name: string;
  path: `/${string}` | "/";
};

export type DatasetJsonLdInput = {
  origin: string;
  path: `/methodology/${string}`;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  downloadPath: `/downloads/data/${string}.csv`;
  /** Published JSON companions to the CSV, in the order they should be listed. */
  jsonDownloadPaths?: readonly `/downloads/data/${string}.json`[];
};

export type ExplorerDatasetJsonLdInput = {
  origin: string;
  path: `/${string}`;
  name: string;
  description: string;
  firstYear: number;
  lastYear: number;
  dateModified: string;
  spatialCoverageName: string;
  downloadPath?: `/downloads/data/${string}.csv`;
};

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
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

export function dataCatalogJsonLd(
  origin: string,
  datasetPaths: readonly `/methodology/${string}`[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": `${origin}/methodology#catalog`,
    name: "Fiscal.ge — ბიუჯეტის მონაცემები",
    description:
      "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემების კატალოგი.",
    url: `${origin}/methodology`,
    inLanguage: "ka",
    publisher: { "@id": `${origin}/#organization` },
    dataset: datasetPaths.map((path) => ({ "@id": absoluteUrl(origin, path) })),
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
    includedInDataCatalog: { "@id": `${input.origin}/methodology#catalog` },
    license: "https://creativecommons.org/licenses/by/4.0/",
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
    spatialCoverage: { "@type": "Place", name: input.spatialCoverageName },
    dateModified: input.dateModified,
    creator: { "@id": `${input.origin}/#organization` },
    publisher: { "@id": `${input.origin}/#organization` },
    license: "https://creativecommons.org/licenses/by/4.0/",
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
