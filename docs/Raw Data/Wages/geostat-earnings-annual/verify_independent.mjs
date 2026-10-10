// Independent Excel-cell comparison for the earnings research package.
// Reads the preserved workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// compares every numeric and unavailable cell with the extracted CSVs: value, display rounding, year heading,
// printed labels and the IDs derived from them. The ID tables below are written separately from prepare.py.
// Writes nothing unless --write.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const UNAVAILABLE = new Set(['…', '...']);
// NACE Rev.2 section titles by letter, as listed in Geostat's 2025 earnings release (printed page 8).
const NACE2 = {
  A: 'Agriculture, forestry and fishing', B: 'Mining and quarrying', C: 'Manufacturing',
  D: 'Electricity, gas, steam and air conditioning supply',
  E: 'Water supply, sewerage, waste management and remediation activities', F: 'Construction',
  G: 'Wholesale and retail trade; repair of motor vehicles and motorcycles', H: 'Transportation and storage',
  I: 'Accommodation and food service activities', J: 'Information and communication',
  K: 'Financial and insurance activities', L: 'Real estate activities',
  M: 'Professional, scientific and technical activities', N: 'Administrative and support service activities',
  O: 'Public administration and defence; compulsory social security', P: 'Education',
  Q: 'Human health and social work activities', R: 'Arts, entertainment and recreation', S: 'Other service activities',
};
// NACE Rev.1.1 section titles by letter (A Agriculture ... O Other community services).
const NACE1 = {
  A: 'Agriculture, hunting and forestry', B: 'Fishing', C: 'Mining and quarrying', D: 'Manufacturing',
  E: 'Production and distribution of electricity, gas and water', F: 'Construction',
  G: 'Wholesale and retail trade; repair of motor vehicles and personal and household goods',
  H: 'Hotels and restaurants', I: 'Transport and communication', J: 'Financial intermediation',
  K: 'Real estate, renting and business activities', L: 'Public administration', M: 'Education',
  N: 'Health and social work', O: 'Other community, social and personal service activities',
};
const GROUP_IDS = {
  Total: 'georgia', Women: 'women', Men: 'men', Public: 'public', 'Public sector': 'public',
  'Non-public': 'non_public', 'Non-public sector': 'non_public', Business: 'business',
  'Business sector': 'business', 'Non-business': 'non_business', 'Non-business sector': 'non_business',
  Tbilisi: 'region.tbilisi', 'Adjara A.R.': 'region.adjara', Guria: 'region.guria', Imereti: 'region.imereti',
  Kakheti: 'region.kakheti', 'Mtskheta-Mtianeti': 'region.mtskheta_mtianeti',
  'Racha-Lechkhumi and Kvemo Svaneti': 'region.racha_lechkhumi_kvemo_svaneti',
  'Samegrelo-Zemo Svaneti': 'region.samegrelo_zemo_svaneti', 'Samtskhe-Javakheti': 'region.samtskhe_javakheti',
  'Kvemo Kartli': 'region.kvemo_kartli', 'Shida Kartli': 'region.shida_kartli',
};
const SINGLE_GROUP = new Set(['geostat_earnings_annual_activity', 'geostat_earnings_annual_median']);
const ROW_GROUPS = new Set(['geostat_earnings_annual_headline', 'geostat_earnings_annual_region']);
const sectorIds = (titles, prefix) => Object.fromEntries(
  Object.entries(titles).map(([letter, title]) => [title, `${prefix}.${letter.toLowerCase()}`]));
const SECTORS = { NACE2: sectorIds(NACE2, 'sector'), NACE1: sectorIds(NACE1, 'nace1') };

const tidy = (text) => String(text).replace(/\s+/g, ' ').trim();

function readCsv(name) {
  const text = readFileSync(join(root, name), 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]])));
}

// What the sheet itself says about one cell: its year heading, row label and group heading.
function context(sourceId, sheetName, sheet, headingRow, address) {
  const { r, c } = XLSX.utils.decode_cell(address);
  const at = (row, col) => sheet[XLSX.utils.encode_cell({ r: row, c: col })];
  const heading = at(headingRow, c);
  const year = heading ? Number(String(heading.v).replace(/\*+$/, '')) : NaN;
  const label = at(r, 0) ? tidy(at(r, 0).v) : '';
  let group = 'Total';
  if (ROW_GROUPS.has(sourceId)) group = label;
  else if (!SINGLE_GROUP.has(sourceId)) {
    group = '';
    for (let row = r - 1; row > headingRow; row -= 1) {
      if (!at(row, 0) && at(row, 1) && at(row, 1).t === 's') { group = tidy(at(row, 1).v); break; }
    }
  }
  const sectorTitle = label.replace(/\*+$/, '').trim();
  const sector = ROW_GROUPS.has(sourceId) || sectorTitle === 'Total'
    ? 'total' : SECTORS[sheetName === 'NACE1' ? 'NACE1' : 'NACE2'][sectorTitle];
  return { year, label, group, groupId: GROUP_IDS[group], sector };
}

function compare(workbooks, observations, unavailable) {
  const expected = new Map();
  for (const row of observations) expected.set(`${row.source_id}|${row.source_sheet}|${row.source_cell}`, row);
  const missingCells = new Map();
  for (const row of unavailable) missingCells.set(`${row.source_id}|${row.source_sheet}|${row.source_cell}`, row);
  const failures = [];
  const counts = { numericCells: 0, yearHeadings: 0, matchedValues: 0, matchedDisplay: 0, matchedUnavailable: 0,
    matchedContext: 0 };
  const seen = new Set();
  const checkContext = (key, row, found) => {
    const problems = [];
    if (found.year !== Number(row.year)) problems.push(['year', row.year, found.year]);
    if (found.label !== row.source_label) problems.push(['source_label', row.source_label, found.label]);
    if (found.group !== row.source_group_label) problems.push(['source_group_label', row.source_group_label, found.group]);
    if (found.groupId !== row.group_id) problems.push(['group_id', row.group_id, found.groupId]);
    if (found.sector !== row.sector_id) problems.push(['sector_id', row.sector_id, found.sector]);
    if (problems.length) failures.push({ check: 'cell_context', key, problems });
    else counts.matchedContext += 1;
  };
  for (const [sourceId, workbook] of workbooks) {
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Year headings sit in the first row holding whole numbers 1950-2030; values below may look like years.
      const headingRow = Math.min(...Object.entries(sheet)
        .filter(([address, cell]) => !address.startsWith('!') && cell.t === 'n' && Number.isInteger(cell.v)
          && cell.v >= 1950 && cell.v <= 2030)
        .map(([address]) => XLSX.utils.decode_cell(address).r));
      for (const [address, cell] of Object.entries(sheet)) {
        if (address.startsWith('!')) continue;
        const key = `${sourceId}|${sheetName}|${address}`;
        if (cell.t === 'n') {
          counts.numericCells += 1;
          const row = expected.get(key);
          if (!row) {
            if (XLSX.utils.decode_cell(address).r === headingRow && Number.isInteger(cell.v)) {
              counts.yearHeadings += 1;
              continue;
            }
            failures.push({ check: 'unextracted_numeric_cell', key });
            continue;
          }
          seen.add(key);
          if (Number(row.value) === cell.v) counts.matchedValues += 1;
          else failures.push({ check: 'stored_value', key, csv: row.value, excel: cell.v });
          // SheetJS's rendering of the cell's own number format must equal the published value.
          const display = XLSX.SSF.format(cell.z ?? 'General', cell.v).replace(/[\s ]/g, '');
          if (display === row.published_value) counts.matchedDisplay += 1;
          else failures.push({ check: 'published_display', key, csv: row.published_value, excel: display });
          checkContext(key, row, context(sourceId, sheetName, sheet, headingRow, address));
        } else if (UNAVAILABLE.has(tidy(cell.v))) {
          const row = missingCells.get(key);
          if (!row) {
            failures.push({ check: 'unlisted_unavailable_cell', key });
            continue;
          }
          seen.add(key);
          if (tidy(cell.v) === row.source_token) counts.matchedUnavailable += 1;
          else failures.push({ check: 'unavailable_token', key, excel: cell.v });
          checkContext(key, row, context(sourceId, sheetName, sheet, headingRow, address));
        }
      }
    }
  }
  for (const key of [...expected.keys(), ...missingCells.keys()]) {
    if (!seen.has(key)) failures.push({ check: 'csv_cell_not_in_workbook', key });
  }
  return { ...counts, failures };
}

const manifest = JSON.parse(readFileSync(join(root, 'source-manifest.json'), 'utf8'));
const workbooks = new Map(manifest.filter((record) => record.local_file.endsWith('.xlsx')).map((record) => [
  record.source_id, XLSX.read(readFileSync(join(root, record.local_file)), { cellNF: true, cellText: false }),
]));
const observations = readCsv('source-observations.csv');
const unavailable = readCsv('unavailable-cells.csv');
const result = compare(workbooks, observations, unavailable);

// Negative controls: each comparison must notice the defect it exists for.
const detects = (rows, missing, check) => compare(workbooks, rows, missing).failures.some((f) => f.check === check);
const swap = (field, a, b) => observations.map((row) => (
  row[field] === a ? { ...row, [field]: b } : row[field] === b ? { ...row, [field]: a } : row));
const negative = {
  altered_value_detected: detects(observations.map((row, index) => (
    index === 0 ? { ...row, value: String(Number(row.value) + 0.1) } : row)), unavailable, 'stored_value'),
  omitted_row_detected: detects(observations.slice(1), unavailable, 'unextracted_numeric_cell'),
  // A value that looks like a year (the 2025 median of 2000 GEL) must not pass as a heading when omitted.
  omitted_year_like_value_detected: detects(observations.filter((row) => !(
    row.indicator_id === 'median_monthly_earnings' && row.value === '2000')), unavailable, 'unextracted_numeric_cell'),
  moved_cell_detected: detects(observations.map((row, index) => (
    index === 0 ? { ...row, source_cell: 'ZZ999' } : row)), unavailable, 'csv_cell_not_in_workbook'),
  shifted_year_detected: detects(observations.map((row, index) => (
    index === 0 ? { ...row, year: String(Number(row.year) + 1) } : row)), unavailable, 'cell_context'),
  swapped_sections_detected: detects(swap('sector_id', 'sector.p', 'sector.q'), unavailable, 'cell_context'),
  swapped_regions_detected: detects(swap('group_id', 'region.guria', 'region.imereti'), unavailable, 'cell_context'),
  swapped_sexes_detected: detects(swap('group_id', 'women', 'men'), unavailable, 'cell_context'),
  unlisted_unavailable_detected: detects(observations, unavailable.slice(1), 'unlisted_unavailable_cell'),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: workbooks.size,
  source_observations: observations.length,
  unavailable_cells: unavailable.length,
  workbook_numeric_cells: result.numericCells,
  year_heading_cells: result.yearHeadings,
  stored_values_matched: result.matchedValues,
  published_values_matched_format_rendering: result.matchedDisplay,
  unavailable_tokens_matched: result.matchedUnavailable,
  year_label_and_id_context_matched: result.matchedContext,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const text = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--write')) writeFileSync(join(root, 'independent-validation.json'), text);
process.stdout.write(text);
if (report.status !== 'passed') process.exit(1);
