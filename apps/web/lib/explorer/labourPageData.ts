import { toClientLabourFact } from "../data/labour/importLabour";
import type { LabourFact } from "../data/labour/types";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { labourSeries, type LabourSectionId } from "./labour";

/*
 * What a Labour Force Survey detail page hands its explorer: the rows it lists, the served facts of them and their names.
 * Shared by the page (lib/pages/labour.tsx) and the MCP snapshot build (lib/factQuery/topics/unemployment.ts), which
 * cannot import the pages (they pull in `server-only` and React).
 */
export function labourPageData(all: readonly LabourFact[], messages: Messages, section: LabourSectionId) {
  const t = (key: string) => message(messages, `labour.${key}`);
  const series = labourSeries(section);
  // The page receives only the observations its list shows.
  const ids = new Set<string>(series.map(({ id }) => id));
  const served = all.filter(f => ids.has(f.indicatorId));
  const facts = served.map(toClientLabourFact);
  const labels = Object.fromEntries(series.map(({ id, item }) => [id, t(`row.${item}`)]));
  const headingLabels = Object.fromEntries(series.map(({ heading }) => [heading, t(`heading.${heading}`)]));
  return { series, served, facts, labels, headingLabels };
}
