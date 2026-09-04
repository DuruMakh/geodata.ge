import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAdminSpendingFacts } from "../lib/data/adminSpending/importAdminSpendingFacts";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_YEARS, MUNICIPAL_YEARS, REVENUE_YEARS } from "../lib/data/coverage";
import { validateFoundationReferences } from "../lib/data/foundationValidation";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadGeneralGovernmentBalanceFacts } from "../lib/data/generalGovernmentBalance/importGeneralGovernmentBalance";
import { loadNationalGdpFacts } from "../lib/data/nationalGdp/importNationalGdp";
import { checkMunicipalityGeometryOutputs } from "../lib/data/municipalGeometry/prepareMunicipalGeometry";
import {
  loadMunicipalityGeometrySources,
  validateMunicipalityGeometrySources,
} from "../lib/data/municipalGeometry/source";
import {
  loadMunicipalCountryFunctionFacts,
  loadMunicipalCountryTotalFacts,
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../lib/data/municipal/importMunicipalFacts";
import { loadAdjaraBudgetAdjustments } from "../lib/data/municipal/importAdjaraBudgetAdjustments";
import { loadMunicipalitiesFile } from "../lib/data/municipal/municipalitiesFile";
import { loadMunicipalPopulationFacts } from "../lib/data/municipal/importMunicipalPopulation";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../lib/data/municipal/taxonomyFiles";
import {
  assertMunicipalAggregateSourceIds,
  assertMunicipalCountryPanel,
} from "../lib/data/municipal/sourceValidation";
import { SERVED_DATA_FILES } from "../lib/data/servedData";
import { loadSourceDocuments, referencedSourceIds } from "../lib/data/sources";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";
import { budgetRowsToCsvRows } from "./compose-budget-facts";

function sortedYears(years: number[]): number[] {
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

function assertYears(label: string, actual: number[], expected: number[]) {
  const actualText = actual.join(",");
  const expectedText = expected.join(",");
  if (actualText !== expectedText) {
    throw new Error(`${label} years mismatch. Expected ${expectedText}, got ${actualText}`);
  }
}
function composedFactsMatchSideFiles(
  expenditureRows: Awaited<ReturnType<typeof loadBudgetFactRows>>,
  revenueRows: Awaited<ReturnType<typeof loadBudgetFactRows>>,
  facts: Awaited<ReturnType<typeof loadBudgetFactRows>>,
): boolean {
  return JSON.stringify(budgetRowsToCsvRows([...expenditureRows, ...revenueRows])) === JSON.stringify(budgetRowsToCsvRows(facts));
}

async function main() {
  const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
  // The served datasets come from SERVED_DATA_FILES so this gate, the site and
  // the database import all read the same served-data paths. The two side
  // files below are not served — they are the compose inputs this script
  // cross-checks.
  const glossary = await loadGlossary(SERVED_DATA_FILES.glossary);
  const sources = await loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments);
  const expenditureRows = await loadBudgetFactRows("../../data/imports/expenditure-facts-2004-2025.csv");
  const revenueRows = await loadBudgetFactRows("../../data/imports/revenue-facts-2004-2025.csv");
  const facts = await loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts);
  const adminSpendingFacts = await loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts);
  const nationalGdpFacts = await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts);
  const generalGovernmentBalanceFacts = await loadGeneralGovernmentBalanceFacts(
    "../../data/imports/general-government-balance-annual-1995-2031.csv",
  );
  const municipalFunctions = await loadMunicipalFunctionsFile(SERVED_DATA_FILES.municipalFunctions);
  const municipalRegions = await loadMunicipalRegionsFile(SERVED_DATA_FILES.municipalRegions);
  const municipalities = await loadMunicipalitiesFile(SERVED_DATA_FILES.municipalities);
  const municipalFunctionFacts = await loadMunicipalFunctionFacts(SERVED_DATA_FILES.municipalFunctionFacts);
  const municipalTotalFacts = await loadMunicipalTotalFacts(SERVED_DATA_FILES.municipalTotalFacts);
  const countryFunctionFacts = await loadMunicipalCountryFunctionFacts(
    SERVED_DATA_FILES.municipalCountryFunctionFacts,
  );
  const countryTotalFacts = await loadMunicipalCountryTotalFacts(
    SERVED_DATA_FILES.municipalCountryTotalFacts,
  );
  const adjaraBudgetAdjustments = await loadAdjaraBudgetAdjustments(
    SERVED_DATA_FILES.municipalAdjaraBudgetAdjustments,
  );
  const municipalPopulationFacts = await loadMunicipalPopulationFacts(
    SERVED_DATA_FILES.municipalPopulationFacts,
  );
  const report = buildImportReport("real-budget-2004-2025", facts);
  const missingGlossary = taxonomy.filter((item) => !glossary.has(item.id));
  const registeredSourceIds = new Set(sources.map((source) => source.sourceId));
  for (const sourceId of referencedSourceIds(generalGovernmentBalanceFacts)) {
    if (!registeredSourceIds.has(sourceId)) {
      throw new Error(`General-government balance source is not registered: ${sourceId}`);
    }
  }
  const unresolvedAdminSpendingSourceIds = Array.from(
    new Set(
      adminSpendingFacts
        .flatMap((fact) => fact.sourceId.split(";"))
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();
  const unresolvedGdpSourceIds = Array.from(
    new Set(
      nationalGdpFacts
        .map((fact) => fact.sourceId)
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();
  const gdpYears = new Set(nationalGdpFacts.map((fact) => fact.year));
  const nationalBudgetYears = sortedYears(facts.map((fact) => fact.year));
  const missingGdpYears = nationalBudgetYears.filter((year) => !gdpYears.has(year));

  assertYears("Expenditure", sortedYears(expenditureRows.map((row) => row.year)), EXPENDITURE_YEARS);
  assertYears("Revenue", sortedYears(revenueRows.map((row) => row.year)), REVENUE_YEARS);
  assertYears("Admin spending", sortedYears(adminSpendingFacts.map((row) => row.year)), ADMIN_SPENDING_YEARS);
  assertYears("Municipal", sortedYears(municipalFunctionFacts.map((row) => row.year)), MUNICIPAL_YEARS);
  assertYears(
    "Adjara budget adjustments",
    sortedYears(adjaraBudgetAdjustments.map((row) => row.year)),
    MUNICIPAL_YEARS,
  );
  const municipalCodes = new Set(municipalities.map((row) => row.code));
  const populationCodes = municipalPopulationFacts.map((row) => row.municipalityCode);
  const missingPopulationCodes = [...municipalCodes].filter((code) => !populationCodes.includes(code));
  const unexpectedPopulationCodes = populationCodes.filter((code) => !municipalCodes.has(code));
  if (
    municipalPopulationFacts.length !== municipalities.length ||
    new Set(populationCodes).size !== populationCodes.length ||
    missingPopulationCodes.length > 0 ||
    unexpectedPopulationCodes.length > 0
  ) {
    throw new Error(
      `Municipal population 2025 panel mismatch; expected ${municipalities.length} unique rows; ` +
        `missing: ${missingPopulationCodes.join(", ") || "none"}; ` +
        `unexpected: ${unexpectedPopulationCodes.join(", ") || "none"}`,
    );
  }
  const regionIds = new Set(municipalRegions.map((region) => region.id));
  const municipalCategoryIds = new Set(municipalFunctions.map((entry) => entry.id));
  assertMunicipalCountryPanel({
    functionFacts: countryFunctionFacts,
    totalFacts: countryTotalFacts,
    categoryIds: municipalCategoryIds,
    registeredSourceIds,
  });
  assertMunicipalAggregateSourceIds(
    "Adjara budget adjustments",
    adjaraBudgetAdjustments.flatMap((row) => [row.republicSourceId, row.transferSourceId]),
    registeredSourceIds,
  );
  const municipalityGeometrySources = await loadMunicipalityGeometrySources();

  validateMunicipalityGeometrySources(municipalityGeometrySources, Array.from(municipalCodes));
  await checkMunicipalityGeometryOutputs();

  const unknownRegions = municipalities.filter((row) => !regionIds.has(row.regionId));
  if (unknownRegions.length > 0) {
    throw new Error(
      `Municipalities reference unknown regions: ${unknownRegions.map((row) => `${row.code}→${row.regionId}`).join(", ")}`,
    );
  }

  const unknownCategories = Array.from(
    new Set(municipalFunctionFacts.filter((fact) => !municipalCategoryIds.has(fact.categoryId)).map((fact) => fact.categoryId)),
  ).sort();
  if (unknownCategories.length > 0) {
    throw new Error(`Municipal facts reference unknown categories: ${unknownCategories.join(", ")}`);
  }

  const unknownMunicipalities = Array.from(
    new Set(
      [...municipalFunctionFacts, ...municipalTotalFacts]
        .filter((fact) => !municipalCodes.has(fact.municipalityCode))
        .map((fact) => fact.municipalityCode),
    ),
  ).sort();
  if (unknownMunicipalities.length > 0) {
    throw new Error(`Municipal facts reference unregistered municipalities: ${unknownMunicipalities.join(", ")}`);
  }

  const unresolvedMunicipalSourceIds = Array.from(
    new Set(
      [...municipalFunctionFacts, ...municipalTotalFacts]
        .map((fact) => fact.sourceId)
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();
  if (unresolvedMunicipalSourceIds.length > 0) {
    throw new Error(`Municipal facts reference unknown source documents: ${unresolvedMunicipalSourceIds.join(", ")}`);
  }
  const unresolvedPopulationSourceIds = Array.from(
    new Set(
      municipalPopulationFacts
        .map((fact) => fact.sourceId)
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();
  if (unresolvedPopulationSourceIds.length > 0) {
    throw new Error(
      `Municipal population facts reference unknown source documents: ${unresolvedPopulationSourceIds.join(", ")}`,
    );
  }

  const expectedFunctionRows = municipalFunctions.length * municipalities.length * MUNICIPAL_YEARS.length;
  if (municipalFunctionFacts.length !== expectedFunctionRows) {
    throw new Error(
      `Municipal function facts must be dense: expected ${expectedFunctionRows} rows, got ${municipalFunctionFacts.length}. ` +
        "Re-run npm run data:generate-municipal-facts.",
    );
  }

  const expectedTotalRows = municipalities.length * MUNICIPAL_YEARS.length;
  if (municipalTotalFacts.length !== expectedTotalRows) {
    throw new Error(
      `Municipal total facts must be dense: expected ${expectedTotalRows} rows, got ${municipalTotalFacts.length}.`,
    );
  }

  // Density alone does not prove uniqueness — 7,040 rows could still contain a
  // duplicate and a hole. The import asserts this too, but the import needs a
  // database and CI runs this gate without one.
  const functionKeys = municipalFunctionFacts.map(
    (fact) => `${fact.year}:${fact.municipalityCode}:${fact.categoryId}`,
  );
  if (new Set(functionKeys).size !== functionKeys.length) {
    throw new Error("Municipal function facts contain duplicate (year, municipality, category) keys.");
  }

  const totalKeys = municipalTotalFacts.map((total) => `${total.year}:${total.municipalityCode}`);
  if (new Set(totalKeys).size !== totalKeys.length) {
    throw new Error("Municipal total facts contain duplicate (year, municipality) keys.");
  }

  const unusedRegions = municipalRegions
    .filter((region) => !municipalities.some((row) => row.regionId === region.id))
    .map((region) => region.id);
  if (unusedRegions.length > 0) {
    throw new Error(`Regions with no municipalities: ${unusedRegions.join(", ")}`);
  }

  if (missingGlossary.length > 0) {
    throw new Error(`Missing glossary rows: ${missingGlossary.map((item) => item.id).join(", ")}`);
  }

  validateFoundationReferences({ taxonomy, sources, facts });
  if (unresolvedAdminSpendingSourceIds.length > 0) {
    throw new Error(
      `Admin spending facts reference unknown source documents: ${unresolvedAdminSpendingSourceIds.join(", ")}`,
    );
  }
  if (unresolvedGdpSourceIds.length > 0) {
    throw new Error(`GDP facts reference unknown source documents: ${unresolvedGdpSourceIds.join(", ")}`);
  }
  if (missingGdpYears.length > 0) {
    throw new Error(`National budget years missing a GDP denominator: ${missingGdpYears.join(", ")}`);
  }

  if (!composedFactsMatchSideFiles(expenditureRows, revenueRows, facts)) {
    throw new Error("Combined budget facts are stale. Run npm run data:compose-budget-facts.");
  }

  const reportPath = path.resolve(
    process.cwd(),
    "../../data/reports/real-budget-2004-2025-import-report.json",
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Validated municipal function rows: ${municipalFunctionFacts.length}`);
  console.log(`Validated municipal total rows: ${municipalTotalFacts.length}`);
  console.log(`Validated Georgia municipal function rows: ${countryFunctionFacts.length}`);
  console.log(`Validated Georgia municipal total rows: ${countryTotalFacts.length}`);
  console.log(`Validated Adjara budget adjustment rows: ${adjaraBudgetAdjustments.length}`);
  console.log(`Validated municipal population rows: ${municipalPopulationFacts.length}`);
  console.log(`Validated municipalities: ${municipalities.length}`);
  console.log(`Validated municipality map polygons: ${municipalityGeometrySources.municipalities.features.length}`);
  console.log(`Validated taxonomy rows: ${taxonomy.length}`);
  console.log(`Validated glossary rows: ${glossary.size}`);
  console.log(`Validated source rows: ${sources.length}`);
  console.log(`Validated fact rows: ${facts.length}`);
  console.log(`Validated admin spending fact rows: ${adminSpendingFacts.length}`);
  console.log(`Validated national GDP fact rows: ${nationalGdpFacts.length}`);
  console.log(
    `Validated general-government balance fact rows: ${generalGovernmentBalanceFacts.length}`,
  );
  console.log(`Report written: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
