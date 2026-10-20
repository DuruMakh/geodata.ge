import { LatestFigure } from "../../components/explorer-shell/latest-value-line";
import { LabourExplorer } from "../../components/unemployment/labour-explorer";
import { loadServedLabourData, toClientLabourFact } from "../data/labour/importLabour";
import { LABOUR_SOURCES } from "../data/labour/types";
import { formatInUnit, formatShare } from "../explorer/format";
import { labourDefaultSelection, labourFullLabel, labourSeries, labourUnit, type LabourSectionId } from "../explorer/labour";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { resolveSiteUrl } from "../siteUrl";
import { labourSectionHref, renderLabourFrame } from "./labour-shared";

const ONE_DECIMAL = { divisor: 1, label: "", decimals: 1 };

/** One Labour Force Survey detail page: Georgia's facts of the section's rows, the latest line of its total, the workspace. */
export async function renderLabourPage(locale: Locale, section: LabourSectionId) {
  // The Sources sheet lists the archived Geostat workbooks (data/methodology/source-archives/unemployment.csv) the values are read from.
  const [{ facts: all }, presentation, sources] = await Promise.all([
    loadServedLabourData(), getPresentation(locale, ["labour", "format", "main", "workbook"], []), loadSourcedWorkbookSources("unemployment", locale, row => LABOUR_SOURCES.includes(row.source_id)),
  ]);
  const t = (key: string) => message(presentation.messages, `labour.${key}`);
  const series = labourSeries(section);
  // The page receives only the observations its list shows.
  const ids = new Set<string>(series.map(({ id }) => id));
  const served = all.filter(f => ids.has(f.indicatorId));
  const facts = served.map(toClientLabourFact);
  const labels = Object.fromEntries(series.map(({ id, item }) => [id, t(`row.${item}`)]));
  const headingLabels = Object.fromEntries(series.map(({ heading }) => [heading, t(`heading.${heading}`)]));
  const title = t(`page.${section}.title`);
  // "{measure} · {year}: {value}": the page total's latest published figure.
  const [totalId] = labourDefaultSelection(section);
  const latest = facts.filter(f => f.indicatorId === totalId).sort((a, b) => a.year - b.year).at(-1)!;
  const unit = labourUnit(section);
  const figure = unit === "percent" ? formatShare(latest.value / 100) : unit === "hours" ? formatInUnit(latest.value, ONE_DECIMAL) : `${formatInUnit(latest.value, ONE_DECIMAL)} ${t(`cardUnit.${unit}`)}`;
  const lastReviewedAt = served.map(f => f.lastReviewedAt).sort().at(-1)!;
  return renderLabourFrame({
    locale, presentation, path: labourSectionHref(section), title, description: t(`page.${section}.summary`), facts: served,
    variableMeasured: series.map(({ id, heading }) => labourFullLabel(heading, headingLabels[heading], labels[id])),
    children: <LabourExplorer key={section} section={section} facts={facts} labels={labels} headingLabels={headingLabels}
      latestLine={<>{t(`latest.${section}`)} · {latest.year}: <LatestFigure value={figure} /></>}
      sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={resolveSiteUrl()} />,
  });
}
