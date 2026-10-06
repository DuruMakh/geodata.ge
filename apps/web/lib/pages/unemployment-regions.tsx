import { notFound } from "next/navigation";
import { UNEMPLOYMENT_GROUPS } from "../data/unemployment/importUnemployment";
import { UNEMPLOYMENT_REGIONS } from "../explorer/unemploymentRegionMap";
import { unemploymentRegionHref } from "../explorer/unemploymentRegionRoutes";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { renderUnemploymentPage } from "./unemployment";

export const unemploymentRegionStaticParams = () => UNEMPLOYMENT_REGIONS.map(region => ({ id: region.id.replace(/^region\./, "") }));
function regionForSlug(slug: string) {
  const id = `region.${slug}`;
  if (!UNEMPLOYMENT_REGIONS.some(region => region.id === id)) notFound();
  return UNEMPLOYMENT_GROUPS.find(group => group.id === id)!;
}
export async function unemploymentRegionPageMetadata(slug: string, locale: Locale) {
  const region = regionForSlug(slug), messages = await getMessages(locale, ["unemployment"]);
  const name = locale === "en" ? region.labelEn : region.labelKa;
  return fiscalMetadata({ locale, path: unemploymentRegionHref(region.id), title: message(messages, "unemployment.regionTitle", { region: name }), description: message(messages, "unemployment.regionSummary", { region: name }) });
}
export const renderUnemploymentRegionsPage = (locale: Locale) => renderUnemploymentPage(locale, "regions");
export const renderUnemploymentRegionPage = (slug: string, locale: Locale) => renderUnemploymentPage(locale, "regions", regionForSlug(slug).id);
