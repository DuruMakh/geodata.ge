"use client";
import { usePathname } from "next/navigation";
import { SiteFooterView } from "../site/site-footer-view";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { splitLanguagePath } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

export function ExplorerFooter({updatedAt,locale}:{updatedAt:string;locale:Locale}) {
  // The messages come from the layout's provider. Importing common.server.ts
  // here bundled BOTH locales' common catalogue into every explorer route.
  const {messages}=useI18n();
  const {pathname}=splitLanguagePath(usePathname());
  const economy=pathname==='/explorer/economy'||pathname.startsWith('/explorer/economy/');
  const inflation=pathname==='/explorer/inflation'||pathname.startsWith('/explorer/inflation/');
  const noteKey=inflation?'common.inflationSourceNote':economy?(pathname==='/explorer/economy/sectors'?'common.sectorsSourceNote':'common.economySourceNote'):null;
  return <SiteFooterView updatedAt={updatedAt} locale={locale} messages={messages} sourceNote={noteKey?message(messages,noteKey,{updatedAt:'{updatedAt}'}):undefined}/>;
}
