import path from "node:path";
import { isValidElement, type ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { JsonLd } from "../../components/seo/json-ld";
import { appRoutes, routeFor } from "../helpers/appRoutes";
import { DEMOGRAPHY_HUB_PATH } from "../../lib/explorer/demographyRoutes";
import { pageHref, splitLanguagePath } from "../../lib/i18n/routes";
import { NAV_TREE, openHub } from "../../lib/navigation/navTree";
import { isTopicDatasetId } from "../../lib/seo/datasetVocabulary";
import sitemap from "../../lib/seo/sitemap";
import {
  breadcrumbJsonLd,
  dataCatalogJsonLd,
  datasetJsonLd,
  explorerDatasetJsonLd,
  serializeJsonLd,
  siteJsonLd,
} from "../../lib/seo/structuredData";

// Rendering a methodology page reads the archive report that only `prebuild` writes; see the helper.
vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) =>
  (await import("../helpers/archive-summaries")).withValidatedArchiveSummaries(importOriginal));

describe("Fiscal.ge structured data", () => {
  it("links the website to the Fiscal.ge publisher", () => {
    const graph = siteJsonLd("https://fiscal.ge");
    expect(graph["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "Organization",
          "@id": "https://fiscal.ge/#organization",
        }),
        expect.objectContaining({
          "@type": "WebSite",
          "@id": "https://fiscal.ge/#website",
          inLanguage: ["ka", "en"],
        }),
      ]),
    );
    const organization = graph["@graph"].find((node) => node["@type"] === "Organization");
    if (!organization) {
      throw new Error("Organization node is required");
    }
    expect(organization).toMatchObject({
      name: "Fiscal.ge",
      url: "https://fiscal.ge",
      email: "info@fiscal.ge",
      description:
        "Fiscal.ge საქართველოს საჯარო ფინანსებისა და ეკონომიკის გადამოწმებულ ოფიციალურ მონაცემებს ქართულად და ინგლისურად აქვეყნებს.",
      logo: {
        "@type": "ImageObject",
        url: "https://fiscal.ge/fiscal-ge-logo.svg",
        width: 520,
        height: 650,
      },
    });
    expect(organization.contactPoint).toEqual({
      "@type": "ContactPoint",
      email: "info@fiscal.ge",
      contactType: "general inquiries",
      availableLanguage: ["ka", "en"],
    });
    expect(organization).not.toHaveProperty("address");
    expect(organization).not.toHaveProperty("telephone");
    expect(organization).not.toHaveProperty("sameAs");
    expect(serializeJsonLd(graph)).not.toContain("sameAs");
    expect(serializeJsonLd(graph)).not.toContain("SearchAction");
  });

  it("describes stable explorer downloads with stable dataset ids", () => {
    const data = explorerDatasetJsonLd({ locale: "ka",
      origin: "https://fiscal.ge",
      path: "/explorer/expenditure",
      datasetId: "national-expenditure",
      name: "საქართველოს სახელმწიფო ბიუჯეტის ხარჯები",
      description:
        "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯების გადამოწმებული მრავალწლიანი მონაცემები სფეროების მიხედვით.",
      firstYear: 2004,
      lastYear: 2025,
      dateModified: "2026-08-20",
      spatialCoverageName: "საქართველო",
      downloadPath: "/downloads/data/national-expenditure.csv",
    });
    expect(JSON.parse(serializeJsonLd(data))).toMatchObject({
      "@type": "Dataset",
      "@id": "https://fiscal.ge/explorer/expenditure#dataset",
      url: "https://fiscal.ge/explorer/expenditure",
      creator: { "@id": "https://fiscal.ge/#organization" },
      publisher: { "@id": "https://fiscal.ge/#organization" },
      temporalCoverage: "2004/2025",
      spatialCoverage: { "@type": "Place", name: "საქართველო" },
      distribution: [
        expect.objectContaining({
          contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.csv",
        }),
      ],
    });
  });

  it("omits distribution from client-generated entity datasets", () => {
    const data = explorerDatasetJsonLd({ locale: "ka",
      origin: "https://fiscal.ge",
      path: "/explorer/municipalities/tbilisi",
      datasetId: "municipal-expenditure",
      partOf: {
        path: "/explorer/municipalities",
        name: "საქართველოს მუნიციპალიტეტების ბიუჯეტები",
        description: "საქართველოს მუნიციპალიტეტების ფაქტობრივი ბიუჯეტები ფუნქციების მიხედვით, 2015–2025.",
      },
      name: "ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი",
      description:
        "ქალაქ თბილისის მუნიციპალიტეტის ფაქტობრივი ბიუჯეტის გადამოწმებული მრავალწლიანი მონაცემები ფუნქციების მიხედვით.",
      firstYear: 2015,
      lastYear: 2025,
      dateModified: "2026-08-16",
      spatialCoverageName: "ქალაქ თბილისის მუნიციპალიტეტი",
    });
    expect(JSON.parse(serializeJsonLd(data))).toMatchObject({
      "@id": "https://fiscal.ge/explorer/municipalities/tbilisi#dataset",
    });
    expect(data).not.toHaveProperty("distribution");
  });

  it("uses absolute ordered breadcrumb URLs", () => {
    const data = breadcrumbJsonLd("https://fiscal.ge", [
      { name: "მთავარი", path: "/" },
      { name: "ბიუჯეტი", path: "/explorer" },
    ]);
    expect(data.itemListElement).toEqual([
      expect.objectContaining({ position: 1, item: "https://fiscal.ge/" }),
      expect.objectContaining({ position: 2, item: "https://fiscal.ge/explorer" }),
    ]);
  });

  it("describes a downloadable CC BY 4.0 dataset", () => {
    const data = datasetJsonLd({ locale: "ka",
      origin: "https://fiscal.ge",
      path: "/methodology/expenditure",
      datasetId: "national-expenditure",
      name: "საქართველოს სახელმწიფო ბიუჯეტის ხარჯები",
      description:
        "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯების გადამოწმებული მრავალწლიანი მონაცემები სფეროების მიხედვით.",
      firstYear: 2004,
      lastYear: 2025,
      dateModified: "2026-08-20",
      downloadPath: "/downloads/data/national-expenditure.csv",
    });
    expect(data).toMatchObject({
      "@type": "Dataset",
      temporalCoverage: "2004/2025",
      license: "https://creativecommons.org/licenses/by/4.0/",
      distribution: [
        expect.objectContaining({
          "@type": "DataDownload",
          encodingFormat: "text/csv",
          contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.csv",
        }),
      ],
    });
  });

  it("lists the three public methodology datasets in the catalog", () => {
    const data = dataCatalogJsonLd("https://fiscal.ge", [
      "/methodology/expenditure",
      "/methodology/revenue",
      "/methodology/municipalities",
    ]);
    expect(data.dataset).toEqual([
      { "@id": "https://fiscal.ge/methodology/expenditure" },
      { "@id": "https://fiscal.ge/methodology/revenue" },
      { "@id": "https://fiscal.ge/methodology/municipalities" },
    ]);
  });

  it("rejects dataset descriptions too short for Google's dataset contract", () => {
    expect(() =>
      datasetJsonLd({
        locale: "ka",
        origin: "https://fiscal.ge",
        path: "/methodology/revenue",
        datasetId: "national-revenue",
        name: "შემოსავლები",
        description: "მოკლე აღწერა",
        firstYear: 2004,
        lastYear: 2025,
        dateModified: "2026-08-20",
        downloadPath: "/downloads/data/national-revenue.csv",
      }),
    ).toThrow(/50 characters/i);
  });

  it("escapes literal less-than characters in JSON-LD scripts", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
  });
});

describe("Dataset distributions describe every published format", () => {
  it("adds a JSON DataDownload beside the CSV", () => {
    const jsonLd = datasetJsonLd({ locale: "ka",
      origin: "https://fiscal.ge",
      path: "/methodology/expenditure",
      datasetId: "national-expenditure",
      name: "sakhelmtsifo biujetis kharjebi",
      description:
        "Annual national expenditure of the Georgian state budget, prepared from reviewed official sources.",
      firstYear: 2004,
      lastYear: 2025,
      dateModified: "2026-09-02",
      downloadPath: "/downloads/data/national-expenditure.csv",
      jsonDownloadPaths: ["/downloads/data/national-expenditure.json", "/downloads/data/ministries.json"],
    });

    expect((jsonLd as { distribution: unknown[] }).distribution).toEqual([
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.csv",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        inLanguage: ["ka", "en"],
        contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.json",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        inLanguage: ["ka", "en"],
        contentUrl: "https://fiscal.ge/downloads/data/ministries.json",
      },
    ]);
  });

  it("keeps the CSV-only shape when no JSON is published", () => {
    const jsonLd = datasetJsonLd({ locale: "ka",
      origin: "https://fiscal.ge",
      path: "/methodology/revenue",
      datasetId: "national-revenue",
      name: "sakhelmtsifo biujetis shemosavlebi",
      description: "Annual national revenue of the Georgian state budget, prepared from reviewed official sources.",
      firstYear: 2005,
      lastYear: 2025,
      dateModified: "2026-09-02",
      downloadPath: "/downloads/data/national-revenue.csv",
    });

    expect((jsonLd as { distribution: unknown[] }).distribution).toHaveLength(1);
  });
});

describe("Dataset records carry the full Google Dataset property set", () => {
  const municipalParent = {
    locale: "ka" as const,
    origin: "https://fiscal.ge",
    path: "/explorer/municipalities" as const,
    datasetId: "municipal-expenditure" as const,
    name: "საქართველოს მუნიციპალიტეტების ბიუჯეტები",
    description:
      "საქართველოს მუნიციპალიტეტების ფაქტობრივი ბიუჯეტები ფუნქციების მიხედვით, გადამოწმებული წლიური მონაცემები.",
    firstYear: 2015,
    lastYear: 2025,
    dateModified: "2026-08-20",
    spatialCoverageName: "საქართველო",
    downloadPath: "/downloads/data/municipal-expenditure.csv" as const,
  };

  const tbilisiSubset = {
    locale: "ka" as const,
    origin: "https://fiscal.ge",
    path: "/explorer/municipalities/tbilisi" as const,
    datasetId: "municipal-expenditure" as const,
    name: "ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი",
    description:
      "ქალაქ თბილისის მუნიციპალიტეტის ფაქტობრივი ბიუჯეტის გადამოწმებული მრავალწლიანი მონაცემები ფუნქციების მიხედვით.",
    firstYear: 2015,
    lastYear: 2025,
    dateModified: "2026-08-16",
    spatialCoverageName: "ქალაქ თბილისის მუნიციპალიტეტი",
    partOf: {
      path: "/explorer/municipalities" as const,
      name: municipalParent.name,
      description: municipalParent.description,
    },
    withinGeorgia: true,
  };

  it("files a top-level explorer dataset in the catalog rather than in a parent", () => {
    const data = explorerDatasetJsonLd(municipalParent);
    expect(data).toMatchObject({
      includedInDataCatalog: { "@id": "https://fiscal.ge/methodology#catalog" },
    });
    expect(data).not.toHaveProperty("isPartOf");
  });

  it("files an entity subset in its parent dataset rather than in the catalog", () => {
    const data = explorerDatasetJsonLd(tbilisiSubset);
    expect(data).toMatchObject({
      isPartOf: { "@id": "https://fiscal.ge/explorer/municipalities#dataset" },
    });
    expect(data).not.toHaveProperty("includedInDataCatalog");
    expect(data).not.toHaveProperty("distribution");
  });

  it.each(["ka", "en"] as const)("describes parent subsets as complete Dataset objects in %s", (locale) => {
    const data = explorerDatasetJsonLd({
      ...municipalParent,
      locale,
      hasParts: [{ path: "/explorer/municipalities/tbilisi", name: "Tbilisi budget", description: tbilisiSubset.description }],
    });
    expect(data).toMatchObject({
      hasPart: [{
        "@type": "Dataset",
        "@id": `https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/municipalities/tbilisi#dataset`,
        url: `https://fiscal.ge${locale === "en" ? "/en" : ""}/explorer/municipalities/tbilisi`,
        name: "Tbilisi budget",
        description: tbilisiSubset.description,
        license: "https://creativecommons.org/licenses/by/4.0/",
        creator: { "@type": "Organization", name: "Fiscal.ge" },
      }],
    });
    expect(data.hasPart?.[0]).not.toHaveProperty("distribution");
  });

  it("states that every published dataset is free to access", () => {
    expect(explorerDatasetJsonLd(municipalParent)).toMatchObject({ isAccessibleForFree: true });
    expect(explorerDatasetJsonLd(tbilisiSubset)).toMatchObject({ isAccessibleForFree: true });
    expect(
      datasetJsonLd({
        locale: "ka" as const,
    origin: "https://fiscal.ge",
        path: "/methodology/expenditure",
        datasetId: "national-expenditure",
        name: "საქართველოს სახელმწიფო ბიუჯეტის ხარჯები",
        description:
          "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯების გადამოწმებული მრავალწლიანი მონაცემები სფეროების მიხედვით.",
        firstYear: 2004,
        lastYear: 2025,
        dateModified: "2026-08-20",
        downloadPath: "/downloads/data/national-expenditure.csv",
      }),
    ).toMatchObject({ isAccessibleForFree: true });
  });

  it("names the measures a dataset publishes, with their units", () => {
    const data = explorerDatasetJsonLd(municipalParent) as unknown as {
      variableMeasured: {
        "@type": string;
        propertyID: string;
        name: string;
        description: string;
        unitText: string;
      }[];
    };
    expect(data.variableMeasured.map((measure) => measure.propertyID)).toEqual([
      "amount_gel",
      "share_of_total_pct",
      "gel_per_resident",
    ]);
    expect(data.variableMeasured.every((measure) => measure["@type"] === "PropertyValue")).toBe(true);
    expect(data.variableMeasured[0]).toMatchObject({ unitText: "GEL" });
    expect(data.variableMeasured[1]).toMatchObject({ unitText: "%" });
    expect(data.variableMeasured.every((measure) => measure.description.length > 0)).toBe(true);
  });

  it("gives a subset the same measures as the dataset it belongs to", () => {
    const parent = explorerDatasetJsonLd(municipalParent) as unknown as { variableMeasured: unknown };
    const subset = explorerDatasetJsonLd(tbilisiSubset) as unknown as { variableMeasured: unknown };
    expect(subset.variableMeasured).toEqual(parent.variableMeasured);
  });

  it("keeps every published string in the page's own language", () => {
    // bilingual-seo.spec.ts forbids Georgian anywhere on an English page,
    // JSON-LD included, so the vocabulary is localized rather than shared.
    const georgian = /[Ⴀ-ჿ]/;
    const ka = explorerDatasetJsonLd(municipalParent) as unknown as {
      keywords: string[];
      measurementTechnique: string;
      variableMeasured: { name: string }[];
    };
    expect(ka.keywords).toContain("მუნიციპალიტეტი");

    const en = explorerDatasetJsonLd({ ...municipalParent, locale: "en" }) as unknown as {
      keywords: string[];
      measurementTechnique: string;
      variableMeasured: { name: string }[];
    };
    expect(en.keywords).toContain("municipal budget");
    expect(en.keywords.some((keyword) => georgian.test(keyword))).toBe(false);
    expect(georgian.test(en.measurementTechnique)).toBe(false);
    expect(en.variableMeasured.some((measure) => georgian.test(measure.name))).toBe(false);
  });

  it("records how the figures were obtained", () => {
    expect(explorerDatasetJsonLd(municipalParent)).toMatchObject({
      measurementTechnique: expect.stringContaining("გადამოწმებულ"),
    });
  });

  it("places a municipality inside Georgia and leaves the country scope alone", () => {
    expect(explorerDatasetJsonLd(tbilisiSubset)).toMatchObject({
      spatialCoverage: {
        "@type": "Place",
        name: "ქალაქ თბილისის მუნიციპალიტეტი",
        containedInPlace: {
          "@type": "Country",
          name: "საქართველო",
          identifier: {
            "@type": "PropertyValue",
            propertyID: "ISO 3166-1 alpha-2",
            value: "GE",
          },
        },
      },
    });
    expect(
      (explorerDatasetJsonLd(municipalParent) as unknown as { spatialCoverage: object })
        .spatialCoverage,
    ).not.toHaveProperty("containedInPlace");
  });

  it("lists every top-level dataset in the catalog, in each one's own id form", () => {
    const data = dataCatalogJsonLd("https://fiscal.ge", [
      "/methodology/expenditure",
      "/methodology/revenue",
      "/methodology/municipalities",
      "/methodology/debt",
    ], "ka", [
      "/explorer/expenditure",
      "/explorer/revenue",
      "/explorer/debt",
      "/explorer/deficit",
      "/explorer/municipalities",
    ]);
    expect(data.dataset).toEqual([
      { "@id": "https://fiscal.ge/methodology/expenditure" },
      { "@id": "https://fiscal.ge/methodology/revenue" },
      { "@id": "https://fiscal.ge/methodology/municipalities" },
      { "@id": "https://fiscal.ge/methodology/debt" },
      { "@id": "https://fiscal.ge/explorer/expenditure#dataset" },
      { "@id": "https://fiscal.ge/explorer/revenue#dataset" },
      { "@id": "https://fiscal.ge/explorer/debt#dataset" },
      { "@id": "https://fiscal.ge/explorer/deficit#dataset" },
      { "@id": "https://fiscal.ge/explorer/municipalities#dataset" },
    ]);
  });

  it("gives every dataset exactly one home, never both and never neither", () => {
    const homes = (node: object) =>
      ["includedInDataCatalog", "isPartOf"].filter((key) => key in node);
    expect(homes(explorerDatasetJsonLd(municipalParent))).toEqual(["includedInDataCatalog"]);
    expect(homes(explorerDatasetJsonLd(tbilisiSubset))).toEqual(["isPartOf"]);
    expect(
      homes(
        datasetJsonLd({
          locale: "ka" as const,
    origin: "https://fiscal.ge",
          path: "/methodology/debt",
          datasetId: "government-debt",
          name: "სახელმწიფო ვალი",
          description:
            "საქართველოს მთავრობის ვალის მოცულობა, ვალის მომსახურება და საპროცენტო განაკვეთები, გადამოწმებული წლიური მონაცემები.",
          firstYear: 2013,
          lastYear: 2030,
          dateModified: "2026-08-20",
          downloadPath: "/downloads/data/government-debt.csv",
        }),
      ),
    ).toEqual(["includedInDataCatalog"]);
  });

  it("drops a measure the published catalogue says an entity does not carry", () => {
    // catalogue.json measureNotes: gel_per_resident is "not for the country aggregate".
    const data = explorerDatasetJsonLd({
      ...tbilisiSubset,
      path: "/explorer/municipalities/georgia",
      spatialCoverageName: "საქართველო",
      withinGeorgia: false,
      omitMeasures: ["gel_per_resident"],
    }) as unknown as { variableMeasured: { propertyID: string }[] };
    expect(data.variableMeasured.map((measure) => measure.propertyID)).toEqual([
      "amount_gel",
      "share_of_total_pct",
    ]);
  });

  it("labels a measure for people and keeps the machine id in propertyID", () => {
    const data = explorerDatasetJsonLd(municipalParent) as unknown as {
      variableMeasured: { propertyID: string; name: string; unitText: string }[];
    };
    expect(data.variableMeasured[0]).toMatchObject({
      "@type": "PropertyValue",
      propertyID: "amount_gel",
      unitText: "GEL",
    });
    // The label is what Dataset Search shows, so it is Georgian like the rest.
    expect(data.variableMeasured[0].name).not.toBe("amount_gel");
    expect(/[Ⴀ-ჿ]/.test(data.variableMeasured[0].name)).toBe(true);
  });

  it("completes the parent Dataset so one page is valid on its own", () => {
    expect(explorerDatasetJsonLd(tbilisiSubset)).toMatchObject({
      isPartOf: {
        "@type": "Dataset",
        "@id": "https://fiscal.ge/explorer/municipalities#dataset",
        url: "https://fiscal.ge/explorer/municipalities",
        name: "საქართველოს მუნიციპალიტეტების ბიუჯეტები",
        description: "საქართველოს მუნიციპალიტეტების ფაქტობრივი ბიუჯეტები ფუნქციების მიხედვით, გადამოწმებული წლიური მონაცემები.",
        license: "https://creativecommons.org/licenses/by/4.0/",
        creator: { "@type": "Organization", "@id": "https://fiscal.ge/#organization", name: "Fiscal.ge" },
      },
    });
    expect(explorerDatasetJsonLd(municipalParent)).toMatchObject({
      includedInDataCatalog: {
        "@type": "DataCatalog",
        "@id": "https://fiscal.ge/methodology#catalog",
        name: expect.any(String),
        url: "https://fiscal.ge/methodology",
      },
    });
  });

  it("says which scheme the country identifier belongs to", () => {
    expect(explorerDatasetJsonLd(tbilisiSubset)).toMatchObject({
      spatialCoverage: {
        containedInPlace: {
          "@type": "Country",
          name: "საქართველო",
          identifier: {
            "@type": "PropertyValue",
            propertyID: "ISO 3166-1 alpha-2",
            value: "GE",
          },
        },
      },
    });
  });

  it("anchors a twinned explorer dataset to its methodology page", () => {
    // /explorer/expenditure and /methodology/expenditure describe ONE dataset from
    // two pages. sameAs names the canonical description page so a consumer does not
    // have to guess which of the two is the dataset's identity.
    expect(
      explorerDatasetJsonLd({
        ...municipalParent,
        path: "/explorer/expenditure",
        datasetId: "national-expenditure",
        sameAsPath: "/methodology/expenditure",
      }),
    ).toMatchObject({ sameAs: "https://fiscal.ge/methodology/expenditure" });
  });

  it("leaves a dataset with no methodology page unanchored", () => {
    expect(explorerDatasetJsonLd(municipalParent)).not.toHaveProperty("sameAs");
  });

  it("names Fiscal.ge as publisher of the methodology datasets too", () => {
    expect(
      datasetJsonLd({
        locale: "ka" as const,
    origin: "https://fiscal.ge",
        path: "/methodology/municipalities",
        datasetId: "municipal-expenditure",
        name: "მუნიციპალიტეტების ბიუჯეტები",
        description:
          "საქართველოს მუნიციპალიტეტების ფაქტობრივი ბიუჯეტები ფუნქციების მიხედვით, გადამოწმებული წლიური მონაცემები.",
        firstYear: 2015,
        lastYear: 2025,
        dateModified: "2026-08-20",
        downloadPath: "/downloads/data/municipal-expenditure.csv",
      }),
    ).toMatchObject({ publisher: { "@id": "https://fiscal.ge/#organization" } });
  });
});

/** The data of every JsonLd element in a rendered page tree, wherever a page module placed it. */
function jsonLdNodes(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(jsonLdNodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  if (node.type === JsonLd) return [node.props.data as Record<string, unknown>];
  return Object.values(node.props).flatMap(jsonLdNodes);
}

describe("Dataset nodes per language and without a bulk file", () => {
  const unemployment = {
    origin: "https://fiscal.ge",
    datasetId: "unemployment" as const,
    name: "Unemployment",
    description: "Annual unemployment, employment and labour-force figures for Georgia from Geostat.",
    firstYear: 2010,
    lastYear: 2025,
    dateModified: "2026-10-03",
    downloadPath: null,
  };

  it("claims no distribution for a methodology dataset with no bulk file", () => {
    const data = datasetJsonLd({ ...unemployment, locale: "en", path: "/en/methodology/unemployment" });
    expect(data).not.toHaveProperty("distribution");
    expect(data).not.toHaveProperty("variableMeasured");
    expect(data).toMatchObject({ "@id": "https://fiscal.ge/en/methodology/unemployment", license: "https://creativecommons.org/licenses/by/4.0/" });
  });

  it("names a topic dataset's series from the page and keys every related node by the page's language", () => {
    const data = explorerDatasetJsonLd({ ...unemployment, locale: "en", path: "/explorer/unemployment/overview", downloadPath: undefined, variableMeasured: ["Unemployment rate"] });
    expect(data).toMatchObject({
      "@id": "https://fiscal.ge/en/explorer/unemployment/overview#dataset",
      variableMeasured: ["Unemployment rate"],
      spatialCoverage: { name: "Georgia" },
      includedInDataCatalog: { "@id": "https://fiscal.ge/en/methodology#catalog", url: "https://fiscal.ge/en/methodology" },
    });
    expect(dataCatalogJsonLd("https://fiscal.ge", ["/en/methodology/unemployment"], "en", ["/explorer/debt"])).toMatchObject({
      "@id": "https://fiscal.ge/en/methodology#catalog",
      dataset: [{ "@id": "https://fiscal.ge/en/methodology/unemployment" }, { "@id": "https://fiscal.ge/en/explorer/debt#dataset" }],
    });
  });
});

describe("Dataset nodes credit the official producer beside Fiscal.ge", () => {
  const base = {
    locale: "en" as const, origin: "https://fiscal.ge", name: "Money supply",
    description: "Georgia's money supply, loans, deposits and interest rates from the National Bank of Georgia.",
    firstYear: 2000, lastYear: 2025, dateModified: "2026-10-01",
  };
  const geostat = { "@type": "Organization", name: "National Statistics Office of Georgia (Geostat)", url: "https://www.geostat.ge" };
  const nbg = { "@type": "Organization", name: "National Bank of Georgia", url: "https://nbg.gov.ge" };

  it("names the topic's producer, or the page's own when it differs, and keeps Fiscal.ge the creator", () => {
    const money = explorerDatasetJsonLd({ ...base, path: "/explorer/money/supply", datasetId: "money" });
    expect(money).toMatchObject({ creator: { "@id": "https://fiscal.ge/#organization" }, provider: nbg });
    expect(money).not.toHaveProperty("isBasedOn");
    expect(explorerDatasetJsonLd({ ...base, path: "/explorer/money/supply", datasetId: "money", sources: ["nbg", "geostat"] })).toMatchObject({ provider: [nbg, geostat] });
    expect(datasetJsonLd({ ...base, path: "/en/methodology/trade", datasetId: "trade", downloadPath: null })).toMatchObject({ provider: geostat });
    const ka = explorerDatasetJsonLd({ ...base, locale: "ka", path: "/explorer/trade/overview", datasetId: "trade" });
    expect(ka).toMatchObject({ provider: { name: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)" } });
  });

  it("keeps isBasedOn for the source files alone, beside the producer as provider", () => {
    expect(explorerDatasetJsonLd({
      ...base, path: "/explorer/inflation/products", datasetId: "inflation-products",
      isBasedOn: ["https://fiscal.ge/downloads/methodology/inflation/files/products-yoy.xlsx"],
    })).toMatchObject({ provider: geostat, isBasedOn: ["https://fiscal.ge/downloads/methodology/inflation/files/products-yoy.xlsx"] });
  });

  it("leaves the budget datasets, which name no statistics producer, as they were", () => {
    const debt = explorerDatasetJsonLd({ ...base, path: "/explorer/debt", datasetId: "government-debt" });
    expect(debt).not.toHaveProperty("provider");
    expect(debt).not.toHaveProperty("isBasedOn");
  });
});

describe("Dataset nodes across the sitemap", () => {
  beforeAll(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fiscal.ge"));
  afterAll(() => vi.unstubAllEnvs());

  // The pages with no Dataset of their own: the hubs (the navigation tree's hub rows), demography (spec section 10:
  // no Dataset markup yet), the single-year analysis view, the methodology catalog page and the site pages.
  const hubs = new Set<string>(NAV_TREE.map((hub) => hub.href));
  const carriesDataset = (page: string) =>
    (page.startsWith("/explorer/") || page.startsWith("/methodology/")) && !hubs.has(page) &&
    !page.startsWith(`${DEMOGRAPHY_HUB_PATH}/`) && page !== "/methodology/demography" && page !== "/explorer/analysis";
  // Official statistics read from Geostat or the NBG: every page outside the Budget and Economy hubs, and the
  // methodology article of each such dataset. Those name their producer beside Fiscal.ge, the creator.
  const creditsSource = (page: string) =>
    page.startsWith("/methodology/") ? isTopicDatasetId(page.slice("/methodology/".length)) : !["/explorer", "/explorer/economy"].includes(openHub(page).href);

  it("every explorer page's Dataset has license, creator and a per-language @id", async () => {
    const routes = appRoutes();
    const pathnames = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(new Set(pathnames.map((pathname) => splitLanguagePath(pathname).locale))).toEqual(new Set(["ka", "en"]));
    // Every sitemap URL must resolve to a route file. An explorer or methodology page is rendered when its route is static or a methodology
    // article; a dynamic route file (one per locale) is rendered for its first sitemap URL only, as the others share
    // its code. Every route family keeps a rendered page in both languages.
    const sampledFiles = new Set<string>();
    const rendered = pathnames.flatMap((pathname) => {
      const route = routeFor(routes, pathname);
      // The site pages (home, about, connect) are not explorer or methodology pages and carry no Dataset.
      if (!/^(\/en)?\/(explorer|methodology)(\/|$)/.test(pathname)) return [];
      const dynamic = Object.keys(route.params).length > 0 && !route.file.includes(`${path.sep}methodology${path.sep}`);
      if (dynamic && sampledFiles.has(route.file)) return [];
      sampledFiles.add(route.file);
      return [{ pathname, route }];
    });
    expect(new Set(rendered.map(({ route }) => route.file)).size).toBe(
      new Set(pathnames.filter((pathname) => /^(\/en)?\/(explorer|methodology)(\/|$)/.test(pathname)).map((pathname) => routeFor(routes, pathname).file)).size,
    );
    let checked = 0;
    for (const { pathname, route } of rendered) {
      const { locale, pathname: page } = splitLanguagePath(pathname);
      const pageModule = (await import(route.file)) as { default: (props: { params: Promise<Record<string, string>> }) => Promise<ReactNode> };
      const datasets = jsonLdNodes(await pageModule.default({ params: Promise.resolve(route.params) })).filter((node) => node["@type"] === "Dataset");
      expect(datasets, pathname).toHaveLength(carriesDataset(page) ? 1 : 0);
      for (const dataset of datasets) {
        const url = `https://fiscal.ge${pageHref(page, locale)}`;
        expect(dataset.url, pathname).toBe(url);
        // An explorer page carries other content beside its Dataset, so its node takes a fragment.
        expect(dataset["@id"], pathname).toBe(page.startsWith("/explorer/") ? `${url}#dataset` : url);
        expect(dataset.license, pathname).toBe("https://creativecommons.org/licenses/by/4.0/");
        // Fiscal.ge compiles the dataset; the official producer it reads from is credited beside it.
        expect(dataset.creator, pathname).toEqual({ "@id": "https://fiscal.ge/#organization" });
        if (creditsSource(page)) {
          const producers = [dataset.provider ?? []].flat();
          expect(producers.length, `${pathname} credits its source`).toBeGreaterThan(0);
          for (const producer of producers) expect(producer, pathname).toEqual({ "@type": "Organization", name: expect.any(String), url: expect.stringMatching(/^https:\/\/(www\.geostat\.ge|nbg\.gov\.ge|ssa\.moh\.gov\.ge|mof\.ge|www\.treasury\.ge|pensions\.ge)$/) });
        }
        expect(String(dataset.description).length, pathname).toBeGreaterThanOrEqual(50);
        // Every node it points at is the same language's: its parent, its subsets and the catalog.
        const related = [dataset.isPartOf, dataset.includedInDataCatalog, ...((dataset.hasPart as unknown[] | undefined) ?? [])]
          .filter(Boolean).map((node) => (node as { "@id": string })["@id"]);
        expect(related.length, pathname).toBeGreaterThan(0);
        for (const id of related) expect(splitLanguagePath(new URL(id).pathname).locale, `${pathname} → ${id}`).toBe(locale);
        if (locale === "en") expect(JSON.stringify(dataset), pathname).not.toMatch(/\p{Script=Georgian}/u);
        checked += 1;
      }
    }
    // Poverty and inequality (U20-14) are static routes, so both are rendered in both languages.
    for (const page of ["/explorer/living-standards/poverty", "/explorer/living-standards/inequality"]) {
      for (const locale of ["ka", "en"] as const) expect(rendered.map(({ pathname }) => pathname)).toContain(pageHref(page, locale));
    }
    expect(checked).toBeGreaterThan(80);
  }, 300_000);
});
