// Independent Excel-cell comparison for the Geostat business statistics research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// recomputes every one of the 4,643 values from its cell: the stored value, the rounding to the cell's number format,
// the year (column A, the year block above it, or the sheet name), the printed column heading or row label, and the
// table title. The label tables below are written separately from prepare.py. Writes independent-validation.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_business_turnover: 'official/0502EN0101_Turnover.xlsx',
  geostat_business_employed: 'official/0502EN0103_Number-of-persons-employed.xlsx',
  geostat_business_investment: 'official/0502EN0111_Investments-in-fixed-assets.xlsx',
  geostat_business_profit_loss: 'official/0502EN0114_Profit-and-loss.xlsx',
  geostat_business_demography: 'official/Main-results.xlsx',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));
const EXPECTED_TOTAL = 4643;

// Written from the approved spec and the task brief, not from prepare.py.
const SURVEY = {
  turnover: { source: 'geostat_business_turnover', title: 'TURNOVER BY', unit: 'gel_million', first: 1999 },
  employed: { source: 'geostat_business_employed', title: 'EMPLOYED PERSONS BY', unit: 'persons', first: 1999 },
  investment: { source: 'geostat_business_investment', title: 'INVESTMENTS IN FIXED ASSETS BY', unit: 'gel_million', first: 2006 },
  profit: { source: 'geostat_business_profit_loss', title: 'PROFIT BY', unit: 'gel_million', first: 2006 },
  loss: { source: 'geostat_business_profit_loss', title: 'LOSS BY', unit: 'gel_million', first: 2006 },
};
const SURVEY_HEADINGS = {
  total: ['Total', 'Georgia - total', 'total'],
  size_large: ['Large'], size_medium: ['Medium'], size_small: ['Small'],
  sector_a: ['Agriculture, forestry and fishing'], sector_b_e: ['Industry'], sector_f: ['Construction'],
  sector_g: ['Wholesale and retail trade; repair of motor vehicles and motorcycles'], sector_h: ['Transportation and storage'],
  sector_i: ['Accommodation and food service activities'], sector_j: ['Information and communication'],
  sector_l: ['Real estate activities'], sector_m: ['Professional, scientific and technical activities'],
  sector_n: ['Administrative and support service activities'], sector_p: ['Education'],
  sector_q: ['Human health and social work activities'], sector_r: ['Arts, entertainment and recreation'],
  sector_s: ['Other service activities'],
  region_tbilisi: ['Tbilisi'], region_adjara: ['Adjara AR'], region_guria: ['Guria'], region_imereti: ['Imereti'],
  region_kakheti: ['Kakheti'], region_mtskheta_mtianeti: ['Mtskheta-Mtianeti'],
  region_racha_lechkhumi_kvemo_svaneti: ['Racha-Lechkhumi and Kvemo Svaneti'], region_samegrelo_zemo_svaneti: ['Samegrelo-Zemo Svaneti'],
  region_samtskhe_javakheti: ['Samtskhe-Javakheti'], region_kvemo_kartli: ['Kvemo Kartli'], region_shida_kartli: ['Shida Kartli'],
};
const DEMOGRAPHY_ROWS = {
  total: 'Total', region_tbilisi: 'The city of Tbilisi', region_abkhazeti: 'Abkhazeti AR', region_adjara: 'Adjara AR',
  region_guria: 'Guria', region_imereti: 'Imereti', region_kakheti: 'Kakheti', region_mtskheta_mtianeti: 'Mtskheta-Mtianeti',
  region_racha_lechkhumi_kvemo_svaneti: 'Racha-Lechkhumi and Kvemo Svaneti', region_samegrelo_zemo_svaneti: 'Samegrelo-Zemo Svaneti',
  region_samtskhe_javakheti: 'Samtskhe-Javakheti', region_kvemo_kartli: 'Kvemo Kartli', region_shida_kartli: 'Shida Kartli',
  region_unknown: 'Unknown',
};
const SECTION_LETTERS = 'ABCDEFGHIJKLMNPQRS';
const FIRM_HEADINGS = {
  region: { active: 'active enterprises', births: 'enterprise births', deaths: 'enterprise deaths',
    birth_rate: 'enterprise birth rate (%)', death_rate: 'enterprise death rate (%)' },
  activity: { active: 'active enterprises', births: 'enterprise births', deaths: 'enterprise deaths',
    birth_rate: 'enterprise births %', death_rate: 'enterprise deaths %' },
};
const FIRM_UNITS = { active: 'enterprises', births: 'enterprises', deaths: 'enterprises', birth_rate: 'percent', death_rate: 'percent' };
const PLACES = { gel_million: 1, persons: 0, enterprises: 0, percent: 1 };

/** Every served (indicator, year), from the spec's year ranges. */
function expectedKeys() {
  const keys = new Set();
  const add = (id, first, last, skip = []) => { for (let y = first; y <= last; y += 1) if (!skip.includes(y)) keys.add(`${id}:${y}`); };
  for (const [measure, { first }] of Object.entries(SURVEY)) {
    for (const group of Object.keys(SURVEY_HEADINGS)) add(`business.${measure}.${group}`, group.startsWith('region_') ? 2006 : first, 2025);
  }
  const sections = [...[...SECTION_LETTERS].map(letter => `sector_${letter.toLowerCase()}`), 'sector_unknown'];
  for (const measure of ['active', 'births', 'deaths']) for (const group of [...Object.keys(DEMOGRAPHY_ROWS), ...sections]) add(`business.${measure}.${group}`, 2014, 2024);
  for (const group of ['total', ...sections]) {
    add(`business.birth_rate.${group}`, 2014, 2024);
    add(`business.death_rate.${group}`, 2014, 2024, group === 'total' ? [] : [2016, 2019]); // no death-rate column in those sheets
  }
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
const loose = value => clean(String(value ?? '').replace(/\*/g, ' ')).toLowerCase();
const split = address => { const [, column, row] = /^([A-Z]+)(\d+)$/.exec(address); return { column, row: Number(row) }; };

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

/** Decimals a cell's number format shows: '#,##0.0' and '0.0' one, '#,##0' and '0' none, 'General' none for whole numbers. */
function formatPlaces(cell) {
  const format = cell.z ?? 'General';
  if (format === 'General') return Number.isInteger(cell.v) ? 0 : null;
  const match = /^(?:#,##)?0(?:\.(0+))?$/.exec(format);
  return match ? (match[1] ?? '').length : null;
}

/** The survey table a row belongs to: the nearest title above it in column A, and its year in column A. */
function surveyContext(sheet, row, column) {
  let title = null;
  const headings = [];
  for (let n = row - 1; n >= 1; n -= 1) {
    const a = clean(sheet[`A${n}`]?.v);
    if (/^[A-Z ]+ BY /.test(a.toUpperCase()) && /[A-Z]{4}/.test(a)) { title = a.toUpperCase(); break; }
    const head = sheet[`${column}${n}`];
    if (head?.t === 's') headings.push(clean(head.v));
  }
  return { title, headings };
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
    const sheet = books[row.source_id]?.Sheets[row.source_sheet];
    const cell = sheet?.[row.source_cell];
    if (!cell || cell.t !== 'n') { failures.push(`${where}: ${row.source_sheet}!${row.source_cell} is not a numeric cell`); continue; }
    const { column, row: number } = split(row.source_cell);
    let unit;
    if (SURVEY[measure]) {
      const spec = SURVEY[measure];
      unit = spec.unit;
      if (row.source_id !== spec.source) failures.push(`${where}: source ${row.source_id}`);
      const year = sheet[`A${number}`];
      if (year?.t !== 'n' || year.v !== yearValue) failures.push(`${where}: row ${number} is not ${yearValue}`);
      if (sheet[`B${number}`]?.t === 's' && !['...', '…'].includes(clean(sheet[`B${number}`].v))) failures.push(`${where}: row ${number} is a quarter`);
      const { title, headings } = surveyContext(sheet, number, column);
      if (!title?.startsWith(spec.title.replace(/ +/g, ' '))) failures.push(`${where}: table title ${title}`);
      if (!SURVEY_HEADINGS[group]?.some(label => headings.includes(label))) failures.push(`${where}: column ${column} is not ${group} (${headings.join(' / ')})`);
      const kind = group === 'total' ? null : group.split('_')[0];
      const sheetKind = /^by kind/i.test(row.source_sheet) ? 'sector' : /^by enterprise size/i.test(row.source_sheet) ? 'size' : /^by region/i.test(row.source_sheet) ? 'region' : null;
      if (kind ? kind !== sheetKind : sheetKind !== 'sector') failures.push(`${where}: ${group} read from ${row.source_sheet}`);
    } else {
      unit = FIRM_UNITS[measure];
      if (row.source_id !== 'geostat_business_demography') failures.push(`${where}: source ${row.source_id}`);
      const activity = /^By kind of ec\.\s*activity\s*-\s*(\d{4})$/.exec(row.source_sheet);
      const headingRow = Object.keys(sheet).map(a => /^[A-Z]+(\d+)$/.exec(a)).filter(Boolean)
        .find(m => loose(sheet[m[0]].v) === 'active enterprises')?.[1];
      const headings = activity ? FIRM_HEADINGS.activity : FIRM_HEADINGS.region;
      if (loose(sheet[`${column}${headingRow}`]?.v) !== headings[measure]) failures.push(`${where}: column ${column} is not ${measure}`);
      if (activity) {
        if (Number(activity[1]) !== yearValue) failures.push(`${where}: sheet ${row.source_sheet} is not ${yearValue}`);
        const code = clean(sheet[`B${number}`]?.v);
        if (group === 'sector_unknown') {
          if (code || clean(sheet[`C${number}`]?.v) !== 'ACTIVITY UNKNOWN') failures.push(`${where}: row ${number} is not ACTIVITY UNKNOWN`);
        } else {
          const expected = group === 'total' ? 'TOTAL' : group.replace('sector_', '').toUpperCase();
          if (code !== expected || (group !== 'total' && !SECTION_LETTERS.includes(code))) failures.push(`${where}: row ${number} is ${code}`);
        }
      } else {
        if (clean(sheet[`B${number}`]?.v) !== DEMOGRAPHY_ROWS[group]) failures.push(`${where}: row ${number} is ${clean(sheet[`B${number}`]?.v)}`);
        if (measure.endsWith('_rate') && group !== 'total') failures.push(`${where}: regional rates are not served`);
        let block = number - 1;
        while (block > 0 && !(sheet[`B${block}`] === undefined && sheet[`C${block}`] !== undefined)) block -= 1;
        if (Number(clean(sheet[`C${block}`]?.v)) !== yearValue) failures.push(`${where}: block above row ${number} is not ${yearValue}`);
      }
    }
    if (row.unit !== unit) failures.push(`${where}: unit ${row.unit}`);
    if (row.basis !== 'actual' || row.value_status !== 'official') failures.push(`${where}: not actual and official`);
    if (cell.v === Number(row.value)) valuesMatched += 1; else failures.push(`${where}: value ${row.value} != ${cell.v}`);
    const places = formatPlaces(cell);
    if (places !== PLACES[unit]) failures.push(`${where}: number format ${cell.z} does not show ${PLACES[unit]} decimals`);
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

const observations = parseCsv(readFileSync(join(root, 'business-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const at = (indicator, yearValue) => observations.findIndex(row => row.indicator_id === indicator && row.year === String(yearValue));
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const turnover = at('business.turnover.total', 2025), large = at('business.turnover.size_large', 2020);
const tbilisi = at('business.active.region_tbilisi', 2024), section = at('business.births.sector_g', 2018);
const unknown = at('business.active.sector_unknown', 2024), sectionS = at('business.active.sector_s', 2024);
const profit = at('business.profit.total', 2025), loss = at('business.loss.total', 2025);
const negative = {
  altered_value_detected: detects(edit(turnover, { value: '253725.6', published_value: '253725.6' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(turnover, { year: '2024' })),
  neighbouring_column_detected: detects(edit(large, { source_cell: observations[large].source_cell.replace(/^[A-Z]+/, 'E') })),
  quarter_row_detected: detects(edit(turnover, { source_cell: observations[turnover].source_cell.replace(/\d+$/, n => String(Number(n) + 2)) })),
  swapped_sheets_detected: detects(edit(large, { source_sheet: 'By region' })),
  wrong_region_row_detected: detects(edit(tbilisi, { source_cell: observations[tbilisi].source_cell.replace(/\d+$/, n => String(Number(n) + 1)) })),
  wrong_year_sheet_detected: detects(edit(section, { source_sheet: 'By kind of ec.activity - 2017' })),
  loss_table_read_as_profit_detected: detects(edit(profit, {
    source_cell: observations[loss].source_cell, value: observations[loss].value, published_value: observations[loss].published_value })),
  section_row_read_as_unknown_detected: detects(edit(unknown, {
    source_cell: observations[sectionS].source_cell, value: observations[sectionS].value, published_value: observations[sectionS].published_value })),
  unrounded_published_value_detected: detects(edit(turnover, { published_value: '253725.50' })),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(books).length,
  observations: observations.length,
  stored_values_matched: result.valuesMatched,
  published_values_matched_rounding: result.roundingMatched,
  rows_with_matching_year_heading_and_title_context: result.contextMatched,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
