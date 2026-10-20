"""Reproduce and check the annual Geostat transport research package.

Reads the preserved files in official/ with the shared worksheet reader (the .xlsx files) and xlrd (the one .xls file); needs
xlrd 2.0.x. Never downloads sources or serves product data. The .xlsx reader and CSV writer are reused from the unemployment
package, as the housing package does. Every column is found by its printed year heading (and, in the regional workbook, its
sub-heading) and every row by its printed label, never by position.

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

RETRIEVED_DATE = '2026-10-20'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLS = 'application/vnd.ms-excel'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
PAGES = {number: f'https://www.geostat.ge/en/modules/categories/{number}/{slug}' for number, slug in (
    (565, 'environmental-indicators'), (795, 'railway-transport-statistics'), (796, 'air-transport-statistics'),
    (797, 'road-transport-statistics'), (802, 'maritime-transport-statistics'))}


def _file(source_id, title, page, number, name, retrieved_at):
    url = f'https://www.geostat.ge/media/{number}/{name}'
    content_type = XLS if name.endswith('.xls') else XLSX
    return source_id, title, PAGES[page], url, url, f'official/{name}', content_type, retrieved_at


def _page(source_id, title, page, retrieved_at):
    return source_id, title, PAGES[page], PAGES[page], PAGES[page], f'official/geostat-category-{page}-2026-10-20.html', HTML, retrieved_at


# (source_id, title, page, URL, resolved URL, local file, content type, retrieval time in UTC: the start of each download).
# The served sources are the 13 in SERVED; the rest are archived for reference only.
SOURCES = [
    _file('geostat_transport_passenger_demand', 'Table H-1. Passenger transport demand', 565, 82758,
          'H-1-Passenger-transport-demand_ENG.XLSX', '2026-10-20T05:40:43Z'),
    _file('geostat_transport_freight_demand', 'Table H-2. Freight transport demand', 565, 82759,
          'H-2-Freight-transport-demand_ENG.XLSX', '2026-10-20T05:40:45Z'),
    _file('geostat_transport_fleet_fuel', 'Table H-3. Composition of road motor vehicle fleet by fuel type', 565, 82760,
          'H-3.-Composition-of-road-motor-vehicle-fleet-by-fuel-type_ENG.xlsx', '2026-10-20T05:40:47Z'),
    _file('geostat_transport_fleet_age', 'Table H-4. Age of road motor vehicle fleet', 565, 82761,
          'H-4.-Age-of-road-motor-vehicle-fleet_ENG.xlsx', '2026-10-20T05:40:49Z'),
    _file('geostat_transport_rail_turnover', 'Railway freight turnover (0504EN030101)', 795, 82104,
          '0504EN030101_Railway-Freight-Turnover.xlsx', '2026-10-20T05:40:50Z'),
    _file('geostat_transport_rail_goods', 'Goods transported by railway (0504EN030102)', 795, 82106,
          '0504EN030102_Goods-Transported-by-Railway.xlsx', '2026-10-20T05:40:53Z'),
    _file('geostat_transport_rail_passengers', 'Passengers transported by railway (0504EN030103)', 795, 82108,
          '0504EN030103_Passengers-Transported-by-Railway.xlsx', '2026-10-20T05:40:54Z'),
    _file('geostat_transport_rail_infrastructure', 'Railway infrastructure (0504EN030104)', 795, 82110,
          '0504EN030104_Railway-Infrustructure.xlsx', '2026-10-20T05:40:56Z'),
    _file('geostat_transport_metro', 'Passengers transported by metro (0504EN030105)', 795, 82112,
          '0504EN030105_Passengers-transported-by-Metro.xlsx', '2026-10-20T05:40:57Z'),
    _file('geostat_transport_rail_regions', 'Goods transported by region of loading and unloading (0504EN030106)', 795, 82114,
          '0504EN030106_Goods-transported-by-region-of-loading-and-unloading.xlsx', '2026-10-20T05:40:59Z'),
    _file('geostat_transport_airlines', 'Airlines registered in Georgia (0504EN030201)', 796, 82116,
          '0504EN030201_Airlines-Registered-in-Georgia.xlsx', '2026-10-20T05:41:01Z'),
    _file('geostat_transport_airports', 'Airports in Georgia (0504EN030202)', 796, 82118,
          '0504EN030202_Airports-in-Georgia.xlsx', '2026-10-20T05:41:02Z'),
    _file('geostat_transport_air_infrastructure', 'Air transport infrastructure, 2025 (0504EN030203)', 796, 82120,
          '0504EN030203_Infrastructure_2025.xlsx', '2026-10-20T05:41:04Z'),
    _file('geostat_transport_roads', 'Length of common use roads by region', 797, 74997, 'Length-of-road-Eng-2024.xls',
          '2026-10-20T05:41:05Z'),
    _file('geostat_transport_taxi_licences', 'Taxi licences in Tbilisi', 797, 76152, 'Taxi_Licenses_Tbilisi-EN.XLSX',
          '2026-10-20T05:41:07Z'),
    _file('geostat_transport_registered', 'Number of registered vehicles by region', 797, 77252, 'Number-of-Registered-Vehicles.xlsx',
          '2026-10-20T05:41:08Z'),
    _file('geostat_transport_technical_inspections', 'Technical inspections, 2021-2025', 797, 77254,
          'Technical-Inspections_2021-2025.xlsx', '2026-10-20T05:41:10Z'),
    _file('geostat_transport_sea_passengers', 'Passengers carried in seaports and terminals (0504EN030401)', 802, 82122,
          '0504EN030401_Passenger-carried-in-seaports-and-terminals.xlsx', '2026-10-20T05:41:11Z'),
    _file('geostat_transport_sea_ships', 'Ships entering seaports and terminals (0504EN030402)', 802, 82124,
          '0504EN030402_Ships-entering-in-seaports-and-terminals.xlsx', '2026-10-20T05:41:13Z'),
    _file('geostat_transport_sea_freight', 'Freight carried in seaports and terminals (0504EN030403)', 802, 82126,
          '0504EN030403_Volume-of-carried-freight-in-seaports-and-terminals.xlsx', '2026-10-20T05:41:14Z'),
    _page('geostat_transport_environment_page', 'Geostat page: environmental indicators (category 565)', 565, '2026-10-20T05:41:16Z'),
    _page('geostat_transport_rail_page', 'Geostat page: railway transport statistics (category 795)', 795, '2026-10-20T05:41:17Z'),
    _page('geostat_transport_air_page', 'Geostat page: air transport statistics (category 796)', 796, '2026-10-20T05:41:19Z'),
    _page('geostat_transport_road_page', 'Geostat page: road transport statistics (category 797)', 797, '2026-10-20T05:41:20Z'),
    _page('geostat_transport_sea_page', 'Geostat page: maritime transport statistics (category 802)', 802, '2026-10-20T05:41:21Z'),
]
FILE = {source[0]: source[5] for source in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']

PASSENGER_DEMAND, FREIGHT_DEMAND = 'geostat_transport_passenger_demand', 'geostat_transport_freight_demand'
FLEET_FUEL, FLEET_AGE = 'geostat_transport_fleet_fuel', 'geostat_transport_fleet_age'
RAIL_GOODS, RAIL_PASSENGERS, METRO = 'geostat_transport_rail_goods', 'geostat_transport_rail_passengers', 'geostat_transport_metro'
AIRLINES, AIRPORTS = 'geostat_transport_airlines', 'geostat_transport_airports'
SEA_PASSENGERS, SEA_FREIGHT = 'geostat_transport_sea_passengers', 'geostat_transport_sea_freight'
REGISTERED, ROADS = 'geostat_transport_registered', 'geostat_transport_roads'
SERVED = [PASSENGER_DEMAND, FREIGHT_DEMAND, FLEET_FUEL, FLEET_AGE, RAIL_GOODS, RAIL_PASSENGERS, METRO, AIRLINES, AIRPORTS,
          SEA_PASSENGERS, SEA_FREIGHT, REGISTERED, ROADS]
# "-" is "magnitude nil" in every served table's legend except H-2's, which says "data not available"; a nil cell is served as 0.
# The airport tables print nil as "_", and so does one road-length cell (Tbilisi secondary roads 2015, whose total equals its
# international roads).
NIL_IS_GAP = {FREIGHT_DEMAND}
NIL = ('-', '_')
NO_DATA = ('…', '...')

LAST_YEAR = 2025  # No 2026 column, quarter or half-year is ever served.
UNITS = {'fleet': 'thousand_units', 'registered': 'thousand_units', 'passenger_km': 'million_passenger_km',
         'passenger_km_per_person': 'passenger_km_per_person', 'passengers': 'thousand_passengers',
         'tonne_km': 'million_tonne_km', 'freight_tonnes': 'thousand_tonnes', 'road_km': 'km'}
# Decimals of the published value: Geostat's published precision of each unit, one decimal except whole km per person.
UNIT_PLACES = {'thousand_units': 1, 'million_passenger_km': 1, 'passenger_km_per_person': 0, 'thousand_passengers': 1,
               'million_tonne_km': 1, 'thousand_tonnes': 1, 'km': 1}

REGION_IDS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
              'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
              'region_kvemo_kartli', 'region_shida_kartli']

# H-1 and H-2: (section heading, row label) of each served row; a label printed once is matched without its section.
PASSENGER_ROWS = {'road': ('Road transport*', 'Passenger transport demand'), 'rail': ('Railway transport', 'Passenger transport demand'),
                  'sea': ('Maritime transport', 'Passenger transport demand'), 'air': ('Aviation', 'Passenger transport demand'),
                  'metro': ('Underground transport (metro)', 'Passenger transport demand'),
                  'total': (None, 'Total passenger transport demand')}
FREIGHT_ROWS = {'road': ('Road transport*', 'Freight transport demand'), 'rail': ('Railway transport', 'Freight transport demand'),
                'sea': ('Maritime transport', 'Freight transport demand'), 'air': ('Aviation', 'Freight transport demand'),
                'total': (None, 'Total freight transport demand')}
PER_PERSON_ROW = (None, 'Total Passenger transport demand per capita')
# Rows that are "-" in every year: never served, checked to stay so.
NIL_ROWS = {PASSENGER_DEMAND: [('Inland waterways transport', 'Passenger transport demand')],
            FREIGHT_DEMAND: [('Inland waterways transport', 'Freight transport demand')]}
DEMAND_UNITS = {PASSENGER_DEMAND: 'million pkm', FREIGHT_DEMAND: 'million tkm'}

# H-3 and H-4: the section heading of each vehicle type, then its rows.
FLEET_TYPES = {'cars': 'Passenger cars', 'buses': 'Buses and minibuses', 'special': 'Special*', 'trucks': 'Trucks'}
FUEL_LABELS = {'petrol': 'Gasoline', 'petrol_gas': 'Gasoline-gas', 'diesel': 'Diesel', 'diesel_gas': 'Diesel-gas', 'gas': 'Gas',
               'electric': 'Electricity', 'hybrid': 'Hybrid', 'hybrid_gas': 'Hybrid-gas', 'hybrid_diesel': 'Hybrid-diesel',
               'unknown': 'Unknown'}
AGE_LABELS = {'up_to_2': '<= 2 years', 'up_to_5': '<= 5 years', 'up_to_10': '<= 10 years', 'over_10': '> 10 years',
              'unknown': 'Unknown'}
# The fuel and age rows served for each type. The others are 0 or nil in every year (checked) and are not served.
FLEET_FUELS = {'cars': ['petrol', 'petrol_gas', 'diesel', 'gas', 'electric', 'hybrid', 'hybrid_gas', 'unknown'],
               'buses': ['petrol', 'petrol_gas', 'diesel', 'gas', 'electric', 'unknown'],
               'trucks': ['petrol', 'petrol_gas', 'diesel', 'gas', 'electric', 'unknown'],
               'special': ['petrol', 'petrol_gas', 'diesel', 'electric', 'unknown']}
FLEET_AGES = {'cars': list(AGE_LABELS), 'buses': ['up_to_2', 'up_to_5', 'up_to_10', 'over_10'], 'trucks': list(AGE_LABELS),
              'special': list(AGE_LABELS)}

RAIL_GOODS_SECTIONS = {'rail': 'Transported, total', 'rail_domestic': 'National transported', 'rail_exports': 'Outgoing goods',
                       'rail_imports': 'Incoming goods', 'rail_transit': 'Transit'}
RAIL_PASSENGER_ROWS = {'rail': 'Number of passengers, total', 'rail_domestic': 'National', 'rail_international': 'International'}
SEA_FREIGHT_COLUMNS = {'seaports': 'Freight carried, total (thsd. tons)', 'seaports_liquid': 'Liquid bulk',
                       'seaports_general': 'General cargo', 'seaports_dry': 'Dry bulk'}

# Regional workbook: rows by region, a year heading over each block of columns, a sub-heading over each column.
AREA_ROWS = {'Georgia': 'total', 'Tbilisi': 'region_tbilisi', 'Abkhazia': 'region_abkhazia', 'Adjara': 'region_adjara',
             'Guria': 'region_guria', 'Imereti': 'region_imereti', 'Kakheti': 'region_kakheti',
             'Mtskheta-mtianeti': 'region_mtskheta_mtianeti', 'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
             'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
             'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli', 'Region unknown': 'region_unknown'}
REGISTERED_AREAS = ['total', *REGION_IDS, 'region_abkhazia', 'region_unknown']
# (sheet, the row holding the column sub-headings, {sub-heading: indicator suffix}, fixed block width or None).
REGISTERED_SHEETS = {
    'type': ('type of vehicle', 5, {'Motor vehicles – total': '', 'Lorries and trucks': '_trucks', 'Buses and minibuses': '_buses',
                                    'Special*': '_special', 'Passenger cars': '_cars', 'Unknown': '_type_unknown'}, None),
    'fuel': ('fuel type', 4, {label: f'_fuel_{fuel}' for fuel, label in FUEL_LABELS.items()}, None),
    'owner': (' type of owner ', 4, {'Legal person': '_owner_companies', 'Physical person': '_owner_individuals'}, 2),
    'age': ('age of vehicle', 4, {'<=2': '_age_0_2', '(2-5]': '_age_2_5', '(5-10]': '_age_5_10', '>10': '_age_over_10',
                                  'Unknown': '_age_unknown', 'უცნობია': '_age_unknown'}, 5)}
REGISTERED_FIRST_YEAR = 2017
# The years a regional column is printed in (every other column is printed 2017-2025).
REGISTERED_YEARS = {'_type_unknown': range(2022, 2026), '_fuel_diesel_gas': [2020, 2022, 2023, 2024, 2025],
                    '_fuel_hybrid_gas': range(2022, 2026), '_fuel_hybrid_diesel': range(2022, 2026)}

ROAD_ROWS = {'Georgia - total': 'total', 'Tbilisi*': 'region_tbilisi', 'Adjara AR': 'region_adjara', 'Abkhazia AR': 'region_abkhazia',
             'Guria': 'region_guria', 'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
             'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti', 'Imereti': 'region_imereti', 'Kakheti': 'region_kakheti',
             'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
             'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli'}
ROAD_COLUMNS = ['', '_international', '_secondary', '_local']
ROAD_SUBHEADINGS = ['total', 'international road', 'secondary road', 'local road']
ROAD_YEARS = range(2011, 2025)

# Totals that differ from the sum of their parts by more than the tolerance, Geostat's own rounding (its notes say so):
# (check, year) -> parts minus total.
KNOWN_DIFFERENCES = {('fleet.buses by fuel', 2020): '0.2', ('fleet.special by fuel', 2025): '-0.2'}
TOLERANCE = {'national': Decimal('0.1'), 'modes': Decimal('0.2'), 'regional': Decimal('0.2')}

# Values Geostat prints, as published.
ANCHORS = {('transport.fleet.cars', 2025): '1650.0', ('transport.fleet.cars', 2000): '244.8',
           ('transport.fleet.cars_fuel_electric', 2025): '15.2', ('transport.fleet.cars_age_over_10', 2025): '1318.9',
           ('transport.passenger_km.total', 2025): '11262.1', ('transport.passenger_km.air', 2025): '1862.6',
           ('transport.tonne_km.rail', 2025): '3814.9', ('transport.freight_tonnes.rail_transit', 2025): '7616.6',
           ('transport.registered.region_tbilisi', 2025): '855.0', ('transport.registered.total', 2025): '1914.9',
           ('transport.registered.region_guria', 2025): '40.7', ('transport.passengers.metro', 2025): '147641.4'}
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


def cell_value(cell, source_id):
    """The served value text of a cell, or None for a gap: "…" is no data, "-" or "_" is nil (0) unless its table says otherwise."""
    if cell is None:
        raise ValueError('Expected a value, found an empty cell')
    if cell['kind'] == 'n':
        return token(cell)
    if text(cell) in NO_DATA or (text(cell) in NIL and source_id in NIL_IS_GAP):
        return None
    if text(cell) in NIL:
        return '0'
    raise ValueError(f'Unexpected text {text(cell)!r} in {cell["cell"]}')


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
    """The row for a cell, or None when the cell is a gap."""
    if year > LAST_YEAR:
        raise ValueError(f'{indicator_id} {year} is after {LAST_YEAR}')
    try:
        value = cell_value(cell, source_id)
    except ValueError as error:
        raise ValueError(f'{indicator_id} {year} in {source_sheet}: {error}') from None
    if value is None:
        return None
    unit = UNITS[indicator_id.split('.')[1]]
    return {'year': year, 'indicator_id': indicator_id, 'value': value, 'published_value': published(value, UNIT_PLACES[unit]),
            'unit': unit, 'basis': 'actual', 'value_status': 'official', 'source_id': source_id, 'source_sheet': source_sheet,
            'source_cell': cell['cell']}


def only_sheet(source_id):
    (name,) = sheet_names(source_id)
    return name


def year_columns(rows, year_row, label_row, labels):
    """{year: column} of every year heading to 2025 whose sub-heading (none when label_row is None) is in labels; a heading
    after 2025 must sit over a quarter and is left out."""
    found = {}
    for column, cell in rows[year_row].items():
        if cell['kind'] != 'n':
            continue
        year, label = int(cell['value']), text(rows.get(label_row, {}).get(column)) if label_row else ''
        if year > LAST_YEAR:
            if label not in ('I', 'II', 'III', 'IV'):
                raise ValueError(f'Unexpected heading {label!r} under {year}')
            continue
        if label not in labels or year in found:
            raise ValueError(f'Unexpected heading {label!r} under {year}')
        found[year] = column
    if sorted(found) != list(range(min(found), LAST_YEAR + 1)):
        raise ValueError(f'Years are not consecutive: {sorted(found)}')
    return found


def labelled_row(rows, section, label):
    """The row labelled label: the only one in the sheet, or the first below the section heading (a row holding only column A)."""
    if section is None:
        found = [n for n, cells in rows.items() if text(cells.get('A')) == label]
        if len(found) != 1:
            raise ValueError(f'Expected one row {label!r}, found {found}')
        return found[0]
    heads = [n for n, cells in rows.items() if text(cells.get('A')) == section and len(cells) == 1]
    if len(heads) != 1:
        raise ValueError(f'Expected one section {section!r}, found {heads}')
    number = heads[0] + 1
    while number <= max(rows):
        cells = rows.get(number, {})
        if text(cells.get('A')) == label:
            return number
        if len(cells) == 1 and text(cells.get('A')).casefold() != 'of which:':
            break
        number += 1
    raise ValueError(f'No row {label!r} under {section!r}')


def year_heading_row(rows):
    found = [n for n, cells in rows.items() if text(cells.get('B')) == 'Unit']
    if len(found) != 1:
        raise ValueError(f'Expected one Unit heading row, found {found}')
    return found[0]


# H-1 to H-4: one sheet each, a year heading over each column 2000-2025.

def demand_observations():
    rows = []
    for source_id, measure, wanted in ((PASSENGER_DEMAND, 'passenger_km', PASSENGER_ROWS), (FREIGHT_DEMAND, 'tonne_km', FREIGHT_ROWS)):
        name = only_sheet(source_id)
        cells = sheet(source_id, name)
        heading = year_heading_row(cells)
        years = year_columns(cells, heading, None, {''})
        targets = [(f'transport.{measure}.{group}', labelled_row(cells, *key), DEMAND_UNITS[source_id]) for group, key in wanted.items()]
        if source_id == PASSENGER_DEMAND:
            targets.append(('transport.passenger_km_per_person.total', labelled_row(cells, *PER_PERSON_ROW), 'km'))
        for indicator_id, number, unit in targets:
            if text(cells[number].get('B')) != unit:
                raise ValueError(f'Row {number} of {name} is not in {unit}')
            rows += [observation(indicator_id, year, cells[number].get(column), source_id, name) for year, column in years.items()]
        for key in NIL_ROWS[source_id]:
            number = labelled_row(cells, *key)
            if any(text(cells[number].get(column)) != '-' for column in years.values()):
                raise ValueError(f'{key} is no longer nil in every year')
    return rows


def fleet_observations():
    rows = []
    for source_id, kind, labels, served in ((FLEET_FUEL, 'fuel', FUEL_LABELS, FLEET_FUELS), (FLEET_AGE, 'age', AGE_LABELS, FLEET_AGES)):
        name = only_sheet(source_id)
        cells = sheet(source_id, name)
        heading = year_heading_row(cells)
        years = year_columns(cells, heading, None, {''})
        if min(years) != 2000:
            raise ValueError(f'{name} does not start in 2000')
        for type_id, section in FLEET_TYPES.items():
            heads = [n for n, row in cells.items() if text(row.get('A')) == section and len(row) == 1]
            if len(heads) != 1:
                raise ValueError(f'Expected one section {section!r} in {name}')
            wanted = {'': 'Total number', **{f'_{kind}_{key}': label for key, label in labels.items()}}
            for suffix, label in wanted.items():
                number = labelled_row(cells, section, label)
                if text(cells[number].get('B')) != '1000 units':
                    raise ValueError(f'Row {number} of {name} is not in 1000 units')
                found = [observation(f'transport.fleet.{type_id}{suffix}', year, cells[number].get(column), source_id, name)
                         for year, column in years.items()]
                key = suffix.removeprefix(f'_{kind}_')
                if suffix and key not in served[type_id]:
                    if any(row is not None and Decimal(row['value']) != 0 for row in found):
                        raise ValueError(f'{type_id} {label} in {name} is not 0 or nil in every year')
                    continue
                if suffix == '' and source_id == FLEET_AGE:
                    continue  # H-4 prints the same totals as H-3, which serves them; validate() compares the two.
                rows += found
    return rows


def fleet_totals_agree():
    """H-4 prints the same type totals as H-3, cell for cell. Returns the number of cells compared."""
    checked = 0
    tables = {}
    for source_id in (FLEET_FUEL, FLEET_AGE):
        cells = sheet(source_id, only_sheet(source_id))
        heading = year_heading_row(cells)
        tables[source_id] = (cells, year_columns(cells, heading, None, {''}))
    for section in FLEET_TYPES.values():
        found = []
        for source_id in (FLEET_FUEL, FLEET_AGE):
            cells, years = tables[source_id]
            number = labelled_row(cells, section, 'Total number')
            found.append({year: cell_value(cells[number].get(column), source_id) for year, column in years.items()})
        if found[0] != found[1]:
            raise ValueError(f'The {section} totals of H-3 and H-4 differ')
        checked += len(found[0])
    return checked


# Railway, metro, air and sea workbooks.

def rail_observations():
    rows = []
    name = 'Transportation'
    cells = sheet(RAIL_GOODS, name)
    years = year_columns(cells, 2, 3, {'', 'Years'})
    for group, section in RAIL_GOODS_SECTIONS.items():
        number = labelled_row(cells, section, 'Goods, total')
        rows += [observation(f'transport.freight_tonnes.{group}', year, cells[number].get(column), RAIL_GOODS, name)
                 for year, column in years.items()]
    name = 'Number of passengers'
    cells = sheet(RAIL_PASSENGERS, name)
    years = year_columns(cells, 2, 3, {'Year'})
    for group, label in RAIL_PASSENGER_ROWS.items():
        number = min(n for n, row in cells.items() if text(row.get('A')) == label)  # The passenger-km block below repeats the labels.
        if number > 6:
            raise ValueError(f'Row {label!r} of {name} is not in the passenger block')
        rows += [observation(f'transport.passengers.{group}', year, cells[number].get(column), RAIL_PASSENGERS, name)
                 for year, column in years.items()]
    return rows


def metro_observations():
    name = '2012-2025 Y'
    cells = sheet(METRO, name)
    (column,) = [c for c, cell in cells[2].items() if text(cell).startswith('Number of passengers')]
    if text(cells[2].get('A')) != 'Years':
        raise ValueError(f'Unexpected heading in {name}')
    rows = [observation('transport.passengers.metro', int(row['A']['value']), row.get(column), METRO, name)
            for n, row in sorted(cells.items()) if n > 2 and row.get('A', {}).get('kind') == 'n']
    if [row['year'] for row in rows] != list(range(2012, LAST_YEAR + 1)):
        raise ValueError(f'Unexpected years in {name}')
    return rows


def yearly_rows(cells, first):
    """{year: row} of the yearly rows of a quarterly table: the row whose quarter cell is "…" in each year's block of rows."""
    found, year = {}, None
    for number in sorted(n for n in cells if n >= first):
        row = cells[number]
        if row.get('A', {}).get('kind') == 'n':
            year = int(row['A']['value'])
        elif year is None or 'B' not in row:
            continue
        if text(row.get('B')) in NO_DATA:
            if year in found or year > LAST_YEAR:
                raise ValueError(f'Unexpected yearly row {number} for {year}')
            found[year] = number
    if sorted(found) != list(range(min(found), LAST_YEAR + 1)):
        raise ValueError(f'Yearly rows are not consecutive: {sorted(found)}')
    return found


def heading_column(cells, row, label):
    found = [column for column, cell in cells.get(row, {}).items() if text(cell) == label]
    if len(found) != 1:
        raise ValueError(f'Expected one heading {label!r} in row {row}, found {found}')
    return found[0]


def air_sea_observations():
    rows = []
    for name, measure, label in (('Number of passengers by quarter', 'passengers', 'Number of passengers, thsd. Passengers'),
                                 ('Volume of freight by quarter', 'freight_tonnes', 'Freight volume, thsd. Tons')):
        cells = sheet(AIRLINES, name)
        column = heading_column(cells, 2, label)
        rows += [observation(f'transport.{measure}.airlines', year, cells[number].get(column), AIRLINES, name)
                 for year, number in yearly_rows(cells, 3).items()]
    for name, measure, label in (('Passengers carried', 'passengers', 'Passengers carried (thsd. persons)'),
                                 ('Freight carried', 'freight_tonnes', 'Freight and mail volume (thsd. tons)')):
        cells = sheet(AIRPORTS, name)
        years = year_columns(cells, 2, 3, {'Year'})
        number = labelled_row(cells, None, label)
        rows += [observation(f'transport.{measure}.airports', year, cells[number].get(column), AIRPORTS, name)
                 for year, column in years.items()]
    cells = sheet(SEA_PASSENGERS, 'Passenger')
    column = heading_column(cells, 4, 'Passenger Carried, total')
    rows += [observation('transport.passengers.seaports', year, cells[number].get(column), SEA_PASSENGERS, 'Passenger')
             for year, number in yearly_rows(cells, 6).items()]
    cells = sheet(SEA_FREIGHT, 'Freight')
    for group, label in SEA_FREIGHT_COLUMNS.items():
        column = heading_column(cells, 3 if group == 'seaports' else 4, label)
        rows += [observation(f'transport.freight_tonnes.{group}', year, cells[number].get(column), SEA_FREIGHT, 'Freight')
                 for year, number in yearly_rows(cells, 5).items()]
    return rows


# Regional workbooks.

def year_blocks(cells, year_row, label_row, width):
    """{year: [(column, sub-heading)]}: a block starts where the year heading is the next year in sequence from 2017 (the owner
    and age sheets print wrong years over later columns) and runs to the next block's start, or for a fixed width that many
    columns."""
    starts, expected = [], REGISTERED_FIRST_YEAR
    for column in sorted(cells[year_row], key=column_number):
        cell = cells[year_row][column]
        if cell['kind'] == 'n' and cell['value'] == expected:
            starts.append((expected, column_number(column)))
            expected += 1
    if [year for year, _ in starts] != list(range(REGISTERED_FIRST_YEAR, LAST_YEAR + 1)):
        raise ValueError(f'Unexpected year headings: {starts}')
    last = max(column_number(column) for column in cells[label_row])
    blocks = {}
    for index, (year, start) in enumerate(starts):
        end = start + width if width else (starts[index + 1][1] if index + 1 < len(starts) else last + 1)
        blocks[year] = [(column_letters(n), text(cells[label_row].get(column_letters(n)))) for n in range(start, end)]
    return blocks


def area_rows(cells, first, known):
    groups, number = {}, first
    while text(cells.get(number, {}).get('A')):
        label = text(cells[number]['A'])
        if label.casefold() == 'of which:':
            number += 1
            continue
        if label.startswith('Source'):
            break
        group = known.get(label)
        if group is None or group in groups:
            raise ValueError(f'Unexpected row {number}: {label!r}')
        groups[group] = number
        number += 1
    if set(groups) != set(known.values()):
        raise ValueError(f'Unexpected rows: {sorted(groups)}')
    return groups


def registered_observations():
    rows = []
    for category, (name, label_row, labels, width) in REGISTERED_SHEETS.items():
        cells = sheet(REGISTERED, name)
        blocks = year_blocks(cells, 3, label_row, width)
        groups = area_rows(cells, label_row + 1, AREA_ROWS)
        for year, columns in blocks.items():
            if category == 'type':
                columns = [(columns[0][0], text(cells[4].get(columns[0][0])))] + columns[1:]
            suffixes = [labels.get(label) for _, label in columns]
            if None in suffixes or len(set(suffixes)) != len(suffixes):
                raise ValueError(f'Unexpected sub-headings under {year} in {name}: {[label for _, label in columns]}')
            if width and len(suffixes) != len(set(labels.values())):
                raise ValueError(f'Missing sub-headings under {year} in {name}')
            for (column, _), suffix in zip(columns, suffixes):
                for group, number in groups.items():
                    rows.append(observation(f'transport.registered.{group}{suffix}', year, cells[number].get(column), REGISTERED, name))
    return rows


def road_observations():
    name = only_sheet(ROADS)
    cells = sheet(ROADS, name)
    (year_row,) = [n for n, row in cells.items() if any(c['kind'] == 'n' and c['value'] == ROAD_YEARS[0] for c in row.values())
                   and 'A' not in row]
    rows = []
    groups = area_rows(cells, year_row + 3, ROAD_ROWS)
    years = {int(cell['value']): column_number(column) for column, cell in cells[year_row].items() if cell['kind'] == 'n'}
    if sorted(years) != list(ROAD_YEARS):
        raise ValueError(f'Unexpected road years: {sorted(years)}')
    for year, start in years.items():
        columns = [column_letters(start + offset) for offset in range(4)]
        headings = [text(cells[year_row + 1].get(columns[0])).casefold()] + [text(cells[year_row + 2].get(c)).casefold() for c in columns[1:]]
        if headings != ROAD_SUBHEADINGS:
            raise ValueError(f'Unexpected road headings under {year}: {headings}')
        for column, suffix in zip(columns, ROAD_COLUMNS):
            for group, number in groups.items():
                rows.append(observation(f'transport.road_km.{group}{suffix}', year, cells[number].get(column), ROADS, name))
    return rows


def extract():
    """Every served observation, transcribed from its original cell."""
    rows = (demand_observations() + fleet_observations() + rail_observations() + metro_observations() + air_sea_observations()
            + registered_observations() + road_observations())
    return [row for row in rows if row is not None]


def expected_keys():
    """Every (indicator, year) the package serves, written out from the tables' published coverage."""
    def years(first, last=LAST_YEAR, without=()):
        return [year for year in range(first, last + 1) if year not in without]

    coverage = {}
    for type_id in FLEET_TYPES:
        coverage[f'fleet.{type_id}'] = years(2000, without={2004, 2005, 2006} if type_id == 'special' else {2004, 2005})
        for fuel in FLEET_FUELS[type_id]:
            coverage[f'fleet.{type_id}_fuel_{fuel}'] = years(2022 if fuel == 'hybrid_gas' else 2017)
        for band in FLEET_AGES[type_id]:
            coverage[f'fleet.{type_id}_age_{band}'] = years(2017)
    for group in PASSENGER_ROWS:
        coverage[f'passenger_km.{group}'] = years(2000)
    coverage['passenger_km_per_person.total'] = years(2000)
    for group in FREIGHT_ROWS:
        coverage[f'tonne_km.{group}'] = years(2000, 2012, without={2009, 2010}) if group == 'sea' else years(2000)
    for group in RAIL_PASSENGER_ROWS:
        coverage[f'passengers.{group}'] = years(2018)
    coverage.update({'passengers.metro': years(2012), 'passengers.airlines': years(2012), 'passengers.airports': years(2015),
                     'passengers.seaports': years(2020), 'freight_tonnes.airlines': years(2012), 'freight_tonnes.airports': years(2015)})
    for group in RAIL_GOODS_SECTIONS:
        coverage[f'freight_tonnes.{group}'] = years(2018)
    for group in SEA_FREIGHT_COLUMNS:
        coverage[f'freight_tonnes.{group}'] = years(2020)
    suffixes = {suffix for _, _, labels, _ in REGISTERED_SHEETS.values() for suffix in labels.values()}
    for area in REGISTERED_AREAS:
        for suffix in suffixes:
            coverage[f'registered.{area}{suffix}'] = list(REGISTERED_YEARS.get(suffix, years(REGISTERED_FIRST_YEAR)))
    for area in set(ROAD_ROWS.values()):
        for suffix in ROAD_COLUMNS:
            coverage[f'road_km.{area}{suffix}'] = list(ROAD_YEARS)
    return {(f'transport.{indicator}', year) for indicator, found in coverage.items() for year in found}


def source_cell(row):
    column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    return sheet(row['source_id'], row['source_sheet']).get(int(number), {}).get(column)


def sums():
    """(check name, total, parts, tolerance) of every printed total and the parts Geostat prints beneath it, by indicator id
    without the transport prefix; each is checked in every year that has the total and a part."""
    checks = []
    for type_id in FLEET_TYPES:
        checks.append(('fuel', f'fleet.{type_id}', [f'fleet.{type_id}_fuel_{fuel}' for fuel in FLEET_FUELS[type_id]], 'national'))
        # H-4's age rows are cumulative: up to 10 years, over 10 years and unknown make the total.
        checks.append(('age', f'fleet.{type_id}', [f'fleet.{type_id}_age_{band}' for band in ('up_to_10', 'over_10', 'unknown')],
                       'national'))
    checks.append(('mode', 'passenger_km.total', [f'passenger_km.{group}' for group in PASSENGER_ROWS if group != 'total'], 'modes'))
    checks.append(('mode', 'tonne_km.total', [f'tonne_km.{group}' for group in FREIGHT_ROWS if group != 'total'], 'modes'))
    checks.append(('direction', 'freight_tonnes.rail', [f'freight_tonnes.{group}' for group in RAIL_GOODS_SECTIONS if group != 'rail'], 'national'))
    checks.append(('direction', 'passengers.rail', ['passengers.rail_domestic', 'passengers.rail_international'], 'national'))
    checks.append(('cargo', 'freight_tonnes.seaports', [f'freight_tonnes.{group}' for group in SEA_FREIGHT_COLUMNS if group != 'seaports'],
                   'national'))
    for category, (_, _, labels, _) in REGISTERED_SHEETS.items():
        parts = sorted(set(labels.values()) - {''})
        for suffix in ['', *parts]:
            checks.append(('region', f'registered.total{suffix}', [f'registered.{area}{suffix}' for area in REGISTERED_AREAS[1:]], 'regional'))
        for area in REGISTERED_AREAS:
            checks.append((category, f'registered.{area}', [f'registered.{area}{suffix}' for suffix in parts], 'regional'))
    road_areas = [area for area in ROAD_ROWS.values() if area != 'total']
    for suffix in ROAD_COLUMNS:
        checks.append(('region', f'road_km.total{suffix}', [f'road_km.{area}{suffix}' for area in road_areas], 'regional'))
    for area in ROAD_ROWS.values():
        checks.append(('road type', f'road_km.{area}', [f'road_km.{area}{suffix}' for suffix in ROAD_COLUMNS[1:]], 'regional'))
    return [(f'{total} by {label}', total, parts, kind) for label, total, parts, kind in checks]


def validate(rows):
    keys, values = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        if row['unit'] != UNITS[row['indicator_id'].split('.')[1]] or (row['basis'], row['value_status']) != ('actual', 'official'):
            raise ValueError(f'Unexpected unit or status: {key}')
        if published(Decimal(row['value']), UNIT_PLACES[row['unit']]) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        values[key] = Decimal(row['value'])
    if keys != expected_keys():
        raise ValueError(f'Coverage mismatch: {len(expected_keys() - keys)} missing, {len(keys - expected_keys())} extra')
    checked = 0
    for name, total, parts, kind in sums():
        for year in sorted({year for indicator, year in keys if indicator == f'transport.{total}'}):
            if not any((f'transport.{part}', year) in values for part in parts):
                continue  # Geostat prints no breakdown for this year.
            difference = sum(values.get((f'transport.{part}', year), Decimal(0)) for part in parts) - values[(f'transport.{total}', year)]
            known = KNOWN_DIFFERENCES.get((name, year))
            if (str(difference) != known) if known is not None else abs(difference) > TOLERANCE[kind]:
                raise ValueError(f'The parts of {name} do not add up to the total in {year} as recorded ({difference})')
            checked += 1
    shown = {(row['indicator_id'], row['year']): row['published_value'] for row in rows}
    for key, expected in ANCHORS.items():
        if shown.get(key) != expected:
            raise ValueError(f'The anchor value does not match Geostat: {key}')
    for row in rows:
        if cell_value(source_cell(row), row['source_id']) != row['value']:
            raise ValueError(f'The value does not match its source cell: {row["indicator_id"]} {row["year"]} {row["source_cell"]}')
    return {'totals_compared': checked, 'fleet_totals_compared': fleet_totals_agree()}


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
        'scope': 'Annual research only: the road vehicle fleet by type, fuel and age (H-3, H-4), passenger and freight transport '
                 'demand by mode (H-1, H-2), passengers and freight carried by railway, metro, airports, Georgian airlines and sea '
                 'ports, registered vehicles by region, type, fuel, owner and age, and road length by region; yearly values to '
                 '2025 only, no quarters, no 2026 values, no percentage rows',
        'primary_observation_count': len(rows), 'observations_by_measure': dict(sorted(by_measure.items())),
        'observations_by_source': dict(sorted(by_source.items())), 'indicator_count': len(by_indicator),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'values_match_source_cells': True,
            'published_values_are_rounded_stored_values_at_unit_precision': True,
            'nil_cells': 'served as 0 where the table legend says magnitude nil; gaps in H-2, whose legend says data not available',
            'parts_add_up_to_totals': {'tolerance': {kind: str(t) for kind, t in TOLERANCE.items()},
                                       'totals_compared': agreement['totals_compared']},
            'recorded_differences_parts_minus_total': {f'{i}:{y}': d for (i, y), d in KNOWN_DIFFERENCES.items()},
            'h3_and_h4_totals_equal': agreement['fleet_totals_compared'],
            'rows_nil_in_every_year_not_served': True, 'no_2026_or_quarter_values': True,
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'transport-annual.csv': csv_bytes(rows, FIELDS),
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
