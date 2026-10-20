// Independent Excel-cell comparison for the SSA statistics research package.
// Reads every preserved workbook again with SheetJS, the web app's own dependency, not prepare.py's XML reader. Month
// names, the legacy Georgian font, hidden sheets and row lookup are implemented here separately. It then recomputes:
//   - every row of ssa-national-annual.csv from its cells (summed months, last month or the single published sheet);
//   - every recipients and money value of ssa-programmes-monthly.csv from the table and columns named in its source fields;
//   - every row of ssa-served-annual.csv from the workbook, sheets and cells it names, checking each cell's area name
//     (the social package groups' month-count sums included: each must read the people table, socpackage-01).
// Writes independent-validation.json only with --write.
//
//   node verify_independent.mjs [--write] [--official DIR] [--out DIR]
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? resolve(process.argv[i + 1]) : null; };
const official = arg('--official') ?? join(root, 'official');
const out = arg('--out') ?? root;

const GEORGIAN_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const ENGLISH_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const TYPOS = { jenuary: 1, ferbuary: 2, fabruary: 2, juiy: 7, junly: 7, setember: 9, desember: 12 };
const LETTERS = 'აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵ';
const TOTAL = /^(სულ|ჯამი|სულ ჯამი|საქართველო|სულ საქართველო)\s*:?$/;

const georgian = text => {
  const value = String(text ?? '');
  if (/[ა-ჿ]/.test(value) || !/[À-å]/.test(value)) return value.replace(/\s+/g, ' ').trim();
  return [...value].map(ch => { const code = ch.charCodeAt(0); return code >= 0xc0 && code <= 0xe5 ? LETTERS[code - 0xc0] : ch; })
    .join('').replace(/\s+/g, ' ').trim();
};
const monthNumber = name => {
  const key = name.toLowerCase().replace(/[\d\s_.-]+/g, '');
  if (TYPOS[key]) return TYPOS[key];
  const ka = GEORGIAN_MONTHS.findIndex(m => key.startsWith(m));
  if (ka >= 0) return ka + 1;
  const en = ENGLISH_MONTHS.findIndex(m => key.startsWith(m));
  return en >= 0 ? en + 1 : null;
};
const readCsv = path => {
  const [head, ...lines] = readFileSync(path, 'utf8').replace(/^﻿/, '').trimEnd().split('\n');
  const parse = line => { const cells = []; let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i];
      if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch; }
      else if (ch === '"') quoted = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur); return cells; };
  const fields = parse(head);
  return lines.map(line => Object.fromEntries(parse(line).map((v, i) => [fields[i], v])));
};

const index = JSON.parse(readFileSync(join(official, 'ssa-file-index.json'), 'utf8'));
const fileOf = new Map(index.files.filter(f => /^\d{4}$/.test(f.label.trim()))
  .map(f => [`${f.cat}-${String(f.ti).padStart(2, '0')}|${f.label.trim()}`, f.name]));

/** {month or 0: {rows: [{label, cells}]}} for one table-year, with hidden and explanations sheets left out. */
const cache = new Map();
function sheetsOf(tableId, year) {
  const key = `${tableId}|${year}`;
  if (cache.has(key)) return cache.get(key);
  const name = fileOf.get(key);
  if (!name) throw new Error(`no workbook for ${key}`);
  const workbook = XLSX.read(readFileSync(join(official, 'workbooks', name)), { type: 'buffer' });
  const meta = workbook.Workbook?.Sheets ?? [];
  const visible = workbook.SheetNames.filter((sheetName, i) => !meta[i]?.Hidden && !sheetName.includes('განმარტ'));
  const months = new Map();
  for (const sheetName of visible) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    // Some SSA sheets declare XFD as the last column while their numeric cells stop much earlier.
    const lastNumericColumn = Math.min(range.e.c, Object.entries(sheet).reduce((last, [address, cell]) =>
      cell.t === 'n' ? Math.max(last, XLSX.utils.decode_cell(address).c) : last, 0));
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const a = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
      if (!a || a.t !== 's') continue;
      const cells = {};
      for (let c = 1; c <= lastNumericColumn; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.t === 'n') cells[XLSX.utils.encode_col(c)] = cell.v;
      }
      if (Object.keys(cells).length) rows.push({ label: georgian(a.v), cells });
    }
    const month = visible.length === 1 && monthNumber(sheetName) === null ? 0 : monthNumber(sheetName);
    if (month !== null && rows.length && !months.has(month)) months.set(month, rows);
  }
  cache.set(key, months);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return months;
}
const totalOf = rows => rows.filter(row => TOTAL.test(row.label)).at(-1);
function rowNamed(rows, label) {
  const exact = rows.filter(row => row.label === label);
  if (exact.length) return TOTAL.test(label) ? exact.at(-1) : exact[0];
  const split = label.lastIndexOf(' / ');
  if (split < 0) return undefined;
  const group = label.slice(0, split), sub = label.slice(split + 3);
  const start = rows.findIndex(row => row.label === group);
  return start < 0 ? undefined : rows.slice(start + 1).find(row => row.label === sub);
}

const problems = [];
let annualChecked = 0, monthlyChecked = 0;
const close = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

for (const row of readCsv(join(out, 'ssa-national-annual.csv'))) {
  let months;
  try { months = sheetsOf(row.table_id, row.year); } catch (error) { problems.push(error.message); continue; }
  const valueIn = month => { const rows = months.get(month); const found = rows && rowNamed(rows, row.row_label); return found?.cells[row.column]; };
  let value;
  if (row.aggregation === 'as_published') value = valueIn(0);
  else if (row.aggregation === 'last_month') value = valueIn(Number(row.last_month));
  else {
    const found = [...months.keys()].filter(m => m > 0).map(valueIn).filter(v => v !== undefined);
    if (found.length !== Number(row.months_published)) problems.push(`${row.table_id} ${row.year} ${row.row_label} ${row.column}: ${found.length} months found, ${row.months_published} expected`);
    value = found.reduce((a, b) => a + b, 0);
  }
  annualChecked += 1;
  if (value === undefined || !close(value, Number(row.value), row.aggregation === 'sum_of_months' ? 0.006 : 1e-6)) {
    problems.push(`${row.table_id} ${row.year} ${row.row_label} ${row.column}: SheetJS ${value}, CSV ${row.value}`);
  }
}

for (const row of readCsv(join(out, 'ssa-programmes-monthly.csv'))) {
  for (const [field, source] of [['recipients', row.recipients_source], ['amount_gel', row.amount_source]]) {
    if (!source || row[field] === '') continue;
    const [tableId, spec] = source.split('!');
    let months;
    try { months = sheetsOf(tableId, row.year); } catch (error) { problems.push(error.message); continue; }
    let value;
    if (spec.startsWith('month-column-')) {
      const total = totalOf(months.get(0) ?? []);
      value = total?.cells[XLSX.utils.encode_col(Number(spec.slice('month-column-'.length)))];
    } else {
      const total = totalOf(months.get(Number(row.month)) ?? []);
      value = total ? spec.split('+').reduce((sum, column) => sum + (total.cells[column] ?? 0), 0) : undefined;
    }
    monthlyChecked += 1;
    if (value === undefined || !close(value, Number(row[field]), 1e-6)) {
      problems.push(`${row.programme} ${row.year}-${row.month} ${field} (${source}): SheetJS ${value}, CSV ${row[field]}`);
    }
  }
}

// Every ssa-served-annual.csv row: its cells are read again by address, added up and compared, and the area name printed
// in column A of each cell's row must be the place the row is served for.
let servedChecked = 0, groupCountsChecked = 0;
const servedPath = join(out, 'ssa-served-annual.csv');
if (existsSync(servedPath)) {
  const places = new Map(readCsv(join(root, 'area-mapping.csv')).map(row => [row.ssa_label, row]));
  const placeOf = label => {
    if (TOTAL.test(label)) return 'country.georgia';
    const row = places.get(label);
    if (!row) return undefined;
    if (row.kind === 'region') return row.region_id;
    if (row.kind === 'tbilisi_total') return 'region.tbilisi';
    if (row.kind === 'municipality' || row.kind === 'city_merged') return row.municipality_code;
    if (row.kind === 'excluded_area') return label.includes('ახალგორ') ? 'unit.akhalgori' : label === 'ზემო აფხაზეთი' ? 'unit.upper_abkhazia' : undefined;
    return undefined;
  };
  const books = new Map();
  const bookOf = name => {
    if (!books.has(name)) {
      const workbook = XLSX.read(readFileSync(join(official, 'workbooks', name)), { type: 'buffer' });
      const meta = workbook.Workbook?.Sheets ?? [];
      const monthly = workbook.SheetNames.filter((sheetName, i) => !meta[i]?.Hidden && !sheetName.includes('განმარტ')
        && monthNumber(sheetName) !== null && workbook.Sheets[sheetName]['!ref']);
      books.set(name, { sheets: workbook.Sheets, monthly });
      if (books.size > 40) books.delete(books.keys().next().value);
    }
    return books.get(name);
  };
  const rows = readCsv(servedPath).sort((a, b) => a.source_workbook.localeCompare(b.source_workbook));
  for (const row of rows) {
    const where = `${row.programme} ${row.measure} ${row.geography_id} ${row.year}`;
    servedChecked += 1;
    if (/^group\.[a-z_]+\.count_months_sum$/.test(row.measure)) {
      groupCountsChecked += 1;
      if (row.source_table !== 'socpackage-01') problems.push(`${where}: a month-count sum read from ${row.source_table}`);
    }
    if (fileOf.get(`${row.source_table}|${row.year}`) !== row.source_workbook) {
      problems.push(`${where}: ${row.source_workbook} is not the ${row.source_table} ${row.year} workbook`); continue;
    }
    const book = bookOf(row.source_workbook);
    const readings = row.source_cell.includes(';')
      ? row.source_cell.split(';').map(item => [item.slice(0, item.lastIndexOf('!')), item.slice(item.lastIndexOf('!') + 1)])
      : row.source_sheet === '*' ? book.monthly.map(sheetName => [sheetName, row.source_cell]) : [[row.source_sheet, row.source_cell]];
    if (row.source_sheet === '*' && readings.length !== Number(row.months)) problems.push(`${where}: ${readings.length} sheets, ${row.months} months`);
    if (Number(row.months) === 1 && /recipients|persons|families/.test(row.measure) && monthNumber(row.source_sheet) !== 12) {
      problems.push(`${where}: a December count read from sheet ${row.source_sheet}`);
    }
    let value = 0;
    for (const [sheetName, expression] of readings) {
      for (const ref of expression.split('+')) {
        const cell = book.sheets[sheetName]?.[ref];
        if (!cell || cell.t !== 'n') { problems.push(`${where}: ${sheetName}!${ref} holds no number`); continue; }
        value += cell.v;
        const label = georgian(book.sheets[sheetName][`A${XLSX.utils.decode_cell(ref).r + 1}`]?.v);
        if (placeOf(label) !== row.geography_id) problems.push(`${where}: ${sheetName}!${ref} is in the row of ${label}`);
      }
    }
    if (!close(value, Number(row.value), /amount/.test(row.measure) ? 1 : 1e-6)) problems.push(`${where}: SheetJS ${value}, CSV ${row.value}`);
  }
}

const report = { reader: `SheetJS ${XLSX.version}`, national_annual_rows_checked: annualChecked,
  programme_monthly_values_checked: monthlyChecked, served_rows_checked: servedChecked,
  social_package_group_count_rows_checked: groupCountsChecked, problems: problems.length,
  first_problems: problems.slice(0, 50),
  passed: problems.length === 0 };
console.log(JSON.stringify(report, null, 1));
if (process.argv.includes('--write')) writeFileSync(join(out, 'independent-validation.json'), JSON.stringify(report, null, 1) + '\n');
process.exit(problems.length ? 1 : 0);
