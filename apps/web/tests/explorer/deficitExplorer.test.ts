import { beforeAll, describe, expect, it } from "vitest";

import {
  buildDeficitExplorerModel,
  DEFICIT_SERIES_ID,
} from "../../lib/explorer/deficitExplorer";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import type { ServedGeneralGovernmentBalanceFact } from "../../lib/servedRows";

let presentation: Presentation;
beforeAll(async () => { presentation = await getPresentation("ka", [], [DEFICIT_SERIES_ID]); });

const facts: ServedGeneralGovernmentBalanceFact[] = [
  { year: 2024, generalGovernmentBalancePctGdp: -2.267, generalGovernmentBalanceGel: -2_109_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2025, generalGovernmentBalancePctGdp: -1.455, generalGovernmentBalanceGel: -1_526_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2026, generalGovernmentBalancePctGdp: -2.327, generalGovernmentBalanceGel: -2_672_000_000, status: "projection", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
];

describe("general-government deficit explorer model", () => {
  it("uses the sole balance series and the complete selected range", () => {
    const model = buildDeficitExplorerModel({
      facts,
      range: { start: 2024, end: 2026 },
      percentage: true,
      selected: true,
    }, presentation);

    expect(DEFICIT_SERIES_ID).toBe("deficit.general_government.balance");
    expect(model.years).toEqual([2024, 2025, 2026]);
    expect(model.points.map((point) => point.value)).toEqual([-2.267, -1.455, -2.327]);
    expect(model.forecastStartYear).toBe(2026);
  });

  it("switches to the source nominal GEL values without recalculation", () => {
    const model = buildDeficitExplorerModel({
      facts,
      range: { start: 2024, end: 2026 },
      percentage: false,
      selected: true,
    }, presentation);

    expect(model.points.map((point) => point.value)).toEqual([
      -2_109_000_000,
      -1_526_000_000,
      -2_672_000_000,
    ]);
    expect(model.tableRow.valuesByYear[2025]).toBe(-1_526_000_000);
    expect(model.tableRow.shareByYear?.[2025]).toBe(-0.01455);
  });

  it("preserves a deliberate empty selection", () => {
    const model = buildDeficitExplorerModel({
      facts,
      range: { start: 2024, end: 2026 },
      percentage: true,
      selected: false,
    }, presentation);

    expect(model.points).toEqual([]);
  });

  it("uses the reviewed English label for the published series id", async () => {
    const { getPresentation } = await import("../../lib/i18n/presentation.server");
    const labels = (await import("../../../../data/localization/en/labels.json")).default;
    const presentation = await getPresentation("en", [], ["deficit.general_government.balance"]);
    const model = buildDeficitExplorerModel({ facts, range: { start: 2024, end: 2026 }, percentage: true, selected: true }, presentation);
    expect(model.tableRow.itemId).toBe("deficit.general_government.balance");
    expect(model.tableRow.enLabel).toBe("General government balance");
    expect(labels).not.toHaveProperty("deficit.general_government_balance");
  });
});
