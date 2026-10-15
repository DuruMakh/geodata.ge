// Independent Excel-cell comparison for the NBG external debt and reserves research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// recomputes every one of the 254 values from its cell: stored value (reserves: thousand USD to million USD), rounding,
// the date of the row or column, the printed row label or column heading, and the period-end rule.
// The label tables below are written separately from prepare.py. Writes independent-validation.json on every run.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  nbg_gross_external_debt_bpm6: 'official/edbpm6eng.xlsx',
  nbg_official_reserve_assets: 'official/templatesection-ieng.xlsx',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));

// Years served per indicator and the period end of the latest point, written from the approved spec rather than from prepare.py.
const DEBT_RANGE = [2006, 2025], RESERVES_RANGE = [1995, 2025], LATEST_YEAR = 2026;
const DEBT = {
  'ext_debt.total': 'Gross External Debt Position', 'ext_debt.government': 'General Government', 'ext_debt.central_bank': 'Central Bank',
  'ext_debt.banks': 'Deposit-Taking Corporations, except the Central Bank', 'ext_debt.companies': 'Other Sectors',
  'ext_debt.intercompany': 'Direct Investment: Intercompany Lending',
};
const RESERVES = { 'reserves.total': [3, 'Official Reserve Assets'], 'reserves.fx': [4, 'Foreign Currency Reserves'], 'reserves.sdr': [4, 'SDRs'], 'reserves.gold': [4, 'Gold'] };
const DEBT_SHEET = 'ED-GEO-Tb1', RESERVES_SHEET = 'GIR (eng) ';
const LATEST = { ext_debt: '2026-06-30', reserves: '2026-09-30' };
const EXPECTED_TOTAL = 6 * 21 + 4 * 32;

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
const dateOf = serial => new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
const split = address => { const [, column, row] = /^([A-Z]+)(\d+)$/.exec(address); return { column, row: Number(row) }; };
const sheetOf = (source, name) => books[source]?.Sheets[name];

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

/** Exact decimal rounding, half away from zero, of a stored value as Excel displays it (8.4499999999999993 shows 8.45). */
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

/** The latest date in a list of serials. */
const latestOf = serials => dateOf(Math.max(...serials));

function debtContext() {
  const sheet = sheetOf('nbg_gross_external_debt_bpm6', DEBT_SHEET);
  const headers = Object.keys(sheet).filter(key => /^[A-Z]+3$/.test(key) && sheet[key].t === 'n' && key !== 'A3');
  const memorandum = Object.keys(sheet).filter(key => /^A\d+$/.test(key) && clean(sheet[key].v).startsWith('Memorandum Items')).map(key => split(key).row);
  return { sheet, latest: latestOf(headers.map(key => sheet[key].v)), memorandum: memorandum[0] };
}

function reservesContext() {
  const sheet = sheetOf('nbg_official_reserve_assets', RESERVES_SHEET);
  const dated = Object.keys(sheet).filter(key => /^A\d+$/.test(key) && split(key).row >= 5 && sheet[key].t === 'n');
  return { sheet, latest: latestOf(dated.map(key => sheet[key].v)) };
}

const debt = debtContext(), reserves = reservesContext();

/** Check one cell against its indicator and year; returns the stored number (million USD) or records failures. */
function readCell(row, failures, where) {
  const indicator = row.indicator_id, year = Number(row.year);
  const isDebt = indicator in DEBT;
  const family = isDebt ? 'ext_debt' : 'reserves';
  const expectedSource = isDebt ? 'nbg_gross_external_debt_bpm6' : 'nbg_official_reserve_assets';
  const expectedSheet = isDebt ? DEBT_SHEET : RESERVES_SHEET;
  if (row.source_id !== expectedSource) failures.push(`${where}: source ${row.source_id}`);
  if (row.source_sheet !== expectedSheet) failures.push(`${where}: sheet ${row.source_sheet} != ${expectedSheet}`);
  if (row.unit !== 'usd_million' || row.basis !== 'actual' || row.value_status !== 'official') failures.push(`${where}: unit, basis or status`);
  const context = isDebt ? debt : reserves;
  const cell = context.sheet[row.source_cell];
  if (!cell || cell.t !== 'n') { failures.push(`${where}: ${row.source_cell} is not a numeric cell`); return null; }
  const { column, row: number } = split(row.source_cell);
  let day;
  if (isDebt) {
    day = dateOf(context.sheet[`${column}3`]?.v);
    const label = clean(context.sheet[`A${number}`]?.v);
    if (label !== DEBT[indicator]) failures.push(`${where}: row label ${label} != ${DEBT[indicator]}`);
    if (number >= context.memorandum) failures.push(`${where}: row ${number} is not above Memorandum Items`);
    for (let n = 4; n < number; n += 1) if (clean(context.sheet[`A${n}`]?.v) === DEBT[indicator]) failures.push(`${where}: an earlier row ${n} has the same label`);
  } else {
    day = dateOf(context.sheet[`A${number}`]?.v);
    const [headRow, head] = RESERVES[indicator];
    const heading = clean(context.sheet[`${column}${headRow}`]?.v);
    if (heading.toLowerCase() !== head.toLowerCase()) failures.push(`${where}: heading ${heading} != ${head}`);
    if (number < 5) failures.push(`${where}: row ${number} is above the data`);
  }
  if (day !== row.period_end) failures.push(`${where}: cell date ${day} != period_end ${row.period_end}`);
  const [first, last] = isDebt ? DEBT_RANGE : RESERVES_RANGE;
  if (year >= first && year <= last) {
    if (day !== `${year}-12-31`) failures.push(`${where}: ${day} is not 31 December ${year}`);
  } else if (year === LATEST_YEAR) {
    if (day !== context.latest || day !== LATEST[family]) failures.push(`${where}: ${day} is not the latest period ${LATEST[family]}`);
  } else failures.push(`${where}: outside its years`);
  return isDebt ? cell.v : cell.v / 1000;
}

function verify(rows) {
  const failures = [];
  const seen = new Set();
  let matchedValues = 0, matchedRounding = 0, matchedContext = 0;
  const byKey = {};
  for (const row of rows) {
    const where = `${row.indicator_id}:${row.year}`;
    if (seen.has(where)) failures.push(`${where}: duplicate`);
    seen.add(where);
    const before = failures.length;
    const expected = readCell(row, failures, where);
    if (expected !== null) {
      // Debt is the stored double itself; reserves are the stored double divided by 1000 (checked to 1e-12, as division of a double is inexact).
      const exact = row.indicator_id in DEBT ? Number(row.value) === expected : Math.abs(Number(row.value) - expected) <= 1e-12 * Math.max(1, Math.abs(expected));
      if (exact) matchedValues += 1; else failures.push(`${where}: value ${row.value} != ${expected}`);
    }
    if (roundHalfUp(row.value, 1) === row.published_value) matchedRounding += 1;
    else failures.push(`${where}: published ${row.published_value} is not ${row.value} rounded`);
    if (failures.length === before) matchedContext += 1;
    byKey[where] = Number(row.value);
  }
  const years = (first, last) => [...Array.from({ length: last - first + 1 }, (_, i) => first + i), LATEST_YEAR];
  const missing = [
    ...Object.keys(DEBT).flatMap(id => years(...DEBT_RANGE).map(y => `${id}:${y}`)),
    ...Object.keys(RESERVES).flatMap(id => years(...RESERVES_RANGE).map(y => `${id}:${y}`)),
  ].filter(key => !seen.has(key));
  for (const key of missing.slice(0, 20)) failures.push(`${key}: missing`);
  if (rows.length !== EXPECTED_TOTAL) failures.push(`expected ${EXPECTED_TOTAL} observations, found ${rows.length}`);
  // Accounting identities recomputed from the rows.
  let largestDebtGap = 0, largestResidual = 0;
  for (const y of years(...DEBT_RANGE)) {
    const parts = ['government', 'central_bank', 'banks', 'companies', 'intercompany'].reduce((s, p) => s + (byKey[`ext_debt.${p}:${y}`] ?? NaN), 0);
    const gap = Math.abs(parts - byKey[`ext_debt.total:${y}`]);
    if (!(gap <= 0.05)) failures.push(`ext_debt:${y}: groups differ from the total by ${gap}`);
    largestDebtGap = Math.max(largestDebtGap, gap || 0);
  }
  for (const y of years(...RESERVES_RANGE)) {
    const residual = Math.abs(byKey[`reserves.total:${y}`] - (byKey[`reserves.fx:${y}`] + byKey[`reserves.gold:${y}`] + byKey[`reserves.sdr:${y}`]));
    if (!(residual <= 30)) failures.push(`reserves:${y}: residual ${residual}`);
    largestResidual = Math.max(largestResidual, residual || 0);
  }
  return { failures, matchedValues, matchedRounding, matchedContext, largestDebtGap, largestResidual };
}

const observations = parseCsv(readFileSync(join(root, 'external-position-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const at = (indicator, yearValue) => observations.findIndex(row => row.indicator_id === indicator && row.year === String(yearValue));
const debtTotal = at('ext_debt.total', 2025), reservesTotal = at('reserves.total', 2025), reservesFx = at('reserves.fx', 2020), latestDebt = at('ext_debt.banks', 2026);
const nextColumn = address => address.replace(/^[A-Z]+/, letters => XLSX.utils.encode_col(XLSX.utils.decode_col(letters) + 1));
const negative = {
  altered_value_detected: detects(edit(debtTotal, { value: '27046.9', published_value: '27046.9' })),
  altered_reserves_value_detected: detects(edit(reservesTotal, { value: '6159.4', published_value: '6159.4' })),
  unconverted_thousand_usd_detected: detects(edit(reservesTotal, { value: '6159276.6272642547', published_value: '6159276.6' })),
  omitted_row_detected: detects(observations.slice(1)),
  duplicated_row_detected: detects([...observations, observations[0]]),
  shifted_year_detected: detects(edit(debtTotal, { year: '2024' })),
  neighbouring_column_detected: detects(edit(debtTotal, { source_cell: nextColumn(observations[debtTotal].source_cell) })),
  neighbouring_reserves_column_detected: detects(edit(reservesFx, { source_cell: nextColumn(observations[reservesFx].source_cell) })),
  wrong_period_end_detected: detects(edit(latestDebt, { period_end: '2026-09-30' })),
  wrong_sheet_detected: detects(edit(reservesTotal, { source_sheet: 'IR-eng' })),
  unrounded_published_value_detected: detects(edit(debtTotal, { published_value: '27046.94' })),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(books).length,
  observations: observations.length,
  stored_values_matched: result.matchedValues,
  published_values_matched_rounding: result.matchedRounding,
  rows_with_matching_date_and_label_context: result.matchedContext,
  largest_debt_group_gap_million_usd: Number(result.largestDebtGap.toExponential(2)),
  largest_reserves_residual_million_usd: Number(result.largestResidual.toFixed(1)),
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
