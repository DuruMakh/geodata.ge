// Independent Excel-cell comparison for the poverty research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// compares every extracted row with its cell: stored value, format rendering, year heading and printed label.
// Every numeric cell outside year headings and the lari poverty lines must be extracted exactly once.
// The label tables below are written separately from prepare.py. Writes nothing unless --write.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_poverty_absolute: 'official/302-absolute-poverty.xlsx',
  geostat_poverty_relative: 'official/301-relative-poverty.xlsx',
  geostat_poverty_international: 'official/304-international-poverty-2021ppp.xlsx',
  geostat_gini: 'official/303-gini-coefficients.xlsx',
};
// Column headings of the absolute workbook (row 2, or row 3 under "Age Group" and "Sex").
const ABSOLUTE = { B: 'settlement.urban', C: 'settlement.rural', D: 'age.0_17', E: 'age.18_64', F: 'age.65_plus', G: 'sex.female', H: 'sex.male', I: 'georgia' };
const GINI = { B: 'gini.total_income', C: 'gini.cash_inflows', D: 'gini.total_inflows', E: 'gini.consumption_expenditure', F: 'gini.cash_expenditure', G: 'gini.total_expenditure' };
const RELATIVE_GROUP = { Urban: 'settlement.urban', Rural: 'settlement.rural', Georgia: 'georgia' };
const INTERNATIONAL = { '3.0': 'poverty.international_300', '4.2': 'poverty.international_420', '8.3': 'poverty.international_830' };

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

const sheets = Object.fromEntries(Object.entries(FILES).map(([id, file]) => {
  const book = XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true });
  if (book.SheetNames.length !== 1 || book.SheetNames[0] !== '1') throw new Error(`Unexpected sheets in ${file}`);
  return [id, book.Sheets['1']];
}));
const text = (sheet, address) => String(sheet[address]?.v ?? '').replace(/\s+/g, ' ').trim();

/** What a cell means, derived from its own row and column headings. */
function context(sourceId, address) {
  const sheet = sheets[sourceId];
  const { c, r } = XLSX.utils.decode_cell(address);
  const column = XLSX.utils.encode_col(c), row = r + 1;
  if (sourceId === 'geostat_poverty_absolute') return { year: Number(text(sheet, `A${row}`).replace('*', '')), indicator: 'poverty.absolute', group: ABSOLUTE[column] };
  if (sourceId === 'geostat_gini') return { year: Number(text(sheet, `A${row}`)), indicator: GINI[column], group: 'georgia' };
  const year = Number(text(sheet, `${column}2`));
  if (sourceId === 'geostat_poverty_international') {
    const line = /^Poverty headcount ratio at \$(\d\.\d) a day/.exec(text(sheet, `A${row}`))?.[1];
    return { year, indicator: INTERNATIONAL[line], group: 'georgia' };
  }
  let block = null;
  for (let above = row; above >= 3 && !block; above -= 1) block = /under (60|40) percent of the median/.exec(text(sheet, `A${above}`))?.[1] ?? null;
  return { year, indicator: block ? `poverty.relative_${block}` : undefined, group: RELATIVE_GROUP[text(sheet, `A${row}`)] };
}

function verify(rows) {
  const failures = [];
  const seen = new Set();
  let matchedValues = 0, matchedDisplay = 0, matchedContext = 0;
  for (const row of rows) {
    const cell = sheets[row.source_id]?.[row.source_cell];
    const where = `${row.source_id}:${row.source_cell}`;
    if (!cell || cell.t !== 'n') { failures.push(`${where}: not a numeric cell`); continue; }
    seen.add(where);
    if (Number(row.value) === cell.v) matchedValues += 1; else failures.push(`${where}: value ${row.value} != ${cell.v}`);
    if (cell.w?.replace(/,/g, '') === row.published_value) matchedDisplay += 1; else failures.push(`${where}: display ${cell.w} != ${row.published_value}`);
    const meaning = context(row.source_id, row.source_cell);
    if (meaning.year === Number(row.year) && meaning.indicator === row.indicator_id && meaning.group === row.group_id) matchedContext += 1;
    else failures.push(`${where}: context ${JSON.stringify(meaning)} != ${row.indicator_id}:${row.group_id}:${row.year}`);
  }
  let numericCells = 0;
  for (const [sourceId, sheet] of Object.entries(sheets)) {
    for (const address of Object.keys(sheet).filter(key => !key.startsWith('!'))) {
      const cell = sheet[address];
      if (cell.t !== 'n' || cell.z === 'General') continue; // year headings and year labels carry the General format
      numericCells += 1;
      const lariLine = sourceId === 'geostat_poverty_international' && !/^Poverty headcount/.test(text(sheet, `A${XLSX.utils.decode_cell(address).r + 1}`));
      if (!lariLine && !seen.has(`${sourceId}:${address}`)) failures.push(`${sourceId}:${address}: numeric cell not extracted`);
    }
  }
  if (rows.length !== 491) failures.push(`expected 491 observations, found ${rows.length}`);
  return { failures, matchedValues, matchedDisplay, matchedContext, numericCells };
}

const observations = parseCsv(readFileSync(join(root, 'poverty-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const absolute = observations.findIndex(row => row.indicator_id === 'poverty.absolute' && row.group_id === 'georgia' && row.year === '2025');
const negative = {
  altered_value_detected: detects(edit(absolute, { value: '7.2' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(absolute, { year: '2024' })),
  swapped_groups_detected: detects(edit(absolute, { group_id: 'sex.female' })),
  swapped_relative_lines_detected: detects(observations.map(row => row.indicator_id === 'poverty.relative_60' ? { ...row, indicator_id: 'poverty.relative_40' } : row)),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(sheets).length,
  observations: observations.length,
  workbook_formatted_numeric_cells: result.numericCells,
  stored_values_matched: result.matchedValues,
  published_values_matched_format_rendering: result.matchedDisplay,
  year_and_label_context_matched: result.matchedContext,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
