// Reproduce and check the Geostat social protection research package from its preserved sources.
// Reads the 15 English and 15 Georgian workbooks with SheetJS, the web app's own Excel library. Most of them are the old
// .xls format, which Python's standard library cannot read, so this package uses Node rather than a prepare.py.
// Rows are found by their printed label and columns by their printed year (and Women/Men/Total) headings.
// Never downloads sources or serves product data.
//
//   node prepare.mjs          # rebuild every generated file
//   node prepare.mjs --check  # fail if a committed generated file differs from a rebuild
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, '../../../../apps/web/package.json'));
const XLSX = require('xlsx');

const RETRIEVED_ON = '2026-10-17';
const PUBLISHER = 'National Statistics Office of Georgia (Geostat)';
const SITE = 'https://geostat.ge';
const PAGES = {
  en: 'https://www.geostat.ge/en/modules/categories/55/social-protection',
  ka: 'https://www.geostat.ge/ka/modules/categories/55/sotsialuri-datsva',
};
// source id, English media id and published file name, Georgian media id and published file name.
const SOURCES = [
  ['pension-social-package', 76715, 'Persons-receiving-pension-and-social-package.xls', 76709, 'pensiis-da-socialuri-paketis-mimRebTa-ricxovnoba.xls'],
  ['pension-social-package-regions-sex', 76716, 'Persons-receiving-pension-and-social-package-by-regions-and-gender.xls', 76710, 'pensiis-da-socialuri-paketis-mimRebTa-raodenoba-sqesis-da-regionebis-mix....xls'],
  ['pension-municipalities', 76717, 'Persons-receiving-pension-by-municipalities.xls', 76711, 'pensiis-mimRebTa-ricxovnoba-municipalitetebis-mixedviT.XLS'],
  ['social-package-municipalities', 76718, 'Persons--receiving-social-package-by-municipalities.xls', 76712, 'socialuri-paketis-mimRebTa-ricxovnoba-municipalitetebis-mixedviT.XLS'],
  ['subsistence-families-municipalities', 80710, 'Number-of-helpless-families-receiving-subsistence-allowance-by-municipal...-%281%29.xls', 80709, 'registrirebuli-da-saarsebo-Semweobis-mimRebi-ojaxebi-municipalitet....xls'],
  ['subsistence-beneficiaries', 78594, 'Beneficiaries-of-Subsistence-Allowance.xls', 78590, 'Saarsebo-shemweobis-mimghebi-mosaxleoba.xls'],
  ['child-care-institutions', 60170, 'Child-care-institutions.xls', 60161, 'mzrunvelobamoklebul-bavSvTa-saxlebi.xls'],
  ['accumulative-pension', 78001, 'Accumulative-Pension.xlsx', 78000, 'dagrovebiTi-pensia.xlsx'],
  ['nursing-homes', 76720, '10_Data-on-nursing-homes-for-elderly-and-disabled-persons.xls', 76714, 'monacemebi-xandazmulTa-da-SezRuduli-SesaZleblobis-mqone-pirTa-ganTavsebi....xls'],
  ['uhc-disabled-patients', 78595, 'under-the-universal-health-care-program_disabled-persons.xlsx', 78591, 'sayovelTao-jandacvit-mosargebleebi_SSmp.xlsx'],
  ['oncology-drugs-disabled', 78596, 'using-oncology-drugs-disabled-persons.xlsx', 78592, 'onkologiuri-preparatebiT-mosargebleebi_SSmp.xlsx'],
  ['outpatient-disabled', 78597, 'planned-outpatient-services_disabled-persons.xlsx', 78593, 'gegmiuri-ambolatoriiT-mosargebleebi_SSmp.xlsx'],
  ['pensioners-registered-1995-2006', 43079, 'Number-of-people-registered-with-social-security_authorities.xls', 43078, 'mosaxleobis-socialuri-dacvis-organoebSi-aRricxuli-pensionerebi-kategoriebis_mixedviT.xls'],
  ['household-allowance-recipients', 43127, 'Number-of-household-allowance-recipients-by-categories.xls', 46954, 'saojaxo-daxmarebis-mimReb-ojaxTa-raodenoba-kategoriebis-mixedviT.XLS'],
  ['household-allowance-amount', 26188, 'Amount-of-the-sum-transferred-for-the-household-benefit.xls', 26187, 'saojaxo-daxmarebis-mimReb-pirebze-gadaricxuli-tanxa.xls'],
];
const UNAVAILABLE = /^(…|\.\s*\.\s*\.|-)$/; // Geostat's marks for "not published" and "none"
const YEAR = /^((?:19|20)\d{2})\s*(\d\)|\*+)?$/; // 2025, 2025*, 20071) — a year with a footnote mark

const spaced = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const localFile = (id, lang, published) => `official/${lang}/${id}.${lang}${published.slice(published.lastIndexOf('.')).toLowerCase()}`;

/** Every value cell of every sheet: printed row label, column heading parts, year and value or unavailable mark. */
function extract(path) {
  const workbook = XLSX.read(readFileSync(join(root, path)), { type: 'buffer' });
  const cells = [];
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const at = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })];
    // Merged heading cells count for every column they span.
    const merged = new Map();
    for (const merge of sheet['!merges'] ?? []) {
      const top = at(merge.s.r, merge.s.c);
      if (!top) continue;
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) merged.set(`${r},${c}`, top);
    }
    const value = (r, c) => at(r, c) ?? merged.get(`${r},${c}`);
    const text = (r, c) => spaced(value(r, c)?.v);
    const isValue = cell => cell && (cell.t === 'n' || UNAVAILABLE.test(spaced(cell.v)));
    let firstData = null;
    for (let r = range.s.r + 1; r <= range.e.r && firstData === null; r++) {
      if (!text(r, 0)) continue;
      for (let c = 1; c <= range.e.c; c++) if (isValue(at(r, c)) && !YEAR.test(text(r, c))) { firstData = r; break; }
    }
    if (firstData === null) return;
    const headerRows = [];
    for (let r = range.s.r + 1; r < firstData; r++) {
      let any = false;
      for (let c = 1; c <= range.e.c; c++) if (text(r, c)) any = true;
      if (any) headerRows.push(r);
    }
    const sheetYear = YEAR.test(sheetName.trim()) ? Number(sheetName.trim().slice(0, 4)) : null;
    let lastYear = null;
    const columns = [];
    for (let c = 1; c <= range.e.c; c++) {
      const parts = [];
      let year = null, mark = '';
      for (const r of headerRows) {
        const part = text(r, c);
        const found = YEAR.exec(part);
        if (found) { year = Number(found[1]); mark = found[2] ?? ''; } else if (part && parts.at(-1) !== part) parts.push(part);
      }
      // Women / Men / Total columns under one merged year heading that SheetJS reports only for the first column.
      if (year === null && parts.length && lastYear !== null && headerRows.some(r => YEAR.test(text(r, c - 1)) || columns.at(-1)?.inherited)) {
        year = lastYear; columns.push({ c, year, mark: '', parts, inherited: true });
        continue;
      }
      if (year !== null) lastYear = year;
      columns.push({ c, year: year ?? sheetYear, mark, parts, inherited: false });
    }
    let order = 0;
    for (let r = firstData; r <= range.e.r; r++) {
      const label = text(r, 0);
      if (!label) continue;
      const values = columns.filter(col => isValue(at(r, col.c)));
      if (!values.length) continue;
      order += 1;
      for (const col of values) {
        const cell = at(r, col.c);
        const unavailable = cell.t !== 'n';
        cells.push({
          sheet: sheetName, sheet_index: sheetIndex + 1, row_order: order, row_label: label,
          column: XLSX.utils.encode_col(col.c), column_label: col.parts.join(' / '), year: col.year ?? '', year_mark: col.mark,
          value: unavailable ? '' : String(cell.v), status: unavailable ? 'unavailable' : 'published', cell: XLSX.utils.encode_cell({ r, c: col.c }),
        });
      }
    }
  });
  return cells;
}

const csvText = (rows, fields) => '﻿' + [fields.join(','), ...rows.map(row => fields.map(f => {
  const v = String(row[f] ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(','))].join('\n') + '\n';

function build() {
  const failures = [], findings = [], manifest = [], rows = [];
  for (const [lang, url] of Object.entries(PAGES)) {
    const file = `official/pages/social-protection-page-${lang}.html`;
    manifest.push({ source_id: `page-${lang}`, language: lang, url, local_file: file, content_type: 'text/html; charset=UTF-8',
      bytes: readFileSync(join(root, file)).length, sha256: sha256(join(root, file)), retrieved_on: RETRIEVED_ON });
  }
  for (const [id, enMedia, enName, kaMedia, kaName] of SOURCES) {
    const files = { en: localFile(id, 'en', enName), ka: localFile(id, 'ka', kaName) };
    let missing = false;
    for (const [lang, media, name] of [['en', enMedia, enName], ['ka', kaMedia, kaName]]) {
      const file = files[lang];
      if (!existsSync(join(root, file))) { failures.push(`${file} is missing`); missing = true; continue; }
      manifest.push({ source_id: id, language: lang, url: `${SITE}/media/${media}/${name}`, local_file: file,
        content_type: file.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel',
        bytes: readFileSync(join(root, file)).length, sha256: sha256(join(root, file)), retrieved_on: RETRIEVED_ON });
    }
    if (missing) continue;
    const en = extract(files.en), ka = extract(files.ka);
    // The Georgian file supplies the Georgian labels. Its rows are paired with the English rows by their figures, because
    // the two language versions sometimes list municipalities in a different order; rows whose figures differ anywhere are
    // paired by position. Both versions' values are kept side by side; every cell where they disagree is a source finding.
    const rowKey = cells => cells.map(c => `${c.year}:${c.column}=${c.value || c.status}`).join(';');
    const group = cells => {
      const rowsOf = new Map();
      for (const cell of cells) {
        const key = `${cell.sheet_index}|${cell.row_order}`;
        if (!rowsOf.has(key)) rowsOf.set(key, []);
        rowsOf.get(key).push(cell);
      }
      return rowsOf;
    };
    const enRows = group(en), kaRows = group(ka);
    const kaByFigures = new Map();
    for (const [key, cells] of kaRows) {
      const figures = `${key.split('|')[0]}|${rowKey(cells)}`;
      kaByFigures.set(figures, kaByFigures.has(figures) ? null : key); // null: figures shared by several rows
    }
    const used = new Set();
    for (const [key, cells] of enRows) {
      let twinKey = kaByFigures.get(`${key.split('|')[0]}|${rowKey(cells)}`);
      if (!twinKey || used.has(twinKey)) twinKey = kaRows.has(key) && !used.has(key) ? key : null;
      if (twinKey) used.add(twinKey);
      const twins = new Map((kaRows.get(twinKey) ?? []).map(c => [`${c.year}|${c.column}`, c]));
      for (const cell of cells) {
        const twin = twins.get(`${cell.year}|${cell.column}`);
        if (!twin) findings.push({ source_id: id, sheet: cell.sheet, cell: cell.cell, note: 'no matching Georgian cell' });
        else if (twin.status !== cell.status || (twin.value !== cell.value && Math.abs(Number(twin.value) - Number(cell.value)) >= 1e-6)) {
          findings.push({ source_id: id, sheet: cell.sheet, cell: cell.cell,
            note: `English ${cell.value || cell.status}, Georgian ${twin.value || twin.status}` });
        }
        const agree = twin && twin.status === cell.status && (twin.value === cell.value || Math.abs(Number(twin.value) - Number(cell.value)) < 1e-6);
        rows.push({ source_id: id, ...cell, row_label_ka: twin?.row_label ?? '', column_label_ka: twin?.column_label ?? '',
          value_ka: twin?.value ?? '', status_ka: twin?.status ?? 'missing', versions_agree: agree ? 'yes' : 'no' });
      }
    }
    if (ka.length !== en.length) findings.push({ source_id: id, note: `English file has ${en.length} value cells, Georgian ${ka.length}` });
    if (!en.length) failures.push(`${id}: no value cells found`);
  }
  // SSA cross-check: Geostat's yearly recipient counts are SSA's December figures.
  const ssaPath = join(root, '../ssa-statistics/annual-amounts.csv');
  const crossChecks = [];
  if (existsSync(ssaPath)) {
    const [head, ...lines] = readFileSync(ssaPath, 'utf8').replace(/^﻿/, '').trim().split('\n');
    const fields = head.split(',');
    const ssa = new Map(lines.map(line => { const v = line.split(','); const o = Object.fromEntries(fields.map((f, i) => [f, v[i]])); return [`${o.program}|${o.year}`, o]; }));
    const geostat = (id, sheetIndex, rowOrder) => rows.filter(r => r.source_id === id && r.sheet_index === sheetIndex && r.row_order === rowOrder && r.status === 'published');
    const pairs = [
      ['pension', 'recipients', geostat('pension-municipalities', 1, 1)],
      ['social_package', 'recipients', geostat('social-package-municipalities', 1, 1)],
      ['subsistence_allowance', 'recipients', geostat('subsistence-families-municipalities', 2, 1)],
      ['subsistence_allowance', 'emp_families', geostat('subsistence-families-municipalities', 3, 1)],
    ];
    for (const [programme, field, cells] of pairs) {
      for (const cell of cells) {
        const theirs = ssa.get(`${programme}|${cell.year}`);
        if (!theirs || theirs.recipients_month === '' || Number(theirs.recipients_month) !== 12) continue;
        const ok = Number(theirs[field]) === Number(cell.value);
        crossChecks.push({ programme, field, year: cell.year, geostat: cell.value, ssa_december: theirs[field], matches: ok ? 'yes' : 'no' });
        if (!ok) failures.push(`${programme} ${field} ${cell.year}: Geostat ${cell.value}, SSA December ${theirs[field]}`);
      }
    }
  }
  const coverage = SOURCES.map(([id]) => {
    const own = rows.filter(r => r.source_id === id);
    const years = [...new Set(own.map(r => r.year).filter(Boolean))].sort();
    return { source_id: id, sheets: new Set(own.map(r => r.sheet)).size, rows: new Set(own.map(r => `${r.sheet}|${r.row_order}`)).size,
      first_year: years[0] ?? '', last_year: years.at(-1) ?? '', published_values: own.filter(r => r.status === 'published').length,
      unavailable_values: own.filter(r => r.status === 'unavailable').length };
  });
  const report = { retrieved_on: RETRIEVED_ON, publisher: PUBLISHER,
    counts: { workbooks: manifest.filter(m => m.source_id.indexOf('page-') !== 0).length, value_cells: rows.length,
      ssa_cross_checks: crossChecks.length, findings: findings.length },
    failures, passed: failures.length === 0 };
  return {
    'source-manifest.csv': csvText(manifest, Object.keys(manifest[0])),
    'source-manifest.json': JSON.stringify(manifest, null, 1) + '\n',
    'geostat-social-protection.csv': csvText(rows, ['source_id', 'sheet', 'sheet_index', 'row_order', 'row_label', 'row_label_ka',
      'column', 'column_label', 'column_label_ka', 'year', 'year_mark', 'value', 'status', 'value_ka', 'status_ka', 'versions_agree', 'cell']),
    'coverage.csv': csvText(coverage, Object.keys(coverage[0])),
    'ssa-cross-check.csv': csvText(crossChecks, ['programme', 'field', 'year', 'geostat', 'ssa_december', 'matches']),
    'source-findings.csv': csvText(findings, ['source_id', 'sheet', 'cell', 'note']),
    'validation-report.json': JSON.stringify(report, null, 1) + '\n',
    report,
  };
}

const outputs = build();
const check = process.argv.includes('--check');
const stale = [];
for (const [name, content] of Object.entries(outputs)) {
  if (name === 'report') continue;
  const target = join(root, name);
  if (check) { if (!existsSync(target) || readFileSync(target, 'utf8') !== content) stale.push(name); } else writeFileSync(target, content);
}
console.log(JSON.stringify(outputs.report.counts, null, 1));
for (const failure of outputs.report.failures.slice(0, 40)) console.log('FAIL', failure);
if (stale.length) console.log('Out of date:', stale.join(', '));
process.exit(outputs.report.failures.length || stale.length ? 1 : 0);
