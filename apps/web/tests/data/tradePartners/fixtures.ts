import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { TradePartnerEntity, TradePartnerFact, TradePartnersAcceptance } from "../../../lib/data/tradePartners/types";
import type { TradeOverviewFact } from "../../../lib/data/tradeOverview/types";

export const TRADE_RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
const root = path.resolve(process.cwd(), "../..");
const scratch = path.join(root, ".superpowers/sdd/2026-10-08-trade-partners");
const sourceFiles = ["full-source-manifest.json", "coverage.csv", "source-layouts.json", "expected-observation-inventory.json", "goods-countries-annual.csv", "goods-country-groups-annual.csv", "prepared-validation.json", "prepared-reconciliation.csv", "unresolved-source-issues.json", "identity-review.csv", "official/Export-Country_1995-2026.xlsx", "official/Import-Country-1995-2026.xlsx", "official/Export-_Country_Group-1995-2026.xlsx", "official/Import_Country_Group-1995-2026.xlsx"];
export const tradeFixtureDirectories: string[] = [];

export async function createTradePartnersPackageFixture(): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, "fixture-"));
  tradeFixtureDirectories.push(directory);
  for (const name of sourceFiles) {
    const target = path.join(directory, TRADE_RESEARCH, name);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, TRADE_RESEARCH, name), target);
  }
  for (const name of ["data/taxonomy/trade-partners.json", "data/localization/en/labels.json", "data/imports/trade-overview-annual.csv", "data/reports/trade-overview-validation.json"]) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, name), target);
  }
  return directory;
}

export async function cleanupTradePartnersFixtures() {
  for (const directory of tradeFixtureDirectories) {
    if (!path.resolve(directory).startsWith(`${scratch}${path.sep}`)) throw new Error("Trade fixture cleanup outside owned workspace");
    await rm(directory, { recursive: true, force: true });
  }
}

export async function readTradePartnersReport(directory: string): Promise<TradePartnersAcceptance> {
  return JSON.parse(await readFile(path.join(directory, "data/reports/trade-partners-validation.json"), "utf8"));
}

export function tradePartnerEntities(): TradePartnerEntity[] {
  return [
    { id: "partner.1995-2025.643", kind: "country", sourceCode: "643", labelKa: "რუსეთი" },
    { id: "partner.1995-2025.530", kind: "country", sourceCode: "530", labelKa: "ნიდერლანდების ანტილის კუნძულები" },
    { id: "group.eu", kind: "group", sourceCode: null, labelKa: "ევროკავშირი (EU)" },
    { id: "group.oecd", kind: "group", sourceCode: null, labelKa: "ეკონომიკური თანამშრომლობისა და განვითარების ორგანიზაცია (OECD)" },
  ];
}

export function tradePartnerFacts(): TradePartnerFact[] {
  const definitions = [
    { id: "partner.1995-2025.643", kind: "country", label: "Russia", exports: 150, imports: 300, row: 8 },
    { id: "group.eu", kind: "group", label: "European Union countries (EU)", exports: 400, imports: 200, row: 7 },
    { id: "group.oecd", kind: "group", label: "OECD", exports: 800, imports: 100, row: 10 },
  ];
  return [2024, 2025].flatMap(year => {
    const ratio = year === 2025 ? 1 : 0.8, column = year === 2025 ? "AG" : "AF";
    const common = { year, unit: "usd" as const, basis: "actual" as const, valueStatus: "numeric" as const, publicationStatus: "unspecified" as const, sourceBlock: "1995-2025", lastReviewedAt: "2026-10-08" };
    const facts = definitions.flatMap(def => {
      const source = (flow: "export" | "import") => `geostat_trade_${flow}${def.kind === "country" ? "-country" : flow === "export" ? "--country-group" : "-country-group"}-1995-2026`;
      const exportRef = [source("export"), "1995-2025-years", `${column}${def.row}`], importRef = [source("import"), "1995-2025-years", `${column}${def.row}`];
      const base = { ...common, entityId: def.id }, e = def.exports * ratio, i = def.imports * ratio;
      const role = def.kind === "country" ? "detail" as const : "subtotal" as const;
      return [
        { ...base, indicatorId: "trade.exports" as const, valueUsd: String(e), role, sourceId: source("export"), sourceRefs: JSON.stringify([exportRef]), sourceValue: String(e / 1000), sourceUnit: "thousand_usd", sourceLabel: def.label, sourceNumberFormat: "#,##0.0" },
        { ...base, indicatorId: "trade.imports" as const, valueUsd: String(i), role, sourceId: source("import"), sourceRefs: JSON.stringify([importRef]), sourceValue: String(i / 1000), sourceUnit: "thousand_usd", sourceLabel: def.label, sourceNumberFormat: "#,##0.0" },
        ...(["trade.turnover", "trade.balance"] as const).map(indicatorId => ({ ...base, indicatorId, valueUsd: String(indicatorId === "trade.turnover" ? e + i : e - i), role: "derived" as const, sourceId: source("export"), sourceRefs: JSON.stringify([exportRef, importRef]), sourceValue: null, sourceUnit: null, sourceLabel: null, sourceNumberFormat: null })),
      ];
    });
    return [...facts, { ...common, entityId: "partner.1995-2025.530", indicatorId: "trade.imports" as const, valueUsd: null, valueStatus: "not_applicable" as const, role: "detail" as const, sourceId: "geostat_trade_import-country-1995-2026", sourceRefs: JSON.stringify([["geostat_trade_import-country-1995-2026", "1995-2025-years", `${column}155`]]), sourceValue: "-", sourceUnit: "thousand_usd", sourceLabel: "Netherlands Antilles", sourceNumberFormat: "#,##0.0" }];
  });
}

export function tradePartnerNationalFacts(): TradeOverviewFact[] {
  return [2024, 2025].flatMap(year => {
    const ratio = year === 2025 ? 1 : 0.8, e = 1000 * ratio, i = 2000 * ratio, column = year === 2025 ? "AF" : "AE";
    const sourceId = "geostat_trade_ftrade-1995-2026", exportRef = [sourceId, "1995-2026", `${column}5`], importRef = [sourceId, "1995-2026", `${column}20`];
    return (["trade.exports", "trade.imports", "trade.turnover", "trade.balance"] as const).map(indicatorId => {
      const primary = indicatorId === "trade.exports" || indicatorId === "trade.imports", isExport = indicatorId === "trade.exports";
      const value = isExport ? e : indicatorId === "trade.imports" ? i : indicatorId === "trade.turnover" ? e + i : e - i;
      return { year, indicatorId, valueUsd: String(value), unit: "usd", basis: "actual", valueStatus: "numeric", publicationStatus: "unspecified", role: primary ? "total" : "derived", sourceId, sourceRefs: JSON.stringify(primary ? [isExport ? exportRef : importRef] : [exportRef, importRef]), sourceValue: primary ? String(value / 1_000_000) : null, sourceUnit: primary ? "million_usd" : null, sourceLabel: primary ? isExport ? "Exports" : "Imports" : null, sourceNumberFormat: primary ? "#,##0.0" : null, lastReviewedAt: "2026-10-08" };
    });
  });
}

export function tradePartnersFixtureAcceptance(): TradePartnersAcceptance {
  return { status: "passed", scope: "annual_goods_partners", years: [2024, 2025], countryEntities: 2, groupEntities: 2, primaryObservations: 14, derivedObservations: 12, primaryValueStatusCounts: { numeric: 12, blank: 0, not_applicable: 2 }, sourceSha256: {}, inputSha256: {}, canonicalSha256: "a".repeat(64), catalogueSha256: "b".repeat(64), englishLabelsSha256: "c".repeat(64), reviewedAt: "2026-10-08", researchPackageStatus: "requires_source_resolution", outsideScopeHoldCount: 2 };
}
