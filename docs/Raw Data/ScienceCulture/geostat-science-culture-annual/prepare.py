"""Reproduce and check the annual Geostat science and culture research package.

Reads the preserved files in official/ with xlrd (the .xls files) and a small stdlib reader (the .xlsx files); needs xlrd 2.0.x.
Never downloads sources or serves product data. The text cleaner and CSV writer are reused from the unemployment package, as
the housing package does; its worksheet reader is not, because it refuses sheet "1" of a workbook with several sheets
(Researchers.xlsx and Invention-Utility-Model.xlsx). Every column is found by its printed year and heading and every row by its
printed label, never by position.

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
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import xlrd


sys.dont_write_bytecode = True  # Loading the shared helpers must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, NS = _shared.clean, _shared.csv_bytes, _shared.NS

RETRIEVED_DATE = '2026-10-20'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLS = 'application/vnd.ms-excel'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
SCIENCE_PAGE = 'https://www.geostat.ge/en/modules/categories/194/science'
CULTURE_PAGE = 'https://www.geostat.ge/en/modules/categories/615/culture'
KA_SCIENCE_PAGE = 'https://www.geostat.ge/ka/modules/categories/194/metsniereba'
KA_CULTURE_PAGE = 'https://www.geostat.ge/ka/modules/categories/615/kultura'


def _media(number, name):
    return f'https://geostat.ge/media/{number}/{name}', f'https://www.geostat.ge/media/{number}/{name}'


# (source_id, title, page, URL, resolved URL, local file, content type, retrieval time in UTC). Times are the starts of the
# downloads. Served sources are listed in SERVED; every other file is archived for provenance, labels and cross-checks.
SOURCES = [
    ('geostat_science_researchers', 'Number of researchers (Researchers.xlsx)', SCIENCE_PAGE, *_media(74833, 'Researchers.xlsx'),
     'official/Researchers.xlsx', XLSX, '2026-10-20T07:29:16Z'),
    ('geostat_science_rd_staff', 'Persons working on R&D by status (R&D-Personal.xlsx)', SCIENCE_PAGE,
     *_media(74831, 'R%26D-Personal.xlsx'), 'official/R&D-Personal.xlsx', XLSX, '2026-10-20T07:29:19Z'),
    ('geostat_science_institutions', 'Institutions that conducted R&D and their expenditures (Institutions.xlsx)', SCIENCE_PAGE,
     *_media(74829, 'Institutions.xlsx'), 'official/Institutions.xlsx', XLSX, '2026-10-20T07:29:22Z'),
    ('geostat_science_patents', 'Inventions and utility models, Sakpatenti (Invention-Utility-Model.xlsx)', SCIENCE_PAGE,
     *_media(77951, 'Invention-Utility-Model.xlsx'), 'official/Invention-Utility-Model.xlsx', XLSX, '2026-10-20T07:29:24Z'),
    ('geostat_science_publications', 'Number of publications, Techinform (Number-of-publication.xlsx)', SCIENCE_PAGE,
     *_media(50657, 'Number-of-publication.xlsx'), 'official/Number-of-publication.xlsx', XLSX, '2026-10-20T07:29:26Z'),
    ('geostat_culture_museums', 'Museums and museum reserves, main characteristics', CULTURE_PAGE,
     *_media(79909, 'Main-charasteristics-of-Museums.xls'), 'official/Main-charasteristics-of-Museums.xls', XLS,
     '2026-10-20T07:29:29Z'),
    ('geostat_culture_museums_count_regions', 'Number of museums by regions', CULTURE_PAGE,
     *_media(79913, 'Number-of-Museums-by-Regions.xls'), 'official/Number-of-Museums-by-Regions.xls', XLS, '2026-10-20T07:29:30Z'),
    ('geostat_culture_museums_regions', 'Museums, main characteristics by regions', CULTURE_PAGE,
     *_media(80793, 'Main-charasteristics-of-Museums-by-Regions.xls'), 'official/Main-charasteristics-of-Museums-by-Regions.xls',
     XLS, '2026-10-20T07:29:32Z'),
    ('geostat_culture_museum_staff', 'Staff employed in museums', CULTURE_PAGE,
     *_media(79915, 'Employed-Staff-in-Museums.xls'), 'official/Employed-Staff-in-Museums.xls', XLS, '2026-10-20T07:29:35Z'),
    ('geostat_culture_museum_exhibits', 'The exhibits of museums (2011 only)', CULTURE_PAGE,
     *_media(26219, 'The-exhibits-of-Museums.xls'), 'official/The-exhibits-of-Museums.xls', XLS, '2026-10-20T07:29:37Z'),
    ('geostat_culture_theatres', 'Main indicators of professional theatres', CULTURE_PAGE,
     *_media(79917, 'Main-Indicators-Of-Professional-Theatres.xls'), 'official/Main-Indicators-Of-Professional-Theatres.xls', XLS,
     '2026-10-20T07:29:39Z'),
    ('geostat_culture_theatres_regions', 'Main indicators of professional theatres by regions', CULTURE_PAGE,
     *_media(79919, 'Main-Indicators-Of-Professional-Theatres-by-Regions.xls'),
     'official/Main-Indicators-Of-Professional-Theatres-by-Regions.xls', XLS, '2026-10-20T07:29:41Z'),
    ('geostat_culture_theatres_count_regions', 'Number of professional theatres by regions', CULTURE_PAGE,
     *_media(79921, 'Number-of-Theatres-by-Regions.xls'), 'official/Number-of-Theatres-by-Regions.xls', XLS, '2026-10-20T07:29:43Z'),
    ('geostat_culture_theatre_staff', 'Staff employed in theatres', CULTURE_PAGE,
     *_media(79923, 'Employed-Staff-in-Theatres.xls'), 'official/Employed-Staff-in-Theatres.xls', XLS, '2026-10-20T07:29:45Z'),
    ('geostat_culture_theatre_events', 'Events held by theatres (Events.xls)', CULTURE_PAGE, *_media(79925, 'Events.xls'),
     'official/Events.xls', XLS, '2026-10-20T07:29:48Z'),
    ('geostat_culture_libraries', 'Public and universal libraries (2001-2008)', CULTURE_PAGE,
     *_media(31823, 'Public-and-Universal-Libraries.xls'), 'official/Public-and-Universal-Libraries.xls', XLS, '2026-10-20T07:29:50Z'),
    ('geostat_culture_libraries_regions', 'Number of libraries by regions (2003-2008)', CULTURE_PAGE,
     *_media(31825, 'Number-of-Libraries-by-Regions.xls'), 'official/Number-of-Libraries-by-Regions.xls', XLS, '2026-10-20T07:29:53Z'),
    ('geostat_culture_publishing', 'Calculation of data on publishing materials (2005-2020)', CULTURE_PAGE,
     *_media(38884, 'Calculation-of-data-on-publishing-materials.xls'), 'official/Calculation-of-data-on-publishing-materials.xls',
     XLS, '2026-10-20T07:29:55Z'),
    ('geostat_ka_science_institutions', 'Georgian version: institutions (dawesebulebebi.xlsx)', KA_SCIENCE_PAGE,
     *_media(74828, 'dawesebulebebi.xlsx'), 'official/ka/dawesebulebebi.xlsx', XLSX, '2026-10-20T07:29:58Z'),
    ('geostat_ka_science_rd_staff', 'Georgian version: R&D staff (personali.xlsx)', KA_SCIENCE_PAGE,
     *_media(74830, 'personali.xlsx'), 'official/ka/personali.xlsx', XLSX, '2026-10-20T07:29:59Z'),
    ('geostat_ka_science_researchers', 'Georgian version: researchers (mkvlevarebi.xlsx)', KA_SCIENCE_PAGE,
     *_media(74832, 'mkvlevarebi.xlsx'), 'official/ka/mkvlevarebi.xlsx', XLSX, '2026-10-20T07:30:01Z'),
    ('geostat_ka_science_patents', 'Georgian version: inventions and utility models (patentebi.xlsx)', KA_SCIENCE_PAGE,
     *_media(77950, 'patentebi.xlsx'), 'official/ka/patentebi.xlsx', XLSX, '2026-10-20T07:30:03Z'),
    ('geostat_ka_culture_museums', 'Georgian version: museums, main characteristics', KA_CULTURE_PAGE,
     *_media(79908, 'muzeumebis_ZiriTadi_maCveneblebi.xls'), 'official/ka/muzeumebis_ZiriTadi_maCveneblebi.xls', XLS,
     '2026-10-20T07:30:05Z'),
    ('geostat_ka_culture_museums_count_regions', 'Georgian version: number of museums by regions', KA_CULTURE_PAGE,
     *_media(79912, 'muzeumebis_raodenoba_regionebis_mixedviT.XLS'), 'official/ka/muzeumebis_raodenoba_regionebis_mixedviT.XLS', XLS,
     '2026-10-20T07:30:07Z'),
    ('geostat_ka_culture_museum_staff', 'Georgian version: staff employed in museums', KA_CULTURE_PAGE,
     *_media(79914, 'dasakmebulebi_muzeumebSi.xls'), 'official/ka/dasakmebulebi_muzeumebSi.xls', XLS, '2026-10-20T07:30:09Z'),
    ('geostat_ka_culture_theatres', 'Georgian version: main indicators of professional theatres', KA_CULTURE_PAGE,
     *_media(79916, 'Teatrebis-ZiriTadi-maCveneblebi.xls'), 'official/ka/Teatrebis-ZiriTadi-maCveneblebi.xls', XLS,
     '2026-10-20T07:30:11Z'),
    ('geostat_ka_culture_theatres_regions', 'Georgian version: main indicators of professional theatres by regions', KA_CULTURE_PAGE,
     *_media(79918, 'Teatrebis-ZiriTadi-maCveneblebi-regionebis-mixedvit.xls'),
     'official/ka/Teatrebis-ZiriTadi-maCveneblebi-regionebis-mixedvit.xls', XLS, '2026-10-20T07:30:13Z'),
    ('geostat_ka_culture_theatres_count_regions', 'Georgian version: number of professional theatres by regions', KA_CULTURE_PAGE,
     *_media(79920, 'Teatrebis_raodenoba_regionebis_mixedviT.XLS'), 'official/ka/Teatrebis_raodenoba_regionebis_mixedviT.XLS', XLS,
     '2026-10-20T07:30:15Z'),
    ('geostat_ka_culture_theatre_staff', 'Georgian version: staff employed in theatres', KA_CULTURE_PAGE,
     *_media(79922, 'dasakmebulebi_propesiul_TeatrebSi.xls'), 'official/ka/dasakmebulebi_propesiul_TeatrebSi.xls', XLS,
     '2026-10-20T07:30:17Z'),
    ('geostat_ka_culture_theatre_events', 'Georgian version: events held by theatres', KA_CULTURE_PAGE,
     *_media(79924, 'RonisZiebebi.xls'), 'official/ka/RonisZiebebi.xls', XLS, '2026-10-20T07:30:19Z'),
    ('geostat_ka_culture_museums_regions', 'Georgian version: museums, main characteristics by regions', KA_CULTURE_PAGE,
     *_media(79910, 'muzeumebis_ZiriTadi_maCveneblebi_regionebis_mixedviT.XLS'),
     'official/ka/muzeumebis_ZiriTadi_maCveneblebi_regionebis_mixedviT.XLS', XLS, '2026-10-20T07:30:31Z'),
    ('geostat_science_page', 'Geostat page: science (category 194)', SCIENCE_PAGE, 'https://www.geostat.ge/en/modules/categories/194',
     SCIENCE_PAGE, 'official/geostat-category-194-2026-10-20.html', HTML, '2026-10-20T07:28:38Z'),
    ('geostat_culture_page', 'Geostat page: culture (category 615)', CULTURE_PAGE, 'https://www.geostat.ge/en/modules/categories/615',
     CULTURE_PAGE, 'official/geostat-category-615-2026-10-20.html', HTML, '2026-10-20T07:28:40Z'),
]
FILE = {source[0]: source[5] for source in SOURCES}
FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']
BREAK_FIELDS = ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note']

RESEARCHERS, RD_STAFF, INSTITUTIONS, PATENTS = ('geostat_science_researchers', 'geostat_science_rd_staff',
                                                'geostat_science_institutions', 'geostat_science_patents')
MUSEUMS, MUSEUMS_REGIONS, MUSEUMS_COUNT_REGIONS, MUSEUM_STAFF = ('geostat_culture_museums', 'geostat_culture_museums_regions',
                                                                  'geostat_culture_museums_count_regions', 'geostat_culture_museum_staff')
THEATRES, THEATRE_EVENTS, THEATRE_STAFF = 'geostat_culture_theatres', 'geostat_culture_theatre_events', 'geostat_culture_theatre_staff'
THEATRES_REGIONS = 'geostat_culture_theatres_regions'  # Archived; read for one cross-check only.
SERVED = [RESEARCHERS, RD_STAFF, INSTITUTIONS, PATENTS, MUSEUMS, MUSEUMS_REGIONS, MUSEUMS_COUNT_REGIONS, MUSEUM_STAFF, THEATRES,
          THEATRE_EVENTS, THEATRE_STAFF]

UNITS = {'researchers': 'persons', 'rd_staff': 'persons', 'institutions': 'count', 'rd_spending': 'gel_million',
         'invention_applications': 'count', 'invention_patents': 'count', 'utility_applications': 'count', 'utility_patents': 'count',
         'museums': 'count', 'museum_visitors': 'persons_thousand', 'museum_tours': 'count_thousand', 'museum_exhibitions': 'count',
         'museum_staff': 'persons', 'theatres': 'count', 'theatre_seats': 'count_thousand', 'theatre_audience': 'persons_thousand',
         'theatre_shows': 'count', 'theatre_events': 'count', 'theatre_staff': 'persons'}
WHOLE_UNITS = {'persons', 'count'}
# Number formats the served cells use, and the decimals each shows. A General cell shows the decimals it stores.
FORMAT_PLACES = {'General': 0, '#\\ ##0': 0, '#\\ ###': 0, '0': 0, '0.0': 1, '#,##0.0': 1}
DISPLAY = Context(prec=15, rounding=ROUND_HALF_UP)  # Excel shows a stored double to 15 significant digits.
# "-" is none (zero) in these sources, where the rows add up only with it read as zero. In the events rows of Events.xls it
# means "not collected" before 2021 and produces no row.
DASH_IS_ZERO = {RESEARCHERS, RD_STAFF, PATENTS, MUSEUM_STAFF, THEATRE_STAFF}
EVENTS_FIRST_YEAR = 2021

YEARS = {RESEARCHERS: (2019, 2024), RD_STAFF: (2019, 2024), INSTITUTIONS: (2019, 2024), PATENTS: (2016, 2025),
         MUSEUMS: (2005, 2025), MUSEUMS_REGIONS: (2005, 2025), MUSEUMS_COUNT_REGIONS: (2005, 2025), MUSEUM_STAFF: (2020, 2025),
         THEATRES: (2006, 2025), THEATRE_EVENTS: (2006, 2025), THEATRE_STAFF: (2020, 2025), THEATRES_REGIONS: (2006, 2025)}

# Region labels, matched by their exact printed text (after collapsing spaces; Geostat prints " Tbilisi" and "Adjar AR").
REGIONS = {
    'Georgia, total': 'total', 'Tbilisi': 'region_tbilisi', 'Adjar AR': 'region_adjara', 'Adjara AR': 'region_adjara',
    'Guria': 'region_guria', 'Imereti': 'region_imereti', 'Kakheti': 'region_kakheti', 'Mtskheta-Mtianeti': 'region_mtskheta_mtianeti',
    'Racha-Lechkhumi and Kvemo svaneti': 'region_racha_lechkhumi_kvemo_svaneti',
    'Samegrelo-Zemo Svaneti': 'region_samegrelo_zemo_svaneti', 'Samtskhe-Javakheti': 'region_samtskhe_javakheti',
    'Kvemo Kartli': 'region_kvemo_kartli', 'Shida Kartli': 'region_shida_kartli'}
REGION_IDS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
              'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
              'region_kvemo_kartli', 'region_shida_kartli']

# Row labels per table, matched by their exact text. A value is (measure, group), or a name starting with "_" for a row that is
# read for a cross-check or not used. An unlisted label stops the run.
RESEARCHER_SHEETS = {
    '1': ('Number of Researchers by Level of Education', {
        'Researchers, total': ('researchers', 'total'), 'Doctoral or equivalent (ISCED 8)': ('researchers', 'degree_doctoral'),
        "Master's or equivalent (ISCED 7)": ('researchers', 'degree_master'),
        "Bachelor's or equivalent (ISCED 6)": ('researchers', 'degree_bachelor'),
        'Short-cycle tertiary (ISCED 5/4)': ('researchers', 'degree_short_cycle')}),
    '2': ('Number of Researchers by Age Groups', {
        'Researchers, total': '_total', '<25': ('researchers', 'age_under25'), '25-34': ('researchers', 'age_25_34'),
        '35-44': ('researchers', 'age_35_44'), '45-54': ('researchers', 'age_45_54'), '55-64': ('researchers', 'age_55_64'),
        '65+': ('researchers', 'age_65_plus')}),
    '3': ('Number of Researchers by Fields of Science', {
        'Researchers total': '_total', 'Natural sciences': ('researchers', 'field_natural'),
        'Engineering and technology': ('researchers', 'field_engineering'),
        'Medical and health sciences': ('researchers', 'field_medical'),
        'Agricultural and veterinary sciences': ('researchers', 'field_agricultural'),
        'Social sciences': ('researchers', 'field_social'), 'Humanities and the arts': ('researchers', 'field_humanities'),
        'Not identified': ('researchers', 'field_not_identified')})}
RD_STAFF_TITLE = 'Number of Persons working on R&D by Status'
RD_STAFF_LABELS = {
    'R&D personnel, total': ('rd_staff', 'total'), 'Researchers': '_researchers',
    'Technicians and equivalent staff': ('rd_staff', 'technicians'), 'Other supporting staff': ('rd_staff', 'support'),
    'Not specified': ('rd_staff', 'not_specified')}

PLAIN_TABLES = {
    INSTITUTIONS: ('Number of Institutions that conducted R&D and their expenditures', {
        'Institutions, unit': ('institutions', 'total'), 'Total expenditure on R&D (Millions of GEL)': ('rd_spending', 'total')}),
    MUSEUMS: ('Museums (Museum Unions) and Museum Reserves', {
        'Number of Museums, total': ('museums', 'total'), 'Memorial Museum': ('museums', 'type_memorial'),
        'History/Regional Studies Museum': ('museums', 'type_history'), 'Arts Museum': ('museums', 'type_art'),
        'Museum Reserve Museum': ('museums', 'type_reserve'), 'Literature studies Museum': ('museums', 'type_literature'),
        'Others Museum': ('museums', 'type_other'), 'Number of visitors, million persons': '_visitors_million',
        'Average number of visitors per museum, thsd. Persons': '_average_visitors', 'Number of excursions, thsd.': '_tours',
        'Number of exhibitions': '_exhibitions'}),
    THEATRES: ('Main Indicators Of Professional Theatres', {
        'Total number of theatres': ('theatres', 'total'), 'drama, musical comedy and miniatures': ('theatres', 'type_drama'),
        'puppet': ('theatres', 'type_puppet'), 'opera and ballet': ('theatres', 'type_opera_ballet'),
        'children and youth': ('theatres', 'type_youth'),
        'Number of seats in the hall, thsd (Including rented)': ('theatre_seats', 'total')}),
    THEATRE_EVENTS: ('Data on events held by theaters', {
        'Number of events (within the country)': ('theatre_events', 'total'),
        'of which: Number of offsite events': ('theatre_events', 'away'), 'Number of events held abroad': ('theatre_events', 'abroad'),
        'Number of participants in events held abroad, persons': '_participants_abroad',
        'Number of attendance at events within the country, thsd. persons*': ('theatre_audience', 'total'),
        'Average attendance per event within the country, persons*': '_average_attendance',
        'Number of performances (within the country)': ('theatre_shows', 'total'),
        'of which: Number of offsite performances': ('theatre_shows', 'away'),
        'Number of performances held abroad': ('theatre_shows', 'abroad')})}
EVENTS_FOOTNOTE = '*2006-2020 data includes only performances.'

MUSEUM_BLOCKS = {'Number of visitors, thsd': 'museum_visitors', 'Number of excursions, thsd': 'museum_tours',
                 'Number of exhibitions, unit': 'museum_exhibitions'}
MUSEUM_REGION_TITLE = 'Main charasteristics of Museums (Museum Unions) and Museum Reserves by regions'
MUSEUM_COUNT_REGION_TITLE = 'Number of Museums (Museum Unions) and Museum Reserves by regions'
THEATRE_REGION_TITLE = 'Main Indicators Of Professional Theatres by Regions'

STAFF_TITLES = {MUSEUM_STAFF: ('museum_staff', 'Number of Staff Employed in Museums'),
                THEATRE_STAFF: ('theatre_staff', 'Number of Staff Employed in Theatres')}
STAFF_BLOCKS = ('Total', 'Women', 'Men')
STAFF_LABELS = {'Employed, total': 'total', 'Permanent, staff members': 'permanent',
                'Under a regular contract basis (agreement)': 'contract', 'under 25 years': 'age_under25',
                '25-54 years': 'age_25_54', '55 years and older': 'age_55_plus'}

PATENT_SHEETS = {'1': ('invention', 'Invention'), '2': ('utility', 'Utility Model')}
PATENT_PROCEDURES = {'National Procedure': 'national', 'International Procedure': 'international'}
PATENT_KINDS = {'Number of Filed Applications': 'applications', 'Number of Registered Patents': 'patents'}
PATENT_COLUMNS = {('national', 'applications', 'Local'): 'local', ('national', 'applications', 'Foreign'): 'foreign',
                  ('national', 'patents', 'Local'): 'local', ('national', 'patents', 'Foreign'): 'foreign',
                  ('international', 'applications', ''): 'international', ('international', 'patents', ''): 'international'}

# Values Geostat prints, as published.
ANCHORS = {('science_culture.researchers.total', 2024): '14046', ('science_culture.researchers.women', 2024): '7732',
           ('science_culture.rd_staff.total', 2024): '16191', ('science_culture.institutions.total', 2024): '66',
           ('science_culture.rd_spending.total', 2024): '242.9', ('science_culture.invention_applications.local', 2025): '79',
           ('science_culture.invention_patents.local', 2025): '41', ('science_culture.invention_applications.international', 2025): '85',
           ('science_culture.museums.total', 2025): '261', ('science_culture.museum_visitors.total', 2025): '1998.924',
           ('science_culture.museum_visitors.region_samtskhe_javakheti', 2025): '164.893',
           ('science_culture.theatres.total', 2025): '53', ('science_culture.theatre_audience.total', 2025): '620.322'}
VISITORS_TOLERANCE = Decimal('0.1')  # Thousand persons: the national file's million persons times 1000 against the regional file.
TOURS_TOLERANCE = Decimal('0.2')     # Thousand tours: Geostat rounds the regional tours to one decimal in early years.
# Years in which the 11 regions do not add up to Georgia's visitors (thousand persons; parts minus total, as printed). The national
# file's Georgia figure agrees with the regional file's, so it is the regional rows that fall short. Recorded exactly: any other
# difference, or a different amount in these years, stops the run.
KNOWN_DIFFERENCES = {'museum_visitors': {2005: Decimal('-0.013'), 2013: Decimal('-0.019'), 2023: Decimal('-0.030')}}

SERIES_BREAKS = [{
    'break_id': 'theatre_audience_2021', 'applies_to': 'science_culture.theatre_audience.total', 'reference_date': '2021-01-01',
    'reason': f'Geostat footnote: "{EVENTS_FOOTNOTE}" The audience of 2021 and later is therefore not comparable with that of '
              '2006-2020, and Fiscal.ge calculates no change across 2021.',
    'source_note': 'Geostat Events.xls footnote * (row "Number of attendance at events within the country, thsd. persons*", '
                   'cell A12)'}]


def published(value, places):
    """Round half-up from the value as Excel displays it (15 significant digits)."""
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


def is_dash(cell):
    return cell is not None and cell['kind'] == 's' and text(cell) == '-'


def token(cell):
    """The shortest number text that reads back as the stored double, without a trailing .0: the same text xlrd and SheetJS give."""
    if cell is None or cell['kind'] != 'n':
        raise ValueError(f'Expected a number, found {None if cell is None else cell["value"]!r} in {None if cell is None else cell["cell"]}')
    shown = format(Decimal(repr(float(cell['value']))), 'f')
    return shown[:-2] if shown.endswith('.0') else shown


def cell_number(cell):
    return Decimal(token(cell))


def number_or_zero(cell, source_id):
    """The value text of a served cell: its number, or 0 for a "-" where the source's rows add up only with "-" read as zero."""
    if is_dash(cell):
        if source_id not in DASH_IS_ZERO:
            raise ValueError(f'Expected a number, found a dash in {cell["cell"]} of {source_id}')
        return '0'
    return token(cell)


def places_of(cell, unit):
    """Decimals the published value shows: none for counts and persons; for thousands and million GEL the larger of the decimals
    the cell's number format shows and the decimals the stored number has (Geostat stores visitors to three decimals in cells
    formatted with one)."""
    if is_dash(cell):
        if unit not in WHOLE_UNITS:
            raise ValueError(f'A dash in {cell["cell"]} is not a whole number')
        return 0
    if cell['format'] not in FORMAT_PLACES:
        raise ValueError(f'Unexpected number format {cell["format"]!r} in {cell["cell"]}')
    shown = FORMAT_PLACES[cell['format']]
    stored = -Decimal(token(cell)).as_tuple().exponent if '.' in token(cell) else 0
    if unit in WHOLE_UNITS:
        if shown or stored:
            raise ValueError(f'{cell["cell"]} shows or stores decimals, but its unit is {unit}')
        return 0
    return max(shown, stored)


def year_columns(cells):
    """{year: column} for the integer cells of a row that are years; empty when the row has none."""
    found = {}
    for column, cell in cells.items():
        if cell['kind'] == 'n' and cell['value'] == int(cell['value']) and 1900 <= cell['value'] <= 2100:
            year = int(cell['value'])
            if year in found:
                raise ValueError(f'{year} is printed twice in {cell["cell"]}')
            found[year] = column
    return found


def region_group(label):
    group = REGIONS.get(clean(label))
    if group is None:
        raise ValueError(f'Unexpected region label {label!r}')
    return group


def _read_xlsx(path, sheet_name):
    """{row number: {column letters: cell}} for every non-empty cell, reading the original XML number tokens."""
    with ZipFile(path) as archive:
        sheets = ET.fromstring(archive.read('xl/workbook.xml')).findall('x:sheets/x:sheet', NS)
        matching = [item for item in sheets if item.get('name') == sheet_name]
        if len(matching) != 1:
            raise ValueError(f'Unexpected worksheet layout: {path.name} has no single sheet {sheet_name!r}')
        relation_id = matching[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = next(r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels')) if r.get('Id') == relation_id)
        sheet_path = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('.//x:t', NS))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        formats = {0: 'General', 1: '0', 2: '0.00'}
        formats.update({int(f.get('numFmtId')): f.get('formatCode') for f in styles.findall('x:numFmts/x:numFmt', NS)})
        style_formats = [formats.get(int(s.get('numFmtId')), 'unsupported') for s in styles.findall('x:cellXfs/x:xf', NS)]
        rows = {}
        # ElementTree reads a self-closing <c .../> as a cell without a value, so it can never swallow the cell after it.
        for cell in ET.fromstring(archive.read(sheet_path)).findall('x:sheetData/x:row/x:c', NS):
            coordinate = cell.get('r')
            column, number = re.fullmatch(r'([A-Z]+)(\d+)', coordinate).groups()
            value_element, kind = cell.find('x:v', NS), cell.get('t', 'n')
            if kind == 'inlineStr':
                value, kind = ''.join(t.text or '' for t in cell.findall('.//x:t', NS)), 's'
            elif value_element is None or value_element.text is None:
                continue
            elif kind == 's':
                value = strings[int(value_element.text)]
            elif kind == 'n':
                value = Decimal(value_element.text)
            else:
                raise ValueError(f'Unexpected cell type {kind!r} in {path.name} {sheet_name}!{coordinate}')
            rows.setdefault(int(number), {})[column] = {'value': value, 'cell': coordinate, 'kind': kind,
                                                        'format': style_formats[int(cell.get('s', '0'))]}
    return rows


def is_xls(source_id):
    return FILE[source_id].lower().endswith('.xls')


@functools.lru_cache(maxsize=None)
def _workbook(source_id):
    return xlrd.open_workbook(ROOT / FILE[source_id], formatting_info=True)


@functools.lru_cache(maxsize=None)
def sheet(source_id, name):
    """{row number: {column letters: {'value', 'cell', 'kind', 'format'}}} for every non-empty cell, from either file type."""
    if not is_xls(source_id):
        return _read_xlsx(ROOT / FILE[source_id], name)
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


def source_cell(row):
    column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
    return sheet(row['source_id'], row['source_sheet']).get(int(number), {}).get(column)


def observation(measure, group, year, cell, source_id, source_sheet):
    unit = UNITS[measure]
    if cell is None:
        raise ValueError(f'No value for {measure}.{group} {year} in {source_sheet} of {source_id}')
    value = number_or_zero(cell, source_id)
    return {'year': year, 'indicator_id': f'science_culture.{measure}.{group}', 'value': value,
            'published_value': published(value, places_of(cell, unit)), 'unit': unit, 'basis': 'actual', 'value_status': 'official',
            'source_id': source_id, 'source_sheet': source_sheet, 'source_cell': cell['cell']}


def check_title(rows, expected, where):
    title = text(rows.get(1, {}).get('A'))
    if not title.startswith(expected):
        raise ValueError(f'Unexpected title in {where}: {title!r}')


def check_years(years, source_id, where):
    first, last = YEARS[source_id]
    if sorted(years) != list(range(first, last + 1)):
        raise ValueError(f'Unexpected years in {where}: {sorted(years)}')


def year_row(rows, where):
    numbers = [n for n, cells in sorted(rows.items()) if len(year_columns(cells)) > 1]
    if not numbers:
        raise ValueError(f'No year heading in {where}')
    return numbers[0]


def is_footnote(label):
    return label.startswith(('Source', 'Note', '*'))


def is_of_which(label):
    return label.lower() in ('of which', 'of which:')


def labelled_rows(rows, first, labels, where):
    """{value of labels: row number} for the labelled rows from `first` down to the first footnote, each named in column A."""
    found = {}
    for number in sorted(n for n in rows if n >= first):
        label = text(rows[number].get('A'))
        if not label or is_of_which(label):
            continue
        if is_footnote(label):
            break
        key = labels.get(label)
        if key is None or key in found:
            raise ValueError(f'Unexpected row {number} in {where}: {label!r}')
        found[key] = number
    if set(found) != set(labels.values()):
        raise ValueError(f'Unexpected rows in {where}: {sorted(set(found) ^ set(labels.values()), key=str)}')
    return found


# Researchers and R&D staff: a year heading over a Total, Women and Men column.

@functools.lru_cache(maxsize=None)
def triple_table(source_id, sheet_name):
    """({year: {'total', 'women', 'men': column}}, {key of the labels: row number}) of a researcher or R&D staff sheet."""
    title, labels = RESEARCHER_SHEETS[sheet_name] if source_id == RESEARCHERS else (RD_STAFF_TITLE, RD_STAFF_LABELS)
    rows = sheet(source_id, sheet_name)
    where = f'{source_id} sheet {sheet_name}'
    check_title(rows, title, where)
    heading = year_row(rows, where)
    years = year_columns(rows[heading])
    check_years(years, source_id, where)
    columns = {}
    for year, total in years.items():
        start = column_number(total)
        names = [text(rows.get(heading + 1, {}).get(column_letters(start + i))) for i in range(3)]
        if names != list(STAFF_BLOCKS):
            raise ValueError(f'The columns under {year} in {where} are {names}, not Total, Women, Men')
        columns[year] = {'total': total, 'women': column_letters(start + 1), 'men': column_letters(start + 2)}
    spans = sorted(column_number(c['total']) for c in columns.values())
    if any(b - a != 3 for a, b in zip(spans, spans[1:])):
        raise ValueError(f'The year columns of {where} are not three columns wide')
    return columns, labelled_rows(rows, heading + 2, labels, where)


def triple_observations(source_id, sheet_name):
    columns, found = triple_table(source_id, sheet_name)
    rows = sheet(source_id, sheet_name)
    result = []
    for (measure, group), number in ((k, n) for k, n in found.items() if not isinstance(k, str)):
        for year, column in sorted(columns.items()):
            names = ('total', 'women', 'men') if group == 'total' else ('total',)
            for name in names:
                result.append(observation(measure, name if group == 'total' else group, year, rows[number].get(column[name]),
                                          source_id, sheet_name))
    return result


def researcher_observations():
    rows = []
    for name in RESEARCHER_SHEETS:
        rows += triple_observations(RESEARCHERS, name)
    return rows


def rd_staff_observations():
    return triple_observations(RD_STAFF, '1')


# Single-year-column tables: one sheet, a year heading row, labelled rows.

@functools.lru_cache(maxsize=None)
def plain_table(source_id):
    title, labels = PLAIN_TABLES[source_id]
    rows = sheet(source_id, '1')
    where = f'{source_id} sheet 1'
    check_title(rows, title, where)
    heading = year_row(rows, where)
    years = year_columns(rows[heading])
    check_years(years, source_id, where)
    return years, labelled_rows(rows, heading + 1, labels, where)


def plain_observations(source_id):
    years, found = plain_table(source_id)
    rows = sheet(source_id, '1')
    result = []
    for key, number in found.items():
        if isinstance(key, str):
            continue
        measure, group = key
        for year, column in sorted(years.items()):
            cell = rows[number].get(column)
            if measure == 'theatre_events' and year < EVENTS_FIRST_YEAR:
                if not is_dash(cell):
                    raise ValueError(f'Expected "-" (not collected) for {group} events in {year}, found {cell}')
                continue
            result.append(observation(measure, group, year, cell, source_id, '1'))
    return result


# Museums by region: three blocks under a heading in column B, each Georgia and the 11 regions.

@functools.lru_cache(maxsize=None)
def museum_blocks():
    rows = sheet(MUSEUMS_REGIONS, '1')
    where = f'{MUSEUMS_REGIONS} sheet 1'
    check_title(rows, MUSEUM_REGION_TITLE, where)
    heading = year_row(rows, where)
    years = year_columns(rows[heading])
    check_years(years, MUSEUMS_REGIONS, where)
    blocks, current = {}, None
    for number in sorted(n for n in rows if n > heading):
        cells = rows[number]
        if set(cells) == {'B'}:
            measure = MUSEUM_BLOCKS.get(text(cells['B']))
            if measure is None or measure in blocks:
                raise ValueError(f'Unexpected block heading in {where} row {number}: {text(cells["B"])!r}')
            current = blocks[measure] = {}
        elif text(cells.get('A')):
            group = region_group(text(cells['A']))
            if current is None or group in current:
                raise ValueError(f'Unexpected row {number} in {where}: {text(cells["A"])!r}')
            current[group] = number
        else:
            raise ValueError(f'Unexpected row {number} in {where}')
    for measure, groups in blocks.items():
        if set(groups) != {'total', *REGION_IDS}:
            raise ValueError(f'Unexpected rows in the {measure} block of {where}: {sorted(groups)}')
    if set(blocks) != set(MUSEUM_BLOCKS.values()):
        raise ValueError(f'Unexpected blocks in {where}: {sorted(blocks)}')
    return years, blocks


def museum_region_observations():
    years, blocks = museum_blocks()
    rows = sheet(MUSEUMS_REGIONS, '1')
    return [observation(measure, group, year, rows[number].get(column), MUSEUMS_REGIONS, '1')
            for measure, groups in blocks.items() for group, number in groups.items() for year, column in sorted(years.items())]


@functools.lru_cache(maxsize=None)
def museum_count_table():
    rows = sheet(MUSEUMS_COUNT_REGIONS, '1')
    where = f'{MUSEUMS_COUNT_REGIONS} sheet 1'
    check_title(rows, MUSEUM_COUNT_REGION_TITLE, where)
    heading = year_row(rows, where)
    years = year_columns(rows[heading])
    check_years(years, MUSEUMS_COUNT_REGIONS, where)
    groups = {}
    for number in sorted(n for n in rows if n > heading):
        group = region_group(text(rows[number].get('A')))
        if group in groups:
            raise ValueError(f'{group} is printed twice in {where}')
        groups[group] = number
    if set(groups) != {'total', *REGION_IDS}:
        raise ValueError(f'Unexpected rows in {where}: {sorted(groups)}')
    return years, groups


def museum_count_observations():
    years, groups = museum_count_table()
    rows = sheet(MUSEUMS_COUNT_REGIONS, '1')
    return [observation('museums', group, year, rows[number].get(column), MUSEUMS_COUNT_REGIONS, '1')
            for group, number in groups.items() if group != 'total' for year, column in sorted(years.items())]


# Staff in museums and theatres: a Total, a Women and a Men block, each with its own year heading.

@functools.lru_cache(maxsize=None)
def staff_blocks(source_id):
    measure, title = STAFF_TITLES[source_id]
    rows = sheet(source_id, '1')
    where = f'{source_id} sheet 1'
    check_title(rows, title, where)
    blocks, current = {}, None
    for number in sorted(n for n in rows if n > 1):
        cells, label = rows[number], text(rows[number].get('A'))
        if set(cells) == {'A'}:
            if label in STAFF_BLOCKS:
                if label in blocks:
                    raise ValueError(f'The {label} block is printed twice in {where}')
                current = blocks[label] = {'years': None, 'rows': {}}
            elif not is_of_which(label):
                raise ValueError(f'Unexpected row {number} in {where}: {label!r}')
        elif not label and year_columns(cells):
            if current is None or current['years'] is not None:
                raise ValueError(f'Unexpected year heading in {where} row {number}')
            current['years'] = year_columns(cells)
            check_years(current['years'], source_id, where)
        else:
            group = STAFF_LABELS.get(label)
            if current is None or current['years'] is None or group is None or group in current['rows']:
                raise ValueError(f'Unexpected row {number} in {where}: {label!r}')
            current['rows'][group] = number
    if list(blocks) != list(STAFF_BLOCKS):
        raise ValueError(f'Unexpected blocks in {where}: {list(blocks)}')
    for name, block in blocks.items():
        if set(block['rows']) != set(STAFF_LABELS.values()) or block['years'] != blocks['Total']['years']:
            raise ValueError(f'The {name} block of {where} has other rows or years than the Total block')
    return blocks


def staff_observations(source_id):
    measure = STAFF_TITLES[source_id][0]
    blocks = staff_blocks(source_id)
    rows = sheet(source_id, '1')
    result = []
    for year, column in sorted(blocks['Total']['years'].items()):
        for group, number in blocks['Total']['rows'].items():
            result.append(observation(measure, group, year, rows[number].get(column), source_id, '1'))
        for block, group in (('Women', 'women'), ('Men', 'men')):
            result.append(observation(measure, group, year, rows[blocks[block]['rows']['total']].get(blocks[block]['years'][year]),
                                      source_id, '1'))
    return result


# Patents: a year in column A of each row; National (Local, Foreign) and International procedure columns.

@functools.lru_cache(maxsize=None)
def patent_table(sheet_name):
    prefix, title = PATENT_SHEETS[sheet_name]
    rows = sheet(PATENTS, sheet_name)
    where = f'{PATENTS} sheet {sheet_name}'
    check_title(rows, title, where)
    if text(rows.get(2, {}).get('A')) != 'Year':
        raise ValueError(f'Unexpected heading in {where}')
    columns, procedure, kind = {}, None, None
    for column in sorted({c for n in (2, 3, 4) for c in rows[n] if c != 'A'}, key=column_number):
        procedure = PATENT_PROCEDURES[text(rows[2][column])] if text(rows[2].get(column)) else procedure
        kind = PATENT_KINDS[text(rows[3][column])] if text(rows[3].get(column)) else kind
        group = PATENT_COLUMNS.get((procedure, kind, text(rows[4].get(column))))
        if group is None:
            raise ValueError(f'Unexpected column {column} in {where}')
        columns[column] = (f'{prefix}_{kind}', group)
    if len(set(columns.values())) != 6 or len(columns) != 6:
        raise ValueError(f'Unexpected columns in {where}: {columns}')
    years = {}
    for number in sorted(n for n in rows if n > 4):
        cell = rows[number].get('A')
        if cell is None or cell['kind'] != 'n':
            break
        years[int(cell['value'])] = number
    check_years(years, PATENTS, where)
    return columns, years


def patent_observations():
    result = []
    for name in PATENT_SHEETS:
        columns, years = patent_table(name)
        rows = sheet(PATENTS, name)
        result += [observation(measure, group, year, rows[number].get(column), PATENTS, name)
                   for column, (measure, group) in columns.items() for year, number in sorted(years.items())]
    return result


def extract():
    """Every served observation, transcribed from its original cell."""
    rows = researcher_observations() + rd_staff_observations() + plain_observations(INSTITUTIONS)
    rows += patent_observations() + plain_observations(MUSEUMS) + museum_count_observations() + museum_region_observations()
    rows += staff_observations(MUSEUM_STAFF) + plain_observations(THEATRES) + plain_observations(THEATRE_EVENTS)
    return rows + staff_observations(THEATRE_STAFF)


def expected_keys():
    """Every served (indicator, year), from the spec's year ranges."""
    keys = set()

    def add(measure, groups, first, last, skip=()):
        keys.update((f'science_culture.{measure}.{group}', year) for group in groups for year in range(first, last + 1)
                    if year not in skip)

    people = ['total', 'women', 'men']
    add('researchers', people + ['degree_doctoral', 'degree_master', 'degree_bachelor', 'degree_short_cycle', 'age_under25', 'age_25_34',
                                 'age_35_44', 'age_45_54', 'age_55_64', 'age_65_plus', 'field_natural', 'field_engineering',
                                 'field_medical', 'field_agricultural', 'field_social', 'field_humanities', 'field_not_identified'],
        2019, 2024)
    add('rd_staff', people + ['technicians', 'support', 'not_specified'], 2019, 2024)
    add('institutions', ['total'], 2019, 2024)
    add('rd_spending', ['total'], 2019, 2024)
    for prefix in ('invention', 'utility'):
        for kind in ('applications', 'patents'):
            add(f'{prefix}_{kind}', ['local', 'foreign', 'international'], 2016, 2025)
    add('museums', ['total', 'type_memorial', 'type_history', 'type_art', 'type_reserve', 'type_literature', 'type_other'] + REGION_IDS,
        2005, 2025)
    for measure in ('museum_visitors', 'museum_tours', 'museum_exhibitions'):
        add(measure, ['total'] + REGION_IDS, 2005, 2025)
    staff = people + ['permanent', 'contract', 'age_under25', 'age_25_54', 'age_55_plus']
    add('museum_staff', staff, 2020, 2025)
    add('theatre_staff', staff, 2020, 2025)
    add('theatres', ['total', 'type_drama', 'type_puppet', 'type_opera_ballet', 'type_youth'], 2006, 2025)
    add('theatre_seats', ['total'], 2006, 2025)
    add('theatre_audience', ['total'], 2006, 2025)
    add('theatre_shows', ['total', 'away', 'abroad'], 2006, 2025)
    add('theatre_events', ['total', 'away', 'abroad'], EVENTS_FIRST_YEAR, 2025)
    return keys


# Cross-checks that read the workbooks directly.

def repeated_totals_agree():
    """The researchers' total, women and men are printed on all three researcher sheets and as the "Researchers" row of the R&D
    staff table; each copy equals sheet 1. Returns the number of cells compared."""
    base_columns, base_found = triple_table(RESEARCHERS, '1')
    base = sheet(RESEARCHERS, '1')[base_found[('researchers', 'total')]]
    copies = [(RESEARCHERS, '2', '_total'), (RESEARCHERS, '3', '_total'), (RD_STAFF, '1', '_researchers')]
    checked = 0
    for source_id, name, label in copies:
        columns, found = triple_table(source_id, name)
        copy = sheet(source_id, name)[found[label]]
        for year in base_columns:
            for part in ('total', 'women', 'men'):
                if number_or_zero(copy.get(columns[year][part]), source_id) != number_or_zero(base.get(base_columns[year][part]), RESEARCHERS):
                    raise ValueError(f'The researchers of {year} ({part}) differ between {source_id} sheet {name} and the researchers table')
                checked += 1
    return checked


def national_visitors_agree(values):
    """The national file's visitors (million persons) times 1000 equal the regional file's Georgia row (thousand) within 0.1."""
    years, found = plain_table(MUSEUMS)
    row = sheet(MUSEUMS, '1')[found['_visitors_million']]
    checked = 0
    for year, column in years.items():
        if abs(cell_number(row.get(column)) * 1000 - values[('science_culture.museum_visitors.total', year)]) > VISITORS_TOLERANCE:
            raise ValueError(f'The national visitors of {year} differ from the regional Georgia row by more than {VISITORS_TOLERANCE}')
        checked += 1
    return checked


def theatre_regions_audience():
    """{year: Decimal} of the Georgia row under "Number of attendants, thsd" in the by-region theatre workbook."""
    rows = sheet(THEATRES_REGIONS, '1')
    where = f'{THEATRES_REGIONS} sheet 1'
    check_title(rows, THEATRE_REGION_TITLE, where)
    heading = year_row(rows, where)
    years = year_columns(rows[heading])
    check_years(years, THEATRES_REGIONS, where)
    marks = [n for n, cells in rows.items() if set(cells) == {'B'} and text(cells['B']) == 'Number of attendants, thsd']
    if len(marks) != 1 or text(rows.get(marks[0] + 1, {}).get('A')) != 'Georgia, total':
        raise ValueError(f'Expected one attendants block starting with the Georgia row in {where}')
    return {year: cell_number(rows[marks[0] + 1].get(column)) for year, column in years.items()}


def audience_agrees(values):
    """The audience in Events.xls equals the by-region workbook's Georgia row: exactly, or - in the years where Events.xls prints
    one decimal - that number rounded half-up to one decimal. Returns the years that needed the rounding."""
    rounded = []
    for year, regional in theatre_regions_audience().items():
        audience = values[('science_culture.theatre_audience.total', year)]
        if audience == regional:
            continue
        if audience != regional.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP) or audience.as_tuple().exponent < -1:
            raise ValueError(f'The theatre audience of {year} differs between Events.xls and the by-region workbook')
        rounded.append(year)
    return rounded


def validate(rows):
    keys, values, shown = set(), {}, {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        measure = row['indicator_id'].split('.')[1]
        if row['unit'] != UNITS[measure] or (row['basis'], row['value_status']) != ('actual', 'official'):
            raise ValueError(f'Unexpected unit or status: {key}')
        cell = source_cell(row)
        if cell is None or published(Decimal(row['value']), places_of(cell, row['unit'])) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        values[key] = Decimal(row['value'])
        shown[key] = row['published_value']
    if keys != expected_keys():
        raise ValueError(f'Coverage mismatch: {len(expected_keys() - keys)} missing, {len(keys - expected_keys())} extra')
    if any(year > 2025 for _, year in keys):
        raise ValueError('A year after 2025 is served')

    def adds_up(measure, groups, label, first, last, tolerance=Decimal(0)):
        known = KNOWN_DIFFERENCES.get(measure, {}) if label == 'regions' else {}
        for year in range(first, last + 1):
            total = values[(f'science_culture.{measure}.total', year)]
            parts = sum(values[(f'science_culture.{measure}.{group}', year)] for group in groups)
            failed = parts - total != known[year] if year in known else abs(parts - total) > tolerance
            if failed:
                raise ValueError(f'The {measure} {label} do not add up to the total in {year} as recorded')

    for measure, first, last in (('researchers', 2019, 2024), ('rd_staff', 2019, 2024), ('museum_staff', 2020, 2025),
                                 ('theatre_staff', 2020, 2025)):
        adds_up(measure, ['women', 'men'], 'women and men', first, last)
    for label, groups in (('degrees', ['degree_doctoral', 'degree_master', 'degree_bachelor', 'degree_short_cycle']),
                          ('age groups', ['age_under25', 'age_25_34', 'age_35_44', 'age_45_54', 'age_55_64', 'age_65_plus']),
                          ('fields', ['field_natural', 'field_engineering', 'field_medical', 'field_agricultural', 'field_social',
                                      'field_humanities', 'field_not_identified'])):
        adds_up('researchers', groups, label, 2019, 2024)
    for year in range(2019, 2025):
        parts = values[('science_culture.researchers.total', year)] + sum(
            values[(f'science_culture.rd_staff.{group}', year)] for group in ('technicians', 'support', 'not_specified'))
        if parts != values[('science_culture.rd_staff.total', year)]:
            raise ValueError(f'Researchers and the other R&D staff do not add up to all R&D staff in {year}')
    for measure in ('museum_staff', 'theatre_staff'):
        adds_up(measure, ['permanent', 'contract'], 'contract types', 2020, 2025)
        adds_up(measure, ['age_under25', 'age_25_54', 'age_55_plus'], 'age groups', 2020, 2025)
    adds_up('museums', ['type_memorial', 'type_history', 'type_art', 'type_reserve', 'type_literature', 'type_other'], 'types', 2005, 2025)
    adds_up('museums', REGION_IDS, 'regions', 2005, 2025)
    adds_up('museum_visitors', REGION_IDS, 'regions', 2005, 2025)
    adds_up('museum_exhibitions', REGION_IDS, 'regions', 2005, 2025)
    adds_up('museum_tours', REGION_IDS, 'regions', 2005, 2025, TOURS_TOLERANCE)
    adds_up('theatres', ['type_drama', 'type_puppet', 'type_opera_ballet', 'type_youth'], 'types', 2006, 2025)
    agreement = {'repeated_researcher_cells': repeated_totals_agree(), 'national_visitor_years': national_visitors_agree(values),
                 'audience_years_rounded_to_one_decimal': audience_agrees(values)}
    for (indicator_id, year), expected in ANCHORS.items():
        if shown[(indicator_id, year)] != expected:
            raise ValueError(f'The anchor value does not match Geostat: {indicator_id} {year}')
    for row in rows:
        if number_or_zero(source_cell(row), row['source_id']) != row['value']:
            raise ValueError(f'The value does not match its source cell: {row["indicator_id"]} {row["year"]} {row["source_cell"]}')
    if any(row['indicator_id'].startswith('science_culture.theatre_events.') and row['year'] < EVENTS_FIRST_YEAR for row in rows):
        raise ValueError('An events row before 2021 is served')
    return agreement


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
        'scope': 'Annual research only, calendar years: researchers (total, women, men, by degree, age and field of science), R&D '
                 'staff, research institutions and R&D spending, 2019-2024; patent applications and registered patents (inventions '
                 'and utility models; local, foreign and international), 2016-2025; museums (types, regions, visitors, group tours, '
                 'exhibitions) 2005-2025 and museum staff 2020-2025; professional theatres (types, seats, audience, performances) '
                 '2006-2025, events 2021-2025, and theatre staff 2020-2025; no derived value, no monthly or quarterly value',
        'primary_observation_count': len(rows), 'observations_by_measure': dict(sorted(by_measure.items())),
        'observations_by_source': dict(sorted(by_source.items())), 'indicator_count': len(by_indicator),
        'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': {
            'coverage_matches_year_ranges': True, 'values_match_source_cells': True,
            'published_values_are_rounded_stored_values_at_stored_or_displayed_decimals': True,
            'dash_cells_read_as_zero': sorted(DASH_IS_ZERO),
            'dash_cells_in_events_rows_before_2021_are_not_collected_and_have_no_row': True,
            'women_and_men_add_up_to_total': ['researchers', 'rd_staff', 'museum_staff', 'theatre_staff'],
            'degrees_ages_and_fields_add_up_to_all_researchers': True,
            'researchers_and_other_rd_staff_add_up_to_all_rd_staff': True,
            'contract_types_and_age_groups_add_up_to_all_staff': ['museum_staff', 'theatre_staff'],
            'museum_types_and_regions_add_up_to_museums': True,
            'regions_add_up_to_georgia': {'museum_visitors': '0', 'museum_exhibitions': '0', 'museum_tours': str(TOURS_TOLERANCE)},
            'recorded_differences_parts_minus_total': {measure: {str(year): str(amount) for year, amount in years.items()}
                                                       for measure, years in KNOWN_DIFFERENCES.items()},
            'theatre_types_add_up_to_theatres': True,
            'researchers_repeated_in_other_sheets_and_rd_staff_agree': agreement['repeated_researcher_cells'],
            'national_visitors_times_1000_equal_regional_georgia_within': {'tolerance': str(VISITORS_TOLERANCE),
                                                                           'years': agreement['national_visitor_years']},
            'events_audience_equals_theatre_regions_georgia_row_years_needing_one_decimal_rounding':
                agreement['audience_years_rounded_to_one_decimal'],
            'no_events_rows_before_2021': True, 'rows_found_by_printed_label_and_year_never_by_position': True,
            'anchor_values': {f'{i}:{y}': p for (i, y), p in ANCHORS.items()}},
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'science-culture-annual.csv': csv_bytes(rows, FIELDS),
        'science-culture-series-breaks.csv': csv_bytes(SERIES_BREAKS, BREAK_FIELDS),
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
