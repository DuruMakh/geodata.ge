// Independent Excel-cell comparison for the energy and food research package.
// Reads the preserved workbooks (and the .xls efficiency workbook, which prepare.py cannot read) with SheetJS, the web
// app's own dependency, not the Python XML reader. It finds every cell again from its printed row and column labels, using
// label tables written separately from prepare.py, then compares all 681 rows of energy-food-annual.csv with what it found:
// stored value, dash status, cell address, printed label, display text and unit; the 708 farming rows (Geostat Agriculture,
// six workbooks) the same way, where a dash is never served and a starred year heading ("2025*") marks a preliminary value. It also checks that total primary energy
// supply and final energy consumption equal the efficiency workbook's ktoe rows for all 12 years (within 0.05).
// Writes nothing unless --write.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const YEARS = Array.from({ length: 12 }, (_, i) => 2013 + i);
const FOOD_YEARS = Array.from({ length: 12 }, (_, i) => 2014 + i);
// Labels are compared with all whitespace removed, footnote marks ("quarrying1", "steel[1]", "Import *") dropped and case ignored.
const compact = value => String(value ?? '').replace(/\s+/g, '').toLowerCase().replace(/\[\d+\]|\*+$|(?<=[a-z)])\d+$/g, '');
const spaced = value => String(value ?? '').replace(/\s+/g, ' ').trim();

const book = path => XLSX.read(readFileSync(join(root, path)), { type: 'buffer', cellNF: true });
const sheetOf = (workbook, name) => {
  const found = workbook.SheetNames.filter(candidate => candidate.toLowerCase() === name.toLowerCase());
  if (found.length !== 1) throw new Error(`Expected one sheet named ${name}, found ${found}`);
  return { name: found[0], sheet: workbook.Sheets[found[0]] };
};
const lastRow = sheet => XLSX.utils.decode_range(sheet['!ref']).e.r + 1;
const rowLabels = sheet => Array.from({ length: lastRow(sheet) }, (_, i) => ({ row: i + 1, label: compact(sheet[`A${i + 1}`]?.v) }));
/** Rows with this label, or only those below `after` (a row number) and above `until`. */
const rowsLabelled = (labels, label, after = 0, until = Infinity) =>
  labels.filter(entry => entry.row > after && entry.row < until && (Array.isArray(label) ? label : [label]).includes(entry.label)).map(entry => entry.row);
const only = (rows, what) => { if (rows.length !== 1) throw new Error(`Expected one ${what}, found ${rows}`); return rows[0]; };
const first = (rows, what) => { if (rows.length === 0) throw new Error(`No ${what}`); return rows[0]; };
const headerColumn = (sheet, row, test) => {
  const found = Object.keys(sheet).filter(address => /^[A-Z]+\d+$/.test(address) && Number(address.replace(/^[A-Z]+/, '')) === row && test(compact(sheet[address].v)));
  return only(found.map(address => address.replace(/\d+$/, '')), 'matching column heading');
};

// What each served indicator means in the workbooks, written separately from prepare.py.
const FUEL_HEADING = { total: 'total', coal: 'coal', crude_oil: 'crudeoil', oil_products: 'oilproducts', natural_gas: 'naturalgas',
  hydro: 'hydro', wind_solar_geothermal: 'geothermal', biofuel_waste: 'biofuel&waste', electricity: 'electricity' };
const fuelHeading = (key, text) => (key === 'wind_solar_geothermal' ? text.startsWith('geothermal') : text === FUEL_HEADING[key]);
const KTOE = [
  ['energy.supply', 'domesticsupply', Object.keys(FUEL_HEADING)],
  ['energy.production', 'production', ['total']], ['energy.exports', 'exports', ['total']],
  ['energy.imports', 'imports', ['total', 'coal', 'crude_oil', 'oil_products', 'natural_gas', 'electricity']],
  ['energy.final_fuel', 'finalconsumption', ['coal', 'oil_products', 'natural_gas', 'wind_solar_geothermal', 'biofuel_waste', 'electricity']],
];
const KTOE_FINAL = { total: 'finalconsumption', industry: 'industry', transport: 'transport', commercial_public: 'commercialandpublicservices',
  households: 'residential', agriculture: 'agriculture/forestry/fishing', other_unspecified: 'notelsewherespecified(other)', non_energy: 'non-energyuse' };
const ELECTRICITY_TOP = { 'electricity.production.total': 'production', 'electricity.imports': 'imports', 'electricity.exports': 'exports' };
const ELECTRICITY_PLANT = { 'electricity.production.thermal': 'mathermalelectricityplants', 'electricity.production.hydro': 'mahydroelectricityplants',
  'electricity.production.wind': 'windelectricityplants' };
const ELECTRICITY_FINAL = { total: 'finalconsumption', industry: 'industry', transport: 'transport', commercial_public: 'commercialandpublicservices',
  households: 'residential', agriculture: 'agriculture/forestry/fishing', other_unspecified: 'notelsewherespecified(other)' };
const FOODS = [['wheat', 'Wheat'], ['maize', 'Maize'], ['potato', 'Potato'], ['vegetables', 'Vegetables'], ['grapes', 'Grapes'], ['meat', 'Meat'],
  ['beef', 'Beef'], ['pork', 'Pork'], ['sheep_goat_meat', 'Sheep and Goat Meat'], ['poultry_meat', 'Poultry Meat'], ['milk', 'Milk and Milk Products'], ['eggs', 'Egg']];

// Farming rows, written separately from prepare.py: [indicator, workbook key, sheet, label (compacted), unit, first year].
const FARMING_FILES = { general: 'AG. output', 'annual-crops': 'Production', 'permanent-crops': 'Permanent Crops production',
  'livestock-numbers': 'Number of livestock', 'livestock-products': 'Livestock products', prices: 'Prices' };
const FARMING = [
  ...[['total', 'outputofagriculture,total'], ['crops', 'plantgrowing'], ['livestock', 'animalhusbandry'], ['services', 'agriculturalservices']]
    .map(([key, label]) => [`farming.output.${key}`, 'general', label, 'million_gel', 2010]),
  ...[['wheat', 'wheat,total'], ['barley', 'barley,total'], ['maize', 'maize'], ['beans', 'haricotbeans'], ['potatoes', 'potato'],
    ['vegetables', 'vegetables,total'], ['melons', 'melons']].map(([key, label]) => [`farming.harvest.${key}`, 'annual-crops', label, 'thousand_tonnes', 2006]),
  ...[['grapes', 'grapes'], ['apples', 'apple'], ['peaches', 'peach,nectarine'], ['tangerines', 'tangerine'], ['hazelnuts', 'hazelnut'], ['walnuts', 'walnut']]
    .map(([key, label]) => [`farming.harvest.${key}`, 'permanent-crops', label, 'thousand_tonnes', 2006]),
  ...[['cattle', 'bovineanimals'], ['dairy_cows', 'dairycowsandbuffaloes'], ['pigs', 'pigs'], ['sheep_goats', 'sheepandgoats'], ['poultry', 'poultry,ths.heads']]
    .map(([key, label]) => [`farming.livestock.${key}`, 'livestock-numbers', label, 'thousand_head', 2006]),
  ...[['meat', 'meat,total', 'thousand_tonnes'], ['beef', 'beef', 'thousand_tonnes'], ['pork', 'pork', 'thousand_tonnes'], ['sheep_goat_meat', 'sheepandgoat', 'thousand_tonnes'],
    ['poultry_meat', 'poultry', 'thousand_tonnes'], ['milk', 'milk(mill.litres)', 'million_litres'], ['eggs', 'egg(mill.pieces)', 'million_pieces']]
    .map(([key, label, unit]) => [`farming.products.${key}`, 'livestock-products', label, unit, 2006]),
  ...[['wheat', 'wheat'], ['maize', 'maize'], ['potatoes', 'potato'], ['tomatoes', 'tomato'], ['apples', 'apple'], ['grapes', 'grapes'], ['hazelnuts', 'hazelnut'],
    ['beef', 'beef'], ['pork', 'pork'], ['poultry_meat', 'poultrymeat'], ['milk', 'milk(1litre)'], ['eggs', 'egg(1piece)']]
    .map(([key, label]) => [`farming.price.${key}`, 'prices', label, key === 'milk' ? 'gel_per_litre' : key === 'eggs' ? 'gel_per_piece' : 'gel_per_kg', 2014]),
];
const FARMING_DECIMALS = { '#,##0.0': 1, '0.0': 1, '#\\ ##0.0': 1, '0.00': 2 };

/** Excel keeps 15 significant digits. Energy shows one decimal; a food ratio follows its own cell's format ("0" whole percent, "General" as stored). */
function shown(indicator, value, format) {
  const sig = Number(value.toPrecision(15));
  if (indicator.startsWith('farming.')) {
    if (format === 'General' && indicator.startsWith('farming.price.')) return sig.toFixed(2);
    const decimals = FARMING_DECIMALS[format];
    if (decimals === undefined) throw new Error(`${indicator}: unexpected number format ${format}`);
    return (Math.round(sig * 10 ** decimals + 1e-9) / 10 ** decimals).toFixed(decimals);
  }
  if (indicator.startsWith('food.')) {
    if (format === 'General') return String(sig);
    if (format !== '0') throw new Error(`${indicator}: unexpected number format ${format}`);
    return String(Math.floor(sig + 0.5 + 1e-9));
  }
  const sign = sig < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(sig) * 10 + 1e-9) / 10).toFixed(1);
}

const expected = new Map(); // `${indicator}|${year}` -> what the workbook holds
const workbooks = new Set();
function expect(indicator, year, file, name, sheet, address, heading, farming) {
  const key = `${indicator}|${year}`;
  if (expected.has(key)) throw new Error(`Derived ${key} twice`);
  const cell = sheet[address];
  if (!cell) throw new Error(`${file} ${address}: no cell for ${key}`);
  const dash = cell.t === 's' && spaced(cell.v).replace(/ /g, '') === '-';
  if (!dash && cell.t !== 'n') throw new Error(`${file} ${address}: ${key} is neither a number nor a dash (${cell.v})`);
  if (dash && farming) throw new Error(`${file} ${address}: ${key} is a farming dash (data not available)`);
  workbooks.add(file);
  expected.set(key, { indicator, year, file, name, address, number: dash ? 0 : cell.v, dash, format: cell.z,
    label: `${spaced(sheet[`A${address.replace(/^[A-Z]+/, '')}`].v)} | ${heading}`,
    preliminary: farming?.preliminary ?? false,
    unit: farming?.unit ?? (indicator.startsWith('food.') ? 'percent' : indicator.startsWith('electricity.') ? 'gwh' : 'ktoe') });
}

for (const year of YEARS) {
  const file = `official/energy-balance-${year}-aggregated.xlsx`;
  const { name, sheet } = sheetOf(book(file), 'KTOE');
  const labels = rowLabels(sheet);
  const headerRow = only(Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a) && compact(sheet[a].v) === 'coal').map(a => Number(a.replace(/^[A-Z]+/, ''))), 'KTOE heading row');
  const column = key => headerColumn(sheet, headerRow, text => fuelHeading(key, text));
  const heading = key => spaced(sheet[`${column(key)}${headerRow}`].v);
  for (const [prefix, label, keys] of KTOE) {
    const row = only(rowsLabelled(labels, label), label);
    for (const key of keys) expect(`${prefix}.${key}`, year, file, name, sheet, `${column(key)}${row}`, heading(key));
  }
  const finalRow = only(rowsLabelled(labels, 'finalconsumption'), 'final consumption');
  for (const [key, label] of Object.entries(KTOE_FINAL)) {
    const row = key === 'total' ? finalRow : first(rowsLabelled(labels, label, finalRow), label);
    expect(`energy.final.${key}`, year, file, name, sheet, `${column('total')}${row}`, heading('total'));
  }

  const electricity = `official/energy-balance-${year}-electricity.xlsx`;
  const { name: gwhName, sheet: gwh } = sheetOf(book(electricity), 'GWh&TJ');
  const gwhLabels = rowLabels(gwh);
  const gwhHeaderRow = only(Object.keys(gwh).filter(a => /^[A-Z]+\d+$/.test(a) && compact(gwh[a].v) === 'electricity(gwh)').map(a => Number(a.replace(/^[A-Z]+/, ''))), 'GWh heading row');
  const gwhColumn = headerColumn(gwh, gwhHeaderRow, text => text === 'electricity(gwh)');
  const gwhHeading = spaced(gwh[`${gwhColumn}${gwhHeaderRow}`].v);
  const at = (indicator, row) => expect(indicator, year, electricity, gwhName, gwh, `${gwhColumn}${row}`, gwhHeading);
  for (const [indicator, label] of Object.entries(ELECTRICITY_TOP)) at(indicator, only(rowsLabelled(gwhLabels, label), label));
  at('electricity.losses', only(rowsLabelled(gwhLabels, ['losses', 'distributionlosses']), 'losses row'));
  const block = only(rowsLabelled(gwhLabels, 'transformationsector-production'), 'production block');
  const blockEnd = only(rowsLabelled(gwhLabels, 'energysector', block), 'end of production block');
  for (const [indicator, label] of Object.entries(ELECTRICITY_PLANT)) {
    const rows = rowsLabelled(gwhLabels, label, block, blockEnd);
    if (indicator.endsWith('.wind') && year < 2016) { if (rows.length) throw new Error(`Wind row before 2016 in ${year}`); continue; }
    at(indicator, only(rows, label));
  }
  const gwhFinal = only(rowsLabelled(gwhLabels, 'finalconsumption'), 'final consumption');
  for (const [key, label] of Object.entries(ELECTRICITY_FINAL)) at(`electricity.final.${key}`, key === 'total' ? gwhFinal : first(rowsLabelled(gwhLabels, label, gwhFinal), label));
}
{
  const file = 'official/food-balance-sheets.xlsx';
  const workbook = book(file);
  for (const [food, sheetName] of FOODS) {
    const { name, sheet } = sheetOf(workbook, sheetName);
    const labels = rowLabels(sheet);
    const header = only(rowsLabelled(labels, 'indicators'), 'year heading row');
    const ratio = only(labels.filter(entry => entry.label === 'self-sufficiencyratio,%').map(entry => entry.row), 'self-sufficiency row');
    for (const address of Object.keys(sheet).filter(a => new RegExp(`^[B-Z]${header}$`).test(a))) {
      const year = sheet[address].v;
      if (!FOOD_YEARS.includes(year)) throw new Error(`${sheetName}: unexpected year ${year}`);
      const column = address.replace(/\d+$/, '');
      expect(`food.self_sufficiency.${food}`, year, file, name, sheet, `${column}${ratio}`, String(year));
    }
  }
}

for (const [key, sheetName] of Object.entries(FARMING_FILES)) {
  const file = `official/farming-${key}.xlsx`;
  const { name, sheet } = sheetOf(book(file), sheetName);
  const labels = rowLabels(sheet);
  // The year heading row: the first row with at least five year cells (2006, or "2025*" for a preliminary year).
  const yearsOf = row => Object.keys(sheet).filter(a => /^[B-Z]+\d+$/.test(a) && Number(a.replace(/^[A-Z]+/, '')) === row && /^\d{4}\*?$/.test(spaced(sheet[a].v)))
    .map(a => ({ column: a.replace(/\d+$/, ''), year: Number(String(sheet[a].v).slice(0, 4)), starred: String(sheet[a].v).endsWith('*'), heading: spaced(sheet[a].v) }));
  const header = first(labels.map(entry => entry.row).filter(row => yearsOf(row).length >= 5), `${file} year heading row`);
  for (const [indicator, , label, unit, firstYear] of FARMING.filter(entry => entry[1] === key)) {
    const row = only(rowsLabelled(labels, label), `${file} ${label}`);
    for (const { column, year, starred, heading } of yearsOf(header).filter(entry => entry.year >= firstYear && entry.year <= 2025)) {
      expect(indicator, year, file, name, sheet, `${column}${row}`, heading, { unit, preliminary: starred });
    }
  }
}

// The efficiency workbook (.xls): total primary energy supply and final energy consumption, ktoe, 2013-2024.
const efficiency = {};
{
  const { sheet } = sheetOf(book('official/energy-efficiency.xls'), 'Energy efficiency');
  const labels = rowLabels(sheet);
  const header = first(labels.filter(entry => Object.keys(sheet).some(a => a === `C${entry.row}` && sheet[a].v === 2013)).map(entry => entry.row), 'year heading row');
  const years = Object.fromEntries(Object.keys(sheet).filter(a => new RegExp(`^[A-Z]+${header}$`).test(a) && typeof sheet[a].v === 'number').map(a => [a.replace(/\d+$/, ''), sheet[a].v]));
  for (const [key, label] of [['supply', 'totalprimaryenergysupply'], ['final', 'finalenergyconsumption']]) {
    const row = only(labels.filter(entry => entry.label === label && compact(sheet[`B${entry.row}`]?.v) === 'ktoe').map(entry => entry.row), `${label} ktoe row`);
    efficiency[key] = Object.fromEntries(Object.entries(years).map(([column, year]) => [year, sheet[`${column}${row}`].v]));
  }
}

function parseCsv(text) {
  const [header, ...lines] = text.replace(/^﻿/, '').trim().split('\n');
  const fields = header.split(',');
  return lines.map(line => {
    const values = []; let current = ''; let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { values.push(current); current = ''; }
      else current += char;
    }
    values.push(current);
    return Object.fromEntries(fields.map((field, i) => [field, values[i]]));
  });
}

const sourceId = file => `geostat_${file.replace(/^official\//, '').replace(/\.xlsx$/, '').replace(/-/g, '_')}`;

function verify(rows, efficiencyValues = efficiency) {
  const failures = [];
  const seenKeys = new Set(), seenCells = new Set();
  let values = 0, statuses = 0, displays = 0, labelsMatched = 0, cells = 0;
  for (const row of rows) {
    const key = `${row.indicator_id}|${row.year}`;
    const want = expected.get(key);
    if (!want) { failures.push(`${key}: not derived from the workbooks`); continue; }
    if (seenKeys.has(key)) failures.push(`${key}: listed twice`);
    seenKeys.add(key);
    const where = `${key} ${want.file} ${want.address}`;
    const cellKey = `${want.file}|${want.name}|${want.address}`;
    if (seenCells.has(cellKey)) failures.push(`${where}: cell used twice`);
    seenCells.add(cellKey);
    if (row.source_cell === want.address && row.source_sheet === want.name && row.source_id === sourceId(want.file)) cells += 1;
    else failures.push(`${where}: row points at ${row.source_id} ${row.source_sheet} ${row.source_cell}`);
    if (Number(row.value) === want.number) values += 1;
    else failures.push(`${where}: value ${row.value} != ${want.number}`);
    if (row.value_status === (want.dash ? 'no_flow' : want.preliminary ? 'preliminary' : 'published')) statuses += 1;
    else failures.push(`${where}: status ${row.value_status}`);
    if (row.published_value === shown(want.indicator, want.number, want.format) && row.unit === want.unit && row.basis === 'actual') displays += 1;
    else failures.push(`${where}: display ${row.published_value}/${row.unit}/${row.basis} != ${shown(want.indicator, want.number, want.format)}/${want.unit}`);
    if (spaced(row.source_label) === want.label && (row.source_number_format === 'unsupported' || row.source_number_format === want.format)) labelsMatched += 1;
    else failures.push(`${where}: label/format ${row.source_label} / ${row.source_number_format} != ${want.label} / ${want.format}`);
  }
  for (const key of expected.keys()) if (!seenKeys.has(key)) failures.push(`${key}: derived from the workbooks but missing from the CSV`);
  if (rows.length !== 1389) failures.push(`expected 1389 observations, found ${rows.length}`);
  let efficiencyMatched = 0;
  for (const year of YEARS) {
    for (const [indicator, key] of [['energy.supply.total', 'supply'], ['energy.final.total', 'final']]) {
      const row = rows.find(candidate => candidate.indicator_id === indicator && Number(candidate.year) === year);
      if (row && Math.abs(Number(row.value) - efficiencyValues[key][year]) <= 0.05) efficiencyMatched += 1;
      else failures.push(`${indicator} ${year}: ${row?.value} differs from the efficiency workbook (${efficiencyValues[key][year]})`);
    }
  }
  return { failures, values, statuses, displays, labelsMatched, cells, efficiencyMatched };
}

const observations = parseCsv(readFileSync(join(root, 'energy-food-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = (rows, efficiencyValues) => verify(rows, efficiencyValues).failures.length > 0;
const edit = (indicator, year, change) => observations.map(row => (row.indicator_id === indicator && Number(row.year) === year ? { ...row, ...change } : row));
const shiftedEfficiency = { ...efficiency, supply: { ...efficiency.supply, 2020: efficiency.supply[2020] + 0.06 } };
const negative = {
  altered_value_detected: detects(edit('energy.supply.total', 2024, { value: '5914.6', published_value: '5914.6' })),
  altered_dash_detected: detects(edit('energy.imports.crude_oil', 2013, { value: '1', published_value: '1.0' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit('food.self_sufficiency.wheat', 2025, { year: '2024' })),
  wrong_cell_detected: detects(edit('electricity.imports', 2020, { source_cell: 'F6' })),
  wrong_label_detected: detects(edit('electricity.exports', 2020, { source_label: 'Imports | Electricity (GWh)' })),
  efficiency_mismatch_detected: detects(observations, shiftedEfficiency),
  farming_value_altered_detected: detects(edit('farming.harvest.wheat', 2025, { value: '145.4', published_value: '145.4' })),
  farming_status_altered_detected: detects(edit('farming.output.total', 2024, { value_status: 'preliminary' })),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: workbooks.size,
  efficiency_workbook: 'official/energy-efficiency.xls',
  observations: observations.length,
  cells_found_again_from_labels: expected.size,
  source_cells_matched: result.cells,
  stored_values_matched: result.values,
  dash_status_matched: result.statuses,
  published_values_matched: result.displays,
  labels_and_formats_matched: result.labelsMatched,
  efficiency_values_matched: result.efficiencyMatched,
  efficiency_tolerance_ktoe: 0.05,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
