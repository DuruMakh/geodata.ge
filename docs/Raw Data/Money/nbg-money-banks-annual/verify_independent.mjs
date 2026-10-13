// Independent Excel-cell comparison for the NBG money and banking research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// recomputes every one of the 730 values from its cell: stored value, rounding, the month or year in the row,
// the printed column heading, and, for calculated rows, the sum or ratio of the cells named in source_cell.
// The label tables below are written separately from prepare.py. Writes independent-validation.json on every run.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  nbg_money_aggregates: 'official/money-aggregates-and-monetary-ratioseng.xlsx',
  nbg_loans_l3_5: 'official/loans-to-the-economy-l3-5eng.xlsx',
  nbg_deposits_d3_17: 'official/depositsinterest-rates-d3-17eng.xlsx',
  nbg_deposits_individuals_d3_23: 'official/deposits-of-individuals-d3-23eng.xlsx',
  nbg_deposits_legal_d3_27: 'official/deposits-of-legal-entities-d3-27eng.xlsx',
  nbg_policy_rate: 'official/mpireng.xlsx',
  nbg_loan_rates_lwir: 'official/annual-weighted-loans-interest-rates-lwireng.xlsx',
  nbg_deposit_rates_dwir: 'official/annual-weighted-deposit-interest-rates-dwireng.xlsx',
  nbg_fsi_archive: 'official/fsieng-archive.xlsx',
  nbg_fsi: 'official/fsieng.xlsx',
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));

// Years served per indicator, written from the approved spec rather than from prepare.py.
const RANGES = {
  'money.m3': [1995, 2025], 'money.m2': [1995, 2025], 'money.m1': [1995, 2025], 'money.m0': [1995, 2025],
  'money.m3_to_gdp': [1996, 2025], 'money.m2_to_gdp': [1996, 2025],
  'loans.total': [2002, 2025], 'loans.gel': [2002, 2025], 'loans.fx': [2002, 2025], 'loans.fx_share': [2002, 2025],
  'deposits.gel': [1996, 2025], 'deposits.fx': [1996, 2025], 'deposits.total': [1996, 2025], 'deposits.fx_share': [1996, 2025],
  'deposits.individuals': [2002, 2025], 'deposits.legal_entities': [2015, 2025],
  'rates.policy': [2008, 2025],
  'rates.loans_total': [1996, 2025], 'rates.loans_gel': [1996, 2025], 'rates.loans_fx': [1996, 2025],
  'rates.deposits_total': [1996, 2025], 'rates.deposits_gel': [1996, 2025], 'rates.deposits_fx': [1996, 2025],
  'banks.npl_ratio': [2003, 2025], 'banks.roa': [2001, 2025], 'banks.roe': [2001, 2025],
  'banks.capital_ratio': [2014, 2025], 'banks.tier1_ratio': [2014, 2025],
};
const EXPECTED_TOTAL = 730;
// NBG prints every interest rate to two decimals; every other value is rounded to one.
const PLACES = Object.fromEntries(['rates.policy', 'rates.loans_total', 'rates.loans_gel', 'rates.loans_fx', 'rates.deposits_total', 'rates.deposits_gel', 'rates.deposits_fx'].map(id => [id, 2]));
const ARCHIVE_LAST = 2021;

// What a cell must be: where its row gets its date, and what its column heading reads.
const month = (source, sheet, headRow, head, unit) => ({ source, sheet, row: 'month', headRow, head, unit });
const year = (source, sheet, group) => ({ source, sheet, row: 'year', group });
const archive = (head, group) => ({ source: 'nbg_fsi_archive', sheet: 'FSI_Deposit_Takers_eng', row: 'archive', head, group });
const current = head => ({ source: 'nbg_fsi', sheet: 'FSD', row: 'current', head });
const M = 'Monetary Ratios-eng', L = 'Eng';
const D17 = ['NC Dep.volume&Int.rates-eng', 'FC Dep.volume&Int.rates-eng'];
const D23 = ['NC Dep.of Individuals-eng', 'FC Dep.of Individuals-eng'];
const total = 'Total Loans (including overdue Loans)';
const LEAF = {
  'money.m3': month('nbg_money_aggregates', M, 3, 'Money Aggregates (M3)'),
  'money.m2': month('nbg_money_aggregates', M, 3, 'Money Aggregates (M2)'),
  'money.m1': month('nbg_money_aggregates', M, 3, 'Money Aggregates (M1)'),
  'money.m0': month('nbg_money_aggregates', M, 3, 'Money Outside Banks (M0)'),
  'money.m3_to_gdp': month('nbg_money_aggregates', M, 3, 'Monetization Coefficient (M3)'),
  'money.m2_to_gdp': month('nbg_money_aggregates', M, 3, 'Monetization Coefficient (M2)'),
  'loans.total': month('nbg_loans_l3_5', L, 3, total),
  'loans.gel': month('nbg_loans_l3_5', L, 3, `${total} in national currency`),
  'loans.fx': month('nbg_loans_l3_5', L, 3, `${total} in foreign currency`),
  'deposits.gel': month('nbg_deposits_d3_17', D17[0], 4, 'Deposits, Total', 'Million GEL'),
  'deposits.fx': month('nbg_deposits_d3_17', D17[1], 4, 'Deposits, Total', 'Million GEL'),
  'deposits.individuals.gel': month('nbg_deposits_individuals_d3_23', D23[0], 4, 'Deposits, total', 'Million GEL'),
  'deposits.individuals.fx': month('nbg_deposits_individuals_d3_23', D23[1], 4, 'Deposits, total', 'Million GEL'),
  'deposits.legal_entities.gel': month('nbg_deposits_legal_d3_27', 'NC', 3, 'Total Deposits'),
  'deposits.legal_entities.fx': month('nbg_deposits_legal_d3_27', 'FC', 3, 'Total Deposits'),
  'rates.policy': { source: 'nbg_policy_rate', sheet: 'MPIR-Eng', row: 'policy' },
  'rates.loans_total': year('nbg_loan_rates_lwir', 'loans % Annual', 'Total'),
  'rates.loans_gel': year('nbg_loan_rates_lwir', 'loans % Annual', 'National currency'),
  'rates.loans_fx': year('nbg_loan_rates_lwir', 'loans % Annual', 'Foreign currency'),
  'rates.deposits_total': year('nbg_deposit_rates_dwir', 'Dep %-Annual', 'Total'),
  'rates.deposits_gel': year('nbg_deposit_rates_dwir', 'Dep %-Annual', 'National currency'),
  'rates.deposits_fx': year('nbg_deposit_rates_dwir', 'Dep %-Annual', 'Foreign currency'),
  'banks.npl_ratio': [archive("Nonperforming loans (by IMF's methodology) to total gross loans"), current('Nonperforming loans to total gross loans')],
  'banks.roa': [archive('Return on Assets'), current('Return on assets')],
  'banks.roe': [archive('Return on Equity'), current('Return on equity')],
  'banks.capital_ratio': [archive('Regulatory capital to risk-weighted assets', 'Basel III'), current('Regulatory capital to risk-weighted assets')],
  'banks.tier1_ratio': [archive('Regulatory Tier 1 capital to risk-weighted assets', 'Basel III'), current('Tier 1 capital to risk-weighted assets')],
};
// The leaf descriptors of a calculated row, in the order its cells appear in source_cell.
const CALCULATED = {
  'deposits.total': ['deposits.gel', 'deposits.fx'],
  'deposits.individuals': ['deposits.individuals.gel', 'deposits.individuals.fx'],
  'deposits.legal_entities': ['deposits.legal_entities.gel', 'deposits.legal_entities.fx'],
  'loans.fx_share': ['loans.fx', 'loans.total'],
  'deposits.fx_share': ['deposits.fx', 'deposits.gel', 'deposits.fx'],
};

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
const cellOf = (source, sheetName, address) => books[source]?.Sheets[sheetName]?.[address];
const dateOf = serial => new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
const columnNumber = letters => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const split = address => { const [, column, row] = /^([A-Z]+)(\d+)$/.exec(address); return { column, row: Number(row) }; };

/** The heading text at or left of a column in a row (a heading spans the columns to its right until the next). */
function spanHeading(sheet, row, column) {
  for (let n = columnNumber(column); n >= 1; n -= 1) {
    const letters = XLSX.utils.encode_col(n - 1);
    const text = clean(sheet[`${letters}${row}`]?.v);
    if (text) return text;
  }
  return '';
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

/** Check one cell against its leaf descriptor and year; returns the stored number or records failures. */
function readLeaf(leaf, yearValue, address, sheetName, failures, where) {
  const sheet = books[leaf.source]?.Sheets[sheetName];
  const cell = sheet?.[address];
  if (!cell || cell.t !== 'n') { failures.push(`${where}: ${sheetName}!${address} is not a numeric cell`); return null; }
  if (sheetName !== leaf.sheet) failures.push(`${where}: sheet ${sheetName} != ${leaf.sheet}`);
  const { column, row } = split(address);
  if (leaf.row === 'month') {
    const day = dateOf(sheet[`A${row}`]?.v);
    if (!(day.getUTCFullYear() === yearValue && day.getUTCMonth() === 11 && day.getUTCDate() === 31)) failures.push(`${where}: row ${row} is not 31 December ${yearValue}`);
    if (clean(sheet[`${column}${leaf.headRow}`]?.v).toLowerCase() !== leaf.head.toLowerCase()) failures.push(`${where}: heading ${clean(sheet[`${column}${leaf.headRow}`]?.v)} != ${leaf.head}`);
    if (leaf.unit && spanHeading(sheet, 3, column) !== leaf.unit) failures.push(`${where}: column ${column} is not under ${leaf.unit}`);
    if (leaf.source === 'nbg_loans_l3_5' && ![4, 5].some(n => clean(sheet[`${column}${n}`]?.v) === 'Total')) failures.push(`${where}: no Total sub-heading`);
  } else if (leaf.row === 'year') {
    if (Number(clean(sheet[`A${row}`]?.v)) !== yearValue) failures.push(`${where}: row ${row} is not ${yearValue}`);
    if (spanHeading(sheet, 3, column) !== leaf.group || clean(sheet[`${column}4`]?.v).toLowerCase() !== 'total') failures.push(`${where}: column ${column} is not ${leaf.group} total`);
  } else if (leaf.row === 'policy') {
    if (column !== 'C' || clean(sheet.C2?.v) !== 'Interest Rates, %') failures.push(`${where}: not the policy rate column`);
    let inForce = null;
    for (let n = 3; sheet[`B${n}`]?.t === 'n'; n += 1) if (dateOf(sheet[`B${n}`].v) <= new Date(Date.UTC(yearValue, 11, 31))) inForce = n;
    if (inForce !== row) failures.push(`${where}: row ${row} is not the rate in force on 31 December ${yearValue} (row ${inForce})`);
  } else if (leaf.row === 'archive') {
    if (clean(sheet[`${column}3`]?.v) !== `${yearValue}Q4`) failures.push(`${where}: column ${column} is not ${yearValue}Q4`);
    if (clean(sheet[`C${row}`]?.v) !== leaf.head) failures.push(`${where}: row label ${clean(sheet[`C${row}`]?.v)} != ${leaf.head}`);
    if (leaf.group) {
      let above = row;
      while (above > 3 && !clean(sheet[`B${above}`]?.v)) above -= 1;
      if (!clean(sheet[`B${above}`]?.v).includes(leaf.group)) failures.push(`${where}: row ${row} is not under ${leaf.group}`);
    }
  } else if (leaf.row === 'current') {
    const day = dateOf(sheet[`${column}3`]?.v);
    if (!(day.getUTCFullYear() === yearValue && day.getUTCMonth() === 11 && day.getUTCDate() === 31)) failures.push(`${where}: column ${column} is not 31 December ${yearValue}`);
    if (clean(sheet[`B${row}`]?.v) !== leaf.head || clean(sheet[`C${row}`]?.v) !== 'Percent') failures.push(`${where}: row ${row} is not ${leaf.head} (Percent)`);
  }
  return cell.v;
}

/** Evaluate a source_cell expression such as `V282/B282` or `J365/(J365+J365)` over its leaf cells. */
function evaluate(expression, sheetExpression, leaves, indicator, yearValue, failures, where) {
  const cellTokens = expression.match(/[A-Z]+\d+/g) ?? [];
  const sheetTokens = sheetExpression.split(/[+/()]/).filter(Boolean);
  if (cellTokens.length !== leaves.length) { failures.push(`${where}: ${cellTokens.length} cells for ${leaves.length} inputs`); return NaN; }
  if (sheetTokens.length !== 1 && sheetTokens.length !== cellTokens.length) failures.push(`${where}: sheet expression does not match cells`);
  let index = 0;
  const values = cellTokens.map(address => {
    const leaf = leaves[index];
    const sheetName = sheetTokens.length === 1 ? sheetTokens[0] : sheetTokens[index];
    index += 1;
    return readLeaf(leaf, yearValue, address, sheetName, failures, where);
  });
  if (values.some(value => value === null)) return NaN;
  let slot = 0;
  const source = expression.replace(/[A-Z]+\d+/g, () => `(${values[slot++]})`);
  if (!/^[0-9eE+\-*/().\s]+$/.test(source)) { failures.push(`${where}: unexpected expression ${expression}`); return NaN; }
  const result = Function(`"use strict"; return (${source});`)();
  return indicator.endsWith('_share') ? result * 100 : result;
}

function verify(rows) {
  const failures = [];
  const seen = new Set();
  let matchedValues = 0, matchedRounding = 0, matchedContext = 0, calculatedMatched = 0;
  for (const row of rows) {
    const yearValue = Number(row.year);
    const where = `${row.indicator_id}:${row.year}`;
    const key = where;
    if (seen.has(key)) failures.push(`${where}: duplicate`);
    seen.add(key);
    const range = RANGES[row.indicator_id];
    if (!range || yearValue < range[0] || yearValue > range[1]) { failures.push(`${where}: outside its years`); continue; }
    const before = failures.length;
    let expected;
    const calculated = CALCULATED[row.indicator_id];
    if (calculated) {
      expected = evaluate(row.source_cell, row.source_sheet, calculated.map(id => LEAF[id]), row.indicator_id, yearValue, failures, where);
      if (row.value_status !== 'calculated') failures.push(`${where}: not marked calculated`);
      if (Math.abs(expected - Number(row.value)) <= 1e-9 * Math.max(1, Math.abs(expected))) calculatedMatched += 1;
      else failures.push(`${where}: calculated ${row.value} != ${expected}`);
    } else {
      const leaf = LEAF[row.indicator_id];
      const descriptor = Array.isArray(leaf) ? leaf[yearValue <= ARCHIVE_LAST ? 0 : 1] : leaf;
      if (!descriptor || row.source_id !== descriptor.source) failures.push(`${where}: source ${row.source_id}`);
      expected = descriptor ? readLeaf(descriptor, yearValue, row.source_cell, row.source_sheet, failures, where) : null;
      if (row.value_status !== 'official') failures.push(`${where}: not marked official`);
      if (expected === Number(row.value)) matchedValues += 1; else failures.push(`${where}: value ${row.value} != ${expected}`);
    }
    if (roundHalfUp(row.value, PLACES[row.indicator_id] ?? 1) === row.published_value) matchedRounding += 1;
    else failures.push(`${where}: published ${row.published_value} is not ${row.value} rounded`);
    if (failures.length === before) matchedContext += 1;
  }
  const missing = Object.entries(RANGES).flatMap(([id, [first, last]]) =>
    Array.from({ length: last - first + 1 }, (_, i) => `${id}:${first + i}`)).filter(key => !seen.has(key));
  for (const key of missing.slice(0, 20)) failures.push(`${key}: missing`);
  if (rows.length !== EXPECTED_TOTAL) failures.push(`expected ${EXPECTED_TOTAL} observations, found ${rows.length}`);
  return { failures, matchedValues, matchedRounding, matchedContext, calculatedMatched };
}

const observations = parseCsv(readFileSync(join(root, 'money-banks-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const at = (indicator, yearValue) => observations.findIndex(row => row.indicator_id === indicator && row.year === String(yearValue));
const m3 = at('money.m3', 2025), fxShare = at('loans.fx_share', 2025), total2 = at('deposits.total', 2020), npl = at('banks.npl_ratio', 2019);
const negative = {
  altered_value_detected: detects(edit(m3, { value: '57680.3', published_value: '57680.3' })),
  altered_calculated_value_detected: detects(edit(fxShare, { value: '41.8', published_value: '41.8' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(m3, { year: '2024' })),
  neighbouring_column_detected: detects(edit(m3, { source_cell: 'E366' })),
  swapped_sheets_detected: detects(edit(total2, { source_sheet: 'FC Dep.volume&Int.rates-eng+NC Dep.volume&Int.rates-eng' })),
  wrong_quarter_detected: detects(edit(npl, { source_cell: observations[npl].source_cell.replace(/^[A-Z]+/, 'CI') })),
  unrounded_published_value_detected: detects(edit(m3, { published_value: '57680.22' })),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(books).length,
  observations: observations.length,
  stored_values_matched: result.matchedValues,
  calculated_values_recomputed: result.calculatedMatched,
  published_values_matched_rounding: result.matchedRounding,
  rows_with_matching_date_and_heading_context: result.matchedContext,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
