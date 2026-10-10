import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { MoneyTransferEntity, MoneyTransferFact, MoneyTransfersAcceptance } from "../../../lib/data/externalFlows/types";

export const EXTERNAL_RESEARCH = "docs/Raw Data/External/2026-10-10";
const root = path.resolve(process.cwd(), "../..");
const scratch = path.join(root, ".superpowers/sdd/2026-10-10-money-from-abroad");
const researchFiles = ["artifact-manifest.csv", "money-transfers-annual.csv", "bop-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv", "independent-verification.json", "money-transfer-country-identities.csv"];
const directories: string[] = [];

export async function createMoneyTransfersPackageFixture(): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, "fixture-"));
  directories.push(directory);
  for (const name of [...researchFiles.map(file => path.join(EXTERNAL_RESEARCH, file)), "data/taxonomy/money-transfer-countries.json", "data/localization/en/labels.json"]) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await cp(path.join(root, name), path.join(directory, name));
  }
  return directory;
}

export async function cleanupMoneyTransfersFixtures() {
  for (const directory of directories) {
    if (!path.resolve(directory).startsWith(`${scratch}${path.sep}`)) throw new Error("Money transfer fixture cleanup outside owned workspace");
    await rm(directory, { recursive: true, force: true });
  }
}

export async function readMoneyTransfersReport(directory: string): Promise<MoneyTransfersAcceptance> {
  return JSON.parse(await readFile(path.join(directory, "data/reports/money-transfers-validation.json"), "utf8"));
}

export function moneyTransferEntities(): MoneyTransferEntity[] {
  return [
    { id: "transfer.total", kind: "total", labelKa: "ფულადი გზავნილები, სულ" },
    { id: "bop.personal_transfers", kind: "estimate", labelKa: "პირადი ტრანსფერები (ოფიციალური შეფასება)" },
    { id: "transfer.italy", kind: "country", labelKa: "იტალია" },
    { id: "transfer.sudan", kind: "country", labelKa: "სუდანი" },
    { id: "transfer.other_countries", kind: "remainder", labelKa: "სხვა ქვეყნები" },
  ];
}

const base = { unit: "usd", basis: "actual", vintage: "2026-09-15", lastReviewedAt: "2026-10-10", sourceUnit: "thousand_usd", sourceId: "source.nbg_money_transfers_by_countries", sourceSheet: "2012-2026 (eng) " } as const;
export function moneyTransferFacts(): MoneyTransferFact[] {
  const transfer = (entityId: string, year: number, measure: "received" | "sent", valueUsd: string | null, valueStatus: MoneyTransferFact["valueStatus"] = "numeric", monthsReported: number | null = 12): MoneyTransferFact =>
    ({ ...base, entityId, year, measure, valueUsd, valueStatus, monthsReported, sourceCells: "B5" });
  return [
    transfer("transfer.total", 2019, "received", "1000"), transfer("transfer.total", 2019, "sent", "100"),
    transfer("transfer.italy", 2019, "received", "600"), transfer("transfer.italy", 2019, "sent", "60"),
    transfer("transfer.sudan", 2019, "received", "400", "partial_months", 11), transfer("transfer.sudan", 2019, "sent", null, "blank", 0),
    transfer("transfer.other_countries", 2007, "received", "50"),
    { ...base, entityId: "bop.personal_transfers", year: 2019, measure: "received", valueUsd: "900", valueStatus: "numeric", monthsReported: null, sourceId: "source.nbg_balance_of_payments_bpm6", sourceSheet: "BOP–BPM6", sourceCells: "AE417", sourceUnit: "million_usd", vintage: "2026-09-30" },
  ];
}
