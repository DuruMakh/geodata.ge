"""Reproduce and check the Geostat Labour Force Survey detail research package from its preserved sources.

Uses only Python's standard library (zipfile and ElementTree); every source is an .xlsx. Never downloads sources or serves product data.
Rows are found by their printed English label inside the block that follows the block's printed title ("Women", "Men", "Urban",
"Rural", the two NEET titles) and columns by their year heading, never by fixed positions. Downloaded workbooks are untrusted data:
run the scripts with `python3 -I` from the package folder.

    python3 -I prepare.py           # rebuild every generated file
    python3 -I prepare.py --check   # fail if a committed generated file differs from a rebuild
"""

import argparse
from collections import defaultdict
import csv
from decimal import Context, Decimal, ROUND_HALF_UP
import functools
import hashlib
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
RETRIEVED_AT = '2026-10-20'
PUBLISHER = 'National Statistics Office of Georgia (Geostat)'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
SITE = 'https://www.geostat.ge'
PAGE_EN, PAGE_KA = f'{SITE}/en/modules/categories/683', f'{SITE}/ka/modules/categories/683'
PAGE_EN_RESOLVED, PAGE_KA_RESOLVED = f'{PAGE_EN}/Employment-Unemployment', f'{PAGE_KA}/dasakmeba-umushevroba'
NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
PLACEHOLDERS = ('…', '...', '-')  # Geostat's marks for "not published" and "none"
NUMBER = re.compile(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?')

JOBS, HOURS_SEX, HOURS_SETTLEMENT, INFORMAL, UNDERUSE, NEET = (
    'geostat_lfs_jobs_industry', 'geostat_lfs_hours_sex', 'geostat_lfs_hours_settlement', 'geostat_lfs_informal', 'geostat_lfs_underuse',
    'geostat_lfs_neet')

# (source ID, English media ID, English file, Georgian media ID, Georgian file, title)
FILES = [
    (JOBS, 78741, '07-Employment-by-branch-NACE_Eng.xlsx', 78723, '07-dasaqmeba-Nace.xlsx', 'Employed persons by economic activity'),
    (HOURS_SEX, 78743, '09-Hours-by-sex.xlsx', 78725, '09-dasaqmeba-saatebi-sqesi.xlsx', 'Average weekly hours of work by economic activity and sex'),
    (HOURS_SETTLEMENT, 78744, '10-Hours-by-urban-rular-areas.xlsx', 78726, '10-dasaqmeba-saatebi-qalaqi-sofeli.xlsx',
     'Average weekly hours of work by economic activity and urban or rural area'),
    (INFORMAL, 78745, '11-Informal-Employment.xlsx', 78727, '11-araformaluri-dasaqmeba.xlsx', 'Share of informal employment in non-agricultural employment'),
    (UNDERUSE, 78746, '12-Labour-underutilization.xlsx', 78728, '12-arasrulad-gamoyenebuli-samushao-dzala.xlsx', 'Indicators of labour underutilization'),
    (NEET, 78748, '14-NEET_Eng.xlsx', 78730, '14-NEET.xlsx', 'Youth not in employment, education or training (NEET)'),
]


def _sources():
    """(source_id, title, source page, retrieved URL, resolved URL, local file, content type): the six English workbooks, their six
    Georgian versions, then the two page captures. The retrieved URL is the link as the source page prints it; Geostat redirects it to
    www.geostat.ge, the resolved URL."""
    out = []
    for source_id, media, name, _, _, title in FILES:
        path = f'/media/{media}/{quote(name, safe="")}'
        out.append((source_id, title, PAGE_EN, f'https://geostat.ge{path}', f'{SITE}{path}', f'official/{name.lower()}', XLSX))
    for source_id, _, _, media, name, title in FILES:
        path = f'/media/{media}/{quote(name, safe="")}'
        out.append((f'{source_id}_ka', f'{title} (Georgian version)', PAGE_KA, f'https://geostat.ge{path}', f'{SITE}{path}',
                    f'official/{name.lower()}', XLSX))
    out += [('geostat_lfs_detail_page', 'Employment and Unemployment (source page capture)', PAGE_EN, PAGE_EN, PAGE_EN_RESOLVED,
             'official/labour-page.html', HTML),
            ('geostat_lfs_detail_page_ka', 'Employment and Unemployment, Georgian (source page capture)', PAGE_KA, PAGE_KA, PAGE_KA_RESOLVED,
             'official/labour-page-ka.html', HTML)]
    return out


SOURCES = _sources()
LOCAL_FILE = {source[0]: source[5] for source in SOURCES}
GEORGIAN_PAIRS = [(LOCAL_FILE[f'{source_id}_ka'], LOCAL_FILE[source_id]) for source_id, *_ in FILES]  # Georgian copy, English original
PAGE_OF = {'en': 'official/labour-page.html', 'ka': 'official/labour-page-ka.html'}

FIELDS = ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id', 'source_sheet', 'source_cell']

# Geostat's rows in print order (NACE Rev. 2 sections; "Industry" is sections B to E). The labels are matched as printed.
SECTORS = [
    ('total', 'Total'), ('sector_a', 'Agriculture, forestry and fishing'), ('sector_b_e', 'Industry'), ('sector_f', 'Construction'),
    ('sector_g', 'Wholesale and retail trade; repair of motor vehicles and motorcycles'), ('sector_h', 'Transportation and storage'),
    ('sector_i', 'Accommodation and food service activities'), ('sector_j', 'Information and communication'),
    ('sector_k', 'Financial and insurance activities'), ('sector_l', 'Real estate activities'),
    ('sector_m', 'Professional, scientific and technical activities'), ('sector_n', 'Administrative and support service activities'),
    ('sector_o', 'Public administration and defence; compulsory social security'), ('sector_p', 'Education'),
    ('sector_q', 'Human health and social work activities'), ('sector_r', 'Arts, entertainment and recreation'),
    ('sector_s', 'Other service activities'),
    ('sector_t', 'Activities of households as employers; Undifferentiated goods and services-producing activities of households for own use'),
    ('sector_u', 'Activities of extra-territorial organisations and bodies'), ('not_identified', 'Not identified'),
]
JOBS_ITEMS = [item for item, _ in SECTORS]
HOURS_ITEMS = [item for item in JOBS_ITEMS if item not in ('sector_l', 'sector_u', 'not_identified')]  # the hours tables have 17 rows
SECTOR_LABEL = dict(SECTORS)

NEET_TITLES = {'age_15_24': 'Percentage of youth age 15-24 years not in employment, education or training (NEETs) (%)',
               'age_15_29': 'Percentage of youth age 15-29 years not in employment, education or training (NEETs) (%)'}

# The block titles each sheet prints in column A, in order. A sheet's first block may have no title (hours "all", jobs "all").
BLOCK_TITLES = {
    (JOBS, 'NACE2'): [], (JOBS, 'NACE2 sex'): ['Women', 'Men'],
    (HOURS_SEX, '1'): ['Women', 'Men'], (HOURS_SETTLEMENT, '1'): ['Urban', 'Rural'],
    (INFORMAL, '1'): [], (UNDERUSE, '1'): [], (NEET, '1'): [NEET_TITLES['age_15_24'], NEET_TITLES['age_15_29']],
}


def years(first, last):
    return list(range(first, last + 1))


class Spec:
    """Where one indicator lives: workbook sheet, the block title above it (None for a sheet's untitled first block), its row label,
    unit and served years."""

    def __init__(self, source_id, sheet, block, label, unit, served):
        self.source_id, self.sheet, self.block, self.label, self.unit, self.years = source_id, sheet, block, label, unit, list(served)


def _specs():
    out = {}
    for group, sheet, block, served in (('all', 'NACE2', None, years(2017, 2025)), ('women', 'NACE2 sex', 'Women', years(2020, 2025)),
                                        ('men', 'NACE2 sex', 'Men', years(2020, 2025))):
        for item in JOBS_ITEMS:
            out[f'labour.jobs.{group}.{item}'] = Spec(JOBS, sheet, block, SECTOR_LABEL[item], 'thousand_persons', served)
    for group, source_id, block in (('all', HOURS_SEX, None), ('women', HOURS_SEX, 'Women'), ('men', HOURS_SEX, 'Men'),
                                    ('urban', HOURS_SETTLEMENT, 'Urban'), ('rural', HOURS_SETTLEMENT, 'Rural')):
        for item in HOURS_ITEMS:
            # Men in households as employers: "..." or blank in every year, so no observation
            served = [] if (group, item) == ('men', 'sector_t') else years(2020, 2025)
            out[f'labour.hours.{group}.{item}'] = Spec(source_id, '1', block, SECTOR_LABEL[item], 'hours', served)
    for item, label in (('total', 'Total'), ('women', 'Women'), ('men', 'Men'), ('urban', 'Urban'), ('rural', 'Rural')):
        out[f'labour.informal.{item}'] = Spec(INFORMAL, '1', None, label, 'percent', years(2020, 2025))
    for item, label in (('unemployment_rate', 'Unemployment rate'),
                        ('time_related', 'Combined rate of time-related underemployment* and unemployment'),
                        ('potential', 'Combined rate of unemployed and potential labour force'),
                        ('composite', 'Composite measure of labour underutilization')):
        out[f'labour.underuse.{item}'] = Spec(UNDERUSE, '1', None, label, 'percent', years(2020, 2025))
    for band, title in NEET_TITLES.items():
        for item, label in (('total', 'Total'), ('women', 'Women'), ('men', 'Men')):
            out[f'labour.neet.{band}.{item}'] = Spec(NEET, '1', title, label, 'percent', years(2020, 2025))
    return out


SPECS = _specs()
# Table 10's first block repeats table 09's all-persons block; it is read only to check that the two agree, and never served
CHECKS = {f'check.hours_settlement_all.{item}': Spec(HOURS_SETTLEMENT, '1', None, SECTOR_LABEL[item], 'hours', years(2020, 2025))
          for item in HOURS_ITEMS}
ORDER = {indicator: number for number, indicator in enumerate(SPECS)}
SUM_TOLERANCE = Decimal('0.000001')
HOURS_TOLERANCE = Decimal('0.000000001')  # tables 09 and 10 print the same hours with floating-point noise of about 1e-13


# ---------------------------------------------------------------- reading

def clean(value):
    """Whitespace (including non-breaking spaces and line breaks) collapsed, zero-width characters dropped."""
    return ' '.join(value.replace('​', '').split()) if isinstance(value, str) else value


def _column_number(column):
    number = 0
    for letter in column:
        number = number * 26 + ord(letter) - 64
    return number


def _read_xlsx(path):
    """{sheet name: {row number: {column letter: cell}}} of every worksheet of a .xlsx. A cell is {value, raw, cell, kind}: a number is
    kind 'n' with `raw`, the exact text of its <v>, and `value`, that text as a Decimal; text is kind 's'. A valueless cell is absent."""
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        targets = {rel.get('Id'): rel.get('Target') for rel in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('x:t', NS) + item.findall('x:r/x:t', NS))  # phonetic runs (rPh) are not text
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        out = {}
        for sheet in workbook.findall('x:sheets/x:sheet', NS):
            target = targets[sheet.get(REL)]
            part = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = defaultdict(dict)
            for element in ET.fromstring(archive.read(part)).iterfind('x:sheetData/x:row/x:c', NS):
                coordinate, kind = element.get('r'), element.get('t', 'n')
                column, row = re.fullmatch(r'([A-Z]+)(\d+)', coordinate).groups()
                token = element.find('x:v', NS)
                if kind == 'inlineStr':
                    value = ''.join(t.text or '' for t in element.iterfind('x:is//x:t', NS))
                elif token is None or token.text is None or token.text == '':
                    continue
                elif kind == 's':
                    value = strings[int(token.text)]
                elif kind == 'str':
                    value = token.text
                elif kind == 'n':
                    if not NUMBER.fullmatch(token.text):
                        raise ValueError(f'Unexpected number text {token.text!r} in {coordinate}')
                    value = Decimal(token.text)
                else:
                    raise ValueError(f'Unsupported cell type {kind}: {coordinate}')
                cell = {'value': value, 'cell': coordinate, 'kind': 'n' if kind == 'n' else 's'}
                if kind == 'n':
                    cell['raw'] = token.text
                rows[int(row)][column] = cell
            out[sheet.get('name')] = {number: dict(sorted(cells.items(), key=lambda item: _column_number(item[0])))
                                      for number, cells in sorted(rows.items())}
        return out


@functools.lru_cache(maxsize=None)
def _workbook_at(local_file):
    return _read_xlsx(ROOT / local_file)


def sheet_rows(source_id, name):
    """{row number: {column letter: cell}} of one sheet of a source workbook."""
    book = _workbook_at(LOCAL_FILE[source_id])
    if name not in book:
        raise ValueError(f'Expected sheet {name} in {source_id}, found {sorted(book)}')
    return book[name]


def reread(source_id, name, address):
    """The cell at `address`, re-read from the preserved original."""
    column, row = re.fullmatch(r'([A-Z]+)(\d+)', address).groups()
    cell = sheet_rows(source_id, name).get(int(row), {}).get(column)
    if cell is None:
        raise ValueError(f'No cell {address} in {source_id} {name}')
    return cell


def numeric_sheets(local_file):
    """The number of sheets in a workbook."""
    return len(_workbook_at(local_file))


def numeric_cells(local_file, index):
    """{address: exact text} of every numeric cell of the sheet at position `index` (the Georgian copies name their sheets in Georgian, so
    they are compared with the English originals by position)."""
    rows = list(_workbook_at(local_file).values())[index]
    return {cell['cell']: cell['raw'] for row in rows.values() for cell in row.values() if cell['kind'] == 'n'}


def _label(cells):
    cell = cells.get('A')
    return clean(cell['value']) if cell and cell['kind'] == 's' else None


def _is_header(cells):
    """A heading row has at least three numbers right of column A and all of them are increasing whole years."""
    numbers = [cell['value'] for column, cell in cells.items() if column != 'A' and cell['kind'] == 'n']
    return len(numbers) >= 3 and all(value == value.to_integral_value() and 1900 <= value <= 2100 for value in numbers) and \
        all(a < b for a, b in zip(numbers, numbers[1:]))


def block_range(rows, source_id, name, title):
    """(first row, last row) of a block: below its title row (row 0 for an untitled first block) and above the next block's title."""
    titles = BLOCK_TITLES[(source_id, name)]
    found = []
    for step in titles:
        matches = [number for number, cells in rows.items() if _label(cells) == step]
        if len(matches) != 1 or (found and matches[0] <= found[-1]):
            raise ValueError(f'Expected block title "{step}" once, in order, in {source_id} {name}: {matches}')
        found.append(matches[0])
    if title is None:
        return 1, (found[0] - 1 if found else max(rows))
    index = titles.index(title)
    return found[index] + 1, (found[index + 1] - 1 if index + 1 < len(found) else max(rows))


@functools.lru_cache(maxsize=None)
def locate(key):
    """The row number holding an indicator (or check) in its sheet: its label, exactly once inside its block."""
    spec = _spec(key)
    rows = sheet_rows(spec.source_id, spec.sheet)
    first, last = block_range(rows, spec.source_id, spec.sheet, spec.block)
    matches = [number for number, cells in rows.items() if first <= number <= last and _label(cells) == spec.label]
    if len(matches) != 1:
        raise ValueError(f'Expected row "{spec.label}" exactly once in block {spec.block!r} of {spec.source_id} {spec.sheet}: {matches}')
    return matches[0]


def _spec(key):
    return SPECS[key] if key in SPECS else CHECKS[key]


@functools.lru_cache(maxsize=None)
def header_columns(key):
    """{column letter: year} of the heading above an indicator's row, inside its block: every year the table prints for it. Any
    heading that is not a whole-number year is an error."""
    spec = _spec(key)
    rows = sheet_rows(spec.source_id, spec.sheet)
    first, _ = block_range(rows, spec.source_id, spec.sheet, spec.block)
    above = [number for number, cells in rows.items() if first <= number < locate(key) and _is_header(cells)]
    if not above:
        raise ValueError(f'No year heading above {key}')
    found = {}
    for column, cell in rows[max(above)].items():
        if column != 'A':
            if cell['kind'] != 'n':
                raise ValueError(f'Unexpected year heading {clean(cell["value"])!r} in {cell["cell"]}')
            found[column] = int(cell['value'])
    return found


def cells_of(key):
    """{year: cell} of the numeric cells in an indicator's row, which must be exactly the served years. Anything else in a year column
    must be blank or a Geostat placeholder, and nothing may sit outside the year columns."""
    spec = _spec(key)
    row = sheet_rows(spec.source_id, spec.sheet)[locate(key)]
    columns = header_columns(key)
    found = {}
    for column, cell in row.items():
        if column == 'A':
            continue
        if column not in columns:
            raise ValueError(f'Unexpected cell outside the year columns for {key}: {cell}')
        if cell['kind'] == 's' and clean(cell['value']) in PLACEHOLDERS:
            continue
        if cell['kind'] != 'n':
            raise ValueError(f'Unexpected cell content for {key} {columns[column]}: {cell}')
        found[columns[column]] = cell
    if sorted(found) != spec.years:
        raise ValueError(f'Coverage mismatch for {key}: found {sorted(found)}')
    return found


def published_value(raw):
    """A value rounded to one decimal, after first rounding to 15 significant digits (the precision Excel keeps), half up."""
    rounded = Context(prec=15, rounding=ROUND_HALF_UP).create_decimal(Decimal(raw))
    return format(rounded.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP), 'f')


def extract():
    """Every served observation, located by label text and year heading and re-read from its original cell."""
    rows = []
    for indicator_id, spec in SPECS.items():
        for year, cell in cells_of(indicator_id).items():
            rows.append({'year': year, 'indicator_id': indicator_id, 'value': cell['raw'], 'published_value': published_value(cell['raw']),
                         'unit': spec.unit, 'basis': 'actual', 'value_status': 'survey_estimate', 'source_id': spec.source_id,
                         'source_sheet': spec.sheet, 'source_cell': cell['cell']})
    return sorted(rows, key=lambda row: (ORDER[row['indicator_id']], row['year']))


# ---------------------------------------------------------------- validation

def sum_differences(by_key):
    """{(group, year): |sum of the 19 rows - the total|} of each jobs group, and {year: |women + men - all|}."""
    parts = {}
    for group in ('all', 'women', 'men'):
        for year in SPECS[f'labour.jobs.{group}.total'].years:
            whole = by_key[(f'labour.jobs.{group}.total', year)]
            parts[(group, year)] = abs(sum(by_key[(f'labour.jobs.{group}.{item}', year)] for item in JOBS_ITEMS[1:]) - whole)
    sexes = {year: abs(by_key[('labour.jobs.women.total', year)] + by_key[('labour.jobs.men.total', year)] - by_key[('labour.jobs.all.total', year)])
             for year in SPECS['labour.jobs.women.total'].years}
    return parts, sexes


def hours_block_difference(item):
    """The largest difference between tables 09 and 10 for one row of the all-persons block; their published values must be equal."""
    sex, settlement = cells_of(f'labour.hours.all.{item}'), cells_of(f'check.hours_settlement_all.{item}')
    if any(published_value(sex[year]['raw']) != published_value(settlement[year]['raw']) for year in sex):
        return Decimal('Infinity')
    return max(abs(sex[year]['value'] - settlement[year]['value']) for year in sex)


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
        if row['unit'] != spec.unit or row['basis'] != 'actual' or row['value_status'] != 'survey_estimate' or \
                row['source_id'] != spec.source_id or row['source_sheet'] != spec.sheet:
            raise ValueError(f'Unexpected unit, basis, status, source or sheet: {key}')
        if not NUMBER.fullmatch(row['value']) or row['value'].startswith('-'):
            raise ValueError(f'Value is not a non-negative number: {key} {row["value"]}')
        if row['published_value'] != published_value(row['value']):
            raise ValueError(f'Stored and published value disagree: {key}')
        by_key[key] = Decimal(row['value'])
    expected = {(indicator, year) for indicator, spec in SPECS.items() for year in spec.years}
    if keys != expected:
        raise ValueError(f'Coverage mismatch: {len(expected - keys)} missing, {len(keys - expected)} extra')

    groups, sexes = sum_differences(by_key)
    for (group, year), difference in groups.items():
        if difference >= SUM_TOLERANCE:
            raise ValueError(f'Jobs by industry do not add up to the total ({group}, {year}): off by {difference}')
    for year, difference in sexes.items():
        if difference >= SUM_TOLERANCE:
            raise ValueError(f'Jobs of women and men do not add up to all ({year}): off by {difference}')
    for item in HOURS_ITEMS:
        if hours_block_difference(item) >= HOURS_TOLERANCE:
            raise ValueError(f'Hours tables 09 and 10 print different all-persons values: {item}')

    for row in rows:  # last, so an altered value is reported by the cross-check that notices it first
        indicator, year = row['indicator_id'], row['year']
        cell = reread(row['source_id'], row['source_sheet'], row['source_cell'])
        column = next(column for column, found in header_columns(indicator).items() if found == year)
        if row['source_cell'] != f'{column}{locate(indicator)}' or cell['kind'] != 'n' or cell['raw'] != row['value']:
            raise ValueError(f"Row disagrees with its source cell: {indicator} {year} {row['source_cell']}")


def georgian_copies():
    """Every Georgian workbook must hold the same numbers, at the same addresses, as its English original."""
    compared, differences = 0, []
    for ka, en in GEORGIAN_PAIRS:
        if numeric_sheets(ka) != numeric_sheets(en):
            raise ValueError(f'{ka} has a different number of sheets than {en}')
        for index in range(numeric_sheets(en)):
            english, georgian = numeric_cells(en, index), numeric_cells(ka, index)
            compared += len(english)
            differences += [f'{ka} sheet {index + 1} {address}' for address in sorted(set(english) | set(georgian))
                            if english.get(address) != georgian.get(address)]
    if differences:
        raise ValueError(f'Georgian copies differ from the English workbooks: {differences[:5]}')
    return {'pairs': len(GEORGIAN_PAIRS), 'numeric_cells_compared': compared, 'differences': 0}


def check_page_links(sources):
    """Each workbook's retrieved URL must be a link printed on the captured source page of its language."""
    for source_id, _, _, url, _, _, _ in sources:
        if source_id.endswith('_page') or source_id.endswith('_page_ka'):
            continue
        capture = PAGE_OF['ka' if source_id.endswith('_ka') else 'en']
        if not re.search('[\'"]' + re.escape(url) + '[\'"]', (ROOT / capture).read_text(encoding='utf-8')):
            raise ValueError(f'{source_id}: {url} is not linked from {capture}')


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
    check_page_links(SOURCES)
    copies = georgian_copies()
    by_indicator, counts, families = defaultdict(list), defaultdict(int), defaultdict(int)
    for row in rows:
        by_indicator[row['indicator_id']].append(row['year'])
        counts[row['source_id']] += 1
        families[row['indicator_id'].split('.')[1]] += 1
    coverage_rows = []
    for indicator in SPECS:
        found = by_indicator.get(indicator, [])
        printed = sorted(set(header_columns(indicator).values()))
        gaps = sorted(set(range(min(found), max(found) + 1)) - set(found)) if found else printed
        coverage_rows.append({'indicator_id': indicator, 'first_year': min(found) if found else '', 'last_year': max(found) if found else '',
                              'observations': len(found), 'unavailable_years': _ranges(gaps)})
    by_key = {(row['indicator_id'], row['year']): Decimal(row['value']) for row in rows}
    groups, sexes = sum_differences(by_key)
    unserved = []  # a placeholder or blank cell in a served-looking row, listed so that nothing is silently dropped
    for indicator, spec in SPECS.items():
        if not spec.years:
            row = sheet_rows(spec.source_id, spec.sheet)[locate(indicator)]
            unserved.append({'indicator_id': indicator, 'source_id': spec.source_id, 'source_sheet': spec.sheet, 'row': locate(indicator),
                             'printed': {column: clean(cell['value']) for column, cell in row.items() if column != 'A'},
                             'blank_columns': [c for c in header_columns(indicator) if c not in row]})
    report = {
        'status': 'passed', 'retrieved_at': RETRIEVED_AT,
        'scope': 'Annual research only: Geostat Labour Force Survey detail tables (jobs by industry 2017-2025 and by sex 2020-2025, usual '
                 'weekly hours by industry, sex and urban or rural area, informal employment, labour underutilization and NEET, 2020-2025); '
                 'no derived values and no serving',
        'primary_observation_count': len(rows), 'observations_by_family': dict(sorted(families.items())),
        'observations_by_source': dict(sorted(counts.items())), 'indicators': len(SPECS),
        'indicators_without_observations': [indicator for indicator in SPECS if indicator not in by_indicator],
        'unserved_rows': unserved, 'placeholder_cells_in_served_values': 0, 'imputed_values': 0, 'calculated_values': 0,
        'reconciliation_failed_count': 0,
        'largest_sum_difference': {'jobs_industries_vs_total': format(max(groups.values()), '.3e'),
                                   'jobs_women_plus_men_vs_all': format(max(sexes.values()), '.3e'), 'tolerance': format(SUM_TOLERANCE, 'f'),
                                   'hours_table_09_vs_10': format(max(hours_block_difference(item) for item in HOURS_ITEMS), '.3e'),
                                   'hours_tolerance': format(HOURS_TOLERANCE, 'f')},
        'georgian_copies': copies,
        'checks': ['no duplicate, missing or extra observation; every served year is 2017-2025 (jobs for all persons) or 2020-2025; no '
                   'quarterly, part-year or 2026 value',
                   'a "…", "..." or "-" cell, or a blank one, is never served as a value; any other text in a year column, and any cell '
                   'outside the year columns, fails',
                   'value is the cell\'s stored text exactly; published value is that text rounded to 15 significant digits and then to one '
                   'decimal, half up',
                   'every row equals a fresh read of its source cell, row label inside its block, and year heading',
                   'the 19 industry rows of each jobs group (all, women, men) add up to the group total within 0.000001, every year',
                   'jobs of women plus men equal jobs of all persons within 0.000001, 2020-2025',
                   'table 10\'s all-persons block equals table 09\'s, cell for cell, to within 0.000000001 (floating-point noise) and with equal published values; it is not served',
                   'the six Georgian workbooks hold the same numbers at the same addresses as their English originals',
                   'every workbook\'s retrieved URL is linked from the captured source page of its language',
                   'independent-validation.json re-reads every cell with SheetJS'],
        'source_checks': [{'source_id': s['source_id'], 'sha256': s['sha256'], 'bytes': s['bytes'], 'passed': True} for s in sources],
    }
    outputs = {
        'source-manifest.csv': csv_bytes(sources, list(sources[0])),
        'source-manifest.json': (json.dumps(sources, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'labour-annual.csv': csv_bytes(rows, FIELDS),
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
