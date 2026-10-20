// Independent Excel-cell comparison for the Geostat transport research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not xlrd or the Python XML reader, and
// recomputes every value from its cell: the stored value (a nil "-" or "_" cell is 0), the rounding to the unit's published
// precision, the year (the heading above the column, the year beside a yearly row, or the regional workbook's fixed-width
// year blocks), the printed column sub-heading and the printed row label with its section. The label tables below are written
// separately from prepare.py. Writes independent-validation.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_transport_passenger_demand: 'official/H-1-Passenger-transport-demand_ENG.XLSX',
  geostat_transport_freight_demand: 'official/H-2-Freight-transport-demand_ENG.XLSX',
  geostat_transport_fleet_fuel: 'official/H-3.-Composition-of-road-motor-vehicle-fleet-by-fuel-type_ENG.xlsx',
  geostat_transport_fleet_age: 'official/H-4.-Age-of-road-motor-vehicle-fleet_ENG.xlsx',
  geostat_transport_rail_goods: 'official/0504EN030102_Goods-Transported-by-Railway.xlsx',
  geostat_transport_rail_passengers: 'official/0504EN030103_Passengers-Transported-by-Railway.xlsx',
  geostat_transport_metro: 'official/0504EN030105_Passengers-transported-by-Metro.xlsx',
  geostat_transport_airlines: 'official/0504EN030201_Airlines-Registered-in-Georgia.xlsx',
  geostat_transport_airports: 'official/0504EN030202_Airports-in-Georgia.xlsx',
  geostat_transport_sea_passengers: 'official/0504EN030401_Passenger-carried-in-seaports-and-terminals.xlsx',
  geostat_transport_sea_freight: 'official/0504EN030403_Volume-of-carried-freight-in-seaports-and-terminals.xlsx',
  geostat_transport_registered: 'official/Number-of-Registered-Vehicles.xlsx',
  geostat_transport_roads: 'official/Length-of-road-Eng-2024.xls',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));
const EXPECTED_TOTAL = 4301;

// Written from the approved spec and the task brief, not from prepare.py.
const UNIT_OF = {
  fleet: 'thousand_units', registered: 'thousand_units', passenger_km: 'million_passenger_km', passenger_km_per_person: 'passenger_km_per_person',
  passengers: 'thousand_passengers', tonne_km: 'million_tonne_km', freight_tonnes: 'thousand_tonnes', road_km: 'km',
};
const PLACES = { thousand_units: 1, million_passenger_km: 1, passenger_km_per_person: 0, thousand_passengers: 1, million_tonne_km: 1, thousand_tonnes: 1, km: 1 };
const NIL_IS_GAP = new Set(['geostat_transport_freight_demand']);
// [source, section heading or null for a label printed once, row label, unit printed in column B or null].
const NATIONAL_ROWS = {
  'passenger_km.road': ['geostat_transport_passenger_demand', 'Road transport*', 'Passenger transport demand', 'million pkm'],
  'passenger_km.rail': ['geostat_transport_passenger_demand', 'Railway transport', 'Passenger transport demand', 'million pkm'],
  'passenger_km.sea': ['geostat_transport_passenger_demand', 'Maritime transport', 'Passenger transport demand', 'million pkm'],
  'passenger_km.air': ['geostat_transport_passenger_demand', 'Aviation', 'Passenger transport demand', 'million pkm'],
  'passenger_km.metro': ['geostat_transport_passenger_demand', 'Underground transport (metro)', 'Passenger transport demand', 'million pkm'],
  'passenger_km.total': ['geostat_transport_passenger_demand', null, 'Total passenger transport demand', 'million pkm'],
  'passenger_km_per_person.total': ['geostat_transport_passenger_demand', null, 'Total Passenger transport demand per capita', 'km'],
  'tonne_km.road': ['geostat_transport_freight_demand', 'Road transport*', 'Freight transport demand', 'million tkm'],
  'tonne_km.rail': ['geostat_transport_freight_demand', 'Railway transport', 'Freight transport demand', 'million tkm'],
  'tonne_km.sea': ['geostat_transport_freight_demand', 'Maritime transport', 'Freight transport demand', 'million tkm'],
  'tonne_km.air': ['geostat_transport_freight_demand', 'Aviation', 'Freight transport demand', 'million tkm'],
  'tonne_km.total': ['geostat_transport_freight_demand', null, 'Total freight transport demand', 'million tkm'],
  'freight_tonnes.rail': ['geostat_transport_rail_goods', 'Transported, total', 'Goods, total', null],
  'freight_tonnes.rail_domestic': ['geostat_transport_rail_goods', 'National transported', 'Goods, total', null],
  'freight_tonnes.rail_exports': ['geostat_transport_rail_goods', 'Outgoing goods', 'Goods, total', null],
  'freight_tonnes.rail_imports': ['geostat_transport_rail_goods', 'Incoming goods', 'Goods, total', null],
  'freight_tonnes.rail_transit': ['geostat_transport_rail_goods', 'Transit', 'Goods, total', null],
  'passengers.rail': ['geostat_transport_rail_passengers', null, 'Number of passengers, total', null],
  'passengers.rail_domestic': ['geostat_transport_rail_passengers', 'first', 'National', null],
  'passengers.rail_international': ['geostat_transport_rail_passengers', 'first', 'International', null],
  'passengers.airports': ['geostat_transport_airports', null, 'Passengers carried (thsd. persons)', null],
  'freight_tonnes.airports': ['geostat_transport_airports', null, 'Freight and mail volume (thsd. tons)', null],
};
// Quarterly tables: [source, sheet, heading row, column heading]; the yearly row is the one whose quarter cell is "…".
const YEARLY_ROWS = {
  'passengers.airlines': ['geostat_transport_airlines', 'Number of passengers by quarter', 2, 'Number of passengers, thsd. Passengers'],
  'freight_tonnes.airlines': ['geostat_transport_airlines', 'Volume of freight by quarter', 2, 'Freight volume, thsd. Tons'],
  'passengers.seaports': ['geostat_transport_sea_passengers', 'Passenger', 4, 'Passenger Carried, total'],
  'freight_tonnes.seaports': ['geostat_transport_sea_freight', 'Freight', 3, 'Freight carried, total (thsd. tons)'],
  'freight_tonnes.seaports_liquid': ['geostat_transport_sea_freight', 'Freight', 4, 'Liquid bulk'],
  'freight_tonnes.seaports_general': ['geostat_transport_sea_freight', 'Freight', 4, 'General cargo'],
  'freight_tonnes.seaports_dry': ['geostat_transport_sea_freight', 'Freight', 4, 'Dry bulk'],
};
const FLEET_SECTIONS = { cars: 'Passenger cars', buses: 'Buses and minibuses', special: 'Special*', trucks: 'Trucks' };
const FLEET_LABELS = {
  fuel_petrol: 'Gasoline', fuel_petrol_gas: 'Gasoline-gas', fuel_diesel: 'Diesel', fuel_gas: 'Gas', fuel_electric: 'Electricity',
  fuel_hybrid: 'Hybrid', fuel_hybrid_gas: 'Hybrid-gas', fuel_unknown: 'Unknown',
  age_up_to_2: '<= 2 years', age_up_to_5: '<= 5 years', age_up_to_10: '<= 10 years', age_over_10: '> 10 years', age_unknown: 'Unknown',
};
const AREAS = {
  total: ['Georgia', 'Georgia - total'], region_tbilisi: ['Tbilisi', 'Tbilisi*'], region_adjara: ['Adjara', 'Adjara AR'], region_guria: ['Guria'],
  region_imereti: ['Imereti'], region_kakheti: ['Kakheti'], region_mtskheta_mtianeti: ['Mtskheta-mtianeti', 'Mtskheta-Mtianeti'],
  region_racha_lechkhumi_kvemo_svaneti: ['Racha-Lechkhumi and Kvemo Svaneti'], region_samegrelo_zemo_svaneti: ['Samegrelo-Zemo Svaneti'],
  region_samtskhe_javakheti: ['Samtskhe-Javakheti'], region_kvemo_kartli: ['Kvemo Kartli'], region_shida_kartli: ['Shida Kartli'],
  region_abkhazia: ['Abkhazia', 'Abkhazia AR'], region_unknown: ['Region unknown'],
};
const AREA_IDS = Object.keys(AREAS).sort((a, b) => b.length - a.length);
// Regional workbook: the sheet of each column family and the sub-heading over each served column.
const REGISTERED = {
  '': ['type of vehicle', 4, 'Motor vehicles – total'], _cars: ['type of vehicle', 5, 'Passenger cars'], _buses: ['type of vehicle', 5, 'Buses and minibuses'],
  _trucks: ['type of vehicle', 5, 'Lorries and trucks'], _special: ['type of vehicle', 5, 'Special*'], _type_unknown: ['type of vehicle', 5, 'Unknown'],
  _fuel_gas: ['fuel type', 4, 'Gas'], _fuel_petrol: ['fuel type', 4, 'Gasoline'], _fuel_petrol_gas: ['fuel type', 4, 'Gasoline-gas'],
  _fuel_diesel: ['fuel type', 4, 'Diesel'], _fuel_diesel_gas: ['fuel type', 4, 'Diesel-gas'], _fuel_electric: ['fuel type', 4, 'Electricity'],
  _fuel_hybrid: ['fuel type', 4, 'Hybrid'], _fuel_hybrid_gas: ['fuel type', 4, 'Hybrid-gas'], _fuel_hybrid_diesel: ['fuel type', 4, 'Hybrid-diesel'],
  _fuel_unknown: ['fuel type', 4, 'Unknown'], _owner_companies: [' type of owner ', 4, 'Legal person'], _owner_individuals: [' type of owner ', 4, 'Physical person'],
  _age_0_2: ['age of vehicle', 4, '<=2'], _age_2_5: ['age of vehicle', 4, '(2-5]'], _age_5_10: ['age of vehicle', 4, '(5-10]'],
  _age_over_10: ['age of vehicle', 4, '>10'], _age_unknown: ['age of vehicle', 4, 'Unknown|უცნობია'],
};
const FIXED_WIDTH = { ' type of owner ': 2, 'age of vehicle': 5 }; // Their year headings are wrong after 2021; blocks start at B.
const ROAD_SUBHEADINGS = { '': 'total', _international: 'international road', _secondary: 'secondary road', _local: 'local road' };

const range = (first, last = 2025) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
/** Every served (indicator, year), from the spec's year ranges. */
function expectedKeys() {
  const keys = new Set();
  const add = (id, years) => { for (const y of years) keys.add(`transport.${id}:${y}`); };
  const fuels = { cars: ['petrol', 'petrol_gas', 'diesel', 'gas', 'electric', 'hybrid', 'hybrid_gas', 'unknown'], buses: ['petrol', 'petrol_gas', 'diesel', 'gas', 'electric', 'unknown'],
    trucks: ['petrol', 'petrol_gas', 'diesel', 'gas', 'electric', 'unknown'], special: ['petrol', 'petrol_gas', 'diesel', 'electric', 'unknown'] };
  for (const type of Object.keys(FLEET_SECTIONS)) {
    add(`fleet.${type}`, range(2000).filter(y => ![2004, 2005, ...(type === 'special' ? [2006] : [])].includes(y)));
    for (const fuel of fuels[type]) add(`fleet.${type}_fuel_${fuel}`, range(fuel === 'hybrid_gas' ? 2022 : 2017));
    // The buses' unknown-age row is 0 in every year and is not served.
    for (const band of ['up_to_2', 'up_to_5', 'up_to_10', 'over_10', ...(type === 'buses' ? [] : ['unknown'])]) add(`fleet.${type}_age_${band}`, range(2017));
  }
  for (const mode of ['total', 'road', 'rail', 'metro', 'air', 'sea']) add(`passenger_km.${mode}`, range(2000));
  add('passenger_km_per_person.total', range(2000));
  for (const mode of ['total', 'road', 'rail', 'air']) add(`tonne_km.${mode}`, range(2000));
  add('tonne_km.sea', [...range(2000, 2008), 2011, 2012]);
  for (const id of ['rail', 'rail_domestic', 'rail_international']) add(`passengers.${id}`, range(2018));
  add('passengers.metro', range(2012)); add('passengers.airlines', range(2012)); add('passengers.airports', range(2015)); add('passengers.seaports', range(2020));
  for (const id of ['rail', 'rail_domestic', 'rail_exports', 'rail_imports', 'rail_transit']) add(`freight_tonnes.${id}`, range(2018));
  for (const id of ['seaports', 'seaports_liquid', 'seaports_general', 'seaports_dry']) add(`freight_tonnes.${id}`, range(2020));
  add('freight_tonnes.airlines', range(2012)); add('freight_tonnes.airports', range(2015));
  const later = { _type_unknown: range(2022), _fuel_diesel_gas: [2020, ...range(2022)], _fuel_hybrid_gas: range(2022), _fuel_hybrid_diesel: range(2022) };
  for (const area of Object.keys(AREAS)) for (const suffix of Object.keys(REGISTERED)) add(`registered.${area}${suffix}`, later[suffix] ?? range(2017));
  for (const area of Object.keys(AREAS).filter(a => a !== 'region_unknown')) for (const suffix of Object.keys(ROAD_SUBHEADINGS)) add(`road_km.${area}${suffix}`, range(2011, 2024));
  return keys;
}

function parseCsv(text) {
  const [header, ...lines] = text.replace(/^﻿/, '').trim().split('\n');
  const fields = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [fields[i], value])));
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const split = address => { const [, column, row] = /^([A-Z]+)(\d+)$/.exec(address); return { column, row: Number(row), index: XLSX.utils.decode_col(column) }; };
const at = (sheet, index, row) => sheet[`${XLSX.utils.encode_col(index)}${row}`];
const label = (sheet, row) => clean(at(sheet, 0, row)?.v);
const cellsInRow = (sheet, row) => Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a) && split(a).row === row && clean(sheet[a].v) !== '');

/** A decimal token rounded half away from zero to 15 significant digits, the precision Excel displays. */
function displayed(token) {
  const negative = token.startsWith('-');
  const [whole, fraction = ''] = token.replace('-', '').split('.');
  const digits = whole + fraction;
  const first = digits.search(/[1-9]/);
  if (first < 0 || digits.length - first <= 15) return token;
  const kept = digits.slice(0, first + 15);
  let rounded = (BigInt(kept) + (Number(digits[first + 15]) >= 5 ? 1n : 0n)).toString().padStart(kept.length, '0');
  const point = whole.length + rounded.length - kept.length;
  rounded = rounded.padEnd(point, '0');
  return (negative ? '-' : '') + (rounded.slice(0, point) || '0') + (rounded.length > point ? `.${rounded.slice(point)}` : '');
}

/** Exact decimal rounding, half away from zero, of a stored value as Excel displays it. */
function roundHalfUp(token, places) {
  token = displayed(token);
  const negative = token.startsWith('-');
  const [whole, fraction = ''] = token.replace('-', '').split('.');
  const padded = (fraction + '0'.repeat(places + 1)).slice(0, places + 1);
  let scaled = BigInt(whole + padded.slice(0, places));
  if (Number(padded[places]) >= 5) scaled += 1n;
  const digits = scaled.toString().padStart(places + 1, '0');
  const text = places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : digits;
  return (negative && Number(text) !== 0 ? '-' : '') + text;
}

/** The section heading above a row: the nearest row above holding only column A, other than "of which:". */
function sectionOf(sheet, row) {
  for (let n = row - 1; n > 0; n -= 1) {
    const cells = cellsInRow(sheet, n);
    if (cells.length === 1 && cells[0] === `A${n}` && label(sheet, n).toLowerCase() !== 'of which:') return label(sheet, n);
  }
  return null;
}

/** The year printed in the first heading row above the column (a numeric cell), checked against the row's year. */
function yearAbove(sheet, index, headingRow) {
  const cell = at(sheet, index, headingRow);
  return cell?.t === 'n' ? cell.v : null;
}

function checkRow(row, sheet, number, index) {
  const [, measure, group] = row.indicator_id.split('.');
  const key = `${measure}.${group}`;
  const year = Number(row.year);
  const problems = [];
  if (NATIONAL_ROWS[key]) {
    const [source, section, text, unit] = NATIONAL_ROWS[key];
    if (row.source_id !== source) problems.push(`source ${row.source_id}`);
    if (label(sheet, number) !== text) problems.push(`row ${number} is ${label(sheet, number)}`);
    if (section === null && Object.keys(sheet).filter(a => /^A\d+$/.test(a) && clean(sheet[a].v) === text).length !== 1) problems.push(`label ${text} is not unique`);
    if (section === 'first' && Object.keys(sheet).some(a => /^A\d+$/.test(a) && clean(sheet[a].v) === text && split(a).row < number)) problems.push(`not the first ${text} row`);
    if (section && section !== 'first' && sectionOf(sheet, number) !== section) problems.push(`row ${number} is under ${sectionOf(sheet, number)}`);
    if (unit && clean(at(sheet, 1, number)?.v) !== unit) problems.push(`unit ${clean(at(sheet, 1, number)?.v)}`);
    if (yearAbove(sheet, index, 2) !== year) problems.push(`column is under ${yearAbove(sheet, index, 2)}`);
    const sub = clean(at(sheet, index, 3)?.v);
    if (!source.endsWith('_demand') && !['', 'Year', 'Years'].includes(sub)) problems.push(`column is ${sub}`);
  } else if (measure === 'fleet') {
    const [type, ...rest] = group.split('_');
    const part = rest.join('_');
    const source = part.startsWith('age_') ? 'geostat_transport_fleet_age' : 'geostat_transport_fleet_fuel';
    if (row.source_id !== source) problems.push(`source ${row.source_id}`);
    if (label(sheet, number) !== (part ? FLEET_LABELS[part] : 'Total number')) problems.push(`row ${number} is ${label(sheet, number)}`);
    if (sectionOf(sheet, number) !== FLEET_SECTIONS[type]) problems.push(`row ${number} is under ${sectionOf(sheet, number)}`);
    if (clean(at(sheet, 1, number)?.v) !== '1000 units') problems.push('not in 1000 units');
    if (yearAbove(sheet, index, 2) !== year) problems.push(`column is under ${yearAbove(sheet, index, 2)}`);
  } else if (YEARLY_ROWS[key]) {
    const [source, sheetName, headingRow, heading] = YEARLY_ROWS[key];
    if (row.source_id !== source || row.source_sheet !== sheetName) problems.push(`read from ${row.source_id} ${row.source_sheet}`);
    if (clean(at(sheet, index, headingRow)?.v) !== heading) problems.push(`column is ${clean(at(sheet, index, headingRow)?.v)}`);
    if (!['…', '...'].includes(clean(at(sheet, 1, number)?.v))) problems.push(`row ${number} is not a yearly row`);
    let found = null;
    for (let n = number; n > headingRow && found === null; n -= 1) if (at(sheet, 0, n)?.t === 'n') found = at(sheet, 0, n).v;
    if (found !== year) problems.push(`row ${number} is in ${found}`);
  } else if (key === 'passengers.metro') {
    if (row.source_sheet !== '2012-2025 Y' || !clean(at(sheet, index, 2)?.v).startsWith('Number of passengers')) problems.push('not the yearly passenger column');
    if (at(sheet, 0, number)?.v !== year) problems.push(`row ${number} is ${at(sheet, 0, number)?.v}`);
  } else if (measure === 'registered') {
    const area = AREA_IDS.find(id => group.startsWith(id));
    const suffix = group.slice(area.length);
    const [sheetName, subRow, heading] = REGISTERED[suffix] ?? [];
    if (row.source_sheet !== sheetName) problems.push(`read from ${row.source_sheet}`);
    if (!AREAS[area].includes(label(sheet, number))) problems.push(`row ${number} is ${label(sheet, number)}`);
    if (!heading?.split('|').includes(clean(at(sheet, index, subRow)?.v))) problems.push(`column is ${clean(at(sheet, index, subRow)?.v)}`);
    const width = FIXED_WIDTH[sheetName];
    let blockYear = null;
    if (width) blockYear = 2017 + Math.floor((index - 1) / width);
    else for (let c = index; c > 0 && blockYear === null; c -= 1) blockYear = yearAbove(sheet, c, 3);
    if (blockYear !== year) problems.push(`column is in the ${blockYear} block`);
  } else if (measure === 'road_km') {
    const area = AREA_IDS.find(id => group.startsWith(id));
    const suffix = group.slice(area.length);
    if (!AREAS[area].includes(label(sheet, number))) problems.push(`row ${number} is ${label(sheet, number)}`);
    let start = null;
    for (let c = index; c > 0 && start === null; c -= 1) if (yearAbove(sheet, c, 3) !== null) start = c;
    if (yearAbove(sheet, start, 3) !== year) problems.push(`column is under ${yearAbove(sheet, start, 3)}`);
    const offset = index - start;
    const sub = clean(at(sheet, index, offset === 0 ? 4 : 5)?.v).toLowerCase();
    if (Object.keys(ROAD_SUBHEADINGS)[offset] !== suffix || sub !== ROAD_SUBHEADINGS[suffix]) problems.push(`column is ${sub}`);
  } else problems.push('unknown indicator');
  return problems;
}

function verify(rows) {
  const failures = [];
  const seen = new Set();
  let valuesMatched = 0, roundingMatched = 0, contextMatched = 0;
  for (const row of rows) {
    const where = `${row.indicator_id}:${row.year}`;
    const before = failures.length;
    if (seen.has(where)) failures.push(`${where}: duplicate`);
    seen.add(where);
    const unit = UNIT_OF[row.indicator_id.split('.')[1]];
    const sheet = books[row.source_id]?.Sheets[row.source_sheet];
    const cell = sheet?.[row.source_cell];
    if (!cell) { failures.push(`${where}: ${row.source_sheet}!${row.source_cell} is empty`); continue; }
    const nil = cell.t === 's' && ['-', '_'].includes(clean(cell.v)) && !NIL_IS_GAP.has(row.source_id);
    if (cell.t !== 'n' && !nil) { failures.push(`${where}: ${row.source_sheet}!${row.source_cell} is ${cell.v}`); continue; }
    const stored = nil ? '0' : String(cell.v);
    if (Number(row.year) > 2025) failures.push(`${where}: year after 2025`);
    const { row: number, index } = split(row.source_cell);
    for (const problem of checkRow(row, sheet, number, index)) failures.push(`${where}: ${problem}`);
    if (row.unit !== unit) failures.push(`${where}: unit ${row.unit}`);
    if (row.basis !== 'actual' || row.value_status !== 'official') failures.push(`${where}: not actual and official`);
    if (stored === row.value) valuesMatched += 1; else failures.push(`${where}: value ${row.value} != ${stored}`);
    if (roundHalfUp(row.value, PLACES[unit]) === row.published_value) roundingMatched += 1;
    else failures.push(`${where}: published ${row.published_value} is not ${row.value} rounded`);
    if (failures.length === before) contextMatched += 1;
  }
  const expected = expectedKeys();
  const missing = [...expected].filter(key => !seen.has(key));
  const extra = [...seen].filter(key => !expected.has(key));
  for (const key of missing.slice(0, 20)) failures.push(`${key}: missing`);
  for (const key of extra.slice(0, 20)) failures.push(`${key}: not in the spec's years`);
  if (rows.length !== EXPECTED_TOTAL) failures.push(`expected ${EXPECTED_TOTAL} observations, found ${rows.length}`);
  return { failures, valuesMatched, roundingMatched, contextMatched };
}

const observations = parseCsv(readFileSync(join(root, 'transport-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const find = (indicator, yearValue) => observations.findIndex(row => row.indicator_id === indicator && row.year === String(yearValue));
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const shiftRow = (row, by) => row.source_cell.replace(/\d+$/, n => String(Number(n) + by));
const shiftColumn = (row, by) => row.source_cell.replace(/^[A-Z]+/, letters => XLSX.utils.encode_col(XLSX.utils.decode_col(letters) + by));
const cars = find('transport.fleet.cars', 2025), guria = find('transport.registered.region_guria', 2025);
const owner = find('transport.registered.total_owner_companies', 2022), age = find('transport.registered.total_age_unknown', 2025);
const transit = find('transport.freight_tonnes.rail_transit', 2025), airlines = find('transport.passengers.airlines', 2025);
const road = find('transport.road_km.region_imereti', 2020), sea = find('transport.tonne_km.sea', 2012), seaKm = find('transport.passenger_km.sea', 2020);
const negative = {
  altered_value_detected: detects(edit(cars, { value: '1650.1', published_value: '1650.1' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(cars, { year: '2024' })),
  neighbouring_column_detected: detects(edit(road, { source_cell: shiftColumn(observations[road], 1) })),
  wrong_region_row_detected: detects(edit(guria, { source_cell: shiftRow(observations[guria], 1) })),
  owner_year_block_detected: detects(edit(owner, { source_cell: shiftColumn(observations[owner], 2) })),
  age_band_column_detected: detects(edit(age, { source_cell: shiftColumn(observations[age], -1) })),
  rail_section_detected: detects(edit(transit, { source_cell: shiftRow(observations[transit], -5) })),
  quarter_row_detected: detects(edit(airlines, { source_cell: shiftRow(observations[airlines], -1) })),
  not_available_cell_served_detected: detects([...observations, { ...observations[sea], year: '2013', source_cell: shiftColumn(observations[sea], 1), value: '0', published_value: '0.0' }]),
  nil_served_as_gap_detected: detects(observations.filter((_, i) => i !== seaKm)),
  unrounded_published_value_detected: detects(edit(find('transport.passengers.metro', 2025), { published_value: '147641.427' })),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(books).length,
  observations: observations.length,
  stored_values_matched: result.valuesMatched,
  published_values_matched_rounding: result.roundingMatched,
  rows_with_matching_year_heading_and_label_context: result.contextMatched,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
