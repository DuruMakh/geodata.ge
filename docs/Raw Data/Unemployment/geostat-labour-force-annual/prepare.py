"""Reproduce and check the annual research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
"""

import argparse
from collections import defaultdict
import csv
from decimal import Decimal, ROUND_HALF_UP
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
COUNT_TOLERANCE = Decimal('0.000001')  # Thousand persons: 0.001 person.
RATE_TOLERANCE = Decimal('0.000001')   # Percentage points.
INDICATORS = {
    'Total 15 + population': 'population_15_plus',
    'Labour force': 'labour_force',
    'Employed': 'employed',
    'Hired': 'hired',
    'Self-employed': 'self_employed',
    'Not-identified worker': 'unidentified_worker',
    'Unemployed': 'unemployed',
    'Population outside the labour force': 'outside_labour_force',
    'Population outside labour force': 'outside_labour_force',
    'Unemployment rate, percentage': 'unemployment_rate',
    'Labour force participation rate, percentage': 'participation_rate',
    'Employment rate, percentage': 'employment_rate',
}
CORE = ('population_15_plus', 'labour_force', 'employed', 'unemployed',
        'outside_labour_force', 'unemployment_rate', 'participation_rate', 'employment_rate')
COUNTS = CORE[:5]
EMPLOYMENT_PARTS = ('hired', 'self_employed', 'unidentified_worker')
REGIONS = {
    'Kakheti': ('region.kakheti', 'Kakheti'),
    'Tbilisi': ('region.tbilisi', 'Tbilisi'),
    'Shida Kartli': ('region.shida_kartli', 'Shida Kartli'),
    'Kvemo Kartli': ('region.kvemo_kartli', 'Kvemo Kartli'),
    'Adjara A/R': ('region.adjara', 'Adjara'),
    'Samegrelo-Zemo Svaneti': ('region.samegrelo_zemo_svaneti', 'Samegrelo-Zemo Svaneti'),
    'Imereti': ('region.imereti', 'Imereti'),
    'Imereti**': ('region.imereti_racha_lechkhumi_kvemo_svaneti', 'Imereti, Racha-Lechkhumi and Kvemo Svaneti'),
    'The remaining regions***': ('region.samtskhe_javakheti_guria_mtskheta_mtianeti', 'Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti'),
    'Samtskhe-Javakheti': ('region.samtskhe_javakheti', 'Samtskhe-Javakheti'),
    'Guria': ('region.guria', 'Guria'),
    'Mtskheta-Mtianeti': ('region.mtskheta_mtianeti', 'Mtskheta-Mtianeti'),
    'Racha-Lechkhumi and Kvemo-Svaneti': ('region.racha_lechkhumi_kvemo_svaneti', 'Racha-Lechkhumi and Kvemo Svaneti'),
    'Georgia': ('georgia', 'Georgia'),
}
LAYOUTS = {
    'geostat_lfs_annual_total': ('national', [(3, 'georgia', 'Georgia')]),
    'geostat_lfs_annual_sex': ('sex', [(4, 'women', 'Women'), (18, 'men', 'Men')]),
    'geostat_lfs_annual_settlement': ('settlement', [(4, 'urban', 'Urban'), (18, 'rural', 'Rural')]),
    'geostat_lfs_annual_age': ('age', None),
    'geostat_lfs_annual_region': ('region', None),
}
REQUIRED_SOURCES = set(LAYOUTS) | {'geostat_lfs_metadata_2026', 'geostat_lfs_source_page',
                                  'geostat_lfs_annual_education', 'geostat_lfs_annual_long_term'}
FIELDS = ('year', 'frequency', 'dimension', 'group_id', 'group_label_en', 'indicator_id',
          'unit', 'value', 'published_value', 'basis', 'value_status', 'methodology_epoch',
          'role', 'source_id', 'source_sheet', 'source_cell', 'source_group_label', 'source_label', 'source_number_format')


def clean(value):
    return ' '.join(value.split()) if isinstance(value, str) else value


def read_sheet(path, sheet_name='1'):
    """Read original XML decimal tokens without converting them to binary floats."""
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = workbook.findall('x:sheets/x:sheet', NS)
        matching = [sheet for sheet in sheets if sheet.get('name') == sheet_name]
        if len(matching) != 1 or (sheet_name == '1' and len(sheets) != 1):
            raise ValueError(f'Unexpected worksheet layout: {path.name}')
        relation_id = matching[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        relations = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(relation.get('Target') for relation in relations if relation.get('Id') == relation_id)
        sheet_path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS):
                strings.append(''.join(t.text or '' for t in item.findall('.//x:t', NS)))
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        formats = {0: 'General', 1: '0', 2: '0.00'}
        formats.update({int(f.get('numFmtId')): f.get('formatCode')
                        for f in styles.findall('x:numFmts/x:numFmt', NS)})
        style_formats = [formats.get(int(s.get('numFmtId')), 'unsupported')
                         for s in styles.findall('x:cellXfs/x:xf', NS)]
        rows = defaultdict(dict)
        for cell in ET.fromstring(archive.read(sheet_path)).findall('x:sheetData/x:row/x:c', NS):
            coordinate = cell.get('r')
            column, row = re.fullmatch(r'([A-Z]+)(\d+)', coordinate).groups()
            token = cell.find('x:v', NS)
            value = None if token is None else token.text
            kind = cell.get('t', 'n')
            if kind == 's' and value is not None:
                value = strings[int(value)]
            elif kind == 'inlineStr':
                value = ''.join(t.text or '' for t in cell.findall('.//x:t', NS))
            elif kind == 'n' and value is not None:
                value = Decimal(value)
            if value is not None:
                rows[int(row)][column] = {'value': value, 'cell': coordinate, 'kind': kind,
                                          'format': style_formats[int(cell.get('s', '0'))]}
    return rows


def add_observation(observations, record, dimension, group_id, label, year, metric_label, cell,
                    coordinate, source_group_label):
    metric = INDICATORS[metric_label]
    value = None if cell is None else cell['value']
    if value is not None and not isinstance(value, Decimal):
        raise ValueError(f'Non-numeric source value: {record["source_id"]} {cell}')
    if value is not None and (not value.is_finite() or value < 0 or
                              (metric.endswith('_rate') and value > 100)):
        raise ValueError(f'Invalid value: {record["source_id"]} {cell}')
    if cell is not None and cell['format'] != '0.0':
        raise ValueError(f'Unexpected source precision: {cell}')
    role = 'control' if dimension in ('age', 'region') and group_id == 'georgia' else 'primary'
    observations.append(dict(zip(FIELDS, (
        year, 'annual', dimension, group_id, label, metric,
        'percent' if metric.endswith('_rate') else 'thousand_persons',
        '' if value is None else str(value),
        '' if value is None else str(value.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)),
        'actual', 'survey_estimate', 'ilo13' if year < 2010 else 'ilo19_20', role,
        record['source_id'], '1', coordinate, source_group_label, metric_label, '0.0',
    ))))


def extract(record):
    rows = read_sheet(ROOT / record['local_file'])
    dimension, blocks = LAYOUTS[record['source_id']]
    result = []
    if blocks is not None:
        for index, (header, group_id, label) in enumerate(blocks):
            end = blocks[index + 1][0] - 1 if index + 1 < len(blocks) else max(rows) + 1
            years = [(c, int(v['value'])) for c, v in rows[header].items()
                     if isinstance(v['value'], Decimal) and 1990 <= v['value'] <= 2030]
            if [year for _, year in years] != list(range(1998, 2026)):
                raise ValueError(f'Unexpected annual coverage: {record["source_id"]}')
            for r in range(header + 1, end):
                metric_label = clean(rows[r].get('A', {}).get('value'))
                if metric_label not in INDICATORS:
                    if any(isinstance(v['value'], Decimal) for c, v in rows[r].items() if c != 'A'):
                        raise ValueError(f'Unmapped data row: {record["source_id"]} A{r}')
                    continue
                for c, year in years:
                    add_observation(result, record, dimension, group_id, label, year, metric_label, rows[r].get(c),
                                    f'{c}{r}', label)
    else:
        years = [(r, int(c['value'])) for r, values in sorted(rows.items())
                 for column, c in values.items()
                 if column == 'A' and isinstance(c['value'], Decimal) and 1990 <= c['value'] <= 2030]
        expected_start = 2002 if dimension == 'age' else 2003
        if [year for _, year in years] != list(range(expected_start, 2026)):
            raise ValueError(f'Unexpected annual coverage: {record["source_id"]}')
        for index, (r, year) in enumerate(years):
            end = years[index + 1][0] if index + 1 < len(years) else max(rows) + 1
            for c, header in rows[r + 1].items():
                raw_label = clean(header['value'])
                if dimension == 'region':
                    group_id, label = REGIONS[raw_label]
                elif raw_label in ('Total', 'სულ'):
                    group_id, label = 'georgia', 'Georgia'
                else:
                    if not re.fullmatch(r'\d{2}-\d{2}|65\+', raw_label):
                        raise ValueError(f'Unmapped age group: {raw_label}')
                    group_id, label = 'age.' + raw_label.replace('-', '_').replace('+', '_plus'), raw_label
                for rr in range(r + 2, end):
                    metric_label = clean(rows[rr].get('A', {}).get('value'))
                    if metric_label in INDICATORS:
                        add_observation(result, record, dimension, group_id, label, year, metric_label, rows[rr].get(c),
                                        f'{c}{rr}', raw_label)
                    elif c in rows[rr] and isinstance(rows[rr][c]['value'], Decimal):
                        raise ValueError(f'Unmapped data row: {record["source_id"]} A{rr}')
    return result


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = []
        if tag in ('th', 'td') and self.row is not None:
            self.cell = ''

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag in ('th', 'td') and self.cell is not None:
            self.row.append(clean(self.cell))
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def expected_core_keys():
    """Inventory of published source cells, independent of the extracted rows."""
    expected = set()
    for source_id, (dimension, blocks) in LAYOUTS.items():
        start = 2002 if dimension == 'age' else 2003 if dimension == 'region' else 1998
        for year in range(start, 2026):
            if blocks is not None:
                group_ids = {group_id for _, group_id, _ in blocks}
            elif dimension == 'age':
                width = 10 if 2010 <= year <= 2019 else 5
                group_ids = {f'age.{age}_{age + width - 1}' for age in range(15, 65, width)}
                group_ids |= {'age.65_plus', 'georgia'}
            else:
                labels = set(REGIONS) - {'Imereti**', 'The remaining regions***'}
                if year <= 2018:
                    labels -= {'Imereti', 'Racha-Lechkhumi and Kvemo-Svaneti'}
                    labels.add('Imereti**')
                if year <= 2016:
                    labels -= {'Samtskhe-Javakheti', 'Guria', 'Mtskheta-Mtianeti'}
                    labels.add('The remaining regions***')
                group_ids = {REGIONS[label][0] for label in labels}
            metrics = CORE
            if dimension not in ('age', 'region') or not 2010 <= year <= 2019:
                metrics += EMPLOYMENT_PARTS
            expected.update((source_id, year, group_id, metric) for group_id in group_ids for metric in metrics)
    return expected


def validate(observations, manifest):
    groups = defaultdict(dict)
    seen = set()
    failures, gaps, checks = [], [], []
    for row in observations:
        key = (row['source_id'], row['year'], row['group_id'], row['indicator_id'])
        if key in seen:
            raise ValueError(f'Duplicate observation: {key}')
        seen.add(key)
        group = (row['dimension'], row['year'], row['group_id'])
        groups[group][row['indicator_id']] = Decimal(row['value']) if row['value'] else None
        if not row['value']:
            gaps.append({'key': key, 'reason': 'blank source cell'})

    expected = expected_core_keys()
    for key in sorted(expected - seen):
        failures.append({'check': 'source_observation_inventory', 'key': key, 'reason': 'missing published observation'})
    for key in sorted(seen - expected):
        failures.append({'check': 'source_observation_inventory', 'key': key, 'reason': 'unexpected observation'})
    if failures:
        return groups, checks, failures, gaps

    def compare(name, key, actual, expected, tolerance):
        if actual is None or expected is None:
            failures.append({'check': name, 'key': key, 'reason': 'missing input'})
            return
        difference = abs(actual - expected)
        check = {'check': name, 'key': key, 'difference': str(difference), 'tolerance': str(tolerance),
                 'passed': difference <= tolerance}
        checks.append(check)
        if not check['passed']:
            failures.append(check)

    for key, values in sorted(groups.items()):
        for metric in CORE:
            if metric not in values:
                failures.append({'check': 'required_indicator', 'key': key, 'indicator': metric})
        if any(values.get(metric) is None for metric in CORE):
            continue
        p, lf, e, u, inactive = [values[m] for m in COUNTS]
        if p <= 0 or lf <= 0:
            failures.append({'check': 'positive_denominator', 'key': key})
            continue
        compare('labour_force_identity', key, lf, e + u, COUNT_TOLERANCE)
        compare('population_identity', key, p, lf + inactive, COUNT_TOLERANCE)
        compare('unemployment_rate', key, values['unemployment_rate'], u / lf * 100, RATE_TOLERANCE)
        compare('participation_rate', key, values['participation_rate'], lf / p * 100, RATE_TOLERANCE)
        compare('employment_rate', key, values['employment_rate'], e / p * 100, RATE_TOLERANCE)
        if all(values.get(m) is not None for m in EMPLOYMENT_PARTS):
            compare('employment_components', key, e, sum(values[m] for m in EMPLOYMENT_PARTS), COUNT_TOLERANCE)

    for year in range(1998, 2026):
        national = groups[('national', year, 'georgia')]
        for dimension in ('sex', 'settlement', 'age', 'region'):
            components = [v for (d, y, g), v in groups.items() if d == dimension and y == year and g != 'georgia']
            if not components:
                continue
            for metric in COUNTS:
                if all(v.get(metric) is not None for v in components):
                    compare('breakdown_sum', (dimension, year, metric), sum(v[metric] for v in components),
                            national[metric], COUNT_TOLERANCE)
                else:
                    failures.append({'check': 'breakdown_sum', 'key': (dimension, year, metric), 'reason': 'missing input'})
            if dimension in ('age', 'region'):
                control = groups[(dimension, year, 'georgia')]
                for metric in CORE:
                    compare('repeated_national_total', (dimension, year, metric), control.get(metric), national.get(metric),
                            RATE_TOLERANCE if metric.endswith('_rate') else COUNT_TOLERANCE)

    parser = Tables()
    page_record = next(r for r in manifest if r['source_id'] == 'geostat_lfs_source_page')
    parser.feed((ROOT / page_record['local_file']).read_text(encoding='utf-8-sig'))
    page_rows = [r for r in parser.rows if len(r) > 1]
    header = next(r for r in page_rows if r[1:5] == ['2022', '2023', '2024', '2025'])
    page_metrics = {'Labour force, thousand persons': 'labour_force', 'Employed, thousand persons': 'employed',
                    'Unemployed, thousand persons': 'unemployed', 'Unemployment rate, percentage': 'unemployment_rate'}
    for label, metric in page_metrics.items():
        page_row = next(r for r in page_rows if r[0] == label)
        for index, period in enumerate(header[1:], 1):
            if not period.isdigit():  # The page also displays quarters: do not mix these with years.
                continue
            year = int(period)
            value = groups[('national', year, 'georgia')][metric]
            published = None if value is None else value.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
            compare('official_page_annual_headline', (year, metric), Decimal(page_row[index]),
                    published, Decimal(0))
    return groups, checks, failures, gaps


def csv_bytes(rows, fields):
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode('utf-8-sig')


def build():
    manifest = json.loads((ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
    source_ids = [record['source_id'] for record in manifest]
    if set(source_ids) != REQUIRED_SOURCES or len(source_ids) != len(REQUIRED_SOURCES):
        raise ValueError('Source manifest must contain each of the nine required captures exactly once')
    observations, hashes = [], []
    for record in manifest:
        content = (ROOT / record['local_file']).read_bytes()
        digest = hashlib.sha256(content).hexdigest().upper()
        if digest != record['sha256'] or len(content) != record['bytes']:
            raise ValueError(f'Source hash or size mismatch: {record["local_file"]}')
        hashes.append({'source_id': record['source_id'], 'sha256': digest, 'bytes': len(content), 'passed': True})
        if record['source_id'] in LAYOUTS:
            observations.extend(extract(record))
    observations.sort(key=lambda r: (r['year'], r['dimension'], r['group_id'], r['indicator_id']))
    groups, checks, failures, gaps = validate(observations, manifest)
    from supplemental import collect
    supplemental_products, supplemental_report = collect(ROOT, manifest, groups)
    current = [r for r in observations if r['year'] >= 2010 and r['role'] == 'primary' and r['indicator_id'] in CORE]
    summary = []
    for key, values in sorted(groups.items()):
        dimension, year, group_id = key
        if year < 2010 or (dimension in ('age', 'region') and group_id == 'georgia'):
            continue
        related = [r for r in current if (r['dimension'], r['year'], r['group_id']) == key]
        summary.append({'year': year, 'dimension': dimension, 'group_id': group_id,
                        'group_label_en': related[0]['group_label_en'],
                        **{m + ('_pct' if m.endswith('_rate') else '_thousand'):
                           '' if values.get(m) is None else str(values[m].quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)) for m in CORE},
                        'source_id': related[0]['source_id'],
                        'unemployed_source_cell': next(r['source_cell'] for r in related if r['indicator_id'] == 'unemployed'),
                        'rate_source_cell': next(r['source_cell'] for r in related if r['indicator_id'] == 'unemployment_rate')})
    coverage = []
    for dimension in ('national', 'sex', 'settlement', 'age', 'region'):
        for group_id in sorted({r['group_id'] for r in current if r['dimension'] == dimension}):
            rows = [r for r in current if r['dimension'] == dimension and r['group_id'] == group_id]
            years = sorted({r['year'] for r in rows})
            coverage.append({'dimension': dimension, 'group_id': group_id, 'group_label_en': rows[0]['group_label_en'],
                             'year_min': years[0], 'year_max': years[-1], 'year_count': len(years),
                             'years': '|'.join(map(str, years))})
    report = {
        'status': 'passed' if not failures and not gaps and supplemental_report['status'] == 'passed' else 'failed',
        'retrieved_at': '2026-10-03',
        'scope': 'Annual research only; core series plus education and long-term unemployment; no serving or UI integration',
        'current_year_min': 2010, 'current_year_max': 2025, 'source_observation_count': len(observations),
        'current_core_observation_count': len(current), 'summary_group_year_count': len(summary),
        'legacy_observation_count': sum(r['year'] < 2010 for r in observations),
        'duplicate_keys': 0, 'gaps': gaps, 'imputed_values': 0,
        'source_checks': hashes, 'reconciliation_check_count': len(checks),
        'reconciliation_failed_count': len(failures), 'failures': failures,
        'coverage': coverage,
        'supplemental': supplemental_report,
        'total_source_observation_count': len(observations) + supplemental_report['source_observation_count'],
        'total_primary_observation_count': len(current) + supplemental_report['primary_observation_count'],
        'total_reconciliation_check_count': len(checks) + supplemental_report['check_count'],
        'limitations': [
            '1998-2009 use ILO 13th ICLS; do not join to the 2010+ ILO 19th/20th ICLS series.',
            'Age bands are ten-year groups in 2010-2019 and five-year groups from 2020; 65+ is unchanged.',
            'Imereti includes Racha-Lechkhumi/Kvemo Svaneti through 2018; separate from 2019.',
            'Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti are combined through 2016; separate from 2017.',
            'Survey estimates cover private households aged 15+, excluding occupied territories and institutional households.',
            'Unemployment uses the labour force denominator; non-employment and population outside the labour force are different measures.',
            'Counts are thousand persons; source cells retain additional precision but are published to one decimal.',
            'The source page contains quarterly headlines, which are excluded from this annual package.',
            'Sampling error matters; the metadata reports a 2025 national unemployment-rate 95% interval of 13.0%-14.8%.',
        ],
    }
    products = {
        'source-observations.csv': csv_bytes(observations, FIELDS),
        'unemployment-annual.csv': csv_bytes(current, FIELDS),
        'unemployment-summary.csv': csv_bytes(summary, tuple(summary[0])),
        'coverage.csv': csv_bytes(coverage, tuple(coverage[0])),
        'source-manifest.csv': csv_bytes(manifest, tuple(manifest[0])),
        'reconciliation.csv': csv_bytes([{**c, 'key': '|'.join(map(str, c['key']))} for c in checks],
                                        ('check', 'key', 'difference', 'tolerance', 'passed')),
        'validation-report.json': (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
    }
    products.update(supplemental_products)
    return products, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare generated outputs without writing.')
    args = parser.parse_args()
    products, report = build()
    if args.check:
        stale = [name for name, content in products.items() if not (ROOT / name).exists() or (ROOT / name).read_bytes() != content]
        if stale:
            raise SystemExit('Missing or stale outputs: ' + ', '.join(stale))
    else:
        for name, content in products.items():
            (ROOT / name).write_bytes(content)
    print(json.dumps({k: report[k] for k in ('status', 'source_observation_count', 'current_core_observation_count',
                                           'summary_group_year_count', 'legacy_observation_count', 'reconciliation_check_count',
                                           'reconciliation_failed_count', 'failures', 'total_source_observation_count',
                                           'total_primary_observation_count', 'total_reconciliation_check_count')}, indent=2))
    if report['supplemental']['failures']:
        print(json.dumps(report['supplemental']['failures'], indent=2))
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
