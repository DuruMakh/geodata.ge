// Independent Excel-cell comparison for the Geostat ICT household survey research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and recomputes
// every one of the 1,055 values from its cell: the stored value, the rounding to one decimal, the survey year (the
// nearest "June, 2016" / "July, 2018" label at or above the row), the printed column heading and the printed row label.
// The label tables below are written separately from prepare.py. Writes independent-validation.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_ict_homes_internet: '01_Share_of_households_with_internet_access.xlsx',
  geostat_ict_last_internet_use: '02_Distribution_of_population_aged_6_and_older_by_last_internet_use.xlsx',
  geostat_ict_purposes: '03_Share_of_population_aged_15_and_older_by_purposes_of_internet_use.xlsx',
  geostat_ict_internet_frequency: '04_Frequency_of_internet_use.xlsx',
  geostat_ict_ecommerce: '05_E-Commerce.xlsx',
  geostat_ict_homes_computer: '08_Share_of_households_with_computer_access.xlsx',
  geostat_ict_last_computer_use: '09_Distribution_of_population_aged_6_and_older_by_last_computer_use.xlsx',
  geostat_ict_own_mobile: '12_Share_of_population_aged_6_and_older_who_own_mobile_phone.xlsx',
  geostat_ict_own_smartphone: '14_Share_of_population_aged_6_and_older_who_own_smartphone.xlsx',
  geostat_ict_public_services: '16_Interaction_with_public_authorities_over_the_internet.xlsx',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, 'official', file)), { type: 'buffer', cellNF: true }).Sheets['1']]));
const EXPECTED_TOTAL = 1055;

// Written from the approved spec and the task brief, not from prepare.py.
const HOME_HEADERS = {
  Georgia: 'total', Urban: 'urban', Rural: 'rural', Tbilisi: 'region_tbilisi', 'Adjara A.R.': 'region_adjara', Guria: 'region_guria',
  'Imereti*': 'region_imereti', Kakheti: 'region_kakheti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
  'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti', 'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti',
  'Samtskhe-Javakheti': 'region_samtskhe_javakheti', 'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli',
};
const PEOPLE_HEADERS = {
  Total: 'total', Urban: 'urban', Rural: 'rural', Female: 'female', Male: 'male', '6-14 years': 'age_6_14', '15-29 years': 'age_15_29',
  '30-59 years': 'age_30_59', '60 years and older': 'age_60_plus',
};
const LATE = ['region_kvemo_kartli', 'region_samtskhe_javakheti', 'region_guria', 'region_mtskheta_mtianeti', 'region_racha_lechkhumi_kvemo_svaneti'];
const REGIONS = Object.values(HOME_HEADERS).filter(id => id.startsWith('region_'));
const PEOPLE = Object.values(PEOPLE_HEADERS);
const ADULTS = PEOPLE.filter(group => group !== 'age_6_14');
// measure: [source, row label in column B or null, groups served]
const MEASURES = {
  homes_internet: ['geostat_ict_homes_internet', null, ['total', 'urban', 'rural', ...REGIONS]],
  homes_computer: ['geostat_ict_homes_computer', null, ['total', 'urban', 'rural', ...REGIONS]],
  used_3m: ['geostat_ict_last_internet_use', 'Within last 3 months', PEOPLE],
  never_used: ['geostat_ict_last_internet_use', 'Never used', PEOPLE],
  daily: ['geostat_ict_internet_frequency', 'Every day or almost every day', ADULTS],
  bought_online: ['geostat_ict_ecommerce', null, ADULTS],
  activity_social: ['geostat_ict_purposes', 'Participating in social networks', ['total']],
  activity_news: ['geostat_ict_purposes', 'Reading online news sites/newspapers/news magazines', ['total']],
  activity_email: ['geostat_ict_purposes', 'Sending/receiving e-mails', ['total']],
  activity_calls: ['geostat_ict_purposes', 'Telephoning over the internet/video calls (via webcam) over the internet', ['total']],
  activity_health: ['geostat_ict_purposes', 'Seeking health-related information', ['total']],
  activity_goods_info: ['geostat_ict_purposes', 'Finding information about goods or services', ['total']],
  activity_jobs: ['geostat_ict_purposes', 'Looking for a job or sending a job application', ['total']],
  activity_banking: ['geostat_ict_purposes', 'Internet Banking', ['total']],
  activity_software: ['geostat_ict_purposes', 'Downloading software (other than games software)', ['total']],
  egov_any: ['geostat_ict_public_services', 'Interacted over the internet', ['total']],
  egov_info: ['geostat_ict_public_services', 'Obtaining information from websites of public authorities', ['total']],
  egov_download_forms: ['geostat_ict_public_services', 'Downloading official forms', ['total']],
  egov_submit_forms: ['geostat_ict_public_services', 'Submitting completed forms', ['total']],
  own_mobile: ['geostat_ict_own_mobile', null, PEOPLE],
  own_smartphone: ['geostat_ict_own_smartphone', null, PEOPLE],
  computer_3m: ['geostat_ict_last_computer_use', 'Within last 3 months', PEOPLE],
};

function parseCsv(text) {
  const [header, ...lines] = text.replace(/^﻿/, '').trim().split('\n');
  const fields = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [fields[i], value])));
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
const yearsOf = (measure, group) => measure === 'own_smartphone' ? range(2019, 2026)
  : measure.startsWith('homes_') && LATE.includes(group) ? range(2020, 2026) : range(2016, 2026);

/** A decimal token rounded half away from zero to 15 significant digits, then to one decimal. */
function published(token) {
  const exact = Number(Number(token).toPrecision(15)).toFixed(10);
  const [whole, fraction] = exact.split('.');
  let tenths = BigInt(whole + fraction[0]);
  if (Number(fraction[1]) >= 5) tenths += 1n;
  const digits = tenths.toString().padStart(2, '0');
  return `${digits.slice(0, -1)}.${digits.slice(-1)}`;
}

/** The heading text above a column: the first row whose cells hold "Total" or "Georgia". */
function headingOf(sheet, column) {
  const rows = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = rows.s.r; r <= rows.e.r; r++) {
    const labels = range(0, rows.e.c).map(c => clean(sheet[XLSX.utils.encode_cell({ r, c })]?.v));
    if (labels.includes('Total') || labels.includes('Georgia')) return clean(sheet[`${column}${r + 1}`]?.v);
  }
  return undefined;
}

/** The survey year of a row: the nearest year label in column A at or above it. */
function yearAt(sheet, row) {
  for (let r = row; r > 0; r--) {
    const match = /^(June|July), (\d{4})\*?$/.exec(clean(sheet[`A${r}`]?.v));
    if (match) return Number(match[2]);
  }
  return undefined;
}

function verify(rows) {
  const failures = [];
  const expected = new Set(Object.entries(MEASURES).flatMap(([measure, [, , groups]]) =>
    groups.flatMap(group => yearsOf(measure, group).map(year => `internet.${measure}.${group}:${year}`))));
  const seen = new Set();
  let valuesMatched = 0, roundingMatched = 0, contextMatched = 0;
  for (const row of rows) {
    const key = `${row.indicator_id}:${row.year}`;
    const where = `${key} ${row.source_cell}`;
    if (seen.has(key)) failures.push(`${where}: duplicate`);
    seen.add(key);
    if (!expected.has(key)) failures.push(`${where}: not an expected observation`);
    const [, measure, group] = row.indicator_id.split('.');
    const [source, label] = MEASURES[measure] ?? [];
    if (row.source_id !== source || row.source_sheet !== '1') { failures.push(`${where}: wrong source`); continue; }
    if (row.unit !== 'percent' || row.basis !== 'actual' || row.value_status !== 'survey_estimate') failures.push(`${where}: not a survey percentage`);
    const sheet = books[source];
    const cell = sheet[row.source_cell];
    if (cell?.t === 'n' && String(cell.v) === row.value && cell.z === '0.0') valuesMatched += 1;
    else failures.push(`${where}: stored ${cell?.v} is not ${row.value}`);
    if (published(row.value) === row.published_value) roundingMatched += 1;
    else failures.push(`${where}: published ${row.published_value} is not ${row.value} rounded`);
    const [, column, line] = /^([A-Z]+)(\d+)$/.exec(row.source_cell);
    const headers = measure.startsWith('homes_') ? HOME_HEADERS : PEOPLE_HEADERS;
    const contextOk = headers[headingOf(sheet, column)] === group && yearAt(sheet, Number(line)) === Number(row.year)
      && (label === null || clean(sheet[`B${line}`]?.v) === label);
    if (contextOk) contextMatched += 1;
    else failures.push(`${where}: heading, year or row label does not match`);
  }
  for (const key of expected) if (!seen.has(key)) failures.push(`${key}: missing`);
  if (rows.length !== EXPECTED_TOTAL) failures.push(`expected ${EXPECTED_TOTAL} observations, found ${rows.length}`);
  return { failures, valuesMatched, roundingMatched, contextMatched };
}

const observations = parseCsv(readFileSync(join(root, 'internet-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const find = (indicator, year) => observations.findIndex(row => row.indicator_id === indicator && row.year === String(year));
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const shiftRow = (row, by) => row.source_cell.replace(/\d+$/, n => String(Number(n) + by));
const shiftColumn = (row, by) => row.source_cell.replace(/^[A-Z]+/, letters => XLSX.utils.encode_col(XLSX.utils.decode_col(letters) + by));
const homes = find('internet.homes_internet.total', 2026), mobile = find('internet.own_mobile.total', 2026);
const used = find('internet.used_3m.urban', 2020), banking = find('internet.activity_banking.total', 2026), guria = find('internet.homes_internet.region_guria', 2020);
const negative = {
  altered_value_detected: detects(edit(homes, { value: '93.6', published_value: '93.6' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(homes, { year: '2025' })),
  neighbouring_column_detected: detects(edit(used, { source_cell: shiftColumn(observations[used], 1) })),
  neighbouring_row_label_detected: detects(edit(banking, { source_cell: shiftRow(observations[banking], -1) })),
  rounding_wrong_way_detected: detects(edit(mobile, { published_value: '93.4' })),
  unavailable_year_served_detected: detects([...observations, { ...observations[guria], year: '2019' }]),
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
