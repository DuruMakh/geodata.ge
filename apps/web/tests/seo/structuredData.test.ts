import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  dataCatalogJsonLd,
  datasetJsonLd,
  explorerDatasetJsonLd,
  serializeJsonLd,
  siteJsonLd,
} from "../../lib/seo/structuredData";

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
        "Fiscal.ge საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებულ მონაცემებს ქართულად და ინგლისურად აქვეყნებს.",
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
      partOfPath: "/explorer/municipalities",
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
    partOfPath: "/explorer/municipalities" as const,
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
        "@id": "https://fiscal.ge/explorer/municipalities/tbilisi#dataset",
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

  it("types the nodes it points at, so one page is readable on its own", () => {
    expect(explorerDatasetJsonLd(tbilisiSubset)).toMatchObject({
      isPartOf: {
        // @type and url make the reference self-describing; the parent's name is
        // locale-dependent and carries no message key, so it is left out rather
        // than hardcoded in one language.
        "@type": "Dataset",
        "@id": "https://fiscal.ge/explorer/municipalities#dataset",
        url: "https://fiscal.ge/explorer/municipalities",
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
