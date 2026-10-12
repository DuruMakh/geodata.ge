import { describe, expect, it } from "vitest";
import { toggleId } from "../../lib/explorer/selection";
import { municipalUpdatedNote } from "../../lib/pages/municipal-presentation.server";

describe("toggleId", () => {
  it("removes an id that is selected", () => {
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("appends an id that is not selected", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
  });

  it("leaves the input array unchanged", () => {
    const ids = ["a"];
    toggleId(ids, "b");
    toggleId(ids, "a");
    expect(ids).toEqual(["a"]);
  });
});

describe("municipalUpdatedNote", () => {
  const messages = { "municipal.updatedNote": " · updated {date}" };

  it("is empty without a review date", () => {
    expect(municipalUpdatedNote(messages, "ka", undefined)).toBe("");
  });

  it("keeps the ISO date on Georgian pages", () => {
    expect(municipalUpdatedNote(messages, "ka", "2026-05-14")).toBe(" · updated 2026-05-14");
  });

  it("formats the date on English pages", () => {
    expect(municipalUpdatedNote(messages, "en", "2026-05-14")).not.toContain("2026-05-14");
  });
});
