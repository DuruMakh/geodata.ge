// Independent Excel-cell comparison for the Geostat science and culture research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not xlrd or the Python XML reader, and
// recomputes every one of the 1,733 values from its cell: the stored value (a "-" is none, zero, where the rows add up only so),
// the rounding to the published decimals, the year (the heading above the column, or the year in column A of a patent row),
// the column heading (Total, Women, Men; the patent procedure, kind and local/foreign), the block heading (museum visitors,
// tours and exhibitions; the staff Total, Women and Men blocks), the printed row label and the sheet. The label tables below
// are written separately from prepare.py. Writes independent-validation.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_science_researchers: 'official/Researchers.xlsx',
  geostat_science_rd_staff: 'official/R&D-Personal.xlsx',
  geostat_science_institutions: 'official/Institutions.xlsx',
  geostat_science_patents: 'official/Invention-Utility-Model.xlsx',
  geostat_culture_museums: 'official/Main-charasteristics-of-Museums.xls',
  geostat_culture_museums_regions: 'official/Main-charasteristics-of-Museums-by-Regions.xls',
  geostat_culture_museums_count_regions: 'official/Number-of-Museums-by-Regions.xls',
  geostat_culture_museum_staff: 'official/Employed-Staff-in-Museums.xls',
  geostat_culture_theatres: 'official/Main-Indicators-Of-Professional-Theatres.xls',
  geostat_culture_theatre_events: 'official/Events.xls',
  geostat_culture_theatre_staff: 'official/Employed-Staff-in-Theatres.xls',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));
const EXPECTED_TOTAL = 1733;

// Written from the approved spec and the task brief, not from prepare.py.
const REGION_LABELS = {
  'Georgia, total': 'total', Tbilisi: 'region_tbilisi', 'Adjar AR': 'region_adjara', 'Adjara AR': 'region_adjara', Guria: 'region_guria',
  Imereti: 'region_imereti', Kakheti: 'region_kakheti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
  'Racha-Lechkhumi and Kvemo svaneti': 'region_racha_lechkhumi_kvemo_svaneti', 'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti',
  'Samtskhe-Javakheti': 'region_samtskhe_javakheti', 'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli',
};
const REGION_IDS = [...new Set(Object.values(REGION_LABELS))].filter(id => id !== 'total');
const UNIT_OF = {
  researchers: 'persons', rd_staff: 'persons', institutions: 'count', rd_spending: 'gel_million', invention_applications: 'count',
  invention_patents: 'count', utility_applications: 'count', utility_patents: 'count', museums: 'count', museum_visitors: 'persons_thousand',
  museum_tours: 'count_thousand', museum_exhibitions: 'count', museum_staff: 'persons', theatres: 'count', theatre_seats: 'count_thousand',
  theatre_audience: 'persons_thousand', theatre_shows: 'count', theatre_events: 'count', theatre_staff: 'persons',
};
const WHOLE = new Set(['persons', 'count']);
const SOURCES_OF = {
  researchers: ['geostat_science_researchers'], rd_staff: ['geostat_science_rd_staff'],
  institutions: ['geostat_science_institutions'], rd_spending: ['geostat_science_institutions'],
  invention_applications: ['geostat_science_patents'], invention_patents: ['geostat_science_patents'],
  utility_applications: ['geostat_science_patents'], utility_patents: ['geostat_science_patents'],
  museums: ['geostat_culture_museums', 'geostat_culture_museums_count_regions'],
  museum_visitors: ['geostat_culture_museums_regions'], museum_tours: ['geostat_culture_museums_regions'],
  museum_exhibitions: ['geostat_culture_museums_regions'], museum_staff: ['geostat_culture_museum_staff'],
  theatres: ['geostat_culture_theatres'], theatre_seats: ['geostat_culture_theatres'],
  theatre_audience: ['geostat_culture_theatre_events'], theatre_shows: ['geostat_culture_theatre_events'],
  theatre_events: ['geostat_culture_theatre_events'], theatre_staff: ['geostat_culture_theatre_staff'],
};

// Row label per group, per table (column A, spaces collapsed).
const RESEARCHER_ROWS = {
  '1': { prefix: 'Number of Researchers by Level of Education', total: 'Researchers, total', degree_doctoral: 'Doctoral or equivalent (ISCED 8)',
    degree_master: "Master's or equivalent (ISCED 7)", degree_bachelor: "Bachelor's or equivalent (ISCED 6)",
    degree_short_cycle: 'Short-cycle tertiary (ISCED 5/4)' },
  '2': { prefix: 'Number of Researchers by Age Groups', age_under25: '<25', age_25_34: '25-34', age_35_44: '35-44', age_45_54: '45-54',
    age_55_64: '55-64', age_65_plus: '65+' },
  '3': { prefix: 'Number of Researchers by Fields of Science', field_natural: 'Natural sciences', field_engineering: 'Engineering and technology',
    field_medical: 'Medical and health sciences', field_agricultural: 'Agricultural and veterinary sciences', field_social: 'Social sciences',
    field_humanities: 'Humanities and the arts', field_not_identified: 'Not identified' },
};
const RD_ROWS = { total: 'R&D personnel, total', technicians: 'Technicians and equivalent staff', support: 'Other supporting staff',
  not_specified: 'Not specified' };
const PLAIN_ROWS = {
  geostat_science_institutions: { institutions: { total: 'Institutions, unit' }, rd_spending: { total: 'Total expenditure on R&D (Millions of GEL)' } },
  geostat_culture_museums: { museums: { total: 'Number of Museums, total', type_memorial: 'Memorial Museum', type_history: 'History/Regional Studies Museum',
    type_art: 'Arts Museum', type_reserve: 'Museum Reserve Museum', type_literature: 'Literature studies Museum', type_other: 'Others Museum' } },
  geostat_culture_theatres: { theatres: { total: 'Total number of theatres', type_drama: 'drama, musical comedy and miniatures', type_puppet: 'puppet',
    type_opera_ballet: 'opera and ballet', type_youth: 'children and youth' }, theatre_seats: { total: 'Number of seats in the hall, thsd (Including rented)' } },
  geostat_culture_theatre_events: {
    theatre_events: { total: 'Number of events (within the country)', away: 'of which: Number of offsite events', abroad: 'Number of events held abroad' },
    theatre_audience: { total: 'Number of attendance at events within the country, thsd. persons*' },
    theatre_shows: { total: 'Number of performances (within the country)', away: 'of which: Number of offsite performances', abroad: 'Number of performances held abroad' } },
};
const MUSEUM_BLOCK_HEADINGS = { museum_visitors: 'Number of visitors, thsd', museum_tours: 'Number of excursions, thsd', museum_exhibitions: 'Number of exhibitions, unit' };
const STAFF_ROWS = { total: 'Employed, total', permanent: 'Permanent, staff members', contract: 'Under a regular contract basis (agreement)',
  age_under25: 'under 25 years', age_25_54: '25-54 years', age_55_plus: '55 years and older' };
const PATENT_SHEETS = { invention: ['1', 'Invention'], utility: ['2', 'Utility Model'] };
const PATENT_GROUPS = { local: ['Local'], foreign: ['Foreign'], international: [''] };
const PATENT_PROCEDURE = { local: 'National Procedure', foreign: 'National Procedure', international: 'International Procedure' };
const PATENT_KIND = { applications: 'Number of Filed Applications', patents: 'Number of Registered Patents' };
const TITLES = {
  geostat_science_institutions: 'Number of Institutions that conducted R&D and their expenditures',
  geostat_culture_museums: 'Museums (Museum Unions) and Museum Reserves', geostat_culture_museums_regions: 'Main charasteristics of Museums (Museum Unions) and Museum Reserves by regions',
  geostat_culture_museums_count_regions: 'Number of Museums (Museum Unions) and Museum Reserves by regions',
  geostat_culture_theatres: 'Main Indicators Of Professional Theatres', geostat_culture_theatre_events: 'Data on events held by theaters',
  geostat_culture_museum_staff: 'Number of Staff Employed in Museums', geostat_culture_theatre_staff: 'Number of Staff Employed in Theatres',
  geostat_science_rd_staff: 'Number of Persons working on R&D by Status',
};

/** Every served (indicator, year), from the spec's year ranges. */
function expectedKeys() {
  const keys = new Set();
  const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const add = (measure, groups, first, last) => { for (const g of groups) for (const y of range(first, last)) keys.add(`science_culture.${measure}.${g}:${y}`); };
  const people = ['total', 'women', 'men'];
  add('researchers', [...people, ...Object.keys(RESEARCHER_ROWS['1']).filter(k => k.startsWith('degree_')), ...Object.keys(RESEARCHER_ROWS['2']).filter(k => k !== 'prefix'),
    ...Object.keys(RESEARCHER_ROWS['3']).filter(k => k !== 'prefix')], 2019, 2024);
  add('rd_staff', [...people, 'technicians', 'support', 'not_specified'], 2019, 2024);
  add('institutions', ['total'], 2019, 2024);
  add('rd_spending', ['total'], 2019, 2024);
  for (const prefix of ['invention', 'utility']) for (const kind of ['applications', 'patents']) add(`${prefix}_${kind}`, Object.keys(PATENT_GROUPS), 2016, 2025);
  add('museums', ['total', ...Object.keys(PLAIN_ROWS.geostat_culture_museums.museums).filter(k => k.startsWith('type_')), ...REGION_IDS], 2005, 2025);
  for (const measure of Object.keys(MUSEUM_BLOCK_HEADINGS)) add(measure, ['total', ...REGION_IDS], 2005, 2025);
  for (const measure of ['museum_staff', 'theatre_staff']) add(measure, [...people, ...Object.keys(STAFF_ROWS).filter(k => k !== 'total')], 2020, 2025);
  add('theatres', Object.keys(PLAIN_ROWS.geostat_culture_theatres.theatres), 2006, 2025);
  add('theatre_seats', ['total'], 2006, 2025);
  add('theatre_audience', ['total'], 2006, 2025);
  add('theatre_shows', ['total', 'away', 'abroad'], 2006, 2025);
  add('theatre_events', ['total', 'away', 'abroad'], 2021, 2025);
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
const cellsOfRow = (sheet, row) => Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a) && split(a).row === row).map(a => split(a).index).sort((a, b) => a - b);
const labelOf = (sheet, row) => clean(at(sheet, 0, row)?.v);
const isYear = cell => cell?.t === 'n' && Number.isInteger(cell.v) && cell.v >= 1900 && cell.v <= 2100;
/** The first row with no label in column A and at least two year cells: the year heading. */
function headingRow(sheet, after = 0) {
  const last = Math.max(...Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a)).map(a => split(a).row));
  for (let n = after + 1; n <= last; n += 1) {
    const years = cellsOfRow(sheet, n).filter(i => isYear(at(sheet, i, n)));
    if (!labelOf(sheet, n) && years.length > 1) return n;
  }
  return null;
}

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

/** Decimals the number format shows: '0.0' and '#,##0.0' one; '#\ ##0', '#\ ###', '0' and General none (null for any other format). */
function formatPlaces(cell) {
  const format = cell.z ?? 'General';
  if (['General', '#\\ ##0', '#\\ ###', '0'].includes(format)) return 0;
  if (['0.0', '#,##0.0'].includes(format)) return 1;
  return null;
}

/** Published decimals: none for counts and persons; otherwise the larger of the format's decimals and the stored number's. */
function publishedPlaces(cell, unit) {
  const shown = formatPlaces(cell);
  const stored = (String(cell.v).split('.')[1] ?? '').length;
  if (shown === null) return null;
  if (WHOLE.has(unit)) return shown === 0 && stored === 0 ? 0 : null;
  return Math.max(shown, stored);
}

/** Where the year of a cell comes from, and what the column and row must be called, per source. Returns failure texts. */
function context(row, sheet, measure, group, yearValue, address) {
  const failures = [];
  const { column, row: number, index } = split(address);
  const fail = text => failures.push(text);
  const source = row.source_id;
  const label = labelOf(sheet, number);
  const title = clean(at(sheet, 0, 1)?.v);
  if (TITLES[source] && !title.startsWith(TITLES[source])) fail(`title ${title}`);
  if (source === 'geostat_science_researchers' || source === 'geostat_science_rd_staff') {
    // A year heading over a Total, Women and Men column; the sub-heading and the offset from the year must agree.
    const rows = source === 'geostat_science_rd_staff' ? RD_ROWS : RESEARCHER_ROWS[row.source_sheet];
    if (source === 'geostat_science_researchers' && !title.startsWith(RESEARCHER_ROWS[row.source_sheet]?.prefix ?? '\0')) fail(`title ${title}`);
    const personKind = ['women', 'men'].includes(group) ? group : 'total';
    const expectedLabel = rows[['women', 'men'].includes(group) ? 'total' : group];
    if (label !== expectedLabel) fail(`row ${number} is ${label}`);
    const heading = headingRow(sheet);
    let yearIndex = index;
    while (yearIndex >= 0 && !isYear(at(sheet, yearIndex, heading))) yearIndex -= 1;
    if (at(sheet, yearIndex, heading)?.v !== yearValue) fail(`column ${column} is under ${at(sheet, yearIndex, heading)?.v}`);
    const offset = index - yearIndex;
    if (offset !== { total: 0, women: 1, men: 2 }[personKind] || clean(at(sheet, index, heading + 1)?.v).toLowerCase() !== personKind) {
      fail(`column ${column} is ${clean(at(sheet, index, heading + 1)?.v)} at offset ${offset}`);
    }
  } else if (source === 'geostat_science_patents') {
    const [prefix, kind] = measure.split('_');
    if (row.source_sheet !== PATENT_SHEETS[prefix]?.[0] || !title.startsWith(PATENT_SHEETS[prefix][1])) fail(`sheet ${row.source_sheet}`);
    if (at(sheet, 0, number)?.v !== yearValue) fail(`row ${number} is ${at(sheet, 0, number)?.v}`);
    const nearest = headingNumber => { for (let i = index; i >= 1; i -= 1) { const c = at(sheet, i, headingNumber); if (c && clean(c.v)) return clean(c.v); } return null; };
    if (nearest(2) !== PATENT_PROCEDURE[group]) fail(`column ${column} is under ${nearest(2)}`);
    if (nearest(3) !== PATENT_KIND[kind]) fail(`column ${column} is headed ${nearest(3)}`);
    if (clean(at(sheet, index, 4)?.v) !== PATENT_GROUPS[group][0]) fail(`column ${column} is ${clean(at(sheet, index, 4)?.v)}`);
  } else if (source === 'geostat_culture_museum_staff' || source === 'geostat_culture_theatre_staff') {
    // A Total, Women or Men title row (the only cell in its row), a year heading below it, then the labelled rows.
    let titleRow = number;
    while (titleRow > 0 && !(cellsOfRow(sheet, titleRow).length === 1 && ['Total', 'Women', 'Men'].includes(labelOf(sheet, titleRow)))) titleRow -= 1;
    const block = labelOf(sheet, titleRow);
    const wanted = ['women', 'men'].includes(group) ? group[0].toUpperCase() + group.slice(1) : 'Total';
    if (block !== wanted) fail(`row ${number} is in the ${block} block`);
    if (label !== STAFF_ROWS[['women', 'men'].includes(group) ? 'total' : group]) fail(`row ${number} is ${label}`);
    const heading = headingRow(sheet, titleRow);
    if (at(sheet, index, heading)?.v !== yearValue || heading > number) fail(`column ${column} is under ${at(sheet, index, heading)?.v}`);
    if (heading !== titleRow + 1) fail(`the year heading is not under the ${block} title`);
  } else if (source === 'geostat_culture_museums_regions') {
    let headingAbove = number;
    while (headingAbove > 0 && !(cellsOfRow(sheet, headingAbove).length === 1 && cellsOfRow(sheet, headingAbove)[0] === 1)) headingAbove -= 1;
    if (clean(at(sheet, 1, headingAbove)?.v) !== MUSEUM_BLOCK_HEADINGS[measure]) fail(`row ${number} is under ${clean(at(sheet, 1, headingAbove)?.v)}`);
    if (REGION_LABELS[label] !== group) fail(`row ${number} is ${label}`);
    const heading = headingRow(sheet);
    if (at(sheet, index, heading)?.v !== yearValue) fail(`column ${column} is under ${at(sheet, index, heading)?.v}`);
  } else {
    // One year heading over single columns: Institutions, museums, museums by region count, theatres, events.
    const heading = headingRow(sheet);
    if (at(sheet, index, heading)?.v !== yearValue) fail(`column ${column} is under ${at(sheet, index, heading)?.v}`);
    if (source === 'geostat_culture_museums_count_regions') {
      if (!(REGION_LABELS[label] === group && group !== 'total')) fail(`row ${number} is ${label}`);
    } else if (PLAIN_ROWS[source]?.[measure]?.[group] !== label) {
      fail(`row ${number} is ${label}`);
    }
  }
  return failures;
}

function verify(rows) {
  const failures = [];
  const seen = new Set();
  let valuesMatched = 0, roundingMatched = 0, contextMatched = 0, dashZeros = 0;
  for (const row of rows) {
    const where = `${row.indicator_id}:${row.year}`;
    const before = failures.length;
    if (seen.has(where)) failures.push(`${where}: duplicate`);
    seen.add(where);
    const [, measure, group] = row.indicator_id.split('.');
    const yearValue = Number(row.year);
    const unit = UNIT_OF[measure];
    if (!SOURCES_OF[measure]?.includes(row.source_id)) { failures.push(`${where}: source ${row.source_id}`); continue; }
    const sheet = books[row.source_id].Sheets[row.source_sheet];
    const cell = sheet?.[row.source_cell];
    const dash = cell?.t === 's' && clean(cell.v) === '-';
    if (!cell || !(cell.t === 'n' || dash)) { failures.push(`${where}: ${row.source_sheet}!${row.source_cell} is neither a number nor a dash`); continue; }
    if (yearValue > 2025) failures.push(`${where}: year after 2025`);
    if (measure === 'theatre_events' && yearValue < 2021) failures.push(`${where}: events before 2021 were not collected`);
    for (const text of context(row, sheet, measure, group, yearValue, row.source_cell)) failures.push(`${where}: ${text}`);
    if (row.unit !== unit) failures.push(`${where}: unit ${row.unit}`);
    if (row.basis !== 'actual' || row.value_status !== 'official') failures.push(`${where}: not actual and official`);
    if (dash) {
      // A dash is none (zero) in the tables where the rows add up only so: researchers, R&D staff, patents and staff.
      if (!['geostat_science_researchers', 'geostat_science_rd_staff', 'geostat_science_patents', 'geostat_culture_museum_staff', 'geostat_culture_theatre_staff'].includes(row.source_id)) failures.push(`${where}: a dash is not zero here`);
      if (row.value === '0' && row.published_value === '0' && WHOLE.has(unit)) { valuesMatched += 1; roundingMatched += 1; dashZeros += 1; }
      else failures.push(`${where}: a dash is published as ${row.value} / ${row.published_value}`);
    } else {
      if (cell.v === Number(row.value) && String(cell.v) === row.value) valuesMatched += 1; else failures.push(`${where}: value ${row.value} != ${cell.v}`);
      const places = publishedPlaces(cell, unit);
      if (places === null) failures.push(`${where}: number format ${cell.z} or the stored decimals do not fit ${unit}`);
      else if (roundHalfUp(row.value, places) === row.published_value) roundingMatched += 1;
      else failures.push(`${where}: published ${row.published_value} is not ${row.value} rounded to ${places} decimals`);
    }
    if (failures.length === before) contextMatched += 1;
  }
  const expected = expectedKeys();
  const missing = [...expected].filter(key => !seen.has(key));
  const extra = [...seen].filter(key => !expected.has(key));
  for (const key of missing.slice(0, 20)) failures.push(`${key}: missing`);
  for (const key of extra.slice(0, 20)) failures.push(`${key}: not in the spec's years`);
  if (rows.length !== EXPECTED_TOTAL) failures.push(`expected ${EXPECTED_TOTAL} observations, found ${rows.length}`);
  return { failures, valuesMatched, roundingMatched, contextMatched, dashZeros };
}

const observations = parseCsv(readFileSync(join(root, 'science-culture-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const find = (indicator, yearValue) => observations.findIndex(row => row.indicator_id === `science_culture.${indicator}` && row.year === String(yearValue));
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const shiftRow = (row, by) => row.source_cell.replace(/\d+$/, n => String(Number(n) + by));
const shiftColumn = (row, by) => row.source_cell.replace(/^[A-Z]+/, letters => XLSX.utils.encode_col(XLSX.utils.decode_col(letters) + by));
const researchers = find('researchers.total', 2024), women = find('researchers.women', 2024), age = find('researchers.age_65_plus', 2024);
const dash = find('researchers.degree_short_cycle', 2019), rdStaff = find('rd_staff.support', 2022);
const spending = find('rd_spending.total', 2022), localApps = find('invention_applications.local', 2025), international = find('utility_patents.international', 2025);
const museums = find('museums.type_art', 2010), regional = find('museums.region_guria', 2012);
const visitors = find('museum_visitors.region_samtskhe_javakheti', 2025), tours = find('museum_tours.total', 2025), staffWomen = find('museum_staff.women', 2025);
const staffTotal = find('theatre_staff.permanent', 2023), audience = find('theatre_audience.total', 2025), events = find('theatre_events.abroad', 2023);
const negative = {
  altered_value_detected: detects(edit(researchers, { value: '14047', published_value: '14047' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(researchers, { year: '2023' })),
  neighbouring_year_column_detected: detects(edit(researchers, { source_cell: shiftColumn(observations[researchers], -3) })),
  women_column_read_as_total_detected: detects(edit(women, { source_cell: shiftColumn(observations[women], -1) })),
  wrong_row_detected: detects(edit(age, { source_cell: shiftRow(observations[age], -1) })),
  wrong_sheet_detected: detects(edit(age, { source_sheet: '3' })),
  dash_published_as_number_detected: detects(edit(dash, { value: '1', published_value: '1' })),
  text_cell_served_detected: detects(edit(rdStaff, { source_cell: 'A1' })),
  unrounded_decimal_published_detected: detects(edit(visitors, { published_value: '164.9' })),
  rounded_million_detected: detects(edit(spending, { published_value: '171' })),
  patent_sheet_swapped_detected: detects(edit(localApps, { source_sheet: '2' })),
  patent_international_column_swapped_detected: detects(edit(international, { source_cell: shiftColumn(observations[international], -1) })),
  museum_type_row_swapped_detected: detects(edit(museums, { source_cell: shiftRow(observations[museums], 1) })),
  museum_count_region_row_swapped_detected: detects(edit(regional, { source_cell: shiftRow(observations[regional], 1) })),
  visitors_read_from_tours_block_detected: detects(edit(visitors, { source_cell: shiftRow(observations[visitors], 13) })),
  tours_read_from_exhibitions_block_detected: detects(edit(tours, { source_cell: shiftRow(observations[tours], 13) })),
  staff_women_read_from_men_block_detected: detects(edit(staffWomen, { source_cell: shiftRow(observations[staffWomen], 11) })),
  staff_total_read_from_women_block_detected: detects(edit(staffTotal, { source_cell: shiftRow(observations[staffTotal], 11) })),
  audience_read_from_average_row_detected: detects(edit(audience, { source_cell: shiftRow(observations[audience], 1) })),
  events_before_2021_served_detected: detects([...observations, { ...observations[events], year: '2020', source_cell: shiftColumn(observations[events], -3) }]),
  year_after_2025_detected: detects([...observations, { ...observations[audience], year: '2026' }]),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(books).length,
  observations: observations.length,
  stored_values_matched: result.valuesMatched,
  published_values_matched_rounding: result.roundingMatched,
  rows_with_matching_year_heading_and_label_context: result.contextMatched,
  dash_cells_read_as_zero: result.dashZeros,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
