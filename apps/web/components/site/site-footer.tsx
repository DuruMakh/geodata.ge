import { getCommonMessages } from "../../lib/i18n/common.server";
import { SiteFooterView, type FooterVariantProps } from "./site-footer-view";
import type { Locale } from "../../lib/i18n/types";

/** The footer as a server component renders it: the catalogue is read here. */
export function SiteFooter({ updatedAt, locale = "ka", sourceNote, ...footer }: { updatedAt?: string; locale?: Locale; sourceNote?: string } & FooterVariantProps) {
  return <SiteFooterView updatedAt={updatedAt} locale={locale} sourceNote={sourceNote} {...footer} messages={getCommonMessages(locale)} year={new Date().getFullYear()} />;
}
