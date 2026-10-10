import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { ForeignInvestmentAcceptance, ForeignInvestmentEntity, ForeignInvestmentFact, MoneyTransferEntity, MoneyTransferFact, MoneyTransfersAcceptance } from "../../../lib/data/externalFlows/types";

export const EXTERNAL_RESEARCH = "docs/Raw Data/External/2026-10-10";
const root = path.resolve(process.cwd(), "../..");
const scratch = path.join(root, ".superpowers/sdd/2026-10-10-money-from-abroad");
const researchFiles = ["artifact-manifest.csv", "money-transfers-annual.csv", "bop-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv", "independent-verification.json", "money-transfer-country-identities.csv"];
const directories: string[] = [];

export function createMoneyTransfersPackageFixture(): Promise<string> {
  return createPackageFixture([...researchFiles.map(file => path.join(EXTERNAL_RESEARCH, file)), "data/taxonomy/money-transfer-countries.json", "data/localization/en/labels.json"]);
}
export function createCurrentAccountPackageFixture(): Promise<string> {
  return createPackageFixture(["artifact-manifest.csv", "bop-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv", "independent-verification.json"].map(file => path.join(EXTERNAL_RESEARCH, file)));
}
export function createForeignInvestmentPackageFixture(): Promise<string> {
  return createPackageFixture([...["artifact-manifest.csv", "fdi-flows-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv", "independent-verification.json"].map(file => path.join(EXTERNAL_RESEARCH, file)), "data/taxonomy/foreign-investment.json", "data/localization/en/labels.json"]);
}

async function createPackageFixture(files: string[]): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, "fixture-"));
  directories.push(directory);
  for (const name of files) {
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

export async function readForeignInvestmentReport(directory: string): Promise<ForeignInvestmentAcceptance> {
  return JSON.parse(await readFile(path.join(directory, "data/reports/foreign-investment-validation.json"), "utf8"));
}

export function foreignInvestmentEntities(): ForeignInvestmentEntity[] {
  return [
    { id: "fdi.total", dimension: null, kind: "total", labelKa: "პირდაპირი უცხოური ინვესტიციები, სულ" },
    { id: "fdi.country.m49_826", dimension: "country", kind: "country", labelKa: "გაერთიანებული სამეფო" },
    { id: "fdi.country.unknown", dimension: "country", kind: "unallocated", labelKa: "უცნობი" },
    { id: "fdi.sector.k", dimension: "sector", kind: "sector", labelKa: "საფინანსო და სადაზღვევო საქმიანობა" },
    { id: "fdi.region.guria", dimension: "region", kind: "region", labelKa: "გურია" },
    { id: "fdi.region.tbilisi", dimension: "region", kind: "region", labelKa: "თბილისი" },
  ];
}

const fdiBase = { unit: "usd", basis: "actual", vintage: "2026-08-17", lastReviewedAt: "2026-10-10", sourceUnit: "thousand_usd", sourceSheet: "Sheet1", sourceCells: "B5" } as const;
export function foreignInvestmentFacts(): ForeignInvestmentFact[] {
  const fact = (entityId: string, year: number, valueUsd: string | null, sourceId: string, valueStatus: ForeignInvestmentFact["valueStatus"] = "numeric"): ForeignInvestmentFact => ({ ...fdiBase, entityId, year, valueUsd, valueStatus, sourceId });
  return [
    { ...fact("fdi.total", 2015, "1000", "source.geostat_fdi_by_quarters"), sourceUnit: "million_usd", vintage: "2026-09-08" },
    fact("fdi.country.m49_826", 2015, "-120.5", "source.geostat_fdi_by_countries"),
    fact("fdi.country.unknown", 2015, null, "source.geostat_fdi_by_countries", "not_applicable"),
    fact("fdi.sector.k", 2016, "300", "source.geostat_fdi_by_sectors"),
    fact("fdi.region.guria", 2015, null, "source.geostat_fdi_by_regions", "not_applicable"),
    fact("fdi.region.guria", 2016, "2", "source.geostat_fdi_by_regions"),
    fact("fdi.region.tbilisi", 2015, "50", "source.geostat_fdi_by_regions"),
    fact("fdi.region.tbilisi", 2016, "60", "source.geostat_fdi_by_regions"),
  ];
}
