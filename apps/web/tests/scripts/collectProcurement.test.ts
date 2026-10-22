import { expect, test } from "vitest";
import { main } from "../../scripts/collect-procurement";

const USAGE = "Usage: collect-procurement.ts download|clean|parties|registry [--limit N]|report";

test("the command names its steps when none is given", async () => {
  await expect(main([])).rejects.toThrow(USAGE);
});

test("the command names its steps when an unknown one is given", async () => {
  await expect(main(["oops"])).rejects.toThrow(USAGE);
});

test("a registry limit must be a positive whole number", async () => {
  await expect(main(["registry", "--limit", "x"])).rejects.toThrow(USAGE);
});
