import { loadServedSocialData, toClientSocialFact } from "../../../data/social/importSocial";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import type { SocialPlaceSet } from "../../social";
import { SOCIAL_CAPTION } from "../../socialHubCards";
import { placePageHref } from "../../demographyPlaceRoutes";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import { socialPlaceBase, socialPlaceDefaultSelection } from "../../socialPlaces";
import { latestOf } from "../../unitList";
import { placePageIds } from "../places.server";
import type { PlaceAdapter, PlaceEntry } from "../types";

const SETS: readonly SocialPlaceSet[] = ["pensions", "subsistence-allowance"];

/** Each place's pensioners (Pensions) and receiving families (Subsistence allowance) in the latest year, as its page's line states them, captioned as the card is. */
export const socialEntries: PlaceAdapter = async (locale) => {
  const [{ facts: served }, ids, messages] = await Promise.all([loadServedSocialData(), placePageIds(), getMessages(locale, ["groups"])]);
  const facts = served.map(toClientSocialFact);
  return SETS.flatMap((set) => {
    const caption = message(messages, SOCIAL_CAPTION[set]!);
    return ids.map((id): PlaceEntry => {
      const fact = latestOf(facts, socialPlaceDefaultSelection(set)[0], id);
      return { placeId: id, page: socialPlaceBase(set), href: placePageHref(socialPlaceBase(set), id), value: formatInUnit(fact.value, UNIT_PERSONS), number: fact.value, period: String(fact.year), caption };
    });
  });
};
