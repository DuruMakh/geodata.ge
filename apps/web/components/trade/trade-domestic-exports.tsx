"use client";
import { useEffect, useRef, useState } from "react";
import type { toClientTradeDomesticData } from "../../lib/data/tradeDomestic/importTradeDomestic";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { TextTab } from "../ui/editorial";
import { TradeOverview } from "./trade-overview";
import { TradePartners } from "./trade-partners";
import { TradeProducts } from "./trade-products";

type Section = "overview" | "countries" | "products";
const sections: Section[] = ["overview", "countries", "products"];
const sectionFromHash = () => {
  const section = new URLSearchParams(window.location.hash.slice(1)).get("section") as Section;
  return sections.includes(section) ? section : "overview";
};
export function TradeDomesticExports({ data, sources, lastReviewedAt, siteOrigin }: { data: ReturnType<typeof toClientTradeDomesticData>; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const { messages } = useI18n(), t = (key: string) => message(messages, `trade.domestic.${key}`);
  const [section, setSection] = useState<Section>("overview");
  const saved = useRef<Partial<Record<Section, string>>>({});
  useEffect(() => {
    const cache = () => { saved.current[sectionFromHash()] = window.location.hash; };
    const restore = () => { cache(); setSection(sectionFromHash()); };
    restore(); window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
    window.addEventListener("trade-domestic-state", cache);
    return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); window.removeEventListener("trade-domestic-state", cache); };
  }, []);
  const changeSection = (next: Section) => {
    if (next === section) return;
    saved.current[section] = window.location.hash;
    const hash = saved.current[next] || `#section=${next}`;
    try { window.history.pushState(null, "", hash); } catch { /* The comparison still works in embedded contexts. */ }
    setSection(next);
  };
  const props = { sources, lastReviewedAt, siteOrigin };
  return <div data-testid="trade-domestic" data-section={section} className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <div role="group" aria-label={t("views")} className="mb-5 flex flex-wrap items-center gap-5">
      {sections.map(id => <TextTab key={id} label={t(id)} active={section === id} onClick={() => changeSection(id)} testId={`trade-domestic-section-${id}`} />)}
    </div>
    {section === "overview" ? <TradeOverview facts={data.national} {...props} /> : section === "countries" ? <TradePartners data={data.countries} {...props} /> : <TradeProducts data={data.products} {...props} />}
  </div>;
}
