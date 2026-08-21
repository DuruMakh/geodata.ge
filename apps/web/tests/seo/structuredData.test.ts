import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  dataCatalogJsonLd,
  datasetJsonLd,
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
