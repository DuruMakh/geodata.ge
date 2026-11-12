// apps/web/lib/factQuery/topics/types.ts
//
// The shared topic format: what an adapter builds for one chart page (TopicDatasetBuild) and what the snapshot keeps
// (TopicDataset, facts packed into parallel columns). Types only; store.ts packs and unpacks.
import type { MethodologyDatasetId } from "../../methodology/types";
import type { ServiceMessageKey } from "../localization";
import type { Basis, DatasetId } from "../types";

export type TopicFamilyId = "education" | "demography" | "health" | "social" | "unemployment" | "wages" | "business" | "money-banks" | "living-standards" | "housing" | "internet" | "transport" | "trade" | "external" | "budget-extras" | "crime" | "science-culture" | "environment" | "energy-food";

/** A topic page's dataset id (`education-schools`): kept apart from the core DatasetId, whose per-dataset maps it does not join. */
export type TopicDatasetId = (typeof import("./pages").TOPIC_PAGES)[number]["datasetId"];

/** A core or a topic dataset id, where topic data flows alongside the core datasets. */
export type AnyDatasetId = DatasetId | TopicDatasetId;

export type TopicPage = { datasetId: string; pagePath: `/explorer/${string}`; family: TopicFamilyId; periodKind: "year" | "school_year" };

/** `note`: a service message the series' value definition adds (what an "Other countries" line leaves out), read at query time. */
export type TopicSeriesNote = { key: ServiceMessageKey; values: Record<string, string | number> };

/**
 * `breakdown`: an internal key for the page's breakdown a series belongs to, where one parent's parts (or one heading's
 * series) make up several (students by level and by sex; the unemployment rate and the labour force by age): `rank`
 * ranks one breakdown at a time. `subtractedFrom`: the total this series enters with a minus sign (imports, of GDP): it is
 * not ranked among that total's parts, and a ranking of them says so. Neither is served.
 */
export type TopicSeries = { seriesId: string; labelKa: string; labelEn: string; headingKa: string | null; headingEn: string | null; parentSeriesId: string | null; isTotal: boolean; unit: string; note?: TopicSeriesNote; breakdown?: string; subtractedFrom?: string };

export type TopicEntity = { entityId: string; entityType: "country" | "region" | "municipality" | "city"; labelKa: string; labelEn: string; parentEntityId: string | null };

export type TopicValueStatus = "official" | "survey_estimate" | "derived" | "partial";

export type TopicFact = { entityId: string; seriesId: string; year: number; value: number | null; basis: Basis; status: TopicValueStatus; sourceIds: string[]; periodEnd?: string; monthsReported?: number };

export type TopicBreak = { breakId: string; seriesIds: string[]; referenceDate: string; reasonEn: string };

export type TopicDatasetBuild = { page: TopicPage; titleKa: string; titleEn: string; series: TopicSeries[]; entities: TopicEntity[]; facts: TopicFact[]; breaks: TopicBreak[] };

export type TopicAdapter = { family: TopicFamilyId; sourceArchive: MethodologyDatasetId[]; build(): Promise<TopicDatasetBuild[]> };

/** Facts as parallel columns: entity, series and year are indexes into the dataset's lists; basis, status and sources into the snapshot's. */
export type TopicColumns = { entity: number[]; series: number[]; year: number[]; value: (number | null)[]; basis: number[]; status: number[]; sources: number[][]; periodEnd: Record<number, string>; monthsReported: Record<number, number> };

/**
 * A dataset as the snapshot keeps it. `searchKa`/`searchEn` name it for search only, "<topic> — <page title>"
 * ("Living standards — Spending"): a one-word page title alone would meet a budget word ("health spending") in full.
 * The published title stays `titleKa`/`titleEn`.
 */
export type TopicDataset = Omit<TopicDatasetBuild, "facts"> & { urlKa: string; urlEn: string; groupId: string; searchKa: string; searchEn: string; firstYear: number; lastYear: number; columns: TopicColumns };

export type TopicsSnapshot = { datasets: TopicDataset[]; sourceIds: string[]; basisCodes: Basis[]; statusCodes: TopicValueStatus[]; units: Record<string, { labelKa: string; labelEn: string }> };
