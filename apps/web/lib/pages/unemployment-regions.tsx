import { notFound } from "next/navigation";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../data/unemployment/importUnemployment";
import { UNEMPLOYMENT_REGIONS } from "../explorer/unemploymentRegionMap";
import { unemploymentRegionHref } from "../explorer/unemploymentRegionRoutes";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { areaTitleForm, latestYearOf } from "../seo/placeTitleForms";
import { renderUnemploymentPage } from "./unemployment";

export const unemploymentRegionStaticParams = () => UNEMPLOYMENT_REGIONS.map(region => ({ id: region.id.replace(/^region\./, "") }));
function regionForSlug(slug: string) {
  const id = `region.${slug}`;
  if (!UNEMPLOYMENT_REGIONS.some(region => region.id === id)) notFound();
  return UNEMPLOYMENT_GROUPS.find(group => group.id === id)!;
}
export async function unemploymentRegionPageMetadata(slug: string, locale: Locale) {
  const region = regionForSlug(slug), [messages, data] = await Promise.all([getMessages(locale, ["unemployment"]), loadServedUnemploymentData()]);
  const name = locale === "en" ? region.labelEn : region.labelKa;
  // The title is worded the way people search it and ends in the region's latest year; the page's own heading and Dataset name keep regionTitle.
  const year = latestYearOf(data.facts, f => f.dimension === "region" && f.groupId === region.id);
  return fiscalMetadata({ locale, path: unemploymentRegionHref(region.id), title: message(messages, "unemployment.regionSeoTitle", { place: areaTitleForm(region.id, name, locale, "in"), year }), description: message(messages, "unemployment.regionSummary", { region: name }) });
}
export const renderUnemploymentRegionsPage = (locale: Locale) => renderUnemploymentPage(locale, "regions");
export const renderUnemploymentRegionPage = (slug: string, locale: Locale) => renderUnemploymentPage(locale, "regions", regionForSlug(slug).id);
