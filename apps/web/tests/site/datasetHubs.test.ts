import { expect, test } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";
import { NAV_TREE } from "../../lib/navigation/navTree";

test("the header, footer and 404 list every sidebar hub, in sidebar order", () => {
  expect(DATASET_HUBS.map((hub) => hub.href)).toEqual(NAV_TREE.map((hub) => hub.href));
  expect(DATASET_HUBS.map((hub) => hub.href)).toEqual([
    "/explorer",
    "/explorer/economy",
    "/explorer/business",
    "/explorer/inflation",
    "/explorer/money",
    "/explorer/unemployment",
    "/explorer/wages",
    "/explorer/living-standards",
    "/explorer/health",
    "/explorer/crime",
    "/explorer/trade",
    "/explorer/external",
    "/explorer/energy-food",
    "/explorer/demography",
  ]);
});

test("every hub label exists in Georgian and English", () => {
  for (const { labelKey } of DATASET_HUBS) {
    expect((kaCommon as Record<string, string>)[labelKey], labelKey).toBeTruthy();
    expect((enCommon as Record<string, string>)[labelKey], labelKey).toBeTruthy();
  }
});
