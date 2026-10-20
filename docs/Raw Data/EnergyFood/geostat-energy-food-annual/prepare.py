"""Reproduce and check the annual energy and food research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader and CSV writer are reused from the unemployment package, as the Poverty package does.
Rows and columns are found by their printed label text, never by fixed positions.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild

The .xls efficiency workbook cannot be read here; its cross-check lives in verify_independent.mjs.
"""

import argparse
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import functools
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile


sys.dont_write_bytecode = True  # Loading the shared reader must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, read_sheet, NS = _shared.clean, _shared.csv_bytes, _shared.read_sheet, _shared.NS

RETRIEVED_AT = '2026-10-11'
FARMING_RETRIEVED_AT = '2026-10-20'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
XLS = 'application/vnd.ms-excel'
HTML = 'text/html; charset=UTF-8'
SITE = 'https://www.geostat.ge'
YEARS = range(2013, 2025)
BALANCE_PAGES = {2013: 82, 2014: 83, 2015: 84, 2016: 85, 2017: 86, 2018: 631, 2019: 681, 2020: 719, 2021: 786,
                 2022: 821, 2023: 864, 2024: 891}
# The file 1 (aggregated) and file 2 (electricity and heat) links on each year's page, under https://geostat.ge/media/.
BALANCE_MEDIA = {
    2013: ('42565/1.Aggregated-Energy-Balance_ENG.xlsx', '36290/2.Electricity-and-heat_ENG.xlsx'),
    2014: ('42569/1.-Aggregated-Energy-Balance_ENG.xlsx', '36314/2.-Electricity-and-heat_ENG.xlsx'),
    2015: ('43224/1.-Aggregated-Energy-Balance_ENG.xlsx', '43225/2.-Electricity-and-heat_ENG.xlsx'),
    2016: ('43238/1.-Aggregated-Energy-Balance_ENG.xlsx', '43239/2.-Electricity-and-heat_ENG.xlsx'),
    2017: ('43250/1.-Aggregated-Energy-Balance.xlsx', '43251/2.-Electricity-and-heat.xlsx'),
    2018: ('43263/1.-Aggregated-Energy-Balance_ENG.xlsx', '43264/2.-Electricity-and-heat_ENG.xlsx'),
    2019: ('43275/1.-Aggregated-Energy-Balance_ENG.xlsx', '43276/2.-Electricity-and-heat_ENG.xlsx'),
    2020: ('43287/1.-Aggregated-Energy-Balance-ENG.xlsx', '43288/2.-Electricity-and-heat_ENG.xlsx'),
    2021: ('50318/1.-Aggregated-Energy-Balance-ENG.xlsx', '50319/2.-Electricity-and-heat_ENG.xlsx'),
    2022: ('59325/1.-Aggregated-Energy-Balance-ENG.xlsx', '59209/2.-Electricity-and-heat_ENG.xlsx'),
    2023: ('67504/1.-Aggregated-Energy-Balance-ENG.xlsx', '67505/2.-Electricity-and-heat_ENG.xlsx'),
    2024: ('75762/1.-Aggregated-Energy-Balance-ENG.xlsx', '75706/2.-Electricity-and-heat_ENG.xlsx'),
}
# Geostat Agriculture (categories/196): (title, English media path, Georgian media path), under https://geostat.ge/media/.
FARMING_FILES = {
    'general': ('General agricultural statistics', '80145/1.General_Agro_Sector_Statistics_ENG.xlsx',
                '80131/1.soflis_meurneobis_seqtoris_zogadi_statistika_GEO.xlsx'),
    'annual_crops': ('Production of annual crops', '80146/3.Production_of_Annual_Crops_ENG.XLSX',
                     '80132/3.ertwliani_kulturebis_warmoeba_GEO.XLSX'),
    'permanent_crops': ('Production of permanent crops', '80149/6.Production_of_Permanent_Crops_ENG.xlsx',
                        '80135/6.mravalwlovani_kulturebis_warmoeba_GEO.xlsx'),
    'livestock_numbers': ('Number of livestock (annual)', '80150/8.Livestock_Numbers_%28Annual%29_ENG.xlsx',
                          '80136/8.pirutyvis_suladoba_%28wliuri%29_GEO.xlsx'),
    'livestock_products': ('Production of livestock products (annual)', '82387/10.Livestock_Products_%28Annual%29_ENG.XLSX',
                           '82386/10.mecxoveleobis_produqtebis_warmoeba_%28wliuri%29_GEO.XLSX'),
    'prices': ('Agricultural production prices (farm-gate prices)', '81972/17.Agricultural_Production_Prices_ENG.XLSX',
               '81971/17.sasoflo_sameurneo_produqtebis_fasebi_GEO.XLSX'),
}


def _sources():
    """(source_id, title, source page, retrieved URL, resolved URL, local file, content type)"""
    out = []
    for year in YEARS:
        page = f'{SITE}/en/modules/categories/{BALANCE_PAGES[year]}'
        slug = f'{page}/energy-balance-of-georgia-{year}'
        for kind, media, title in zip(('aggregated', 'electricity'), BALANCE_MEDIA[year],
                                      ('Aggregated Energy Balance', 'Electricity and heat')):
            out.append((f'geostat_energy_balance_{year}_{kind}', f'{title}, {year} (Energy Balance of Georgia {year})', page,
                        f'https://geostat.ge/media/{media}', f'{SITE}/media/{media}',
                        f'official/energy-balance-{year}-{kind}.xlsx', XLSX))
    efficiency = f'{SITE}/en/modules/categories/789'
    food = f'{SITE}/en/modules/categories/297'
    out += [
        ('geostat_energy_efficiency', 'Energy efficiency indicators, 2013-2024', efficiency,
         'https://geostat.ge/media/75778/Energy-efficiency_ENG.XLS', f'{SITE}/media/75778/Energy-efficiency_ENG.XLS',
         'official/energy-efficiency.xls', XLS),
        ('geostat_food_balance_sheets', 'Food balance sheets, 2014-2025', food,
         'https://geostat.ge/media/80160/1.Food_Balance_Sheets_ENG.xlsx', f'{SITE}/media/80160/1.Food_Balance_Sheets_ENG.xlsx',
         'official/food-balance-sheets.xlsx', XLSX),
        ('geostat_energy_balance_2024_aggregated_ka', 'Aggregated Energy Balance, 2024 (Georgian labels)',
         f'{SITE}/ka/modules/categories/891', 'https://geostat.ge/media/75761/1.-Aggrageted-Balance_GEO.xlsx',
         f'{SITE}/media/75761/1.-Aggrageted-Balance_GEO.xlsx', 'official/ka/energy-balance-2024-aggregated-ka.xlsx', XLSX),
        ('geostat_food_balance_sheets_ka', 'Food balance sheets (Georgian labels)', f'{SITE}/ka/modules/categories/297',
         'https://geostat.ge/media/80159/1.sasursato_balansebi_GEO.xlsx', f'{SITE}/media/80159/1.sasursato_balansebi_GEO.xlsx',
         'official/ka/food-balance-sheets-ka.xlsx', XLSX),
    ]
    for year in YEARS:
        page = f'{SITE}/en/modules/categories/{BALANCE_PAGES[year]}'
        out.append((f'geostat_energy_balance_page_{year}', f'Energy Balance of Georgia {year} (source page capture)', page, page,
                    f'{page}/energy-balance-of-georgia-{year}', f'official/energy-balance-page-{year}.html', HTML))
    index, food_page = f'{SITE}/en/modules/categories/328', f'{SITE}/en/modules/categories/297'
    out += [('geostat_energy_balance_index_page', 'Energy Balance of Georgia (index page capture)', index, index,
             f'{index}/energy-balance-of-georgia', 'official/energy-balance-index-page.html', HTML),
            ('geostat_food_security_page', 'Food Security (source page capture)', food_page, food_page,
             f'{food_page}/food-security', 'official/food-security-page.html', HTML)]
    farming, farming_ka = f'{SITE}/en/modules/categories/196', f'{SITE}/ka/modules/categories/196'
    for key, (title, media, media_ka) in FARMING_FILES.items():
        local = key.replace('_', '-')
        out.append((f'geostat_farming_{key}', f'{title} (Agriculture)', farming, f'https://geostat.ge/media/{media}', f'{SITE}/media/{media}',
                    f'official/farming-{local}.xlsx', XLSX))
        out.append((f'geostat_farming_{key}_ka', f'{title} (Georgian labels)', farming_ka, f'https://geostat.ge/media/{media_ka}',
                    f'{SITE}/media/{media_ka}', f'official/ka/farming-{local}-ka.xlsx', XLSX))
    out.append(('geostat_agriculture_page', 'Agriculture (source page capture)', farming, farming, f'{farming}/agriculture',
                'official/agriculture-page.html', HTML))
    return out


def retrieved_at(source_id):
    return FARMING_RETRIEVED_AT if source_id.startswith(('geostat_farming_', 'geostat_agriculture_')) else RETRIEVED_AT


SOURCES = _sources()
LOCAL_FILE = {source[0]: source[5] for source in SOURCES}

FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id',
          'source_sheet', 'source_cell', 'source_label', 'source_number_format']
ONE_DECIMAL = Decimal('0.1')
NUMBER = re.compile(r'-?\d+(\.\d+)?')

# Fuel columns of the KTOE sheet, by the text of their header. Geostat's wording of the renewables column changed
# over the years ("Geothermal, solar etc." in 2013, "Geothermal, wind, solar etc" from 2017), so it matches by its first word.
KTOE_COLUMNS = {'coal': 'coal', 'crude_oil': 'crude oil', 'oil_products': 'oil products', 'natural_gas': 'natural gas',
                'nuclear': 'nuclear', 'hydro': 'hydro', 'wind_solar_geothermal': 'geothermal*', 'biofuel_waste': 'biofuel & waste',
                'electricity': 'electricity', 'heat': 'heat', 'total': 'total'}
SUPPLY_FUELS = ['coal', 'crude_oil', 'oil_products', 'natural_gas', 'hydro', 'wind_solar_geothermal', 'biofuel_waste', 'electricity']
IMPORT_FUELS = ['coal', 'crude_oil', 'oil_products', 'natural_gas', 'electricity']
FINAL_FUELS = ['coal', 'oil_products', 'natural_gas', 'wind_solar_geothermal', 'biofuel_waste', 'electricity']
# (indicator ID, row label, column key). Rows after "final consumption" are the first match below that row.
KTOE_CELLS = ([('energy.supply.' + key, 'domestic supply', key) for key in ['total'] + SUPPLY_FUELS] +
              [('energy.production.total', 'production', 'total'), ('energy.exports.total', 'exports', 'total')] +
              [('energy.imports.' + key, 'imports', key) for key in ['total'] + IMPORT_FUELS] +
              [('energy.final.total', 'final consumption', 'total'),
               ('energy.final.industry', 'industry', 'total'), ('energy.final.transport', 'transport', 'total'),
               ('energy.final.commercial_public', 'commercial and public services', 'total'),
               ('energy.final.households', 'residential', 'total'),
               ('energy.final.agriculture', 'agriculture/forestry/fishing', 'total'),
               ('energy.final.other_unspecified', 'not elsewhere specified (other)', 'total'),
               ('energy.final.non_energy', 'non-energy use', 'total')] +
              [('energy.final_fuel.' + key, 'final consumption', key) for key in FINAL_FUELS])
# Geostat renamed the electricity loss row in the 2016-2018 workbooks; the identity in check_electricity_losses ties it to the same flow.
LOSSES_LABELS = {'losses': range(2013, 2025), 'distribution losses': range(2016, 2019)}
ELECTRICITY_CELLS = [('electricity.production.total', 'production', None), ('electricity.imports', 'imports', None),
                     ('electricity.exports', 'exports', None), ('electricity.losses', 'losses', None),
                     ('electricity.production.thermal', 'ma thermal electricity plants', 'transformation sector-production'),
                     ('electricity.production.hydro', 'ma hydro electricity plants', 'transformation sector-production'),
                     ('electricity.production.wind', 'wind electricity plants', 'transformation sector-production'),
                     ('electricity.final.total', 'final consumption', None),
                     ('electricity.final.industry', 'industry', 'final consumption'),
                     ('electricity.final.transport', 'transport', 'final consumption'),
                     ('electricity.final.commercial_public', 'commercial and public services', 'final consumption'),
                     ('electricity.final.households', 'residential', 'final consumption'),
                     ('electricity.final.agriculture', 'agriculture/forestry/fishing', 'final consumption'),
                     ('electricity.final.other_unspecified', 'not elsewhere specified (other)', 'final consumption')]
WIND_FIRST_YEAR = 2016
FOODS = {'wheat': 'Wheat', 'maize': 'Maize', 'potato': 'Potato', 'vegetables': 'Vegetables', 'grapes': 'Grapes',
         'meat': 'Meat', 'beef': 'Beef', 'pork': 'Pork', 'sheep_goat_meat': 'Sheep and Goat Meat',
         'poultry_meat': 'Poultry Meat', 'milk': 'Milk and Milk Products', 'eggs': 'Egg'}
FOOD_YEARS = range(2014, 2026)
# (indicator ID, source key, sheet, printed row label, unit). The list order is the page's list order.
FARMING_SHEETS = {'general': 'AG. output', 'annual_crops': 'Production', 'permanent_crops': 'Permanent Crops production',
                  'livestock_numbers': 'Number of livestock', 'livestock_products': 'Livestock products', 'prices': 'Prices'}
FARMING_CELLS = (
    [(f'farming.output.{key}', 'general', label, 'million_gel') for key, label in
     (('total', 'output of agriculture, total'), ('crops', 'plant growing'), ('livestock', 'animal husbandry'),
      ('services', 'agricultural services'))] +
    [(f'farming.harvest.{key}', 'annual_crops', label, 'thousand_tonnes') for key, label in
     (('wheat', 'wheat, total'), ('barley', 'barley, total'), ('maize', 'maize'), ('beans', 'haricot beans'), ('potatoes', 'potato'),
      ('vegetables', 'vegetables, total'), ('melons', 'melons'))] +
    [(f'farming.harvest.{key}', 'permanent_crops', label, 'thousand_tonnes') for key, label in
     (('grapes', 'grapes'), ('apples', 'apple'), ('peaches', 'peach, nectarine'), ('tangerines', 'tangerine'),
      ('hazelnuts', 'hazelnut'), ('walnuts', 'walnut'))] +
    [(f'farming.livestock.{key}', 'livestock_numbers', label, 'thousand_head') for key, label in
     (('cattle', 'bovine animals'), ('dairy_cows', 'dairy cows and buffaloes'), ('pigs', 'pigs'), ('sheep_goats', 'sheep and goats'),
      ('poultry', 'poultry, ths. heads'))] +
    [(f'farming.products.{key}', 'livestock_products', label, unit) for key, label, unit in
     (('meat', 'meat, total', 'thousand_tonnes'), ('beef', 'beef', 'thousand_tonnes'), ('pork', 'pork', 'thousand_tonnes'),
      ('sheep_goat_meat', 'sheep and goat', 'thousand_tonnes'), ('poultry_meat', 'poultry', 'thousand_tonnes'),
      ('milk', 'milk (mill. litres)', 'million_litres'), ('eggs', 'egg (mill. pieces)', 'million_pieces'))] +
    [(f'farming.price.{key}', 'prices', label, unit) for key, label, unit in
     (('wheat', 'wheat', 'gel_per_kg'), ('maize', 'maize', 'gel_per_kg'), ('potatoes', 'potato', 'gel_per_kg'),
      ('tomatoes', 'tomato', 'gel_per_kg'), ('apples', 'apple', 'gel_per_kg'), ('grapes', 'grapes', 'gel_per_kg'),
      ('hazelnuts', 'hazelnut', 'gel_per_kg'), ('beef', 'beef', 'gel_per_kg'), ('pork', 'pork', 'gel_per_kg'),
      ('poultry_meat', 'poultry meat', 'gel_per_kg'), ('milk', 'milk (1 litre)', 'gel_per_litre'), ('eggs', 'egg (1 piece)', 'gel_per_piece'))])
FARMING_UNITS = {indicator_id: unit for indicator_id, _, _, unit in FARMING_CELLS}
FARMING_YEARS = {'output': (2010, 2025), 'price': (2014, 2025)}  # every other farming row runs 2006-2025
# Decimals a farming cell's number format shows. A price cell may also be General (shows the stored value, at most 2 decimals).
FARMING_FORMAT_DECIMALS = {'#,##0.0': 1, '0.0': 1, '#\\ ##0.0': 1, '0.00': 2}
# The food balance sheet's "Domestic production" (whole thousand tonnes) against the farm table it should repeat.
FOOD_PRODUCTION = {'wheat': 'farming.harvest.wheat', 'maize': 'farming.harvest.maize', 'potato': 'farming.harvest.potatoes',
                   'vegetables': 'farming.harvest.vegetables', 'grapes': 'farming.harvest.grapes', 'meat': 'farming.products.meat',
                   'beef': 'farming.products.beef', 'pork': 'farming.products.pork', 'sheep_goat_meat': 'farming.products.sheep_goat_meat',
                   'poultry_meat': 'farming.products.poultry_meat', 'milk': 'farming.products.milk', 'eggs': 'farming.products.eggs'}
# Known differences, with no reason given by Geostat: grapes 2014 is 165 in the balance sheet and 172.6 in the crop table.
FOOD_PRODUCTION_EXCEPTIONS = {('grapes', 2014)}


def _coverage():
    coverage = {}
    for indicator_id, _, _ in KTOE_CELLS:
        coverage[indicator_id] = (2013, 2024)
    for indicator_id, _, _ in ELECTRICITY_CELLS:
        coverage[indicator_id] = (WIND_FIRST_YEAR if indicator_id.endswith('.wind') else 2013, 2024)
    for food in FOODS:
        coverage[f'food.self_sufficiency.{food}'] = (2014, 2025)
    for indicator_id in FARMING_UNITS:
        coverage[indicator_id] = FARMING_YEARS.get(indicator_id.split('.')[1], (2006, 2025))
    return coverage


COVERAGE = _coverage()
PAGE_GROUPS = {'supply page': ('supply', 'production', 'imports', 'exports'), 'use page': ('final', 'final_fuel')}


# ---------------------------------------------------------------- reading

def norm(text):
    """A label as compared: whitespace collapsed, lower case, footnote markers and a trailing star dropped."""
    text = clean(str(text)).lower()
    text = re.sub(r'\[\d+\]|(?<=[a-z)])\d+$', '', text)  # "Mining and quarrying1", "Iron and steel[1]"
    text = re.sub(r'\s*\*+$', '', text)  # "Import *"
    text = re.sub(r'\s*-\s*', '-', text)  # "Transformation Sector - Production" and "Transformation Sector-Production"
    text = re.sub(r'\s*,\s*', ', ', text)  # "ratio,%" and "ratio, %"
    text = re.sub(r'\s*\(', ' (', text)  # "specified(Industry)"
    return text.strip()


def sheet_names(path):
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    return [sheet.get('name') for sheet in workbook.findall('x:sheets/x:sheet', NS)]


def sheet_name(path, wanted):
    """The workbook's own spelling of a sheet name (Geostat writes both "GWh&TJ" and "GWH&TJ")."""
    matches = [name for name in sheet_names(path) if name.lower() == wanted.lower()]
    if len(matches) != 1:
        raise ValueError(f'Expected one sheet named {wanted} in {Path(path).name}, found {matches}')
    return matches[0]


def read_named(path, wanted):
    """Rows of a sheet found by name, case-insensitively. The shared reader resolves the part through the workbook relationships."""
    return read_sheet(Path(path), sheet_name(path, wanted))


@functools.lru_cache(maxsize=None)
def _cached_sheet(source_id, name):
    return read_named(ROOT / LOCAL_FILE[source_id], name)


def reread(source_id, name, address):
    """The cell at `address`, re-read from the preserved original."""
    column, row = re.fullmatch(r'([A-Z]+)(\d+)', address).groups()
    return _cached_sheet(source_id, name)[int(row)][column]


def _row_label(sheet, number):
    cell = sheet.get(number, {}).get('A')
    return norm(cell['value']) if cell and cell['kind'] == 's' else None


def find_row(sheet, label, after=None, until=None, required=True):
    """The row number of a label. Without `after` the label must be unique. With `after` it is the first match below
    that row's label; `until` ends the search at the first row with that label."""
    labels = {label} if isinstance(label, str) else set(label)
    start = find_row(sheet, after) if after else 0
    end = find_row(sheet, until, after=after, required=False) if until else None
    matches = [number for number in sorted(sheet) if number > start and (end is None or number < end) and _row_label(sheet, number) in labels]
    if not matches or (after is None and len(matches) > 1):
        if not required and not matches:
            return None
        raise ValueError(f'Expected row {sorted(labels)} not found exactly once' + (f' below {after}' if after else '') + f': {matches}')
    return matches[0]


def header_row(sheet, kind):
    """The row holding column headings: KTOE fuels, the electricity (GWh) column, or the year columns of a food sheet."""
    for number in sorted(sheet):
        texts = [norm(cell['value']) for cell in sheet[number].values() if cell['kind'] == 's']
        if (kind == 'ktoe' and 'coal' in texts and 'total' in texts) or \
                (kind == 'electricity' and 'electricity (gwh)' in texts) or (kind == 'food' and _row_label(sheet, number) == 'indicators') or \
                (kind == 'farming' and len(_year_cells(sheet[number])) >= 5):
            return number
    raise ValueError(f'No heading row found in the {kind} sheet')


YEAR = re.compile(r'(\d{4})(\*?)')


def _year_cells(row):
    """{column: (year, preliminary)} for the cells of a row that are years: 2006 as a number, or "2025*" (preliminary)."""
    years = {}
    for column, cell in row.items():
        if column == 'A':
            continue
        text = str(int(cell['value'])) if cell['kind'] == 'n' and cell['value'] == int(cell['value']) else clean(str(cell['value']))
        match = YEAR.fullmatch(text)
        if match and 2000 <= int(match[1]) <= 2100:
            years[column] = (int(match[1]), bool(match[2]))
    return years


def farming_years(sheet):
    return _year_cells(sheet[header_row(sheet, 'farming')])


def _heading(sheet, kind, column):
    cell = sheet[header_row(sheet, kind)][column]
    return str(int(cell['value'])) if cell['kind'] == 'n' else clean(cell['value'])


@functools.lru_cache(maxsize=None)
def read_ktoe(year):
    """The aggregated balance's KTOE sheet and a map from fuel key to its column letter."""
    sheet = _cached_sheet(f'geostat_energy_balance_{year}_aggregated', 'KTOE')
    headings = {column: norm(cell['value']) for column, cell in sheet[header_row(sheet, 'ktoe')].items() if cell['kind'] == 's'}
    columns = {}
    for key, wanted in KTOE_COLUMNS.items():
        found = [column for column, text in headings.items() if (text.startswith('geothermal') if wanted.endswith('*') else text == wanted)]
        if len(found) != 1:
            raise ValueError(f'Expected one {key} column in the {year} KTOE sheet, found {found}')
        columns[key] = found[0]
    if len(set(columns.values())) != len(KTOE_COLUMNS) or set(headings) != set(columns.values()):
        raise ValueError(f'Unexpected KTOE columns in {year}: {sorted(headings.values())}')
    return sheet, columns


@functools.lru_cache(maxsize=None)
def read_electricity(year):
    """The electricity workbook's GWh sheet, its sheet name and the column letter of "Electricity (GWh)"."""
    source_id = f'geostat_energy_balance_{year}_electricity'
    name = sheet_name(ROOT / LOCAL_FILE[source_id], 'GWh&TJ')
    sheet = _cached_sheet(source_id, name)
    found = [column for column, cell in sheet[header_row(sheet, 'electricity')].items() if cell['kind'] == 's' and norm(cell['value']) == 'electricity (gwh)']
    if len(found) != 1:
        raise ValueError(f'Expected one Electricity (GWh) column in {year}')
    return sheet, name, found[0]


def cell_value(cell, farming=False):
    """(exact stored token, status). In an energy balance a dash means the flow did not occur and is served as 0; in a
    farming table it means no data (the survey sample was too small), which no served cell may be. An ellipsis is a gap."""
    if cell is None:
        raise ValueError('Unexpected empty cell')
    if cell['kind'] == 'n' and isinstance(cell['value'], Decimal):
        return str(cell['value']), 'published'
    if cell['kind'] == 's':
        text = clean(cell['value'])
        if text == '-' and farming:
            raise ValueError('Dash (data not available) in a served farming cell')
        if text == '-':
            return '0', 'no_flow'
        if text == '…':
            raise ValueError('Ellipsis (not published) in a served cell')
    raise ValueError(f'Unexpected cell content: {cell}')


def display(indicator_id, year, value, number_format=None):
    """The value as Geostat shows it. Energy shows one decimal. A food ratio follows its own cell's number format:
    "0" shows whole percent (47.1 shows as 47) and "General" shows the stored value."""
    shown = Decimal(format(float(value), '.15g'))  # Excel keeps 15 significant digits, so 2235.4499999999998 shows as 2235.45
    if indicator_id.startswith('farming.'):
        if number_format == 'General' and indicator_id.startswith('farming.price.'):
            if -shown.normalize().as_tuple().exponent > 2:
                raise ValueError(f'A General price cell has more than 2 decimals: {indicator_id}:{year}')
            return str(shown.quantize(Decimal('0.01')))
        if number_format not in FARMING_FORMAT_DECIMALS:
            raise ValueError(f'Unexpected farming number format {number_format}: {indicator_id}:{year}')
        return str(shown.quantize(Decimal(1).scaleb(-FARMING_FORMAT_DECIMALS[number_format]), rounding=ROUND_HALF_UP))
    if indicator_id.startswith('food.'):
        if number_format == '0':
            return str(int(shown.quantize(Decimal(1), rounding=ROUND_HALF_UP)))
        if number_format == 'General':
            return format(shown.normalize(), 'f')
        raise ValueError(f'Unexpected food number format {number_format}: {indicator_id}:{year}')
    return str(shown.quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP))


def _unit(indicator_id):
    if indicator_id.startswith('farming.'):
        return FARMING_UNITS[indicator_id]
    return 'percent' if indicator_id.startswith('food.') else 'gwh' if indicator_id.startswith('electricity.') else 'ktoe'


def _observation(rows, source_id, name, indicator_id, year, sheet, kind, number, column, preliminary=False):
    cell = sheet.get(number, {}).get(column)
    token, status = cell_value(cell, farming=kind == 'farming')
    if preliminary:
        status = 'preliminary'
    if not NUMBER.fullmatch(token):
        raise ValueError(f'Stored value is not a plain decimal: {indicator_id}:{year}: {token}')
    rows.append({
        'year': year, 'indicator_id': indicator_id, 'value': token, 'published_value': display(indicator_id, year, Decimal(token), cell['format']),
        'unit': _unit(indicator_id), 'basis': 'actual', 'value_status': status, 'source_id': source_id, 'source_sheet': name,
        'source_cell': cell['cell'], 'source_label': _label(sheet, kind, number, column), 'source_number_format': cell['format']})


def _label(sheet, kind, number, column):
    return f"{clean(sheet[number]['A']['value'])} | {_heading(sheet, kind, column)}"


# ---------------------------------------------------------------- extraction

def _ktoe_rows(year):
    sheet, columns = read_ktoe(year)
    return {label: find_row(sheet, label, after=None if label in ('production', 'imports', 'exports', 'domestic supply', 'final consumption') else 'final consumption')
            for label in {label for _, label, _ in KTOE_CELLS}}


def extract():
    """Every primary observation, located by label text and re-read from its original cell."""
    rows = []
    for year in YEARS:
        sheet, columns = read_ktoe(year)
        numbers = _ktoe_rows(year)
        source_id = f'geostat_energy_balance_{year}_aggregated'
        for indicator_id, label, key in KTOE_CELLS:
            _observation(rows, source_id, 'KTOE', indicator_id, year, sheet, 'ktoe', numbers[label], columns[key])

        sheet, name, column = read_electricity(year)
        source_id = f'geostat_energy_balance_{year}_electricity'
        for indicator_id, label, block in ELECTRICITY_CELLS:
            if indicator_id == 'electricity.losses':
                label = {text for text, years in LOSSES_LABELS.items() if year in years}
            number = find_row(sheet, label, after=block, until='energy sector' if block == 'transformation sector-production' else None,
                              required=not (indicator_id.endswith('.wind') and year < WIND_FIRST_YEAR))
            if number is None:
                continue
            if indicator_id.endswith('.wind') and year < WIND_FIRST_YEAR:
                raise ValueError(f'Unexpected wind row before {WIND_FIRST_YEAR}')
            _observation(rows, source_id, name, indicator_id, year, sheet, 'electricity', number, column)

    path = ROOT / LOCAL_FILE['geostat_food_balance_sheets']
    for food, name in FOODS.items():
        sheet = _cached_sheet('geostat_food_balance_sheets', sheet_name(path, name))
        years = _food_years(sheet)
        number = find_row(sheet, 'self-sufficiency ratio, %')
        for column, year in years.items():
            _observation(rows, 'geostat_food_balance_sheets', sheet_name(path, name), f'food.self_sufficiency.{food}', year, sheet, 'food', number, column)

    for indicator_id, key, label, _ in FARMING_CELLS:
        source_id, name = f'geostat_farming_{key}', FARMING_SHEETS[key]
        sheet = farming_sheet(key)
        number = find_row(sheet, label)
        first, last = COVERAGE[indicator_id]
        for column, (year, preliminary) in farming_years(sheet).items():
            if first <= year <= last:
                _observation(rows, source_id, name, indicator_id, year, sheet, 'farming', number, column, preliminary)
    return sorted(rows, key=lambda row: (row['indicator_id'], row['year']))


def farming_sheet(key):
    return _cached_sheet(f'geostat_farming_{key}', FARMING_SHEETS[key])


def farming_status(source_id, sheet, column):
    """A farming cell's status: preliminary where its year heading carries a star ("2025*")."""
    return 'preliminary' if farming_years(sheet)[column][1] else 'published'


def check_food_balance_production(rows):
    """Each food balance sheet's domestic production (printed in whole thousand tonnes, eggs and milk in millions) repeats the
    farm table within 0.6, every year 2014-2025. Returns the known exceptions that still differ; any other difference fails."""
    published = {(row['indicator_id'], row['year']): Decimal(row['published_value']) for row in rows}
    flows, differing = food_flows(), []
    for food, indicator_id in FOOD_PRODUCTION.items():
        for year in FOOD_YEARS:
            if abs(Decimal(str(flows[(food, year)][0])) - published[(indicator_id, year)]) > Decimal('0.6'):
                if (food, year) not in FOOD_PRODUCTION_EXCEPTIONS:
                    raise ValueError(f'Food balance production differs from the farm table: {food} {year}')
                differing.append((food, year))
    return differing


def _food_years(sheet):
    row = sheet[header_row(sheet, 'food')]
    return {column: int(cell['value']) for column, cell in row.items() if column != 'A' and cell['kind'] == 'n'}


@functools.lru_cache(maxsize=None)
def food_flows():
    """{(food, year): (production, import, export)} from the same sheet as each published ratio."""
    path = ROOT / LOCAL_FILE['geostat_food_balance_sheets']
    flows = {}
    for food, name in FOODS.items():
        sheet = _cached_sheet('geostat_food_balance_sheets', sheet_name(path, name))
        numbers = [find_row(sheet, label) for label in ('domestic production', 'import', 'export')]
        for column, year in _food_years(sheet).items():
            flows[(food, year)] = tuple(sheet[number][column]['value'] for number in numbers)
    return flows


def implied_ratio(production, imports, exports):
    available = production + imports - exports
    if available <= 0:
        raise ValueError('Food supply is not positive')
    return production / available * 100


# ---------------------------------------------------------------- validation

def _number(cell):
    """A balance cell as a number: a dash or an absent cell is zero; anything else must be numeric."""
    if cell is None:
        return Decimal(0)
    return Decimal(cell_value(cell)[0])


def check_energy_balance(year, sheet=None, columns=None):
    """production + imports - exports - bunkers + stock changes = domestic supply (within 0.2) for every fuel column."""
    if sheet is None:
        sheet, columns = read_ktoe(year)
    rows = {label: find_row(sheet, label) for label in ('production', 'imports', 'exports', 'international marine bunkers',
                                                          'international aviation bunkers', 'stock changes', 'domestic supply')}
    for fuel, column in columns.items():
        value = {label: _number(sheet[number].get(column)) for label, number in rows.items()}
        balance = (value['production'] + value['imports'] - value['exports'] - value['international marine bunkers'] -
                   value['international aviation bunkers'] + value['stock changes'])
        if abs(balance - value['domestic supply']) > Decimal('0.2'):
            raise ValueError(f'Balance identity fails for {year} {fuel}: {balance} against domestic supply {value["domestic supply"]}')


def check_electricity_losses(year):
    """Supply less the energy sector and losses is final consumption (within 0.5), which ties a renamed loss row to the same flow."""
    sheet, _, column = read_electricity(year)
    number = {label: find_row(sheet, label) for label in ('domestic supply', 'energy sector', 'final consumption')}
    losses = find_row(sheet, {text for text, years in LOSSES_LABELS.items() if year in years})
    supply, energy, final = (_number(sheet[number[label]].get(column)) for label in ('domestic supply', 'energy sector', 'final consumption'))
    if abs(supply - energy - _number(sheet[losses].get(column)) - final) > Decimal('0.5'):
        raise ValueError(f'Electricity losses do not reconcile with supply and final consumption in {year}')


def _close(left, right, tolerance):
    return abs(left - right) <= Decimal(tolerance)


def validate(rows):
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        value = Decimal(row['value'])
        if display(row['indicator_id'], row['year'], value, row['source_number_format']) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        statuses = ('published', 'preliminary') if row['indicator_id'].startswith('farming.') else ('published', 'no_flow')
        if row['unit'] != _unit(row['indicator_id']) or row['basis'] != 'actual' or row['value_status'] not in statuses:
            raise ValueError(f'Unexpected unit, basis or status: {key}')
        if row['value_status'] == 'no_flow' and value != 0:
            raise ValueError(f'A no-flow cell must be 0: {key}')
        if value < 0 and row['indicator_id'] != 'energy.supply.electricity':  # electricity supply is negative when exports exceed imports
            raise ValueError(f'Negative value: {key}')
        by_key[key] = value
    expected = {(indicator, year) for indicator, (first, last) in COVERAGE.items() for year in range(first, last + 1)}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')

    def v(indicator, year):
        return by_key[(indicator, year)]

    for year in YEARS:
        for name, fuels in (('supply', SUPPLY_FUELS), ('imports', IMPORT_FUELS)):
            if not _close(v(f'energy.{name}.total', year), sum(v(f'energy.{name}.{fuel}', year) for fuel in fuels), '0.5'):
                raise ValueError(f'Total column differs from the sum of its fuels: {name} {year}')
        if not _close(v('energy.final.total', year), sum(v(f'energy.final_fuel.{fuel}', year) for fuel in FINAL_FUELS), '0.5'):
            raise ValueError(f'Total column differs from the sum of its fuels: final consumption {year}')
        sectors = ('industry', 'transport', 'commercial_public', 'households', 'agriculture', 'other_unspecified', 'non_energy')
        if not _close(v('energy.final.total', year), sum(v(f'energy.final.{sector}', year) for sector in sectors), '0.5'):
            raise ValueError(f'Final consumption differs from industry + transport + other sectors + non-energy use: {year}')
        sectors = sectors[:-1]
        if not _close(v('electricity.final.total', year), sum(v(f'electricity.final.{sector}', year) for sector in sectors), '0.5'):
            raise ValueError(f'Final consumption (electricity) differs from industry + transport + other sectors: {year}')
        wind = by_key.get(('electricity.production.wind', year), Decimal(0))  # absent before 2016: 0 inside this check only
        if not _close(v('electricity.production.total', year), v('electricity.production.thermal', year) + v('electricity.production.hydro', year) + wind, '0.5'):
            raise ValueError(f'Electricity production differs from thermal + hydro + wind: {year}')
        check_energy_balance(year)
        check_electricity_losses(year)

    for year in range(2010, 2026):
        parts = sum(v(f'farming.output.{part}', year) for part in ('crops', 'livestock', 'services'))
        if not _close(v('farming.output.total', year), parts, '0.5'):
            raise ValueError(f'Farm output total differs from crops + livestock + services: {year}')
    products = farming_sheet('livestock_products')
    other_meat, product_years = find_row(products, 'other meet'), {year: column for column, (year, _) in farming_years(products).items()}
    milk_rows = [find_row(products, label) for label in ('dairy cow and buffalo milk', 'sheep and goat milk')]
    for year in range(2006, 2026):
        column = product_years[year]
        meats = sum(v(f'farming.products.{kind}', year) for kind in ('beef', 'pork', 'sheep_goat_meat', 'poultry_meat'))
        if not _close(v('farming.products.meat', year), meats + Decimal(cell_value(products[other_meat][column], farming=True)[0]), '0.2'):
            raise ValueError(f'Meat differs from the sum of its kinds: {year}')
        milk = sum(Decimal(cell_value(products[number][column], farming=True)[0]) for number in milk_rows)
        if not _close(v('farming.products.milk', year), milk, '0.2'):
            raise ValueError(f'Milk differs from the sum of cow and buffalo milk and sheep and goat milk: {year}')
        if v('farming.livestock.dairy_cows', year) > v('farming.livestock.cattle', year):
            raise ValueError(f'Dairy cows exceed cattle: {year}')
    check_food_balance_production(rows)

    flows = food_flows()
    for food in FOODS:
        for year in FOOD_YEARS:
            if abs(v(f'food.self_sufficiency.{food}', year) - implied_ratio(*flows[(food, year)])) > 10:
                raise ValueError(f'Self-sufficiency ratio is more than 10 points from production over supply: {food} {year}')

    for row in rows:
        cell = reread(row['source_id'], row['source_sheet'], row['source_cell'])
        sheet = _cached_sheet(row['source_id'], row['source_sheet'])
        kind = 'ktoe' if row['source_id'].endswith('_aggregated') else 'electricity' if row['source_id'].endswith('_electricity') else \
            'farming' if row['source_id'].startswith('geostat_farming_') else 'food'
        column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
        reread_value = cell_value(cell, farming=kind == 'farming')
        if kind == 'farming':
            reread_value = (reread_value[0], farming_status(row['source_id'], sheet, column))
        if (reread_value != (row['value'], row['value_status']) or cell['format'] != row['source_number_format'] or
                _label(sheet, kind, int(number), column) != row['source_label']):
            raise ValueError(f"Row disagrees with its source cell: {row['indicator_id']}:{row['year']} {row['source_cell']}")


# ---------------------------------------------------------------- outputs

def manifest():
    records = []
    for source_id, title, page, url, resolved, local_file, content_type in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                        'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': retrieved_at(source_id),
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def build(check=False):
    rows = extract()
    validate(rows)
    sources = manifest()
    coverage = defaultdict(list)
    counts, groups = defaultdict(int), defaultdict(int)
    for row in rows:
        coverage[row['indicator_id']].append(row['year'])
        counts[row['source_id']] += 1
        family = row['indicator_id'].split('.')
        groups['electricity' if family[0] == 'electricity' else 'food' if family[0] == 'food' else 'farming' if family[0] == 'farming' else
               next(group for group, names in PAGE_GROUPS.items() if family[1] in names)] += 1
    coverage_rows = [{'indicator_id': i, 'first_year': min(y), 'last_year': max(y), 'observations': len(y)} for i, y in sorted(coverage.items())]
    no_flow = [{key: row[key] for key in ('indicator_id', 'year', 'source_id', 'source_sheet', 'source_cell')}
               for row in rows if row['value_status'] == 'no_flow']
    preliminary = [{key: row[key] for key in ('indicator_id', 'year', 'source_id', 'source_sheet', 'source_cell')}
                   for row in rows if row['value_status'] == 'preliminary']
    report = {
        'status': 'passed', 'retrieved_at': {'energy and food': RETRIEVED_AT, 'farming': FARMING_RETRIEVED_AT},
        'scope': 'Annual research only: Geostat energy balances 2013-2024 (supply, imports, exports, final consumption, electricity), '
                 'food self-sufficiency ratios 2014-2025, and agriculture 2006-2025 (farm output, harvests, livestock, livestock '
                 'products, farm-gate prices); no monthly or quarterly data, energy prices or serving',
        'primary_observation_count': len(rows), 'observations_by_group': dict(sorted(groups.items())),
        'observations_by_source': dict(sorted(counts.items())),
        'no_flow_count': len(no_flow), 'no_flow_cells': no_flow, 'ellipsis_cells_in_served_values': 0,
        'preliminary_count': len(preliminary), 'preliminary_cells': preliminary, 'farming_dash_cells_in_served_values': 0,
        'food_production_known_differences': [{'food': food, 'year': year} for food, year in check_food_balance_production(rows)],
        'imputed_values': 0, 'reconciliation_failed_count': 0,
        'checks': ['no duplicate, missing or extra observation', 'published value equals the stored value as Geostat displays it',
                   'every row equals its re-read source cell, number format and printed row and column label',
                   'production + imports - exports - bunkers + stock changes = domestic supply within 0.2, every fuel and year',
                   'Total column = sum of fuel columns within 0.5 for supply, imports and final consumption',
                   'final consumption = industry + transport + other sectors (+ non-energy use) within 0.5',
                   'electricity production = thermal + hydro + wind within 0.5 GWh',
                   'electricity supply - energy sector - losses = final consumption within 0.5 GWh',
                   'food ratio within 10 points of production / (production + import - export)',
                   'farm output total = crops + livestock + services within 0.5',
                   'meat = beef + pork + sheep and goat + poultry + other meat within 0.2; milk = cow and buffalo + sheep and goat milk within 0.2',
                   'dairy cows never exceed cattle',
                   'food balance domestic production repeats the farm table within 0.6, 2014-2025 (known difference: grapes 2014)',
                   'no farming dash ("data not available") in a served cell; only the starred 2025 farm output is preliminary',
                   'efficiency workbook cross-check: see independent-validation.json'],
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'energy-food-annual.csv': csv_bytes(rows, FIELDS),
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
