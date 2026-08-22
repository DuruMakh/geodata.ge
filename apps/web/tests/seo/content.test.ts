import { describe, expect, it } from "vitest";
import {
  analysisIntroduction,
  expenditureIntroduction,
  municipalityIntroduction,
  revenueIntroduction,
} from "../../lib/seo/content";

describe("Georgian SEO introductions", () => {
  it("states the expenditure subject, actual basis, and coverage", () => {
    const text = expenditureIntroduction({ firstYear: 2004, lastYear: 2025 });
    expect(text).toContain("საქართველოს ბიუჯეტის ხარჯები");
    expect(text).toContain("ფაქტობრივ");
    expect(text).toContain("2004–2025");
  });

  it("distinguishes revenue from expenditure", () => {
    const text = revenueIntroduction({ firstYear: 2004, lastYear: 2025 });
    expect(text).toContain("შემოსავლები");
    expect(text).toContain("გადასახადებს");
    expect(text).not.toContain("რაში იხარჯება");
  });

  it("uses the official municipality possessive form", () => {
    expect(
      municipalityIntroduction({
        nameKa: "ქალაქ თბილისის მუნიციპალიტეტი",
        firstYear: 2015,
        lastYear: 2025,
      }),
    ).toContain("ქალაქ თბილისის მუნიციპალიტეტის ბიუჯეტი");
  });

  it("describes national and municipal explorer downloads as the two-sheet Excel workbook", () => {
    const introductions = [
      expenditureIntroduction({ firstYear: 2004, lastYear: 2025 }),
      revenueIntroduction({ firstYear: 2004, lastYear: 2025 }),
      municipalityIntroduction({ nameKa: "ქალაქ თბილისის მუნიციპალიტეტი", firstYear: 2015, lastYear: 2025 }),
    ];

    for (const text of introductions) {
      expect(text).toContain("Excel");
      expect(text).toContain("მარტივი ცხრილი");
      expect(text).toContain("მონაცემები");
      expect(text).not.toContain("CSV");
    }
  });

  it("keeps core introductions concise enough for the analytical page", () => {
    const texts = [
      expenditureIntroduction({ firstYear: 2004, lastYear: 2025 }),
      revenueIntroduction({ firstYear: 2004, lastYear: 2025 }),
      analysisIntroduction(2025),
    ];
    expect(texts.every((text) => text.length >= 180 && text.length <= 900)).toBe(true);
  });
});
