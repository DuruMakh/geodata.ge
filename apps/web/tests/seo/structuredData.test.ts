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
          inLanguage: "ka",
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
        "Fiscal.ge საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებულ მონაცემებს ქართულად აქვეყნებს.",
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
      availableLanguage: "ka",
    });
    expect(organization).not.toHaveProperty("address");
    expect(organization).not.toHaveProperty("telephone");
    expect(organization).not.toHaveProperty("sameAs");
    expect(serializeJsonLd(graph)).not.toContain("sameAs");
    expect(serializeJsonLd(graph)).not.toContain("SearchAction");
  });

  it("describes stable explorer downloads with stable dataset ids", () => {
    const data = explorerDatasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/explorer/expenditure",
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
    const data = explorerDatasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/explorer/municipalities/tbilisi",
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
    const data = datasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/methodology/expenditure",
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
        origin: "https://fiscal.ge",
        path: "/methodology/revenue",
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
    const jsonLd = datasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/methodology/expenditure",
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
        contentUrl: "https://fiscal.ge/downloads/data/national-expenditure.json",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: "https://fiscal.ge/downloads/data/ministries.json",
      },
    ]);
  });

  it("keeps the CSV-only shape when no JSON is published", () => {
    const jsonLd = datasetJsonLd({
      origin: "https://fiscal.ge",
      path: "/methodology/revenue",
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
