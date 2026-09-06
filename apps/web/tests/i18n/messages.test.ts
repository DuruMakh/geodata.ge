import { describe, expect, it } from "vitest";
import { message } from "../../lib/i18n/messages";
import { getMessages } from "../../lib/i18n/messages.server";

describe("localized messages", () => {
  it("substitutes every occurrence while preserving zero and literal replacement characters", () => {
    expect(message({ count: "Selected {count} of {total}; {count} selected by {name}." }, "count", {
      count: 0, total: 9, name: "$&",
    })).toBe("Selected 0 of 9; 0 selected by $&.");
  });

  it("does not recursively interpret braces in a substituted name", () => {
    expect(message({ name: "Name: {name}" }, "name", { name: "{another}" })).toBe("Name: {another}");
  });

  it("fails clearly for missing and blank translations, including inherited object names", () => {
    expect(() => message({}, "common.home")).toThrow("common.home");
    expect(() => message({ blank: "   " }, "blank")).toThrow("blank");
    expect(() => message({}, "toString")).toThrow("toString");
  });

  it("does not silently remove a missing interpolation parameter", () => {
    expect(() => message({ count: "{count} / {total}" }, "count", { count: 2 })).toThrow("total");
  });

  it("loads the requested language and returns an independent message object", async () => {
    const ka = await getMessages("ka", ["common"]);
    const en = await getMessages("en", ["common"]);
    expect(message(ka, "common.home")).toBe("მთავარი");
    expect(message(en, "common.home")).toBe("Home");
    (en as Record<string, string>)["common.home"] = "Changed by caller";
    expect(message(await getMessages("en", ["common"]), "common.home")).toBe("Home");
  });

  it("treats repeated scopes as one request", async () => {
    expect(await getMessages("en", ["common", "common"])).toEqual(await getMessages("en", ["common"]));
  });
});
