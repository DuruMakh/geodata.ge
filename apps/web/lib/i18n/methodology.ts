import type { MethodologyContent } from "../methodology/types";

const proseKeys = new Set(["title", "summary", "disclosure", "label", "value", "paragraphs", "detail", "group", "statusLabel", "hiddenDecisionGroups"]);
const statusTranslations = {
  "ოფიციალური ფაქტი": "Official fact",
  "Fiscal.ge-ის გადაწყვეტილება": "Fiscal.ge decision",
  "შეზღუდვა": "Limitation",
} as const;

function numbers(text: string): string[] {
  // Ignore thousands separators, but retain decimal/code precision and leading zeros.
  const normalized = text.replace(/\d{1,3}(?:[ ,\u00a0]\d{3})+(?!\d)/g, value => value.replace(/[ ,\u00a0]/g, ""));
  return (normalized.match(/\d+(?:\.\d+)*/g) ?? []).sort();
}

export function validateMethodologyTranslation(ka: MethodologyContent, en: MethodologyContent, reviewedAt: string): string[] {
  const errors: string[] = [];
  const date = new Date(`${reviewedAt}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== reviewedAt) errors.push("Invalid translation review date");
  function compare(original: unknown, translated: unknown, path: string, prose = false) {
    if (typeof original === "string" && typeof translated === "string") {
      if (prose) {
        if (!translated.trim() || /\p{Script=Georgian}/u.test(translated)) errors.push(`${path}: missing English text`);
        if (JSON.stringify(numbers(original)) !== JSON.stringify(numbers(translated))) errors.push(`${path}: changed numbers or codes`);
      } else if (original !== translated) errors.push(`${path}: changed source structure`);
    } else if (Array.isArray(original) && Array.isArray(translated)) {
      if (original.length !== translated.length) errors.push(`${path}: changed item count`);
      original.forEach((value, index) => compare(value, translated[index], `${path}[${index}]`, prose));
    } else if (original && translated && typeof original === "object" && typeof translated === "object") {
      if (JSON.stringify(Object.keys(original).sort()) !== JSON.stringify(Object.keys(translated).sort())) errors.push(`${path}: changed fields`);
      for (const [key, value] of Object.entries(original)) compare(value, (translated as Record<string, unknown>)[key], `${path}.${key}`, proseKeys.has(key));
    } else if (original !== translated) errors.push(`${path}: changed source structure`);
  }
  compare(ka, en, ka.id);
  const decisions = (content: MethodologyContent) => [...content.decisions, ...content.technicalAppendix];
  const groupIds = (content: MethodologyContent) => {
    const groups = new Map<string, string[]>();
    for (const decision of decisions(content)) groups.set(decision.group, [...(groups.get(decision.group) ?? []), decision.id]);
    return [...groups.values()].map(ids => ids.sort().join(",")).sort();
  };
  if (JSON.stringify(groupIds(ka)) !== JSON.stringify(groupIds(en))) errors.push(`${ka.id}: changed decision groups`);
  const visibleIds = (content: MethodologyContent) => decisions(content).filter(decision => !content.hiddenDecisionGroups?.includes(decision.group)).map(decision => decision.id);
  if (JSON.stringify(visibleIds(ka)) !== JSON.stringify(visibleIds(en))) errors.push(`${ka.id}: changed hidden decisions`);
  decisions(ka).forEach((decision, index) => {
    if (decisions(en)[index]?.statusLabel !== statusTranslations[decision.statusLabel as keyof typeof statusTranslations]) errors.push(`${decision.id}: changed decision status`);
  });
  return errors;
}
