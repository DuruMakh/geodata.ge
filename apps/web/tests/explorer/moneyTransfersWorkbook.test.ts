import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { DEFAULT_MONEY_TRANSFERS_STATE } from "../../lib/explorer/moneyTransfersState";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() }, { 2019: 10000 });
const names = ["remc_money-transfers-by-countries-eng.xlsx", "bop-6_bopbpm6eng.xlsx"];
const sources: WorkbookPublicSource[] = names.map(name => ({ years: [2007, 2019], title: name, organization: "NBG", downloadHref: `/downloads/methodology/external-flows/files/${name}`, retrievedAt: "2026-10-10" }));
const englishLabels = { "transfer.total": "Money transfers, all countries", "bop.personal_transfers": "Personal transfers (official estimate)", "transfer.italy": "Italy", "transfer.sudan": "Sudan", "transfer.other_countries": "Other Countries" };
async function presentation(locale: "en" | "ka"): Promise<Presentation> {
  return { locale, englishLabels, messages: await getMessages(locale, ["workbook", "external"]) };
}
const builder = async () => (await import("../../lib/explorer/moneyTransfersWorkbook")).buildMoneyTransfersWorkbookModel;
const state = (change: Partial<typeof DEFAULT_MONEY_TRANSFERS_STATE>) => ({ ...DEFAULT_MONEY_TRANSFERS_STATE, ...change });

test.each(["en", "ka"] as const)("native %s workbook carries the selection, USD amounts, month counts and the original sources", async locale => {
  const p = await presentation(locale), build = await builder();
  const model = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ tab: "georgia", selectedIds: ["transfer.italy", "transfer.sudan", "bop.personal_transfers"], range: { kind: "manual", start: 2019, end: 2019 } }) }, p);
  expect(model.filename).toContain("money-from-abroad");
  expect(model.readable.rows.map(row => row.label)).toEqual(locale === "en" ? ["Personal transfers (official estimate)", "Italy", "Sudan"] : ["პირადი ტრანსფერები (ოფიციალური შეფასება)", "იტალია", "სუდანი"]);
  expect(model.analysis.rows.map(row => row[3])).toEqual([900, 600, 400]);
  expect(model.analysis.rows.map(row => row.at(-1))).toEqual([null, 12, 11]);
  expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|entity_id|source_cell/);
  expect(model.readable.subtitle).toContain(p.messages["external.workbook.partialNote"]);
  expect(model.readable.subtitle).toContain(p.messages["external.workbook.estimateNote"]);
  expect(model.sources.map(s => s.title)).toEqual(names);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  expect(excel.worksheets[1].getCell("D3").value).toBe(600);
});

test("sources and notes follow what is exported; blanks stay blank; an empty selection exports nothing", async () => {
  const p = await presentation("en"), build = await builder();
  const sent = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ measure: "sent", selectedIds: ["transfer.sudan"], range: { kind: "manual", start: 2019, end: 2019 } }) }, p);
  expect(sent.analysis.rows.map(row => row[3])).toEqual([null]);
  expect(sent.sources.map(s => s.title)).toEqual(["remc_money-transfers-by-countries-eng.xlsx"]);
  expect(sent.readable.subtitle).not.toContain(p.messages["external.workbook.partialNote"]);
  expect(sent.readable.subtitle).not.toContain(p.messages["external.workbook.estimateNote"]);
  const spanning = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: ["transfer.total"] }) }, p);
  expect(spanning.readable.subtitle).toContain(p.messages["external.workbook.breakNote"]);
  const empty = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: [] }) }, p);
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});
