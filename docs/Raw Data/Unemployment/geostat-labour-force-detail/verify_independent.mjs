// Independent Excel-cell comparison for the Geostat Labour Force Survey detail research package.
// Reads the preserved workbooks with SheetJS, the web app's own dependency, not the Python reader. It finds every cell again from its
// printed row label (inside the block that follows its printed title: Women, Men, Urban, Rural, the two NEET titles) and its year
// heading, using label tables written separately from prepare.py. Every numeric cell in a served row's year columns counts as an
// observation, so the served year ranges are derived here, not copied. It then compares all rows of labour-annual.csv with what it
// found: stored value, cell address, sheet, unit, published value, source ID, basis and status. It also re-checks that the industry rows
// add up to each jobs total, that women plus men equal all persons, that hours table 10's all-persons block equals table 09's, that each
// Georgian workbook holds the same numbers as its English original, and the manifest's SHA-256 and size of every archived file.
// SheetJS keeps a number as a JavaScript double, not as its stored text, so the exact stored text is compared as a number here
// (the same double); prepare.py compares the text itself. Writes independent-validation.json unless --no-write.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

// Labels are compared with whitespace collapsed to single spaces (zero-width spaces dropped) and case ignored.
const compact = value => String(value ?? '').replace(/​/g, '').split(/\s+/).filter(Boolean).join(' ').toLowerCase();
const column = address => address.replace(/\d+$/, '');
const rowOf = address => Number(address.replace(/^[A-Z]+/, ''));
const addresses = sheet => Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a));
const PLACEHOLDER = new Set(['…', '...', '-']);

const FILE = {
  jobs: 'official/07-employment-by-branch-nace_eng.xlsx', hoursSex: 'official/09-hours-by-sex.xlsx',
  hoursSettlement: 'official/10-hours-by-urban-rular-areas.xlsx', informal: 'official/11-informal-employment.xlsx',
  underuse: 'official/12-labour-underutilization.xlsx', neet: 'official/14-neet_eng.xlsx',
};
const SOURCE_ID = {
  jobs: 'geostat_lfs_jobs_industry', hoursSex: 'geostat_lfs_hours_sex', hoursSettlement: 'geostat_lfs_hours_settlement',
  informal: 'geostat_lfs_informal', underuse: 'geostat_lfs_underuse', neet: 'geostat_lfs_neet',
};
const books = new Map(Object.entries(FILE).map(([key, file]) => [key, XLSX.read(readFileSync(join(root, file)), { type: 'buffer' })]));
const sheetOf = (workbook, name) => {
  const sheet = books.get(workbook).Sheets[name];
  if (!sheet) throw new Error(`${FILE[workbook]}: no sheet ${name}`);
  return sheet;
};

const labelRows = sheet => addresses(sheet).filter(a => column(a) === 'A' && sheet[a].t === 's')
  .map(a => ({ row: rowOf(a), label: compact(sheet[a].v) })).sort((a, b) => a.row - b.row);
/** Heading rows: at least three numbers right of column A, all whole years in increasing order. */
const headerRows = sheet => {
  const byRow = new Map();
  for (const a of addresses(sheet)) if (column(a) !== 'A' && sheet[a].t === 'n') byRow.set(rowOf(a), [...(byRow.get(rowOf(a)) ?? []), a]);
  return [...byRow].filter(([, cells]) => {
    const ordered = cells.sort((x, y) => x.length - y.length || x.localeCompare(y)).map(a => sheet[a].v);
    return ordered.length >= 3 && ordered.every(v => Number.isInteger(v) && v >= 1900 && v <= 2100) && ordered.every((v, i) => i === 0 || v > ordered[i - 1]);
  }).map(([row]) => row).sort((a, b) => a - b);
};

/** { first, last } rows of a block: below its title row (the sheet's top for no title) and above the next block title. */
function blockRows(labels, titles, title) {
  const rows = titles.map(t => {
    const hits = labels.filter(e => e.label === compact(t)).map(e => e.row);
    if (hits.length !== 1) throw new Error(`Block title "${t}" found ${hits.length} times`);
    return hits[0];
  });
  const lastRow = labels.length ? labels[labels.length - 1].row : 0;
  if (title === null) return { first: 0, last: rows.length ? rows[0] - 1 : lastRow };
  const i = titles.indexOf(title);
  return { first: rows[i], last: i + 1 < rows.length ? rows[i + 1] - 1 : lastRow };
}

/** { year: { value, address } } of one row: every numeric cell in the year columns of the heading above it. */
function readRow(workbook, sheetName, titles, title, label) {
  const sheet = sheetOf(workbook, sheetName);
  const labels = labelRows(sheet);
  const block = blockRows(labels, titles, title);
  const hits = labels.filter(e => e.row > block.first && e.row <= block.last && e.label === compact(label)).map(e => e.row);
  if (hits.length !== 1) throw new Error(`Row "${label}" found ${hits.length} times in block ${title} of ${FILE[workbook]} ${sheetName}`);
  const row = hits[0];
  const header = headerRows(sheet).filter(h => h > block.first && h < row).pop();
  if (header === undefined) throw new Error(`No year heading above ${label}`);
  const yearColumns = new Map(addresses(sheet).filter(a => rowOf(a) === header && column(a) !== 'A').map(a => [column(a), sheet[a].v]));
  const out = {};
  for (const a of addresses(sheet).filter(a => rowOf(a) === row && column(a) !== 'A')) {
    const cell = sheet[a];
    if (!yearColumns.has(column(a))) throw new Error(`Cell ${a} (${label}) is outside the year columns`);
    if (cell.t === 's' && PLACEHOLDER.has(String(cell.v).trim())) continue;
    if (cell.t !== 'n') throw new Error(`Unexpected content in ${a} (${label}): ${cell.v}`);
    out[yearColumns.get(column(a))] = { value: cell.v, address: a };
  }
  return out;
}

// The cell map, written from the task brief and the design spec, not from prepare.py.
const SECTOR = [
  ['total', 'Total'], ['sector_a', 'Agriculture, forestry and fishing'], ['sector_b_e', 'Industry'], ['sector_f', 'Construction'],
  ['sector_g', 'Wholesale and retail trade; repair of motor vehicles and motorcycles'], ['sector_h', 'Transportation and storage'],
  ['sector_i', 'Accommodation and food service activities'], ['sector_j', 'Information and communication'],
  ['sector_k', 'Financial and insurance activities'], ['sector_l', 'Real estate activities'],
  ['sector_m', 'Professional, scientific and technical activities'], ['sector_n', 'Administrative and support service activities'],
  ['sector_o', 'Public administration and defence; compulsory social security'], ['sector_p', 'Education'],
  ['sector_q', 'Human health and social work activities'], ['sector_r', 'Arts, entertainment and recreation'], ['sector_s', 'Other service activities'],
  ['sector_t', 'Activities of households as employers; Undifferentiated goods and services-producing activities of households for own use'],
  ['sector_u', 'Activities of extra-territorial organisations and bodies'], ['not_identified', 'Not identified'],
];
const HOURS_SECTOR = SECTOR.filter(([id]) => !['sector_l', 'sector_u', 'not_identified'].includes(id));
const NEET_TITLE = {
  age_15_24: 'Percentage of youth age 15-24 years not in employment, education or training (NEETs) (%)',
  age_15_29: 'Percentage of youth age 15-29 years not in employment, education or training (NEETs) (%)',
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const TABLE = [];
const add = (id, workbook, sheet, titles, title, label, unit) => TABLE.push({ id, workbook, sheet, titles, title, label, unit });
for (const [group, sheet, title] of [['all', 'NACE2', null], ['women', 'NACE2 sex', 'Women'], ['men', 'NACE2 sex', 'Men']]) {
  for (const [item, label] of SECTOR) add(`labour.jobs.${group}.${item}`, 'jobs', sheet, sheet === 'NACE2' ? [] : ['Women', 'Men'], title, label, 'thousand_persons');
}
for (const [group, workbook, titles, title] of [['all', 'hoursSex', ['Women', 'Men'], null], ['women', 'hoursSex', ['Women', 'Men'], 'Women'],
  ['men', 'hoursSex', ['Women', 'Men'], 'Men'], ['urban', 'hoursSettlement', ['Urban', 'Rural'], 'Urban'], ['rural', 'hoursSettlement', ['Urban', 'Rural'], 'Rural']]) {
  for (const [item, label] of HOURS_SECTOR) add(`labour.hours.${group}.${item}`, workbook, '1', titles, title, label, 'hours');
}
for (const [item, label] of [['total', 'Total'], ['women', 'Women'], ['men', 'Men'], ['urban', 'Urban'], ['rural', 'Rural']]) add(`labour.informal.${item}`, 'informal', '1', [], null, label, 'percent');
for (const [item, label] of [['unemployment_rate', 'Unemployment rate'], ['time_related', 'Combined rate of time-related underemployment* and unemployment'],
  ['potential', 'Combined rate of unemployed and potential labour force'], ['composite', 'Composite measure of labour underutilization']]) add(`labour.underuse.${item}`, 'underuse', '1', [], null, label, 'percent');
for (const [band, title] of Object.entries(NEET_TITLE)) {
  for (const [item, label] of [['total', 'Total'], ['women', 'Women'], ['men', 'Men']]) add(`labour.neet.${band}.${item}`, 'neet', '1', Object.values(NEET_TITLE), title, label, 'percent');
}
const IDS = TABLE.map(e => e.id);
if (IDS.length !== 160 || new Set(IDS).size !== 160) throw new Error(`Expected 160 indicators, found ${IDS.length}`);

const expected = new Map();
const noObservations = [];
for (const entry of TABLE) {
  const found = readRow(entry.workbook, entry.sheet, entry.titles, entry.title, entry.label);
  if (Object.keys(found).length === 0) noObservations.push(entry.id);
  for (const [year, cell] of Object.entries(found)) {
    expected.set(`${entry.id}|${year}`, { ...cell, unit: entry.unit, source: SOURCE_ID[entry.workbook], sheet: entry.sheet, file: FILE[entry.workbook] });
  }
}
// Table 10's all-persons block, read only to be compared with table 09's
const settlementAll = new Map(HOURS_SECTOR.map(([item, label]) => [item, readRow('hoursSettlement', '1', ['Urban', 'Rural'], null, label)]));

/** One decimal after 15 significant digits, half up, from the double (JavaScript prints digits exactly, so no float arithmetic). */
function publish(value) {
  const text = value.toPrecision(15);
  if (/e/i.test(text)) throw new Error(`Unexpected exponent form for ${value}`);
  const [whole, fraction] = text.split('.');
  let tenths = BigInt(whole + fraction[0]);
  if (fraction[1] >= '5') tenths += 1n;
  return `${tenths / 10n}.${tenths % 10n}`;
}

function parseCsv(text) {
  const [header, ...lines] = text.replace(/^﻿/, '').trim().split('\n');
  const fields = header.split(',');
  return lines.map(line => {
    const values = line.split(',');
    return Object.fromEntries(fields.map((field, i) => [field, values[i]]));
  });
}

const TOLERANCE = 1e-6;
const HOURS_TOLERANCE = 1e-9;
/** The identities that the sheets must satisfy, on any set of rows. Returns the failures. */
function crossChecks(rows) {
  const failures = [];
  const get = new Map(rows.map(row => [`${row.indicator_id}|${row.year}`, Number(row.value)]));
  const v = (id, year) => get.get(`${id}|${year}`) ?? NaN;
  for (const group of ['all', 'women', 'men']) {
    const years = rows.filter(row => row.indicator_id === `labour.jobs.${group}.total`).map(row => Number(row.year));
    for (const year of years) {
      const sum = SECTOR.slice(1).reduce((total, [item]) => total + v(`labour.jobs.${group}.${item}`, year), 0);
      if (!(Math.abs(sum - v(`labour.jobs.${group}.total`, year)) < TOLERANCE)) failures.push(`jobs ${group} ${year}: industries add up to ${sum}, total ${v(`labour.jobs.${group}.total`, year)}`);
    }
  }
  for (const year of range(2020, 2025)) {
    const both = v('labour.jobs.women.total', year) + v('labour.jobs.men.total', year);
    if (!(Math.abs(both - v('labour.jobs.all.total', year)) < TOLERANCE)) failures.push(`jobs women + men ${year}: ${both} != ${v('labour.jobs.all.total', year)}`);
  }
  return failures;
}

/** Hours table 10's all-persons block against table 09's, taken from the rows given for table 09 (or the workbook's own). */
function hoursChecks(sexValue) {
  const failures = [];
  for (const [item] of HOURS_SECTOR) {
    const other = settlementAll.get(item);
    for (const year of range(2020, 2025)) {
      const a = sexValue(item, year), b = other[year]?.value;
      if (a === undefined || b === undefined) failures.push(`hours ${item} ${year}: missing in one table`);
      else if (!(Math.abs(a - b) < HOURS_TOLERANCE) || publish(a) !== publish(b)) failures.push(`hours ${item} ${year}: table 09 ${a}, table 10 ${b}`);
    }
  }
  return failures;
}
const hoursFromWorkbook = (item, year) => expected.get(`labour.hours.all.${item}|${year}`)?.value;

function verify(rows) {
  const failures = [];
  const seenKeys = new Set();
  let values = 0, displays = 0, cells = 0, units = 0, statuses = 0;
  for (const row of rows) {
    const key = `${row.indicator_id}|${row.year}`;
    const want = expected.get(key);
    if (!want) { failures.push(`${key}: not derived from the workbooks`); continue; }
    if (seenKeys.has(key)) failures.push(`${key}: listed twice`);
    seenKeys.add(key);
    const where = `${key} ${want.file} ${want.address}`;
    if (row.source_cell === want.address && row.source_sheet === want.sheet && row.source_id === want.source) cells += 1;
    else failures.push(`${where}: row points at ${row.source_id} ${row.source_sheet} ${row.source_cell}`);
    if (/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(row.value) && Number(row.value) === want.value) values += 1;
    else failures.push(`${where}: value ${row.value} != ${want.value}`);
    if (row.published_value === publish(want.value)) displays += 1;
    else failures.push(`${where}: published value ${row.published_value} != ${publish(want.value)}`);
    if (row.unit === want.unit) units += 1;
    else failures.push(`${where}: unit ${row.unit} != ${want.unit}`);
    if (row.basis === 'actual' && row.value_status === 'survey_estimate') statuses += 1;
    else failures.push(`${where}: basis/status ${row.basis}/${row.value_status}`);
  }
  for (const key of expected.keys()) if (!seenKeys.has(key)) failures.push(`${key}: derived from the workbooks but missing from the CSV`);
  failures.push(...crossChecks(rows));
  return { failures, values, displays, cells, units, statuses };
}

// Each Georgian workbook must hold the same numbers, at the same addresses, as its English original (sheets compared by position,
// since the Georgian copies name them in Georgian).
const MANIFEST = JSON.parse(readFileSync(join(root, 'source-manifest.json'), 'utf8'));
const numbers = path => {
  const workbook = XLSX.read(readFileSync(join(root, path)), { type: 'buffer' });
  return workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    return new Map(addresses(sheet).filter(a => sheet[a].t === 'n').map(a => [a, String(sheet[a].v)]));
  });
};
const georgian = { pairs: 0, numeric_cells_compared: 0, differences: [] };
const workbooks = MANIFEST.filter(s => /\.xlsx$/.test(s.local_file));
const english = workbooks.filter(s => !s.source_id.endsWith('_ka')), georgianCopies = workbooks.filter(s => s.source_id.endsWith('_ka'));
english.forEach((en, i) => {
  const ka = georgianCopies[i];
  if (ka.source_id !== `${en.source_id}_ka`) georgian.differences.push(`manifest order: ${ka.source_id} does not follow ${en.source_id}`);
  const a = numbers(ka.local_file), b = numbers(en.local_file);
  georgian.pairs += 1;
  if (a.length !== b.length) georgian.differences.push(`${ka.local_file}: ${a.length} sheets, English ${b.length}`);
  b.forEach((cells, index) => {
    georgian.numeric_cells_compared += cells.size;
    const other = a[index] ?? new Map();
    for (const key of new Set([...cells.keys(), ...other.keys()])) if (other.get(key) !== cells.get(key)) georgian.differences.push(`${ka.local_file} sheet ${index + 1} ${key}: ${other.get(key)} != ${cells.get(key)}`);
  });
});
const manifestFailures = MANIFEST.flatMap(s => {
  const data = readFileSync(join(root, s.local_file));
  return createHash('sha256').update(data).digest('hex').toUpperCase() === s.sha256 && data.length === s.bytes ? [] : [`${s.local_file}: hash or size differs from the manifest`];
});

const observations = parseCsv(readFileSync(join(root, 'labour-annual.csv'), 'utf8'));
const result = verify(observations);
const hoursFailures = hoursChecks(hoursFromWorkbook);
const detects = rows => verify(rows).failures.length > 0;
const edit = (indicator, year, change) => observations.map(row => (row.indicator_id === indicator && Number(row.year) === year ? { ...row, ...change } : row));
const plusOne = (indicator, year) => String(Number(observations.find(row => row.indicator_id === indicator && Number(row.year) === year).value) + 1);
const negative = {
  altered_value_detected: detects(edit('labour.informal.total', 2025, { value: '28.4', published_value: '28.4' })),
  altered_published_value_detected: detects(edit('labour.jobs.all.total', 2025, { published_value: '1389.6' })),
  omitted_row_detected: detects(observations.slice(1)),
  omitted_zero_detected: detects(observations.filter(row => !(row.indicator_id === 'labour.jobs.all.not_identified' && row.year === '2018'))),
  shifted_year_detected: detects(edit('labour.neet.age_15_24.total', 2025, { year: '2024' })),
  wrong_cell_detected: detects(edit('labour.underuse.composite', 2020, { source_cell: 'C6' })),
  wrong_sheet_detected: detects(edit('labour.jobs.women.total', 2020, { source_sheet: 'NACE2' })),
  wrong_unit_detected: detects(edit('labour.hours.all.total', 2025, { unit: 'percent' })),
  wrong_status_detected: detects(edit('labour.informal.total', 2025, { value_status: 'official' })),
  extra_2026_row_detected: detects([...observations, { ...observations[0], year: '2026' }]),
  placeholder_served_detected: detects([...observations, { ...observations.find(row => row.indicator_id === 'labour.hours.women.sector_t'), indicator_id: 'labour.hours.men.sector_t' }]),
  jobs_sum_break_detected: crossChecks(edit('labour.jobs.women.sector_g', 2022, { value: plusOne('labour.jobs.women.sector_g', 2022) })).length > 0,
  jobs_total_break_detected: crossChecks(edit('labour.jobs.all.total', 2017, { value: plusOne('labour.jobs.all.total', 2017) })).length > 0,
  jobs_sex_break_detected: crossChecks(edit('labour.jobs.men.total', 2025, { value: plusOne('labour.jobs.men.total', 2025) })).length > 0,
  hours_block_break_detected: hoursChecks((item, year) => (item === 'sector_g' && year === 2023 ? hoursFromWorkbook(item, year) + 0.5 : hoursFromWorkbook(item, year))).length > 0,
};

const failures = [...result.failures, ...hoursFailures, ...georgian.differences, ...manifestFailures];
if (noObservations.join() !== 'labour.hours.men.sector_t') failures.push(`indicators without observations: ${noObservations.join()}`);
const report = {
  status: failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: books.size,
  indicators: IDS.length,
  indicators_without_observations: noObservations,
  observations: observations.length,
  cells_found_again_from_labels: expected.size,
  source_cells_matched: result.cells,
  stored_values_matched: result.values,
  published_values_matched: result.displays,
  units_matched: result.units,
  basis_and_status_matched: result.statuses,
  cross_checks: ['the 19 industry rows of each jobs group = its total, every year (tolerance 0.000001)',
    'jobs of women + men = jobs of all persons, 2020-2025 (tolerance 0.000001)',
    'hours table 10 all-persons block = table 09 all-persons block, 17 rows x 6 years (tolerance 0.000000001, equal published values)'],
  georgian_copies: { pairs: georgian.pairs, numeric_cells_compared: georgian.numeric_cells_compared, differences: georgian.differences.length },
  manifest_files_matched: MANIFEST.length - manifestFailures.length,
  negative_controls: negative,
  failures: failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (!process.argv.includes('--no-write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
