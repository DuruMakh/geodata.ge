// Independent Excel-cell comparison for the Geostat education statistics research package.
// Reads the six served workbooks with SheetJS (the web app's own dependency), not the Python XML reader, and
// re-extracts every served value from its cell with label tables written here from the approved spec and the task
// brief, not from prepare.py: the year heading above the cell, the Total/Women/Men, measure or level heading under it,
// the row label in column A (place labels through the reviewed data/mappings/education/units.csv), the block title,
// the unavailable markers and the vocational fields' active spans. Every row of education-annual.csv must match that
// re-extraction exactly (cell, stored value, rounding to the cell's number format, period label and flags), and every
// re-extracted value must be in the CSV. Writes independent-validation.json.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const FILES = {
  geostat_education_schools_national: 'official/01_Number-of-General-Education-Schools-and-Pupils-in-them.xlsx',
  geostat_education_teachers_national: 'official/06_Number-of-General-Education-School-Teachers.xlsx',
  geostat_education_municipal: 'official/11_Number-of-schools_Pupils_Teachers-by-Municipalities.xlsx',
  geostat_education_kindergartens: 'official/Indicators-on-Public-Preschool-Education-and-Care-(PEC)-Institutions.xlsx',
  geostat_education_higher: 'official/01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx',
  geostat_education_vocational: "official/Number-of-students-in-Public-and-Private-Vocational-Education-Institutions'-Education-Programs.xlsx",
};
const books = Object.fromEntries(Object.entries(FILES).map(([id, file]) =>
  [id, XLSX.read(readFileSync(join(root, file)), { type: 'buffer', cellNF: true })]));
const EXPECTED_TOTAL = 8815;
const GEORGIA = 'country.georgia';

// Written from the approved spec (section 9) and the task brief, not from prepare.py.
const YEARS = {
  national: [2000, 2025], teachersNational: [2006, 2025], municipal: [2005, 2025], municipalTeachers: [2016, 2025],
  kindergartens: [2017, 2025], higher: [2011, 2025], graduates: [2010, 2024], vocational: [2013, 2025],
};
const NATIONAL_LABELS = {
  geostat_education_schools_national: {
    'General education schools, unit': ['schools', 'total'], 'Public general education schools': ['schools', 'public'],
    'Private general education schools': ['schools', 'private'], 'Number of pupils - thsd.': ['pupils_national', 'total'],
    'In public general education schools': ['pupils_national', 'public'], 'In private general education schools': ['pupils_national', 'private'],
  },
  geostat_education_teachers_national: {
    'Teachers, total': ['teachers', 'total'], 'In Public schools': ['teachers', 'public'], 'In Private schools': ['teachers', 'private'],
  },
};
const HE_SHEETS = { Number: 'he_students', Admission: 'he_admitted', Graduates: 'he_graduates' };
const HE_FIELDS = {
  'education': 'field_education', 'humanities and arts': 'field_humanities_arts', 'social sciences, business and law': 'field_social_business_law',
  'science': 'field_science', 'engineering, manufacturing and construction': 'field_engineering', 'agriculture': 'field_agriculture',
  'health and welfare': 'field_health_welfare', 'services': 'field_services',
};
const VET_FIELDS = {
  'agriculture, forestry, fisheries, veterinary': 'field_agriculture_vet', 'art, humanitarian sciences': 'field_arts_humanities',
  'business, administration and law': 'field_business_law', 'education': 'field_education',
  'engineering, manufacturing, construction': 'field_engineering', 'health, social welfare': 'field_health_welfare', 'ict': 'field_ict',
  'services': 'field_services', 'social sciences, journalism and information': 'field_social_journalism',
  'agricultural sciences': 'old_agricultural_sciences', 'business administration': 'old_business_administration',
  'engineering': 'old_engineering', 'science / natural sciences': 'old_natural_sciences',
  'inter directional branches and specialties': 'old_inter_directional', 'law': 'old_law', 'social sciences': 'old_social_sciences',
  'art': 'old_art', 'health': 'old_health',
};
const UNIT_OF = {
  schools: 'institutions', kindergartens: 'institutions', pupils_national: 'persons_thousand', pupils: 'persons', teachers: 'persons',
  kg_children: 'persons', kg_staff: 'persons', he_students: 'persons', he_admitted: 'persons', he_graduates: 'persons',
  vet_admitted: 'persons', vet_graduates: 'persons',
};
const PLACES = { institutions: 0, persons: 0, persons_thousand: 1 };
const UNAVAILABLE = ['…', '...', '-'];

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const loose = value => clean(value).toLowerCase();
const address = (c, r) => XLSX.utils.encode_cell({ c, r });
const columnOf = cell => XLSX.utils.decode_cell(cell).c;
const footnote = text => /^(\*|\d\)|source:|note:)/i.test(text);

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

/** Decimals a number format shows ('#\ ##0', accounting '_(* #,##0_)…' and '0' none, '0.0' one); 'General' shows the value as stored. */
function formatPlaces(cell) {
  const format = cell.z ?? 'General';
  if (format === 'General') return null;
  const match = /0(?:\.(0+))?/.exec(format.split(';')[0].replace(/"[^"]*"/g, ''));
  return match ? (match[1] ?? '').length : undefined;
}

/** The stored number as text: a numeric cell's value, or a text cell's digits with their spaces removed. */
function stored(cell) {
  if (cell?.t === 'n') return String(cell.v);
  if (cell?.t === 's' && /^\d[\d\s]*$/.test(cell.v.trim())) return cell.v.replace(/\s/g, '');
  return null;
}
const unavailable = cell => cell === undefined || (cell.t !== 'n' && UNAVAILABLE.includes(clean(cell.v)));

function schoolYear(text) {
  const match = /^(\d{4})\/(\d{4})\*?$/.exec(text) ?? /^(\d{4})-(\d{4}) school year$/.exec(text);
  return match && Number(match[2]) === Number(match[1]) + 1 ? Number(match[1]) : null;
}
const graduateYear = text => { const match = /^(\d{4}) year$/.exec(text); return match ? Number(match[1]) - 1 : null; };

/** The cells of one row, as [column index, cell] in column order. */
function rowCells(sheet, r) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const cells = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) if (sheet[address(c, r)]) cells.push([c, sheet[address(c, r)]]);
  return cells;
}

/** {year: first column} of a year heading row, with each year's columns running to the next year's. */
function yearColumns(sheet, r, parse) {
  const years = new Map();
  for (const [c, cell] of rowCells(sheet, r)) {
    const year = parse(cell);
    if (year !== null) years.set(year, c);
  }
  return years;
}
function spans(years, last) {
  const ordered = [...years.entries()].sort((a, b) => a[1] - b[1]);
  return ordered.map(([year, c], i) => [year, c, i + 1 < ordered.length ? ordered[i + 1][1] : last + 1]);
}
function assertYears(years, [first, last], where) {
  const got = [...years.keys()].sort((a, b) => a - b);
  const want = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  if (got.join() !== want.join()) throw new Error(`${where}: years ${got.join()} are not ${first}-${last}`);
}

const units = new Map(parseCsv(readFileSync(join(root, '../../../../data/mappings/education/units.csv'), 'utf8'))
  .map(row => [row.source_label, row.geography_id]));
const expected = new Map();
const problems = [];

function expect(source, sheetName, measure, group, geography, year, cellAddress) {
  const cell = books[source].Sheets[sheetName][cellAddress];
  if (unavailable(cell)) return;
  const value = stored(cell);
  if (value === null) { problems.push(`${sheetName}!${cellAddress}: unexpected text ${JSON.stringify(cell.v)}`); return; }
  const key = `education.${measure}.${group}|${geography}|${year}`;
  if (expected.has(key)) problems.push(`${key}: found twice`);
  expected.set(key, { source, sheet: sheetName, cell: cellAddress, value, measure, group });
}

/** Unit rows of a place table: [geography, row] by the label in column A; any label not in units.csv is reported. */
function placeRows(sheet, fromRow) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows = [];
  for (let r = fromRow; r <= range.e.r; r += 1) {
    const label = clean(sheet[address(0, r)]?.v);
    if (!label || footnote(label)) continue;
    if (!units.has(label)) { problems.push(`${label}: not in units.csv`); continue; }
    rows.push([units.get(label), r]);
  }
  return rows;
}

// Tables 01 and 06: Georgia, one column per school year.
for (const [source, labels] of Object.entries(NATIONAL_LABELS)) {
  const sheet = books[source].Sheets['1'];
  const years = yearColumns(sheet, 1, cell => schoolYear(clean(cell.v)));
  assertYears(years, source.endsWith('teachers_national') ? YEARS.teachersNational : YEARS.national, source);
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (let r = 2; r <= range.e.r; r += 1) {
    const target = labels[clean(sheet[address(0, r)]?.v)];
    if (!target) continue;
    for (const [year, c] of years) expect(source, '1', target[0], target[1], GEORGIA, year, address(c, r));
  }
}

// Table 11: schools and pupils by place (Georgia's row is a cross-check only), teachers by place and sex.
{
  const source = 'geostat_education_municipal';
  for (const measure of ['schools', 'pupils']) {
    const sheet = books[source].Sheets[measure];
    const years = yearColumns(sheet, 1, cell => schoolYear(clean(cell.v)));
    assertYears(years, YEARS.municipal, measure);
    for (const [geography, r] of placeRows(sheet, 2)) {
      if (geography === GEORGIA) continue;
      for (const [year, c] of years) expect(source, measure, measure, 'total', geography, year, address(c, r));
    }
  }
  const sheet = books[source].Sheets.teachers;
  const years = yearColumns(sheet, 1, cell => schoolYear(clean(cell.v)));
  assertYears(years, YEARS.municipalTeachers, 'teachers');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (const [geography, r] of placeRows(sheet, 3)) {
    for (const [year, start, end] of spans(years, range.e.c)) {
      for (let c = start; c < end; c += 1) {
        const group = loose(sheet[address(c, 2)]?.v);
        if (!['total', 'women', 'men'].includes(group)) continue;
        if (geography === GEORGIA && group === 'total') continue; // Georgia's total comes from table 06.
        expect(source, 'teachers', 'teachers', group, geography, year, address(c, r));
      }
    }
  }
}

// Public kindergartens by place: (institutions, children, staff) per school year.
{
  const source = 'geostat_education_kindergartens';
  const sheet = books[source].Sheets['1'];
  const years = yearColumns(sheet, 1, cell => schoolYear(clean(cell.v)));
  assertYears(years, YEARS.kindergartens, 'kindergartens');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  for (const [geography, r] of placeRows(sheet, 3)) {
    for (const [year, start, end] of spans(years, range.e.c)) {
      for (let c = start; c < end; c += 1) {
        const heading = loose(sheet[address(c, 2)]?.v);
        const measure = /pec institutions$/.test(heading) ? 'kindergartens' : /children/.test(heading) ? 'kg_children'
          : /^the number of caregiver/.test(heading) ? 'kg_staff' : null;
        if (!measure) { problems.push(`kindergartens ${address(c, 2)}: heading ${heading}`); continue; }
        expect(source, '1', measure, 'total', geography, year, address(c, r));
      }
    }
  }
}

// Universities: the "Public and Private" block's totals, levels, fields and sex totals, and the Public and Private blocks' totals.
{
  const source = 'geostat_education_higher';
  for (const [sheetName, measure] of Object.entries(HE_SHEETS)) {
    const sheet = books[source].Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const titles = [];
    for (let r = 0; r <= range.e.r; r += 1) {
      const title = loose(sheet[address(0, r)]?.v);
      if (title.includes('institutions by programmes and sex')) {
        titles.push([r, title.includes('public and private') ? 'all' : title.includes('public institutions') ? 'public' : 'private']);
      }
    }
    if (titles.map(t => t[1]).join() !== 'all,public,private') problems.push(`${sheetName}: blocks ${titles.map(t => t[1])}`);
    const parse = sheetName === 'Graduates' ? cell => graduateYear(clean(cell.v)) : cell => schoolYear(clean(cell.v));
    titles.forEach(([start, kind], i) => {
      const end = i + 1 < titles.length ? titles[i + 1][0] : range.e.r + 1;
      const years = yearColumns(sheet, start + 1, parse);
      assertYears(years, sheetName === 'Graduates' ? YEARS.graduates : YEARS.higher, `${sheetName} ${kind}`);
      let section = null;
      for (let r = start + 4; r < end; r += 1) {
        const label = loose(sheet[address(0, r)]?.v);
        let group = null;
        if (/, total$/.test(label) && section === null) { section = 'total'; group = 'total'; }
        else if (label === 'of which females') { section = 'women'; group = 'women'; }
        else if (label === 'of which males') { section = 'men'; group = 'men'; }
        else if (section === 'total' && HE_FIELDS[label]) group = HE_FIELDS[label];
        if (!group) continue;
        if (kind !== 'all') {
          if (group === 'total') for (const [year, c] of years) expect(source, sheetName, measure, kind, GEORGIA, year, address(c, r));
          continue;
        }
        for (const [year, startColumn, endColumn] of spans(years, range.e.c)) {
          if (loose(sheet[address(startColumn, start + 2)]?.v) !== 'total') problems.push(`${sheetName} ${year}: no Total heading`);
          expect(source, sheetName, measure, group, GEORGIA, year, address(startColumn, r));
          if (group !== 'total') continue;
          for (let c = startColumn + 1; c < endColumn; c += 1) {
            const level = loose(sheet[address(c, start + 3)]?.v);
            const levelGroup = level.startsWith('bachelor') ? 'level_bachelor' : level.startsWith('magistracy') ? 'level_master'
              : level === 'professional programme' ? 'level_professional' : null;
            if (levelGroup) expect(source, sheetName, measure, levelGroup, GEORGIA, year, address(c, r));
          }
        }
      }
    });
  }
}

// Vocational: admitted and graduated (Total, Women, Men) per calendar year; fields only inside their active span.
{
  const source = 'geostat_education_vocational';
  const sheet = books[source].Sheets['1'];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const years = yearColumns(sheet, 1, cell => (cell.t === 'n' && cell.v >= 2000 && cell.v < 2100 ? cell.v : null));
  assertYears(years, YEARS.vocational, 'vocational');
  const columns = []; // [year, measure, sex, column]
  for (const [year, start, end] of spans(years, range.e.c)) {
    let measure = null;
    for (let c = start; c < end; c += 1) {
      const heading = loose(sheet[address(c, 2)]?.v);
      if (heading) measure = heading === 'number of admitted students' ? 'vet_admitted' : heading === 'number of graduated students' ? 'vet_graduates' : null;
      const sex = loose(sheet[address(c, 3)]?.v);
      if (measure && ['total', 'women', 'men'].includes(sex)) columns.push([year, measure, sex, c]);
    }
  }
  let ages = false;
  for (let r = 4; r <= range.e.r; r += 1) {
    const label = loose(sheet[address(0, r)]?.v);
    if (label === 'of which:') ages = true;
    if (ages) continue;
    if (label === 'number of students, total') {
      for (const [year, measure, sex, c] of columns) expect(source, '1', measure, sex, GEORGIA, year, address(c, r));
    } else if (VET_FIELDS[label]) {
      const totals = columns.filter(([, , sex]) => sex === 'total');
      const active = totals.filter(([, , , c]) => sheet[address(c, r)]?.v !== 0).map(([year]) => year);
      const [first, last] = [Math.min(...active), Math.max(...active)];
      for (const [year, measure, , c] of totals) {
        if (year >= first && year <= last) expect(source, '1', measure, VET_FIELDS[label], GEORGIA, year, address(c, r));
      }
    }
  }
}

function verify(rows) {
  const failures = [...problems];
  const seen = new Set();
  let valuesMatched = 0, roundingMatched = 0, contextMatched = 0;
  for (const row of rows) {
    const key = `${row.indicator_id}|${row.geography_id}|${row.year}`;
    const before = failures.length;
    if (seen.has(key)) failures.push(`${key}: duplicate`);
    seen.add(key);
    const want = expected.get(key);
    if (!want) { failures.push(`${key}: not a served cell`); continue; }
    if (row.source_id !== want.source || row.source_sheet !== want.sheet || row.source_cell !== want.cell) {
      failures.push(`${key}: ${row.source_sheet}!${row.source_cell} is not ${want.sheet}!${want.cell}`);
    }
    const unit = UNIT_OF[want.measure];
    if (row.unit !== unit) failures.push(`${key}: unit ${row.unit}`);
    const year = Number(row.year);
    const label = want.measure.startsWith('vet_') ? String(year) : `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
    if (row.period_label !== label) failures.push(`${key}: period ${row.period_label}`);
    if (row.shown !== (want.group.startsWith('old_') ? 'false' : 'true')) failures.push(`${key}: shown ${row.shown}`);
    if (row.basis !== 'actual' || row.value_status !== 'official') failures.push(`${key}: not actual and official`);
    if (Number(row.value) === Number(want.value)) valuesMatched += 1;
    else failures.push(`${key}: value ${row.value} != ${want.value}`);
    const cell = books[want.source].Sheets[want.sheet][want.cell];
    const places = formatPlaces(cell);
    const shown = displayed(row.value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); // As 'General' shows it.
    if (places === null ? (shown.split('.')[1] ?? '').length > PLACES[unit] : places !== PLACES[unit]) {
      failures.push(`${key}: number format ${cell.z} does not show ${PLACES[unit]} decimals`);
    }
    if (roundHalfUp(row.value, PLACES[unit]) === row.published_value) roundingMatched += 1;
    else failures.push(`${key}: published ${row.published_value} is not ${row.value} rounded`);
    if (failures.length === before) contextMatched += 1;
  }
  const missing = [...expected.keys()].filter(key => !seen.has(key));
  for (const key of missing.slice(0, 20)) failures.push(`${key}: missing`);
  if (rows.length !== EXPECTED_TOTAL) failures.push(`expected ${EXPECTED_TOTAL} observations, found ${rows.length}`);
  return { failures, valuesMatched, roundingMatched, contextMatched };
}

const observations = parseCsv(readFileSync(join(root, 'education-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const at = (indicator, geography, year) => observations.findIndex(row =>
  row.indicator_id === indicator && row.geography_id === geography && row.year === String(year));
const edit = (index, change) => observations.map((row, i) => (i === index ? { ...row, ...change } : row));
const schools = at('education.schools.total', GEORGIA, 2025);
const keda = at('education.pupils.total', '09', 2025);
const women = at('education.teachers.women', 'region.tbilisi', 2025);
const graduates = at('education.he_graduates.total', GEORGIA, 2024);
const ict = at('education.vet_admitted.field_ict', GEORGIA, 2019);
const oldLaw = at('education.vet_graduates.old_law', GEORGIA, 2020);
const kgStaff = at('education.kg_staff.total', GEORGIA, 2025);
const negative = {
  altered_value_detected: detects(edit(schools, { value: '2293', published_value: '2293' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit(keda, { year: '2024', period_label: '2024/25' })),
  neighbouring_column_detected: detects(edit(women, { source_cell: observations[women].source_cell.replace(/^[A-Z]+/, col =>
    XLSX.utils.encode_col(XLSX.utils.decode_col(col) + 1)) })),
  wrong_place_row_detected: detects(edit(keda, { source_cell: observations[keda].source_cell.replace(/\d+$/, n => String(Number(n) + 1)) })),
  swapped_sheets_detected: detects(edit(keda, { source_sheet: 'schools' })),
  graduate_year_not_shifted_detected: detects(edit(graduates, { year: '2025', period_label: '2025/26' })),
  unavailable_cell_served_detected: detects([...observations, { ...observations[at('education.teachers.private', GEORGIA, 2011)],
    year: '2010', period_label: '2010/11', source_cell: 'F7', value: '0', published_value: '0' }]),
  zero_outside_field_span_served_detected: detects([...observations, { ...observations[ict], year: '2018', period_label: '2018',
    source_cell: observations[ict].source_cell.replace(/^[A-Z]+/, 'AF'), value: '0', published_value: '0' }]),
  old_field_shown_detected: detects(edit(oldLaw, { shown: 'true' })),
  wrong_unit_detected: detects(edit(kgStaff, { unit: 'institutions' })),
  unrounded_published_value_detected: detects(edit(at('education.pupils_national.total', GEORGIA, 2012), { published_value: '559.415' })),
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: Object.keys(books).length,
  observations: observations.length,
  cells_reextracted: expected.size,
  stored_values_matched: result.valuesMatched,
  published_values_matched_rounding: result.roundingMatched,
  rows_with_matching_cell_heading_label_and_flags: result.contextMatched,
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
