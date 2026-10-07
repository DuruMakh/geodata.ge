import { describe, expect, it } from "vitest";
import { formatGdpLatestValue, latestEntry } from "../../lib/explorer/latestValue";
import { getMessages } from "../../lib/i18n/messages.server";

describe("latestEntry", () => {
  it("returns the latest period whatever the insertion order", () => {
    expect(latestEntry(new Map([[2025, 13.9], [2010, 27.2], [2024, 13.9 + 0.5]]))).toEqual({ period: 2025, value: 13.9 });
    expect(latestEntry(new Map<number, number>())).toBeNull();
    expect(latestEntry(undefined)).toBeNull();
  });
});

describe("formatGdpLatestValue", () => {
  it("states each indicator in the overview's own unit", async () => {
    const ka = await getMessages("ka", ["gdp"]);
    expect(formatGdpLatestValue({ indicator: "real", currency: "gel" }, 27_123_000_000, ka)).toBe("27.1 მლრდ აშშ დოლარი");
    expect(formatGdpLatestValue({ indicator: "nominal", currency: "gel" }, 104_600_000_000, ka)).toBe("104.6 მლრდ ₾");
    expect(formatGdpLatestValue({ indicator: "per_capita", currency: "gel" }, 28_235.4, ka)).toBe("28 235 ₾");
    expect(formatGdpLatestValue({ indicator: "growth", currency: "gel" }, 0.075, ka)).toBe("+7.5%");
    expect(formatGdpLatestValue({ indicator: "growth", currency: "gel" }, -0.063, ka)).toBe("−6.3%");
    const en = await getMessages("en", ["gdp"]);
    expect(formatGdpLatestValue({ indicator: "nominal", currency: "usd" }, 38_100_000_000, en)).toBe("38.1 bn USD");
  });
});
