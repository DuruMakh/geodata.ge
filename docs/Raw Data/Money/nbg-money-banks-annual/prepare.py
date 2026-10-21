"""Reproduce and check the annual money, loans, deposits, interest-rate and bank-health research package.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader and CSV writer are reused from the unemployment package, as the poverty package does.
Every row and column is located by its printed label or by the date or year in column A, never by position.

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
import re
import sys


sys.dont_write_bytecode = True  # Loading the shared reader must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, read_sheet = _shared.clean, _shared.csv_bytes, _shared.read_sheet

RETRIEVED_DATE = '2026-10-11'
PAGE = 'https://nbg.gov.ge/en/statistics/statistics-data'
API = 'https://nbg.gov.ge/gw/api/ct/statistics/categories/{}/data'
FILES = ('https://nbg.gov.ge/fm/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A2%E1%83%98%E1%83%A1%E1%83%A2%E1%83%98%E1%83%99%E1%83%90/')
PUBLISHER = 'National Bank of Georgia (NBG)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
# (source_id, title, URL, local file, content type, retrieval time in UTC). The time is the download's completion time.
SOURCES = [
    ('nbg_money_aggregates', 'M2.1 Money Aggregates and Monetary Ratios', FILES + 'monetary_statistics/eng/money-aggregates-and-monetary-ratioseng.xlsx', 'official/money-aggregates-and-monetary-ratioseng.xlsx', XLSX, '2026-10-11T05:38:45Z'),
    ('nbg_loans_l3_5', 'L3.5 Loans, Granted by Banks (excluding interbank loans; stocks)', FILES + 'loans/eng/loans-to-the-economy-l3-5eng.xlsx', 'official/loans-to-the-economy-l3-5eng.xlsx', XLSX, '2026-10-11T05:38:47Z'),
    ('nbg_deposits_d3_17', 'D3.17 Deposits by Types (stocks)', FILES + 'deposits/eng/depositsinterest-rates-d3-17eng.xlsx', 'official/depositsinterest-rates-d3-17eng.xlsx', XLSX, '2026-10-11T05:38:49Z'),
    ('nbg_deposits_individuals_d3_23', 'D3.23 Deposits of individuals (stocks)', FILES + 'deposits/eng/deposits-of-individuals-d3-23eng.xlsx', 'official/deposits-of-individuals-d3-23eng.xlsx', XLSX, '2026-10-11T05:38:50Z'),
    ('nbg_deposits_legal_d3_27', 'D3.27 Deposits of Legal Entities (stocks)', FILES + 'deposits/eng/deposits-of-legal-entities-d3-27eng.xlsx', 'official/deposits-of-legal-entities-d3-27eng.xlsx', XLSX, '2026-10-11T05:38:52Z'),
    ('nbg_policy_rate', 'MPR Monetary Policy Rate', FILES + 'financial_markets/eng/mpireng.xlsx', 'official/mpireng.xlsx', XLSX, '2026-10-11T05:38:53Z'),
    ('nbg_loan_rates_lwir', 'LWIR Interest Rates on Loans, by Quarters and Years', FILES + 'loans/eng/annual-weighted-loans-interest-rates-lwireng.xlsx', 'official/annual-weighted-loans-interest-rates-lwireng.xlsx', XLSX, '2026-10-11T05:38:54Z'),
    ('nbg_deposit_rates_dwir', 'DWIR Interest Rates on Deposits, by Quarters and Years', FILES + 'deposits/eng/annual-weighted-deposit-interest-rates-dwireng.xlsx', 'official/annual-weighted-deposit-interest-rates-dwireng.xlsx', XLSX, '2026-10-11T05:38:56Z'),
    ('nbg_fsi_archive', 'FSI Financial Soundness Indicators (archive, to 2023 Q2)', FILES + 'archive/fsi/fsieng-archive.xlsx', 'official/fsieng-archive.xlsx', XLSX, '2026-10-11T05:38:57Z'),
    ('nbg_fsi', 'FSI Financial Soundness Indicators (current, monthly from 2022)', FILES + 'monetary_statistics/eng/fsieng.xlsx', 'official/fsieng.xlsx', XLSX, '2026-10-11T05:39:00Z'),
    ('nbg_meth_monetary_statistics', 'Methodology: monetary statistics', FILES + 'monetary_statistics/eng/monetary-statistics-meth-eng.pdf', 'official/monetary-statistics-meth-eng.pdf', 'application/pdf', '2026-10-11T05:39:01Z'),
    ('nbg_meth_loans', 'Methodology: loans', FILES + 'loans/eng/loans-meth-noteseng.pdf', 'official/loans-meth-noteseng.pdf', 'application/pdf', '2026-10-11T05:39:03Z'),
    ('nbg_meth_deposits', 'Methodology: deposits', FILES + 'deposits/eng/deposits-meth-noteseng.pdf', 'official/deposits-meth-noteseng.pdf', 'application/pdf', '2026-10-11T05:39:04Z'),
    ('nbg_meth_interest_rates', 'Methodology: interest rates', FILES + 'financial_markets/eng/interest-rates-methodology-eng.pdf', 'official/interest-rates-methodology-eng.pdf', 'application/pdf', '2026-10-11T05:39:06Z'),
    ('nbg_api_category_15', 'NBG file list, category 15 (monetary statistics)', API.format(15), 'official/api-category-15.json', 'application/json', '2026-10-11T05:39:07Z'),
    ('nbg_api_category_16', 'NBG file list, category 16 (deposits)', API.format(16), 'official/api-category-16.json', 'application/json', '2026-10-11T05:39:07Z'),
    ('nbg_api_category_17', 'NBG file list, category 17 (loans)', API.format(17), 'official/api-category-17.json', 'application/json', '2026-10-11T05:39:09Z'),
    ('nbg_api_category_19', 'NBG file list, category 19 (financial markets)', API.format(19), 'official/api-category-19.json', 'application/json', '2026-10-11T05:39:10Z'),
    ('nbg_api_category_27', 'NBG file list, category 27 (archive)', API.format(27), 'official/api-category-27.json', 'application/json', '2026-10-11T05:39:11Z'),
    ('nbg_statistics_page', 'NBG statistics page (English)', PAGE, 'official/nbg-statistics-page-2026-10-11.html', 'text/html; charset=utf-8', '2026-10-11T05:39:12Z'),
]
FILE = {source_id: local for source_id, _, _, local, _, _ in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']
BREAK_FIELDS = ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note']
# Decimals shown: NBG prints every interest rate to two decimals (cell format 0.00); every other value is rounded to one.
PLACES = {indicator: 2 for indicator in ('rates.policy', 'rates.loans_total', 'rates.loans_gel', 'rates.loans_fx',
                                          'rates.deposits_total', 'rates.deposits_gel', 'rates.deposits_fx')}

MONEY = {'money.m3': 'Money Aggregates (M3)', 'money.m2': 'Money Aggregates (M2)', 'money.m1': 'Money Aggregates (M1)',
         'money.m0': 'Money Outside Banks (M0)'}
# The starred "Monetization Coefficient * (M3)" columns are averages from the beginning of the year, so they are not used.
MONETIZATION = {'money.m3_to_gdp': 'Monetization Coefficient (M3)', 'money.m2_to_gdp': 'Monetization Coefficient (M2)'}
LOANS = {'loans.total': 'Total Loans (including overdue Loans)', 'loans.gel': 'Total Loans (including overdue Loans) in national currency',
         'loans.fx': 'Total Loans (including overdue Loans) in foreign currency'}
RATE_GROUPS = {'Total': 'total', 'National currency': 'gel', 'Foreign currency': 'fx'}
ARCHIVE_SHEET = 'FSI_Deposit_Takers_eng'
# indicator: (required group text or None, row label, archive first year, archive last year)
ARCHIVE_ROWS = {
    'banks.npl_ratio': (None, "Nonperforming loans (by IMF's methodology) to total gross loans", 2003, 2021),
    'banks.roa': (None, 'Return on Assets', 2001, 2021),
    'banks.roe': (None, 'Return on Equity', 2001, 2021),
    'banks.capital_ratio': ('(Basel III)', 'Regulatory capital to risk-weighted assets', 2014, 2021),
    'banks.tier1_ratio': ('(Basel III)', 'Regulatory Tier 1 capital to risk-weighted assets', 2014, 2021)}
CURRENT_ROWS = {
    'banks.npl_ratio': 'Nonperforming loans to total gross loans', 'banks.roa': 'Return on assets', 'banks.roe': 'Return on equity',
    'banks.capital_ratio': 'Regulatory capital to risk-weighted assets', 'banks.tier1_ratio': 'Tier 1 capital to risk-weighted assets'}
CURRENT_YEARS = (2022, 2025)
COVERAGE = {
    **{indicator: (1995, 2025) for indicator in MONEY}, **{indicator: (1996, 2025) for indicator in MONETIZATION},
    'loans.total': (2002, 2025), 'loans.gel': (2002, 2025), 'loans.fx': (2002, 2025), 'loans.fx_share': (2002, 2025),
    'deposits.gel': (1996, 2025), 'deposits.fx': (1996, 2025), 'deposits.total': (1996, 2025), 'deposits.fx_share': (1996, 2025),
    'deposits.individuals': (2002, 2025), 'deposits.legal_entities': (2015, 2025),
    'rates.policy': (2008, 2025),
    **{f'rates.loans_{part}': (1996, 2025) for part in RATE_GROUPS.values()},
    **{f'rates.deposits_{part}': (1996, 2025) for part in RATE_GROUPS.values()},
    'banks.npl_ratio': (2003, 2025), 'banks.roa': (2001, 2025), 'banks.roe': (2001, 2025),
    'banks.capital_ratio': (2014, 2025), 'banks.tier1_ratio': (2014, 2025)}
CALCULATED = ('deposits.total', 'deposits.individuals', 'deposits.legal_entities', 'loans.fx_share', 'deposits.fx_share')
UNITS_PERCENT_UNBOUNDED = ('banks.roa', 'banks.roe')  # May be negative, as they were in 2008.
# Values NBG shows on its statistics page and in its FSI notes, as published (one decimal; two for interest rates).
ANCHORS = {('money.m3', 2025): '57680.2', ('loans.total', 2025): '72453.0', ('rates.policy', 2025): '8.00',
           ('banks.npl_ratio', 2025): '2.5', ('deposits.fx_share', 2025): '48.6', ('loans.fx_share', 2025): '41.9'}
TOLERANCE = Decimal('0.01')
CALC = Context(prec=28)
BREAKS = [
    {'break_id': 'fsi_method_2022', 'applies_to': 'banks.npl_ratio;banks.roe', 'reference_date': '2022-01-01',
     'reason': "Bank-health values to 2021 come from NBG's archive FSI file (quarterly, to 2023Q2) and values from 2022 from the "
               "current FSI file, which says it follows the 2019 FSI methodology. For 2022 the two files agree on capital, Tier 1 "
               "capital and return on assets, but give different values for bad loans (1.7% in the archive, 1.5% in the current file) "
               "and return on equity (30.2% against 24.8%). No change may be computed across this point for those two measures.",
     'source_note': 'Archive FSI_Deposit_Takers_eng, 2022Q4 (Nonperforming loans by IMF\'s methodology 1.66%, Return on Equity 30.21%) '
                    'against current FSD, December 2022 (1.51%, 24.79%). Archive note: "Calculated according to IMF methodology." '
                    'Current file note: "Note: Data is calculated according to the 2019 FSI Methodology."'},
    {'break_id': 'fsi_ifrs_2023', 'applies_to': 'banks.npl_ratio;banks.roa;banks.roe;banks.capital_ratio;banks.tier1_ratio',
     'reference_date': '2023-01-01',
     'reason': 'The current FSI file says its data were reviewed from January 2023 because of the implementation of IFRS. In that file '
               'bad loans move from 1.51% in December 2022 to 3.10% in January 2023 (2.52% in December 2023). No change may be '
               'computed across this point.',
     'source_note': 'Current FSI file, sheet FSD, cell B121: "Due to the implementation of the IFRS, data has been reviewed starting '
                    'from 2023-01." Nonperforming loans to total gross loans, row 20: O20 (2022-12) 1.51%, P20 (2023-01) 3.10%.'}]


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


def locate(sheet_rows, row, label, left_of=None):
    """The one column whose heading in `row` reads `label`, optionally only left of a marker heading `(row, text)`."""
    limit = None
    if left_of is not None:
        marker = [c for c, cell in sheet_rows.get(left_of[0], {}).items() if text(cell).casefold() == left_of[1].casefold()]
        if len(marker) != 1:
            raise ValueError(f'Expected one {left_of[1]!r} heading, found {len(marker)}')
        limit = column_number(marker[0])
    found = [c for c, cell in sheet_rows.get(row, {}).items()
             if text(cell).casefold() == label.casefold() and (limit is None or column_number(c) < limit)]
    if len(found) != 1:
        raise ValueError(f'Expected one {label!r} heading in row {row}, found {len(found)}')
    return found[0]


def december_rows(sheet_rows):
    """Row number of each year's 31 December in a sheet whose column A holds month-end dates."""
    rows = {}
    for number, cells in sheet_rows.items():
        day = to_date(cells.get('A'))
        if day is not None and day.month == 12:
            if day.day != 31 or day.year in rows:
                raise ValueError(f'Unexpected December row {number}: {day}')
            rows[day.year] = number
    return rows


def number_at(sheet_rows, row, column, what):
    cell = sheet_rows.get(row, {}).get(column)
    if cell is None or cell['kind'] != 'n':
        raise ValueError(f'Expected a number for {what}, found {None if cell is None else cell["value"]!r}')
    return cell


def observation(indicator_id, year, cell, source_id, source_sheet, unit):
    value = format(cell['value'], 'f')
    return {'year': year, 'indicator_id': indicator_id, 'value': value,
            'published_value': published(value, PLACES.get(indicator_id, 1)), 'unit': unit, 'basis': 'actual',
            'value_status': 'official', 'source_id': source_id, 'source_sheet': source_sheet, 'source_cell': cell['cell']}


def stock_series(indicator_id, source_id, sheet_name, column_of):
    """December observations of one column of a month-end sheet, over the indicator's coverage."""
    rows = sheet(source_id, sheet_name)
    column, december = column_of(rows), december_rows(rows)
    first, last = COVERAGE[indicator_id]
    return [observation(indicator_id, year, number_at(rows, december[year], column, f'{indicator_id}:{year}'),
                        source_id, sheet_name, 'gel_million') for year in range(first, last + 1)]


def combine(operator, left, right):
    wrap = lambda part: f'({part})' if '+' in part or '/' in part else part  # noqa: E731
    return f'{wrap(left)}{operator}{wrap(right)}'


def calculated(indicator_id, year, value, source_id, unit, sheet_ref, cell_ref):
    value = value.normalize()  # drops the trailing zeros that decimal addition keeps
    return {'year': year, 'indicator_id': indicator_id, 'value': format(value, 'f'),
            'published_value': published(value, PLACES.get(indicator_id, 1)), 'unit': unit, 'basis': 'actual',
            'value_status': 'calculated', 'source_id': source_id, 'source_sheet': sheet_ref, 'source_cell': cell_ref}


def sheet_ref(operator, left, right):
    return left if left == right else combine(operator, left, right)


def add_pair(indicator_id, source_id, lari, foreign):
    """Lari plus foreign-currency amounts, year by year, as one calculated series."""
    foreign_by_year = {row['year']: row for row in foreign}
    return [calculated(indicator_id, row['year'], CALC.add(Decimal(row['value']), Decimal(foreign_by_year[row['year']]['value'])),
                       source_id, 'gel_million', sheet_ref('+', row['source_sheet'], foreign_by_year[row['year']]['source_sheet']),
                       combine('+', row['source_cell'], foreign_by_year[row['year']]['source_cell'])) for row in lari]


def share(indicator_id, source_id, foreign, total):
    total_by_year = {row['year']: row for row in total}
    rows = []
    for row in foreign:
        whole = total_by_year[row['year']]
        value = CALC.divide(CALC.multiply(Decimal(row['value']), Decimal(100)), Decimal(whole['value']))
        rows.append(calculated(indicator_id, row['year'], value, source_id, 'percent',
                               sheet_ref('/', row['source_sheet'], whole['source_sheet']),
                               combine('/', row['source_cell'], whole['source_cell'])))
    return rows


def extract_money():
    rows = []
    source_id, name = 'nbg_money_aggregates', 'Monetary Ratios-eng'
    sheet_rows = sheet(source_id, name)
    if 'Million GEL' not in text(sheet_rows[1]['A']):
        raise ValueError('Money aggregates are not in million GEL')
    for indicator_id, label in {**MONEY, **MONETIZATION}.items():
        unit = 'percent' if indicator_id in MONETIZATION else 'gel_million'
        column, december = locate(sheet_rows, 3, label), december_rows(sheet_rows)
        first, last = COVERAGE[indicator_id]
        rows += [observation(indicator_id, year, number_at(sheet_rows, december[year], column, f'{indicator_id}:{year}'),
                             source_id, name, unit) for year in range(first, last + 1)]
    return rows


def extract_loans():
    source_id, name = 'nbg_loans_l3_5', 'Eng'

    def column_of(label):
        def find(rows):
            column = locate(rows, 3, label)
            if not any(text(rows.get(row, {}).get(column)) == 'Total' for row in (4, 5)):
                raise ValueError(f'No "Total" sub-heading under {label!r}')
            return column
        return find

    loans = {indicator_id: stock_series(indicator_id, source_id, name, column_of(label)) for indicator_id, label in LOANS.items()}
    return [row for series in loans.values() for row in series] + share('loans.fx_share', source_id, loans['loans.fx'], loans['loans.total'])


def extract_deposits():
    rows = []
    d317 = ('NC Dep.volume&Int.rates-eng', 'FC Dep.volume&Int.rates-eng')
    source_id = 'nbg_deposits_d3_17'
    for part, name in zip(('gel', 'fx'), d317):
        sheet_rows = sheet(source_id, name)
        if text(sheet_rows[3]['B']) != 'Million GEL':
            raise ValueError('Deposits are not in million GEL')
        rows += stock_series(f'deposits.{part}', source_id, name,
                             lambda r: locate(r, 4, 'Deposits, Total', left_of=(3, 'Annual Interest Rates, %')))
    by_id = defaultdict(list)
    for row in rows:
        by_id[row['indicator_id']].append(row)
    total = add_pair('deposits.total', source_id, by_id['deposits.gel'], by_id['deposits.fx'])

    source_id = 'nbg_deposits_individuals_d3_23'
    names = ('NC Dep.of Individuals-eng', 'FC Dep.of Individuals-eng')
    parts = [stock_series('deposits.individuals', source_id, name, lambda r: locate(r, 4, 'Deposits, total', left_of=(3, 'Interest Rates, %')))
             for name in names]
    individuals = add_pair('deposits.individuals', source_id, *parts)

    source_id = 'nbg_deposits_legal_d3_27'
    parts = [stock_series('deposits.legal_entities', source_id, name, lambda r: locate(r, 3, 'Total Deposits')) for name in ('NC', 'FC')]
    legal = add_pair('deposits.legal_entities', source_id, *parts)
    fx_share = share('deposits.fx_share', 'nbg_deposits_d3_17', by_id['deposits.fx'], total)
    return rows + total + individuals + legal + fx_share


def extract_policy_rate():
    source_id, name = 'nbg_policy_rate', 'MPIR-Eng'
    sheet_rows = sheet(source_id, name)
    if [text(sheet_rows[2].get(c)) for c in 'ABC'] != ['Date of Decision', 'Date of Enforcement', 'Interest Rates, %']:
        raise ValueError('Unexpected policy rate headings')
    decisions = sorted(((to_date(cells.get('B')), number) for number, cells in sheet_rows.items() if to_date(cells.get('B'))))
    if [number for _, number in decisions] != sorted(number for _, number in decisions):
        raise ValueError('Policy rate rows are not in date order')
    rows = []
    for year in range(COVERAGE['rates.policy'][0], COVERAGE['rates.policy'][1] + 1):
        in_force = [number for day, number in decisions if day <= date(year, 12, 31)]
        rows.append(observation('rates.policy', year, number_at(sheet_rows, in_force[-1], 'C', f'policy rate {year}'),
                                source_id, name, 'percent'))
    return rows


def extract_interest_rates():
    rows = []
    for prefix, source_id, name in (('loans', 'nbg_loan_rates_lwir', 'loans % Annual'), ('deposits', 'nbg_deposit_rates_dwir', 'Dep %-Annual')):
        sheet_rows = sheet(source_id, name)
        years = {int(text(cells['A'])): number for number, cells in sheet_rows.items()
                 if 'A' in cells and re.fullmatch(r'\d{4}', text(cells['A']))}
        for label, part in RATE_GROUPS.items():
            column = locate(sheet_rows, 3, label)
            if text(sheet_rows[4][column]).casefold() != 'total':
                raise ValueError(f'No "total" sub-heading under {label!r}')
            indicator_id = f'rates.{prefix}_{part}'
            first, last = COVERAGE[indicator_id]
            rows += [observation(indicator_id, year, number_at(sheet_rows, years[year], column, f'{indicator_id}:{year}'),
                                 source_id, name, 'percent') for year in range(first, last + 1)]
    return rows


def archive_rows(indicator_id):
    """Row of an archive indicator, found by its group heading (carried down column B) and its label in column C."""
    sheet_rows = sheet('nbg_fsi_archive', ARCHIVE_SHEET)
    group_text, label, _, _ = ARCHIVE_ROWS[indicator_id]
    group, found = '', []
    for number in sorted(sheet_rows):
        cells = sheet_rows[number]
        if 'B' in cells:
            group = text(cells['B'])
        if text(cells.get('C')) == label and (group_text is None or group_text in group):
            found.append(number)
    if len(found) != 1:
        raise ValueError(f'Expected one archive row for {indicator_id}, found {len(found)}')
    return sheet_rows, found[0]


def archive_columns(sheet_rows, pattern):
    return {int(match.group(1)): column for column, cell in sheet_rows[3].items()
            if (match := re.fullmatch(pattern, text(cell)))}


def extract_banks():
    rows = []
    archive_quarters = lambda sheet_rows: archive_columns(sheet_rows, r'(\d{4})Q4')  # noqa: E731
    for indicator_id, (_, _, first, last) in ARCHIVE_ROWS.items():
        sheet_rows, number = archive_rows(indicator_id)
        columns = archive_quarters(sheet_rows)
        rows += [observation(indicator_id, year, number_at(sheet_rows, number, columns[year], f'archive {indicator_id}:{year}'),
                             'nbg_fsi_archive', ARCHIVE_SHEET, 'percent') for year in range(first, last + 1)]
    sheet_rows = sheet('nbg_fsi', 'FSD')
    december = {to_date(cell).year: column for column, cell in sheet_rows[3].items()
                if to_date(cell) and to_date(cell).month == 12 and to_date(cell).day == 31}
    for indicator_id, label in CURRENT_ROWS.items():
        found = [number for number, cells in sheet_rows.items() if text(cells.get('B')) == label and text(cells.get('C')) == 'Percent']
        if len(found) != 1:
            raise ValueError(f'Expected one current row for {indicator_id}, found {len(found)}')
        rows += [observation(indicator_id, year, number_at(sheet_rows, found[0], december[year], f'current {indicator_id}:{year}'),
                             'nbg_fsi', 'FSD', 'percent') for year in range(CURRENT_YEARS[0], CURRENT_YEARS[1] + 1)]
    return rows


def fsi_overlap():
    """The archive's 2022 quarter-4 value of each bank-health measure, to compare with the current file's December 2022."""
    overlap = {}
    for indicator_id in ARCHIVE_ROWS:
        sheet_rows, number = archive_rows(indicator_id)
        cell = number_at(sheet_rows, number, archive_columns(sheet_rows, r'(\d{4})Q4')[2022], f'archive overlap {indicator_id}')
        overlap[indicator_id] = {'value': cell['value'], 'cell': cell['cell']}
    return overlap


def extract():
    """Every served observation: transcribed from its original cell, or calculated from transcribed cells."""
    return (extract_money() + extract_loans() + extract_deposits() + extract_policy_rate() + extract_interest_rates()
            + extract_banks())


def validate(rows):
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        value = Decimal(row['value'])
        if published(value, PLACES.get(row['indicator_id'], 1)) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        if row['unit'] == 'percent' and row['indicator_id'] not in UNITS_PERCENT_UNBOUNDED and not Decimal(0) <= value <= Decimal(100):
            raise ValueError(f'Value outside its range: {key}')
        if row['unit'] == 'gel_million' and value < 0:
            raise ValueError(f'Value outside its range: {key}')
        by_key[key] = value
    expected = {(indicator, year) for indicator, (first, last) in COVERAGE.items() for year in range(first, last + 1)}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')
    v = lambda indicator, year: by_key[(indicator, year)]  # noqa: E731
    for year in range(COVERAGE['deposits.total'][0], COVERAGE['deposits.total'][1] + 1):
        if CALC.add(v('deposits.gel', year), v('deposits.fx', year)) != v('deposits.total', year):
            raise ValueError(f'The calculated deposit total is not lari plus foreign currency: {year}')
    for prefix, first in (('loans', 2002), ('deposits', 1996)):
        for year in range(first, 2026):
            if CALC.divide(CALC.multiply(v(f'{prefix}.fx', year), Decimal(100)), v(f'{prefix}.total', year)) != v(f'{prefix}.fx_share', year):
                raise ValueError(f'The calculated {prefix} share is not foreign currency over total: {year}')
            if abs(v(f'{prefix}.gel', year) + v(f'{prefix}.fx', year) - v(f'{prefix}.total', year)) > TOLERANCE:
                raise ValueError(f'{prefix} lari plus foreign currency differs from the total: {year}')
    for year in range(2015, 2026):
        if abs(v('deposits.individuals', year) + v('deposits.legal_entities', year) - v('deposits.total', year)) > TOLERANCE:
            raise ValueError(f'Deposits of people plus companies differ from all deposits: {year}')
    for year in range(1995, 2026):
        if not v('money.m0', year) <= v('money.m1', year) <= v('money.m2', year) <= v('money.m3', year):
            raise ValueError(f'Money aggregates out of order (M0 <= M1 <= M2 <= M3): {year}')
    overlap = {i: published(o['value'], 1) for i, o in fsi_overlap().items()}
    for indicator_id, old in overlap.items():
        new = published(v(indicator_id, 2022), 1)
        same = old == new
        if same != (indicator_id not in BREAKS[0]['applies_to'].split(';')):
            raise ValueError(f'FSI 2022 overlap disagrees with the recorded break: {indicator_id} {old} against {new}')
    for (indicator_id, year), expected_value in ANCHORS.items():
        if published(v(indicator_id, year), PLACES.get(indicator_id, 1)) != expected_value:
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
    sources = manifest()
    coverage = defaultdict(list)
    counts = defaultdict(int)
    for row in rows:
        coverage[row['indicator_id']].append(row['year'])
        counts[row['source_id']] += 1
    coverage_rows = [{'indicator_id': i, 'first_year': min(y), 'last_year': max(y), 'observations': len(y)}
                     for i, y in sorted(coverage.items())]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_DATE,
        'scope': 'Annual research only: money aggregates, bank loans and deposits, interest rates and bank-health measures; '
                 'no exchange rates, monthly or quarterly values, serving or published figures beyond the reviewed cells',
        'primary_observation_count': len(rows), 'observations_by_source': dict(sorted(counts.items())),
        'imputed_values': 0, 'calculated_values': sum(r['value_status'] == 'calculated' for r in rows),
        'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'published_values_are_rounded_stored_values': True,
            'lari_plus_foreign_equals_total': True, 'people_plus_companies_equals_all_deposits_2015_2025': True,
            'money_aggregates_in_order': True, 'percentages_within_0_100_except_roa_roe': True,
            'fsi_2022_overlap': {i: {'archive_2022q4': published(o['value'], 1), 'archive_cell': o['cell']} for i, o in fsi_overlap().items()},
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'money-banks-annual.csv': csv_bytes(rows, FIELDS),
        'money-banks-series-breaks.csv': csv_bytes(BREAKS, BREAK_FIELDS),
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
