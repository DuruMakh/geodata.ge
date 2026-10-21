// Independent Excel-cell comparison for the Geostat housing and construction research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not xlrd or the Python XML reader, and
// recomputes every one of the 3,222 values from its cell: the stored value, the rounding to the cell's number format,
// the year (heading above the column, or the sheet name), the printed column heading and the printed row label with
// the number or area position of the row. The label tables below are written separately from prepare.py.
// Writes independent-validation.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_housing_permits_regions: 'official/0503EN020101_Permissions.xls',
  geostat_housing_completed_regions: 'official/0503EN020103_Completed-objects.xls',
  geostat_housing_permits_types: 'official/Permissions_ENG/0503EN020102c_Permissions by type_ 2006-2025 ENG.xls',
  geostat_housing_completed_types: 'official/Completed_ENG/0503EN020104b_Completed by type_ 2006-2025 ENG.xls',
  geostat_housing_price_index: 'official/RPPI-compared-to-2020-average.xlsx',
  geostat_housing_tbilisi_prices: 'official/Residential-property-prices-in-Tbilisi-by-district.xlsx',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));
const EXPECTED_TOTAL = 3222;

// Written from the approved spec and the task brief, not from prepare.py.
const REGION_LABELS = {
  'Georgia- total': 'total', Tbilisi: 'region_tbilisi', 'Tbilisi city': 'region_tbilisi', 'Adjara AR': 'region_adjara', Guria: 'region_guria',
  Imereti: 'region_imereti', Kakheti: 'region_kakheti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
  'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti', 'Racha-lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
  'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
  'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli',
};
const REGION_IDS = [...new Set(Object.values(REGION_LABELS))].filter(id => id !== 'total');
// Header text of a type column: lower case, text before the first line break, spaces and hyphens removed.
const TYPE_LABELS = {
  residentialbuildings: 'residential', tradebuildings: 'trade', administrativebuildings: 'administrative', hotels: 'hotels',
  cafesandrestaurents: 'cafes', cafesandrestourants: 'cafes', industrialbuildingsandwarehouses: 'industrial', farmbuildings: 'farm',
  refuellingstations: 'fuel', carparkings: 'parking', educationalinstitutions: 'education', preschoolestablishments: 'preschool',
  preschoolsestablishments: 'preschool', healthestablishments: 'health', sportsbuildingsandgrounds: 'sports',
  culturalestablishments: 'culture', "chemist,sshop": 'pharmacy', "chemist,sshops": 'pharmacy',
  "children'sholidaycamp": 'holiday_camps', "children'sholidaycamps": 'holiday_camps', other: 'other',
};
const TYPE_IDS = [...new Set(Object.values(TYPE_LABELS))];
const NO_COLUMN_YEARS = {
  'permits:preschool': [2008],
  'permits:holiday_camps': Array.from({ length: 20 }, (_, i) => 2006 + i).filter(y => ![2022, 2023].includes(y)),
  'completed:preschool': [2006, 2009, 2011, 2012, 2021],
  'completed:holiday_camps': Array.from({ length: 20 }, (_, i) => 2006 + i),
};
const NO_RESIDENTIAL = { 'completed:region_samegrelo_zemo_svaneti': [2006], 'completed:region_kakheti': [2006], 'completed:region_racha_lechkhumi_kvemo_svaneti': [2010, 2011] };
const DISTRICT_LABELS = {
  Gldani: 'district_gldani', Didube: 'district_didube', Vake: 'district_vake', Isani: 'district_isani', Krtsanisi: 'district_krtsanisi',
  Mtatsminda: 'district_mtatsminda', Nadzaladevi: 'district_nadzaladevi', Saburtalo: 'district_saburtalo', Samgori: 'district_samgori',
  Chughureti: 'district_chughureti',
};
const INDEX_LABELS = { Total: 'total', Flats: 'flats', 'Detached houses': 'houses' };
const UNIT_OF = {
  permits_count: 'count', permits_area: 'square_metres', completed_count: 'count', completed_area: 'square_metres',
  price_index: 'index_2020', price_flat: 'gel_per_square_metre', price_house: 'gel_per_square_metre',
};
const PLACES = { count: 0, square_metres: 0, index_2020: 1, gel_per_square_metre: 0 };
const SOURCE_OF = {
  permits_count: ['geostat_housing_permits_regions', 'geostat_housing_permits_types'], permits_area: ['geostat_housing_permits_regions', 'geostat_housing_permits_types'],
  completed_count: ['geostat_housing_completed_regions', 'geostat_housing_completed_types'], completed_area: ['geostat_housing_completed_regions', 'geostat_housing_completed_types'],
  price_index: ['geostat_housing_price_index'], price_flat: ['geostat_housing_tbilisi_prices'], price_house: ['geostat_housing_tbilisi_prices'],
};

/** Every served (indicator, year), from the spec's year ranges. */
function expectedKeys() {
  const keys = new Set();
  const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const add = (id, years) => { for (const y of years) keys.add(`${id}:${y}`); };
  for (const measure of ['permits', 'completed']) {
    for (const kind of ['count', 'area']) {
      const base = `housing.${measure}_${kind}`;
      for (const group of ['total', ...REGION_IDS]) add(`${base}.${group}`, range(2006, 2025));
      for (const region of REGION_IDS) add(`${base}.${region}_residential`, range(2006, 2025).filter(y => !(NO_RESIDENTIAL[`${measure}:${region}`] ?? []).includes(y)));
      for (const type of TYPE_IDS) add(`${base}.type_${type}`, range(2006, 2025).filter(y => !(NO_COLUMN_YEARS[`${measure}:${type}`] ?? []).includes(y)));
    }
  }
  for (const group of Object.values(INDEX_LABELS)) add(`housing.price_index.${group}`, range(2020, 2025));
  for (const measure of ['price_flat', 'price_house']) for (const group of Object.values(DISTRICT_LABELS)) add(`housing.${measure}.${group}`, range(2021, 2025));
  return keys;
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

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const split = address => { const [, column, row] = /^([A-Z]+)(\d+)$/.exec(address); return { column, row: Number(row), index: XLSX.utils.decode_col(column) }; };
const at = (sheet, index, row) => sheet[`${XLSX.utils.encode_col(index)}${row}`];
const typeKey = value => String(value ?? '').split('\n')[0].toLowerCase().replace(/[\s-]+/g, '');

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

/** Decimals a cell's number format shows: '#,##0.0' and '0.0' one; '#,##0', '0' and '0_);\(0\);\-' none; 'General' none. */
function formatPlaces(cell) {
  const format = cell.z ?? 'General';
  if (format === 'General') return 0;
  const match = /^(?:#,##)?0(?:\.(0+))?(?:_\);\\\(0\\\);\\-)?$/.exec(format);
  return match ? (match[1] ?? '').length : null;
}

/** The label of the row's group: the nearest column-A text at or above it, and whether the row is that label's number or area row. */
function rowRole(sheet, row) {
  let labelRow = row;
  while (labelRow > 0 && !clean(at(sheet, 0, labelRow)?.v)) labelRow -= 1;
  const cells = Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a) && split(a).row === labelRow && split(a).index > 0);
  const offset = cells.length ? 0 : 1; // Completed 2010 prints two labels on a row of their own, the pair below them.
  const place = row - labelRow - offset;
  return { label: clean(at(sheet, 0, labelRow)?.v), kind: place === 0 ? 'count' : place === 1 ? 'area' : null };
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
    const [, measure, group] = row.indicator_id.split('.');
    const yearValue = Number(row.year);
    const unit = UNIT_OF[measure];
    if (!SOURCE_OF[measure]?.includes(row.source_id)) { failures.push(`${where}: source ${row.source_id}`); continue; }
    const sheet = books[row.source_id].Sheets[row.source_sheet];
    const cell = sheet?.[row.source_cell];
    if (!cell || cell.t !== 'n') { failures.push(`${where}: ${row.source_sheet}!${row.source_cell} is not a numeric cell`); continue; }
    const { column, row: number, index } = split(row.source_cell);
    if (yearValue > 2025) failures.push(`${where}: year after 2025`);
    const kind = measure.endsWith('_area') ? 'area' : measure.endsWith('_count') ? 'count' : null;

    if (/_regions$/.test(row.source_id)) {
      // Year heading (merged over the pair, on its first column), number / area label, and the region's own row.
      const headingRow = Object.keys(sheet).map(a => /^A(\d+)$/.exec(a)).filter(Boolean).find(m => clean(sheet[m[0]].v) === 'Region')?.[1];
      const label = clean(at(sheet, index, Number(headingRow) + 1)?.v).toLowerCase();
      const yearCell = at(sheet, index - (label === 'space, m2' ? 1 : 0), Number(headingRow));
      if (!['number', 'space, m2'].includes(label) || (label === 'number') !== (kind === 'count')) failures.push(`${where}: column ${column} is labelled ${label}`);
      if (yearCell?.t !== 'n' || yearCell.v !== yearValue) failures.push(`${where}: column ${column} is under ${yearCell?.v}`);
      if (REGION_LABELS[clean(at(sheet, 0, number)?.v)] !== group) failures.push(`${where}: row ${number} is ${clean(at(sheet, 0, number)?.v)}`);
    } else if (/_types$/.test(row.source_id)) {
      if (clean(row.source_sheet) !== String(yearValue)) failures.push(`${where}: sheet ${row.source_sheet} is not ${yearValue}`);
      const typeColumn = group.startsWith('type_') ? group.slice(5) : group.endsWith('_residential') ? 'residential' : null;
      let header = null;
      for (let n = number - 1; n > 0 && header === null; n -= 1) {
        const above = at(sheet, index, n);
        if (above?.t === 's' && !['…', '...'].includes(clean(above.v))) header = typeKey(above.v);
      }
      if (typeColumn === null || TYPE_LABELS[header ?? ''] !== typeColumn) failures.push(`${where}: column ${column} is headed ${header}`);
      const role = rowRole(sheet, number);
      const expectedLabel = group.startsWith('type_') ? 'total' : group.replace(/_residential$/, '');
      if (REGION_LABELS[role.label] !== expectedLabel) failures.push(`${where}: row ${number} is ${role.label}`);
      if (role.kind !== kind) failures.push(`${where}: row ${number} is not the ${kind} row`);
    } else {
      // Price sheets: the nearest quarter heading above must be IV, and the year heading above that is the year.
      let quarterRow = null;
      for (let n = number - 1; n > 0 && quarterRow === null; n -= 1) {
        const above = at(sheet, index, n);
        if (above?.t === 's' && ['I', 'II', 'III', 'IV'].includes(clean(above.v))) { quarterRow = n; if (clean(above.v) !== 'IV') failures.push(`${where}: column ${column} is quarter ${clean(above.v)}`); }
      }
      let year = null;
      for (let c = index; c >= 0 && year === null; c -= 1) { const head = at(sheet, c, quarterRow - 1); if (head?.t === 'n') year = head.v; }
      if (year !== yearValue) failures.push(`${where}: column ${column} is under ${year}`);
      const label = clean(at(sheet, 0, number)?.v);
      if (measure === 'price_index') {
        if (row.source_sheet !== 'RPPI' || INDEX_LABELS[label] !== group) failures.push(`${where}: row ${number} is ${label}`);
      } else {
        if (row.source_sheet !== (measure === 'price_flat' ? 'Flats' : 'Detached houses')) failures.push(`${where}: read from ${row.source_sheet}`);
        if (DISTRICT_LABELS[label] !== group) failures.push(`${where}: row ${number} is ${label}`);
      }
    }
    if (row.unit !== unit) failures.push(`${where}: unit ${row.unit}`);
    if (row.basis !== 'actual' || row.value_status !== 'official') failures.push(`${where}: not actual and official`);
    if (cell.v === Number(row.value) && String(cell.v) === row.value) valuesMatched += 1; else failures.push(`${where}: value ${row.value} != ${cell.v}`);
    const places = formatPlaces(cell);
    // A General cell that stores a fraction (a few 2023 and 2024 areas) is published in whole square metres.
    if (places === null || (places !== PLACES[unit])) failures.push(`${where}: number format ${cell.z} does not show ${PLACES[unit]} decimals`);
    if (cell.z === 'General' && !Number.isInteger(cell.v) && unit !== 'square_metres') failures.push(`${where}: a fraction in a ${unit} cell`);
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

const observations = parseCsv(readFileSync(join(root, 'housing-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const find = (indicator, yearValue) => observations.findIndex(row => row.indicator_id === indicator && row.year === String(yearValue));
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const shiftRow = (row, by) => row.source_cell.replace(/\d+$/, n => String(Number(n) + by));
const shiftColumn = (row, by) => row.source_cell.replace(/^[A-Z]+/, letters => XLSX.utils.encode_col(XLSX.utils.decode_col(letters) + by));
const total = find('housing.permits_count.total', 2025), guria = find('housing.permits_count.region_guria', 2025);
const area = find('housing.permits_area.type_residential', 2025), count = find('housing.permits_count.type_residential', 2025), residential = find('housing.completed_count.type_residential', 2015);
const regional = find('housing.completed_count.region_tbilisi', 2020), preschool = find('housing.permits_count.type_preschool', 2010);
const flats = find('housing.price_flat.district_vake', 2025), index = find('housing.price_index.total', 2025);
const kakheti = find('housing.completed_count.region_kakheti_residential', 2007);
const negative = {
  altered_value_detected: detects(edit(total, { value: '11579', published_value: '11579' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(total, { year: '2024' })),
  neighbouring_column_detected: detects(edit(residential, { source_cell: shiftColumn(observations[residential], 1) })),
  type_column_swapped_detected: detects(edit(preschool, { source_cell: shiftColumn(observations[preschool], 1) })),
  area_row_read_as_count_detected: detects(edit(count, { source_cell: shiftRow(observations[count], 1) })),
  wrong_region_row_detected: detects(edit(guria, { source_cell: shiftRow(observations[guria], 2) })),
  number_row_read_as_area_detected: detects(edit(area, { source_cell: shiftRow(observations[area], -1) })),
  wrong_year_sheet_detected: detects(edit(residential, { source_sheet: '2014' })),
  regional_year_column_detected: detects(edit(regional, { source_cell: shiftColumn(observations[regional], 2) })),
  swapped_sheets_detected: detects(edit(flats, { source_sheet: 'Detached houses' })),
  third_quarter_detected: detects(edit(flats, { source_cell: shiftColumn(observations[flats], -1) })),
  index_row_swapped_detected: detects(edit(index, { source_cell: shiftRow(observations[index], 1) })),
  unrounded_published_value_detected: detects(edit(flats, { published_value: '5873.77' })),
  rounding_wrong_way_detected: detects(edit(index, { published_value: '159.3' })),
  no_data_cell_served_detected: detects([...observations, { ...observations[kakheti], year: '2006' }]),
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
