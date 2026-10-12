"""Reproduce and check the annual poverty and Gini research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader and CSV writer are reused from the unemployment package, as the wages package does.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import importlib.util
import json
from pathlib import Path
import sys


sys.dont_write_bytecode = True  # Loading the shared reader must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, read_sheet = _shared.clean, _shared.csv_bytes, _shared.read_sheet

RETRIEVED_AT = '2026-10-10'
PAGE = 'https://www.geostat.ge/en/modules/categories/192/living-conditions'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
SOURCES = [
    ('geostat_poverty_absolute', 'Share of population under absolute poverty line', 'https://www.geostat.ge/media/79296/302_Absolute-Poverty.xlsx', 'official/302-absolute-poverty.xlsx', XLSX),
    ('geostat_poverty_relative', 'Relative poverty indicators', 'https://www.geostat.ge/media/79294/301_Relative-Poverty.xlsx', 'official/301-relative-poverty.xlsx', XLSX),
    ('geostat_poverty_international', 'Proportion of the population living below the international poverty line (2021 PPP)', 'https://www.geostat.ge/media/76130/304_Poverty_Int_ENG_2021PPP.xlsx', 'official/304-international-poverty-2021ppp.xlsx', XLSX),
    ('geostat_gini', 'Gini coefficients', 'https://www.geostat.ge/media/79298/303_Gini-Coefficients.xlsx', 'official/303-gini-coefficients.xlsx', XLSX),
    ('geostat_poverty_source_page', 'Poverty and Gini Coefficients (English source page)', PAGE, 'official/poverty-page-2026-10-10.html', 'text/html; charset=UTF-8'),
    ('geostat_poverty_metadata_2026', 'Metadata: absolute and relative poverty indicators and Gini coefficients (25 May 2026)', 'https://www.geostat.ge/media/79322/0702_250526_EN.PDF', 'official/poverty-metadata-2026.pdf', 'application/pdf'),
    ('geostat_hies_metadata_2026', 'Metadata: households incomes and expenditures survey (25 May 2026)', 'https://www.geostat.ge/media/79320/0701_250526_EN.PDF', 'official/hies-metadata-2026.pdf', 'application/pdf'),
]
FIELDS = ['year', 'indicator_id', 'group_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id',
          'source_sheet', 'source_cell', 'source_label', 'source_number_format']
PRECISION = {'#,##0.0': Decimal('0.1'), '0.0': Decimal('0.1'), '0.00': Decimal('0.01')}
ABSOLUTE_COLUMNS = {'B': ('settlement.urban', 'Urban'), 'C': ('settlement.rural', 'Rural'), 'D': ('age.0_17', '0 - 17'),
                    'E': ('age.18_64', '18 - 64'), 'F': ('age.65_plus', '65 +'), 'G': ('sex.female', 'Female'),
                    'H': ('sex.male', 'Male'), 'I': ('georgia', 'Georgia')}
RELATIVE_BLOCKS = {'Share of population under 60 percent of the median consumption': 'poverty.relative_60',
                   'Share of population under 40 percent of the median consumption': 'poverty.relative_40'}
RELATIVE_GROUPS = {'Urban': 'settlement.urban', 'Rural': 'settlement.rural', 'Georgia': 'georgia'}
INTERNATIONAL_ROWS = {'Poverty headcount ratio at $3.0 a day (2021 PPP) (Extreme poverty rate)': 'poverty.international_300',
                      'Poverty headcount ratio at $4.2 a day (2021 PPP)': 'poverty.international_420',
                      'Poverty headcount ratio at $8.3 a day (2021 PPP)': 'poverty.international_830'}
GINI_COLUMNS = {'B': ('gini.total_income', 'By total incomes1'), 'C': ('gini.cash_inflows', 'By total cash inflows2'),
                'D': ('gini.total_inflows', 'By total inflows3'), 'E': ('gini.consumption_expenditure', 'By total consumption expenditures4'),
                'F': ('gini.cash_expenditure', 'By total cash expenditures5'), 'G': ('gini.total_expenditure', 'By total expenditures6')}
COVERAGE = {'poverty.absolute': (2004, 2025), 'poverty.relative_60': (2004, 2025), 'poverty.relative_40': (2004, 2025),
            'poverty.international_300': (2004, 2024), 'poverty.international_420': (2004, 2024),
            'poverty.international_830': (2004, 2024), **{indicator: (2006, 2025) for indicator, _ in GINI_COLUMNS.values()}}
GROUPS = {'poverty.absolute': [group for group, _ in ABSOLUTE_COLUMNS.values()],
          'poverty.relative_60': list(RELATIVE_GROUPS.values()), 'poverty.relative_40': list(RELATIVE_GROUPS.values())}
# Geostat's Poverty and Gini Coefficients page, captured 2026-10-10: Georgia's absolute poverty, 2016-2025.
PAGE_VALUES = dict(zip(range(2016, 2026), ['22.0', '21.9', '20.1', '19.5', '21.3', '17.5', '15.6', '11.8', '9.4', '7.1']))
GINI_HEADLINE_2025 = '0.34'  # Geostat's 2025 release: Gini by total incomes.


def published(value, number_format):
    return str(value.quantize(PRECISION[number_format], rounding=ROUND_HALF_UP))


def _cell(sheet, row, column):
    return sheet.get(row, {}).get(column)


def _text(sheet, row, column):
    cell = _cell(sheet, row, column)
    return None if cell is None else clean(str(cell['value']))


def _observation(rows, source_id, indicator_id, group_id, year, cell, label):
    if cell is None or cell['kind'] != 'n' or cell['format'] not in PRECISION:
        raise ValueError(f'Expected a formatted number for {indicator_id}:{group_id}:{year}')
    rows.append({
        'year': year, 'indicator_id': indicator_id, 'group_id': group_id, 'value': str(cell['value']),
        'published_value': published(cell['value'], cell['format']),
        'unit': 'index' if indicator_id.startswith('gini.') else 'percent', 'basis': 'actual',
        'value_status': 'survey_estimate', 'source_id': source_id, 'source_sheet': '1', 'source_cell': cell['cell'],
        'source_label': label, 'source_number_format': cell['format']})


def _year_columns(sheet, row):
    return {column: int(cell['value']) for column, cell in sheet[row].items() if column != 'A'}


def extract():
    """Every primary observation, located by label text and re-read from its original cell."""
    rows = []
    sheet = read_sheet(ROOT / 'official/302-absolute-poverty.xlsx')
    headers = {**{c: _text(sheet, 2, c) for c in 'BCI'}, **{c: _text(sheet, 3, c) for c in 'DEFGH'}}
    if any(headers[column] != label for column, (_, label) in ABSOLUTE_COLUMNS.items()):
        raise ValueError(f'Unexpected absolute poverty headers: {headers}')
    for number in sorted(sheet):
        label = _text(sheet, number, 'A')
        if label is None or not label.rstrip('*').isdigit():
            continue
        for column, (group_id, header) in ABSOLUTE_COLUMNS.items():
            _observation(rows, 'geostat_poverty_absolute', 'poverty.absolute', group_id, int(label.rstrip('*')),
                         _cell(sheet, number, column), f'{label} | {header}')

    sheet = read_sheet(ROOT / 'official/301-relative-poverty.xlsx')
    years, indicator = _year_columns(sheet, 2), None
    for number in sorted(sheet)[2:]:
        label = _text(sheet, number, 'A')
        if label in RELATIVE_BLOCKS:
            indicator = RELATIVE_BLOCKS[label]
        elif label in RELATIVE_GROUPS and indicator:
            for column, year in years.items():
                _observation(rows, 'geostat_poverty_relative', indicator, RELATIVE_GROUPS[label], year,
                             _cell(sheet, number, column), f'{[k for k, v in RELATIVE_BLOCKS.items() if v == indicator][0]} | {label}')

    sheet = read_sheet(ROOT / 'official/304-international-poverty-2021ppp.xlsx')
    years = _year_columns(sheet, 2)
    for number in sorted(sheet):
        label = _text(sheet, number, 'A')
        if label in INTERNATIONAL_ROWS:
            for column, year in years.items():
                _observation(rows, 'geostat_poverty_international', INTERNATIONAL_ROWS[label], 'georgia', year,
                             _cell(sheet, number, column), label)

    sheet = read_sheet(ROOT / 'official/303-gini-coefficients.xlsx')
    if any(_text(sheet, 2, column) != label for column, (_, label) in GINI_COLUMNS.items()):
        raise ValueError('Unexpected Gini headers')
    for number in sorted(sheet):
        label = _text(sheet, number, 'A')
        if label is None or not label.isdigit():
            continue
        for column, (indicator_id, header) in GINI_COLUMNS.items():
            _observation(rows, 'geostat_gini', indicator_id, 'georgia', int(label), _cell(sheet, number, column), header)
    return rows


def validate(rows):
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['group_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        value = Decimal(row['value'])
        if published(value, row['source_number_format']) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        upper = Decimal(1) if row['unit'] == 'index' else Decimal(100)
        if not Decimal(0) <= value <= upper:
            raise ValueError(f'Value outside its range: {key}')
        by_key[key] = value
    expected = {(indicator, group, year) for indicator, (first, last) in COVERAGE.items()
                for group in GROUPS.get(indicator, ['georgia']) for year in range(first, last + 1)}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')
    v = lambda indicator, group, year: by_key[(indicator, group, year)]  # noqa: E731
    for indicator, (first, last) in COVERAGE.items():
        for year in range(first, last + 1):
            if indicator.startswith('poverty.relative') or indicator == 'poverty.absolute':
                pairs = [('settlement.urban', 'settlement.rural')]
                if indicator == 'poverty.absolute':
                    pairs += [('sex.female', 'sex.male')]
                bounds = [[v(indicator, a, year), v(indicator, b, year)] for a, b in pairs]
                if indicator == 'poverty.absolute':
                    bounds.append([v(indicator, g, year) for g in ('age.0_17', 'age.18_64', 'age.65_plus')])
                for bound in bounds:
                    if not min(bound) <= v(indicator, 'georgia', year) <= max(bound):
                        raise ValueError(f'Georgia is not between its groups: {indicator}:{year}')
    for group in RELATIVE_GROUPS.values():
        for year in range(2004, 2026):
            if v('poverty.relative_40', group, year) > v('poverty.relative_60', group, year):
                raise ValueError(f'Under 40 percent exceeds under 60 percent: {group}:{year}')
    for year in range(2004, 2025):
        if not v('poverty.international_300', 'georgia', year) <= v('poverty.international_420', 'georgia', year) <= v('poverty.international_830', 'georgia', year):
            raise ValueError(f'international lines out of order: {year}')
    rounded = {year: published(v('poverty.absolute', 'georgia', year), '#,##0.0') for year in PAGE_VALUES}
    if rounded != PAGE_VALUES:
        raise ValueError('Absolute poverty does not match the Geostat page capture')
    if published(v('gini.total_income', 'georgia', 2025), '0.00') != GINI_HEADLINE_2025:
        raise ValueError('Gini by total incomes does not match the Geostat page release')


def manifest():
    records = []
    for source_id, title, url, local_file, content_type in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': PAGE,
                        'retrieved_file_url': url, 'resolved_file_url': url, 'retrieved_at': RETRIEVED_AT,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def build(check=False):
    rows = sorted(extract(), key=lambda r: (r['indicator_id'], r['group_id'], r['year']))
    validate(rows)
    sources = manifest()
    coverage = defaultdict(list)
    for row in rows:
        coverage[(row['indicator_id'], row['group_id'])].append(row['year'])
    coverage_rows = [{'indicator_id': i, 'group_id': g, 'first_year': min(y), 'last_year': max(y), 'observations': len(y)}
                     for (i, g), y in sorted(coverage.items())]
    counts = defaultdict(int)
    for row in rows:
        counts[row['source_id']] += 1
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_AT,
        'scope': 'Annual research only: absolute, relative and international poverty rates and Gini coefficients; '
                 'no household income or expenditure, regions, lari poverty lines or serving',
        'primary_observation_count': len(rows), 'observations_by_source': dict(sorted(counts.items())),
        'imputed_values': 0, 'reconciliation_failed_count': 0,
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'poverty-annual.csv': csv_bytes(rows, FIELDS),
        'coverage.csv': csv_bytes(coverage_rows, list(coverage_rows[0])),
        'validation-report.json': (json.dumps(report, indent=2) + '\n').encode('utf-8'),
    }
    for name, content in outputs.items():
        target = ROOT / name
        if check:
            if not target.exists() or target.read_bytes() != content:
                raise ValueError(f'Generated file is stale: {name}')
        else:
            target.write_bytes(content)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    report = build(check=parser.parse_args().check)
    print(json.dumps({'status': report['status'], 'primary_observation_count': report['primary_observation_count']}))


if __name__ == '__main__':
    main()
