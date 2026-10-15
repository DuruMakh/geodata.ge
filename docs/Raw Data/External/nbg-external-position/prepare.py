"""Reproduce and check the annual external debt and official reserves research package.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader and CSV writer are reused from the unemployment package, as the money and banks package does.
Every row and column is located by its printed label or by the date in the header row or column A, never by position.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
from datetime import date, timedelta
from decimal import Context, Decimal, ROUND_HALF_UP
import functools
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from urllib.parse import unquote


sys.dont_write_bytecode = True  # Loading the shared reader must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, read_sheet = _shared.clean, _shared.csv_bytes, _shared.read_sheet

RETRIEVED_DATE = '2026-10-15'
PAGE = 'https://nbg.gov.ge/en/statistics/statistics-data'
API = 'https://nbg.gov.ge/gw/api/ct/statistics/categories/{}/data'
HOST = 'https://nbg.gov.ge/fm/'
FILES = HOST + '%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A2%E1%83%98%E1%83%A1%E1%83%A2%E1%83%98%E1%83%99%E1%83%90/external_sector/eng/'
PUBLISHER = 'National Bank of Georgia (NBG)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
# (source_id, title, URL, local file, content type, retrieval time in UTC). The time is the download's completion time.
SOURCES = [
    ('nbg_gross_external_debt_bpm6', 'ED-6 Gross External Debt (BPM-6)', FILES + 'edbpm6eng.xlsx', 'official/edbpm6eng.xlsx', XLSX, '2026-10-15T10:48:01Z'),
    ('nbg_official_reserve_assets', 'OIR Official Reserve Assets', FILES + 'templatesection-ieng.xlsx', 'official/templatesection-ieng.xlsx', XLSX, '2026-10-15T10:48:04Z'),
    ('nbg_api_category_24', 'NBG file list, category 24 (external sector)', API.format(24), 'official/api-category-24.json', 'application/json', '2026-10-15T10:48:05Z'),
]
FILE = {source_id: local for source_id, _, _, local, _, _ in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'period_end', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']

DEBT_SOURCE, DEBT_SHEET = 'nbg_gross_external_debt_bpm6', 'ED-GEO-Tb1'
RESERVES_SOURCE, RESERVES_SHEET = 'nbg_official_reserve_assets', 'GIR (eng) '
API_CODES = {'ED-6': (DEBT_SOURCE, 'edbpm6eng.xlsx'), 'OIR': (RESERVES_SOURCE, 'templatesection-ieng.xlsx')}
# Debt rows: the first row whose column A reads the label, above the "Memorandum Items" block (the same labels repeat below it).
DEBT = {'ext_debt.total': 'Gross External Debt Position', 'ext_debt.government': 'General Government', 'ext_debt.central_bank': 'Central Bank',
        'ext_debt.banks': 'Deposit-Taking Corporations, except the Central Bank', 'ext_debt.companies': 'Other Sectors',
        'ext_debt.intercompany': 'Direct Investment: Intercompany Lending'}
MEMORANDUM = 'Memorandum Items'
# Reserves columns: (heading row, heading text). The sheet is in thousand USD.
RESERVES = {'reserves.total': (3, 'Official Reserve Assets'), 'reserves.fx': (4, 'Foreign Currency Reserves'), 'reserves.sdr': (4, 'SDRs'),
            'reserves.gold': (4, 'Gold')}
DEBT_YEARS, RESERVES_YEARS, LATEST_YEAR = (2006, 2025), (1995, 2025), 2026
LATEST_PERIOD = {'ext_debt': '2026-06-30', 'reserves': '2026-09-30'}  # The latest period in each archived workbook.
EXPECTED = {**{i: set(range(DEBT_YEARS[0], DEBT_YEARS[1] + 1)) | {LATEST_YEAR} for i in DEBT},
            **{i: set(range(RESERVES_YEARS[0], RESERVES_YEARS[1] + 1)) | {LATEST_YEAR} for i in RESERVES}}
DEBT_PARTS = ('ext_debt.government', 'ext_debt.central_bank', 'ext_debt.banks', 'ext_debt.companies', 'ext_debt.intercompany')
RESERVE_PARTS = ('reserves.fx', 'reserves.gold', 'reserves.sdr')
DEBT_TOLERANCE = Decimal('0.05')  # million USD
RESERVES_RESIDUAL = Decimal('30')  # million USD; the two small parts left out (IMF reserve position, other) fit inside it.
# Values NBG shows in its files, as published (one decimal, million USD). Checked against the archived workbooks, not copied from them.
ANCHORS = {('ext_debt.total', 2025): '27046.9', ('ext_debt.government', 2025): '9202.9', ('reserves.total', 2025): '6159.3',
           ('reserves.total', 1995): '196.2', ('reserves.total', 2026): '8166.9', ('ext_debt.total', 2026): '28166.2'}
EXACT = Context(prec=50)

DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows a stored double to 15 significant digits.


def published(value, places=1):
    """Round half-up from the value as Excel displays it, so 8.4499999999999993 (shown 8.45) publishes as 8.5."""
    return str(DISPLAY.create_decimal(value).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def column_number(letters):
    number = 0
    for letter in letters:
        number = number * 26 + ord(letter) - 64
    return number


@functools.lru_cache(maxsize=None)
def sheet(source_id, name):
    return read_sheet(ROOT / FILE[source_id], name)


def text(cell):
    return '' if cell is None else clean(str(cell['value']))


def to_date(cell):
    if cell is None or cell['kind'] != 'n':
        return None
    return date(1899, 12, 30) + timedelta(days=int(cell['value']))


def number_at(sheet_rows, row, column, what):
    cell = sheet_rows.get(row, {}).get(column)
    if cell is None or cell['kind'] != 'n':
        raise ValueError(f'Expected a number for {what}, found {None if cell is None else cell["value"]!r}')
    return cell


def observation(indicator_id, year, day, value, cell, source_id, source_sheet):
    return {'year': year, 'indicator_id': indicator_id, 'value': value, 'published_value': published(value), 'unit': 'usd_million',
            'period_end': day.isoformat(), 'basis': 'actual', 'value_status': 'official', 'source_id': source_id,
            'source_sheet': source_sheet, 'source_cell': cell['cell']}


def pick_dates(dated, first, last, what):
    """The 31 December of every year in first..last plus the latest date, from {key: date}; each year exactly once."""
    december = {}
    for key, day in dated.items():
        if day.month == 12 and day.day == 31:
            if day.year in december:
                raise ValueError(f'{what}: two 31 December entries in {day.year}')
            december[day.year] = key
    missing = [year for year in range(first, last + 1) if year not in december]
    if missing:
        raise ValueError(f'{what}: no 31 December entry for {missing}')
    latest = max(dated, key=lambda key: dated[key])
    if dated[latest].year != LATEST_YEAR or dated[latest].isoformat() != LATEST_PERIOD[what]:
        raise ValueError(f'{what}: the latest period is {dated[latest]}, expected {LATEST_PERIOD[what]}')
    return {**{year: december[year] for year in range(first, last + 1)}, LATEST_YEAR: latest}


def extract_debt():
    rows = sheet(DEBT_SOURCE, DEBT_SHEET)
    if 'Million of USD' not in text(rows[2].get('A')):
        raise ValueError('Gross external debt is not in million USD')
    memorandum = [n for n, cells in rows.items() if text(cells.get('A')).startswith(MEMORANDUM)]
    if len(memorandum) != 1:
        raise ValueError(f'Expected one {MEMORANDUM!r} heading, found {len(memorandum)}')
    dated = {column: to_date(cell) for column, cell in rows[3].items() if to_date(cell) is not None}
    columns = pick_dates(dated, *DEBT_YEARS, 'ext_debt')
    result = []
    for indicator_id, label in DEBT.items():
        found = [n for n, cells in sorted(rows.items()) if n < memorandum[0] and text(cells.get('A')) == label]
        if not found:
            raise ValueError(f'No row {label!r} above {MEMORANDUM!r}')
        for year, column in columns.items():
            cell = number_at(rows, found[0], column, f'{indicator_id}:{year}')
            result.append(observation(indicator_id, year, dated[column], format(cell['value'], 'f'), cell, DEBT_SOURCE, DEBT_SHEET))
    return result


def extract_reserves():
    rows = sheet(RESERVES_SOURCE, RESERVES_SHEET)
    if 'Thousand USD' not in text(rows[1].get('A')):
        raise ValueError('Official reserve assets are not in thousand USD')
    dated = {number: to_date(cells.get('A')) for number, cells in rows.items() if number >= 5 and to_date(cells.get('A')) is not None}
    if list(dated.values()) != sorted(dated.values()):
        raise ValueError('Reserve rows are not in date order')
    picked = pick_dates(dated, *RESERVES_YEARS, 'reserves')
    result = []
    for indicator_id, (heading_row, label) in RESERVES.items():
        found = [c for c, cell in rows.get(heading_row, {}).items() if text(cell).casefold() == label.casefold()]
        if len(found) != 1:
            raise ValueError(f'Expected one {label!r} heading in row {heading_row}, found {len(found)}')
        for year, number in picked.items():
            cell = number_at(rows, number, found[0], f'{indicator_id}:{year}')
            million = EXACT.normalize(cell['value'].scaleb(-3, EXACT))  # thousand USD to million USD, exactly
            result.append(observation(indicator_id, year, dated[number], format(million, 'f'), cell, RESERVES_SOURCE, RESERVES_SHEET))
    return result


def extract():
    """Every served observation, transcribed from its original cell (reserves converted from thousand to million USD)."""
    return extract_debt() + extract_reserves()


def api_listing():
    """What NBG's category 24 listing says about the two workbooks, checked against the file paths the manifest uses."""
    listing = json.loads((ROOT / FILE['nbg_api_category_24']).read_text(encoding='utf-8'))
    urls = {source_id: url for source_id, _, url, _, _, _ in SOURCES}
    found = {}
    for code, (source_id, name) in API_CODES.items():
        entries = [entry for entry in listing if entry.get('code') == code]
        if len(entries) != 1:
            raise ValueError(f'Expected one {code} entry in the category 24 listing, found {len(entries)}')
        entry = entries[0]
        if unquote(urls[source_id].removeprefix(HOST)) != entry['file'] or not entry['file'].endswith('/' + name):
            raise ValueError(f'The listing path for {code} does not match the manifest URL')
        found[code] = {'title': entry['title'], 'update_date': entry['updateDate'], 'next_update_date': entry['nextUpdateDate']}
    return found


def validate(rows):
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        value = Decimal(row['value'])
        if published(value) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        if row['unit'] != 'usd_million' or value < 0:
            raise ValueError(f'Value outside its range: {key}')
        by_key[key] = (value, row['period_end'])
    expected = {(indicator, year) for indicator, years in EXPECTED.items() for year in years}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')
    for (indicator, year), (_, period_end) in by_key.items():
        family = 'ext_debt' if indicator.startswith('ext_debt.') else 'reserves'
        if period_end != (LATEST_PERIOD[family] if year == LATEST_YEAR else f'{year}-12-31'):
            raise ValueError(f'Unexpected period end: {(indicator, year)} {period_end}')
    v = lambda indicator, year: by_key[(indicator, year)][0]  # noqa: E731
    for year in sorted(EXPECTED['ext_debt.total']):
        if abs(sum(v(part, year) for part in DEBT_PARTS) - v('ext_debt.total', year)) > DEBT_TOLERANCE:
            raise ValueError(f'The five debt groups do not add up to the total: {year}')
    for year in sorted(EXPECTED['reserves.total']):
        if abs(v('reserves.total', year) - sum(v(part, year) for part in RESERVE_PARTS)) > RESERVES_RESIDUAL:
            raise ValueError(f'Total reserves differ from currency, gold and SDRs by more than the residual: {year}')
    for (indicator_id, year), expected_value in ANCHORS.items():
        if published(v(indicator_id, year)) != expected_value:
            raise ValueError(f'The anchor value does not match NBG: {indicator_id} {year}')


def manifest():
    records = []
    for source_id, title, url, local_file, content_type, retrieved_at in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': PAGE,
                        'retrieved_file_url': url, 'resolved_file_url': url, 'retrieved_at': retrieved_at,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def build(check=False):
    rows = sorted(extract(), key=lambda r: (r['indicator_id'], r['year']))
    validate(rows)
    listing = api_listing()
    sources = manifest()
    coverage = defaultdict(list)
    latest = {}
    counts = defaultdict(int)
    for row in rows:
        coverage[row['indicator_id']].append(row['year'])
        latest[row['indicator_id']] = max(latest.get(row['indicator_id'], ''), row['period_end'])
        counts[row['source_id']] += 1
    coverage_rows = [{'indicator_id': i, 'first_year': min(y), 'last_year': max(y), 'observations': len(y), 'latest_period_end': latest[i]}
                     for i, y in sorted(coverage.items())]
    value = lambda indicator, year: next(r for r in rows if r['indicator_id'] == indicator and r['year'] == year)  # noqa: E731
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_DATE,
        'scope': 'Annual research only: gross external debt by sector (BPM6) and official reserve assets; year-end values plus the '
                 'latest period of each workbook; no exchange rates, monthly or quarterly values, interpolation or sums of months, '
                 'serving or published figures beyond the reviewed cells',
        'primary_observation_count': len(rows), 'observations_by_source': dict(sorted(counts.items())),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'published_values_are_rounded_stored_values': True,
            'period_end_is_31_december_except_latest_point': True,
            'debt_groups_add_up_to_total_within_0_05_million_usd': True,
            'reserves_residual_within_30_million_usd': True,
            'reserves_converted_from_thousand_to_million_usd_exactly': True,
            'largest_debt_group_gap_million_usd': format(max(
                abs(sum(Decimal(value(p, y)['value']) for p in DEBT_PARTS) - Decimal(value('ext_debt.total', y)['value']))
                for y in EXPECTED['ext_debt.total']), '.2e'),
            'largest_reserves_residual_million_usd': published(max(
                abs(Decimal(value('reserves.total', y)['value']) - sum(Decimal(value(p, y)['value']) for p in RESERVE_PARTS))
                for y in EXPECTED['reserves.total']), 1),
            'latest_period_end': LATEST_PERIOD, 'api_listing': listing,
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'external-position-annual.csv': csv_bytes(rows, FIELDS),
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
