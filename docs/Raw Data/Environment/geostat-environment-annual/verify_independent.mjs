// Independent Excel-cell comparison for the environment and climate research package.
// Reads the preserved workbooks (.xlsx and the old .xls) with SheetJS, the web app's own dependency, not the Python readers. It
// finds every served cell again with its own method: plain tables by their printed row label and year heading, and the air quality
// sheets by walking each station block line by line, keeping the current pollutant heading. The label tables are written here,
// not copied from prepare.py. Every number (or number printed with a footnote mark) in a served row's year columns counts as an
// observation, so the served year ranges are derived here. It then compares all rows of environment-annual.csv with what it
// found: value, published value (the cell rounded to its number format), decimals, cell, sheet, unit, source ID, basis and status. It re-checks the sums, that each city's
// stations print one set of limits, that every served cell holds the same number in the Georgian workbook (one known
// difference), and the manifest's SHA-256 and size of every archived file. Writes independent-validation.json unless --no-write.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const compact = value => String(value ?? '').replace(/​/g, '').split(/\s+/).filter(Boolean).join(' ').toLowerCase();
const column = address => address.replace(/\d+$/, '');
const rowOf = address => Number(address.replace(/^[A-Z]+/, ''));
const addresses = sheet => Object.keys(sheet).filter(a => /^[A-Z]+\d+$/.test(a));
const MANIFEST = JSON.parse(readFileSync(join(root, 'source-manifest.json'), 'utf8'));
const fileOf = id => MANIFEST.find(s => s.source_id === id).local_file;
const books = new Map();
const workbook = id => {
  if (!books.has(id)) books.set(id, XLSX.read(readFileSync(join(root, fileOf(id))), { type: 'buffer', cellNF: true }));
  return books.get(id);
};
const NIL = 'geostat_env_illegal_logging';
/** A cell's published number as text (12 significant digits), or null for a placeholder. "-" is zero only in the logging table. */
const valueOf = (cell, source) => {
  if (!cell) return null;
  if (cell.t === 'n') return String(Number(cell.v.toPrecision(12)));
  const text = String(cell.v).replace(/[\s​]+/g, ' ').trim();
  if (text === '-' && source === NIL) return '0';
  if (['…', '...', '-', ''].includes(text)) return null;
  const starred = /^(\d+(?:\.\d+)?)\*$/.exec(text);
  if (starred) return String(Number(starred[1]));
  throw new Error(`Unexpected cell ${source} ${cell.v}`);
};
/** The figure the table prints: a number cell rounded to its number format's decimals ("0.0" is one), General as stored. */
const shownOf = (cell, value) => {
  if (cell.t !== 'n' || cell.z === 'General') return value;
  if (!/^(0(\.0+)?|#,##0|#\\ ##0)$/.test(cell.z)) throw new Error(`Unexpected number format ${cell.z}`);
  return String(Number(cell.v.toFixed(cell.z.includes('.') ? cell.z.split('.')[1].length : 0)));
};
const rowCells = (sheet, row) => addresses(sheet).filter(a => rowOf(a) === row);
const label = (sheet, row) => (sheet[`A${row}`]?.t === 's' ? compact(sheet[`A${row}`].v) : '');
const lastRow = sheet => Math.max(...addresses(sheet).map(rowOf));
/** {column: year} of a heading row: whole years from 1900 to 2100 right of column A. */
const yearsOf = (sheet, row) => Object.fromEntries(rowCells(sheet, row).filter(a => column(a) !== 'A' && sheet[a].t === 'n' && Number.isInteger(sheet[a].v) && sheet[a].v >= 1900 && sheet[a].v <= 2100).map(a => [column(a), sheet[a].v]));
/** The nearest row above `row` with two or more whole years in increasing order. */
const headingAbove = (sheet, row) => {
  for (let r = row - 1; r > 0; r -= 1) {
    const years = Object.values(yearsOf(sheet, r));
    if (years.length >= 2 && years.length === rowCells(sheet, r).filter(a => column(a) !== 'A' && sheet[a].t === 'n').length && years.every((y, i) => i === 0 || y > years[i - 1])) return r;
  }
  throw new Error(`No heading above row ${row}`);
};

const found = new Map(); // indicator:year -> { value, cell, sheet, unit, source }
const record = (id, source, sheetName, row, unit) => {
  const sheet = workbook(source).Sheets[sheetName];
  for (const [col, year] of Object.entries(yearsOf(sheet, headingAbove(sheet, row)))) {
    const value = valueOf(sheet[`${col}${row}`], source);
    if (value !== null) found.set(`${id}:${year}`, { value, cell: `${col}${row}`, sheet: sheetName, unit, source });
  }
};
/** Plain tables: a label, found below each `after` label in turn (the first match). */
const plain = (source, unit, id, text, after = []) => {
  const sheetName = workbook(source).SheetNames[0];
  const sheet = workbook(source).Sheets[sheetName];
  let start = 0;
  for (const step of [...after, text]) {
    let r = start + 1;
    while (r <= lastRow(sheet) && label(sheet, r) !== compact(step)) r += 1;
    if (r > lastRow(sheet)) throw new Error(`${source}: no "${step}"`);
    start = r;
  }
  record(id, source, sheetName, start, unit);
};

// The cell map, written from the design document's section 11, not from prepare.py.
for (const [id, text] of [['total', 'Aggregated emissions (CO2 equivalents)'], ['net', 'Aggregated emissions including emissions/removals from LULUCF (CO2 equivalents)'],
  ['sector_energy', 'Energy-total'], ['sector_industry', 'Industrial Processes'], ['sector_agriculture', 'Agriculture'], ['sector_waste', 'Waste'],
  ['sector_land', 'Land use and forestry'], ['energy_stationary', 'combustion in stationary sources'], ['energy_transport', 'combustion in mobile sources'],
  ['energy_fugitive', 'fugitive emissions'], ['gas_co2', 'Carbon dioxide (CO2)'], ['gas_methane', 'Methane (CH4)'], ['gas_nitrous_oxide', 'Nitrous oxide (S2O)']]) {
  plain('geostat_env_ghg', 'mt_co2e', `environment.ghg.${id}`, text);
}
plain('geostat_env_ghg', 'kt_co2e', 'environment.ghg.gas_hfcs', 'HFCs');
plain('geostat_env_ghg', 'kt_co2e', 'environment.ghg.gas_sf6', 'SF6');
plain('geostat_env_ghg', 't_co2e_per_person', 'environment.ghg.per_person', 'Aggregated GHG emissions per capita');
const POLLUTANTS = [['co', 'Carbon monoxide (CO), total'], ['nox', 'Nitrogen oxides (NOX), total'], ['so2', 'Sulphur dioxide (SO2), total'], ['nh3', 'Ammonia (NH3), total'],
  ['nmvoc', 'Non-methane volatile organic compounds (NMVOC), total'], ['tsp', 'Total suspended particulates (TSP), total'],
  ['pm10', 'Patriculate matters (PM10), total'], ['pm25', 'Patriculate matters (PM2.5), total']];
for (const [id, text] of POLLUTANTS) {
  plain('geostat_env_air_emissions', 'thousand_tonnes', `environment.air.${id}.total`, text);
  plain('geostat_env_air_emissions', 'thousand_tonnes', `environment.air.${id}.stationary`, 'from stationary sources', [text]);
  plain('geostat_env_air_emissions', 'thousand_tonnes', `environment.air.${id}.mobile`, 'from mobile sources', [text]);
}
const CLIMATE = { geostat_env_temperature: ['Georgia', 'Tbilisi', 'The region with the maximum average temperature 1961-1990 (except for Tbilisi): Guria',
  'The region with the minimum average temperature 1961-1990: Racha-Lechkhumi and Kvemo Svaneti'],
geostat_env_precipitation: ['Georgia', 'Tbilisi', 'Region with the maximum average precipitation 1961-1990: Samegrelo-Zemo Svaneti', 'Region with the minimum average precipitation 1961-1990: Kvemo Kartli'] };
['georgia', 'tbilisi', 'warmest', 'coldest'].forEach((area, i) => {
  plain('geostat_env_temperature', 'celsius', `environment.climate.temperature.${area}`, 'Annual average temperature', [CLIMATE.geostat_env_temperature[i]]);
  plain('geostat_env_temperature', 'celsius', `environment.climate.temperature_anomaly.${area}`, 'Average annual deviation from the average temperature', [CLIMATE.geostat_env_temperature[i]]);
});
['georgia', 'tbilisi', 'wettest', 'driest'].forEach((area, i) => plain('geostat_env_precipitation', 'mm', `environment.climate.precipitation.${area}`, 'Annual precipitation', [CLIMATE.geostat_env_precipitation[i]]));
plain('geostat_env_water_supply', 'million_m3', 'environment.water.gross', 'Gross volume of water supplied by water supply industry');
plain('geostat_env_water_supply', 'million_m3', 'environment.water.lost', 'Losses during transport');
plain('geostat_env_water_supply', 'million_m3', 'environment.water.net', 'Net volume of water supplied by water supply industry');
plain('geostat_env_water_household', 'million_m3', 'environment.water.households', 'Water supplied to households by water supply industry*');
plain('geostat_env_water_losses', 'percent', 'environment.water.lost_share', 'Percentage of water losses during transport', ['Percentage of water losses during transport']);
plain('geostat_env_water_supply', 'million_persons', 'environment.water.people_piped', 'Number of population connected to water supply industry');
plain('geostat_env_water_supply', 'percent', 'environment.water.share_piped', 'Percentage of population connected to water supply industry');
for (const [id, block] of [['sewers', 'Population connected to a wastewater collecting system'], ['treatment', 'Population connected to wastewater treatment facilities']]) {
  plain('geostat_env_wastewater', 'million_persons', `environment.water.people_${id}`, 'Population connected', [block]);
  plain('geostat_env_wastewater', 'percent', `environment.water.share_${id}`, 'Percentage of total population connected', [block]);
}
plain('geostat_env_water_household', 'm3_per_person', 'environment.water.per_person', 'Total household water use (water supply industry and self supply) per capita*');
for (const [id, text] of [['primary', 'Primary/mechanical treatment'], ['secondary', 'Secondary/biological treatment'], ['tertiary', 'Tertiary/advanced treatment']]) {
  plain('geostat_env_wastewater', 'million_persons', `environment.water.treatment_${id}`, text);
}
const REGIONS = [['region_tbilisi', 'Tbilisi'], ['region_adjara', 'Adjara AR'], ['region_guria', 'Guria'], ['region_imereti', 'Imereti'], ['region_kakheti', 'Kakheti'],
  ['region_mtskheta_mtianeti', 'Mtskheta-Mtianeti'], ['region_racha_lechkhumi_kvemo_svaneti', 'Racha-Lechkhumi and Kvemo Svaneti'],
  ['region_samegrelo_zemo_svaneti', 'Samegrelo-Zemo Svaneti'], ['region_samtskhe_javakheti', 'Samtskhe-Javakheti'], ['region_kvemo_kartli', 'Kvemo Kartli'],
  ['region_shida_kartli', 'Shida Kartli']];
for (const [id, text] of [['georgia', 'Georgia'], ...REGIONS]) plain('geostat_env_waste', 'thousand_tonnes', `environment.waste.collected.${id}`, text);
plain('geostat_env_waste', 'kg_per_person', 'environment.waste.per_person', 'Municipal waste generation per capita');
for (const [measure, source] of [['timber_cut', 'geostat_env_timber'], ['illegal_logging', NIL]]) {
  for (const [id, text] of [['georgia', 'Georgia'], ...REGIONS, ['protected_areas', 'Protected areas']]) plain(source, 'm3', `environment.forest.${measure}.${id}`, text);
}
plain('geostat_env_fires', 'fires', 'environment.forest.fires', 'Number of fire cases (unit)');
plain('geostat_env_fires', 'hectares', 'environment.forest.burnt_area', 'Area covered by fire (hectare)');

// Air quality: walk every sheet; a "Monitoring Station <code> / ..." line opens a station, a one-cell line names the pollutant.
const CITY = { A: 'tbilisi', B: 'kutaisi', C: 'batumi', D: 'rustavi', E: 'zestaponi', F: 'zugdidi', G: 'akhaltsikhe', H: 'telavi', I: 'mestia' };
const HEADING = { 'pm 10': 'pm10', 'pm 2.5': 'pm25', 'no2 - nitrogen dioxide': 'no2', tsp: 'tsp', 'so2 - sulphur dioxide': 'so2', 'mno2 - მანგანუმის დიოქსიდი***': 'mno2' };
const limits = new Map(); // city:measure -> [{ row, sheet, station }]
const AQ = 'geostat_env_air_quality';
for (const sheetName of workbook(AQ).SheetNames) {
  const sheet = workbook(AQ).Sheets[sheetName];
  let station = null; let heading = null;
  for (let r = 1; r <= lastRow(sheet); r += 1) {
    const text = label(sheet, r);
    const opened = /^monitoring station ([a-i])(\d) \//.exec(text);
    if (opened) { station = `${CITY[opened[1].toUpperCase()]}_${opened[1]}${opened[2]}`; heading = null; continue; }
    if (text.startsWith('summary for')) { station = null; continue; }
    if (!station) continue;
    if (rowCells(sheet, r).length === 1 && text) { heading = HEADING[text] ?? `other:${text}`; continue; }
    if (!heading || heading.startsWith('other')) continue;
    const city = station.replace(/_[a-i]\d$/, '');
    if (text === 'annual average concentration') record(`environment.aq.${heading}_avg.${station}`, AQ, sheetName, r, 'ug_m3');
    if (text === 'number of days with exceeded daily limit value' && heading === 'pm10' && city !== 'zestaponi') record(`environment.aq.pm10_days.${station}`, AQ, sheetName, r, 'days');
    if (text === 'annual average limit value' && city !== 'zestaponi') limits.set(`${city}:${heading}`, [...(limits.get(`${city}:${heading}`) ?? []), { row: r, sheet: sheetName, station }]);
  }
}
const crossFailures = [];
for (const [key, blocks] of limits) {
  const [city, measure] = key.split(':');
  const sheet = workbook(AQ).Sheets[blocks[0].sheet];
  const years = [...found.keys()].filter(k => k.startsWith(`environment.aq.${measure}_avg.${city}_`)).map(k => Number(k.split(':')[1]));
  for (const block of blocks.slice(1)) {
    const a = yearsOf(sheet, headingAbove(sheet, blocks[0].row)); const b = yearsOf(sheet, headingAbove(sheet, block.row));
    for (const [col, year] of Object.entries(b)) {
      const mine = valueOf(sheet[`${col}${block.row}`], AQ);
      const firstCol = Object.keys(a).find(c => a[c] === year);
      if (mine !== null && valueOf(sheet[`${firstCol}${blocks[0].row}`], AQ) !== mine) crossFailures.push(`${city} ${measure} limit differs between stations in ${year}`);
    }
  }
  const heading = yearsOf(sheet, headingAbove(sheet, blocks[0].row));
  for (const year of new Set(years)) {
    const col = Object.keys(heading).find(c => heading[c] === year);
    const value = valueOf(sheet[`${col}${blocks[0].row}`], AQ);
    if (value === null) crossFailures.push(`${city} ${measure} has no limit in ${year}`);
    else found.set(`environment.aq.${measure}_limit.${city}:${year}`, { value, cell: `${col}${blocks[0].row}`, sheet: blocks[0].sheet, unit: 'ug_m3', source: AQ });
  }
}

const parseCsv = text => {
  const [header, ...lines] = text.replace(/^﻿/, '').trim().split('\n');
  const fields = header.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [fields[i], v])));
};
const decimalsOf = text => (text.includes('.') ? text.split('.')[1].length : 0);
function verify(rows) {
  const failures = []; const counts = { cells: 0, values: 0, units: 0, statuses: 0 };
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.indicator_id}:${row.year}`;
    const expected = found.get(key);
    if (seen.has(key)) failures.push(`duplicate ${key}`);
    seen.add(key);
    if (!expected) { failures.push(`not found again: ${key}`); continue; }
    if (expected.cell === row.source_cell && expected.sheet === row.source_sheet && expected.source === row.source_id) counts.cells += 1; else failures.push(`cell differs: ${key}`);
    const shown = shownOf(workbook(expected.source).Sheets[expected.sheet][expected.cell], expected.value);
    if (expected.value === row.value && row.published_value === shown && Number(row.decimals) === decimalsOf(shown)) counts.values += 1; else failures.push(`value differs: ${key}`);
    if (expected.unit === row.unit) counts.units += 1; else failures.push(`unit differs: ${key}`);
    if (row.basis === 'actual' && row.value_status === 'official') counts.statuses += 1; else failures.push(`basis or status: ${key}`);
  }
  for (const key of found.keys()) if (!seen.has(key)) failures.push(`missing from the CSV: ${key}`);
  return { failures, ...counts };
}
function crossChecks(rows) {
  const v = new Map(rows.map(r => [`${r.indicator_id}:${r.year}`, Number(r.value)]));
  const get = (id, year) => v.get(`${id}:${year}`) ?? 0;
  const out = [];
  const near = (a, b, tolerance, what) => { if (Math.abs(a - b) > tolerance + 1e-9) out.push(what); };
  for (let year = 2000; year <= 2022; year += 1) {
    const total = get('environment.ghg.total', year);
    near(total, ['energy', 'industry', 'agriculture', 'waste'].reduce((s, x) => s + get(`environment.ghg.sector_${x}`, year), 0), 0.15, `ghg sectors ${year}`);
    near(get('environment.ghg.sector_energy', year), ['stationary', 'transport', 'fugitive'].reduce((s, x) => s + get(`environment.ghg.energy_${x}`, year), 0), 0.15, `ghg energy ${year}`);
    near(total, get('environment.ghg.gas_co2', year) + get('environment.ghg.gas_methane', year) + get('environment.ghg.gas_nitrous_oxide', year) +
      (get('environment.ghg.gas_hfcs', year) + get('environment.ghg.gas_sf6', year)) / 1000, 0.15, `ghg gases ${year}`);
    near(get('environment.ghg.net', year), total + get('environment.ghg.sector_land', year), 0.15, `ghg net ${year}`);
  }
  for (let year = 2013; year <= 2024; year += 1) {
    for (const [p] of POLLUTANTS) near(get(`environment.air.${p}.total`, year), get(`environment.air.${p}.stationary`, year) + get(`environment.air.${p}.mobile`, year), 0.15, `air ${p} ${year}`);
  }
  for (let year = 2015; year <= 2025; year += 1) near(get('environment.water.gross', year), get('environment.water.lost', year) + get('environment.water.net', year), 0.15, `water ${year}`);
  for (let year = 2015; year <= 2024; year += 1) near(get('environment.waste.collected.georgia', year), REGIONS.reduce((s, [id]) => s + get(`environment.waste.collected.${id}`, year), 0), 0.15, `waste ${year}`);
  for (const measure of ['timber_cut', 'illegal_logging']) {
    for (let year = 2010; year <= 2024; year += 1) {
      near(get(`environment.forest.${measure}.georgia`, year), [...REGIONS.map(([id]) => id), 'protected_areas'].reduce((s, id) => s + get(`environment.forest.${measure}.${id}`, year), 0), 2, `${measure} ${year}`);
    }
  }
  return out;
}

// Every served cell must hold the same number in the Georgian workbook, sheet for sheet (by position) and cell for cell.
const KNOWN_GEORGIAN = new Set(['environment.aq.pm25_avg.rustavi_d2:2025']); // English 21.7, Georgian 22
const observations = parseCsv(readFileSync(join(root, 'environment-annual.csv'), 'utf8'));
const georgian = { compared: 0, differences: [], known: [] };
for (const row of observations) {
  const english = workbook(row.source_id);
  const ka = workbook(`${row.source_id}_ka`);
  const sheet = ka.Sheets[ka.SheetNames[english.SheetNames.indexOf(row.source_sheet)]];
  const value = valueOf(sheet[row.source_cell], row.source_id);
  georgian.compared += 1;
  if (value !== row.value) (KNOWN_GEORGIAN.has(`${row.indicator_id}:${row.year}`) ? georgian.known : georgian.differences).push(`${row.indicator_id} ${row.year}: ${row.value} != ${value}`);
}
const manifestFailures = MANIFEST.flatMap(s => {
  const data = readFileSync(join(root, s.local_file));
  return createHash('sha256').update(data).digest('hex').toUpperCase() === s.sha256 && data.length === s.bytes ? [] : [`${s.local_file}: hash or size differs from the manifest`];
});

const result = verify(observations);
const detects = rows => verify(rows).failures.length > 0;
const edit = (indicator, year, change) => observations.map(row => (row.indicator_id === indicator && Number(row.year) === year ? { ...row, ...change } : row));
const negative = {
  altered_value_detected: detects(edit('environment.ghg.total', 2022, { value: '20.2', published_value: '20.2' })),
  altered_published_value_detected: detects(edit('environment.water.lost_share', 2025, { published_value: '64.5' })),
  omitted_row_detected: detects(observations.slice(1)),
  shifted_year_detected: detects(edit('environment.forest.fires', 2024, { year: '2025' })),
  wrong_cell_detected: detects(edit('environment.aq.pm10_avg.rustavi_d1', 2025, { source_cell: 'AC9' })),
  wrong_unit_detected: detects(edit('environment.aq.pm10_days.tbilisi_a1', 2025, { unit: 'ug_m3' })),
  zero_over_placeholder_detected: detects([...observations, { ...observations.find(r => r.indicator_id === 'environment.ghg.gas_hfcs'), year: '2000', value: '0', published_value: '0' }]),
  ghg_sum_break_detected: crossChecks(edit('environment.ghg.sector_waste', 2022, { value: '2.3' })).length > 0,
  forest_sum_break_detected: crossChecks(edit('environment.forest.timber_cut.region_guria', 2024, { value: '9446' })).length > 0,
};

const failures = [...result.failures, ...crossFailures, ...crossChecks(observations), ...georgian.differences, ...manifestFailures];
const report = {
  status: failures.length === 0 && Object.values(negative).every(Boolean) ? 'passed' : 'failed',
  reader: `SheetJS ${XLSX.version}`,
  workbooks: books.size,
  observations: observations.length,
  cells_found_again: found.size,
  source_cells_matched: result.cells,
  values_matched: result.values,
  units_matched: result.units,
  basis_and_status_matched: result.statuses,
  cross_checks: ['greenhouse gases: four sectors = total, three energy rows = energy, gases (HFCs and SF6 / 1,000) = total, total + land use = net (0.15)',
    'air pollutants: stationary + mobile = total (0.15)', 'water: losses + net = gross (0.15)', 'waste: eleven regions = Georgia (0.15)',
    'timber cut and illegal logging: regions + protected areas = Georgia (2 m3)', 'every station block of a city prints the same yearly limits'],
  georgian_copies: { served_cells_compared: georgian.compared, differences: georgian.differences.length, known_differences: georgian.known },
  manifest_files_matched: MANIFEST.length - manifestFailures.length,
  negative_controls: negative,
  failures: failures.slice(0, 50),
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (!process.argv.includes('--no-write')) writeFileSync(join(root, 'independent-validation.json'), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);
