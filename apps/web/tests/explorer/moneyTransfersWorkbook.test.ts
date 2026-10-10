import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { DEFAULT_MONEY_TRANSFERS_STATE } from "../../lib/explorer/moneyTransfersState";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
const names = ["remc_money-transfers-by-countries-eng.xlsx", "bop-6_bopbpm6eng.xlsx"], transfersFile = names[0];
const sources: WorkbookPublicSource[] = names.map(name => ({ years: [2007, 2019], title: name, organization: "NBG", downloadHref: `/downloads/methodology/external-flows/files/${name}`, retrievedAt: "2026-10-10" }));
const englishLabels = { "transfer.total": "Money transfers, all countries", "bop.personal_transfers": "Personal transfers (official estimate)", "transfer.italy": "Italy", "transfer.sudan": "Sudan", "transfer.other_countries": "Other Countries" };
async function presentation(locale: "en" | "ka"): Promise<Presentation> {
  return { locale, englishLabels, messages: await getMessages(locale, ["workbook", "external"]) };
}
const builder = async () => (await import("../../lib/explorer/moneyTransfersWorkbook")).buildMoneyTransfersWorkbookModel;
const state = (change: Partial<typeof DEFAULT_MONEY_TRANSFERS_STATE>) => ({ ...DEFAULT_MONEY_TRANSFERS_STATE, ...change });

test.each(["en", "ka"] as const)("native %s workbook carries the selection, USD amounts, month counts and the original sources", async locale => {
  const p = await presentation(locale), build = await builder();
  const model = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: ["transfer.italy", "transfer.sudan"], range: { kind: "manual", start: 2019, end: 2019 } }) }, p);
  expect(model.filename).toContain("money-from-abroad");
  expect(model.readable.rows.map(row => row.label)).toEqual(locale === "en" ? ["Italy", "Sudan"] : ["იტალია", "სუდანი"]);
  expect(model.analysis.rows.map(row => row[3])).toEqual([600, 400]);
  expect(model.analysis.rows.map(row => row.at(-1))).toEqual([12, 11]);
  expect(model.analysis.headers.join(" ")).not.toMatch(/GEL|₾|entity_id|source_cell/);
  expect(model.readable.subtitle).toContain(p.messages["external.workbook.partialNote"]);
  expect(model.sources.map(s => s.title)).toEqual([transfersFile]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  expect(excel.worksheets[1].getCell("D2").value).toBe(600);
});

test("only the money-transfer original is linked; notes follow what is exported; blanks stay blank; an empty selection exports nothing", async () => {
  const p = await presentation("en"), build = await builder();
  const sent = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ measure: "sent", selectedIds: ["transfer.sudan"], range: { kind: "manual", start: 2019, end: 2019 } }) }, p);
  expect(sent.analysis.rows.map(row => row[3])).toEqual([null]);
  expect(sent.sources.map(s => s.title)).toEqual([transfersFile]);
  expect(sent.readable.subtitle).not.toContain(p.messages["external.workbook.partialNote"]);
  const empty = build({ data, sources, siteOrigin: "https://fiscal.ge", state: state({ selectedIds: [] }) }, p);
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});
