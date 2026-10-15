"""Reproduce and check the annual Geostat business statistics research package.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader and CSV writer are reused from the unemployment package, as the money and household packages do.
Every column is found by its printed heading and every row by the year in column A, the year heading of a block, or
the printed section or region name, never by position.

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
import xml.etree.ElementTree as ET
from zipfile import ZipFile


sys.dont_write_bytecode = True  # Loading the shared reader must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, read_sheet, NS = _shared.clean, _shared.csv_bytes, _shared.read_sheet, _shared.NS

RETRIEVED_DATE = '2026-10-15'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
SURVEY_PAGE = 'https://www.geostat.ge/en/modules/categories/326/statistical-survey-of-enterprises'
DEMOGRAPHY_PAGE = 'https://www.geostat.ge/en/modules/categories/69/business-demography'
METADATA_PAGE = 'https://www.geostat.ge/en/modules/categories/530/metadata-business-statistics'


def _media(number, name):
    return f'https://geostat.ge/media/{number}/{name}', f'https://www.geostat.ge/media/{number}/{name}'


# (source_id, title, page, URL, resolved URL, local file, content type, retrieval time in UTC). Times are download completions.
SOURCES = [
    ('geostat_business_turnover', 'Turnover (0502EN0101)', SURVEY_PAGE, *_media(83082, '0502EN0101_Turnover.xlsx'),
     'official/0502EN0101_Turnover.xlsx', XLSX, '2026-10-15T08:51:19Z'),
    ('geostat_business_production_value', 'Production value (0502EN0102)', SURVEY_PAGE, *_media(83083, '0502EN0102_Production-value.xlsx'),
     'official/0502EN0102_Production-value.xlsx', XLSX, '2026-10-15T08:51:21Z'),
    ('geostat_business_employed', 'Number of persons employed (0502EN0103)', SURVEY_PAGE,
     *_media(83084, '0502EN0103_Number-of-persons-employed.xlsx'), 'official/0502EN0103_Number-of-persons-employed.xlsx', XLSX,
     '2026-10-15T08:51:23Z'),
    ('geostat_business_employees', 'Number of employees (0502EN0104)', SURVEY_PAGE, *_media(83085, '0502EN0104_Number-of-employees.xlsx'),
     'official/0502EN0104_Number-of-employees.xlsx', XLSX, '2026-10-15T08:51:24Z'),
    ('geostat_business_earnings', 'Average monthly earnings (0502EN0105)', SURVEY_PAGE,
     *_media(83086, '0502EN0105_Average-monthly-earnings.xlsx'), 'official/0502EN0105_Average-monthly-earnings.xlsx', XLSX,
     '2026-10-15T08:51:26Z'),
    ('geostat_business_value_added', 'Value added (0502EN0106)', SURVEY_PAGE, *_media(83319, '0502EN0106_Value-added.xlsx'),
     'official/0502EN0106_Value-added.xlsx', XLSX, '2026-10-15T08:51:36Z'),
    ('geostat_business_intermediate_consumption', 'Intermediate consumption (0502EN0107)', SURVEY_PAGE,
     *_media(83321, '0502EN0107_Intermediate-consumption.xlsx'), 'official/0502EN0107_Intermediate-consumption.xlsx', XLSX,
     '2026-10-15T08:51:38Z'),
    ('geostat_business_personnel_costs', 'Personnel costs (0502EN0108)', SURVEY_PAGE, *_media(83089, '0502EN0108_Personnel-costs.xlsx'),
     'official/0502EN0108_Personnel-costs.xlsx', XLSX, '2026-10-15T08:51:28Z'),
    ('geostat_business_purchases', 'Purchase of goods and services (0502EN0109)', SURVEY_PAGE,
     *_media(83090, '0502EN0109_Purchase-of-goods-and-services.xlsx'), 'official/0502EN0109_Purchase-of-goods-and-services.xlsx',
     XLSX, '2026-10-15T08:51:30Z'),
    ('geostat_business_purchases_for_resale', 'Purchase of goods and services for resale (0502EN0110)', SURVEY_PAGE,
     *_media(83091, '0502EN0110_Purchase-of-goods-and-services-for-resale.xlsx'),
     'official/0502EN0110_Purchase-of-goods-and-services-for-resale.xlsx', XLSX, '2026-10-15T08:51:31Z'),
    ('geostat_business_investment', 'Investments in fixed assets (0502EN0111)', SURVEY_PAGE,
     *_media(83092, '0502EN0111_Investments-in-fixed-assets.xlsx'), 'official/0502EN0111_Investments-in-fixed-assets.xlsx', XLSX,
     '2026-10-15T08:51:33Z'),
    ('geostat_business_gender', 'Business statistics by gender (0502EN0112)', SURVEY_PAGE,
     *_media(82499, '0502EN0112_BS_Gender_ENG.xlsx'), 'official/0502EN0112_BS_Gender_ENG.xlsx', XLSX, '2026-10-15T08:51:17Z'),
    ('geostat_business_fixed_assets', 'Fixed assets (0502EN0113)', SURVEY_PAGE, *_media(83093, '0502EN0113_fixed-assets.xlsx'),
     'official/0502EN0113_fixed-assets.xlsx', XLSX, '2026-10-15T08:51:35Z'),
    ('geostat_business_profit_loss', 'Profit and loss (0502EN0114)', SURVEY_PAGE, *_media(83323, '0502EN0114_Profit-and-loss.xlsx'),
     'official/0502EN0114_Profit-and-loss.xlsx', XLSX, '2026-10-15T08:51:40Z'),
    ('geostat_business_labour_productivity', 'Labour productivity (0502EN0115)', SURVEY_PAGE,
     *_media(83325, '0502EN0115_Labor-productivity.xlsx'), 'official/0502EN0115_Labor-productivity.xlsx', XLSX, '2026-10-15T08:51:42Z'),
    ('geostat_business_remarks', 'Business statistics remarks', SURVEY_PAGE, *_media(64609, 'Remark_eng.pdf'),
     'official/Remark_eng.pdf', 'application/pdf', '2026-10-15T08:52:11Z'),
    ('geostat_business_demography', 'Business demography: main results', DEMOGRAPHY_PAGE, *_media(75003, 'Main-results.xlsx'),
     'official/Main-results.xlsx', XLSX, '2026-10-15T08:51:44Z'),
    ('geostat_business_demography_other', 'Business demography: other indicators', DEMOGRAPHY_PAGE,
     *_media(75004, 'Other-indicators.xlsx'), 'official/Other-indicators.xlsx', XLSX, '2026-10-15T08:51:45Z'),
    ('geostat_business_demography_births', 'Business demography: enterprise births', DEMOGRAPHY_PAGE,
     *_media(75005, 'Enterprise-births.xlsx'), 'official/Enterprise-births.xlsx', XLSX, '2026-10-15T08:51:47Z'),
    ('geostat_business_demography_deaths', 'Business demography: enterprise deaths', DEMOGRAPHY_PAGE,
     *_media(75006, 'Enterprise-deaths.xlsx'), 'official/Enterprise-deaths.xlsx', XLSX, '2026-10-15T08:51:49Z'),
    ('geostat_business_survey_page', 'Geostat page: statistical survey of enterprises (category 326)', SURVEY_PAGE,
     'https://www.geostat.ge/en/modules/categories/326', SURVEY_PAGE, 'official/geostat-category-326-2026-10-15.html',
     'text/html; charset=UTF-8', '2026-10-15T08:51:59Z'),
    ('geostat_business_demography_page', 'Geostat page: business demography indicators (category 69)', DEMOGRAPHY_PAGE,
     'https://www.geostat.ge/en/modules/categories/69', DEMOGRAPHY_PAGE, 'official/geostat-category-69-2026-10-15.html',
     'text/html; charset=UTF-8', '2026-10-15T08:52:00Z'),
    # Geostat's metadata documents, archived for the definitions the methodology page quotes.
    ('geostat_business_survey_metadata', 'Metadata: statistical survey of enterprises (annual)', METADATA_PAGE,
     *_media(83205, '0502_011026_EN.PDF'), 'official/0502_011026_EN.PDF', 'application/pdf', '2026-10-15T11:16:24Z'),
    ('geostat_business_demography_metadata', 'Metadata: business demography', METADATA_PAGE,
     *_media(68651, '0519_200225_EN.PDF'), 'official/0519_200225_EN.PDF', 'application/pdf', '2026-10-15T11:16:27Z'),
]
FILE = {source[0]: source[5] for source in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']
BREAK_FIELDS = ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note']

UNITS = {'turnover': 'gel_million', 'employed': 'persons', 'investment': 'gel_million', 'profit': 'gel_million',
         'loss': 'gel_million', 'active': 'enterprises', 'births': 'enterprises', 'deaths': 'enterprises',
         'birth_rate': 'percent', 'death_rate': 'percent'}
UNIT_PLACES = {'gel_million': 1, 'persons': 0, 'enterprises': 0, 'percent': 1}
UNIT_LABELS = {'gel_million': 'mln.gel', 'persons': 'persons'}  # The unit printed over the total column, spaces removed.
FORMAT_PLACES = {'#,##0.0': 1, '0.0': 1, '#,##0': 0, '0': 0}
BUILTIN_FORMATS = {3: '#,##0', 49: '@'}  # Excel built-in formats the shared reader reports as 'unsupported'.
# Parts may differ from the printed total by Geostat's rounding: amounts by 0.15 million GEL, persons by 2; firm counts not at all.
TOLERANCE = {'gel_million': Decimal('0.15'), 'persons': Decimal(2), 'enterprises': Decimal(0)}
# Years whose printed parts do not add up to the printed total within that tolerance, with the exact difference of the
# published values (parts minus total). Each must stay exactly as recorded; any other year must add up.
#  - sizes and sectors 0.2: rounding of up to 15 printed values to one decimal;
#  - sectors 1999-2005: the totals still include section K (financial and insurance), which no column shows (Remark_eng.pdf, item 1);
#  - regions: the 11 regions fall short of the Georgia total in most years; the workbooks print no other region and say why nowhere.
KNOWN_DIFFERENCES = {
    ('turnover', 'size'): {2011: '-0.2'},
    ('turnover', 'sector'): {1999: '-1.4', 2000: '-2.9', 2001: '-2.4', 2002: '-1.7', 2003: '-2.2', 2004: '-5.4', 2005: '-19.1',
                             2009: '-0.2', 2025: '-0.2'},
    ('employed', 'sector'): {1999: '-240', 2000: '-252', 2001: '-322', 2002: '-255', 2003: '-244', 2004: '-271', 2005: '-449'},
    ('investment', 'sector'): {2009: '0.2', 2014: '-0.2', 2017: '0.2'},
    ('profit', 'sector'): {2017: '-0.2'},
    ('loss', 'sector'): {2012: '0.2', 2013: '0.2', 2020: '-0.2', 2021: '-0.2', 2025: '-0.2'},
    ('turnover', 'region'): {2006: '-29.8', 2007: '-41.5', 2008: '-45.2', 2009: '-42.0', 2010: '-59.5', 2011: '-45.3', 2012: '-44.1',
                             2013: '-50.0', 2014: '-61.8', 2015: '-53.5', 2016: '-61.5', 2017: '-79.0', 2018: '-105.1', 2019: '-90.1',
                             2020: '-50.9', 2021: '-116.3', 2022: '-129.5', 2023: '-116.1', 2024: '-126.3', 2025: '-170.1'},
    ('employed', 'region'): {2006: '-901', 2007: '-950', 2008: '-973', 2009: '-1052', 2010: '-1100', 2011: '-1073', 2012: '-1110',
                             2013: '-1152', 2014: '-1130', 2015: '-1175', 2016: '-1182', 2017: '-1208', 2018: '-1178', 2019: '-1285',
                             2020: '-1206', 2021: '-1305', 2022: '-1413', 2023: '-1407', 2024: '-1391', 2025: '-1361'},
    ('investment', 'region'): {2006: '-60.2', 2007: '-36.9', 2008: '-4.0', 2009: '-10.3', 2010: '-28.8', 2011: '-10.2', 2012: '-1.1',
                               2013: '-26.9', 2014: '-29.6', 2015: '-1.5', 2016: '-55.7', 2017: '-24.4', 2018: '-17.2', 2019: '-14.5',
                               2020: '-8.4', 2021: '-86.7', 2022: '-72.9', 2023: '-28.5', 2024: '-3.8', 2025: '-6.6'},
    ('profit', 'region'): {2006: '-0.9', 2009: '-0.8', 2010: '-14.1', 2011: '-2.2', 2012: '-1.5', 2013: '-0.3', 2014: '-10.9',
                           2016: '-0.2', 2017: '-5.9', 2018: '-26.3', 2019: '-15.1', 2020: '-0.7', 2021: '-43.6', 2022: '-62.1',
                           2023: '-0.9', 2024: '-3.8', 2025: '-7.4'},
    ('loss', 'region'): {2007: '-2.3', 2008: '-9.5', 2009: '-1.5', 2011: '-1.5', 2012: '-1.6', 2013: '-2.8', 2015: '-13.4',
                         2016: '-7.1', 2017: '-9.5', 2018: '-0.2', 2019: '-8.3', 2020: '-59.3', 2021: '-1.3', 2022: '-4.2',
                         2023: '-9.0', 2025: '-1.0'},
}
LAST_YEAR = 2025
REGION_FIRST_YEAR = 2006  # Before 2006 multi-region firms appear only in the Georgia total (Remark_eng.pdf, item 5).
FIRM_YEARS = (2014, 2024)

# (source, measure, the title that opens the measure's table on each of the three sheets)
SURVEY_TABLES = [
    ('geostat_business_turnover', 'turnover', 'TURNOVER BY'),
    ('geostat_business_employed', 'employed', 'EMPLOYED PERSONS BY'),
    ('geostat_business_investment', 'investment', 'INVESTMENTS IN FIXED ASSETS BY'),
    ('geostat_business_profit_loss', 'profit', 'PROFIT BY'),
    ('geostat_business_profit_loss', 'loss', 'LOSS BY'),
]
FIRST_YEAR = {'turnover': 1999, 'employed': 1999, 'investment': 2006, 'profit': 2006, 'loss': 2006}
SHEET_KINDS = {'sector': 'by kind of ec', 'size': 'by enterprise size', 'region': 'by region'}  # Sheet-name beginnings.
SECTORS = {
    'Agriculture, forestry and fishing': 'sector_a', 'Industry': 'sector_b_e', 'Construction': 'sector_f',
    'Wholesale and retail trade; repair of motor vehicles and motorcycles': 'sector_g', 'Transportation and storage': 'sector_h',
    'Accommodation and food service activities': 'sector_i', 'Information and communication': 'sector_j',
    'Real estate activities': 'sector_l', 'Professional, scientific and technical activities': 'sector_m',
    'Administrative and support service activities': 'sector_n', 'Education': 'sector_p',
    'Human health and social work activities': 'sector_q', 'Arts, entertainment and recreation': 'sector_r',
    'Other service activities': 'sector_s'}
SIZES = {'Large': 'size_large', 'Medium': 'size_medium', 'Small': 'size_small'}
SURVEY_REGIONS = {
    'Tbilisi': 'region_tbilisi', 'Adjara AR': 'region_adjara', 'Guria': 'region_guria', 'Imereti': 'region_imereti',
    'Kakheti': 'region_kakheti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
    'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
    'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
    'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli'}
GROUPS = {'sector': SECTORS, 'size': SIZES, 'region': SURVEY_REGIONS}
TOTAL_LABELS = ('total', 'georgia - total')
IGNORED_LABELS = ('year and quarter', 'year', 'of which:')

DEMOGRAPHY = 'geostat_business_demography'
REGIONS_SHEET = 'By regions'
# Main-results spells two regions its own way; the rest match the survey tables.
DEMOGRAPHY_REGIONS = {
    **{name: group for name, group in SURVEY_REGIONS.items() if name not in ('Tbilisi', 'Racha-Lechkhumi and Kvemo Svaneti')},
    'The city of Tbilisi': 'region_tbilisi', 'Racha-Lechkhumi and Kvemo Svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
    'Abkhazeti AR': 'region_abkhazeti', 'Unknown': 'region_unknown'}
SECTIONS = {letter: f'sector_{letter.lower()}' for letter in 'ABCDEFGHIJKLMNPQRS'}  # NACE Rev. 2 sections; O, T and U are out of scope.
# Firms by activity: the 18 sections and Geostat's "ACTIVITY UNKNOWN" row, which is part of the total but of no section.
ACTIVITY_GROUPS = [*SECTIONS.values(), 'sector_unknown']
REGION_COLUMNS = {'active enterprises': 'active', 'enterprise births': 'births', 'enterprise deaths': 'deaths',
                  'enterprise birth rate (%)': 'birth_rate', 'enterprise death rate (%)': 'death_rate'}
ACTIVITY_COLUMNS = {'active enterprises': 'active', 'enterprise births': 'births', 'enterprise deaths': 'deaths',
                    'enterprise births %': 'birth_rate', 'enterprise deaths %': 'death_rate'}
DEMOGRAPHY_IGNORED = ('regions', 'sections and divisions', 'sections and divisions (nace rev. 2)', 'kind of activity (nace rev. 2)',
                      'persons employed in the population of active enterprises')
FIRM_MEASURES = ('active', 'births', 'deaths')
RATES = {'birth_rate': 'births', 'death_rate': 'deaths'}
# The 2016 and 2019 activity sheets print no death-rate column; nothing is calculated in its place.
NO_SECTION_DEATH_RATE = (2016, 2019)

# Values Geostat prints, as published (the size_large value is the workbook's: By enterprise size D32 holds 173004.5).
ANCHORS = {('business.turnover.total', 2025): '253725.5', ('business.turnover.size_large', 2025): '173004.5',
           ('business.turnover.region_tbilisi', 2025): '200837.9', ('business.employed.total', 2025): '899026',
           ('business.investment.total', 2025): '8021.8', ('business.profit.total', 2025): '27936.1',
           ('business.loss.total', 2025): '7152.9', ('business.active.total', 2024): '249236',
           ('business.births.total', 2024): '56259', ('business.deaths.total', 2024): '29634',
           ('business.birth_rate.total', 2024): '22.6'}
CALC = Context(prec=28)
DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows a stored double to 15 significant digits.

BREAKS = [{
    'break_id': 'survey_scope_2006', 'applies_to': None, 'reference_date': '2006-01-01',
    'reason': 'From 2006 Geostat\'s business survey leaves out financial and insurance firms and non-commercial legal persons and '
              'entities of public law, which it covered before. Remark_eng.pdf, item 1: "Business Statistics excludes: BY kind of '
              'economic activity NACE rev. 2: Activity sections: K (Financial and Insurance Activities - from 2006), O (Public '
              'administration and defence; compulsory social security), T (Activities of Households as Employers; Undifferentiated '
              'Goods- and Services-producing Activities of Households for own use) and U (Activities of Extraterritorial '
              'Organisations and Bodies); 47.8 (Retail sale via stalls and markets). From 2006 - non-commercial legal persons and '
              'entities of public law." Sales and jobs before 2006 therefore include firms the later years leave out. No change '
              'may be computed across this point.',
    'source_note': 'Remark_eng.pdf (https://geostat.ge/media/64609/Remark_eng.pdf), page 1, item 1. Investment, profit and loss '
                   'start in 2006, so only sales and jobs cross this point. In the activity sheets the 1999-2005 totals exceed the 14 '
                   'sector columns (turnover 2005: by 19.1 million GEL; persons employed 2005: by 449), while from 2006 they '
                   'differ only by rounding.'}]


def published(value, places):
    """Round half-up from the value as Excel displays it (15 significant digits), so 8.4499999999999993 publishes as 8.5."""
    return str(DISPLAY.create_decimal(value).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def text(cell):
    return '' if cell is None else clean(str(cell['value']))


def heading(cell):
    """A heading compared without stars, line breaks or case: 'Enterprise births*' and 'Enterprise\\nbirth rate (%)'."""
    return re.sub(r'[\s*]+', ' ', text(cell)).strip().casefold()


def token(cell):
    """The exact stored number: a numeric cell's own XML token, or a text cell with its spaces removed."""
    if cell is not None and cell['kind'] == 'n':
        return format(cell['value'], 'f')
    if cell is not None and isinstance(cell['value'], str):
        compact = re.sub(r'\s', '', cell['value'])
        if re.fullmatch(r'-?\d+(\.\d+)?', compact):
            return compact
    raise ValueError(f'Expected a number, found {None if cell is None else cell["value"]!r} in {None if cell is None else cell["cell"]}')


def cell_number(cell):
    return Decimal(token(cell))


def places_of(cell, unit):
    """Decimals the cell's number format shows, which must be the unit's (one for amounts and rates, none for counts)."""
    number_format = cell['format']
    if number_format in FORMAT_PLACES:
        places = FORMAT_PLACES[number_format]
    elif number_format == 'General' and cell_number(cell) == cell_number(cell).to_integral_value():
        places = 0
    else:
        raise ValueError(f'Unexpected number format {number_format!r} in {cell["cell"]}')
    if places != UNIT_PLACES[unit]:
        raise ValueError(f'{cell["cell"]} shows {places} decimals, not the {UNIT_PLACES[unit]} of {unit}')
    return places


@functools.lru_cache(maxsize=None)
def sheet_names(source_id):
    with ZipFile(ROOT / FILE[source_id]) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        return tuple(s.get('name') for s in workbook.findall('x:sheets/x:sheet', NS))


@functools.lru_cache(maxsize=None)
def sheet(source_id, name):
    """The shared reader's cells, with Excel's built-in number formats named where the reader leaves them unsupported."""
    path = ROOT / FILE[source_id]
    rows = {number: {column: dict(cell) for column, cell in cells.items()} for number, cells in read_sheet(path, name).items()}
    if any(cell['format'] == 'unsupported' for cells in rows.values() for cell in cells.values()):
        with ZipFile(path) as archive:
            workbook = ET.fromstring(archive.read('xl/workbook.xml'))
            relation = next(s for s in workbook.findall('x:sheets/x:sheet', NS) if s.get('name') == name).get(
                '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = next(r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels')) if r.get('Id') == relation)
            format_ids = [int(xf.get('numFmtId')) for xf in ET.fromstring(archive.read('xl/styles.xml')).findall('x:cellXfs/x:xf', NS)]
            xml = ET.fromstring(archive.read(target.lstrip('/') if target.startswith('/') else 'xl/' + target))
            styles = {c.get('r'): format_ids[int(c.get('s', '0'))] for c in xml.iter(f'{{{NS["x"]}}}c')}
        for cells in rows.values():
            for cell in cells.values():
                if cell['format'] == 'unsupported':
                    cell['format'] = BUILTIN_FORMATS.get(styles[cell['cell']], 'unsupported')
    return rows


def survey_sheet(source_id, kind):
    found = [name for name in sheet_names(source_id) if name.casefold().startswith(SHEET_KINDS[kind])]
    if len(found) != 1:
        raise ValueError(f'Expected one {kind} sheet in {source_id}, found {found}')
    return found[0]


def survey_table(source_id, name, title, groups):
    """One annual table: the year in column A of each row from the first year down to the first blank row, and the column
    of the total and of each group, found by the headings between the table's title and its first year."""
    rows = sheet(source_id, name)
    starts = [n for n, cells in rows.items() if text(cells.get('A')).upper().startswith(title)]
    if len(starts) != 1:
        raise ValueError(f'Expected one {title!r} table in {name}, found {len(starts)}')
    number = starts[0] + 1
    while not (rows.get(number, {}).get('A', {}).get('kind') == 'n'):
        number += 1
        if number > max(rows):
            raise ValueError(f'No year rows under {title!r} in {name}')
    header_rows, years = range(starts[0] + 1, number), {}
    while rows.get(number):
        year, quarter = rows[number].get('A'), rows[number].get('B')  # Survey tables print '...' in B; annual-only ones print the total.
        if year is None or year['kind'] != 'n' or (quarter is not None and quarter['kind'] != 'n' and text(quarter) not in ('...', '…')):
            raise ValueError(f'Row {number} of {name} is not an annual row')
        years[int(year['value'])] = number
        number += 1
    if list(years) != list(range(min(years), LAST_YEAR + 1)):
        raise ValueError(f'{title!r} in {name} does not run year by year to {LAST_YEAR}: {list(years)}')
    columns, total, unit = {}, [], []
    for row in header_rows:
        for column, cell in rows.get(row, {}).items():
            label = text(cell)
            if cell['kind'] == 'n' or label.casefold() in IGNORED_LABELS:
                continue
            if label.casefold() in TOTAL_LABELS:
                total.append(column)
            elif label in groups:
                if groups[label] in columns:
                    raise ValueError(f'{label!r} is printed twice in {name}')
                columns[groups[label]] = column
            else:
                unit.append((column, label.replace(' ', '').casefold()))
    if len(total) != 1 or set(columns) != set(groups.values()):
        raise ValueError(f'Unexpected headings in {name} under {title!r}: total {total}, groups {sorted(columns)}')
    return years, total[0], columns, unit


def survey_observations(source_id, measure, title):
    rows, unit = [], UNITS[measure]
    for kind, groups in GROUPS.items():
        name = survey_sheet(source_id, kind)
        years, total, columns, unit_labels = survey_table(source_id, name, title, groups)
        if unit_labels != [(total, UNIT_LABELS[unit])]:
            raise ValueError(f'{name} under {title!r} is not printed in {unit}: {unit_labels}')
        if kind == 'sector':  # The total is served from the activity sheet; the other sheets' totals are checked against it.
            columns = {'total': total, **columns}
        for group, column in columns.items():
            first = max(FIRST_YEAR[measure], REGION_FIRST_YEAR) if kind == 'region' else FIRST_YEAR[measure]
            for year in range(first, LAST_YEAR + 1):
                if year not in years:
                    raise ValueError(f'No {year} row under {title!r} in {name}')
                rows.append(observation(f'business.{measure}.{group}', year, sheet(source_id, name)[years[year]].get(column),
                                        source_id, name))
    return rows


def observation(indicator_id, year, cell, source_id, source_sheet):
    unit = UNITS[indicator_id.split('.')[1]]
    value = token(cell)
    return {'year': year, 'indicator_id': indicator_id, 'value': value, 'published_value': published(value, places_of(cell, unit)),
            'unit': unit, 'basis': 'actual', 'value_status': 'official', 'source_id': source_id, 'source_sheet': source_sheet,
            'source_cell': cell['cell']}


def header_columns(rows, known, ignored):
    """The heading row (the one printing "Active enterprises") and the column of each known heading in it."""
    found = [n for n, cells in rows.items() if any(heading(cell) == 'active enterprises' for cell in cells.values())]
    if len(found) != 1:
        raise ValueError(f'Expected one heading row, found {found}')
    columns = {}
    for column, cell in rows[found[0]].items():
        label = heading(cell)
        if label in known:
            columns[known[label]] = column
        elif label not in ignored:
            raise ValueError(f'Unexpected heading {label!r} in row {found[0]}')
    return found[0], columns


@functools.lru_cache(maxsize=None)
def region_blocks():
    """Main-results "By regions": {year: {group: row}}, each year block opened by a row holding only the year in column C."""
    rows = sheet(DEMOGRAPHY, REGIONS_SHEET)
    start, columns = header_columns(rows, REGION_COLUMNS, DEMOGRAPHY_IGNORED)
    if set(columns) != set(REGION_COLUMNS.values()):
        raise ValueError(f'Missing headings in {REGIONS_SHEET}: {columns}')
    blocks, year = {}, None
    for number in sorted(n for n in rows if n > start):
        cells = rows[number]
        if 'B' not in cells and 'C' in cells:
            year = int(cell_number(cells['C']))
            if year in blocks:
                raise ValueError(f'{year} has two blocks in {REGIONS_SHEET}')
            blocks[year] = {}
            continue
        label = text(cells.get('B'))
        if label.startswith('*'):
            break
        group = 'total' if label == 'Total' else DEMOGRAPHY_REGIONS.get(label)
        if year is None or group is None or group in blocks[year]:
            raise ValueError(f'Unexpected row {number} in {REGIONS_SHEET}: {label!r}')
        blocks[year][group] = number
    expected = {'total', *DEMOGRAPHY_REGIONS.values()}
    if sorted(blocks) != list(range(FIRM_YEARS[0], FIRM_YEARS[1] + 1)) or any(set(b) != expected for b in blocks.values()):
        raise ValueError(f'Unexpected year blocks in {REGIONS_SHEET}: {sorted(blocks)}')
    return blocks, columns


@functools.lru_cache(maxsize=None)
def activity_sheets():
    """Main-results "By kind of ec.activity - YYYY": {year: (sheet, columns, {group: row})} with the TOTAL row, the 18
    one-letter sections and the "ACTIVITY UNKNOWN" row (sector_unknown); divisions such as A01 are skipped."""
    found = {}
    for name in sheet_names(DEMOGRAPHY):
        match = re.fullmatch(r'By kind of ec\.\s*activity\s*-\s*(\d{4})', name)
        if not match:
            continue
        year, rows = int(match.group(1)), sheet(DEMOGRAPHY, name)
        if not any(text(cells.get('B')).endswith(f'{year} year') for n, cells in rows.items() if n < 4):
            raise ValueError(f'{name} is not titled {year}')
        start, columns = header_columns(rows, ACTIVITY_COLUMNS, DEMOGRAPHY_IGNORED)
        groups = {}
        for number in sorted(n for n in rows if n > start):
            cells = rows[number]
            code = text(cells.get('B')).replace(' ', '')
            if code == 'TOTAL':
                group = 'total'
            elif not code and text(cells.get('C')) == 'ACTIVITY UNKNOWN':
                group = 'sector_unknown'
            elif re.fullmatch(r'[A-Z]', code):
                if code not in SECTIONS:
                    raise ValueError(f'Section {code} is outside the survey scope in {name}')
                group = SECTIONS[code]
            else:
                continue
            if group in groups:
                raise ValueError(f'{group} is printed twice in {name}')
            groups[group] = number
        if set(groups) != {'total', *ACTIVITY_GROUPS}:
            raise ValueError(f'Unexpected rows in {name}: {sorted(groups)}')
        found[year] = (name, columns, groups)
    if sorted(found) != list(range(FIRM_YEARS[0], FIRM_YEARS[1] + 1)):
        raise ValueError(f'Unexpected activity sheets: {sorted(found)}')
    return found


def demography_observations():
    rows = []
    blocks, columns = region_blocks()
    regions = sheet(DEMOGRAPHY, REGIONS_SHEET)
    for year, groups in blocks.items():
        for group, number in groups.items():
            for measure, column in columns.items():
                if group == 'total' or measure in FIRM_MEASURES:  # Rates are served for Georgia and sections only.
                    rows.append(observation(f'business.{measure}.{group}', year, regions[number].get(column), DEMOGRAPHY, REGIONS_SHEET))
    for year, (name, columns, groups) in activity_sheets().items():
        for group, number in groups.items():
            if group == 'total':
                continue
            for measure, column in columns.items():
                rows.append(observation(f'business.{measure}.{group}', year, sheet(DEMOGRAPHY, name)[number].get(column), DEMOGRAPHY, name))
    return rows


def extract():
    """Every served observation, transcribed from its original cell."""
    rows = []
    for source_id, measure, title in SURVEY_TABLES:
        rows += survey_observations(source_id, measure, title)
    return rows + demography_observations()


def expected_keys():
    keys = set()
    for _, measure, _ in SURVEY_TABLES:
        for group in ['total', *SIZES.values(), *SECTORS.values()]:
            keys |= {(f'business.{measure}.{group}', year) for year in range(FIRST_YEAR[measure], LAST_YEAR + 1)}
        for group in SURVEY_REGIONS.values():
            keys |= {(f'business.{measure}.{group}', year) for year in range(max(FIRST_YEAR[measure], REGION_FIRST_YEAR), LAST_YEAR + 1)}
    years = range(FIRM_YEARS[0], FIRM_YEARS[1] + 1)
    for measure in FIRM_MEASURES:
        for group in ['total', *ACTIVITY_GROUPS, *DEMOGRAPHY_REGIONS.values()]:
            keys |= {(f'business.{measure}.{group}', year) for year in years}
    for measure in RATES:
        for group in ['total', *ACTIVITY_GROUPS]:
            keys |= {(f'business.{measure}.{group}', year) for year in years
                     if not (measure == 'death_rate' and group != 'total' and year in NO_SECTION_DEATH_RATE)}
    return keys


def source_cell(row):
    column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    return sheet(row['source_id'], row['source_sheet']).get(int(number), {}).get(column)


def survey_totals_agree():
    """The size and region sheets print the same total as the activity sheet, at the published precision."""
    checked = 0
    for source_id, measure, title in SURVEY_TABLES:
        places = UNIT_PLACES[UNITS[measure]]
        printed = {}
        for kind, groups in GROUPS.items():
            name = survey_sheet(source_id, kind)
            years, total, _, _ = survey_table(source_id, name, title, groups)
            printed[kind] = {year: published(cell_number(sheet(source_id, name)[n][total]), places) for year, n in years.items()}
        for year, value in printed['sector'].items():
            if year >= FIRST_YEAR[measure] and (printed['size'][year] != value or printed['region'][year] != value):
                raise ValueError(f'The {measure} totals of the three sheets differ in {year}')
            checked += 1
    return checked


def firm_totals_agree():
    """Each activity sheet's TOTAL row prints the same firms and rates as the year's Total row by region."""
    blocks, region_columns = region_blocks()
    regions, checked = sheet(DEMOGRAPHY, REGIONS_SHEET), 0
    for year, (name, columns, groups) in activity_sheets().items():
        for measure, column in columns.items():
            if token(sheet(DEMOGRAPHY, name)[groups['total']].get(column)) != token(regions[blocks[year]['total']].get(region_columns[measure])):
                raise ValueError(f'The {measure} totals by section and by region differ in {year}')
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
        shown[key] = Decimal(row['published_value'])
    if keys != expected_keys():
        raise ValueError(f'Coverage mismatch: {len(expected_keys() - keys)} missing, {len(keys - expected_keys())} extra')
    if any(year > LAST_YEAR for _, year in keys):
        raise ValueError('A year after 2025 is served')

    def adds_up(measure, kind, groups, years):
        tolerance, known = TOLERANCE[UNITS[measure]], KNOWN_DIFFERENCES.get((measure, kind), {})
        for year in years:
            total = (f'business.{measure}.total', year)
            parts = sum(values[(f'business.{measure}.{group}', year)] for group in groups)
            printed = sum(shown[(f'business.{measure}.{group}', year)] for group in groups) - shown[total]
            failed = str(printed) != known[year] if year in known else abs(parts - values[total]) > tolerance
            if failed:
                raise ValueError(f'The {measure} {kind}s do not add up to the total in {year} as recorded')

    for _, measure, _ in SURVEY_TABLES:
        years = range(FIRST_YEAR[measure], LAST_YEAR + 1)
        adds_up(measure, 'size', list(SIZES.values()), years)
        adds_up(measure, 'sector', list(SECTORS.values()), years)
        adds_up(measure, 'region', list(SURVEY_REGIONS.values()), range(REGION_FIRST_YEAR, LAST_YEAR + 1))
    firm_years = range(FIRM_YEARS[0], FIRM_YEARS[1] + 1)
    for measure in FIRM_MEASURES:
        adds_up(measure, 'region', list(DEMOGRAPHY_REGIONS.values()), firm_years)
        adds_up(measure, 'section', ACTIVITY_GROUPS, firm_years)
    for (indicator_id, year), value in values.items():
        measure, group = indicator_id.split('.')[1:]
        if measure in RATES:
            ratio = CALC.divide(CALC.multiply(values[(f'business.{RATES[measure]}.{group}', year)], 100),
                                values[(f'business.active.{group}', year)])
            if published(ratio, 1) != published(value, 1):
                raise ValueError(f'The {measure} is not {RATES[measure]} per 100 active firms: {indicator_id} {year}')
    for (indicator_id, year), expected in ANCHORS.items():
        if published(values[(indicator_id, year)], UNIT_PLACES[UNITS[indicator_id.split('.')[1]]]) != expected:
            raise ValueError(f'The anchor value does not match Geostat: {indicator_id} {year}')
    for row in rows:
        if token(source_cell(row)) != row['value']:
            raise ValueError(f'The value does not match its source cell: {row["indicator_id"]} {row["year"]} {row["source_cell"]}')
    return {'survey_totals_compared': survey_totals_agree(), 'firm_totals_compared': firm_totals_agree()}


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
    breaks = [{**BREAKS[0], 'applies_to': ';'.join(sorted(i for i in by_indicator if i.split('.')[1] in ('turnover', 'employed')))}]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_DATE,
        'scope': 'Annual research only: turnover, persons employed, investment, profit and loss by activity, size and region '
                 '(regions from 2006), and active, new and closed firms with birth and death rates (2014-2024); no quarters, '
                 'no 2026, no other survey tables, survival, legal forms or ownership',
        'primary_observation_count': len(rows), 'observations_by_measure': dict(sorted(by_measure.items())),
        'observations_by_source': dict(sorted(by_source.items())), 'indicator_count': len(by_indicator),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'values_match_source_cells': True,
            'published_values_are_rounded_stored_values_at_cell_precision': True,
            'sizes_sectors_regions_add_up_to_total': {unit: str(t) for unit, t in TOLERANCE.items()},
            'recorded_differences_parts_minus_total': {f'{measure}.{kind}': {str(y): d for y, d in years.items()}
                                                       for (measure, kind), years in KNOWN_DIFFERENCES.items()},
            'firm_sections_and_sector_unknown_add_up_exactly': True,
            'rates_equal_births_or_deaths_per_100_active': True,
            'section_death_rate_not_printed': list(NO_SECTION_DEATH_RATE),
            'survey_totals_agree_across_sheets': agreement['survey_totals_compared'],
            'firm_totals_agree_by_section_and_region': agreement['firm_totals_compared'],
            'no_quarter_or_2026_rows': True, 'regions_start_2006_for_survey_measures': True,
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'business-annual.csv': csv_bytes(rows, FIELDS),
        'business-series-breaks.csv': csv_bytes(breaks, BREAK_FIELDS),
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
