"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { unemploymentRegionHref } from "../../lib/explorer/unemploymentRegionRoutes";
import { formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { RegionIndex } from "../regional-economies/regional-economies-index";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { useAppReady } from "../explorer-shell/use-app-ready";
import { UnemploymentExplorer, type UnemploymentExplorerProps } from "./unemployment-explorer";

export function UnemploymentRegionsIndex({ model, explorer }: { model: RegionMapModel; explorer: UnemploymentExplorerProps }) {
  const { locale, messages } = useI18n();
  const [comparison, setComparison] = useState(false);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      setComparison(["breakdown", "indicator", "sel", "view", "range", "start", "end"].some(key => params.has(key)));
    };
    restore(); window.addEventListener("hashchange", restore); window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("hashchange", restore); window.removeEventListener("popstate", restore); };
  }, []);
  useAppReady();
  const t = (key: string) => message(messages, `unemployment.${key}`);
  if (comparison) return <><a href={pageHref("/explorer/unemployment/regions", locale)} className="mb-4 inline-block text-[12px] text-[var(--accent)] underline underline-offset-4">{message(messages, "regionalEconomies.allRegions")}</a><UnemploymentExplorer {...explorer} /></>;
  const national = explorer.facts.find(fact => fact.dimension === "national" && fact.indicatorId === "unemployment_rate" && fact.year === model.year);
  const percent = (value: number) => formatShare(value / 100);
  return <div data-testid="unemployment-regions-index" className="@container">
    <ExplorerHeading>{t("page.regions.title")}</ExplorerHeading>
    <p className="mb-8 max-w-[800px] text-[13px] leading-relaxed text-[var(--body)]">{t("page.regions.summary")}</p>
    <RegionIndex model={model} sourceNote={t("sourceNote")} metric={{
      hrefForRegion: unemploymentRegionHref, formatValue: percent, mapAria: message(messages, "unemployment.regionMapAria", { year: model.year }),
      entityAria: (name, value, year) => message(messages, "unemployment.regionMapEntityAria", { name, rate: percent(value), year }),
      legend: t("indicator.unemployment_rate"), testId: "unemployment-region-map",
    }} summary={[
      { label: message(messages, "regionalEconomies.regionCount"), value: String(model.regions.length), detail: `${t("indicator.unemployment_rate")} · ${model.year}` },
      { label: t("nationalRate"), value: national ? percent(national.value) : "—", detail: String(model.year) },
      { label: message(messages, "regionalEconomies.period"), value: `${model.firstYear}–${model.year}`, detail: t("annual") },
    ]} />
    <p className="mt-3 max-w-[900px] text-[11px] leading-relaxed text-[var(--muted)]">{t("regionNote")} <Link href={pageHref("/methodology/unemployment", locale)} className="text-[var(--accent)] underline underline-offset-4">{t("methodology")}</Link></p>
    <a href="#breakdown=region" className="mt-3 inline-block text-[12px] text-[var(--accent)] underline underline-offset-4">{t("regionalComparison")}</a>
  </div>;
}
