// Independent Excel-cell comparison for the crime and justice research package.
// Reads the preserved workbooks (.xlsx and the old .xls) with SheetJS, the web app's own dependency, not the Python readers. It
// finds every cell again from its printed row label (a repeated label, from the title or total row that precedes it) and its
// year heading, using label tables written separately from prepare.py. Every numeric cell, or whole number printed as text with a
// space, in a served row's year columns counts as an observation, so the served year ranges are derived here, not copied. It then
// compares all rows of crime-annual.csv with what it found: stored value, cell address, sheet, unit, published value, source ID,
// basis and status. It also re-checks every breakdown against its total, that the three convictions workbooks print one total, that
// each Georgian workbook holds the same numbers as its English original, and the manifest's SHA-256 and size of every archived file.
// Writes independent-validation.json unless --no-write.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

// Labels are compared with whitespace collapsed to single spaces (zero-width spaces dropped) and case ignored, so "Non specified"
// and "Nonspecified" stay different labels.
const compact = value => String(value ?? '').replace(/\u200b/g, '').split(/\s+/).filter(Boolean).join(' ').toLowerCase();
const book = path => XLSX.read(readFileSync(join(root, path)), { type: 'buffer' });
const column = address => address.replace(/\d+$/, '');
const rowOf = address => Number(address.replace(/^[A-Z]+/, ''));
const addresses = sheet => Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a));
const GROUPED = /^\d{1,3}( \d{3})+$/; // "49 976" (spaces collapsed first)
// A cell as a whole count: a number, or a number printed as text with a space for thousands. Anything else is null.
const count = cell => {
  if (!cell) return null;
  if (cell.t === 'n') return Number.isInteger(cell.v) && cell.v >= 0 ? cell.v : null;
  const text = String(cell.v).replace(/[\s\u200b]+/g, ' ').trim();
  return cell.t === 's' && GROUPED.test(text) ? Number(text.replace(/ /g, '')) : null;
};
const PLACEHOLDER = new Set(['…', '...', '-']);

const FILE = {
  recorded: 'official/Number-of-Recorded-Crimes.xlsx', types: 'official/Number-of-Convicts-by-Types-of-Crime.xls',
  ages: 'official/Composition-of-Convicts-by-Age-and-Sex.XLS', penalties: 'official/Number-of-Convicts-and-Penalties-Prescribed-by-Court.XLS',
  prison: 'official/Prison-Population.xls', victims: 'official/Data-on-Victim-Statistics.xlsx', road: 'official/Accidents.xlsx',
};
const SOURCE_ID = {
  recorded: 'geostat_crime_recorded', types: 'geostat_crime_convicts_types', ages: 'geostat_crime_convicts_age_sex',
  penalties: 'geostat_crime_convicts_penalties', prison: 'geostat_crime_prison', victims: 'geostat_crime_victims', road: 'geostat_crime_road',
};
const books = new Map(Object.entries(FILE).map(([key, file]) => {
  const workbook = book(file);
  if (workbook.SheetNames.length !== 1) throw new Error(`${file}: expected one sheet`);
  return [key, { sheet: workbook.Sheets[workbook.SheetNames[0]], name: workbook.SheetNames[0] }];
}));

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
/** Row of a label: below the first occurrence of each `after` label in turn; unique unless `first`. */
const rowFor = (labels, label, after = [], first = false) => {
  let start = 0;
  for (const step of after) {
    const found = labels.find(e => e.row > start && e.label === compact(step));
    if (!found) throw new Error(`No row "${step}" below row ${start}`);
    start = found.row;
  }
  const matches = labels.filter(e => e.row > start && e.label === compact(label)).map(e => e.row);
  if (matches.length === 0 || (matches.length > 1 && !first)) throw new Error(`Expected one row "${label}" after ${after.join(' > ')}, found ${matches}`);
  return matches[0];
};

// The cell map, written from the task brief and the design spec, not from prepare.py.
const ALL = (prefix, items) => items.map(([id, label]) => [`${prefix}${id}`, label]);
const TABLE = [];
const add = (workbook, unit, ids, { after = [], first = false } = {}) => ids.forEach(([id, label]) => TABLE.push({ id, workbook, unit, label, after, first }));
add('recorded', 'crimes', [['crime.recorded.total', 'Total crimes recorded']]);
add('recorded', 'crimes', ALL('crime.recorded.', [['life', 'Crimes against life'], ['health', 'Crimes against health'],
  ['rights', 'Crimes against human rights and freedoms'], ['family', 'Crimes against the family and minor'], ['property', 'Crimes against property'],
  ['public_safety', 'Crimes against public security and order'], ['drugs', 'Drug-related offences'], ['transport', 'Transport crime'],
  ['malfeasance', 'Malfeasance'], ['government', 'Crime against normal functioning of government'], ['other', 'Other Crimes']]), { after: ['of which:'] });
add('types', 'persons', [['crime.convicted.total', 'Total number of convicts']]);
add('types', 'persons', ALL('crime.convicted.type_', [['murder', 'Intentional murder'], ['aggravated_murder', 'Aggravated murder'],
  ['injury', 'Infliction of intentional injury'], ['rape', 'Rape'], ['larceny', 'Larceny'], ['robbery', 'Robbery'], ['theft', 'Theft'],
  ['drugs', 'Illegal production, manufacturing, acquisition, storage, transportation and sale of drugs'], ['hooliganism', 'Hooliganism'],
  ['traffic', 'Violation of rules of traffic safety and secure use of transport'], ['other', 'Others']]), { after: ['Type of crimes:'] });
add('ages', 'persons', ALL('crime.convicted.age_', [['14_17', '14-17 years old'], ['18_24', '18-24 years old'], ['25_29', '25-29 years old'],
  ['30_49', '30-49 years old'], ['50_plus', '50 years old and over']]), { after: ['Age Composition of Convicts (persons)', 'Of which:'] });
add('ages', 'persons', ALL('crime.convicted.sex_', [['women', 'Women'], ['men', 'Men']]), { after: ['Sex Composition of Convicts (persons)', 'Of which:'] });
add('penalties', 'persons', ALL('crime.convicted.sentence_', [['prison', 'Imprisonment'], ['corrective_labour', 'Corrective labour'],
  ['suspended', 'Suspended conviction'], ['fine', 'Fine'], ['deferred', 'Suspended sentence'], ['community_work', 'Public work'],
  ['other', 'Other penalties']]), { after: ['Sentenced to:'] });
add('prison', 'persons', [['crime.prison.total', 'Total number of inmates'], ['crime.prison.adults', 'Number of adult inmates'],
  ['crime.prison.juveniles', 'Number of juvenile inmates'], ['crime.prison.sentenced', 'Total number of Convicted'],
  ['crime.prison.pretrial', 'Total number of defendants']]);
add('prison', 'persons', [['crime.prison.women', 'women'], ['crime.prison.men', 'men']], { after: ['Total number of inmates', 'among them:'], first: true });
add('victims', 'persons', [['crime.victims.total', 'Total number of victims']]);
add('victims', 'persons', ALL('crime.victims.sex_', [['men', 'Men'], ['women', 'Women'], ['unknown', 'Non specified']]), { after: ['of which:'] });
add('victims', 'persons', ALL('crime.victims.age_', [['under_17', 'less then 17'], ['17_24', '17-24'], ['25_44', '25-44'], ['45_plus', 'more then 44'],
  ['unknown', 'Nonspecified']]), { after: ['Number of victims by age'], first: true });
add('victims', 'persons', ALL('crime.victims.citizenship_', [['georgia', 'Citizens of Georgia'], ['foreign', 'Foreigners'], ['dual', 'Dual citizenship'],
  ['stateless', 'Stateless'], ['unknown', 'Nonspecified']]), { after: ['Number of victims by citizenship'] });
add('road', 'accidents', [['crime.road.accidents', 'Total number of road traffic accidents'],
  ['crime.road.accidents_drunk', 'of which were caused by alcohol intoxication*']]);
add('road', 'persons', [['crime.road.injured', 'Persons injured'], ['crime.road.killed', 'Persons killed']]);
// Total rows that are read only to check the served convicts total
const TOTALS = [['types', 'Total number of convicts', []], ['ages', 'Total number of convicts', ['Age Composition of Convicts (persons)']],
  ['ages', 'Total number of convicts', ['Sex Composition of Convicts (persons)']], ['penalties', 'Total number of convicts', []]];

/** { year: { value, address } } of one row, for every year column of its heading whose cell is a whole count. */
function readRow(workbook, label, after, first) {
  const { sheet } = books.get(workbook);
  const labels = labelRows(sheet);
  const row = rowFor(labels, label, after, first);
  const header = headerRows(sheet).filter(h => h < row).pop();
  if (header === undefined) throw new Error(`No year heading above ${label}`);
  const out = {};
  for (const a of addresses(sheet).filter(a => rowOf(a) === header && column(a) !== 'A' && sheet[a].t === 'n')) {
    const cell = sheet[`${column(a)}${row}`];
    if (cell === undefined) continue;
    const value = count(cell);
    if (value === null) {
      if (cell.t === 's' && PLACEHOLDER.has(String(cell.v).trim())) continue;
      throw new Error(`Unexpected content in ${column(a)}${row} (${label}): ${cell.v}`);
    }
    out[sheet[a].v] = { value, address: `${column(a)}${row}` };
  }
  return out;
}

const expected = new Map();
for (const entry of TABLE) {
  for (const [year, found] of Object.entries(readRow(entry.workbook, entry.label, entry.after, entry.first))) {
    expected.set(`${entry.id}|${year}`, { ...found, unit: entry.unit, source: SOURCE_ID[entry.workbook], sheet: books.get(entry.workbook).name, file: FILE[entry.workbook] });
  }
}
const totals = TOTALS.map(([workbook, label, after]) => readRow(workbook, label, after, true));

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

const IDS = prefix => TABLE.filter(e => e.id.startsWith(prefix)).map(e => e.id);
const GROUPS = {
  recorded: ['crime.recorded.total', IDS('crime.recorded.').filter(id => id !== 'crime.recorded.total')],
  'convicts by type': ['crime.convicted.total', IDS('crime.convicted.type_')],
  'convicts by age': ['crime.convicted.total', IDS('crime.convicted.age_')],
  'convicts by sex': ['crime.convicted.total', IDS('crime.convicted.sex_')],
  'convicts by sentence': ['crime.convicted.total', IDS('crime.convicted.sentence_')],
  'prison by sex': ['crime.prison.total', ['crime.prison.women', 'crime.prison.men']],
  'prison by age': ['crime.prison.total', ['crime.prison.adults', 'crime.prison.juveniles']],
  'victims by sex': ['crime.victims.total', IDS('crime.victims.sex_')],
  'victims by age': ['crime.victims.total', IDS('crime.victims.age_')],
  'victims by citizenship': ['crime.victims.total', IDS('crime.victims.citizenship_')],
};

/** The identities that the sheets must satisfy, on any set of rows. Returns the failures. */
function crossChecks(rows) {
  const failures = [];
  const get = new Map(rows.map(row => [`${row.indicator_id}|${row.year}`, Number(row.value)]));
  const years = id => rows.filter(row => row.indicator_id === id).map(row => Number(row.year));
  const v = (id, year) => get.get(`${id}|${year}`) ?? NaN;
  for (const [name, [whole, parts]] of Object.entries(GROUPS)) {
    for (const year of years(whole)) {
      const sum = parts.reduce((total, id) => total + v(id, year), 0);
      if (sum !== v(whole, year)) failures.push(`${name} ${year}: ${sum} != ${v(whole, year)}`);
    }
  }
  for (const year of years('crime.prison.total').filter(y => y >= 2010)) {
    const sum = v('crime.prison.sentenced', year) + v('crime.prison.pretrial', year);
    if (sum !== v('crime.prison.total', year)) failures.push(`prison convicted and defendants ${year}: ${sum} != ${v('crime.prison.total', year)}`);
  }
  for (const year of years('crime.convicted.total')) {
    for (const [i, other] of totals.entries()) if (other[year]?.value !== v('crime.convicted.total', year)) failures.push(`convicts total ${year}: workbook ${i + 1} prints ${other[year]?.value}`);
  }
  return failures;
}

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
    if (/^\d+$/.test(row.value) && Number(row.value) === want.value) values += 1;
    else failures.push(`${where}: value ${row.value} != ${want.value}`);
    if (row.published_value === String(want.value)) displays += 1;
    else failures.push(`${where}: published value ${row.published_value} != ${want.value}`);
    if (row.unit === want.unit) units += 1;
    else failures.push(`${where}: unit ${row.unit} != ${want.unit}`);
    if (row.basis === 'actual' && row.value_status === 'official') statuses += 1;
    else failures.push(`${where}: basis/status ${row.basis}/${row.value_status}`);
  }
  for (const key of expected.keys()) if (!seenKeys.has(key)) failures.push(`${key}: derived from the workbooks but missing from the CSV`);
  failures.push(...crossChecks(rows));
  return { failures, values, displays, cells, units, statuses };
}

// Each Georgian workbook must hold the same whole numbers, at the same addresses, as its English original.
const MANIFEST = JSON.parse(readFileSync(join(root, 'source-manifest.json'), 'utf8'));
const numbers = path => {
  const workbook = book(path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const out = new Map();
  for (const a of addresses(sheet)) {
    const cell = sheet[a];
    const text = typeof cell.v === 'string' ? cell.v.replace(/[\s\u200b]+/g, ' ').trim() : '';
    if (cell.t === 'n') out.set(a, String(cell.v));
    else if (/^\d+( \d+)*$/.test(text)) out.set(a, text.replace(/ /g, ''));
  }
  return out;
};
const georgian = { pairs: 0, numeric_cells_compared: 0, differences: [] };
for (const [ka, en] of MANIFEST.filter(s => s.source_id.endsWith('_ka') && s.local_file.match(/\.xlsx?$/i)).map((s, i) => [s.local_file, MANIFEST[i].local_file])) {
  const a = numbers(ka), b = numbers(en);
  georgian.pairs += 1;
  georgian.numeric_cells_compared += b.size;
  for (const key of new Set([...a.keys(), ...b.keys()])) if (a.get(key) !== b.get(key)) georgian.differences.push(`${ka} ${key}: ${a.get(key)} != ${b.get(key)}`);
}
const manifestFailures = MANIFEST.flatMap(s => {
  const data = readFileSync(join(root, s.local_file));
  return createHash('sha256').update(data).digest('hex').toUpperCase() === s.sha256 && data.length === s.bytes ? [] : [`${s.local_file}: hash or size differs from the manifest`];
});

const observations = parseCsv(readFileSync(join(root, 'crime-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (indicator, year, change) => observations.map(row => (row.indicator_id === indicator && Number(row.year) === year ? { ...row, ...change } : row));
const plusOne = (indicator, year) => String(Number(observations.find(row => row.indicator_id === indicator && Number(row.year) === year).value) + 1);
const negative = {
  altered_value_detected: detects(edit('crime.road.killed', 2025, { value: '470', published_value: '470' })),
  altered_published_value_detected: detects(edit('crime.recorded.total', 2018, { published_value: '58413' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit('crime.road.injured', 2025, { year: '2024' })),
  wrong_cell_detected: detects(edit('crime.road.injured', 2020, { source_cell: 'W5' })),
  wrong_unit_detected: detects(edit('crime.road.accidents', 2025, { unit: 'persons' })),
  extra_2026_row_detected: detects([...observations, { ...observations[0], year: '2026' }]),
  recorded_sum_break_detected: crossChecks(edit('crime.recorded.property', 2025, { value: plusOne('crime.recorded.property', 2025) })).length > 0,
  convicts_sum_break_detected: crossChecks(edit('crime.convicted.sentence_fine', 2001, { value: plusOne('crime.convicted.sentence_fine', 2001) })).length > 0,
  convicts_total_break_detected: crossChecks(edit('crime.convicted.total', 2025, { value: plusOne('crime.convicted.total', 2025) })).length > 0,
  prison_sum_break_detected: crossChecks(edit('crime.prison.pretrial', 2025, { value: plusOne('crime.prison.pretrial', 2025) })).length > 0,
  victims_sum_break_detected: crossChecks(edit('crime.victims.citizenship_foreign', 2011, { value: plusOne('crime.victims.citizenship_foreign', 2011) })).length > 0,
};

const failures = [...result.failures, ...georgian.differences, ...manifestFailures];
const report = {
  status: failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: books.size,
  observations: observations.length,
  cells_found_again_from_labels: expected.size,
  source_cells_matched: result.cells,
  stored_values_matched: result.values,
  published_values_matched: result.displays,
  units_matched: result.units,
  basis_and_status_matched: result.statuses,
  cross_checks: ['11 recorded crime groups = all recorded crimes, 2015-2025', 'convicts by type, age, sex and sentence = total, 2001-2025',
    'the three convictions workbooks print the same total, 2001-2025 (the age-sex workbook twice)',
    'prison: women + men and adults + juveniles = all inmates, 2001-2025; convicted + defendants = all inmates, 2010-2025',
    'victims by sex, age and citizenship = total, every printed year'],
  georgian_copies: { pairs: georgian.pairs, numeric_cells_compared: georgian.numeric_cells_compared, differences: georgian.differences.length },
  manifest_files_matched: MANIFEST.length - manifestFailures.length,
  negative_controls: negative,
  failures: failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (!process.argv.includes('--no-write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
