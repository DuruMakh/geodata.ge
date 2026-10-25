import { describe, expect, it } from "vitest";
import { buildPlaceIndex } from "../../lib/explorer/places/buildPlaceIndex.server";
import { GEORGIA_PLACE_ID } from "../../lib/explorer/demographyAreas";
import { NAV_TREE } from "../../lib/navigation/navTree";
import { loadTopicHubs } from "../../lib/pages/topicHubs.server";

/**
 * A page's place rows (search's place card and rows) state the measure and unit its group-page card states: Georgia's row reads as
 * the card's figure and caption, or, on a card that spreads the regions from figures of its own (Housing Regions), as the card's
 * Georgia point. A Regions card with neither spreads these very rows (lib/pages/group.tsx), so they agree by construction.
 */
describe.each(["ka", "en"] as const)("place rows and their cards (%s)", async (locale) => {
  const [index, hubs] = await Promise.all([buildPlaceIndex(locale), loadTopicHubs(locale, NAV_TREE.map((hub) => hub.id))]);
  const cards = hubs.flatMap((hub) => hub.cards);
  const pages = [...new Set(index.entries.map((entry) => entry.page))];

  it.each(pages)("%s", (page) => {
    const georgia = index.entries.find((entry) => entry.page === page && entry.placeId === GEORGIA_PLACE_ID);
    if (!georgia) return;
    const card = cards.find((candidate) => candidate.href === page);
    expect(card, page).toBeDefined();
    if (!card!.latest && !card!.spreadEntries) return;
    const spread = card!.spreadEntries?.find((entry) => entry.placeId === GEORGIA_PLACE_ID);
    const expected = spread ? { value: spread.value, caption: spread.caption } : { value: card!.latest!.value, caption: card!.latest!.caption };
    expect({ value: georgia.value, caption: georgia.caption }).toEqual(expected);
  });
});
