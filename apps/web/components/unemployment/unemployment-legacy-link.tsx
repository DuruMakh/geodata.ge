import { unemploymentSectionForBreakdown } from "../../lib/explorer/unemploymentSections";
import { pageHref } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

/** The view state the Unemployment hub's links kept in the hash before its pages split. */
const LEGACY_VIEW_KEYS = ["breakdown", "indicator", "sex", "view", "sel", "start", "end", "range"];

/**
 * Where an old Unemployment hub link's view (`#breakdown=region&…`) lives now: the section page its breakdown names, with the
 * link's query and hash. Null when the hash carries no such view. The Labour market page, which the old hub forwards to,
 * follows it (`GroupTopicScroll`).
 */
export function unemploymentLegacyHref(locale: Locale, search: string, hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!LEGACY_VIEW_KEYS.some((key) => params.has(key))) return null;
  const section = unemploymentSectionForBreakdown(params.get("breakdown"));
  return `${pageHref(section.href, locale)}${search}${hash}`;
}
