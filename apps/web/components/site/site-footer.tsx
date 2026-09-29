import { getCommonMessages } from "../../lib/i18n/common.server";
import { SiteFooterView } from "./site-footer-view";
import type { Locale } from "../../lib/i18n/types";

/** The footer as a server component renders it: the catalogue is read here. */
export function SiteFooter({ updatedAt, locale = "ka", sourceNote }: { updatedAt?: string; locale?: Locale; sourceNote?: string }) {
  return <SiteFooterView updatedAt={updatedAt} locale={locale} sourceNote={sourceNote} messages={getCommonMessages(locale)} />;
}
