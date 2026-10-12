// Independent Excel-cell comparison for the household income and spending research package.
// Reads the 12 served workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// compares every extracted row with its cell: stored value, displayed value (15 significant digits, then half-up),
// year heading, area heading and printed label. Every numeric cell must be extracted exactly once or be a
// check-only value (the sum lines, "Other regions" and the regional Georgia column), and no "…" or "x" cell may be served.
// The label tables below are written separately from prepare.py. Writes nothing unless --write.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {};
for (const [domain, first] of [['income', 104], ['spending', 204]]) {
  for (const [offset, who, measure] of [[0, 'household', 'per_household'], [3, 'capita', 'per_capita']]) {
    for (const [step, area, suffix] of [[0, 'national', ''], [1, 'settlement', '-settlement'], [2, 'region', '-region']]) {
      const number = first + offset + step;
      FILES[`geostat_household_${domain}_${who}_${area}`] = { file: `official/${number}-${domain}-per-${who}${suffix}.xlsx`, area, measure };
    }
  }
}
const LINE = {
  '1. Income, total (2+3)': 'income.total', 'Wages and salaries': 'income.wages', 'From self-employment': 'income.self_employment',
  'From selling agricultural production': 'income.agriculture_sales', 'Pensions, scholarships, assistances': 'income.pensions_assistance',
  'Remittances from abroad': 'income.remittances', 'Money received as gift': 'income.gifts', '3. Non-cash income': 'income.non_cash',
  '4. Other cash inflows': 'income.other_inflows', 'Property disposal': 'income.property_disposal', 'Borrowing and dissaving': 'income.borrowing_dissaving',
  '1. Consumption expenditure, total (2+3)': 'spending.consumption', 'On food, beverages, tobacco': 'spending.food',
  'On clothes and footwear': 'spending.clothing', 'On household goods': 'spending.household_goods', 'On healthcare': 'spending.health',
  'Housing, water, electricity, gas and other fuels': 'spending.housing_utilities', 'On transport': 'spending.transport',
  'On education': 'spending.education', 'Other consumption expenditure': 'spending.other_consumption', '3. Non-cash expenditure': 'spending.non_cash',
  '4. Cash non-consumption expenditure': 'spending.non_consumption', 'On agriculture': 'spending.agriculture', 'On transfers': 'spending.transfers',
  'On saving and lending': 'spending.saving_lending', 'On property acquirement': 'spending.property',
};
const CHECK_LINE = new Set(['2. Cash income and transfers', '5. Cash inflows, total (2+4)', '6. Cash and non-cash inflows, total (3+5)',
  '2. Cash consumption expenditure', '5. Cash expenditure, total (2+4)', '6. Expenditure, total (3+5)']);
const REGION = {
  Kakheti: 'region.kakheti', Tbilisi: 'region.tbilisi', 'Shida Kartli': 'region.shida_kartli', 'Kvemo Kartli': 'region.kvemo_kartli',
  'Samtskhe-Javakheti': 'region.samtskhe_javakheti', 'Adjara A.R.': 'region.adjara', Guria: 'region.guria',
  'Samegrelo-Zemo Svaneti': 'region.samegrelo_zemo_svaneti', 'Imereti*': 'region.imereti', 'Mtskheta-Mtianeti': 'region.mtskheta_mtianeti',
  'Racha-Lechkhumi and Kvemo Svaneti': 'region.racha_lechkhumi_kvemo_svaneti',
};
const CHECK_ONLY_COLUMN = new Set(['Other regions**', 'Georgia']); // Regional workbooks only.
const FOOTNOTES = [
  '* The data of 2011-2018 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions.',
  '** Includes Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti regions.',
  '… The data is not available due to small sample size of the survey. Survey sample size has been increased since 2019.',
];
const EXPECTED_ROWS = 10638;

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

/** What Excel shows for a non-negative number with one decimal: 15 significant digits first, then half-up. */
function displayed(value) {
  if (!(value >= 0)) throw new Error(`Unexpected number: ${value}`);
  const [whole, fraction = ''] = value.toPrecision(15).split('.');
  const digits = `${fraction}00`;
  const scaled = BigInt(whole + digits[0]) + (digits[1] >= '5' ? 1n : 0n);
  const text = scaled.toString().padStart(2, '0');
  return `${text.slice(0, -1)}.${text.slice(-1)}`;
}

const sheets = Object.fromEntries(Object.entries(FILES).map(([id, { file }]) => {
  const book = XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true });
  if (book.SheetNames.length !== 1 || book.SheetNames[0] !== '1') throw new Error(`Unexpected sheets in ${file}`);
  return [id, book.Sheets['1']];
}));
const text = (sheet, address) => String(sheet[address]?.v ?? '').replace(/\s+/g, ' ').trim();
const isYear = cell => cell?.t === 'n' && cell.z === 'General';
const addresses = sheet => Object.keys(sheet).filter(key => !key.startsWith('!'));

/** What a numeric cell means, derived from its own row and column headings. */
function context(sourceId, address) {
  const sheet = sheets[sourceId];
  const { area } = FILES[sourceId];
  const { c, r } = XLSX.utils.decode_cell(address);
  const column = XLSX.utils.encode_col(c), row = r + 1;
  const label = text(sheet, `A${row}`);
  const line = label.startsWith('Property income (leasing, interest on deposit') ? 'income.property' : LINE[label];
  const checkLine = CHECK_LINE.has(label);
  if (area === 'national') {
    const yearRow = Math.min(...addresses(sheet).filter(a => isYear(sheet[a]) && a[0] === 'B').map(a => Number(a.slice(1))));
    return { year: Number(text(sheet, `${column}${yearRow}`)), area: 'georgia', line, checkLine, header: null, label };
  }
  if (area === 'settlement') {
    const yearRow = Math.min(...addresses(sheet).filter(a => isYear(sheet[a]) && a[0] === 'B').map(a => Number(a.slice(1))));
    let block = null;
    for (let above = row; above >= 1 && !block; above -= 1) {
      const heading = text(sheet, `A${above}`);
      if (heading === 'Urban' || heading === 'Rural') block = heading;
    }
    return { year: Number(text(sheet, `${column}${yearRow}`)), area: `settlement.${block?.toLowerCase()}`, line, checkLine, header: block, label };
  }
  let year = null;
  for (let above = row; above >= 1 && year === null; above -= 1) if (isYear(sheet[`A${above}`])) year = Number(sheet[`A${above}`].v);
  const header = text(sheet, `${column}2`);
  return { year, area: REGION[header], line, checkLine, header, label, checkColumn: CHECK_ONLY_COLUMN.has(header) };
}

function verify(rows) {
  const failures = [];
  const seen = new Set();
  let matchedValues = 0, matchedDisplay = 0, matchedContext = 0;
  for (const row of rows) {
    const sheet = sheets[row.source_id];
    const cell = sheet?.[row.source_cell];
    const where = `${row.source_id}:${row.source_cell}`;
    if (!cell || cell.t !== 'n') { failures.push(`${where}: not a numeric cell`); continue; }
    seen.add(where);
    if (Number(row.value) === cell.v) matchedValues += 1; else failures.push(`${where}: value ${row.value} != ${cell.v}`);
    if (displayed(cell.v) === row.published_value && cell.w?.replace(/,/g, '') === row.published_value) matchedDisplay += 1;
    else failures.push(`${where}: display ${cell.w} / ${displayed(cell.v)} != ${row.published_value}`);
    const meaning = context(row.source_id, row.source_cell);
    const { measure } = FILES[row.source_id];
    const label = meaning.header === null ? meaning.label : `${meaning.label} | ${meaning.header}`;
    if (meaning.year === Number(row.year) && meaning.line === row.indicator_id && meaning.area === row.area_id
        && measure === row.measure && label === row.source_label && !meaning.checkLine && !meaning.checkColumn) matchedContext += 1;
    else failures.push(`${where}: context ${JSON.stringify(meaning)} != ${row.indicator_id}:${row.area_id}:${row.measure}:${row.year}`);
  }
  let numericCells = 0, checkOnlyCells = 0, placeholderCells = 0;
  for (const [sourceId, sheet] of Object.entries(sheets)) {
    for (const address of addresses(sheet)) {
      const cell = sheet[address];
      const where = `${sourceId}:${address}`;
      if (cell.t === 's' && (cell.v === '…' || cell.v === 'x')) {
        placeholderCells += 1;
        if (seen.has(where)) failures.push(`${where}: placeholder served`);
      }
      if (cell.t !== 'n' || cell.z === 'General') continue; // year headings and year labels carry the General format
      numericCells += 1;
      const meaning = context(sourceId, address);
      if (meaning.checkLine || meaning.checkColumn) {
        checkOnlyCells += 1;
        if (seen.has(where)) failures.push(`${where}: check-only cell was extracted`);
      } else if (!meaning.line) failures.push(`${where}: unknown row label ${meaning.label}`);
      else if (!seen.has(where)) failures.push(`${where}: numeric cell not extracted`);
    }
    if (FILES[sourceId].area === 'region') {
      const notes = addresses(sheet).filter(a => a[0] === 'A' && /^(\*|…)/.test(text(sheet, a))).map(a => text(sheet, a));
      if (JSON.stringify(notes) !== JSON.stringify(FOOTNOTES)) failures.push(`${sourceId}: footnotes changed`);
    }
  }
  const unavailable = new Set(['region.samtskhe_javakheti', 'region.guria', 'region.mtskheta_mtianeti', 'region.racha_lechkhumi_kvemo_svaneti']);
  if (rows.some(row => unavailable.has(row.area_id) && Number(row.year) < 2019)) failures.push('a region is served before 2019');
  if (rows.length !== EXPECTED_ROWS) failures.push(`expected ${EXPECTED_ROWS} observations, found ${rows.length}`);
  return { failures, matchedValues, matchedDisplay, matchedContext, numericCells, checkOnlyCells, placeholderCells };
}

const observations = parseCsv(readFileSync(join(root, 'household-income-spending-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const target = observations.findIndex(row => row.indicator_id === 'income.total' && row.area_id === 'georgia'
  && row.measure === 'per_household' && row.year === '2025');
const regional = observations.findIndex(row => row.area_id === 'region.tbilisi' && row.source_id.endsWith('_region'));
const negative = {
  altered_value_detected: detects(edit(target, { value: '2025.9' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(target, { year: '2024' })),
  swapped_areas_detected: detects(edit(regional, { area_id: 'region.kakheti' })),
  swapped_settlement_detected: detects(observations.map(row => row.area_id === 'settlement.urban' ? { ...row, area_id: 'settlement.rural' }
    : row.area_id === 'settlement.rural' ? { ...row, area_id: 'settlement.urban' } : row)),
  displayed_digits_rule_pinned: displayed(8.4499999999999993) === '8.5' && displayed(2025.7499999999999) === '2025.8' && displayed(0) === '0.0',
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(sheets).length,
  observations: observations.length,
  workbook_formatted_numeric_cells: result.numericCells,
  check_only_numeric_cells: result.checkOnlyCells,
  placeholder_cells_not_served: result.placeholderCells,
  stored_values_matched: result.matchedValues,
  published_values_matched_displayed_digits: result.matchedDisplay,
  year_area_and_label_context_matched: result.matchedContext,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
