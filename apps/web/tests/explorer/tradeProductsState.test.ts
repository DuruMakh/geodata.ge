import { expect, test } from "vitest";
import { readTradeProductCatalogue } from "../../lib/data/tradeProducts/catalogue";
import path from "node:path";
import { productData } from "./tradeProductsFixtures";

const statePath = "../../lib/explorer/tradeProductsState", codecPath = "../../lib/explorer/tradeProductsSelection";
const stateModule = () => import(statePath) as Promise<typeof import("../../lib/explorer/tradeProductsState")>;
const codecModule = () => import(codecPath) as Promise<typeof import("../../lib/explorer/tradeProductsSelection")>;
test("starts with only the removable national export reference and loaded coverage", async () => {
  const { parseTradeProductsHash: parse, tradeProductsCoverage, DEFAULT_TRADE_PRODUCTS_STATE: initial } = await stateModule();
  const data = productData();
  expect(parse("", data)).toEqual({ ...initial, selectionReset: false });
  expect(initial).toMatchObject({ mode: "line", measure: "trade.exports", selectedIds: ["goods.total"], range: { kind: "all" } });
  expect(tradeProductsCoverage(data)).toEqual({ min: 2019, max: 2025, years: [2019, 2024, 2025] });
});
test("round-trips full and empty catalogue-bound selection in a short token", async () => {
  const { tradeProductsBulkSelection } = await stateModule();
  const { encodeTradeProductsSelection: encode, decodeTradeProductsSelection: decode } = await codecModule();
  const data = { ...productData(), entities: await readTradeProductCatalogue(path.resolve(process.cwd(), "../..")) };
  const all = tradeProductsBulkSelection(data);
  expect(all).toHaveLength(4769); expect(all[0]).toBe("goods.total");
  for (const selected of [all, [], ["goods.total"], [all[1], all.at(-1)!]]) {
    const token = encode(selected, data);
    expect(token.length).toBeLessThan(1024);
    expect(decode(token, data)).toEqual({ selectedIds: selected, invalid: false });
    expect(decode(token, { ...data, catalogueFingerprint: "b".repeat(64) }).invalid).toBe(true);
  }
});
test("malformed, wrong-version, wrong-length and unused-bit tokens cannot select other products", async () => {
  const { encodeTradeProductsSelection: encode, decodeTradeProductsSelection: decode } = await codecModule();
  const data = productData(), token = encode(["goods.total"], data), prefix = `v1.${data.catalogueFingerprint}.`;
  for (const bad of ["", "garbage", token.replace("v1.", "v2."), `${prefix}*`, `${prefix}AAA`, `${prefix}gQ`]) expect(decode(bad, data).invalid).toBe(true);
});
test("restores flow, empty selection, table and clamped years from the hash", async () => {
  const { parseTradeProductsHash: parse, serializeTradeProductsHash: serialize } = await stateModule();
  const data = productData(), saved = { mode: "table" as const, measure: "trade.imports" as const, range: { kind: "manual" as const, start: 2024, end: 2025 }, selectedIds: [] };
  expect(parse(serialize(saved, data), data)).toEqual({ ...saved, selectionReset: false });
  expect(parse("#measure=trade.balance&start=1800&end=2024", data)).toMatchObject({ measure: "trade.exports", range: { kind: "manual", start: 2024, end: 2024 } });
  expect(parse("#sel=broken", data)).toMatchObject({ selectedIds: ["goods.total"], selectionReset: true });
});

test("restores saved years against selected product coverage rather than the entire catalogue", async () => {
  const { parseTradeProductsHash: parse, serializeTradeProductsHash: serialize } = await stateModule();
  const data = productData(), selectedIds = ["goods.hs4.2020-2025.8703"];
  const saved = { mode: "line" as const, measure: "trade.exports" as const, range: { kind: "manual" as const, start: 1995, end: 2025 }, selectedIds };
  expect(parse(serialize(saved, data), data)).toMatchObject({ selectedIds, range: { kind: "all" } });
  expect(parse(serialize({ ...saved, range: { kind: "manual", start: 1995, end: 2024 } }, data), data)).toMatchObject({ selectedIds, range: { kind: "manual", start: 2024, end: 2024 } });
  expect(parse(serialize({ ...saved, range: { kind: "manual", start: 2025, end: 2025 } }, data), data)).toMatchObject({ selectedIds, range: { kind: "manual", start: 2025, end: 2025 } });
});
