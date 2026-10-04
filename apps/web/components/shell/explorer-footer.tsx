"use client";
import { usePathname } from "next/navigation";
import { SiteFooterView } from "../site/site-footer-view";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { splitLanguagePath } from "../../lib/i18n/routes";
import type { Locale } from "../../lib/i18n/types";

export function ExplorerFooter({locale}:{locale:Locale}) {
  // The messages come from the layout's provider. Importing common.server.ts
  // here bundled BOTH locales' common catalogue into every explorer route.
  const {messages}=useI18n();
  const {pathname}=splitLanguagePath(usePathname());
  const economy=pathname==='/explorer/economy'||pathname.startsWith('/explorer/economy/');
  const inflation=pathname==='/explorer/inflation'||pathname.startsWith('/explorer/inflation/');
  let noteKey='common.budgetSourceNote';
  if (pathname==='/explorer') noteKey='common.budgetHubSourceNote';
  else if (pathname==='/explorer/deficit') noteKey='common.deficitSourceNote';
  else if (pathname==='/explorer/unemployment') noteKey='common.geostatSourceNote';
  else if (pathname==='/explorer/inflation/categories'||pathname==='/explorer/inflation/products') noteKey='common.geostatSourceNote';
  else if (inflation) noteKey='common.inflationSourceNote';
  else if (pathname==='/explorer/economy/sectors'||pathname==='/explorer/economy/regions'||pathname.startsWith('/explorer/economy/regions/')) noteKey='common.geostatSourceNote';
  else if (economy) noteKey='common.economySourceNote';
  else if (['/explorer/expenditure','/explorer/revenue','/explorer/debt','/explorer/municipalities'].includes(pathname)) noteKey='common.budgetStatisticsSourceNote';
  return <SiteFooterView locale={locale} messages={messages} sourceNote={message(messages,noteKey)}/>;
}
