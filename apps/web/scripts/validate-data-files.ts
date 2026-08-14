import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAdminSpendingFacts } from "../lib/data/adminSpending/importAdminSpendingFacts";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_YEARS, MUNICIPAL_YEARS, REVENUE_YEARS } from "../lib/data/coverage";
import { validateFoundationReferences } from "../lib/data/foundationValidation";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadSpendingMappings } from "../lib/data/mappings";
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
import { loadMunicipalitiesFile } from "../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../lib/data/municipal/taxonomyFiles";
import { MUNICIPAL_COUNTRY_ID } from "../lib/data/municipal/types";
import { SERVED_DATA_FILES } from "../lib/data/servedData";
import { loadSourceDocuments } from "../lib/data/sources";
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
  const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
  const expenditureRows = await loadBudgetFactRows("../../data/imports/expenditure-facts-2005-2025.csv");
  const revenueRows = await loadBudgetFactRows("../../data/imports/revenue-facts-2005-2025.csv");
  const facts = await loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts);
  const adminSpendingFacts = await loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts);
  const nationalGdpFacts = await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts);
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
  const report = buildImportReport("real-budget-2004-2025", facts);
  const missingGlossary = taxonomy.filter((item) => !glossary.has(item.id));
  const registeredSourceIds = new Set(sources.map((source) => source.sourceId));
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
    "Georgia municipal function facts",
    sortedYears(countryFunctionFacts.map((row) => row.year)),
    MUNICIPAL_YEARS,
  );
  assertYears(
    "Georgia municipal total facts",
    sortedYears(countryTotalFacts.map((row) => row.year)),
    MUNICIPAL_YEARS,
  );

  const municipalCodes = new Set(municipalities.map((row) => row.code));
  const regionIds = new Set(municipalRegions.map((region) => region.id));
  const municipalCategoryIds = new Set(municipalFunctions.map((entry) => entry.id));
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

  const countryCategoryIds = new Set(countryFunctionFacts.map((fact) => fact.categoryId));
  const unknownCountryCategories = [...countryCategoryIds]
    .filter((categoryId) => !municipalCategoryIds.has(categoryId))
    .sort();
  const missingCountryCategories = [...municipalCategoryIds]
    .filter((categoryId) => !countryCategoryIds.has(categoryId))
    .sort();
  if (unknownCountryCategories.length > 0 || missingCountryCategories.length > 0) {
    throw new Error(
      `Georgia municipal categories mismatch. Unknown: ${unknownCountryCategories.join(", ") || "none"}; ` +
        `missing: ${missingCountryCategories.join(", ") || "none"}.`,
    );
  }

  const countryScopes = new Set(
    [...countryFunctionFacts, ...countryTotalFacts].map((fact) => fact.municipalityCode),
  );
  if (countryScopes.size !== 1 || !countryScopes.has(MUNICIPAL_COUNTRY_ID)) {
    throw new Error(
      `Georgia municipal facts must use scope ${MUNICIPAL_COUNTRY_ID}, got ${[...countryScopes].join(", ")}.`,
    );
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

  const unresolvedCountrySourceIds = Array.from(
    new Set(
      [...countryFunctionFacts, ...countryTotalFacts]
        .map((fact) => fact.sourceId)
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();
  if (unresolvedCountrySourceIds.length > 0) {
    throw new Error(
      `Georgia municipal facts reference unknown source documents: ${unresolvedCountrySourceIds.join(", ")}`,
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

  if (countryFunctionFacts.length !== 110) {
    throw new Error("Georgia municipal function facts must have 110 rows");
  }
  if (countryTotalFacts.length !== 11) {
    throw new Error("Georgia municipal total facts must have 11 rows");
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

  const countryFunctionKeys = countryFunctionFacts.map(
    (fact) => `${fact.year}:${fact.municipalityCode}:${fact.categoryId}`,
  );
  if (new Set(countryFunctionKeys).size !== countryFunctionKeys.length) {
    throw new Error("Georgia municipal function facts contain duplicate (year, scope, category) keys.");
  }

  const countryTotalKeys = countryTotalFacts.map(
    (total) => `${total.year}:${total.municipalityCode}`,
  );
  if (new Set(countryTotalKeys).size !== countryTotalKeys.length) {
    throw new Error("Georgia municipal total facts contain duplicate (year, scope) keys.");
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

  validateFoundationReferences({ taxonomy, sources, mappings, facts });
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
  console.log(`Validated municipalities: ${municipalities.length}`);
  console.log(`Validated municipality map polygons: ${municipalityGeometrySources.municipalities.features.length}`);
  console.log(`Validated taxonomy rows: ${taxonomy.length}`);
  console.log(`Validated glossary rows: ${glossary.size}`);
  console.log(`Validated source rows: ${sources.length}`);
  console.log(`Validated mapping rows: ${mappings.length}`);
  console.log(`Validated fact rows: ${facts.length}`);
  console.log(`Validated admin spending fact rows: ${adminSpendingFacts.length}`);
  console.log(`Validated national GDP fact rows: ${nationalGdpFacts.length}`);
  console.log(`Report written: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
