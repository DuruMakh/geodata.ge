import { describe, expect, it } from "vitest";
import { validateCatalogue, validateMessages } from "../../lib/i18n/validation";
import type { EnglishCatalogue, TranslationInventory } from "../../lib/i18n/types";

const text = (value: string) => ({ text: value, reviewedAt: "2026-09-05" });
const catalogue: EnglishCatalogue = {
  labels: { "spending.education": text("Education") },
  programmeHistory: { "programme.education": { "2020": { ...text("General education"), originalKa: "ზოგადი განათლება" } } },
  sources: { "source.education": { name: text("Education budget"), derivation: null } },
  documents: { "document.education": { title: text("Annual report"), publisher: text("Ministry of Finance"), attribution: text("Credit the publisher"), documentLanguage: null } },
};
const inventory: TranslationInventory = {
  pagePaths: ["/"], labelIds: ["spending.education"], sourceIds: ["source.education"],
  documentIds: ["document.education"], derivedSourceIds: [], attributedDocumentIds: ["document.education"],
  programmeHistory: [{ seriesId: "programme.education", year: 2020, originalKa: "ზოგადი განათლება" }],
};

describe("translation inventory coverage", () => {
  it("accepts complete reviewed coverage without guessing a document language", () => {
    expect(validateCatalogue(catalogue, inventory)).toEqual([]);
  });

  it.each([
    ["labels", "spending.education"], ["sources", "source.education"], ["documents", "document.education"],
  ] as const)("identifies a missing %s record by stable ID", (section, id) => {
    const incomplete = structuredClone(catalogue);
    delete incomplete[section][id];
    expect(validateCatalogue(incomplete, inventory).join("\n")).toContain(id);
  });

  it("detects a missing historical year and changed original wording", () => {
    const incomplete = structuredClone(catalogue);
    delete incomplete.programmeHistory["programme.education"]["2020"];
    expect(validateCatalogue(incomplete, inventory).join("\n")).toContain("programme.education:2020");
    const stale = structuredClone(catalogue);
    stale.programmeHistory["programme.education"]["2020"].originalKa = "შეცვლილი დასახელება";
    expect(validateCatalogue(stale, inventory).join("\n")).toContain("programme.education:2020");
  });

  it("does not lose a derivation or attribution when translating", () => {
    expect(validateCatalogue(catalogue, { ...inventory, derivedSourceIds: ["source.education"] }).join("\n"))
      .toContain("derivation");
    const incomplete = structuredClone(catalogue);
    incomplete.documents["document.education"].attribution = null;
    expect(validateCatalogue(incomplete, inventory).join("\n")).toContain("attribution");
  });
});

describe("message parity", () => {
  it("allows translated ordering and repeated parameters without losing required values", () => {
    expect(validateMessages({ count: "{count} / {total}" }, { count: "Of {total}: {count} ({count})" })).toEqual([]);
  });

  it("finds missing, extra and blank messages", () => {
    const errors = validateMessages({ count: "{count}", title: "სათაური" }, { count: " ", extra: "Unexpected" });
    expect(errors.join("\n")).toContain("count");
    expect(errors.join("\n")).toContain("title");
    expect(errors.join("\n")).toContain("extra");
  });

  it("detects lost variables and unintended Georgian fallback in English messages", () => {
    expect(validateMessages({ count: "{count} / {total}" }, { count: "{count}" }).join("\n")).toContain("count");
    expect(validateMessages({ home: "მთავარი" }, { home: "მთავარი" }).join("\n")).toContain("home");
  });
});
