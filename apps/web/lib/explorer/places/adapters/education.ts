import { loadServedEducationData, shownEducationFacts, toClientEducationFact } from "../../../data/education/importEducation";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import { placePageHref } from "../../demographyPlaceRoutes";
import { educationCountLabel, educationPeriodLabel } from "../../education";
import { EDUCATION_CAPTION } from "../../educationHubCards";
import { educationPlaceBase, educationPlaceSeries, type EducationPlaceSet } from "../../educationPlaces";
import { latestOf } from "../../unitList";
import { placePageIds } from "../places.server";
import type { PlaceAdapter, PlaceEntry } from "../types";

const SETS: readonly EducationPlaceSet[] = ["schools", "kindergartens"];

/** Each place's pupils (Schools) and kindergarten children (Kindergartens) in the latest school year, as its page's line states them, captioned as the card is. */
export const educationEntries: PlaceAdapter = async (locale) => {
  const [{ facts: served }, messages, ids] = await Promise.all([loadServedEducationData(), getMessages(locale, ["education", "groups"]), placePageIds()]);
  const facts = shownEducationFacts(served).map(toClientEducationFact);
  const thousand = message(messages, "education.unitThousand");
  return SETS.flatMap((set) => {
    const caption = message(messages, EDUCATION_CAPTION[set]);
    return ids.map((id): PlaceEntry => {
      const fact = latestOf(facts, educationPlaceSeries(set, id)[0].id, id);
      return { placeId: id, page: educationPlaceBase(set), href: placePageHref(educationPlaceBase(set), id), value: educationCountLabel(fact, thousand), number: fact.value, period: educationPeriodLabel(set)(fact.year), caption };
    });
  });
};
