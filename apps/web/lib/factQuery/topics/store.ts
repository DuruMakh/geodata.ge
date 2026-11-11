// apps/web/lib/factQuery/topics/store.ts
//
// Packs a topic dataset's facts into parallel columns for the snapshot and reads them back. Runtime code imports
// this file, so it stays pure.
import type { Basis } from "../types";
import type { TopicBreak, TopicColumns, TopicDataset, TopicPage, TopicDatasetBuild, TopicFact, TopicsSnapshot, TopicValueStatus } from "./types";

function indexOf<T>(list: readonly T[]): Map<T, number> {
  return new Map(list.map((item, index) => [item, index]));
}

function code<T>(codes: Map<T, number>, value: T, what: string): number {
  const found = codes.get(value);
  if (found === undefined) throw new Error(`Unknown ${what} ${String(value)}`);
  return found;
}

/** Facts as columns, in the build's order. Entity and series are positions in the build's lists; basis, status and sources are codes from the snapshot's. */
export function packTopicFacts(build: TopicDatasetBuild, sourceIndex: Map<string, number>, basisCodes: Basis[], statusCodes: TopicValueStatus[]): TopicColumns {
  const entities = indexOf(build.entities.map((entity) => entity.entityId));
  const series = indexOf(build.series.map((entry) => entry.seriesId));
  const basis = indexOf(basisCodes);
  const status = indexOf(statusCodes);
  const columns: TopicColumns = { entity: [], series: [], year: [], value: [], basis: [], status: [], sources: [], periodEnd: {}, monthsReported: {} };
  build.facts.forEach((fact, row) => {
    columns.entity.push(code(entities, fact.entityId, "entity"));
    columns.series.push(code(series, fact.seriesId, "series"));
    columns.year.push(fact.year);
    columns.value.push(fact.value);
    columns.basis.push(code(basis, fact.basis, "basis"));
    columns.status.push(code(status, fact.status, "status"));
    columns.sources.push(fact.sourceIds.map((id) => code(sourceIndex, id, "source")));
    if (fact.periodEnd !== undefined) columns.periodEnd[row] = fact.periodEnd;
    if (fact.monthsReported !== undefined) columns.monthsReported[row] = fact.monthsReported;
  });
  return columns;
}

function factAt(dataset: TopicDataset, topics: TopicsSnapshot, row: number): TopicFact {
  const { columns } = dataset;
  const fact: TopicFact = {
    entityId: dataset.entities[columns.entity[row]!]!.entityId,
    seriesId: dataset.series[columns.series[row]!]!.seriesId,
    year: columns.year[row]!,
    value: columns.value[row]!,
    basis: topics.basisCodes[columns.basis[row]!]!,
    status: topics.statusCodes[columns.status[row]!]!,
    sourceIds: columns.sources[row]!.map((index) => topics.sourceIds[index]!),
  };
  const periodEnd = columns.periodEnd[row];
  if (periodEnd !== undefined) fact.periodEnd = periodEnd;
  const monthsReported = columns.monthsReported[row];
  if (monthsReported !== undefined) fact.monthsReported = monthsReported;
  return fact;
}

export function unpackTopicFacts(dataset: TopicDataset, topics: TopicsSnapshot): TopicFact[] {
  return dataset.columns.year.map((_year, row) => factAt(dataset, topics, row));
}

const cellRows = new WeakMap<TopicDataset, Map<string, number>>();

function rowsOf(dataset: TopicDataset): Map<string, number> {
  let rows = cellRows.get(dataset);
  if (!rows) {
    const { columns } = dataset;
    rows = new Map(columns.year.map((year, row) => [`${dataset.entities[columns.entity[row]!]!.entityId}:${dataset.series[columns.series[row]!]!.seriesId}:${year}`, row]));
    cellRows.set(dataset, rows);
  }
  return rows;
}

/** The one fact for an entity, series and year, or undefined. The lookup map is built once per dataset. */
export function topicCell(dataset: TopicDataset, entityId: string, seriesId: string, year: number, topics: TopicsSnapshot): TopicFact | undefined {
  const row = rowsOf(dataset).get(`${entityId}:${seriesId}:${year}`);
  return row === undefined ? undefined : factAt(dataset, topics, row);
}

/**
 * How a page prints a period: a school year stored as its start year reads `2015/16`; a calendar year has no label.
 * The same rule as lib/explorer/education.ts schoolYearLabel, restated here because that module is not runtime-light.
 */
export function topicPeriodLabel(dataset: { page: Pick<TopicPage, "periodKind"> }, year: number): string | undefined {
  return dataset.page.periodKind === "school_year" ? `${year}/${String((year + 1) % 100).padStart(2, "0")}` : undefined;
}

/**
 * The stored year of the period a date falls in: a calendar year Y runs from Y-01-01, a school year Y (`2020/21`) from
 * Y-09-01. A break dated inside a period starts in that period, as the money-and-banks register reads its dates.
 */
function periodOf(date: string, periodKind: TopicPage["periodKind"]): number {
  const year = Number(date.slice(0, 4));
  return periodKind === "school_year" && date.slice(5) < "09-01" ? year - 1 : year;
}

/** The first break on a series that separates `fromYear` and `toYear` (either order): the period it starts in lies after the earlier year and no later than the later one. */
export function breakBetween(breaks: readonly TopicBreak[], seriesId: string, fromYear: number, toYear: number, periodKind: TopicPage["periodKind"]): TopicBreak | null {
  const [early, late] = fromYear <= toYear ? [fromYear, toYear] : [toYear, fromYear];
  return breaks.find((entry) => {
    if (!entry.seriesIds.includes(seriesId)) return false;
    const starts = periodOf(entry.referenceDate, periodKind);
    return early < starts && starts <= late;
  }) ?? null;
}

/** How a break reads in an answer: its reference date and the register's English reason (the registers are English-only). */
export function topicBreakDetail(entry: TopicBreak): string {
  return `${entry.referenceDate}: ${entry.reasonEn}`;
}

/** The unit tokens whose values are percents (the funded pension's return): a change between two is in percentage points, never a percentage, as for a core rate. */
const TOPIC_PERCENT_UNITS: ReadonlySet<string> = new Set(["percent"]);
export const isTopicPercentUnit = (unit: string): boolean => TOPIC_PERCENT_UNITS.has(unit);
