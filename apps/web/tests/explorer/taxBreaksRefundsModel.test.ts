import { beforeAll, expect, test } from "vitest";
import { loadTaxBreaksRefundsFacts, toClientTaxBreaksRefundsFact } from "../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds";
import type { ClientTaxBreaksRefundsFact } from "../../lib/data/taxBreaksRefunds/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import { projectGdpFact, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { colorForItem } from "../../lib/explorer/colors";
import { ciede2000, contrastRatio } from "../helpers/contrast";
import {
  TAX_BREAKS_REFUNDS_DEFAULT, TAX_BREAKS_REFUNDS_SERIES, buildTaxBreaksRefundsModel, parseTaxBreaksRefundsHash, serializeTaxBreaksRefundsHash,
  taxBreaksRefundsCoverage, taxBreaksRefundsHeadline,
} from "../../lib/explorer/taxBreaksRefunds";

let facts: ClientTaxBreaksRefundsFact[];
let gdpFacts: ClientNationalGdpFact[];
beforeAll(async () => {
  facts = (await loadTaxBreaksRefundsFacts()).map(toClientTaxBreaksRefundsFact);
  gdpFacts = (await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts)).map(projectGdpFact);
});
const VAT = TAX_BREAKS_REFUNDS_SERIES.filter(s => s.heading === "vat").map(s => s.id);

test("arriving selects both totals over 2008-2025", () => {
  const state = parseTaxBreaksRefundsHash("", facts, gdpFacts);
  expect(state).toMatchObject({ view: "amount", mode: "line", selectedIds: ["tax_breaks.total", "tax_refunds.total"] });
  expect(TAX_BREAKS_REFUNDS_DEFAULT).toEqual(["tax_breaks.total", "tax_refunds.total"]);
  expect(buildTaxBreaksRefundsModel(facts, state, gdpFacts).range).toMatchObject({ start: 2008, end: 2025 });
});

test("the list keeps the 16 series in order under four headings", () => {
  expect(TAX_BREAKS_REFUNDS_SERIES.map(s => s.id)).toHaveLength(16);
  expect(TAX_BREAKS_REFUNDS_SERIES.map(s => s.heading)).toEqual(["breaks", ...Array(9).fill("vat"), ...Array(5).fill("income"), "refunds"]);
  expect(TAX_BREAKS_REFUNDS_SERIES.every(s => !s.reference)).toBe(true);
});

test("VAT rows alone cover 2018-2024", () => {
  expect(taxBreaksRefundsCoverage("amount", VAT, facts, gdpFacts)).toMatchObject({ min: 2018, max: 2024 });
  expect(taxBreaksRefundsCoverage("amount", [], facts, gdpFacts)).toMatchObject({ min: 2008, max: 2025 });
});

test("a refunds-only link keeps its own years", () => {
  const state = parseTaxBreaksRefundsHash("#sel=tax_refunds.total&start=2008&end=2012", facts, gdpFacts);
  expect(state.selectedIds).toEqual(["tax_refunds.total"]);
  expect(buildTaxBreaksRefundsModel(facts, state, gdpFacts).range).toMatchObject({ start: 2008, end: 2012 });
});

test("VAT rows alone over years before the report fall back to the report's years", () => {
  const state = { ...parseTaxBreaksRefundsHash("", facts, gdpFacts), selectedIds: VAT, range: { kind: "manual" as const, start: 2008, end: 2017 } };
  expect(buildTaxBreaksRefundsModel(facts, state, gdpFacts).range).toMatchObject({ start: 2018, end: 2024 });
});

test("the % of GDP view divides by the site's GDP, preliminary 2025 included", () => {
  const model = buildTaxBreaksRefundsModel(facts, parseTaxBreaksRefundsHash("#tab=gdp", facts, gdpFacts), gdpFacts);
  expect(model.unit).toBe("percent");
  expect(model.series.find(s => s.id === "tax_breaks.total")!.valuesByYear[2024]).toBeCloseTo(6.88, 2);
  expect(model.series.find(s => s.id === "tax_refunds.total")!.valuesByYear[2025]).toBeCloseTo(2721.1 / 104598.1 * 100, 6);
  expect(buildTaxBreaksRefundsModel(facts, parseTaxBreaksRefundsHash("", facts, gdpFacts), gdpFacts).unit).toBe("gel");
});

test("a % of GDP link survives a round trip", () => {
  const state = { ...parseTaxBreaksRefundsHash("#tab=gdp", facts, gdpFacts), mode: "table" as const, selectedIds: ["tax_breaks.vat.total", "tax_refunds.total"], range: { kind: "manual" as const, start: 2019, end: 2023 } };
  const hash = serializeTaxBreaksRefundsHash(state);
  expect(hash).toContain("tab=gdp");
  expect(parseTaxBreaksRefundsHash(`#${hash}`, facts, gdpFacts)).toEqual(state);
  expect(serializeTaxBreaksRefundsHash({ ...state, view: "amount" })).not.toContain("tab=");
});

test("the headline gives the latest refunds and tax breaks in lari", () => {
  const headline = taxBreaksRefundsHeadline(facts);
  expect(headline.refunds).toEqual({ year: 2025, value: 2.7211e9 });
  expect(headline.breaks.year).toBe(2024);
  expect(headline.breaks.value).toBeCloseTo(6.40318e9, -4);
});

test("every series has its own readable colour", () => {
  const colours = TAX_BREAKS_REFUNDS_SERIES.map((s, index) => [s.id, colorForItem(s.id, index)] as const);
  for (const [id, colour] of colours) expect(Math.min(contrastRatio(colour, "#F7F2E9"), contrastRatio(colour, "#F1EADC")), id).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < colours.length; i += 1) for (let j = i + 1; j < colours.length; j += 1)
    expect(ciede2000(colours[i][1], colours[j][1]), `${colours[i][0]} vs ${colours[j][0]}`).toBeGreaterThanOrEqual(10);
});
