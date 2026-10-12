import { expect, test } from "vitest";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";

test("the header, footer and 404 share one list of dataset hubs, in sidebar order", () => {
  expect(DATASET_HUBS.map((hub) => hub.href)).toEqual(["/explorer", "/explorer/economy", "/explorer/inflation", "/explorer/unemployment", "/explorer/trade"]);
});

test("every hub label exists in Georgian and English", () => {
  for (const { labelKey } of DATASET_HUBS) {
    expect((kaCommon as Record<string, string>)[labelKey], labelKey).toBeTruthy();
    expect((enCommon as Record<string, string>)[labelKey], labelKey).toBeTruthy();
  }
});
