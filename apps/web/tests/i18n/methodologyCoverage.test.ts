import { describe, expect, it } from "vitest";
import { getMethodologyContent, LIVE_METHODOLOGY_IDS } from "../../lib/methodology/catalog";
import type { MethodologyContent } from "../../lib/methodology/types";
import { validateMethodologyTranslation } from "../../lib/i18n/methodology";

function structure(content: MethodologyContent) {
  return {
    id: content.id, slug: content.slug, reviewedAt: content.reviewedAt,
    coverageSource: content.coverageSource, canonicalDocuments: content.canonicalDocuments,
    archiveManifestId: content.archiveManifestId,
    keyFacts: content.keyFacts.map(fact => fact.valueKind),
    sections: content.sections.map(section => [section.id, section.kind, section.paragraphs.length]),
    decisions: content.decisions.map(decision => [decision.id, decision.canonicalDecisionIds, decision.detail.length]),
    appendix: content.technicalAppendix.map(decision => [decision.id, decision.canonicalDecisionIds, decision.detail.length]),
    showTechnicalAppendix: content.showTechnicalAppendix,
  };
}

function groups(content: MethodologyContent) {
  const groups = new Map<string, string[]>();
  for (const decision of [...content.decisions, ...content.technicalAppendix]) groups.set(decision.group, [...(groups.get(decision.group) ?? []), decision.id]);
  return [...groups.values()].map(ids => ids.sort()).sort((a,b) => a[0].localeCompare(b[0]));
}

describe("complete methodology translations", () => {
  it("publishes the bilingual Regional economies methodology with its accounting boundaries", () => {
    expect(LIVE_METHODOLOGY_IDS).toContain("regional-economies");
    expect(LIVE_METHODOLOGY_IDS).toHaveLength(10);
    for (const locale of ["ka", "en"] as const) {
      const content = getMethodologyContent("regional-economies" as never, locale);
      const prose = [content.summary, content.disclosure, ...content.sections.flatMap((section) => section.paragraphs)].join(" ");
      expect(prose).toContain("2010–2024");
      expect(prose).toMatch(locale === "en" ? /11 regions/i : /11 რეგიონ/i);
      expect(prose).toMatch(locale === "en" ? /basic prices/i : /საბაზისო ფას/i);
      expect(prose).toMatch(locale === "en" ? /market-price GDP/i : /საბაზრო ფასებში.*მშპ/i);
      expect(prose).toMatch(locale === "en" ? /taxes.*subsidies/i : /გადასახად.*სუბსიდი/i);
      expect(prose).toMatch(locale === "en" ? /seven/i : /შვიდ/i);
      expect(prose).toMatch(locale === "en" ? /no 2025|does not include 2025/i : /2025.*არ მოიცავს/i);
      expect(prose).toMatch(locale === "en" ? /real growth.*per-capita/i : /რეალურ ზრდას.*ერთ მოსახლეზე/i);
    }
  });

  it("blocks changes to figures, classifications, groups and missing English text", () => {
    const ka = getMethodologyContent("expenditure", "ka");
    const valid = getMethodologyContent("expenditure", "en");
    expect(validateMethodologyTranslation(ka, valid, "2026-09-06")).toEqual([]);
    const changed = structuredClone(valid);
    changed.decisions = [{ ...changed.decisions[0], group: "Another group", statusLabel: "Limitation", summary: "2000" }, ...changed.decisions.slice(1)];
    changed.sections = [{ ...changed.sections[0], title: "სათაური" }, ...changed.sections.slice(1)];
    const errors = validateMethodologyTranslation(ka, changed, "2026-02-30").join(" ");
    expect(errors).toContain("changed numbers or codes");
    expect(errors).toContain("changed decision status");
    expect(errors).toContain("changed decision groups");
    expect(errors).toContain("missing English text");
    expect(errors).toContain("Invalid translation review date");
    expect(validateMethodologyTranslation(ka, { ...valid, decisions: valid.decisions.slice(1) }, "2026-09-06").join(" ")).toContain("changed item count");
  });
  it.each(LIVE_METHODOLOGY_IDS)("preserves %s decisions, source references, hidden groups and appendix structure", dataset => {
    const ka = getMethodologyContent(dataset, "ka");
    const en = getMethodologyContent(dataset, "en");
    expect(structure(en)).toEqual(structure(ka));
    expect(groups(en)).toEqual(groups(ka));
    const visible = (content: MethodologyContent) => [...content.decisions, ...content.technicalAppendix].filter(decision => !content.hiddenDecisionGroups?.includes(decision.group)).map(decision => decision.id);
    expect(visible(en)).toEqual(visible(ka));
    const prose = [en.title, en.summary, en.disclosure, ...en.keyFacts.flatMap(fact => [fact.label, fact.value ?? ""]), ...en.sections.flatMap(section => [section.title, ...section.paragraphs]), ...[...en.decisions,...en.technicalAppendix].flatMap(decision => [decision.title,decision.group,decision.statusLabel,decision.summary,...decision.detail])];
    expect(prose.join(" ")).not.toMatch(/\p{Script=Georgian}/u);
    expect(en.title.trim()).not.toBe("");
  });
});
