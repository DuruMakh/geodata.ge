import { loadServedSocialData, toClientSocialFact } from "../../../data/social/importSocial";
import type { SocialPlaceSet } from "../../social";
import { placePageHref } from "../../demographyPlaceRoutes";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import { socialLatestOf, socialPlaceBase, socialPlaceDefaultSelection } from "../../socialPlaces";
import { placePageIds } from "../places.server";
import type { PlaceAdapter, PlaceEntry } from "../types";

const SETS: readonly SocialPlaceSet[] = ["pensions", "subsistence-allowance"];

/** Each place's pensioners (Pensions) and receiving families (Subsistence allowance) in the latest year, as its page's line states them. */
export const socialEntries: PlaceAdapter = async () => {
  const [{ facts: served }, ids] = await Promise.all([loadServedSocialData(), placePageIds()]);
  const facts = served.map(toClientSocialFact);
  return SETS.flatMap((set) => ids.map((id): PlaceEntry => {
    const fact = socialLatestOf(facts, socialPlaceDefaultSelection(set)[0], id);
    return { placeId: id, page: socialPlaceBase(set), href: placePageHref(socialPlaceBase(set), id), value: formatInUnit(fact.value, UNIT_PERSONS), number: fact.value, period: String(fact.year) };
  }));
};
