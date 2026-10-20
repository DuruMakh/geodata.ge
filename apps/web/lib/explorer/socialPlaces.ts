import type { ClientSocialFact, SocialSeriesBreak } from "../data/social/types";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { HEALTH_HUB_PATH } from "./health";
import { resolveRange } from "./periodRange";
import {
  atPrices, buildSocialSeriesModel, sharePerHundred, socialHeadingOf, socialRows, socialUnitOf,
  type SocialModel, type SocialPlaceSet, type SocialPopulation, type SocialPriceIndex, type SocialSeriesDefinition, type SocialShownFact,
} from "./social";
import type { TopicCoverage, TopicState } from "./topicSeries";
import { changeUnitListSelection, listLatestByHeading, parseUnitListHash, unitListCoverage } from "./unitList";

/** The base path a set's index and place pages sit under; `placePageHref` adds the place. */
export const socialPlaceBase = (set: SocialPlaceSet): `${typeof HEALTH_HUB_PATH}/${SocialPlaceSet}` => `${HEALTH_HUB_PATH}/${set}`;

/** A place's series under their headings (spec §5 and §6); the first row, the default, is the reference. Every place lists the same rows. */
export function socialPlaceSeries(set: SocialPlaceSet): SocialSeriesDefinition[] {
  if (set === "pensions") return [
    ...socialRows("pensioners", ["social.pension.recipients", "social.pension_idp.recipients", "social.pension_highmountain.recipients"], true),
    ...socialRows("share", ["social.pension.recipients#share"]),
    ...socialRows("money", ["social.pension.amount", "social.pension_idp.amount", "social.pension_highmountain.amount"]),
    ...socialRows("average", ["social.pension.avg_monthly", "social.pension.avg_monthly#real", "social.pension_highmountain.avg_monthly"]),
  ];
  return [
    ...socialRows("families", ["social.subsistence.families", "social.subsistence.employment_families", "social.subsistence.registered_families"], true),
    ...socialRows("people", ["social.subsistence.persons", "social.subsistence.registered_persons"]),
    ...socialRows("share", ["social.subsistence.persons#share", "social.subsistence.registered_persons#share"]),
    ...socialRows("money", ["social.subsistence.amount", "social.subsistence.employment_amount"]),
    ...socialRows("average", ["social.subsistence.avg_monthly"]),
  ];
}

export function socialPlaceDefaultSelection(set: SocialPlaceSet): string[] {
  return [socialPlaceSeries(set)[0].id];
}

/** What a place's calculated rows divide by: the 1 January population and the yearly price index. */
export type SocialPlaceExtras = { population: SocialPopulation; cpi: SocialPriceIndex };

/**
 * A place's shown facts (a fact-side id, or a municipality code: 04 is Tbilisi): its served rows of the set, its shares of
 * residents and, on Pensions, the average pension at 2025 prices. Every place deflates with the same national index.
 * The other place functions take these.
 */
export function socialPlaceFacts(set: SocialPlaceSet, placeId: string, facts: readonly ClientSocialFact[], extras: SocialPlaceExtras): SocialShownFact[] {
  const place = placeIdForMunicipalityCode(placeId);
  const definitions = socialPlaceSeries(set);
  const listed = new Set(definitions.map(definition => definition.id));
  const served = facts.filter(f => f.geographyId === place && listed.has(f.indicatorId));
  const real = definitions.filter(definition => definition.calculated === "real").map(definition => definition.id.split("#")[0]);
  return [
    ...served.map(f => ({ ...f, unit: socialUnitOf(f.indicatorId) })),
    ...sharePerHundred(served, extras.population, place).filter(f => listed.has(f.indicatorId)),
    ...atPrices(served.filter(f => real.includes(f.indicatorId)), extras.cpi),
  ];
}

const noSocialYears = (placeId: string) => `No social protection years for ${placeId}`;

/** A place's years for a selection: every year any row of the selection's heading has a value (any of its rows when nothing is selected). */
export function socialPlaceCoverage(set: SocialPlaceSet, placeId: string, facts: readonly SocialShownFact[], selectedIds: readonly string[] = []): TopicCoverage {
  const definitions = socialPlaceSeries(set);
  return unitListCoverage(definitions, selectedIds, facts, noSocialYears(placeId), socialHeadingOf(definitions));
}

/** Reads a place page's hash: a selection that mixes headings keeps only its first row's heading, and the years fit that heading. */
export function parseSocialPlaceHash(hash: string, set: SocialPlaceSet, placeId: string, facts: readonly SocialShownFact[]): TopicState {
  const definitions = socialPlaceSeries(set);
  return parseUnitListHash(hash, definitions, socialPlaceDefaultSelection(set), facts, noSocialYears(placeId), socialHeadingOf(definitions));
}

/** A place page's new selection: a row under another heading replaces it. The years stay, clamped to the heading's (never collapsed to "all"). */
export function changeSocialPlaceSelection(state: TopicState, set: SocialPlaceSet, placeId: string, next: readonly string[], facts: readonly SocialShownFact[]): TopicState {
  const definitions = socialPlaceSeries(set);
  return changeUnitListSelection(state, definitions, next, facts, noSocialYears(placeId), socialHeadingOf(definitions));
}

/** A place page's model; `breaks` are the counting-change register, of which the model keeps the ones touching the selection. */
export function buildSocialPlaceModel(set: SocialPlaceSet, placeId: string, facts: readonly SocialShownFact[], state: TopicState, breaks: readonly SocialSeriesBreak[]): SocialModel {
  return buildSocialSeriesModel(socialPlaceSeries(set), facts, state, socialPlaceCoverage(set, placeId, facts, state.selectedIds), breaks);
}

/**
 * A place's series list, as Education's place list reads it: the list ends at the chosen years' end over all of the place's
 * years (never the selection's, so ticking a row never changes the numbers it shows), each row shows its latest value up to
 * then, and a heading whose rows stop earlier names their year.
 */
export function socialPlaceList(set: SocialPlaceSet, placeId: string, facts: readonly SocialShownFact[], state: TopicState) {
  const end = resolveRange(state.range, socialPlaceCoverage(set, placeId, facts)).end;
  return { end, rows: listLatestByHeading(facts, socialPlaceSeries(set), end) };
}
