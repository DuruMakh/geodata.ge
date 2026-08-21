import { describe, expect, it } from "vitest";
import {
  coverageFromYears,
  fiscalMetadata,
  municipalityBudgetTitleKa,
} from "../../lib/seo/metadata";

describe("Fiscal.ge SEO metadata", () => {
  it("derives coverage without assuming input order", () => {
    expect(coverageFromYears([{ year: 2025 }, { year: 2004 }, { year: 2012 }])).toEqual({
      firstYear: 2004,
      lastYear: 2025,
    });
  });

  it("rejects empty coverage rather than publishing invented years", () => {
    expect(() => coverageFromYears([])).toThrow(/served year/i);
  });

  it("builds canonical, Open Graph, and large Twitter metadata", () => {
    const metadata = fiscalMetadata({
      title: "საქართველოს ბიუჯეტის ხარჯები 2004–2025 | Fiscal.ge",
      description:
        "საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯები სფეროებისა და უწყებების მიხედვით, 2004–2025.",
      path: "/explorer/expenditure",
    });

    expect(metadata.alternates?.canonical).toBe("/explorer/expenditure");
    expect(metadata.openGraph).toMatchObject({
      siteName: "Fiscal.ge",
      locale: "ka_GE",
      url: "/explorer/expenditure",
      images: [expect.objectContaining({ width: 1200, height: 630 })],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("uses the full official municipality name for possessive budget copy", () => {
    expect(municipalityBudgetTitleKa("ქალაქ თბილისის მუნიციპალიტეტი", 2015, 2025)).toBe(
      "ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი 2015–2025 | Fiscal.ge",
    );
  });

  it("rejects a short display label because its Georgian ending is not reviewed", () => {
    expect(() => municipalityBudgetTitleKa("თბილისი", 2015, 2025)).toThrow(/მუნიციპალიტეტი/);
  });
});
