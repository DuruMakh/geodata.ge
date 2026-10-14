"use client";
import { usePathname } from "next/navigation";
import { SiteFooterView } from "../site/site-footer-view";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { splitLanguagePath } from "../../lib/i18n/routes";
import { sourceNoteKey } from "../../lib/navigation/navTree";
import type { Locale } from "../../lib/i18n/types";

export function ExplorerFooter({locale,year}:{locale:Locale;year:number}) {
  // The messages come from the layout's provider. Importing common.server.ts
  // here bundled BOTH locales' common catalogue into every explorer route.
  const {messages}=useI18n();
  const {pathname}=splitLanguagePath(usePathname());
  const noteKey=sourceNoteKey(pathname);
  return <SiteFooterView locale={locale} messages={messages} sourceNote={message(messages,noteKey)} year={year}/>;
}
