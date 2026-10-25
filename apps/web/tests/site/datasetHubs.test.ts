import { expect, test } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";

test("the header, footer and 404 list the eight groups, in sidebar order", () => {
  expect(DATASET_HUBS.map((hub) => hub.href)).toEqual([
    "/explorer/budget",
    "/explorer/economy",
    "/explorer/prices",
    "/explorer/labour",
    "/explorer/living",
    "/explorer/external",
    "/explorer/demography",
    "/explorer/society",
  ]);
});

test("every group label exists in Georgian and English", () => {
  for (const { labelKey } of DATASET_HUBS) {
    expect((kaCommon as Record<string, string>)[labelKey], labelKey).toBeTruthy();
    expect((enCommon as Record<string, string>)[labelKey], labelKey).toBeTruthy();
  }
});
