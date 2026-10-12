"""Reproduce and check the annual household income and spending research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader and CSV writer are reused from the unemployment package, as the poverty package does.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP, Context, localcontext
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

RETRIEVED_AT = '2026-10-11'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
PAGES = {'income': 'https://www.geostat.ge/en/modules/categories/50/households-income',
         'spending': 'https://www.geostat.ge/en/modules/categories/51/households-expenditures'}
POVERTY_PAGE = 'https://www.geostat.ge/en/modules/categories/192/living-conditions'

# Workbook numbers 101-109 (income) and 201-209 (spending): per population, household and capita, each for Georgia,
# towns and villages, and regions. Geostat's media ids run in that order, 79260 for 101 and 79278 for 201.
DOMAINS = {'income': ('incomes', 101, 79260), 'spending': ('expenditures', 201, 79278)}
WHO = [('population', 'of-the-total-population'), ('household', 'per-household'), ('capita', 'per-capita')]
AREAS = [('national', ''), ('settlement', '-by-urban-and-rural-areas'), ('region', '-by-regions')]
MEASURES = {'household': 'per_household', 'capita': 'per_capita'}


def _sources():
    records = []
    for domain, (word, first, media) in DOMAINS.items():
        for index, ((who, who_slug), (area, area_slug)) in enumerate((w, a) for w in WHO for a in AREAS):
            number = first + index
            name = f'{number}_Distribution-of-average-monthly-{word}-{who_slug}{area_slug}.xlsx'
            title = f'Distribution of average monthly {word} {who_slug.replace("-", " ")}{area_slug.replace("-", " ")}'
            records.append({
                'source_id': f'geostat_household_{domain}_{who}_{area}', 'title': title, 'domain': domain, 'who': who,
                'area': area, 'number': number, 'url': f'https://geostat.ge/media/{media + index}/{name}',
                'resolved_url': f'https://www.geostat.ge/media/{media + index}/{name}',
                'file': f'official/{number}-{domain}-{who_slug.replace("of-the-total-", "total-")}'
                        f'{"" if area == "national" else "-" + area}.xlsx'})
    return records


WORKBOOKS = _sources()
SERVED = [record for record in WORKBOOKS if record['who'] in MEASURES and record['number'] % 100 >= 4]
OTHER_SOURCES = [
    ('geostat_household_income_page', 'Households Incomes (English source page)', 'https://www.geostat.ge/en/modules/categories/50',
     PAGES['income'], PAGES['income'], 'official/income-page-2026-10-11.html', 'text/html; charset=UTF-8', RETRIEVED_AT),
    ('geostat_household_spending_page', 'Households Expenditures (English source page)', 'https://www.geostat.ge/en/modules/categories/51',
     PAGES['spending'], PAGES['spending'], 'official/spending-page-2026-10-11.html', 'text/html; charset=UTF-8', RETRIEVED_AT),
    # Copied unchanged from the poverty package, which retrieved it on 2026-10-10 from the same Geostat site.
    ('geostat_household_hies_metadata_2026', 'Metadata: households incomes and expenditures survey (25 May 2026)',
     'https://www.geostat.ge/media/79320/0701_250526_EN.PDF', POVERTY_PAGE, 'https://www.geostat.ge/media/79320/0701_250526_EN.PDF',
     'official/hies-metadata-2026.pdf', 'application/pdf', '2026-10-10'),
]

FIELDS = ['year', 'indicator_id', 'area_id', 'measure', 'value', 'published_value', 'unit', 'basis', 'value_status',
          'source_id', 'source_sheet', 'source_cell', 'source_label', 'source_number_format']
PRECISION = {'#,##0.0': Decimal('0.1'), '0.0': Decimal('0.1')}
DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows 15 significant digits.

# Workbook row label -> ID, by exact text; Property income's label is matched by its prefix.
INCOME_LINES = {
    '1. Income, total (2+3)': 'income.total', 'Wages and salaries': 'income.wages', 'From self-employment': 'income.self_employment',
    'From selling agricultural production': 'income.agriculture_sales', 'Pensions, scholarships, assistances': 'income.pensions_assistance',
    'Remittances from abroad': 'income.remittances', 'Money received as gift': 'income.gifts', '3. Non-cash income': 'income.non_cash',
    '4. Other cash inflows': 'income.other_inflows', 'Borrowing and dissaving': 'income.borrowing_dissaving',
    'Property disposal': 'income.property_disposal'}
SPENDING_LINES = {
    '1. Consumption expenditure, total (2+3)': 'spending.consumption', 'On food, beverages, tobacco': 'spending.food',
    'On clothes and footwear': 'spending.clothing', 'On household goods': 'spending.household_goods', 'On healthcare': 'spending.health',
    'Housing, water, electricity, gas and other fuels': 'spending.housing_utilities', 'On transport': 'spending.transport',
    'On education': 'spending.education', 'Other consumption expenditure': 'spending.other_consumption',
    '3. Non-cash expenditure': 'spending.non_cash', '4. Cash non-consumption expenditure': 'spending.non_consumption',
    'On agriculture': 'spending.agriculture', 'On transfers': 'spending.transfers', 'On saving and lending': 'spending.saving_lending',
    'On property acquirement': 'spending.property'}
PROPERTY_INCOME_PREFIX = 'Property income (leasing, interest on deposit'
# Lines used only to check the others; they are archived but not served.
CHECK_LINES = {
    '2. Cash income and transfers': 'income.cash', '5. Cash inflows, total (2+4)': 'income.cash_inflows',
    '6. Cash and non-cash inflows, total (3+5)': 'income.all_inflows', '2. Cash consumption expenditure': 'spending.cash_consumption',
    '5. Cash expenditure, total (2+4)': 'spending.cash_expenditure', '6. Expenditure, total (3+5)': 'spending.expenditure'}
INDICATORS = {'income': sorted([*INCOME_LINES.values(), 'income.property']), 'spending': sorted(SPENDING_LINES.values())}

SUMS = [  # total = parts, for income and then spending
    ('income.cash', ['income.wages', 'income.self_employment', 'income.agriculture_sales', 'income.property',
                     'income.pensions_assistance', 'income.remittances', 'income.gifts']),
    ('income.total', ['income.cash', 'income.non_cash']),
    ('income.total', ['income.wages', 'income.self_employment', 'income.agriculture_sales', 'income.property',
                      'income.pensions_assistance', 'income.remittances', 'income.gifts', 'income.non_cash']),
    ('income.other_inflows', ['income.property_disposal', 'income.borrowing_dissaving']),
    ('income.cash_inflows', ['income.cash', 'income.other_inflows']),
    ('income.all_inflows', ['income.non_cash', 'income.cash_inflows']),
    ('spending.cash_consumption', ['spending.food', 'spending.clothing', 'spending.household_goods', 'spending.health',
                                   'spending.housing_utilities', 'spending.transport', 'spending.education', 'spending.other_consumption']),
    ('spending.consumption', ['spending.cash_consumption', 'spending.non_cash']),
    ('spending.consumption', ['spending.food', 'spending.clothing', 'spending.household_goods', 'spending.health',
                              'spending.housing_utilities', 'spending.transport', 'spending.education', 'spending.other_consumption',
                              'spending.non_cash']),
    ('spending.non_consumption', ['spending.agriculture', 'spending.transfers', 'spending.saving_lending', 'spending.property']),
    ('spending.cash_expenditure', ['spending.cash_consumption', 'spending.non_consumption']),
    ('spending.expenditure', ['spending.non_cash', 'spending.cash_expenditure']),
]
SUM_TOLERANCE = Decimal('0.000001')       # Exact values; the measured maximum error is about 6e-8.
NATIONAL_TOLERANCE = Decimal('0.000000001')

SETTLEMENT_AREAS = {'Urban': 'settlement.urban', 'Rural': 'settlement.rural'}
UNAVAILABLE_BEFORE_2019 = {'region.samtskhe_javakheti', 'region.guria', 'region.mtskheta_mtianeti', 'region.racha_lechkhumi_kvemo_svaneti'}
OTHER_REGIONS, REGIONAL_GEORGIA = 'region.other', 'regional_georgia'  # Read for checks only.
REGION_COLUMNS = {
    'Kakheti': 'region.kakheti', 'Tbilisi': 'region.tbilisi', 'Shida Kartli': 'region.shida_kartli',
    'Kvemo Kartli': 'region.kvemo_kartli', 'Samtskhe-Javakheti': 'region.samtskhe_javakheti', 'Adjara A.R.': 'region.adjara',
    'Guria': 'region.guria', 'Samegrelo-Zemo Svaneti': 'region.samegrelo_zemo_svaneti', 'Imereti*': 'region.imereti',
    'Mtskheta-Mtianeti': 'region.mtskheta_mtianeti', 'Racha-Lechkhumi and Kvemo Svaneti': 'region.racha_lechkhumi_kvemo_svaneti',
    'Other regions**': OTHER_REGIONS, 'Georgia': REGIONAL_GEORGIA}
FOOTNOTES = [
    '* The data of 2011-2018 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions.',
    '** Includes Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti regions.',
    '… The data is not available due to small sample size of the survey. Survey sample size has been increased since 2019.']
LAST_YEAR = 2025
# Geostat's 2025 results. The first two are the figures named in the design; the others are the headline table on the
# page captures, which shows the all-inflows and total-expenditure lines (GEL a month).
SPEC_VALUES_2025 = {('per_household', 'income.total'): '2025.8', ('per_household', 'spending.consumption'): '1438.7'}
PAGE_VALUES_2025 = {('per_household', 'income.all_inflows'): '2131.5', ('per_capita', 'income.all_inflows'): '663.6',
                    ('per_household', 'spending.expenditure'): '1936.3', ('per_capita', 'spending.expenditure'): '602.9'}


def published(value, number_format):
    """The value as Excel displays it: 15 significant digits first, then half-up to the cell's decimals."""
    return str(DISPLAY.create_decimal(value).quantize(PRECISION[number_format], rounding=ROUND_HALF_UP))


def line_id(label):
    if label.startswith(PROPERTY_INCOME_PREFIX):
        return 'income.property'
    for table in (INCOME_LINES, SPENDING_LINES, CHECK_LINES):
        if label in table:
            return table[label]
    raise ValueError(f'Unrecognised row label: {label!r}')


def _walk(sheet, kind, footnotes):
    """Yield (area header, year, label, cell) for every data cell, locating blocks by their heading text."""
    years, headers, area, year = {}, {}, None, None
    for number in sorted(sheet)[1:]:  # Row 1 is the title.
        cells = sheet[number]
        label = clean(str(cells['A']['value'])) if 'A' in cells else None
        rest = {column: cell for column, cell in cells.items() if column != 'A'}
        if not rest:
            if label is None or cells['A']['kind'] == 'n':
                if label is not None and kind == 'region':
                    year = int(cells['A']['value'])
                    continue
                raise ValueError(f'Unexpected row {number}')
            if kind == 'settlement' and label in SETTLEMENT_AREAS:
                area = label  # One year header, under "Urban", serves both blocks.
            elif label.startswith(('*', '…')):
                footnotes.append(label)
            elif not label.startswith('Source:'):
                raise ValueError(f'Unexpected heading in row {number}: {label!r}')
        elif label is None:
            if all(cell['kind'] == 'n' for cell in rest.values()):
                years = {column: int(cell['value']) for column, cell in rest.items()}
            else:
                headers = {column: clean(str(cell['value'])) for column, cell in rest.items()}
        else:
            for column, cell in rest.items():
                if kind == 'region':
                    yield headers[column], year, label, cell
                else:
                    yield (area or 'Georgia'), years[column], label, cell


def extract():
    """Every primary observation, located by label text and re-read from its original cell, plus the check-only values."""
    rows, values, footnotes = [], {}, {}
    placeholders = {}
    for record in SERVED:
        kind, domain, measure, source_id = record['area'], record['domain'], MEASURES[record['who']], record['source_id']
        seen_footnotes, counts = [], defaultdict(int)
        sheet = read_sheet(ROOT / record['file'])
        for header, year, label, cell in _walk(sheet, kind, seen_footnotes):
            line = line_id(label)
            if not line.startswith(domain + '.'):
                raise ValueError(f'{source_id}: row {label!r} does not belong to {domain}')
            area = {'national': lambda: 'georgia', 'settlement': lambda: SETTLEMENT_AREAS[header],
                    'region': lambda: REGION_COLUMNS[header]}[kind]()
            if cell['kind'] != 'n':  # Geostat prints "…" or "x" where it publishes no value.
                symbol = cell['value']
                if not ((symbol == '…' and area in UNAVAILABLE_BEFORE_2019 and year < 2019)
                        or (symbol == 'x' and area == OTHER_REGIONS and year >= 2019)):
                    raise ValueError(f'{source_id}: unexpected non-numeric cell {cell["cell"]}')
                counts[symbol] += 1
                continue
            if cell['format'] not in PRECISION or (area in UNAVAILABLE_BEFORE_2019 and year < 2019) \
                    or (area == OTHER_REGIONS and year >= 2019):
                raise ValueError(f'{source_id}: unexpected number in {cell["cell"]}')
            key = (measure, area, line, year)
            if key in values:
                raise ValueError(f'{source_id}: duplicate value for {key}')
            values[key] = cell['value']
            if line in CHECK_LINES.values() or area in (OTHER_REGIONS, REGIONAL_GEORGIA):
                continue
            rows.append({
                'year': year, 'indicator_id': line, 'area_id': area, 'measure': measure, 'value': str(cell['value']),
                'published_value': published(cell['value'], cell['format']), 'unit': 'gel_month', 'basis': 'actual',
                'value_status': 'survey_estimate', 'source_id': source_id, 'source_sheet': '1', 'source_cell': cell['cell'],
                'source_label': label if kind == 'national' else f'{label} | {header}', 'source_number_format': cell['format']})
        if kind == 'region':
            footnotes[source_id] = seen_footnotes
            placeholders[source_id] = dict(sorted(counts.items()))
    return rows, {'values': values, 'footnotes': footnotes, 'placeholders': placeholders}


def _expected_keys():
    area_years = {'georgia': range(2002, 2026), 'settlement.urban': range(2006, 2026), 'settlement.rural': range(2006, 2026)}
    for area in REGION_COLUMNS.values():
        if area not in (OTHER_REGIONS, REGIONAL_GEORGIA):
            area_years[area] = range(2019 if area in UNAVAILABLE_BEFORE_2019 else 2011, 2026)
    return {(indicator, area, measure, year) for indicators in INDICATORS.values() for indicator in indicators
            for measure in MEASURES.values() for area, years in area_years.items() for year in years}


def validate(rows, checks):
    """Spec rules 1-6; returns the reconciliation figures for the report."""
    keys, by_key = set(), dict(checks['values'])
    for row in rows:
        key = (row['indicator_id'], row['area_id'], row['measure'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        value = Decimal(row['value'])
        if published(value, row['source_number_format']) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        by_key[(row['measure'], row['area_id'], row['indicator_id'], row['year'])] = value
    expected = _expected_keys()
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')
    for source_id, found in checks['footnotes'].items():
        if found != FOOTNOTES:
            raise ValueError(f'A footnote was lost or changed: {source_id}')
    if set(checks['footnotes']) != {record['source_id'] for record in SERVED if record['area'] == 'region'}:
        raise ValueError('A regional workbook has no footnotes')
    for key, value in by_key.items():
        if value < 0:
            raise ValueError(f'A negative value: {key}')

    lines = sorted({line for _, _, line, _ in by_key})
    for measure in MEASURES.values():
        for line in lines:
            for year in range(2006, LAST_YEAR + 1):
                urban, rural, georgia = (by_key[(measure, area, line, year)] for area in ('settlement.urban', 'settlement.rural', 'georgia'))
                if not min(urban, rural) <= georgia <= max(urban, rural):
                    raise ValueError(f'Georgia is not between urban and rural: {measure}:{line}:{year}')
            for year in range(2011, LAST_YEAR + 1):
                regions = [by_key[(measure, area, line, year)] for area in REGION_COLUMNS.values()
                           if area != REGIONAL_GEORGIA and (measure, area, line, year) in by_key]
                if not min(regions) <= by_key[(measure, 'georgia', line, year)] <= max(regions):
                    raise ValueError(f'Georgia is outside the range of its regions: {measure}:{line}:{year}')
    for (measure, line), expected in {**SPEC_VALUES_2025, **PAGE_VALUES_2025}.items():
        if published(by_key[(measure, 'georgia', line, LAST_YEAR)], '0.0') != expected:
            raise ValueError(f'Georgia 2025 {measure} {line} does not match the Geostat page: expected {expected}')

    sum_checks, largest = 0, Decimal(0)
    with localcontext() as context:
        context.prec = 40
        for total, parts in SUMS:
            for (measure, area, line, year), value in sorted(by_key.items()):
                if line != total:
                    continue
                missing = [part for part in parts if (measure, area, part, year) not in by_key]
                if missing:
                    raise ValueError(f'Parts missing for {total}: {measure}:{area}:{year}:{missing}')
                error = abs(value - sum(by_key[(measure, area, part, year)] for part in parts))
                if error > SUM_TOLERANCE:
                    raise ValueError(f'Parts do not sum to their total: {total}:{measure}:{area}:{year}')
                sum_checks, largest = sum_checks + 1, max(largest, error)
    for (measure, area, line, year), value in by_key.items():
        if area == REGIONAL_GEORGIA and abs(value - by_key[(measure, 'georgia', line, year)]) > NATIONAL_TOLERANCE:
            raise ValueError(f'Regional Georgia differs from the national workbook: {measure}:{line}:{year}')
    return {'sum_checks': sum_checks, 'max_sum_error': f'{largest:.1e}'}


def manifest():
    records = [(r['source_id'], r['title'], r['url'], PAGES[r['domain']], r['resolved_url'], r['file'], XLSX, RETRIEVED_AT)
               for r in WORKBOOKS] + OTHER_SOURCES
    result = []
    for source_id, title, url, page, resolved, local_file, content_type, retrieved in records:
        data = (ROOT / local_file).read_bytes()
        result.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                       'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': retrieved,
                       'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                       'content_type': content_type})
    return result


def build(check=False):
    rows, checks = extract()
    rows.sort(key=lambda r: (r['indicator_id'], r['area_id'], r['measure'], r['year']))
    reconciliation = validate(rows, checks)
    sources = manifest()
    coverage = defaultdict(list)
    counts = defaultdict(int)
    for row in rows:
        coverage[(row['indicator_id'], row['area_id'], row['measure'])].append(row['year'])
        counts[row['source_id']] += 1
    coverage_rows = [{'indicator_id': i, 'area_id': a, 'measure': m, 'first_year': min(y), 'last_year': max(y), 'observations': len(y)}
                     for (i, a, m), y in sorted(coverage.items())]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_AT,
        'scope': 'Annual research only: average monthly household income and spending lines per household and per person, '
                 'for Georgia, towns and villages, and regions; the sum lines and population-total workbooks are archived '
                 'but not served; no estimates, shares or inflation adjustment',
        'primary_observation_count': len(rows), 'observations_by_source': dict(sorted(counts.items())),
        'imputed_values': 0, 'reconciliation_failed_count': 0, 'reconciliation': reconciliation,
        'check_only_values': len(checks['values']) - len(rows),
        'placeholder_cells_not_served': checks['placeholders'], 'footnotes': checks['footnotes'],
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'household-income-spending-annual.csv': csv_bytes(rows, FIELDS),
        'coverage.csv': csv_bytes(coverage_rows, list(coverage_rows[0])),
        'validation-report.json': (json.dumps(report, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
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
