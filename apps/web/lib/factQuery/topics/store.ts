// apps/web/lib/factQuery/topics/store.ts
//
// Packs a topic dataset's facts into parallel columns for the snapshot and reads them back. Runtime code imports
// this file, so it stays pure.
import type { Basis } from "../types";
import type { TopicColumns, TopicDataset, TopicPage, TopicDatasetBuild, TopicFact, TopicsSnapshot, TopicValueStatus } from "./types";

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
