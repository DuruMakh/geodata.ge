"""Reproduce and check the annual Geostat ICT household survey research package.

Reads the preserved .xlsx files in official/ with the shared worksheet reader of the unemployment package, as the business,
housing and household packages do. Never downloads sources or serves product data. Every column is found by its printed
heading and every row by its printed year and label, never by position.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
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

RETRIEVED_DATE = '2026-10-20'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
PAGE = 'https://www.geostat.ge/en/modules/categories/106/ict-usage-in-households'
PAGE_KA = 'https://www.geostat.ge/ka/modules/categories/106'

# (table, English source id, English title, English file, Georgian file). The English file of table N is media 82415 + N and
# the Georgian one media 82398 + N. Table 16's English file name ends in "inter....xlsx" on Geostat and is saved shorter here.
TABLES = [
    ('01', 'geostat_ict_homes_internet', 'Share of households with internet access',
     '01_Share_of_households_with_internet_access.xlsx', '01_internetit_uzrunvelyopili_shinameurneobebi.xlsx'),
    ('02', 'geostat_ict_last_internet_use', 'Distribution of population aged 6 and older by last internet use',
     '02_Distribution_of_population_aged_6_and_older_by_last_internet_use.xlsx', '02_internetis_gamoyenebis_periodi.xlsx'),
    ('03', 'geostat_ict_purposes', 'Share of population aged 15 and older by purposes of internet use',
     '03_Share_of_population_aged_15_and_older_by_purposes_of_internet_use.xlsx', '03_internetis_gamoyenebis_miznebi.xlsx'),
    ('04', 'geostat_ict_internet_frequency', 'Frequency of internet use',
     '04_Frequency_of_internet_use.xlsx', '04_internetis_gamoyenebis_sixshire.xlsx'),
    ('05', 'geostat_ict_ecommerce', 'E-commerce', '05_E-Commerce.xlsx', '05_E-komercia.xlsx'),
    ('06', 'geostat_ict_mobile_internet', 'Using mobile devices to access the internet',
     '06_Using_mobile_devices_to_access_the_internet.xlsx', '06_mobiluri_mowyobilobebis_gamoyeneba_internettan_wvdomistvis.xlsx'),
    ('07', 'geostat_ict_internet_activities', 'Internet related activities',
     '07_Internet_related_activities.xlsx', '07_internetit_ganxorcielebuli_aktivobebi.xlsx'),
    ('08', 'geostat_ict_homes_computer', 'Share of households with computer access',
     '08_Share_of_households_with_computer_access.xlsx', '08_kompiuterit_uzrunvelyopili_shinameurneobebi.xlsx'),
    ('09', 'geostat_ict_last_computer_use', 'Distribution of population aged 6 and older by last computer use',
     '09_Distribution_of_population_aged_6_and_older_by_last_computer_use.xlsx', '09_kompiuteris_gamoyenebis_periodi.xlsx'),
    ('10', 'geostat_ict_computer_frequency', 'Frequency of computer use',
     '10_Frequency_of_computer_use.xlsx', '10_kompiuteris_gamoyenebis_sixshire.xlsx'),
    ('11', 'geostat_ict_software_activities', 'Software related activities',
     '11_Software_related_activities.xlsx', '11_programul_uzrunvelyopastan_dakavshirebuli_aktivobebi.xlsx'),
    ('12', 'geostat_ict_own_mobile', 'Share of population aged 6 and older who own mobile phone',
     '12_Share_of_population_aged_6_and_older_who_own_mobile_phone.xlsx', '12_mobiluri_telefonis_ploba.xlsx'),
    ('13', 'geostat_ict_use_mobile', 'Share of population aged 6 and older who uses mobile phone',
     '13_Share_of_population_aged_6_and_older_who_uses_mobile_phone.xlsx', '13_mobiluri_telefonis_gamoyeneba.xlsx'),
    ('14', 'geostat_ict_own_smartphone', 'Share of population aged 6 and older who own smartphone',
     '14_Share_of_population_aged_6_and_older_who_own_smartphone.xlsx', '14_smartfonis_ploba.xlsx'),
    ('15', 'geostat_ict_use_smartphone', 'Share of population aged 6 and older who uses smartphone',
     '15_Share_of_population_aged_6_and_older_who_uses_smartphone.xlsx', '15_smartfonis_gamoyeneba.xlsx'),
    ('16', 'geostat_ict_public_services', 'Interaction with public authorities or public services over the internet',
     '16_Interaction_with_public_authorities_over_the_internet.xlsx', '16_saxelmwifo_martvis_organoebtan_urtiertoba.xlsx'),
    ('17', 'geostat_ict_skills', 'ICT skills', '17_ICT_skills.xlsx', '17_cifruli_unarebi.xlsx'),
]
ONLINE_NAME_16 = '16_Interaction_with_public_authorities_or_public_services_over_the_inter....xlsx'
RETRIEVED = {
    '01': ('2026-10-20T05:40:34Z', '2026-10-20T05:41:05Z'), '02': ('2026-10-20T05:40:36Z', '2026-10-20T05:41:06Z'),
    '03': ('2026-10-20T05:40:38Z', '2026-10-20T05:41:08Z'), '04': ('2026-10-20T05:40:40Z', '2026-10-20T05:41:09Z'),
    '05': ('2026-10-20T05:40:41Z', '2026-10-20T05:41:11Z'), '06': ('2026-10-20T05:40:43Z', '2026-10-20T05:41:13Z'),
    '07': ('2026-10-20T05:40:44Z', '2026-10-20T05:41:15Z'), '08': ('2026-10-20T05:40:46Z', '2026-10-20T05:41:16Z'),
    '09': ('2026-10-20T05:40:48Z', '2026-10-20T05:41:18Z'), '10': ('2026-10-20T05:40:49Z', '2026-10-20T05:41:19Z'),
    '11': ('2026-10-20T05:40:51Z', '2026-10-20T05:41:21Z'), '12': ('2026-10-20T05:40:53Z', '2026-10-20T05:41:23Z'),
    '13': ('2026-10-20T05:40:54Z', '2026-10-20T05:41:24Z'), '14': ('2026-10-20T05:40:56Z', '2026-10-20T05:41:25Z'),
    '15': ('2026-10-20T05:41:02Z', '2026-10-20T05:41:27Z'), '16': ('2026-10-20T05:41:03Z', '2026-10-20T05:41:28Z'),
    '17': ('2026-10-20T05:41:00Z', '2026-10-20T05:41:30Z'),
}


def _sources():
    rows = []
    for table, source_id, title, english, georgian in TABLES:
        en_at, ka_at = RETRIEVED[table]
        en_url = f'https://geostat.ge/media/{82415 + int(table)}/{ONLINE_NAME_16 if table == "16" else english}'
        ka_url = f'https://geostat.ge/media/{82398 + int(table)}/{georgian}'
        rows.append((source_id, f'{title} (table {table})', PAGE, en_url, en_url.replace('//geostat', '//www.geostat'),
                     f'official/{english}', XLSX, en_at))
        rows.append((f'{source_id}_ka', f'{title} (table {table}), Georgian edition', PAGE_KA, ka_url,
                     ka_url.replace('//geostat', '//www.geostat'), f'official/ka/{georgian}', XLSX, ka_at))
    rows.append(('geostat_ict_page', 'Geostat page: ICT usage in households (category 106)', PAGE,
                 'https://www.geostat.ge/en/modules/categories/106', PAGE, 'official/geostat-category-106-2026-10-20.html', HTML,
                 '2026-10-20T05:41:31Z'))
    rows.append(('geostat_ict_page_ka', 'Geostat page: ICT usage in households, Georgian (category 106)', PAGE_KA,
                 'https://www.geostat.ge/ka/modules/categories/106', PAGE_KA, 'official/ka/geostat-category-106-ka-2026-10-20.html',
                 HTML, '2026-10-20T05:41:33Z'))
    return rows


# (source_id, title, page, URL, resolved URL, local file, content type, retrieval time in UTC).
SOURCES = _sources()
FILE = {source[0]: source[5] for source in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']

FIRST_YEAR, LAST_YEAR = 2016, 2026
SMARTPHONE_FIRST_YEAR, REGION_SAMPLE_YEAR = 2019, 2020
YEARS = range(FIRST_YEAR, LAST_YEAR + 1)
DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows a stored double to 15 significant digits.
UNAVAILABLE = ('…', '...', 'x')
TOLERANCE = Decimal('0.01')  # Shares that must close to 100, and brackets, are checked within this many points.

REGION_IDS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
              'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
              'region_kvemo_kartli', 'region_shida_kartli']
# Regions Geostat could publish only once the sample was enlarged in 2020; their earlier cells print "…".
LATE_REGIONS = {'region_kvemo_kartli', 'region_samtskhe_javakheti', 'region_guria', 'region_mtskheta_mtianeti',
                'region_racha_lechkhumi_kvemo_svaneti'}
HOME_COLUMNS = {
    'Georgia': 'total', 'Urban': 'urban', 'Rural': 'rural', 'Kakheti': 'region_kakheti', 'Tbilisi': 'region_tbilisi',
    'Shida Kartli': 'region_shida_kartli', 'Kvemo Kartli': 'region_kvemo_kartli', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
    'Adjara A.R.': 'region_adjara', 'Guria': 'region_guria', 'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti',
    'Imereti': 'region_imereti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
    'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti', 'Other regions': None}
PEOPLE_COLUMNS = {
    'Total': 'total', 'Urban': 'urban', 'Rural': 'rural', 'Female': 'female', 'Male': 'male', '6-14 years': 'age_6_14',
    '15 years and older': None, '15-29 years': 'age_15_29', '30-59 years': 'age_30_59', '60 years and older': 'age_60_plus'}
PEOPLE_GROUPS = ['total', 'urban', 'rural', 'female', 'male', 'age_6_14', 'age_15_29', 'age_30_59', 'age_60_plus']
ADULT_GROUPS = [group for group in PEOPLE_GROUPS if group != 'age_6_14']
HOME_GROUPS = ['total', 'urban', 'rural', *REGION_IDS]

LAST_USE = {'Within last 3 months': '3m', 'More than 3 months ago': 'earlier', 'Never used': 'never'}
FREQUENCY = {'Every day or almost every day': 'daily', 'At least once a week': 'weekly', 'Less than once a week': 'rarely'}
PURPOSES = {
    'Participating in social networks': 'activity_social', 'Reading online news sites/newspapers/news magazines': 'activity_news',
    'Sending/receiving e-mails': 'activity_email',
    'Telephoning over the internet/video calls (via webcam) over the internet': 'activity_calls',
    'Seeking health-related information': 'activity_health', 'Finding information about goods or services': 'activity_goods_info',
    'Looking for a job or sending a job application': 'activity_jobs', 'Internet Banking': 'activity_banking',
    'Downloading software (other than games software)': 'activity_software'}
PUBLIC_SERVICES = {
    'Interacted over the internet': 'egov_any', 'Obtaining information from websites of public authorities': 'egov_info',
    'Downloading official forms': 'egov_download_forms', 'Submitting completed forms': 'egov_submit_forms',
    'Did not interact over the internet': 'egov_none'}

# What each served table holds. `rows` maps a printed row label to a key (a table with one row per year has none); `served`
# maps a key to the measure it serves (the other keys are read for the checks only); `columns` and `groups` say which
# group columns exist and which are served.
LAYOUT = {
    'geostat_ict_homes_internet': {'columns': HOME_COLUMNS, 'rows': None, 'served': {None: 'homes_internet'}, 'groups': HOME_GROUPS},
    'geostat_ict_homes_computer': {'columns': HOME_COLUMNS, 'rows': None, 'served': {None: 'homes_computer'}, 'groups': HOME_GROUPS},
    'geostat_ict_last_internet_use': {'columns': PEOPLE_COLUMNS, 'rows': LAST_USE, 'served': {'3m': 'used_3m', 'never': 'never_used'},
                                      'groups': PEOPLE_GROUPS},
    'geostat_ict_internet_frequency': {'columns': PEOPLE_COLUMNS, 'rows': FREQUENCY, 'served': {'daily': 'daily'}, 'groups': ADULT_GROUPS},
    'geostat_ict_ecommerce': {'columns': PEOPLE_COLUMNS, 'rows': None, 'served': {None: 'bought_online'}, 'groups': ADULT_GROUPS},
    'geostat_ict_purposes': {'columns': PEOPLE_COLUMNS, 'rows': PURPOSES, 'served': {m: m for m in PURPOSES.values()}, 'groups': ['total']},
    'geostat_ict_public_services': {'columns': PEOPLE_COLUMNS, 'rows': PUBLIC_SERVICES,
                                    'served': {m: m for m in PUBLIC_SERVICES.values() if m != 'egov_none'}, 'groups': ['total']},
    'geostat_ict_own_mobile': {'columns': PEOPLE_COLUMNS, 'rows': None, 'served': {None: 'own_mobile'}, 'groups': PEOPLE_GROUPS},
    'geostat_ict_own_smartphone': {'columns': PEOPLE_COLUMNS, 'rows': None, 'served': {None: 'own_smartphone'}, 'groups': PEOPLE_GROUPS},
    'geostat_ict_last_computer_use': {'columns': PEOPLE_COLUMNS, 'rows': LAST_USE, 'served': {'3m': 'computer_3m'}, 'groups': PEOPLE_GROUPS},
}
SERVED = list(LAYOUT)
# Tables on people aged 15 and older, which print no 6-14 column (the purposes and public-services rows serve Everyone only).
ADULT_TABLES = {'geostat_ict_internet_frequency', 'geostat_ict_ecommerce', 'geostat_ict_purposes', 'geostat_ict_public_services'}
# Measures in the order the serving file lists them (the pages' order).
MEASURES = ['homes_internet', 'homes_computer', 'used_3m', 'never_used', 'daily', 'bought_online', *PURPOSES.values(),
            *[m for m in PUBLIC_SERVICES.values() if m != 'egov_none'], 'own_mobile', 'own_smartphone', 'computer_3m']
MEASURE_SOURCE = {measure: source_id for source_id, layout in LAYOUT.items() for measure in layout['served'].values()}

# Values Geostat prints, as published (one decimal).
ANCHORS = {('internet.homes_internet.total', 2016): '70.1', ('internet.homes_internet.total', 2026): '93.5',
           ('internet.homes_internet.region_tbilisi', 2026): '98.2', ('internet.homes_internet.rural', 2026): '89.0',
           ('internet.homes_internet.region_guria', 2026): '91.1', ('internet.used_3m.total', 2026): '89.6',
           ('internet.bought_online.total', 2026): '38.6', ('internet.bought_online.age_15_29', 2026): '63.0',
           ('internet.activity_banking.total', 2026): '61.0', ('internet.own_mobile.total', 2026): '93.3'}


def published(value, places=1):
    """Round half-up from the value as Excel displays it (15 significant digits), so 93.34998070175611 publishes as 93.3."""
    return str(DISPLAY.create_decimal(value).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def text(cell):
    return '' if cell is None else clean(str(cell['value']))


def token(cell):
    """The shortest number text that reads back as the stored double, without a trailing .0: the same text SheetJS gives."""
    if cell is None or cell['kind'] != 'n':
        raise ValueError(f'Expected a number, found {None if cell is None else cell["value"]!r} in {None if cell is None else cell["cell"]}')
    shown = format(Decimal(repr(float(cell['value']))), 'f')
    return shown[:-2] if shown.endswith('.0') else shown


@functools.lru_cache(maxsize=None)
def sheet(source_id):
    """{row number: {column letters: {'value', 'cell', 'kind', 'format'}}} of the table's one sheet, named "1"."""
    return {number: {column: dict(cell) for column, cell in cells.items()} for number, cells in read_sheet(ROOT / FILE[source_id], '1').items()}


def year_of(label):
    """The survey year of a first-column label such as "June, 2016" or "June, 2016*"; None for anything else."""
    match = re.fullmatch(r'(June|July), (\d{4})\*?', label)
    return int(match.group(2)) if match else None


@functools.lru_cache(maxsize=None)
def table(source_id):
    """(sheet name, {column: group or None}, [(year, key, row number)]) of a served table. Columns are matched by their
    printed heading, with Geostat's footnote stars removed; every row up to the first note belongs to a year and a label."""
    layout, rows = LAYOUT[source_id], sheet(source_id)
    headers = [n for n, cells in rows.items() if any(text(cell).rstrip('*') in ('Total', 'Georgia') for cell in cells.values())]
    if len(headers) != 1:
        raise ValueError(f'Expected one heading row in {source_id}, found {headers}')
    header = headers[0]
    columns = {}
    for column, cell in rows[header].items():
        label = text(cell).rstrip('*').strip()
        if not label:
            continue
        if label not in layout['columns']:
            raise ValueError(f'Unexpected heading {label!r} in {source_id}')
        columns[column] = layout['columns'][label]
    present = HOME_GROUPS if layout['columns'] is HOME_COLUMNS else ADULT_GROUPS if source_id in ADULT_TABLES else PEOPLE_GROUPS
    if sorted(g for g in columns.values() if g) != sorted(present):
        raise ValueError(f'Unexpected group columns in {source_id}: {sorted(columns.values(), key=str)}')
    entries, year = [], None
    for number in sorted(n for n in rows if n > header):
        first = text(rows[number].get('A'))
        if first.startswith(('Note', 'Notice', '*', '…')):
            break
        if first:
            year = year_of(first)
            if year is None:
                raise ValueError(f'Unexpected year label {first!r} in {source_id} row {number}')
        if layout['rows'] is None:
            key = None
        else:
            label = text(rows[number].get('B'))
            if label not in layout['rows']:
                raise ValueError(f'Unexpected row label {label!r} in {source_id} row {number}')
            key = layout['rows'][label]
        entries.append((year, key, number))
    seen = [(year, key) for year, key, _ in entries]
    if len(seen) != len(set(seen)):
        raise ValueError(f'A year and row are printed twice in {source_id}')
    first_year = SMARTPHONE_FIRST_YEAR if source_id == 'geostat_ict_own_smartphone' else FIRST_YEAR
    keys = list(layout['rows'].values()) if layout['rows'] else [None]
    if sorted(seen, key=str) != sorted([(y, k) for y in range(first_year, LAST_YEAR + 1) for k in keys], key=str):
        raise ValueError(f'Unexpected years or rows in {source_id}')
    return '1', columns, entries


def cells(source_id):
    """{(key, group, year): cell} for every group column of a served table, unavailable cells included as text."""
    _, columns, entries = table(source_id)
    rows = sheet(source_id)
    return {(key, group, year): rows[number].get(column) for year, key, number in entries for column, group in columns.items() if group}


def expected_years(measure, group):
    if measure == 'own_smartphone':
        return range(SMARTPHONE_FIRST_YEAR, LAST_YEAR + 1)
    if measure.startswith('homes_') and group in LATE_REGIONS:
        return range(REGION_SAMPLE_YEAR, LAST_YEAR + 1)
    return YEARS


def extract():
    """Every served observation, transcribed from its original cell. A cell Geostat left unavailable must be one the
    coverage rules expect to be missing, and produces no row."""
    rows = []
    for source_id, layout in LAYOUT.items():
        found = cells(source_id)
        for (key, group, year), cell in found.items():
            measure = layout['served'].get(key)
            if measure is None or group not in layout['groups']:
                continue
            missing = cell is None or (cell['kind'] != 'n' and text(cell) in UNAVAILABLE)
            if missing != (year not in expected_years(measure, group)):
                raise ValueError(f'Unexpected {"gap" if missing else "value"} for {measure} {group} {year} in {source_id}')
            if missing:
                continue
            rows.append({'year': year, 'indicator_id': f'internet.{measure}.{group}', 'value': token(cell),
                         'published_value': published(token(cell)), 'unit': 'percent', 'basis': 'actual',
                         'value_status': 'survey_estimate', 'source_id': source_id, 'source_sheet': '1', 'source_cell': cell['cell']})
    return rows


def expected_keys():
    keys = set()
    for source_id, layout in LAYOUT.items():
        for measure in layout['served'].values():
            for group in layout['groups']:
                keys |= {(f'internet.{measure}.{group}', year) for year in expected_years(measure, group)}
    return keys


def number(cell):
    return Decimal(token(cell))


def shares_close():
    """Within TOLERANCE, the rows of a distribution add up to 100 for every group and year: last internet and computer use
    (within 3 months, earlier, never), frequency of internet use, and contact with public services online (did or did not).
    Returns the number of sums checked."""
    checked = 0
    for source_id, parts in (('geostat_ict_last_internet_use', LAST_USE.values()), ('geostat_ict_last_computer_use', LAST_USE.values()),
                             ('geostat_ict_internet_frequency', FREQUENCY.values()), ('geostat_ict_public_services', ('egov_any', 'egov_none'))):
        found = cells(source_id)
        for group in {g for _, g, _ in found}:
            for year in YEARS:
                total = sum(number(found[(key, group, year)]) for key in parts)
                if abs(total - 100) > TOLERANCE:
                    raise ValueError(f'The shares of {source_id} for {group} in {year} add up to {total}, not 100')
                checked += 1
    return checked


def check_brackets(values):
    """Every year, Everyone lies between Women and Men and between Towns and Villages, as Georgia's homes do between towns
    and villages (within TOLERANCE). Returns the number of brackets checked."""
    checked = 0
    for (indicator_id, year), value in values.items():
        prefix, measure, group = indicator_id.split('.')
        if group != 'total':
            continue
        for low, high in (('female', 'male'), ('urban', 'rural')):
            pair = [values.get((f'{prefix}.{measure}.{g}', year)) for g in (low, high)]
            if None in pair:
                continue
            if not min(pair) - TOLERANCE <= value <= max(pair) + TOLERANCE:
                raise ValueError(f'{indicator_id} {year} lies outside its {low} and {high} values')
            checked += 1
    return checked


def georgian_twins_agree(rows):
    """Each served cell has the same value in the Georgian edition of its table: to within 1e-9 (the two files differ in the
    last digits of a few doubles) and with the same published value. Returns the number of cells compared."""
    compared = 0
    for row in rows:
        twin = sheet(f'{row["source_id"]}_ka')
        column, line = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
        cell = twin.get(int(line), {}).get(column)
        if cell is None or cell['kind'] != 'n' or abs(number(cell) - Decimal(row['value'])) > Decimal('1e-9') \
                or published(token(cell)) != row['published_value']:
            raise ValueError(f'The Georgian edition differs: {row["indicator_id"]} {row["year"]} {row["source_cell"]}')
        compared += 1
    return compared


def source_cell(row):
    column, line = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    return sheet(row['source_id']).get(int(line), {}).get(column)


def validate(rows):
    keys, values, shown = set(), {}, {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        if (row['unit'], row['basis'], row['value_status']) != ('percent', 'actual', 'survey_estimate'):
            raise ValueError(f'Unexpected unit or status: {key}')
        if row['source_id'] != MEASURE_SOURCE[row['indicator_id'].split('.')[1]]:
            raise ValueError(f'Unexpected source: {key}')
        cell = source_cell(row)
        if cell is None or cell['format'] != '0.0' or token(cell) != row['value']:
            raise ValueError(f'The value does not match its source cell: {key} {row["source_cell"]}')
        if published(row['value']) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        values[key] = Decimal(row['value'])
        shown[key] = row['published_value']
    if keys != expected_keys():
        raise ValueError(f'Coverage mismatch: {len(expected_keys() - keys)} missing, {len(keys - expected_keys())} extra')
    for (indicator_id, year), expected in ANCHORS.items():
        if shown[(indicator_id, year)] != expected:
            raise ValueError(f'The anchor value does not match Geostat: {indicator_id} {year}')
    return {'shares_close': shares_close(), 'brackets': check_brackets(values), 'georgian_twins': georgian_twins_agree(rows)}


def manifest():
    records = []
    for source_id, title, page, url, resolved, local_file, content_type, retrieved_at in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                        'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': retrieved_at,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def order(row):
    _, measure, group = row['indicator_id'].split('.')
    return MEASURES.index(measure), HOME_GROUPS.index(group) if measure.startswith('homes_') else PEOPLE_GROUPS.index(group), row['year']


def build(check=False):
    rows = sorted(extract(), key=order)
    checks = validate(rows)
    sources = manifest()
    by_indicator, by_source, by_measure = defaultdict(list), defaultdict(int), defaultdict(int)
    for row in rows:
        by_indicator[row['indicator_id']].append(row['year'])
        by_source[row['source_id']] += 1
        by_measure[row['indicator_id'].split('.')[1]] += 1
    coverage_rows = [{'indicator_id': i, 'first_year': min(y), 'last_year': max(y), 'observations': len(y),
                      'unavailable_years': ';'.join(str(year) for year in range(min(y), max(y) + 1) if year not in y)}
                     for i, y in by_indicator.items()]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_DATE,
        'scope': 'Annual research only: Geostat ICT usage in households survey, 2016-2026 (one survey each June or July): homes '
                 'with internet and with a computer for Georgia, towns, villages and 11 regions; internet use in the last 3 months, '
                 'never, and every day; online shopping; nine online activities and four public-service rows for everyone; '
                 'mobile phone and smartphone ownership; computer use in the last 3 months, by town and village, sex and age',
        'primary_observation_count': len(rows), 'observations_by_measure': dict(by_measure),
        'observations_by_source': dict(sorted(by_source.items())), 'indicator_count': len(by_indicator),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'values_match_source_cells': True,
            'published_values_are_one_decimal_half_up_of_15_significant_digits': True,
            'distributions_close_to_100_within': str(TOLERANCE), 'distribution_sums_checked': checks['shares_close'],
            'total_between_sex_and_settlement_within': str(TOLERANCE), 'brackets_checked': checks['brackets'],
            'georgian_editions_agree': checks['georgian_twins'],
            'columns_and_rows_found_by_printed_text': True, 'other_regions_and_15_plus_columns_not_served': True,
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'internet-annual.csv': csv_bytes(rows, FIELDS),
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
