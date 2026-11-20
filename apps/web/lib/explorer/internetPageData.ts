import { toClientInternetFact } from "../data/internet/importInternet";
import type { ClientInternetFact, InternetFact } from "../data/internet/types";
import { message } from "../i18n/messages";
import type { Messages, Presentation } from "../i18n/types";
import { internetTopicSeries, type InternetTopicId } from "./internet";
import { internetAreaSeries, type InternetArea } from "./internetAreas";

/*
 * What the Internet pages hand their explorers: the observations a page shows and its series' names. Shared by the pages
 * (lib/pages/internet.tsx, internet-area.tsx) and the MCP snapshot build (lib/factQuery/topics/internet.ts), which cannot
 * import the pages (they pull in `server-only` and React).
 */

/**
 * Display names for every series a topic page can show: a group (Everyone, Towns, …), an online activity or a kind of
 * contact with public services. Names carry no prefix: the heading they sit under names the measure and who it counts.
 */
export function internetLabels(presentation: Presentation, section: InternetTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `internet.${key}`);
  return Object.fromEntries(internetTopicSeries(section).map(({ id, heading }) => {
    const [, measure, group] = id.split(".");
    if (heading === "activities") return [id, t(`series.activity.${measure.slice("activity_".length)}`)];
    if (heading === "egov") return [id, t(`series.egov.${measure.slice("egov_".length)}`)];
    return [id, t(`series.group.${group}`)];
  }));
}

/** The observations a topic page's list can show. */
export function internetPageFacts(facts: readonly InternetFact[], section: InternetTopicId): ClientInternetFact[] {
  const ids = new Set<string>(internetTopicSeries(section).map(series => series.id));
  return facts.map(toClientInternetFact).filter(f => ids.has(f.indicatorId));
}

/** The observations an area page's list shows. */
export function internetAreaFacts(facts: readonly InternetFact[], area: InternetArea): ClientInternetFact[] {
  const ids = new Set<string>(internetAreaSeries(area).map(item => item.id));
  return facts.map(toClientInternetFact).filter(f => ids.has(f.indicatorId));
}

/** An area page's row names. Georgia's rows are Georgia, towns and villages under its two headings; a region's are its homes with internet and with a computer. */
export function internetAreaSeriesLabels(messages: Messages, area: InternetArea): Record<string, string> {
  const label = (id: string) => {
    const [, measure, group] = id.split(".");
    if (area !== "georgia") return message(messages, `internet.series.area.${measure === "homes_internet" ? "internet" : "computer"}`);
    return message(messages, group === "total" ? "internet.series.area.georgia" : `internet.series.group.${group}`);
  };
  return Object.fromEntries(internetAreaSeries(area).map(item => [item.id, label(item.id)]));
}
