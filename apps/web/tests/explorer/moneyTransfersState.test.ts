import { expect, test } from "vitest";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
const state = () => import("../../lib/explorer/moneyTransfersState");

test("defaults to transfers received, the Georgia tab, a line chart and the all-country total only", async () => {
  const { parseMoneyTransfersHash } = await state();
  expect(parseMoneyTransfersHash("", data)).toEqual({ measure: "received", tab: "georgia", mode: "line", range: { kind: "all" }, selectedIds: ["transfer.total"] });
});

test("a mixed saved view round-trips and switching tabs keeps the selection", async () => {
  const { parseMoneyTransfersHash, serializeMoneyTransfersHash, setMoneyTransfersTab } = await state();
  const saved = parseMoneyTransfersHash("#sel=transfer.italy,bop.personal_transfers&tab=countries&measure=sent&view=table&start=2019&end=2019", data);
  expect(saved).toMatchObject({ measure: "sent", tab: "countries", mode: "table", selectedIds: ["bop.personal_transfers", "transfer.italy"] });
  expect(parseMoneyTransfersHash(serializeMoneyTransfersHash(saved), data)).toEqual(saved);
  expect(setMoneyTransfersTab(saved, "georgia").selectedIds).toEqual(saved.selectedIds);
});

test("an explicit empty selection stays empty; unknown, duplicate and bad values are dropped", async () => {
  const { parseMoneyTransfersHash, moneyTransfersBulkSelection } = await state();
  expect(parseMoneyTransfersHash("#sel=", data).selectedIds).toEqual([]);
  expect(parseMoneyTransfersHash("#sel=transfer.atlantis,transfer.italy,transfer.italy&measure=lent&tab=moon", data)).toMatchObject({ measure: "received", tab: "georgia", selectedIds: ["transfer.italy"] });
  expect(moneyTransfersBulkSelection(data)).toEqual(["transfer.total", "bop.personal_transfers", "transfer.italy", "transfer.sudan", "transfer.other_countries"]);
});
