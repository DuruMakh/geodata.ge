import { describe, expect, it } from "vitest";
import {
  ancestorCodesFor,
  codeDepth,
  findLeafCodes,
  normalizeOfficialCode,
  parentCodeFor,
} from "../../../lib/data/realExpenditure/hierarchy";

describe("real expenditure hierarchy helpers", () => {
  it("normalizes official codes with stable spacing", () => {
    expect(normalizeOfficialCode("01  01 03")).toBe("01 01 03");
    expect(normalizeOfficialCode(" 00 00 ")).toBe("00 00");
    expect(normalizeOfficialCode(null)).toBe(null);
    expect(normalizeOfficialCode("")).toBe(null);
  });

  it("computes code depth and parent code", () => {
    expect(codeDepth("00 00")).toBe(0);
    expect(codeDepth("01 00")).toBe(1);
    expect(codeDepth("01 01")).toBe(2);
    expect(codeDepth("01 01 03")).toBe(3);
    expect(codeDepth("01 01 03 02")).toBe(4);
    expect(parentCodeFor("01 01 03 02")).toBe("01 01 03");
    expect(parentCodeFor("01 01 03")).toBe("01 01");
    expect(parentCodeFor("01 01")).toBe("01 00");
    expect(parentCodeFor("01 00")).toBe("00 00");
    expect(parentCodeFor("00 00")).toBe(null);
    expect(ancestorCodesFor("01 01 03 02")).toEqual(["01 00", "01 01", "01 01 03"]);
  });

  it("finds only leaf coded rows", () => {
    expect(findLeafCodes(["00 00", "01 00", "01 01", "01 01 01", "01 02", "02 00"])).toEqual([
      "01 01 01",
      "01 02",
      "02 00",
    ]);
  });
});
