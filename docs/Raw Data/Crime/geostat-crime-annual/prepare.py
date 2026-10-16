"""Reproduce and check the annual crime and justice research package from its preserved sources.

Uses Python's standard library, plus xlrd 2.0.1 for the old .xls workbooks (research package only:
python3 -m pip install xlrd==2.0.1). Never downloads sources or serves product data.
Rows are found by their printed English label (a repeated label, by the block title or total row that precedes it) and
columns by their year heading, never by fixed positions. Geostat's spelling mistakes are matched as printed.
Downloaded workbooks are untrusted data: run the scripts with `python3 -I` from the package folder.

    python3 -I prepare.py           # rebuild every generated file
    python3 -I prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
import csv
from decimal import Decimal
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
RETRIEVED_AT = '2026-10-16'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
XLS = 'application/vnd.ms-excel'
HTML = 'text/html; charset=UTF-8'
SITE = 'https://www.geostat.ge'
PAGE_EN, PAGE_KA = f'{SITE}/en/modules/categories/132', f'{SITE}/ka/modules/categories/132'
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
PLACEHOLDERS = ('…', '...', '-')  # Geostat's marks for "not published" and "none"
GROUPED = re.compile(r'\d{1,3}(?: \d{3})+')  # a whole number printed as text with a space for thousands, such as "49 976"
QUARTER = re.compile(r'I-II (?:Q\.|quarters), 2026')  # the one part-year column; it is never served

# (English media id, English file, Georgian media id, Georgian file, source ID of the English file, title)
FILES = [
    (81890, 'Number-of-Recorded-Crimes.xlsx', 81889, 'registrirebuli-danaSaulis-raodenoba.xlsx', 'geostat_crime_recorded', 'Number of recorded crimes'),
    (31827, 'Number-of-Recorded-Crimes_2011.xls', 31826, 'registrirebuli-danaSauli_2011.xls', 'geostat_crime_recorded_2001_2011',
     'Number of recorded crimes 2001-2011 (old classification)'),
    (81980, 'Number-of-Convicts-by-Types-of-Crime.xls', 81979, 'msjavrdebulTa-ricxovnoba-danaSaulis-saxeebis-mixedviT.XLS',
     'geostat_crime_convicts_types', 'Number of convicts by types of crime'),
    (81982, 'Composition-of-Convicts-by-Age-and-Sex.XLS', 81981, 'msjavrdebulTa-ricxovnoba-asakisa-da-skesis-mixedviT.XLS',
     'geostat_crime_convicts_age_sex', 'Composition of convicts by age and sex'),
    (81984, 'Number-of-Convicts-and-Penalties-Prescribed-by-Court.XLS', 81983, 'msjavrdebulTa-ricxovnoba-sasjelis-RonisZiebebis-mixedviT.XLS',
     'geostat_crime_convicts_penalties', 'Number of convicts and penalties prescribed by court'),
    (81986, 'Juvenile-Offenders-Convicted-by-Type-of-Offence.XLS', 81985,
     'arasrulwlovani-msjavrdebulebis-raodenoba-Cadenili-danaSaulis-saxeebis-mi....xls', 'geostat_crime_juvenile',
     'Juvenile offenders convicted by type of offence'),
    (81046, 'Prison-Population.xls', 81045, 'patimarta-ricxovnoba.xls', 'geostat_crime_prison', 'Prison population'),
    (81892, 'Data-on-Victim-Statistics.xlsx', 81891, 'dazaralebulta-raodenoba.xlsx', 'geostat_crime_victims', 'Data on victim statistics'),
    (81914, 'Accidents.xlsx', 81913, 'avtosagzao-SemTxvevebi.xlsx', 'geostat_crime_road', 'Data on road traffic accidents'),
    (81894, 'Trafficking.xlsx', 81893, 'trefikingi.xlsx', 'geostat_crime_trafficking', 'Human trafficking'),
]


def _slug(stem):
    return re.sub(r'[^a-z0-9]+', '_', stem.lower()).strip('_')


def _content_type(name):
    return XLSX if name.lower().endswith('.xlsx') else XLS


def _sources():
    """(source_id, title, source page, retrieved URL, resolved URL, local file, content type): the ten English workbooks, their ten
    Georgian versions, then the two page captures."""
    out = []
    for media, name, _, _, source_id, title in FILES:
        path = f'/media/{media}/{quote(name, safe="")}'
        out.append((source_id, title, PAGE_EN, f'https://geostat.ge{path}', f'{SITE}{path}', f'official/{name}', _content_type(name)))
    for _, _, media, name, _, title in FILES:
        path = f'/media/{media}/{quote(name, safe="")}'
        out.append((f'geostat_crime_{_slug(name.rsplit(".", 1)[0])}_ka', f'{title} (Georgian version)', PAGE_KA, f'https://geostat.ge{path}',
                    f'{SITE}{path}', f'official/{name}', _content_type(name)))
    out += [('geostat_crime_page', 'Criminal justice statistics (source page capture)', PAGE_EN, PAGE_EN,
             f'{PAGE_EN}/criminal-justice-statistics', 'official/crime-page.html', HTML),
            ('geostat_crime_page_ka', 'Criminal justice statistics, Georgian (source page capture)', PAGE_KA, PAGE_KA,
             f'{PAGE_KA}/siskhlis-samartlis-statistika', 'official/crime-page-ka.html', HTML)]
    return out


SOURCES = _sources()
LOCAL_FILE = {source[0]: source[5] for source in SOURCES}
GEORGIAN_PAIRS = [(f'official/{ka}', f'official/{en}') for _, en, _, ka, _, _ in FILES]  # Georgian copy, English original

FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']
RECORDED, TYPES_, AGES_, PENALTIES_, PRISON_, VICTIMS_, ROAD_ = (
    'geostat_crime_recorded', 'geostat_crime_convicts_types', 'geostat_crime_convicts_age_sex', 'geostat_crime_convicts_penalties',
    'geostat_crime_prison', 'geostat_crime_victims', 'geostat_crime_road')


def years(first, last):
    return list(range(first, last + 1))


class Spec:
    """Where one indicator lives: workbook, unit, served years, its row label, and the labels to pass first (the title or total
    row that precedes it). A label that repeats in the sheet takes `first=True`: its first occurrence after `after`."""

    def __init__(self, source_id, unit, served, label, after=(), first=False):
        self.source_id, self.unit, self.years, self.label, self.after, self.first = source_id, unit, served, label, tuple(after), first


def _specs():
    out = {}
    out['crime.recorded.total'] = Spec(RECORDED, 'crimes', years(2015, 2025), 'Total crimes recorded')
    for name, label in (('life', 'Crimes against life'), ('health', 'Crimes against health'),
                        ('rights', 'Crimes against human rights and freedoms'), ('family', 'Crimes against the family and minor'),
                        ('property', 'Crimes against property'), ('public_safety', 'Crimes against public security and order'),
                        ('drugs', 'Drug-related offences'), ('transport', 'Transport crime'), ('malfeasance', 'Malfeasance'),
                        ('government', 'Crime against normal functioning of government'), ('other', 'Other Crimes')):
        out[f'crime.recorded.{name}'] = Spec(RECORDED, 'crimes', years(2015, 2025), label, after=('of which:',))
    convicts = years(2001, 2025)
    out['crime.convicted.total'] = Spec(TYPES_, 'persons', convicts, 'Total number of convicts')
    for name, label in (('murder', 'Intentional murder'), ('aggravated_murder', 'Aggravated murder'),
                        ('injury', 'Infliction of intentional injury'), ('rape', 'Rape'), ('larceny', 'Larceny'), ('robbery', 'Robbery'),
                        ('theft', 'Theft'), ('drugs', 'Illegal production, manufacturing, acquisition, storage, transportation and sale of drugs'),
                        ('hooliganism', 'Hooliganism'), ('traffic', 'Violation of rules of traffic safety and secure use of transport'),
                        ('other', 'Others')):
        out[f'crime.convicted.type_{name}'] = Spec(TYPES_, 'persons', convicts, label, after=('Type of crimes:',))
    for name, label in (('14_17', '14-17 years old'), ('18_24', '18-24 years old'), ('25_29', '25-29 years old'),
                        ('30_49', '30-49 years old'), ('50_plus', '50 years old and over')):
        out[f'crime.convicted.age_{name}'] = Spec(AGES_, 'persons', convicts, label, after=('Age Composition of Convicts (persons)', 'Of which:'))
    for name, label in (('women', 'Women'), ('men', 'Men')):
        out[f'crime.convicted.sex_{name}'] = Spec(AGES_, 'persons', convicts, label, after=('Sex Composition of Convicts (persons)', 'Of which:'))
    for name, label in (('prison', 'Imprisonment'), ('corrective_labour', 'Corrective labour'), ('suspended', 'Suspended conviction'),
                        ('fine', 'Fine'), ('deferred', 'Suspended sentence'), ('community_work', 'Public work'), ('other', 'Other penalties')):
        out[f'crime.convicted.sentence_{name}'] = Spec(PENALTIES_, 'persons', convicts, label, after=('Sentenced to:',))
    out['crime.prison.total'] = Spec(PRISON_, 'persons', convicts, 'Total number of inmates')
    for name, label in (('women', 'women'), ('men', 'men')):  # the first block's split of all inmates; the others repeat the labels
        out[f'crime.prison.{name}'] = Spec(PRISON_, 'persons', convicts, label, after=('Total number of inmates', 'among them:'), first=True)
    out['crime.prison.adults'] = Spec(PRISON_, 'persons', convicts, 'Number of adult inmates')
    out['crime.prison.juveniles'] = Spec(PRISON_, 'persons', convicts, 'Number of juvenile inmates')
    out['crime.prison.sentenced'] = Spec(PRISON_, 'persons', years(2010, 2025), 'Total number of Convicted')
    out['crime.prison.pretrial'] = Spec(PRISON_, 'persons', years(2010, 2025), 'Total number of defendants')
    victims = years(2007, 2011) + years(2015, 2025)
    out['crime.victims.total'] = Spec(VICTIMS_, 'persons', victims, 'Total number of victims')
    for name, label in (('men', 'Men'), ('women', 'Women'), ('unknown', 'Non specified')):
        out[f'crime.victims.sex_{name}'] = Spec(VICTIMS_, 'persons', victims, label, after=('of which:',))
    for name, label in (('under_17', 'less then 17'), ('17_24', '17-24'), ('25_44', '25-44'), ('45_plus', 'more then 44'), ('unknown', 'Nonspecified')):
        out[f'crime.victims.age_{name}'] = Spec(VICTIMS_, 'persons', victims, label, after=('Number of victims by age',), first=True)
    for name, label in (('georgia', 'Citizens of Georgia'), ('foreign', 'Foreigners'), ('dual', 'Dual citizenship'), ('stateless', 'Stateless'),
                        ('unknown', 'Nonspecified')):
        out[f'crime.victims.citizenship_{name}'] = Spec(VICTIMS_, 'persons', victims, label, after=('Number of victims by citizenship',))
    out['crime.road.accidents'] = Spec(ROAD_, 'accidents', convicts, 'Total number of road traffic accidents')
    out['crime.road.accidents_drunk'] = Spec(ROAD_, 'accidents', [year for year in convicts if year != 2002],
                                             'of which were caused by alcohol intoxication*')  # 2002 is printed as "…"
    out['crime.road.injured'] = Spec(ROAD_, 'persons', convicts, 'Persons injured')
    out['crime.road.killed'] = Spec(ROAD_, 'persons', convicts, 'Persons killed')
    return out


SPECS = _specs()
# The total rows of the other two convictions workbooks (and the sex block's), read only to check the served total
CHECKS = {
    'age_sex_ages_total': Spec(AGES_, 'persons', years(2001, 2025), 'Total number of convicts', after=('Age Composition of Convicts (persons)',),
                                    first=True),  # the sex block repeats the label
    'age_sex_sexes_total': Spec(AGES_, 'persons', years(2001, 2025), 'Total number of convicts', after=('Sex Composition of Convicts (persons)',)),
    'penalties_total': Spec(PENALTIES_, 'persons', years(2001, 2025), 'Total number of convicts'),
}
ORDER = {indicator: number for number, indicator in enumerate(SPECS)}

# Footnotes quoted by crime-series-breaks.csv. Each must be printed in the named workbook.
FOOTNOTE_QUOTES = {
    'drunk_driving': (ROAD_, '*Data on road traffic accidents caused by drunk driving from 2001 to 2024 covers only the jurisdiction of the Patrol '
                      'Police Department of the Ministry of Internal Affairs. However, starting from 2025, the data on road traffic accidents fully '
                      'covers the entire territory of Georgia. Accordingly, the 2025 data is not comparable with data from previous years.'),
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


def _column_letters(index):
    """The column letters of a 0-based column index."""
    letters = ''
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters


def a1(row, column):
    """The A1 address of a 0-based row and column, as .xls cells are addressed by xlrd."""
    return f'{_column_letters(column)}{row + 1}'


CELL = re.compile(r'<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)')
ATTRIBUTE = re.compile(r'([\w:]+)="([^"]*)"')


def _text(xml):
    return html.unescape(''.join(re.findall(r'<t\b[^>]*>([\s\S]*?)</t>', re.sub(r'<rPh\b[\s\S]*?</rPh>', '', xml))))


def _read_xlsx(path):
    """(sheet name, {row: {column: {value, cell, kind}}}) of the only worksheet of a .xlsx. Numbers stay exact decimal tokens
    ('n', Decimal); text is 'content' ('s'). A self-closing or valueless cell is absent."""
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
        rows[int(row)][column] = {'value': value, 'cell': coordinate, 'kind': 'n' if kind == 'n' else 's'}
    name = sheets[0].get('name')
    return name, {number: dict(sorted(cells.items(), key=lambda item: _column_number(item[0]))) for number, cells in sorted(rows.items())}


def _read_xls(path):
    """(sheet name, rows) of the only sheet of an .xls, read with xlrd 2.0.1. A cell's address is computed from its 0-based
    row and column."""
    try:
        import xlrd
    except ImportError as error:
        raise SystemExit('xlrd 2.0.1 is needed to read the .xls workbooks: python3 -m pip install xlrd==2.0.1') from error
    book = xlrd.open_workbook(str(path))
    if book.nsheets != 1:
        raise ValueError(f'Expected one worksheet in {Path(path).name}, found {book.nsheets}')
    sheet = book.sheet_by_index(0)
    rows = defaultdict(dict)
    for row in range(sheet.nrows):
        for column in range(sheet.ncols):
            cell_type = sheet.cell_type(row, column)
            if cell_type in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                continue
            if cell_type == xlrd.XL_CELL_NUMBER:
                value, kind = Decimal(repr(sheet.cell_value(row, column))), 'n'
            elif cell_type == xlrd.XL_CELL_TEXT:
                value, kind = sheet.cell_value(row, column), 's'
            else:
                raise ValueError(f'Unsupported cell type {cell_type}: {a1(row, column)} in {Path(path).name}')
            rows[row + 1][_column_letters(column)] = {'value': value, 'cell': a1(row, column), 'kind': kind}
    return sheet.name, dict(sorted(rows.items()))


def read_workbook(path):
    """(sheet name, {row number: {column letter: cell}}) of a one-sheet .xlsx or .xls."""
    return _read_xlsx(path) if str(path).lower().endswith('.xlsx') else _read_xls(path)


@functools.lru_cache(maxsize=None)
def _workbook(source_id):
    return read_workbook(ROOT / LOCAL_FILE[source_id])


def sheet(source_id):
    return _workbook(source_id)[1]


def sheet_name(source_id):
    return _workbook(source_id)[0]


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


def find_row(rows, label, after=(), first=False):
    """The row number of a label (column A, whitespace collapsed, otherwise exactly as printed). The search starts below the
    first occurrence of each label in `after`, in turn. Without `first` the label must then occur exactly once."""
    start = 0
    for step in after:
        found = [number for number, cells in rows.items() if number > start and _label(cells) == step]
        if not found:
            raise ValueError(f'Expected row "{step}" not found below row {start}')
        start = found[0]
    matches = [number for number, cells in rows.items() if number > start and _label(cells) == label]
    if not matches or (len(matches) > 1 and not first):
        raise ValueError(f'Expected row "{label}" not found exactly once' + (f' below "{after[-1]}"' if after else '') + f': {matches}')
    return matches[0]


def _is_header(cells):
    """A heading row has at least three numbers right of column A and all of them are increasing years."""
    numbers = [cell['value'] for column, cell in cells.items() if column != 'A' and cell['kind'] == 'n']
    return len(numbers) >= 3 and all(value == value.to_integral_value() and 1900 <= value <= 2100 for value in numbers) and \
        all(a < b for a, b in zip(numbers, numbers[1:]))


def header_rows(rows):
    return [number for number, cells in rows.items() if _is_header(cells)]


def year_columns(rows, header):
    """{column letter: year} of one heading row. The part-year column ("I-II Q., 2026" or "I-II quarters, 2026") is skipped;
    any other heading that is not a whole-number year is an error."""
    found = {}
    for column, cell in rows[header].items():
        if column == 'A':
            continue
        if cell['kind'] == 'n':
            if cell['value'] != cell['value'].to_integral_value() or not 1900 <= cell['value'] <= 2100:
                raise ValueError(f'Unexpected year heading {cell["value"]} in {cell["cell"]}')
            found[column] = int(cell['value'])
        elif clean(cell['value']) and not QUARTER.fullmatch(clean(cell['value'])):
            raise ValueError(f'Unexpected year heading {clean(cell["value"])!r} in {cell["cell"]}')
    return found


def header_for(rows, row):
    """The heading row that governs a data row: the nearest one above it."""
    above = [number for number in header_rows(rows) if number < row]
    if not above:
        raise ValueError(f'No year heading above row {row}')
    return max(above)


def cell_token(cell):
    """The exact value of a numeric cell as a whole-number token: 8897.0 is 8897 and the text '49 976' is 49976. A "…", "..."
    or "-" is never a value."""
    if cell is None:
        raise ValueError('Unexpected empty cell')
    if cell['kind'] == 'n':
        value = cell['value']
        if value != value.to_integral_value() or value < 0:
            raise ValueError(f'Stored value is not a whole count: {value}')
        return str(int(value))
    text = clean(cell['value'])
    if text in PLACEHOLDERS:
        raise ValueError(f'Geostat placeholder ({text}) in a served cell')
    if GROUPED.fullmatch(text):
        return text.replace(' ', '')
    raise ValueError(f'Unexpected cell content: {cell}')


# ---------------------------------------------------------------- extraction

def _spec(key):
    return SPECS[key] if key in SPECS else CHECKS[key]


@functools.lru_cache(maxsize=None)
def locate(key):
    """The row number holding an indicator (or check) in its workbook."""
    spec = _spec(key)
    return find_row(sheet(spec.source_id), spec.label, spec.after, spec.first)


@functools.lru_cache(maxsize=None)
def header_columns(key):
    """{column letter: year} of the heading above an indicator's row: every year the table prints for it."""
    rows = sheet(_spec(key).source_id)
    return year_columns(rows, header_for(rows, locate(key)))


def cells_of(key):
    """{year: cell} of the numeric cells in an indicator's row, which must be exactly the served years. Anything else in a year
    column must be empty or a Geostat placeholder."""
    spec = _spec(key)
    row = sheet(spec.source_id)[locate(key)]
    found = {}
    for column, year in header_columns(key).items():
        cell = row.get(column)
        if cell is None or (cell['kind'] == 's' and clean(cell['value']) in PLACEHOLDERS):
            continue
        if cell['kind'] == 's' and not GROUPED.fullmatch(clean(cell['value'])):
            raise ValueError(f'Unexpected cell content for {key} {year}: {cell}')
        found[year] = cell
    if set(found) != set(spec.years):
        raise ValueError(f'Coverage mismatch for {key}: found {sorted(found)}')
    return found


def check_values(key):
    """{year: Decimal} of a total row that is read only to check the served totals."""
    return {year: Decimal(cell_token(cell)) for year, cell in cells_of(key).items()}


def unavailable_years(indicator_id):
    """Years between the first and last year the table prints for a row that carry no served value."""
    printed = set(header_columns(indicator_id).values())
    return sorted(set(range(min(printed), max(printed) + 1)) - set(SPECS[indicator_id].years))


def extract():
    """Every served observation, located by label text and re-read from its original cell."""
    rows = []
    for indicator_id, spec in SPECS.items():
        for year, cell in cells_of(indicator_id).items():
            token = cell_token(cell)
            rows.append({'year': year, 'indicator_id': indicator_id, 'value': token, 'published_value': token, 'unit': spec.unit,
                         'basis': 'actual', 'value_status': 'official', 'source_id': spec.source_id,
                         'source_sheet': sheet_name(spec.source_id), 'source_cell': cell['cell']})
    return sorted(rows, key=lambda row: (ORDER[row['indicator_id']], row['year']))


# ---------------------------------------------------------------- validation

def validate(rows):
    keys, by_key = set(), {}
    for row in rows:
        key = (row['indicator_id'], row['year'])
        if key in keys:
            raise ValueError(f'Duplicate observation: {key}')
        keys.add(key)
        spec = SPECS.get(row['indicator_id'])
        if spec is None:
            raise ValueError(f'Unexpected indicator: {key}')
        if row['unit'] != spec.unit or row['basis'] != 'actual' or row['value_status'] != 'official' or row['source_id'] != spec.source_id:
            raise ValueError(f'Unexpected unit, basis, status or source: {key}')
        if not re.fullmatch(r'\d+', row['value']):
            raise ValueError(f'Value is not a whole non-negative count: {key} {row["value"]}')
        if row['published_value'] != row['value']:
            raise ValueError(f'Stored and published value disagree: {key}')
        by_key[key] = int(row['value'])
    expected = {(indicator, year) for indicator, spec in SPECS.items() for year in spec.years}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')

    def v(indicator, year):
        return by_key[(indicator, year)]

    def parts(prefix, names, year):
        return sum(v(f'crime.{prefix}{name}', year) for name in names)

    recorded = [name.split('.')[2] for name in SPECS if name.startswith('crime.recorded.') and name != 'crime.recorded.total']
    convicted = {kind: [name.split('.')[2] for name in SPECS if name.startswith(f'crime.convicted.{kind}_')]
                 for kind in ('type', 'age', 'sex', 'sentence')}
    victims = {kind: [name.split('.')[2] for name in SPECS if name.startswith(f'crime.victims.{kind}_')] for kind in ('sex', 'age', 'citizenship')}
    for year in SPECS['crime.recorded.total'].years:
        if parts('recorded.', recorded, year) != v('crime.recorded.total', year):
            raise ValueError(f'Recorded crime groups do not add up to the total: {year}')
    for year in SPECS['crime.convicted.total'].years:
        for kind, names in convicted.items():
            if parts('convicted.', names, year) != v('crime.convicted.total', year):
                raise ValueError(f'Convicts by {kind} do not add up to the total: {year}')
        for check in CHECKS:
            if int(check_values(check)[year]) != v('crime.convicted.total', year):
                raise ValueError(f'Convict totals differ between workbooks ({check}): {year}')
    for year in SPECS['crime.prison.total'].years:
        total = v('crime.prison.total', year)
        if v('crime.prison.women', year) + v('crime.prison.men', year) != total:
            raise ValueError(f'Prison women and men do not add up to the total: {year}')
        if v('crime.prison.adults', year) + v('crime.prison.juveniles', year) != total:
            raise ValueError(f'Prison adults and juveniles do not add up to the total: {year}')
        if year >= 2010 and v('crime.prison.sentenced', year) + v('crime.prison.pretrial', year) != total:
            raise ValueError(f'Prison convicted and defendants do not add up to the total: {year}')
    for year in SPECS['crime.victims.total'].years:
        for kind, names in victims.items():
            if parts('victims.', names, year) != v('crime.victims.total', year):
                raise ValueError(f'Victims by {kind} do not add up to the total: {year}')

    for row in rows:  # last, so an altered value is reported by the cross-check that notices it first
        indicator, year = row['indicator_id'], row['year']
        cell = reread(row['source_id'], row['source_sheet'], row['source_cell'])
        column = next(column for column, found in header_columns(indicator).items() if found == year)
        if row['source_cell'] != f'{column}{locate(indicator)}' or cell_token(cell) != row['value']:
            raise ValueError(f"Row disagrees with its source cell: {indicator} {year} {row['source_cell']}")


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


def series_breaks(rows):
    """The two counting changes of design section 9. Each quotes its evidence; the footnote must be printed in its workbook and
    the two totals it quotes must be the served ones."""
    for source_id, text in FOOTNOTE_QUOTES.values():
        check_footnote(source_id, text)
    total = {row['year']: int(row['value']) for row in rows if row['indicator_id'] == 'crime.recorded.total'}
    if (total[2017], total[2018]) != (37944, 58412):
        raise ValueError('The recorded-crime totals quoted in the 2018 break are not the served 2017 and 2018 values')
    recorded = ['crime.recorded.total'] + [name for name in SPECS if name.startswith('crime.recorded.') and name != 'crime.recorded.total']
    return [
        {'break_id': 'registration_2018', 'applies_to': ';'.join(recorded), 'reference_date': '2018-01-01',
         'reason': 'Recorded crimes rose from 37,944 in 2017 to 58,412 in 2018, in almost every group of crimes. Counts from 2018 are not '
                   'comparable with those for 2015-2017, and no change is calculated across 2018. Fiscal.ge does not say how much of the rise '
                   'is a real increase in crime.',
         'source_note': 'Geostat Number-of-Recorded-Crimes.xlsx (2017 and 2018 totals). No official statement explaining the change was '
                        'found when this package was built (see README)'},
        {'break_id': 'drunk_driving_coverage_2025', 'applies_to': 'crime.road.accidents_drunk', 'reference_date': '2025-01-01',
         'reason': f'Geostat footnote: "{FOOTNOTE_QUOTES["drunk_driving"][1]}"',
         'source_note': 'Geostat footnote * on Accidents.xlsx (row "of which were caused by alcohol intoxication*", cell A7)'},
    ]


def _ranges(found):
    out, start = [], None
    for index, year in enumerate(found):
        if start is None:
            start = year
        if index + 1 == len(found) or found[index + 1] != year + 1:
            out.append(str(start) if start == year else f'{start}-{year}')
            start = None
    return ';'.join(out)


def build(check=False):
    rows = extract()
    validate(rows)
    sources = manifest()
    breaks = series_breaks(rows)
    by_indicator = defaultdict(list)
    counts, families = defaultdict(int), defaultdict(int)
    for row in rows:
        by_indicator[row['indicator_id']].append(row['year'])
        counts[row['source_id']] += 1
        families[row['indicator_id'].split('.')[1]] += 1
    text_numbers = [{key: row[key] for key in ('indicator_id', 'year', 'source_id', 'source_cell', 'value')} |
                    {'printed': clean(reread(row['source_id'], row['source_sheet'], row['source_cell'])['value'])}
                    for row in rows if reread(row['source_id'], row['source_sheet'], row['source_cell'])['kind'] == 's']
    coverage_rows = [{'indicator_id': indicator, 'first_year': min(found), 'last_year': max(found), 'observations': len(found),
                      'unavailable_years': _ranges(unavailable_years(indicator))} for indicator, found in by_indicator.items()]
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_AT,
        'scope': 'Annual research only: Geostat criminal justice statistics (recorded crimes 2015-2025, convictions, prison population, '
                 'victims and road traffic accidents, most from 2001); no derived values and no serving',
        'primary_observation_count': len(rows), 'observations_by_family': dict(sorted(families.items())),
        'observations_by_source': dict(sorted(counts.items())), 'indicators': len(SPECS),
        'text_number_cells': text_numbers, 'placeholder_cells_in_served_values': 0, 'imputed_values': 0, 'calculated_values': 0,
        'reconciliation_failed_count': 0,
        'checks': ['no duplicate, missing or extra observation, and no served year outside a table\'s coverage; no 2026 or part-year value',
                   'a "…", "..." or "-" cell is never served as a value; anything but a whole number, a whole number printed as text with a '
                   'space for thousands, or one of these in a year column fails',
                   'published value equals the stored value (every served cell is a whole count)',
                   'every row equals a fresh read of its source cell, row label and year heading',
                   'the 11 recorded crime groups add up to all recorded crimes, every year 2015-2025 (tolerance 0)',
                   'convicts by crime type, by age, by sex and by sentence each add up to the total, every year 2001-2025 (tolerance 0)',
                   'the three convictions workbooks print the same total every year (the age-sex workbook twice)',
                   'prison: women and men, and adults and juveniles, add up to all inmates every year; convicted and defendants do from 2010',
                   'victims by sex, by age and by citizenship each add up to the total, every printed year',
                   'the footnote quoted in crime-series-breaks.csv is printed in its workbook; the 2017 and 2018 totals it quotes are the served ones',
                   'independent-validation.json re-reads every cell with SheetJS and compares the Georgian copies with the English workbooks'],
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'crime-annual.csv': csv_bytes(rows, FIELDS),
        'crime-series-breaks.csv': csv_bytes(breaks, BREAK_FIELDS),
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
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true')
    report = build(check=parser.parse_args().check)
    print(json.dumps({'status': report['status'], 'primary_observation_count': report['primary_observation_count']}))


if __name__ == '__main__':
    main()
