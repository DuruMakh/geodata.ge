import { expect, test } from "vitest";
import { packFacts, unpackFacts } from "../../lib/data/packedFacts";

const facts = [
  { entityId: "transfer.italy", year: 2019, status: "numeric", note: null, value: 1.25 },
  { entityId: "transfer.italy", year: 2020, status: "partial", note: "11 months", value: null },
  { entityId: "transfer.total", year: 2019, status: "numeric", note: null, value: 0 },
];

test("packs each repeated string once and unpacks to the same facts, through JSON", () => {
  const packed = packFacts(facts);
  expect(packed).toEqual({
    fields: ["entityId", "year", "status", "note", "value"],
    codes: { entityId: ["transfer.italy", "transfer.total"], status: ["numeric", "partial"], note: [null, "11 months"] },
    rows: [[0, 2019, 0, 0, 1.25], [0, 2020, 1, 1, null], [1, 2019, 0, 0, 0]],
  });
  const restored = unpackFacts<(typeof facts)[number]>(JSON.parse(JSON.stringify(packed)));
  expect(restored).toStrictEqual(facts);
  expect(restored.map(fact => Object.keys(fact))).toEqual(facts.map(fact => Object.keys(fact)));
});

test("plain facts pass through, a payload is unpacked once, and no facts pack to nothing", () => {
  expect(unpackFacts(facts)).toBe(facts);
  const packed = packFacts(facts);
  expect(unpackFacts(packed)).toBe(unpackFacts(packed));
  expect(unpackFacts(packFacts([]))).toEqual([]);
});

test("a field that is null on every fact, or mixes numbers and strings, is not coded", () => {
  const packed = packFacts([{ id: "a", missing: null, mixed: 1 }, { id: "a", missing: null, mixed: "x" }]);
  expect(Object.keys(packed.codes)).toEqual(["id"]);
  expect(unpackFacts(packed)).toStrictEqual([{ id: "a", missing: null, mixed: 1 }, { id: "a", missing: null, mixed: "x" }]);
});

test("facts with different fields are refused rather than changed", () => {
  expect(() => packFacts<Record<string, unknown>>([{ id: "a", value: 1 }, { id: "b" }])).toThrow(/same|exactly/);
  expect(() => packFacts<Record<string, unknown>>([{ id: "a", value: 1 }, { value: 2, id: "b" }])).toThrow();
});
