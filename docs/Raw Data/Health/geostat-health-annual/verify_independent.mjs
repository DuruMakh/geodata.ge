// Independent Excel-cell comparison for the health research package.
// Reads the preserved workbooks with SheetJS, the web app's own dependency, not the Python XML reader. It finds every cell
// again from its printed row label (causes of death: area name and Roman numeral) and its year heading, using label tables
// written separately from prepare.py. Every numeric cell in a served row's year columns counts as an observation, so the
// served year ranges are derived here, not copied. It then compares all rows of health-annual.csv with what it found: stored
// value, cell address, sheet, number format, unit, display text, source ID, basis and status. It also re-checks the staff
// totals against the main characteristics table and the causes-of-death sums. Writes nothing unless --write.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

// Labels are compared with all whitespace (and zero-width spaces) removed and case ignored.
const compact = value => String(value ?? '').replace(/[\s​]+/g, '').toLowerCase();
const book = path => XLSX.read(readFileSync(join(root, path)), { type: 'buffer', cellNF: true });
const column = address => address.replace(/\d+$/, '');
const rowOf = address => Number(address.replace(/^[A-Z]+/, ''));
const addresses = sheet => Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a));
const labelRows = sheet => addresses(sheet).filter(a => column(a) === 'A').map(a => ({ row: rowOf(a), label: compact(sheet[a].v) }))
  .sort((a, b) => a.row - b.row);
const only = (rows, what) => { if (rows.length !== 1) throw new Error(`Expected one ${what}, found ${rows}`); return rows[0]; };
const first = (rows, what) => { if (rows.length === 0) throw new Error(`No ${what}`); return rows[0]; };
const rowsLabelled = (labels, label, after = 0, until = Infinity) => labels.filter(e => e.label === label && e.row > after && e.row < until).map(e => e.row);

const FILE = {
  physicians: 'official/Number-of-physicians-by-occupations.xlsx', nurses: 'official/Number-of-paramedical-personnel-by-basic-specialities.xlsx',
  main: 'official/Main-characteristics-of-public-health.xlsx', groups: 'official/Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx',
  tb: 'official/Morbidity-of-patients-with-tuberculosis.xlsx', hiv: 'official/Morbidity-of-patients-with-HIV-AIDS.xlsx',
  diabetes: 'official/New-Cases-of-Diabetes-Mellitus.xlsx', anaemia: 'official/New-Cases-of-Anemia.xlsx',
  sti: 'official/Morbidity-of-patients-with-syphilis-and-gonorrheae.xlsx', causes: 'official/deaths/23-2-deaths-by-chapters-regions.xlsx',
  rate: 'official/deaths/24-1-Crude-death-rate-by-regions.xlsx',
};
const SOURCE_ID = { physicians: 'geostat_health_physicians', nurses: 'geostat_health_nurses', main: 'geostat_health_main',
  groups: 'geostat_health_morbidity_groups', tb: 'geostat_health_tuberculosis', hiv: 'geostat_health_hiv', diabetes: 'geostat_health_diabetes',
  anaemia: 'geostat_health_anaemia', sti: 'geostat_health_sti', causes: 'geostat_deaths_by_cause_region', rate: 'geostat_death_rate_region' };

const SPECIALITIES = [['internal', 'internalmedicinedoctors(therapeutists)'], ['surgery', 'surgeons'], ['obgyn', 'obstetricians-gynecologists'],
  ['paediatrics', 'pediatricians'], ['eye', 'ophtalmologists'], ['ent', 'otolaryngologists'], ['neurology', 'neuropayhologists'],
  ['psychiatry', 'psychiatristsandnarcologists'], ['tuberculosis', 'phthisiologists'], ['dermatovenereology', 'dermatovenerologists'],
  ['radiology', 'radiologists'], ['rehabilitation', 'medicalrehabilitationandsportsmedicinephysicians'], ['dentistry', 'stomatologists'], ['other', 'others']];
const NURSES = [['midwives', 'obstetricians'], ['medical', 'medicalnurses'], ['doctor_assistants', "doctor'sassistants"],
  ['lab_assistants', "doctor'sassistants-laboratoryassistants"], ['xray_assistants', 'x-ray-laboratoryassistants'], ['other', 'others']];
const ILLNESS = [['infectious', 'infectiousandparasiticdiseases'], ['cancer', 'neoplasms2)'], ['blood', 'diseasesofbloodandbloodformingorgans'],
  ['endocrine', 'diseasesofendocrinsystem,digestiondisorders,disordersofmetabolismandimmunity'], ['mental', 'psychicandbehaviouraldisorders'],
  ['nervous_sense_organs', 'diseasesofthenervoussystemandsenseorgans3)'], ['nervous', 'diseasesofthenervoussystem'], ['eye', 'diseasesoftheeyeandadnexa'],
  ['ear', 'diseasesoftheearandmastoidprocess'], ['circulatory', 'diseasesofthecirculatorysystem'], ['respiratory', 'diseasesoftherespiratorysystem'],
  ['digestive', 'diseasesofthedigestiveorgans'], ['skin', 'diseasesoftheskinandsubcutaneoustissue'], ['musculoskeletal', 'diseasesofmusculosceletalsystemandconnectivetissue'],
  ['urogenital', 'diseasesofurogenitalsystem'], ['pregnancy', 'complicationsofpregnancy,childbirthandpostnatalperiod4)'],
  ['perinatal', 'certainconditionsoriginatedintheperinatalperiod4)'], ['congenital', 'congenitalmalformations'], ['injuries', 'injuriesandpoisonings']];
const CHAPTERS = [['I', 'infectious'], ['II', 'cancer'], ['III', 'blood'], ['IV', 'endocrine'], ['V', 'mental'], ['VI', 'nervous'], ['VII', 'eye'],
  ['VIII', 'ear'], ['IX', 'circulatory'], ['X', 'respiratory'], ['XI', 'digestive'], ['XII', 'skin'], ['XIII', 'musculoskeletal'], ['XIV', 'urogenital'],
  ['XV', 'pregnancy'], ['XVI', 'perinatal'], ['XVII', 'congenital'], ['XVIII', 'ill_defined'], ['XIX', 'external'], ['XXII', 'covid19']];
const REGIONS = [['tbilisi', 'region.tbilisi'], ['adjara a.r.', 'region.adjara'], ['guria', 'region.guria'], ['imereti', 'region.imereti'],
  ['kakheti', 'region.kakheti'], ['mtskheta-mtianeti', 'region.mtskheta_mtianeti'], ['racha-lechkhumiandkvemosvaneti', 'region.racha_lechkhumi_kvemo_svaneti'],
  ['samegrelo-zemosvaneti', 'region.samegrelo_zemo_svaneti'], ['samtskhe-javakheti', 'region.samtskhe_javakheti'], ['kvemokartli', 'region.kvemo_kartli'],
  ['shidakartli', 'region.shida_kartli']].map(([name, id]) => [compact(name), id]);
const AREAS_23_2 = [[compact('Georgia'), 'georgia'], ...REGIONS];
const AREAS_24_1 = [[compact('Georgia'), 'georgia'], ...REGIONS.map(([name, id]) => [id === 'region.tbilisi' ? compact('C. Tbilisi') : name, id])]; // no Abkhazia
const ALL_AREAS = AREAS_23_2.map(([, id]) => id);

/** Excel shows 15 significant digits. Counts follow their zero-decimal format, a rate its one-decimal format (half up);
 *  a figure in thousands keeps its stored three decimals, because its format only trims the display. */
function shown(unit, value, format) {
  const sig = Number(value.toPrecision(15));
  const up = (x, scale) => Math.floor(x * scale + 0.5 + 1e-9) / scale;
  if (unit === 'per_1000_population') {
    if (!['0.0', '#,##0.0'].includes(format)) throw new Error(`rate number format ${format}`);
    return up(sig, 10).toFixed(1);
  }
  if (unit === 'persons' || unit === 'units') {
    if (!['General', '0', '#\\ ##0', '##\\ ###', '#,##0'].includes(format)) throw new Error(`count number format ${format}`);
    return format === 'General' ? String(sig) : String(up(sig, 1));
  }
  if (!['persons_thousand', 'units_thousand', 'visits_thousand'].includes(unit)) throw new Error(`unit ${unit}`);
  return String(sig);
}

const expected = new Map(); // `${indicator}|${area}|${year}` -> what the workbook holds
const sheets = new Map();
const sheetOf = key => {
  if (!sheets.has(key)) {
    const workbook = book(FILE[key]);
    if (workbook.SheetNames.length !== 1) throw new Error(`${FILE[key]}: expected one sheet`);
    sheets.set(key, { name: workbook.SheetNames[0], sheet: workbook.Sheets[workbook.SheetNames[0]] });
  }
  return sheets.get(key);
};
const yearColumns = sheet => {
  const rows = new Map();
  for (const a of addresses(sheet)) {
    if (column(a) === 'A') continue;
    const text = String(sheet[a].v);
    if (/^(19|20)\d\d$/.test(text)) rows.set(rowOf(a), [...(rows.get(rowOf(a)) ?? []), [column(a), Number(text)]]);
  }
  return new Map(first([...rows.entries()].filter(([, cols]) => cols.length >= 3).sort((a, b) => a[0] - b[0]), 'year heading row')[1]);
};
const MARKED = /^(\d+)\*+$/;
/** Every numeric cell (or a number with footnote asterisks) in the row's year columns; placeholders and blanks are skipped. */
function record(indicator, area, key, unit, row, window = [0, 9999]) {
  const { name, sheet } = sheetOf(key);
  for (const [col, year] of yearColumns(sheet)) {
    if (year < window[0] || year > window[1]) continue;
    const cell = sheet[`${col}${row}`];
    if (!cell) continue;
    let number;
    if (cell.t === 'n') number = cell.v;
    else if (cell.t === 's' && MARKED.test(String(cell.v).trim())) number = Number(String(cell.v).trim().match(MARKED)[1]);
    else if (cell.t === 's' && ['…', '...', '-'].includes(String(cell.v).replace(/\s+/g, ''))) continue;
    else throw new Error(`${FILE[key]} ${col}${row}: unexpected cell ${JSON.stringify(cell.v)}`);
    const id = `${indicator}|${area}|${year}`;
    if (expected.has(id)) throw new Error(`Derived ${id} twice`);
    expected.set(id, { indicator, area, year, file: key, sheet: name, address: `${col}${row}`, number, format: cell.z, unit, source: SOURCE_ID[key] });
  }
}
const labelled = (key, indicator, unit, label, after = null, firstOne = false) => {
  const labels = labelRows(sheetOf(key).sheet);
  const start = after ? only(rowsLabelled(labels, after), after) : 0;
  const rows = rowsLabelled(labels, label, start);
  record(indicator, 'georgia', key, unit, firstOne ? first(rows, label) : only(rows, label));
};

labelled('physicians', 'health.staff.doctors', 'persons', 'physicians,total');
for (const [id, label] of SPECIALITIES) labelled('physicians', `health.staff.doctors_${id}`, 'persons', label, 'ofwhich:');
labelled('nurses', 'health.staff.nurses', 'persons', 'total');
for (const [id, label] of NURSES) labelled('nurses', `health.staff.nurses_${id}`, 'persons', label, 'ofwhich:');
labelled('main', 'health.facilities.hospitals', 'units', 'numberofhospitalsandmedicalcenters,unit');
labelled('main', 'health.facilities.outpatient_clinics', 'units', 'numberofmedicalinstitutionsrenderingout-patientservicestopopulation,unit');
labelled('main', 'health.facilities.beds', 'units_thousand', 'numberofhospitalbeds,thsd.');
labelled('main', 'health.visits.outpatient', 'visits_thousand', 'numberofvisitsinmedicalinstitutionsrenderingout-patientservicestopopulation(includingprophylactics),thsd.');
for (const [id, label] of ILLNESS) labelled('groups', `health.illness.${id}`, 'persons_thousand', label);
labelled('tb', 'health.illness.tuberculosis', 'persons', 'ofwhichnewcases', null, true);
labelled('hiv', 'health.illness.hiv', 'persons', 'ofwhichnewcasesfromtotalnumber', null, true);
labelled('diabetes', 'health.illness.diabetes', 'persons', 'total');
labelled('anaemia', 'health.illness.anaemia', 'persons', 'total');
labelled('sti', 'health.illness.syphilis', 'persons', 'syphilis', null, true);
labelled('sti', 'health.illness.gonorrhoea', 'persons', 'gonorrheae', null, true);

// The two main-characteristics staff rows are read only for the total check.
const mainThousands = {};
{
  const { sheet } = sheetOf('main');
  const labels = labelRows(sheet);
  for (const [key, label] of [['doctors', 'numberofphysiciansofallspecialtiestotal,thsd.*'], ['nurses', 'numberofnursestotal,thsd.*']]) {
    const row = only(rowsLabelled(labels, label), label);
    mainThousands[key] = Object.fromEntries([...yearColumns(sheet)].map(([col, year]) => [year, sheet[`${col}${row}`].v]));
  }
}

{ // Causes of death: each area's header row, then its chapters by Roman numeral.
  const { sheet } = sheetOf('causes');
  const labels = labelRows(sheet);
  const starts = AREAS_23_2.map(([name, id]) => [only(rowsLabelled(labels, name), name), id]).sort((a, b) => a[0] - b[0]);
  starts.forEach(([start, area], i) => {
    const end = i + 1 < starts.length ? starts[i + 1][0] : Infinity;
    record('health.deaths.total', area, 'causes', 'persons', start);
    for (const [numeral, cause] of CHAPTERS) {
      record(`health.deaths.${cause}`, area, 'causes', 'persons', only(rowsLabelled(labels, numeral.toLowerCase(), start, end), `${numeral} of ${area}`));
    }
  });
}
{ // Death rate: the 2014-2025 columns only; 1994-2013 are retro-projections.
  const { sheet } = sheetOf('rate');
  const labels = labelRows(sheet);
  for (const [name, area] of AREAS_24_1) record('health.death_rate.total', area, 'rate', 'per_1000_population', only(rowsLabelled(labels, name), name), [2014, 9999]);
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

/** The identities that the sheets must satisfy, on any set of rows. Returns the failures. */
function crossChecks(rows) {
  const failures = [];
  const get = new Map(rows.map(row => [`${row.indicator_id}|${row.area_id}|${row.year}`, Number(row.value)]));
  const v = (indicator, area, year) => get.get(`${indicator}|${area}|${year}`) ?? 0;
  for (let year = 2002; year <= 2025; year += 1) {
    for (const [key, indicator] of [['doctors', 'health.staff.doctors'], ['nurses', 'health.staff.nurses']]) {
      if (Math.round(mainThousands[key][year] * 1000) !== v(indicator, 'georgia', year)) failures.push(`${indicator} ${year}: differs from the main characteristics table`);
    }
    const parts = SPECIALITIES.reduce((sum, [id]) => sum + v(`health.staff.doctors_${id}`, 'georgia', year), 0);
    if (parts !== v('health.staff.doctors', 'georgia', year)) failures.push(`doctor specialities ${year}: ${parts} != doctors`);
  }
  for (let year = 2014; year <= 2025; year += 1) {
    for (const area of ALL_AREAS) {
      const parts = CHAPTERS.reduce((sum, [, cause]) => sum + v(`health.deaths.${cause}`, area, year), 0);
      if (parts !== v('health.deaths.total', area, year)) failures.push(`causes ${area} ${year}: ${parts} != ${v('health.deaths.total', area, year)}`);
    }
    for (const indicator of ['total', ...CHAPTERS.map(([, cause]) => cause)]) {
      const regions = REGIONS.reduce((sum, [, area]) => sum + v(`health.deaths.${indicator}`, area, year), 0);
      if (regions !== v(`health.deaths.${indicator}`, 'georgia', year)) failures.push(`regions ${indicator} ${year}: ${regions} != Georgia`);
    }
  }
  return failures;
}

function verify(rows) {
  const failures = [];
  const seenKeys = new Set();
  let values = 0, displays = 0, cells = 0, formats = 0, statuses = 0;
  for (const row of rows) {
    const key = `${row.indicator_id}|${row.area_id}|${row.year}`;
    const want = expected.get(key);
    if (!want) { failures.push(`${key}: not derived from the workbooks`); continue; }
    if (seenKeys.has(key)) failures.push(`${key}: listed twice`);
    seenKeys.add(key);
    const where = `${key} ${want.file} ${want.address}`;
    if (row.source_cell === want.address && row.source_sheet === want.sheet && row.source_id === want.source) cells += 1;
    else failures.push(`${where}: row points at ${row.source_id} ${row.source_sheet} ${row.source_cell}`);
    if (Number(row.value) === want.number && /^-?\d+(\.\d+)?$/.test(row.value)) values += 1;
    else failures.push(`${where}: value ${row.value} != ${want.number}`);
    if (row.published_value === shown(want.unit, want.number, want.format) && row.unit === want.unit) displays += 1;
    else failures.push(`${where}: display ${row.published_value}/${row.unit} != ${shown(want.unit, want.number, want.format)}/${want.unit}`);
    if (row.source_number_format === want.format) formats += 1;
    else failures.push(`${where}: number format ${row.source_number_format} != ${want.format}`);
    if (row.basis === 'actual' && row.value_status === 'published') statuses += 1;
    else failures.push(`${where}: basis/status ${row.basis}/${row.value_status}`);
  }
  for (const key of expected.keys()) if (!seenKeys.has(key)) failures.push(`${key}: derived from the workbooks but missing from the CSV`);
  failures.push(...crossChecks(rows));
  return { failures, values, displays, cells, formats, statuses };
}

const observations = parseCsv(readFileSync(join(root, 'health-annual.csv'), 'utf8'));
const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (indicator, area, year, change) => observations.map(row => (row.indicator_id === indicator && row.area_id === area && Number(row.year) === year ? { ...row, ...change } : row));
const negative = {
  altered_value_detected: detects(edit('health.illness.tuberculosis', 'georgia', 2020, { value: '1', published_value: '1' })),
  altered_published_value_detected: detects(edit('health.death_rate.total', 'georgia', 2025, { published_value: '11.2' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit('health.deaths.total', 'region.guria', 2025, { year: '2024' })),
  wrong_cell_detected: detects(edit('health.illness.hiv', 'georgia', 2020, { source_cell: 'W3' })),
  wrong_area_detected: detects(edit('health.deaths.total', 'region.guria', 2025, { area_id: 'region.imereti' })),
  cause_sum_break_detected: crossChecks(edit('health.deaths.circulatory', 'region.guria', 2025, { value: '999' })).length > 0,
  region_sum_break_detected: crossChecks(edit('health.deaths.total', 'georgia', 2025, { value: '44320' })).length > 0,
  staff_total_break_detected: crossChecks(edit('health.staff.nurses', 'georgia', 2025, { value: '21263' })).length > 0,
};

const report = {
  status: result.failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: sheets.size,
  observations: observations.length,
  cells_found_again_from_labels: expected.size,
  source_cells_matched: result.cells,
  stored_values_matched: result.values,
  published_values_matched: result.displays,
  number_formats_matched: result.formats,
  basis_and_status_matched: result.statuses,
  cross_checks: ['doctors and nurses = main characteristics thousands x 1,000, 2002-2025', 'doctor specialities = doctors, 2002-2025',
    'causes (I-XIX and XXII) = all deaths, 12 areas x 2014-2025', '11 regions = Georgia for all deaths and every cause, 2014-2025'],
  negative_controls: negative,
  failures: result.failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes('--write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
