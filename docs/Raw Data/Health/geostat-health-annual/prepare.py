"""Reproduce and check the annual health research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
Rows are found by their printed English label (or, in the causes-of-death table, by area name and Roman numeral) and
columns by their year heading, never by fixed positions. Geostat's spelling mistakes are matched as printed.

    python3 prepare.py           # rebuild every generated file
    python3 prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
import csv
from decimal import Decimal, ROUND_HALF_UP
import functools
import hashlib
import html
import io
import json
from pathlib import Path
import re
import sys
from urllib.parse import quote
from xml.etree import ElementTree as ET
from zipfile import ZipFile


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
RETRIEVED_AT = '2026-10-15'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
SITE = 'https://www.geostat.ge'
HEALTH_PAGE, DEATHS_PAGE = f'{SITE}/en/modules/categories/54', f'{SITE}/en/modules/categories/320'
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
PLACEHOLDERS = ('…', '...', '-')  # Geostat's marks for "not published" and "none"
NUMBER = re.compile(r'-?\d+(\.\d+)?')
MARKED = re.compile(r'(\d+)(\*+)')  # a number with footnote asterisks, such as "34***"

# (Geostat media id, file name) in the order of the two source-url lists.
HEALTH_FILES = [
    (81716, 'Main-characteristics-of-public-health.xlsx'), (81717, 'Number-of-physicians-by-occupations.xlsx'),
    (81718, 'Number-of-paramedical-personnel-by-basic-specialities.xlsx'), (81719, 'Abortions.xlsx'),
    (81720, 'Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx'),
    (81721, 'Morbidity-of-children-(0-14-years-old)-with-acute-and-chronic-diseases.xlsx'),
    (81722, 'Morbidity-caused-by-some-infectious-disease.xlsx'), (81723, 'Morbidity-of-patients-with-syphilis-and-gonorrheae.xlsx'),
    (81724, 'Morbidity-of-patients-with-tuberculosis.xlsx'), (81725, 'Morbidity-of-patients-with-HIV-AIDS.xlsx'),
    (81726, 'Emergent-Medical-Care.xlsx'), (81727, 'New-Cases-of-Anemia.xlsx'), (81728, 'New-Cases-of-Diabetes-Mellitus.xlsx'),
    (81729, 'circulatory-system.xlsx'), (81730, 'respiratory-system.xlsx'), (81733, '16_Number-of-persons_medicines.xlsx'),
    (81734, '17_The-cost-of-medicines.xlsx'), (81735, '18_The-number-of-beneficiaries-with-disabilities.xlsx'),
    (81736, '19_Number-of-cases-services-of-persons-with-disabilities.xlsx'),
    (81737, '20_Number-of-cases_services-of-persons-with-disabilities-by-Regions.xlsx'),
    (81747, 'Number-of-Beneficiaries-Screened-for-Malignant-Neoplasms.xlsx'),
]
DEATHS_FILES = [
    (77871, '25-1-Infant-mortality-rate-by-regions-and-sex.xlsx'), (77874, '26-1-Under-5-mortality-rate-by-regions-andsex.xlsx'),
    (78382, '24-1-Crude-death-rate-by-regions.xlsx'), (80758, '23-1-deaths-by-chapters-sex.xlsx'),
    (80759, '23-2-deaths-by-chapters-regions.xlsx'), (80760, '23-3-deaths-by-chapters-urban-rural.xlsx'),
    (80761, '23-4-deaths-by-chapters-age-sex.xlsx'), (80763, '23-6-Number-of-maternal-deaths-by-regions.xlsx'),
    (80764, '23-7-Number-of-maternal-deaths-by-age-groups.xlsx'), (80765, '23-10-Deaths-from-suicide-by-regions-and-sex.xlsx'),
    (80767, '23-11-Suicide-rate-by-sex.xlsx'), (81048, '23-5-deaths-by-causes-age-sex.xlsx'),
    (83203, '23-8-Maternal--mortality-rate-by-regions.xlsx'),
]
SERVED = {  # file name -> source ID of the eleven workbooks whose cells are served
    'Number-of-physicians-by-occupations.xlsx': 'geostat_health_physicians',
    'Number-of-paramedical-personnel-by-basic-specialities.xlsx': 'geostat_health_nurses',
    'Main-characteristics-of-public-health.xlsx': 'geostat_health_main',
    'Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx': 'geostat_health_morbidity_groups',
    'Morbidity-of-patients-with-tuberculosis.xlsx': 'geostat_health_tuberculosis',
    'Morbidity-of-patients-with-HIV-AIDS.xlsx': 'geostat_health_hiv',
    'New-Cases-of-Diabetes-Mellitus.xlsx': 'geostat_health_diabetes',
    'New-Cases-of-Anemia.xlsx': 'geostat_health_anaemia',
    'Morbidity-of-patients-with-syphilis-and-gonorrheae.xlsx': 'geostat_health_sti',
    '23-2-deaths-by-chapters-regions.xlsx': 'geostat_deaths_by_cause_region',
    '24-1-Crude-death-rate-by-regions.xlsx': 'geostat_death_rate_region',
}


def _slug(stem):
    return re.sub(r'[^a-z0-9]+', '_', stem.lower()).strip('_')


def _sources():
    """(source_id, title, source page, retrieved URL, resolved URL, local file, content type)"""
    out = []
    for files, folder, prefix, page in ((HEALTH_FILES, '', 'geostat_health_', HEALTH_PAGE), (DEATHS_FILES, 'deaths/', 'geostat_deaths_', DEATHS_PAGE)):
        for media, name in files:
            stem = name.rsplit('.', 1)[0]
            path = f'/media/{media}/{quote(name, safe="")}'
            title = ' '.join(re.sub(r'(?<!\d)-|-(?!\d)|_', ' ', stem).split())  # "23-2 deaths by chapters regions", "(0-14 years old)"
            out.append((SERVED.get(name, prefix + _slug(stem)), title, page,
                        f'https://geostat.ge{path}', f'{SITE}{path}', f'official/{folder}{name}', XLSX))
    out += [('geostat_health_page', 'Healthcare (source page capture)', HEALTH_PAGE, HEALTH_PAGE, f'{HEALTH_PAGE}/healthcare',
             'official/health-page.html', HTML),
            ('geostat_deaths_page', 'Deaths (source page capture)', DEATHS_PAGE, DEATHS_PAGE, f'{DEATHS_PAGE}/deaths',
             'official/deaths-page.html', HTML)]
    return out


SOURCES = _sources()
LOCAL_FILE = {source[0]: source[5] for source in SOURCES}

FIELDS = ['year', 'indicator_id', 'area_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id',
          'source_sheet', 'source_cell', 'source_number_format']
GEORGIA = 'georgia'
REGION_IDS = [('Tbilisi', 'region.tbilisi'), ('Adjara A.R.', 'region.adjara'), ('Guria', 'region.guria'), ('Imereti', 'region.imereti'),
              ('Kakheti', 'region.kakheti'), ('Mtskheta-Mtianeti', 'region.mtskheta_mtianeti'),
              ('Racha-Lechkhumi and Kvemo Svaneti', 'region.racha_lechkhumi_kvemo_svaneti'),
              ('Samegrelo-Zemo Svaneti', 'region.samegrelo_zemo_svaneti'), ('Samtskhe-Javakheti', 'region.samtskhe_javakheti'),
              ('Kvemo Kartli', 'region.kvemo_kartli'), ('Shida Kartli', 'region.shida_kartli')]
AREAS_23_2 = [('Georgia', GEORGIA)] + REGION_IDS
AREAS_24_1 = [('Georgia', GEORGIA)] + [('C. Tbilisi' if name == 'Tbilisi' else name, area) for name, area in REGION_IDS]  # "Abkhazia A.R." is skipped
REGIONS = [area for _, area in REGION_IDS]
CHAPTERS = [('I', 'infectious'), ('II', 'cancer'), ('III', 'blood'), ('IV', 'endocrine'), ('V', 'mental'), ('VI', 'nervous'),
            ('VII', 'eye'), ('VIII', 'ear'), ('IX', 'circulatory'), ('X', 'respiratory'), ('XI', 'digestive'), ('XII', 'skin'),
            ('XIII', 'musculoskeletal'), ('XIV', 'urogenital'), ('XV', 'pregnancy'), ('XVI', 'perinatal'), ('XVII', 'congenital'),
            ('XVIII', 'ill_defined'), ('XIX', 'external'), ('XXII', 'covid19')]  # XVIII is "Symptoms, signs ... ill-defined", XIX "Injury, poisoning"
CAUSES = [cause for _, cause in CHAPTERS]

# Row labels exactly as Geostat prints them (whitespace collapsed), spelling mistakes included.
SPECIALITIES = [('internal', 'Internal medicine doctors (therapeutists)'), ('surgery', 'surgeons'),
                ('obgyn', 'obstetricians-gynecologists'), ('paediatrics', 'pediatricians'), ('eye', 'ophtalmologists'),
                ('ent', 'otolaryngologists'), ('neurology', 'neuropayhologists'), ('psychiatry', 'psychiatrists and narcologists'),
                ('tuberculosis', 'phthisiologists'), ('dermatovenereology', 'dermatovenerologists'), ('radiology', 'radiologists'),
                ('rehabilitation', 'medical rehabilitation and sports medicine physicians'), ('dentistry', 'stomatologists'),
                ('other', 'others')]
NURSE_GROUPS = [('midwives', 'obstetricians', 2025), ('medical', 'medical nurses', 2025), ('doctor_assistants', "doctor's assistants", 2011),
                ('lab_assistants', "doctor's assistants-laboratory assistants", 2011), ('xray_assistants', 'X-ray-laboratory assistants', 2011),
                ('other', 'others', 2011)]
ILLNESS_GROUPS = [('infectious', 'infectious and parasitic diseases', 2002, 2025), ('cancer', 'neoplasms2)', 2002, 2025),
                  ('blood', 'diseases of blood and blood forming organs', 2002, 2025),
                  ('endocrine', 'diseases of endocrin system, digestion disorders, disorders of metabolism and immunity', 2002, 2025),
                  ('mental', 'psychic and behavioural disorders', 2002, 2025),
                  ('nervous_sense_organs', 'diseases of the nervous system and sense organs3)', 2002, 2005),
                  ('nervous', 'diseases of the nervous system', 2006, 2025), ('eye', 'diseases of the eye and adnexa', 2006, 2025),
                  ('ear', 'diseases of the ear and mastoid process', 2006, 2025),
                  ('circulatory', 'diseases of the circulatory system', 2002, 2025),
                  ('respiratory', 'diseases of the respiratory system', 2002, 2025), ('digestive', 'diseases of the digestive organs', 2002, 2025),
                  ('skin', 'diseases of the skin and subcutaneous tissue', 2002, 2025),
                  ('musculoskeletal', 'diseases of musculosceletal system and connective tissue', 2002, 2025),
                  ('urogenital', 'diseases of urogenital system', 2002, 2025),
                  ('pregnancy', 'complications of pregnancy, childbirth and postnatal period4)', 2002, 2025),
                  ('perinatal', 'certain conditions originated in the perinatal period4)', 2002, 2025),
                  ('congenital', 'congenital malformations', 2002, 2025), ('injuries', 'injuries and poisonings', 2002, 2025)]


class Spec:
    """Where one indicator lives: workbook, unit, served years, and its row (labelled, or a causes-of-death block row)."""

    def __init__(self, source_id, unit, years, label=None, after=None, first=False, areas=(GEORGIA,), window=None):
        self.source_id, self.unit, self.years, self.label, self.after, self.first = source_id, unit, years, label, after, first
        self.areas, self.window = list(areas), window


def _specs():
    out = {}
    physicians, nurses, main = 'geostat_health_physicians', 'geostat_health_nurses', 'geostat_health_main'
    out['health.staff.doctors'] = Spec(physicians, 'persons', (2002, 2025), 'Physicians, total')
    for name, label in SPECIALITIES:
        out[f'health.staff.doctors_{name}'] = Spec(physicians, 'persons', (2002, 2025), label, after='of which:')
    out['health.staff.nurses'] = Spec(nurses, 'persons', (2002, 2025), 'Total')
    for name, label, last in NURSE_GROUPS:
        out[f'health.staff.nurses_{name}'] = Spec(nurses, 'persons', (2002, last), label, after='of which:')
    out['health.facilities.hospitals'] = Spec(main, 'units', (2002, 2025), 'Number of hospitals and medical centers, unit')
    out['health.facilities.outpatient_clinics'] = Spec(
        main, 'units', (2002, 2025), 'Number of medical institutions rendering out-patient services to population, unit')
    out['health.facilities.beds'] = Spec(main, 'units_thousand', (2002, 2025), 'Number of hospital beds, thsd.')
    out['health.visits.outpatient'] = Spec(
        main, 'visits_thousand', (2002, 2025),
        'Number of visits in medical institutions rendering out-patient services to population (including prophylactics), thsd.')
    for name, label, first, last in ILLNESS_GROUPS:
        out[f'health.illness.{name}'] = Spec('geostat_health_morbidity_groups', 'persons_thousand', (first, last), label)
    out['health.illness.tuberculosis'] = Spec('geostat_health_tuberculosis', 'persons', (2002, 2025), 'of which new cases', first=True)
    out['health.illness.hiv'] = Spec('geostat_health_hiv', 'persons', (2002, 2025), 'of which new cases from total number', first=True)
    out['health.illness.diabetes'] = Spec('geostat_health_diabetes', 'persons', (2016, 2025), 'Total')
    out['health.illness.anaemia'] = Spec('geostat_health_anaemia', 'persons', (2016, 2025), 'Total')
    out['health.illness.syphilis'] = Spec('geostat_health_sti', 'persons', (2002, 2025), 'syphilis', first=True)
    out['health.illness.gonorrhoea'] = Spec('geostat_health_sti', 'persons', (2002, 2025), 'gonorrheae', first=True)
    areas = [area for _, area in AREAS_23_2]
    out['health.deaths.total'] = Spec('geostat_deaths_by_cause_region', 'persons', (2014, 2025), areas=areas)
    for numeral, cause in CHAPTERS:
        out[f'health.deaths.{cause}'] = Spec('geostat_deaths_by_cause_region', 'persons', (2020 if cause == 'covid19' else 2014, 2025),
                                             label=numeral, areas=areas)
    out['health.death_rate.total'] = Spec('geostat_death_rate_region', 'per_1000_population', (2014, 2025), areas=areas,
                                          window=(2014, 2025))  # 1994-2013 are retro-projections and are not served
    return out


SPECS = _specs()
CELL_LABELS = {indicator: spec.label for indicator, spec in SPECS.items() if spec.label and not spec.source_id.startswith('geostat_deaths')}

# Footnotes quoted by health-series-breaks.csv. Each must be printed in the named workbook.
FOOTNOTE_QUOTES = {
    'isco_physicians': ('geostat_health_physicians', 'In 2012 the health care human resources definitions were revised and classified in accordance '
                        'with International Standard Classification of Occupations (ISCO-08).'),
    'isco_nurses': ('geostat_health_nurses', "Positions were regrouped, wich are differrent to the current classification. Data 2012 doctor's "
                    "assistants-laboratory assistants and X-ray-laboratory assistants are not included in paramedical personnel. "
                    "Doctor's assistants are included in medical nurses category."),
    'register_physicians': ('geostat_health_physicians', 'Data from 2020 is based on a new system of personalized accounting for health care workers.'),
    'register_main': ('geostat_health_main', 'Accordingly, the 2020 data are not comparable to the 2002-2019 data.'),
    'icd10': ('geostat_health_morbidity_groups', 'Since 2006, ICD-10 has been used, according to which diseases of the nervous system are presented '
              'in 3 classes: diseases of the nervous system, eyes and ears.'),
    'electronic_groups': ('geostat_health_morbidity_groups', 'Since 2020, an electronic system for recording new cases of diseases in outpatient '
                          'facilities has been operating.'),
    'personalized_diabetes': ('geostat_health_diabetes', 'From 2020 - According to personalized data.'),
}
BREAK_FIELDS = ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note']


# ---------------------------------------------------------------- reading

def clean(value):
    """Whitespace (including non-breaking spaces) collapsed, zero-width characters dropped."""
    return ' '.join(value.replace('​', '').split()) if isinstance(value, str) else value


def _column_number(column):
    number = 0
    for letter in column:
        number = number * 26 + ord(letter) - 64
    return number


BUILT_IN_FORMATS = {0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 49: '@'}
CELL = re.compile(r'<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)')
ATTRIBUTE = re.compile(r'([\w:]+)="([^"]*)"')


def _text(xml):
    return html.unescape(''.join(re.findall(r'<t\b[^>]*>([\s\S]*?)</t>', re.sub(r'<rPh\b[\s\S]*?</rPh>', '', xml))))


def read_sheet(path):
    """The only worksheet of a workbook as {row: {column: {value, cell, kind, format}}}. Numbers stay exact decimal tokens
    ('n', Decimal); text is 'content' ('s'). A self-closing or valueless cell is absent. The path is found through the
    workbook's own relationship file."""
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = workbook.findall('x:sheets/x:sheet', NS)
        if len(sheets) != 1:
            raise ValueError(f'Expected one worksheet in {Path(path).name}, found {len(sheets)}')
        relation_id = sheets[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = next(rel.get('Target') for rel in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels')) if rel.get('Id') == relation_id)
        part = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('x:t', NS) + item.findall('x:r/x:t', NS))  # phonetic runs (rPh) are not text
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        custom = {int(f.get('numFmtId')): f.get('formatCode') for f in styles.findall('x:numFmts/x:numFmt', NS)}
        style_formats = []
        for xf in styles.findall('x:cellXfs/x:xf', NS):
            number = int(xf.get('numFmtId', '0'))
            style_formats.append(custom.get(number) or BUILT_IN_FORMATS.get(number, f'unsupported:{number}'))
        xml = archive.read(part).decode('utf-8')
    rows = defaultdict(dict)
    for attributes, body in CELL.findall(xml):
        attributes = dict(ATTRIBUTE.findall(attributes))
        coordinate, kind = attributes['r'], attributes.get('t', 'n')
        column, row = re.fullmatch(r'([A-Z]+)(\d+)', coordinate).groups()
        token = re.search(r'<v>([\s\S]*?)</v>', body or '')
        if kind == 'inlineStr':
            value = _text(body)
        elif token is None or token.group(1) == '':
            continue
        elif kind == 's':
            value = strings[int(token.group(1))]
        elif kind == 'str':
            value = html.unescape(token.group(1))
        elif kind == 'n':
            value = Decimal(token.group(1))
        else:
            raise ValueError(f'Unsupported cell type {kind}: {coordinate}')
        rows[int(row)][column] = {'value': value, 'cell': coordinate, 'kind': 'n' if kind == 'n' else 's',
                                  'format': style_formats[int(attributes.get('s', '0'))] if style_formats else 'General'}
    return {number: dict(sorted(cells.items(), key=lambda item: _column_number(item[0]))) for number, cells in sorted(rows.items())}


@functools.lru_cache(maxsize=None)
def sheet(source_id):
    return read_sheet(ROOT / LOCAL_FILE[source_id])


@functools.lru_cache(maxsize=None)
def sheet_name(source_id):
    with ZipFile(ROOT / LOCAL_FILE[source_id]) as archive:
        return ET.fromstring(archive.read('xl/workbook.xml')).find('x:sheets/x:sheet', NS).get('name')


def reread(source_id, name, address):
    """The cell at `address`, re-read from the preserved original."""
    if name != sheet_name(source_id):
        raise ValueError(f'Unexpected sheet {name} in {source_id}')
    column, row = re.fullmatch(r'([A-Z]+)(\d+)', address).groups()
    cell = sheet(source_id).get(int(row), {}).get(column)
    if cell is None:
        raise ValueError(f'No cell {address} in {source_id}')
    return cell


def workbook_text(source_id):
    return '\n'.join(clean(cell['value']) for row in sheet(source_id).values() for cell in row.values() if cell['kind'] == 's')


def check_footnote(source_id, text):
    if text not in workbook_text(source_id):
        raise ValueError(f'Quoted footnote is not printed in {source_id}: {text[:60]}')


def _label(cells):
    cell = cells.get('A')
    return clean(cell['value']) if cell and cell['kind'] == 's' else None


def find_row(rows, label, after=None, first=False):
    """The row number of a label (column A, whitespace collapsed, otherwise exactly as printed). Without `first` the label
    must be unique; with `after` the search starts below that (unique) label's row."""
    start = find_row(rows, after) if after else 0
    matches = [number for number, cells in rows.items() if number > start and _label(cells) == label]
    if not matches or (len(matches) > 1 and not first):
        raise ValueError(f'Expected row "{label}" not found exactly once' + (f' below "{after}"' if after else '') + f': {matches}')
    return matches[0]


def header_row(rows):
    """The first row whose cells (right of column A) are mostly four-digit years."""
    for number, cells in rows.items():
        if len(_years(cells)) >= 3:
            return number
    raise ValueError('No year heading row found')


def _years(cells):
    years = {}
    for column, cell in cells.items():
        text = str(cell['value']) if cell['kind'] == 'n' else clean(cell['value'])
        if column != 'A' and re.fullmatch(r'(19|20)\d\d', text):
            years[column] = int(text)
    return years


def year_columns(rows):
    """{column letter: year} from the heading row."""
    return _years(rows[header_row(rows)])


def cell_token(cell):
    """The exact stored token of a numeric cell. A "…", "..." or "-" is never a value."""
    if cell is None:
        raise ValueError('Unexpected empty cell')
    if cell['kind'] == 'n' and isinstance(cell['value'], Decimal):
        token = str(cell['value'])
        if not NUMBER.fullmatch(token):
            raise ValueError(f'Stored value is not a plain decimal: {token}')
        return token
    if cell['kind'] == 's' and clean(cell['value']) in PLACEHOLDERS:
        raise ValueError(f'Geostat placeholder ({clean(cell["value"])}) in a served cell')
    if cell['kind'] == 's' and MARKED.fullmatch(clean(cell['value'])):
        return MARKED.fullmatch(clean(cell['value'])).group(1)
    raise ValueError(f'Unexpected cell content: {cell}')


def check_marker(source_id, cell):
    """A number printed as text with footnote asterisks ("34***") is served as its digits only if the sheet prints that footnote."""
    marks = MARKED.fullmatch(clean(cell['value'])).group(2)
    if not any(clean(c['value']).startswith(marks + ' ') for row in sheet(source_id).values() for c in row.values() if c['kind'] == 's'):
        raise ValueError(f'Footnote {marks} for {cell["cell"]} is not printed in {source_id}')


def display(unit, token, number_format):
    """The value as published. Counts follow their zero-decimal format (half up). A rate follows its one-decimal format (half up):
    the death-rate cells hold unrounded doubles. A figure in thousands keeps the three decimals Geostat stores (one person or
    unit), because its 0.0 or whole-number format only trims the display. Excel keeps 15 significant digits, so the stored
    value is cut to 15 digits first."""
    shown = Decimal(format(float(token), '.15g'))
    if unit == 'per_1000_population':
        if number_format not in ('0.0', '#,##0.0'):
            raise ValueError(f'Unexpected number format for a rate: {number_format}')
        return str(shown.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))
    if unit in ('persons', 'units'):
        if number_format not in ('General', '0', '#\\ ##0', '##\\ ###', '#,##0'):
            raise ValueError(f'Unexpected number format for a count: {number_format}')
        if number_format != 'General':
            return str(int(shown.quantize(Decimal(1), rounding=ROUND_HALF_UP)))
    elif unit not in ('persons_thousand', 'units_thousand', 'visits_thousand') or number_format not in ('General', '0', '0.0', '#\\ ##0', '#,##0'):
        raise ValueError(f'Unexpected unit or number format: {unit} {number_format}')
    return format(shown.normalize(), 'f')


# ---------------------------------------------------------------- extraction

@functools.lru_cache(maxsize=None)
def death_blocks(source_id):
    """{area ID: (first row, {Roman numeral: row})} of the causes-of-death table: an area's header row, then its chapters."""
    rows = sheet(source_id)
    names = dict(AREAS_23_2)
    starts = [(number, names[_label(cells)]) for number, cells in rows.items() if _label(cells) in names]
    if sorted(area for _, area in starts) != sorted(names.values()):
        raise ValueError(f'Area header rows are not each found once in {source_id}')
    numerals = {numeral for numeral, _ in CHAPTERS}
    blocks = {}
    for index, (start, area) in enumerate(starts):
        end = starts[index + 1][0] if index + 1 < len(starts) else max(rows) + 1
        chapters = defaultdict(list)
        for number in (number for number in rows if start < number < end):
            if _label(rows[number]) in numerals:
                chapters[_label(rows[number])].append(number)
        if set(chapters) != numerals or any(len(found) != 1 for found in chapters.values()):
            raise ValueError(f'Chapters I-XIX and XXII are not each found once for {area}')
        blocks[area] = (start, {numeral: found[0] for numeral, found in chapters.items()})
    return blocks


@functools.lru_cache(maxsize=None)
def locate(indicator_id, area_id):
    """The row number holding an indicator for an area."""
    spec = SPECS[indicator_id]
    rows = sheet(spec.source_id)
    if spec.source_id == 'geostat_deaths_by_cause_region':
        start, chapters = death_blocks(spec.source_id)[area_id]
        return start if spec.label is None else chapters[spec.label]
    if spec.source_id == 'geostat_death_rate_region':
        return find_row(rows, dict((area, name) for name, area in AREAS_24_1)[area_id])
    return find_row(rows, spec.label, spec.after, spec.first)


@functools.lru_cache(maxsize=None)
def _window_columns(source_id, window):
    columns = year_columns(sheet(source_id))
    return {column: year for column, year in columns.items() if window is None or window[0] <= year <= window[1]}


def _window(spec):
    return _window_columns(spec.source_id, spec.window)


def cells_of(indicator_id, area_id):
    """{year: cell} of the numeric cells inside the table's window, which must be exactly the served years.
    Anything else in a year column must be empty or a Geostat placeholder."""
    spec = SPECS[indicator_id]
    row = sheet(spec.source_id)[locate(indicator_id, area_id)]
    found = {}
    for column, year in _window(spec).items():
        cell = row.get(column)
        if cell is None or (cell['kind'] == 's' and clean(cell['value']) in PLACEHOLDERS):
            continue
        if cell['kind'] == 's' and MARKED.fullmatch(clean(cell['value'])):
            check_marker(spec.source_id, cell)
        elif cell['kind'] != 'n':
            raise ValueError(f'Unexpected cell content for {indicator_id} {area_id} {year}: {cell}')
        found[year] = cell
    if set(found) != set(range(spec.years[0], spec.years[1] + 1)):
        raise ValueError(f'Coverage mismatch for {indicator_id} {area_id}: found {sorted(found)}')
    return found


def unavailable_years(indicator_id, area_id):
    spec = SPECS[indicator_id]
    return sorted(set(_window(spec).values()) - set(range(spec.years[0], spec.years[1] + 1)))


def extract():
    """Every served observation, located by label text and re-read from its original cell."""
    rows = []
    for indicator_id, spec in SPECS.items():
        for area_id in spec.areas:
            for year, cell in cells_of(indicator_id, area_id).items():
                token = cell_token(cell)
                rows.append({
                    'year': year, 'indicator_id': indicator_id, 'area_id': area_id, 'value': token,
                    'published_value': display(spec.unit, token, cell['format']), 'unit': spec.unit, 'basis': 'actual',
                    'value_status': 'published', 'source_id': spec.source_id, 'source_sheet': sheet_name(spec.source_id),
                    'source_cell': cell['cell'], 'source_number_format': cell['format']})
    return sorted(rows, key=lambda row: (row['indicator_id'], row['area_id'], row['year']))


@functools.lru_cache(maxsize=None)
def main_staff_thousands():
    """{'doctors'|'nurses': {year: Decimal}} thousands from the main characteristics table, used only to check the staff totals."""
    source_id = 'geostat_health_main'
    rows = sheet(source_id)
    out = {}
    for key, label in (('doctors', 'Number of physicians of all specialties total, thsd.*'), ('nurses', 'Number of nurses total, thsd.*')):
        row = rows[find_row(rows, label)]
        out[key] = {year: Decimal(cell_token(row.get(column))) for column, year in year_columns(rows).items()}
    return out


# ---------------------------------------------------------------- validation

def validate(rows):
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['area_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        spec = SPECS.get(row['indicator_id'])
        if spec is None or row['area_id'] not in spec.areas:
            raise ValueError(f'Unexpected indicator or area: {key}')
        if row['unit'] != spec.unit or row['basis'] != 'actual' or row['value_status'] != 'published' or row['source_id'] != spec.source_id:
            raise ValueError(f'Unexpected unit, basis, status or source: {key}')
        value = Decimal(row['value'])
        if value < 0:
            raise ValueError(f'Negative value: {key}')
        if display(row['unit'], row['value'], row['source_number_format']) != row['published_value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        by_key[key] = value
    expected = {(indicator, area, year) for indicator, spec in SPECS.items() for area in spec.areas for year in range(spec.years[0], spec.years[1] + 1)}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')

    def v(indicator, area, year):
        return by_key[(indicator, area, year)]

    thousands = main_staff_thousands()
    for year in range(2002, 2026):
        for key, label, indicator in (('doctors', 'Doctors', 'health.staff.doctors'), ('nurses', 'Nurses', 'health.staff.nurses')):
            if (thousands[key][year] * 1000).quantize(Decimal(1), rounding=ROUND_HALF_UP) != v(indicator, GEORGIA, year):
                raise ValueError(f'{label} differ from the main characteristics table (thousands x 1,000): {year}')
        if sum(v(f'health.staff.doctors_{name}', GEORGIA, year) for name, _ in SPECIALITIES) != v('health.staff.doctors', GEORGIA, year):
            raise ValueError(f'Doctor specialities do not add up to doctors: {year}')
    areas = [area for _, area in AREAS_23_2]
    for area in areas:
        for year in range(2014, 2026):
            # Covid-19 has no value before 2020: it counts as 0 inside this check only
            if sum(by_key.get((f'health.deaths.{cause}', area, year), Decimal(0)) for cause in CAUSES) != v('health.deaths.total', area, year):
                raise ValueError(f'Causes do not add up to all deaths: {area} {year}')
    for indicator in ['total'] + CAUSES:
        spec = SPECS[f'health.deaths.{indicator}']
        for year in range(spec.years[0], spec.years[1] + 1):
            if sum(v(f'health.deaths.{indicator}', area, year) for area in REGIONS) != v(f'health.deaths.{indicator}', GEORGIA, year):
                raise ValueError(f'The 11 regions do not add up to Georgia: {indicator} {year}')

    for row in rows:  # last, so an altered value is reported by the cross-check that notices it first
        indicator, area, year = row['indicator_id'], row['area_id'], row['year']
        cell = reread(row['source_id'], row['source_sheet'], row['source_cell'])
        column = next(column for column, found in _window(SPECS[indicator]).items() if found == year)
        if (row['source_cell'] != f'{column}{locate(indicator, area)}' or cell_token(cell) != row['value']
                or cell['format'] != row['source_number_format']):
            raise ValueError(f"Row disagrees with its source cell: {indicator} {area} {year} {row['source_cell']}")


# ---------------------------------------------------------------- outputs

def manifest():
    records = []
    for source_id, title, page, url, resolved, local_file, content_type in SOURCES:
        data = (ROOT / local_file).read_bytes()
        records.append({'source_id': source_id, 'dataset_title': title, 'publisher': PUBLISHER, 'source_page_url': page,
                        'retrieved_file_url': url, 'resolved_file_url': resolved, 'retrieved_at': RETRIEVED_AT,
                        'local_file': local_file, 'sha256': hashlib.sha256(data).hexdigest().upper(), 'bytes': len(data),
                        'content_type': content_type})
    return records


def csv_bytes(rows, fields):
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode('utf-8-sig')


def series_breaks():
    """The four counting changes of design section 8, each quoting the footnote Geostat prints."""
    for source_id, text in FOOTNOTE_QUOTES.values():
        check_footnote(source_id, text)
    q = {key: text for key, (_, text) in FOOTNOTE_QUOTES.items()}
    staff = ['health.staff.doctors'] + [f'health.staff.doctors_{name}' for name, _ in SPECIALITIES] + \
            ['health.staff.nurses'] + [f'health.staff.nurses_{name}' for name, _, _ in NURSE_GROUPS]
    groups = [f'health.illness.{name}' for name, _, _, _ in ILLNESS_GROUPS]
    return [
        {'break_id': 'staff_definitions_2012', 'applies_to': ';'.join(staff), 'reference_date': '2012-01-01',
         'reason': f'Geostat revised the definitions of health staff in 2012, so values before and after are on different bases and no growth '
                   f'may be computed across it. The physicians table says: "{q["isco_physicians"]}" The nurses table adds: "{q["isco_nurses"]}"',
         'source_note': 'Geostat footnote ("Notice" or "Note") on Number-of-physicians-by-occupations.xlsx, Number-of-paramedical-personnel-by-basic-'
                        'specialities.xlsx and Main-characteristics-of-public-health.xlsx'},
        {'break_id': 'staff_register_2020', 'applies_to': ';'.join(staff), 'reference_date': '2020-01-01',
         'reason': f'From 2020 staff come from a new personal register of health workers and are not comparable with 2002-2019. '
                   f'Geostat: "{q["register_physicians"]}" On the main characteristics table: "{q["register_main"]}"',
         'source_note': 'Geostat footnote on Number-of-physicians-by-occupations.xlsx, Number-of-paramedical-personnel-by-basic-specialities.xlsx '
                        '(same sentence) and Main-characteristics-of-public-health.xlsx'},
        {'break_id': 'icd10_groups_2006', 'applies_to': ';'.join(f'health.illness.{n}' for n in ('nervous_sense_organs', 'nervous', 'eye', 'ear')),
         'reference_date': '2006-01-01',
         'reason': f'The combined nervous system and sense organs group ends in 2005 and three separate groups start in 2006. Geostat: "{q["icd10"]}"',
         'source_note': 'Geostat footnote 3) on Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx'},
        {'break_id': 'new_cases_electronic_2020', 'applies_to': ';'.join([g for g in groups if g != 'health.illness.nervous_sense_organs'] + ['health.illness.diabetes']),
         'reference_date': '2020-01-01',
         'reason': f'From 2020 new cases are recorded in an electronic out-patient system, and diabetes is counted from personal records. '
                   f'Geostat on the disease groups: "{q["electronic_groups"]}" On diabetes: "{q["personalized_diabetes"]}"',
         'source_note': 'Geostat footnote 1) on Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx and footnote * on '
                        'New-Cases-of-Diabetes-Mellitus.xlsx'},
    ]


def _ranges(years):
    out, start = [], None
    for index, year in enumerate(years):
        if start is None:
            start = year
        if index + 1 == len(years) or years[index + 1] != year + 1:
            out.append(str(start) if start == year else f'{start}-{year}')
            start = None
    return ';'.join(out)


FAMILIES = {'staff': 'staff', 'facilities': 'facilities and visits', 'visits': 'facilities and visits', 'illness': 'illness',
            'deaths': 'deaths by cause', 'death_rate': 'death rate'}


def build(check=False):
    rows = extract()
    validate(rows)
    sources = manifest()
    breaks = series_breaks()
    years = defaultdict(list)
    counts, families = defaultdict(int), defaultdict(int)
    for row in rows:
        years[(row['indicator_id'], row['area_id'])].append(row['year'])
        counts[row['source_id']] += 1
        families[FAMILIES[row['indicator_id'].split('.')[1]]] += 1
    marked = [{key: row[key] for key in ('indicator_id', 'area_id', 'year', 'source_id', 'source_cell', 'value')} |
              {'printed': reread(row['source_id'], row['source_sheet'], row['source_cell'])['value']}
              for row in rows if reread(row['source_id'], row['source_sheet'], row['source_cell'])['kind'] == 's']
    coverage_rows = [{'indicator_id': i, 'area_id': a, 'first_year': min(y), 'last_year': max(y), 'observations': len(y),
                      'unavailable_years': _ranges(unavailable_years(i, a))} for (i, a), y in sorted(years.items())]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_AT,
        'scope': 'Annual research only: Geostat healthcare tables 2002-2025 (staff, facilities, visits, illness) and causes of death and '
                 'death rates by region 2014-2025; no derived values and no serving',
        'primary_observation_count': len(rows), 'observations_by_family': dict(sorted(families.items())),
        'observations_by_source': dict(sorted(counts.items())), 'indicators': len(SPECS), 'areas': 12,
        'footnote_marked_cells': marked, 'placeholder_cells_in_served_values': 0, 'imputed_values': 0, 'calculated_values': 0, 'reconciliation_failed_count': 0,
        'checks': ['no duplicate, missing or extra observation, and no served year outside a table\'s coverage',
                   'a "…", "..." or "-" cell is never served as a value; anything but a number or one of these in a year column fails',
                   'published value equals the stored value at the precision Geostat prints (see README)',
                   'every row equals a fresh read of its source cell, number format, row label and year heading',
                   'doctors and nurses equal the main characteristics thousands x 1,000, every year 2002-2025',
                   'the 14 doctor specialities add up to doctors, every year',
                   'causes of death (chapters I-XIX and XXII) add up to all deaths for Georgia and each region, every year',
                   'the 11 regions add up to Georgia for all deaths and for each cause, every year',
                   'every footnote quoted in health-series-breaks.csv is printed in its workbook',
                   'all-deaths values equal demography.deaths in test_validation.py; independent-validation.json re-reads every cell with SheetJS'],
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'health-annual.csv': csv_bytes(rows, FIELDS),
        'health-series-breaks.csv': csv_bytes(breaks, BREAK_FIELDS),
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
