import { LatestFigure } from "../../components/explorer-shell/latest-value-line";
import { LabourExplorer } from "../../components/unemployment/labour-explorer";
import { loadServedLabourData } from "../data/labour/importLabour";
import { LABOUR_SOURCES } from "../data/labour/types";
import { formatInUnit, formatShare } from "../explorer/format";
import { labourDefaultSelection, labourFullLabel, labourUnit, ONE_DECIMAL, type LabourSectionId } from "../explorer/labour";
import { labourPageData } from "../explorer/labourPageData";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { resolveSiteUrl } from "../siteUrl";
import { labourSectionHref, renderLabourFrame } from "./labour-shared";

/** One Labour Force Survey detail page: Georgia's facts of the section's rows, the latest line of its total, the workspace. */
export async function renderLabourPage(locale: Locale, section: LabourSectionId) {
  // The Sources sheet lists the archived Geostat workbooks (data/methodology/source-archives/unemployment.csv) the values are read from.
  const [{ facts: all }, presentation, sources] = await Promise.all([
    loadServedLabourData(), getPresentation(locale, ["labour", "format", "main", "workbook"], []), loadSourcedWorkbookSources("unemployment", locale, row => LABOUR_SOURCES.includes(row.source_id)),
  ]);
  const t = (key: string) => message(presentation.messages, `labour.${key}`);
  const { series, served, facts, labels, headingLabels } = labourPageData(all, presentation.messages, section);
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
