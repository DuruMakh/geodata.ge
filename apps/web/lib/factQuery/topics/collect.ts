// apps/web/lib/factQuery/topics/collect.ts
//
// The collector every topic adapter builds its datasets with: the series, places and cells a page prints, checked for one
// unit per series, with the reviewed breaks narrowed to the served series. Build-time only: runtime code never imports
// it (tests/factQuery/purity.test.ts).
import type { Basis } from "../types";
import { TOPIC_PAGES } from "./pages";
import type { TopicBreak, TopicDatasetBuild, TopicEntity, TopicFact, TopicPage, TopicSeries, TopicSeriesNote, TopicValueStatus } from "./types";

/** A name in both languages: a message key read in each, or text built from the page's own words in each. */
export type Names = { ka: string; en: string };
/**
 * One served cell's value, the rows it rests on, whether the page adds them up itself and, for a part of a year, its
 * months; for an amount dated other than the year's end (the latest Foreign debt and Reserves point), its date.
 */
export type Cell = { value: number; unit: string; sourceIds: string[]; status: TopicValueStatus; monthsReported?: number; periodEnd?: string };
export type SeriesSpec = { seriesId: string; indicatorId: string; label: Names; heading: Names | null; parentSeriesId: string | null; isTotal: boolean; note?: TopicSeriesNote };

/**
 * Collects one page's dataset. `add` adds a series' cells for one place over the years the page prints them: missing
 * (`value: null`) in a year it prints nothing for, never zero. The first place that lists a series names it. Every cell
 * carries `basis` ("published" unless the family says otherwise: Health and Social protection serve "actual").
 */
export function collectTopicDataset(datasetId: string, title: Names, basis: Basis = "published") {
  const page: TopicPage = TOPIC_PAGES.find((candidate) => candidate.datasetId === datasetId)!;
  const series = new Map<string, TopicSeries & { indicatorId: string }>();
  const entities = new Map<string, TopicEntity>();
  const facts: TopicFact[] = [];

  function add(entity: TopicEntity, spec: SeriesSpec, years: readonly number[], cellAt: (year: number) => Cell | undefined) {
    const cells = years.map((year) => ({ year, cell: cellAt(year) }));
    const units = new Set(cells.flatMap(({ cell }) => (cell ? [cell.unit] : [])));
    if (units.size !== 1) throw new Error(`${datasetId}: ${entity.entityId} ${spec.seriesId} has units ${[...units].join(", ") || "none"}`);
    const unit = [...units][0]!;
    const known = series.get(spec.seriesId);
    if (known && known.unit !== unit) throw new Error(`${datasetId}: ${spec.seriesId} is ${known.unit} and ${unit}`);
    if (!known) {
      series.set(spec.seriesId, {
        seriesId: spec.seriesId, labelKa: spec.label.ka, labelEn: spec.label.en, headingKa: spec.heading?.ka ?? null, headingEn: spec.heading?.en ?? null,
        parentSeriesId: spec.parentSeriesId, isTotal: spec.isTotal, unit, indicatorId: spec.indicatorId, ...(spec.note === undefined ? {} : { note: spec.note }),
      });
    }
    if (!entities.has(entity.entityId)) entities.set(entity.entityId, entity);
    for (const { year, cell } of cells) {
      facts.push(cell
        ? {
          entityId: entity.entityId, seriesId: spec.seriesId, year, value: cell.value, basis, status: cell.status, sourceIds: cell.sourceIds,
          ...(cell.periodEnd === undefined ? {} : { periodEnd: cell.periodEnd }), ...(cell.monthsReported === undefined ? {} : { monthsReported: cell.monthsReported }),
        }
        : { entityId: entity.entityId, seriesId: spec.seriesId, year, value: null, basis, status: "official", sourceIds: [] });
    }
  }

  /** The reviewed breaks name indicators; a dataset's break lists the served series that rest on them. */
  function build(breaks: readonly TopicBreak[]): TopicDatasetBuild {
    const list = [...series.values()];
    return {
      page, titleKa: title.ka, titleEn: title.en,
      series: list.map(({ indicatorId: _indicatorId, ...entry }) => entry),
      entities: [...entities.values()],
      facts,
      breaks: breaks.flatMap((entry) => {
        const seriesIds = list.filter((candidate) => entry.seriesIds.includes(candidate.indicatorId)).map((candidate) => candidate.seriesId);
        return seriesIds.length ? [{ ...entry, seriesIds }] : [];
      }),
    };
  }
  return { add, build };
}

/** Every year from a list's first to its last. */
export const span = (years: readonly number[]) => (years.length ? Array.from({ length: years.at(-1)! - years[0]! + 1 }, (_, index) => years[0]! + index) : []);

/**
 * Breaks on a series a page serves under one id across its places, where each place's figure is its own reviewed
 * indicator (an area page's sales, `business.turnover`, rests on `business.turnover.total` for Georgia and
 * `business.turnover.region_<id>` for each region): `members` maps the served id to those indicators. A break that names
 * every one of them also names the served id; one that names only some stops the build, since a dataset's break holds
 * for the series at every place.
 */
export function breaksOnServedSeries(breaks: readonly TopicBreak[], members: ReadonlyMap<string, readonly string[]>): TopicBreak[] {
  return breaks.map((entry) => {
    const served = [...members].flatMap(([seriesId, indicatorIds]) => {
      const named = indicatorIds.filter((id) => entry.seriesIds.includes(id)).length;
      if (named && named !== indicatorIds.length) throw new Error(`Break ${entry.breakId} names ${named} of the ${indicatorIds.length} places of ${seriesId}`);
      return named ? [seriesId] : [];
    });
    return served.length ? { ...entry, seriesIds: [...entry.seriesIds, ...served] } : entry;
  });
}
