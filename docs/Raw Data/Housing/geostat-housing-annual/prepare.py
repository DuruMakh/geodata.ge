"""Reproduce and check the annual Geostat housing and construction research package.

Reads the preserved files in official/ with xlrd (the .xls files) and the shared worksheet reader (the .xlsx files); needs
xlrd 2.0.x. Never downloads sources or serves product data. The .xlsx reader and CSV writer are reused from the unemployment
package, as the business, money and household packages do. Every column is found by its printed heading and every row by the
printed region, district or index name, never by position.

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

import xlrd


sys.dont_write_bytecode = True  # Loading the shared reader must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, read_sheet = _shared.clean, _shared.csv_bytes, _shared.read_sheet

RETRIEVED_DATE = '2026-10-16'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLS = 'application/vnd.ms-excel'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
HOME_PAGE = 'https://www.geostat.ge/en/'
PERMITS_PAGE = 'https://www.geostat.ge/en/modules/categories/621/information-about-permissions-granted-for-construction-and-completed-objects'
PRICES_PAGE = 'https://www.geostat.ge/en/modules/categories/698/residential-property-price-index'
COST_PAGE = 'https://www.geostat.ge/en/modules/categories/655/construction-cost-index'


def _media(number, name):
    return f'https://geostat.ge/media/{number}/{name}', f'https://www.geostat.ge/media/{number}/{name}'


PERMISSIONS_ZIP = _media(81803, 'Permissions_ENG.zip')
COMPLETED_ZIP = _media(81805, 'Completed_ENG.zip')
# (source_id, title, page, URL, resolved URL, local file, content type, retrieval time in UTC). Times are the starts of the
# downloads; the zips' members carry their zip's URL and time. Served sources are marked in the README.
SOURCES = [
    ('geostat_housing_permits_regions', 'Permissions granted for construction by regions (0503EN020101)', PERMITS_PAGE,
     *_media(81802, '0503EN020101_Permissions.xls'), 'official/0503EN020101_Permissions.xls', XLS, '2026-10-16T16:49:24Z'),
    ('geostat_housing_permits_zip', 'Permissions by type and municipality, English (zip)', PERMITS_PAGE, *PERMISSIONS_ZIP,
     'official/Permissions_ENG.zip', 'application/zip', '2026-10-16T16:49:28Z'),
    ('geostat_housing_completed_regions', 'Completed construction objects by regions (0503EN020103)', PERMITS_PAGE,
     *_media(81804, '0503EN020103_Completed-objects.xls'), 'official/0503EN020103_Completed-objects.xls', XLS, '2026-10-16T16:49:31Z'),
    ('geostat_housing_completed_zip', 'Completed objects by type, English (zip)', PERMITS_PAGE, *COMPLETED_ZIP,
     'official/Completed_ENG.zip', 'application/zip', '2026-10-16T16:49:34Z'),
    ('geostat_housing_permits_municipalities', 'Permissions: completed municipalities (0503EN020102a)', PERMITS_PAGE, *PERMISSIONS_ZIP,
     'official/Permissions_ENG/0503EN020102a_Permissions_ completed municipalities_ENG.xls', XLS, '2026-10-16T16:49:28Z'),
    ('geostat_housing_permits_quarterly', 'Permissions by type, 2019-2026 (0503EN020102b)', PERMITS_PAGE, *PERMISSIONS_ZIP,
     'official/Permissions_ENG/0503EN020102b_Permissions by type_ 2019-2026 ENG.xls', XLS, '2026-10-16T16:49:28Z'),
    ('geostat_housing_permits_types', 'Permissions granted for construction by type, 2006-2025 (0503EN020102c)', PERMITS_PAGE,
     *PERMISSIONS_ZIP, 'official/Permissions_ENG/0503EN020102c_Permissions by type_ 2006-2025 ENG.xls', XLS, '2026-10-16T16:49:28Z'),
    ('geostat_housing_completed_quarterly', 'Completed objects by type, 2019-2026 (0503EN020104a)', PERMITS_PAGE, *COMPLETED_ZIP,
     'official/Completed_ENG/0503EN020104a_Completed by type_ 2019-2026 ENG.xls', XLS, '2026-10-16T16:49:34Z'),
    ('geostat_housing_completed_types', 'Completed construction objects by type, 2006-2025 (0503EN020104b)', PERMITS_PAGE,
     *COMPLETED_ZIP, 'official/Completed_ENG/0503EN020104b_Completed by type_ 2006-2025 ENG.xls', XLS, '2026-10-16T16:49:34Z'),
    ('geostat_housing_price_index_quarterly', 'Residential property price index, compared to the previous quarter', PRICES_PAGE,
     *_media(81564, 'RPPI-compared-to-previous-quarter.xlsx'), 'official/RPPI-compared-to-previous-quarter.xlsx', XLSX,
     '2026-10-16T16:49:37Z'),
    ('geostat_housing_price_index_annual', 'Residential property price index, compared to the same quarter of the previous year',
     PRICES_PAGE, *_media(81566, 'RPPI-compared-to-the-same-quarter-of-previous-year.xlsx'),
     'official/RPPI-compared-to-the-same-quarter-of-previous-year.xlsx', XLSX, '2026-10-16T16:49:40Z'),
    ('geostat_housing_price_index', 'Residential property price index, compared to the 2020 average', PRICES_PAGE,
     *_media(81568, 'RPPI-compared-to-2020-average.xlsx'), 'official/RPPI-compared-to-2020-average.xlsx', XLSX, '2026-10-16T16:49:41Z'),
    ('geostat_housing_tbilisi_prices', 'Residential property prices in Tbilisi by district', PRICES_PAGE,
     *_media(81570, 'Residential-property-prices-in-Tbilisi-by-district.xlsx'),
     'official/Residential-property-prices-in-Tbilisi-by-district.xlsx', XLSX, '2026-10-16T16:49:44Z'),
    ('geostat_housing_cci_monthly', 'Construction cost index, previous month = 100', COST_PAGE,
     *_media(83247, 'CCI-previous-month%3D100.xlsx'), 'official/CCI-previous-month=100.xlsx', XLSX, '2026-10-16T16:49:46Z'),
    ('geostat_housing_cci_2022', 'Construction cost index, 2022 February = 100', COST_PAGE,
     *_media(83249, 'CCI-2022-February%3D100.xlsx'), 'official/CCI-2022-February=100.xlsx', XLSX, '2026-10-16T16:49:48Z'),
    ('geostat_housing_cci_annual', 'Construction cost index, same month of the previous year = 100', COST_PAGE,
     *_media(83251, 'CCI-same-month-of-the-previous-year%3D100.xlsx'), 'official/CCI-same-month-of-the-previous-year=100.xlsx', XLSX,
     '2026-10-16T16:49:50Z'),
    ('geostat_housing_construction', 'Construction by region (Construction.xlsx)', HOME_PAGE, *_media(74911, 'Construction.xlsx'),
     'official/Construction.xlsx', XLSX, '2026-10-16T16:49:53Z'),
    ('geostat_housing_infrastructure', 'Infrastructure of dwellings by region (Infrastructure-.xlsx)', HOME_PAGE,
     *_media(79288, 'Infrastructure-.xlsx'), 'official/Infrastructure-.xlsx', XLSX, '2026-10-16T16:50:04Z'),
    ('geostat_housing_permits_page', 'Geostat page: permissions and completed objects (category 621)', PERMITS_PAGE,
     'https://www.geostat.ge/en/modules/categories/621', PERMITS_PAGE, 'official/geostat-category-621-2026-10-16.html', HTML,
     '2026-10-16T16:50:16Z'),
    ('geostat_housing_prices_page', 'Geostat page: residential property price index (category 698)', PRICES_PAGE,
     'https://www.geostat.ge/en/modules/categories/698', PRICES_PAGE, 'official/geostat-category-698-2026-10-16.html', HTML,
     '2026-10-16T16:50:19Z'),
    ('geostat_housing_cost_page', 'Geostat page: construction cost index (category 655)', COST_PAGE,
     'https://www.geostat.ge/en/modules/categories/655', COST_PAGE, 'official/geostat-category-655-2026-10-16.html', HTML,
     '2026-10-16T16:50:21Z'),
]
FILE = {source[0]: source[5] for source in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']

PERMITS_REGIONS, COMPLETED_REGIONS = 'geostat_housing_permits_regions', 'geostat_housing_completed_regions'
PERMITS_TYPES, COMPLETED_TYPES = 'geostat_housing_permits_types', 'geostat_housing_completed_types'
PRICE_INDEX, TBILISI_PRICES = 'geostat_housing_price_index', 'geostat_housing_tbilisi_prices'
REGIONAL = {'permits': PERMITS_REGIONS, 'completed': COMPLETED_REGIONS}
BY_TYPE = {'permits': PERMITS_TYPES, 'completed': COMPLETED_TYPES}
SERVED = [PERMITS_REGIONS, COMPLETED_REGIONS, PERMITS_TYPES, COMPLETED_TYPES, PRICE_INDEX, TBILISI_PRICES]

FIRST_YEAR, LAST_YEAR = 2006, 2025  # The regional workbooks' 2026 January-June columns and the 2026 quarters are never served.
INDEX_FIRST_YEAR, DISTRICT_FIRST_YEAR = 2020, 2021
UNITS = {'permits_count': 'count', 'permits_area': 'square_metres', 'completed_count': 'count', 'completed_area': 'square_metres',
         'price_index': 'index_2020', 'price_flat': 'gel_per_square_metre', 'price_house': 'gel_per_square_metre'}
# Decimals of the published value. Counts and areas are whole numbers; the index shows one decimal and a district price none.
UNIT_PLACES = {'count': 0, 'square_metres': 0, 'index_2020': 1, 'gel_per_square_metre': 0}
FORMAT_PLACES = {'#,##0': 0, '0': 0, '0_);\\(0\\);\\-': 0, '#,##0.0': 1, '0.0': 1}
NO_DATA = ('…', '...')

REGIONS = {
    'Tbilisi': 'region_tbilisi', 'Tbilisi city': 'region_tbilisi', 'Adjara AR': 'region_adjara', 'Guria': 'region_guria',
    'Imereti': 'region_imereti', 'Kakheti': 'region_kakheti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
    'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
    'Racha-lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
    'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
    'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli'}
REGION_IDS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
              'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
              'region_kvemo_kartli', 'region_shida_kartli']
ROW_LABELS = {'Georgia- total': 'total', **REGIONS}  # Row labels of the regional and by-type tables, matched by their exact text.

# Header text of a by-type column, any spelling Geostat printed: compared in lower case, on the text before the first line
# break, with spaces, hyphens and one trailing "s" removed. An unmatched header stops the run.
TYPE_HEADERS = {
    'residential': ['Residential buildings'], 'trade': ['Trade buildings'], 'administrative': ['Administrative buildings'],
    'hotels': ['Hotels'], 'cafes': ['Cafes and restaurents', 'Cafes and restourants'], 'industrial': ['Industrial buildings and warehouses'],
    'farm': ['Farm buildings'], 'fuel': ['Refuelling stations'], 'parking': ['Car parkings'], 'education': ['Educational institutions'],
    'preschool': ['Pre-school establish-ments', 'Pre-schools establish-ments'], 'health': ['Health establishments'],
    'sports': ['Sports buildings and grounds'], 'culture': ['Cultural establish-ments'], 'pharmacy': ['Chemist,s shop'],
    'holiday_camps': ["Children's holiday camps"], 'other': ['Other']}
TYPE_IDS = list(TYPE_HEADERS)
# The years whose by-type sheet has no column for a type (every other type has a column in all 20 sheets). The completed
# sheets have no holiday-camps column at all; the permits sheets have it in 2022 and 2023 only.
MISSING_TYPE_YEARS = {
    ('permits', 'preschool'): {2008},
    ('permits', 'holiday_camps'): set(range(FIRST_YEAR, LAST_YEAR + 1)) - {2022, 2023},
    ('completed', 'preschool'): {2006, 2009, 2011, 2012, 2021},
    ('completed', 'holiday_camps'): set(range(FIRST_YEAR, LAST_YEAR + 1))}

# Completed objects: the residential cell of a region is "…" (no data) in these years, number and area alike, although the
# region's total is printed. No value is served for them.
NO_RESIDENTIAL = {('completed', 'region_samegrelo_zemo_svaneti'): {2006}, ('completed', 'region_kakheti'): {2006},
                  ('completed', 'region_racha_lechkhumi_kvemo_svaneti'): {2010, 2011}}

DISTRICTS = {'Gldani': 'district_gldani', 'Didube': 'district_didube', 'Vake': 'district_vake', 'Isani': 'district_isani',
             'Krtsanisi': 'district_krtsanisi', 'Mtatsminda': 'district_mtatsminda', 'Nadzaladevi': 'district_nadzaladevi',
             'Saburtalo': 'district_saburtalo', 'Samgori': 'district_samgori', 'Chughureti': 'district_chughureti'}
INDEX_ROWS = {'Total': 'total', 'Flats': 'flats', 'Detached houses': 'houses'}
DISTRICT_SHEETS = {'Flats': 'price_flat', 'Detached houses': 'price_house'}
QUARTERS = ['I', 'II', 'III', 'IV']

# Years in which the 11 regions do not add up to Georgia's total of square metres in the regional workbooks (parts minus total).
KNOWN_DIFFERENCES = {('permits_area', 'region'): {2024: '-1'}, ('completed_area', 'region'): {2024: '1'}}
TOLERANCE = {'count': Decimal(0), 'square_metres': Decimal(1)}  # Parts and the printed total differ by at most this.

# Values Geostat prints, as published.
ANCHORS = {('housing.permits_count.total', 2025): '11578', ('housing.permits_area.total', 2025): '11397190',
           ('housing.completed_count.total', 2025): '3393', ('housing.completed_area.total', 2025): '3509126',
           ('housing.permits_area.region_tbilisi', 2025): '6423329', ('housing.permits_count.region_guria', 2025): '150',
           ('housing.price_index.total', 2020): '107.2', ('housing.price_index.total', 2025): '159.4'}
# The workbook's stored value, which the cell format shows as 5874.
VALUE_ANCHORS = {('housing.price_flat.district_vake', 2025): '5873.77'}
DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows a stored double to 15 significant digits.


def published(value, places):
    """Round half-up from the value as Excel displays it (15 significant digits), so 8.4499999999999993 publishes as 8.5."""
    return str(DISPLAY.create_decimal(value).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def text(cell):
    return '' if cell is None else clean(str(cell['value']))


def column_number(column):
    number = 0
    for letter in column:
        number = number * 26 + ord(letter) - 64
    return number


def column_letters(number):
    return xlrd.colname(number - 1)


def token(cell):
    """The shortest number text that reads back as the stored double, without a trailing .0: the same text xlrd and SheetJS give."""
    if cell is None or cell['kind'] != 'n':
        raise ValueError(f'Expected a number, found {None if cell is None else cell["value"]!r} in {None if cell is None else cell["cell"]}')
    shown = format(Decimal(repr(float(cell['value']))), 'f')
    return shown[:-2] if shown.endswith('.0') else shown


def cell_number(cell):
    return Decimal(token(cell))


def places_of(cell, unit):
    """Decimals the published value shows. The cell's number format must show the unit's decimals; a General cell that stores
    a fraction of a square metre (a few areas of 2023 and 2024) is published in whole square metres."""
    number_format = cell['format']
    if number_format in FORMAT_PLACES:
        places = FORMAT_PLACES[number_format]
    elif number_format == 'General':
        places = 0
        if cell_number(cell) != cell_number(cell).to_integral_value() and unit != 'square_metres':
            raise ValueError(f'{cell["cell"]} stores a fraction but is not an area')
    else:
        raise ValueError(f'Unexpected number format {number_format!r} in {cell["cell"]}')
    if places != UNIT_PLACES[unit]:
        raise ValueError(f'{cell["cell"]} shows {places} decimals, not the {UNIT_PLACES[unit]} of {unit}')
    return places


@functools.lru_cache(maxsize=None)
def _workbook(source_id):
    return xlrd.open_workbook(ROOT / FILE[source_id], formatting_info=True)


def is_xls(source_id):
    return FILE[source_id].endswith('.xls')


@functools.lru_cache(maxsize=None)
def sheet_names(source_id):
    if is_xls(source_id):
        return tuple(_workbook(source_id).sheet_names())
    from zipfile import ZipFile
    import xml.etree.ElementTree as ET
    with ZipFile(ROOT / FILE[source_id]) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        return tuple(s.get('name') for s in workbook.findall('x:sheets/x:sheet', _shared.NS))


@functools.lru_cache(maxsize=None)
def sheet(source_id, name):
    """{row number: {column letters: {'value', 'cell', 'kind', 'format'}}} for every non-empty cell, from either file type."""
    if not is_xls(source_id):
        return {number: {column: dict(cell) for column, cell in cells.items()}
                for number, cells in read_sheet(ROOT / FILE[source_id], name).items()}
    book = _workbook(source_id)
    worksheet = book.sheet_by_name(name)
    rows = {}
    for r in range(worksheet.nrows):
        for c in range(worksheet.ncols):
            cell = worksheet.cell(r, c)
            if cell.ctype == xlrd.XL_CELL_NUMBER:
                value, kind = Decimal(repr(cell.value)), 'n'
                number_format = book.format_map[book.xf_list[cell.xf_index].format_key].format_str
            elif cell.ctype == xlrd.XL_CELL_TEXT:
                value, kind, number_format = cell.value, 's', ''
            elif cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                continue
            else:
                raise ValueError(f'Unexpected cell type {cell.ctype} in {name}!{xlrd.cellname(r, c)}')
            rows.setdefault(r + 1, {})[column_letters(c + 1)] = {
                'value': value, 'cell': xlrd.cellname(r, c), 'kind': kind, 'format': number_format}
    return rows


def observation(indicator_id, year, cell, source_id, source_sheet):
    unit = UNITS[indicator_id.split('.')[1]]
    if cell is None or text(cell) in NO_DATA:
        raise ValueError(f'No value for {indicator_id} {year} in {source_sheet}')
    return {'year': year, 'indicator_id': indicator_id, 'value': token(cell), 'published_value': published(token(cell), places_of(cell, unit)),
            'unit': unit, 'basis': 'actual', 'value_status': 'official', 'source_id': source_id, 'source_sheet': source_sheet,
            'source_cell': cell['cell']}


# Regional workbooks (0503EN020101 and 0503EN020103): one sheet, a year heading over each number / area pair.

@functools.lru_cache(maxsize=None)
def regional_table(source_id):
    """({year: (count column, area column)}, {group: row}, sheet) for the years to 2025. The 2026 January-June pair is checked
    to be exactly that and is left out."""
    (name,) = sheet_names(source_id)
    rows = sheet(source_id, name)
    heading = [n for n, cells in rows.items() if text(cells.get('A')) == 'Region']
    if len(heading) != 1:
        raise ValueError(f'Expected one year heading row in {name}, found {heading}')
    years, ignored = {}, []
    for column, cell in rows[heading[0]].items():
        if column == 'A':
            continue
        labels = rows.get(heading[0] + 1, {})
        if cell['kind'] == 'n':
            year, count, area = int(cell['value']), column, column_letters(column_number(column) + 1)
            if (text(labels.get(count)).casefold(), text(labels.get(area)).casefold()) != ('number', 'space, m2'):
                raise ValueError(f'Columns under {year} in {name} are not number and space, m2')
            if year in years:
                raise ValueError(f'{year} is printed twice in {name}')
            years[year] = (count, area)
        elif re.fullmatch(r'2026 January-June', text(cell)):
            ignored.append(column)
        else:
            raise ValueError(f'Unexpected heading {text(cell)!r} in {name}')
    if sorted(years) != list(range(FIRST_YEAR, LAST_YEAR + 1)) or len(ignored) != 1:
        raise ValueError(f'Unexpected years in {name}: {sorted(years)}, ignored {ignored}')
    groups, number = {}, heading[0] + 2
    while text(rows.get(number, {}).get('A')):
        group = ROW_LABELS.get(text(rows[number]['A']))
        if group is None or group in groups:
            raise ValueError(f'Unexpected row {number} in {name}: {text(rows[number]["A"])!r}')
        groups[group] = number
        number += 1
    if set(groups) != {'total', *REGION_IDS}:
        raise ValueError(f'Unexpected rows in {name}: {sorted(groups)}')
    return years, groups, name


def regional_observations(measure):
    source_id = REGIONAL[measure]
    years, groups, name = regional_table(source_id)
    rows = sheet(source_id, name)
    return [observation(f'housing.{measure}_{kind}.{group}', year, rows[number].get(columns[index]), source_id, name)
            for year, columns in years.items() for group, number in groups.items() for index, kind in enumerate(('count', 'area'))]


# By-type workbooks (0503EN020102c and 0503EN020104b): one sheet per year; every region is a number row and an area row.

def type_of(label):
    def key(value):
        value = re.sub(r'[\s\-]+', '', value.split('\n')[0].casefold())
        return value[:-1] if value.endswith('s') else value
    found = [type_id for type_id, labels in TYPE_HEADERS.items() if key(label) in {key(known) for known in labels}]
    return found[0] if found else None


@functools.lru_cache(maxsize=None)
def type_sheet(source_id, year):
    """The year's sheet: {'name', 'columns': {type: column}, 'total': column, 'rows': {group: (number row, area row)}}."""
    names = [name for name in sheet_names(source_id) if clean(name) == str(year)]
    if len(names) != 1:
        raise ValueError(f'Expected one {year} sheet in {source_id}, found {names}')
    name, rows = names[0], sheet(source_id, names[0])
    header = [n for n, cells in rows.items() if any(type_of(str(cell['value'])) == 'residential' for cell in cells.values())]
    if len(header) != 1:
        raise ValueError(f'Expected one heading row in {name}, found {header}')
    columns, total = {}, [column for n, cells in rows.items() if n < header[0] for column, cell in cells.items()
                          if clean(str(cell['value'])).casefold() == 'total']
    for column, cell in rows[header[0]].items():
        type_id = type_of(str(cell['value']))
        if type_id is None or type_id in columns:
            raise ValueError(f'Unexpected heading {cell["value"]!r} in {source_id} sheet {name}')
        columns[type_id] = column
    if len(total) != 1:
        raise ValueError(f'Expected one Total column in {name}, found {total}')
    labelled = 'B' not in columns.values() and total[0] != 'B'  # Otherwise column B holds data and prints no number / area label.
    groups, number = {}, header[0] + 1
    while number <= max(rows):
        label = text(rows.get(number, {}).get('A'))
        if label.startswith('Note'):
            break
        if label:
            # Geostat prints a few labels on a row of their own, with the number and area rows below (completed 2010).
            first = number if len(rows[number]) > 1 else number + 1
            group = ROW_LABELS.get(label)
            if group is None or group in groups or any(text(rows.get(n, {}).get('A')) for n in (first + 1, *range(number + 1, first + 1))):
                raise ValueError(f'Unexpected row {number} in {name}: {label!r}')
            if labelled and (text(rows[first].get('B')).casefold(), text(rows.get(first + 1, {}).get('B')).casefold()) != ('number', 'area m2'):
                raise ValueError(f'Rows {first} and {first + 1} of {name} are not a number and an area row')
            groups[group] = (first, first + 1)
            number = first + 1
        number += 1
    if set(groups) != {'total', *REGION_IDS}:
        raise ValueError(f'Unexpected rows in {name}: {sorted(groups)}')
    return {'name': name, 'columns': columns, 'total': total[0], 'rows': groups}


def type_observations(measure):
    source_id, rows = BY_TYPE[measure], []
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        table = type_sheet(source_id, year)
        cells = sheet(source_id, table['name'])
        expected = {type_id for type_id in TYPE_IDS if year not in MISSING_TYPE_YEARS.get((measure, type_id), ())}
        if set(table['columns']) != expected:
            raise ValueError(f'Unexpected type columns in {table["name"]}: {sorted(set(table["columns"]) ^ expected)}')
        for index, kind in enumerate(('count', 'area')):
            for type_id, column in table['columns'].items():
                rows.append(observation(f'housing.{measure}_{kind}.type_{type_id}', year,
                                        cells[table['rows']['total'][index]].get(column), source_id, table['name']))
            for region in REGION_IDS:
                cell = cells[table['rows'][region][index]].get(table['columns']['residential'])
                if year in NO_RESIDENTIAL.get((measure, region), ()):
                    if cell is None or text(cell) not in NO_DATA:
                        raise ValueError(f'Expected no data for {region} {year} in {table["name"]}')
                    continue
                rows.append(observation(f'housing.{measure}_{kind}.{region}_residential', year, cell, source_id, table['name']))
    return rows


# Price workbooks: a year heading over its four quarters I to IV; only the IV column is served.

def fourth_quarter_columns(rows, year_row, quarter_row):
    """{year: column of its IV heading} for the years to 2025, each year's span holding exactly the quarters I to IV."""
    heads = sorted((column_number(column), int(cell['value'])) for column, cell in rows[year_row].items() if cell['kind'] == 'n')
    ends = [number for number, _ in heads[1:]] + [max(column_number(c) for c in rows[quarter_row]) + 1]
    found = {}
    for (start, year), end in zip(heads, ends):
        quarters = [(column_letters(n), text(rows[quarter_row].get(column_letters(n)))) for n in range(start, end)]
        if year <= LAST_YEAR:
            if [label for _, label in quarters] != QUARTERS:
                raise ValueError(f'The quarters under {year} are {[label for _, label in quarters]}')
            found[year] = quarters[3][0]
        elif year != LAST_YEAR + 1:
            raise ValueError(f'Unexpected year {year}')
    return found


def labelled_rows(rows, first, known, sheet_name):
    """{group: row} for the rows from first down to the first blank row, each named in column A."""
    groups, number = {}, first
    while text(rows.get(number, {}).get('A')):
        group = known.get(text(rows[number]['A']))
        if group is None or group in groups:
            raise ValueError(f'Unexpected row {number} in {sheet_name}: {text(rows[number]["A"])!r}')
        groups[group] = number
        number += 1
    if set(groups) != set(known.values()):
        raise ValueError(f'Unexpected rows in {sheet_name}: {sorted(groups)}')
    return groups


def price_observations():
    rows = []
    (name,) = sheet_names(PRICE_INDEX)
    cells = sheet(PRICE_INDEX, name)
    year_row = next(n for n, row in cells.items() if any(c['kind'] == 'n' and c['value'] == INDEX_FIRST_YEAR for c in row.values()))
    columns = fourth_quarter_columns(cells, year_row, year_row + 1)
    for group, number in labelled_rows(cells, year_row + 2, INDEX_ROWS, name).items():
        rows += [observation(f'housing.price_index.{group}', year, cells[number].get(columns[year]), PRICE_INDEX, name)
                 for year in range(INDEX_FIRST_YEAR, LAST_YEAR + 1)]
    for name, measure in DISTRICT_SHEETS.items():
        cells = sheet(TBILISI_PRICES, name)
        year_row = next(n for n, row in cells.items() if text(row.get('A')) == 'District')
        columns = fourth_quarter_columns(cells, year_row, year_row + 1)
        for group, number in labelled_rows(cells, year_row + 2, DISTRICTS, name).items():
            rows += [observation(f'housing.{measure}.{group}', year, cells[number].get(columns[year]), TBILISI_PRICES, name)
                     for year in range(DISTRICT_FIRST_YEAR, LAST_YEAR + 1)]
    return rows


def extract():
    """Every served observation, transcribed from its original cell."""
    rows = []
    for measure in ('permits', 'completed'):
        rows += regional_observations(measure) + type_observations(measure)
    return rows + price_observations()


def expected_keys():
    keys = set()
    years = range(FIRST_YEAR, LAST_YEAR + 1)
    for measure in ('permits', 'completed'):
        for kind in ('count', 'area'):
            for group in ['total', *REGION_IDS]:
                keys |= {(f'housing.{measure}_{kind}.{group}', year) for year in years}
            for region in REGION_IDS:
                keys |= {(f'housing.{measure}_{kind}.{region}_residential', year) for year in years
                         if year not in NO_RESIDENTIAL.get((measure, region), ())}
            for type_id in TYPE_IDS:
                keys |= {(f'housing.{measure}_{kind}.type_{type_id}', year) for year in years
                         if year not in MISSING_TYPE_YEARS.get((measure, type_id), ())}
    for group in INDEX_ROWS.values():
        keys |= {(f'housing.price_index.{group}', year) for year in range(INDEX_FIRST_YEAR, LAST_YEAR + 1)}
    for measure in DISTRICT_SHEETS.values():
        for group in DISTRICTS.values():
            keys |= {(f'housing.{measure}.{group}', year) for year in range(DISTRICT_FIRST_YEAR, LAST_YEAR + 1)}
    return keys


def source_cell(row):
    column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    return sheet(row['source_id'], row['source_sheet']).get(int(number), {}).get(column)


def quarter_of(row):
    """The quarter heading above a price cell, found by walking up its column to the nearest I to IV label."""
    column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    cells = sheet(row['source_id'], row['source_sheet'])
    for n in range(int(number) - 1, 0, -1):
        label = text(cells.get(n, {}).get(column))
        if label in QUARTERS:
            return label
    return None


def type_totals_agree():
    """Each by-type sheet's Total column prints the regional workbook's number or area of Georgia and of every region (counts
    exactly, areas within a square metre). Returns the number of cells compared."""
    checked = 0
    for measure in ('permits', 'completed'):
        years, groups, name = regional_table(REGIONAL[measure])
        regional = sheet(REGIONAL[measure], name)
        for year in range(FIRST_YEAR, LAST_YEAR + 1):
            table = type_sheet(BY_TYPE[measure], year)
            cells = sheet(BY_TYPE[measure], table['name'])
            for group, pair in table['rows'].items():
                for index, kind in enumerate(('count', 'area')):
                    difference = abs(cell_number(cells[pair[index]].get(table['total'])) -
                                     cell_number(regional[groups[group]].get(years[year][index])))
                    if difference > TOLERANCE['count' if kind == 'count' else 'square_metres']:
                        raise ValueError(f'The {measure} {kind} of {group} in {year} differs between the by-type and regional sheets')
                    checked += 1
    return checked


def validate(rows):
    keys, values, shown = set(), {}, {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        if row['unit'] != UNITS[row['indicator_id'].split('.')[1]] or (row['basis'], row['value_status']) != ('actual', 'official'):
            raise ValueError(f'Unexpected unit or status: {key}')
        cell = source_cell(row)
        if cell is None or published(Decimal(row['value']), places_of(cell, row['unit'])) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        values[key] = Decimal(row['value'])
        shown[key] = row['published_value']
    if keys != expected_keys():
        raise ValueError(f'Coverage mismatch: {len(expected_keys() - keys)} missing, {len(keys - expected_keys())} extra')
    if any(year > LAST_YEAR for _, year in keys):
        raise ValueError('A year after 2025 is served')

    def adds_up(measure, unit, kind, groups, years):
        known = KNOWN_DIFFERENCES.get((f'{measure}_{unit}', kind), {})
        for year in years:
            total = values[(f'housing.{measure}_{unit}.total', year)]
            parts = sum(values.get((f'housing.{measure}_{unit}.{group}', year), Decimal(0)) for group in groups)
            tolerance = TOLERANCE['count' if unit == 'count' else 'square_metres']
            failed = str(parts - total) != known[year] if year in known else abs(parts - total) > tolerance
            if failed:
                raise ValueError(f'The {measure} {unit} {kind}s do not add up to the total in {year} as recorded')

    years = range(FIRST_YEAR, LAST_YEAR + 1)
    for measure in ('permits', 'completed'):
        for unit in ('count', 'area'):
            adds_up(measure, unit, 'region', REGION_IDS, years)
            adds_up(measure, unit, 'type', [f'type_{type_id}' for type_id in TYPE_IDS], years)
            for region in REGION_IDS:
                for year in years:
                    residential = values.get((f'housing.{measure}_{unit}.{region}_residential', year), Decimal(0))
                    if residential > values[(f'housing.{measure}_{unit}.{region}', year)]:
                        raise ValueError(f'The residential {unit} of {region} exceeds its total in {year}')
    for (indicator_id, year), expected in ANCHORS.items():
        if shown[(indicator_id, year)] != expected:
            raise ValueError(f'The anchor value does not match Geostat: {indicator_id} {year}')
    for (indicator_id, year), expected in VALUE_ANCHORS.items():
        if str(values[(indicator_id, year)]) != expected:
            raise ValueError(f'The anchor value does not match Geostat: {indicator_id} {year}')
    for row in rows:
        if token(source_cell(row)) != row['value']:
            raise ValueError(f'The value does not match its source cell: {row["indicator_id"]} {row["year"]} {row["source_cell"]}')
        if row['indicator_id'].split('.')[1].startswith('price_') and quarter_of(row) != 'IV':
            raise ValueError(f'The price is not from the fourth quarter: {row["indicator_id"]} {row["year"]} {row["source_cell"]}')
    return {'by_type_totals_compared': type_totals_agree()}


def manifest():
    records = []
    for source_id, title, page, url, resolved, local_file, content_type, retrieved_at in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                        'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': retrieved_at,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def build(check=False):
    rows = sorted(extract(), key=lambda r: (r['indicator_id'], r['year']))
    agreement = validate(rows)
    sources = manifest()
    by_indicator, by_source, by_measure = defaultdict(list), defaultdict(int), defaultdict(int)
    for row in rows:
        by_indicator[row['indicator_id']].append(row['year'])
        by_source[row['source_id']] += 1
        by_measure[row['indicator_id'].split('.')[1]] += 1
    coverage_rows = [{'indicator_id': i, 'first_year': min(y), 'last_year': max(y), 'observations': len(y),
                      'unavailable_years': ';'.join(str(year) for year in range(min(y), max(y) + 1) if year not in y)}
                     for i, y in sorted(by_indicator.items())]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_DATE,
        'scope': 'Annual research only: permits granted and completed objects (number and square metres) for Georgia and its '
                 '11 regions and by building type, 2006-2025, from the declared-data workbooks; the residential property price '
                 'index (2020 average = 100), 2020-2025, and Tbilisi district prices per square metre, 2021-2025, both from the '
                 'fourth quarter; no 2026 columns, no quarters, no municipalities, no construction cost index',
        'primary_observation_count': len(rows), 'observations_by_measure': dict(sorted(by_measure.items())),
        'observations_by_source': dict(sorted(by_source.items())), 'indicator_count': len(by_indicator),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'values_match_source_cells': True,
            'published_values_are_rounded_stored_values_at_cell_precision': True,
            'regions_add_up_to_total': {unit: str(t) for unit, t in TOLERANCE.items()},
            'recorded_differences_parts_minus_total': {f'{measure}.{kind}': {str(y): d for y, d in years.items()}
                                                       for (measure, kind), years in KNOWN_DIFFERENCES.items()},
            'types_add_up_to_total': {unit: str(t) for unit, t in TOLERANCE.items()},
            'by_type_totals_equal_regional_workbooks': agreement['by_type_totals_compared'],
            'residential_never_exceeds_region_total': True, 'prices_are_fourth_quarter_cells': True,
            'no_2026_or_quarter_rows': True, 'type_columns_found_by_header_text': True,
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()},
            'workbook_value_anchors': {f'{i}:{y}': p for (i, y), p in VALUE_ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'housing-annual.csv': csv_bytes(rows, FIELDS),
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
