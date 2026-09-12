"use client";
import { usePathname } from "next/navigation";
import { SiteFooter } from "../site/site-footer";
import { getCommonMessages } from "../../lib/i18n/common.server";
import { message } from "../../lib/i18n/messages";
import { splitLanguagePath } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

export function ExplorerFooter({updatedAt,locale}:{updatedAt:string;locale:Locale}) {
  const {pathname}=splitLanguagePath(usePathname());
  const economy=pathname==='/explorer/economy'||pathname.startsWith('/explorer/economy/');
  return <SiteFooter updatedAt={updatedAt} locale={locale} sourceNote={economy?message(getCommonMessages(locale),pathname==='/explorer/economy/sectors'?'common.sectorsSourceNote':'common.economySourceNote',{updatedAt:'{updatedAt}'}):undefined}/>;
}
