"""Reproduce and check the Social Service Agency (SSA) statistics research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
Rows are found by their printed label (an area name, or "სულ" for the national total) and every column a programme
uses is checked against its printed heading, never taken from a fixed position alone.

    python prepare.py           # rebuild every generated file
    python prepare.py --check   # fail if a committed generated file differs from a rebuild

Development only: --official DIR and --out DIR read and write somewhere other than this folder.
"""

import argparse
from collections import Counter, defaultdict
import csv
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile


sys.dont_write_bytecode = True  # Loading the shared helpers must not write caches into the other package.
ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    'unemployment_prepare', ROOT.parents[1] / 'Unemployment' / 'geostat-labour-force-annual' / 'prepare.py')
_shared = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_shared)
clean, csv_bytes, NS = _shared.clean, _shared.csv_bytes, _shared.NS

PUBLISHER = 'Social Service Agency of Georgia (სსიპ სოციალური მომსახურების სააგენტო)'
SITE = 'https://ssa.moh.gov.ge'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
HTML = 'text/html; charset=UTF-8'
RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
MUNICIPALITIES = ROOT.parents[3] / 'data' / 'imports' / 'municipalities.csv'

# The 2008 workbooks (and a few later headings) are typed in a pre-Unicode Georgian font that puts the 38 letters of the
# Georgian alphabet, in alphabetical order, on the Latin-1 code points À (0xC0) to å (0xE5): "ÓÖË" is "სულ".
LEGACY = {chr(0xC0 + i): letter for i, letter in enumerate('აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵ')}
GEORGIAN = re.compile('[ა-ჿ]')
LEGACY_TEXT = re.compile('[À-å]')

MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი',
             'ოქტომბერი', 'ნოემბერი', 'დეკემბერი']
MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october',
             'november', 'december']
# Sheet names as SSA misspelled them. "Junly" sits between June and August, so it is July.
MONTH_ALIASES = {'jenuary': 1, 'ferbuary': 2, 'fabruary': 2, 'juiy': 7, 'junly': 7, 'setember': 9, 'desember': 12}
EXPLANATIONS = 'განმარტ'  # an "explanations" sheet listing the legal clauses behind each group

HEADER_A = re.compile(r'/|^(რეგიონი|რაიონი|უწყება|პენსიის სახე|დანიშვნის საფუძვლ|ასაკობრივი ჯგუფ|შშმ ჯგუფ|ორგანიზაცია|'
                      r'ქვე ?პუნქტი|პუნქტი|სუბსიდია)')
TOTAL = re.compile(r'^(სულ|ჯამი|სულ ჯამი|საქართველო|სულ საქართველო)\s*:?$')
NUMBER = re.compile(r'^-?\d+(\.\d+)?([eE]-?\d+)?$')


def decode(text):
    """Georgian text from a cell, converting the legacy font encoding when the cell has no Unicode Georgian."""
    if not GEORGIAN.search(text) and LEGACY_TEXT.search(text):
        text = ''.join(LEGACY.get(char, char) for char in text)
    return clean(text)


def month_of(sheet_name):
    """The month a sheet name stands for, ignoring a year in it ("2015-December")."""
    name = re.sub(r'[\d\s_\-.]+', '', sheet_name.strip().lower())
    if name in MONTH_ALIASES:
        return MONTH_ALIASES[name]
    for number, word in enumerate(MONTHS_KA, 1):
        if name.startswith(word):
            return number
    for number, word in enumerate(MONTHS_EN, 1):
        if name.startswith(word) or (len(name) >= 3 and name.startswith(word[:3])):
            return number
    return None


def column_number(column):
    number = 0
    for char in column:
        number = number * 26 + ord(char) - 64
    return number


def column_letter(number):
    letters = ''
    while number:
        number, rest = divmod(number - 1, 26)
        letters = chr(65 + rest) + letters
    return letters


def read_workbook(path):
    """Every worksheet in order: name, hidden state, merged ranges and cells (numbers as their original XML tokens)."""
    with ZipFile(path) as archive:
        names = set(archive.namelist())
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        relations = {rel.get('Id'): rel.get('Target') for rel in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        strings = []
        if 'xl/sharedStrings.xml' in names:
            strings = [''.join(t.text or '' for t in item.iter('{%s}t' % NS['x']))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        sheets = []
        for sheet in workbook.findall('x:sheets/x:sheet', NS):
            target = relations[sheet.get(RID)]
            part = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            xml = ET.fromstring(archive.read(part))
            cells = defaultdict(dict)
            for cell in xml.findall('x:sheetData/x:row/x:c', NS):
                column, row = re.fullmatch(r'([A-Z]+)(\d+)', cell.get('r')).groups()
                token = cell.find('x:v', NS)
                kind = cell.get('t', 'n')
                if kind == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.iter('{%s}t' % NS['x']))
                elif token is None or token.text is None:
                    continue
                elif kind == 's':
                    value = strings[int(token.text)]
                else:
                    value = token.text
                if kind in ('n', None) and NUMBER.match(value.strip()):
                    cells[int(row)][column] = Decimal(value.strip())
                elif kind != 'n' and value.strip():
                    cells[int(row)][column] = decode(value)
            merges = []
            for merge in xml.findall('x:mergeCells/x:mergeCell', NS):
                first, last = merge.get('ref').split(':') if ':' in merge.get('ref') else (merge.get('ref'),) * 2
                (c1, r1), (c2, r2) = (re.fullmatch(r'([A-Z]+)(\d+)', ref).groups() for ref in (first, last))
                merges.append((column_number(c1), int(r1), column_number(c2), int(r2)))
            sheets.append({'name': sheet.get('name'), 'hidden': sheet.get('state') in ('hidden', 'veryHidden'),
                           'cells': cells, 'merges': merges})
    return sheets


def layout(sheet):
    """Title, column headings and data rows of one worksheet. Headings join the header rows top to bottom."""
    cells = sheet['cells']
    rows = sorted(cells)
    first_data = None
    header_rows = []
    title = ''
    for row in rows:
        values = cells[row]
        a = values.get('A')
        others = {column: value for column, value in values.items() if column != 'A'}
        numbers = [value for value in others.values() if isinstance(value, Decimal)]
        if not others:
            if isinstance(a, str) and not header_rows and not title.endswith(a):
                title = (title + ' ' + a).strip() if title else a
            continue
        if isinstance(a, str) and numbers and not HEADER_A.search(a):
            first_data = row
            break
        if a is None and header_rows and len(numbers) == len(others):
            continue  # a data row SSA printed without its area name; it is reported by unlabelled_rows()
        header_rows.append(row)
    if first_data is None:
        return None
    filled = {row: dict(cells[row]) for row in header_rows}
    for c1, r1, c2, r2 in sheet['merges']:
        top = cells.get(r1, {}).get(column_letter(c1))
        if top is None:
            continue
        for row in range(r1, r2 + 1):
            if row in filled:
                for number in range(c1, c2 + 1):
                    filled[row].setdefault(column_letter(number), top)
    data, unlabelled = [], []
    for row in rows:
        if row < first_data and row in header_rows:
            continue
        a = cells[row].get('A')
        values = {column: value for column, value in cells[row].items()
                  if column != 'A' and isinstance(value, Decimal)}
        if isinstance(a, str) and values:
            data.append((row, a, values))
        elif a is None and values and len(values) == len(cells[row]):
            unlabelled.append((row, values))
    columns = sorted({column for _, _, values in data for column in values}, key=column_number)
    labels = {}
    for column in columns:
        parts = []
        for row in header_rows:
            value = filled[row].get(column)
            text = clean(str(value)) if value is not None else ''
            if text and (not parts or parts[-1] != text):
                parts.append(text)
        labels[column] = ' / '.join(parts)
    return {'title': title, 'labels': labels, 'data': data, 'columns': columns, 'unlabelled': unlabelled,
            'header': filled[header_rows[-1]].get('A', '') if header_rows else ''}


def measure_of(label, title=''):
    """Money, percentage or count. Some money tables name their columns by group only; their title says money."""
    if 'პროცენტ' in label or 'წილი' in label:
        return 'percent'
    if 'თანხა' in label or ('თანხა' in title and 'რაოდენობა' not in title and 'მიმღებთა' not in title):
        return 'amount_gel'
    return 'count'


# ---------------------------------------------------------------------------------------------------------------------
# Sources


def load_index(official):
    index = json.loads((official / 'ssa-file-index.json').read_text(encoding='utf-8'))
    for record in index['files']:
        record['table_id'] = f"{record['cat']}-{record['ti']:02d}"
        label = record['label'].strip()
        record['year'] = int(label) if re.fullmatch(r'\d{4}', label) else None
    return index


def load_catalogue():
    with open(ROOT / 'catalogue.csv', encoding='utf-8-sig', newline='') as handle:
        return {f"{row['category_id']}-{int(row['table_no']):02d}": row for row in csv.DictReader(handle)}


def load_area_mapping():
    with open(ROOT / 'area-mapping.csv', encoding='utf-8-sig', newline='') as handle:
        return {row['ssa_label']: row for row in csv.DictReader(handle)}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def manifest(official, index, catalogue):
    pages = {path.stem.replace('ssa-page-', ''): path for path in sorted((official / 'pages').glob('ssa-page-*.html'))}
    records = []
    for key, path in pages.items():
        page_id = index.get('category_page_ids', {}).get(key)
        url = f'{SITE}/statistiklist.php?lang=1&v=0' if key == 'statistiklist' else \
            f'{SITE}/statistik.php?lang=1&id={page_id}&v=0'
        records.append({'source_id': f'page-{key}', 'kind': 'page', 'table_id': '', 'title_en': '', 'year': '',
                        'url': url, 'local_file': f'official/pages/{path.name}', 'content_type': HTML,
                        'bytes': path.stat().st_size, 'sha256': sha256(path), 'browser_sha256': '',
                        'retrieved_on': index['retrieved_on'], 'page_updated': ''})
    for record in index['files']:
        path = official / 'workbooks' / record['name']
        table = catalogue.get(record['table_id'], {})
        records.append({'source_id': record['name'][:-5], 'kind': 'workbook', 'table_id': record['table_id'],
                        'title_en': table.get('title_en', ''), 'year': record['year'] or '',
                        'url': SITE + record['href'], 'local_file': f"official/workbooks/{record['name']}",
                        'content_type': XLSX, 'bytes': path.stat().st_size if path.exists() else '',
                        'sha256': sha256(path) if path.exists() else '', 'browser_sha256': record.get('sha256', ''),
                        'retrieved_on': record.get('retrieved_on', index['retrieved_on']), 'page_updated': record.get('updated', '')})
    return records


# ---------------------------------------------------------------------------------------------------------------------
# Extraction


def extract_files(official, index):
    """Parsed layouts for every year file: {table_id: {year: [(month or None, sheet name, layout)]}}."""
    parsed = defaultdict(dict)
    problems = []
    for record in index['files']:
        if record['year'] is None:
            continue
        path = official / 'workbooks' / record['name']
        sheets = read_workbook(path)
        # Hidden sheets are skipped: some files keep hidden copies of the previous year's months.
        shapes = [(sheet, layout(sheet)) for sheet in sheets
                  if not sheet['hidden'] and EXPLANATIONS not in sheet['name']]
        shapes = [(sheet, shape) for sheet, shape in shapes if shape is not None]
        months = []
        seen = set()
        for sheet, shape in shapes:
            month = month_of(sheet['name'])
            if month is None and len(shapes) > 1:
                problems.append(f"{record['name']}: sheet {sheet['name']!r} is not a month")
                continue
            if month in seen:
                problems.append(f"{record['name']}: month {month} appears twice ({sheet['name']!r})")
                continue
            seen.add(month)
            months.append((month, sheet['name'], shape))
        parsed[record['table_id']][record['year']] = months
    return parsed, problems


def area_tables(parsed, mapping):
    """Tables whose rows are areas: most data rows of their latest file are known area labels."""
    result = set()
    for table_id, years in parsed.items():
        latest = years[max(years)]
        if not latest:
            continue
        labels = [label for _, label, _ in latest[-1][2]['data']]
        known = sum(1 for label in labels if label in mapping and mapping[label]['kind'] != 'not_area')
        if known >= 20:
            result.add(table_id)
    return result


def total_row(shape):
    totals = [entry for entry in shape['data'] if TOTAL.match(entry[1])]
    return totals[-1] if totals else None


def national_annual(parsed, areas):
    """Every table's national rows by year: money columns summed over the months, everything else at its last month."""
    rows = []
    for table_id in sorted(parsed):
        for year in sorted(parsed[table_id]):
            months = parsed[table_id][year]
            series = defaultdict(dict)
            labels, measures = {}, {}
            order = []
            for month, _, shape in months:
                scope = [total_row(shape)] if table_id in areas else qualified(shape['data'])
                for entry in scope:
                    if entry is None:
                        continue
                    _, row_label, values = entry
                    for column, value in values.items():
                        key = (row_label, column)
                        if key not in series:
                            order.append(key)
                        series[key][month] = value
                        labels[key] = shape['labels'].get(column, '')
                        measures[key] = measure_of(labels[key], shape['title'])
            for key in order:
                row_label, column = key
                label, measure = labels[key], measures[key]
                values = series[key]
                published = sorted(month for month in values if month is not None)
                if None in values:
                    aggregation, value, last = 'as_published', values[None], ''
                elif measure == 'amount_gel':
                    # Summing SSA's binary-float cells adds noise below a tetri, so yearly money is kept to the tetri.
                    aggregation, last = 'sum_of_months', published[-1]
                    value = sum(values.values()).quantize(Decimal('0.01'), ROUND_HALF_UP)
                else:
                    aggregation, value, last = 'last_month', values[published[-1]], published[-1]
                rows.append({'table_id': table_id, 'year': year, 'row_label': row_label, 'column': column,
                             'column_label': label, 'measure': measure, 'aggregation': aggregation,
                             'months_published': len(published), 'last_month': last, 'value': plain(value)})
    return rows


def qualified(data):
    """Data rows with a repeated label named after the group row above them ("group / sub-row")."""
    counts = Counter(label for _, label, _ in data)
    out, group = [], ''
    for row, label, values in data:
        if counts[label] == 1:
            group = label
            out.append((row, label, values))
        else:
            out.append((row, f'{group} / {label}' if group else label, values))
    return out


def plain(value):
    """A decimal as text without exponent or trailing zeros; SSA's float noise (29201085.969999999) is kept as stored."""
    text = format(value, 'f')
    return text.rstrip('0').rstrip('.') if '.' in text else text


# ---------------------------------------------------------------------------------------------------------------------
# Programmes: one recipient measure and one money measure each, chosen by heading and checked every month.


def pick(pattern, which=-1, contains=None):
    regex = re.compile(pattern)

    def choose(shape, year):
        found = [column for column in shape['columns'] if regex.search(shape['labels'][column])
                 and (contains is None or contains in shape['labels'][column])]
        if not found:
            raise LookupError(f'no column heading matches {pattern!r}')
        return [found[which]]
    return choose


HEADING_NOTES = []  # columns taken although SSA left their heading blank; reported as source findings


def last_column(required=r'სულ', allow_blank=False):
    regex = re.compile(required)

    def choose(shape, year):
        column = shape['columns'][-1]
        label = shape['labels'][column]
        if not label and allow_blank:
            return [column]
        if not regex.search(label):
            raise LookupError(f'last column heading {label!r} is not a total')
        return [column]
    return choose


def all_matching(pattern):
    regex = re.compile(pattern)

    def choose(shape, year):
        found = [column for column in shape['columns'] if regex.search(shape['labels'][column])]
        if not found:
            raise LookupError(f'no column heading matches {pattern!r}')
        return found
    return choose


EMPLOYMENT = 'დასაქმების'  # the public-employment support group added to subsistence allowance tables in 2022


def tsa_families(shape, year):
    return [next(c for c in shape['columns'] if re.search(r'ოჯახი$', shape['labels'][c]) and EMPLOYMENT not in shape['labels'][c])]


def tsa_persons(shape, year):
    return [next(c for c in shape['columns'] if re.search(r'(პირი|მოსახლეობა)$', shape['labels'][c])
                 and EMPLOYMENT not in shape['labels'][c])]


def tsa_emp(word):
    def choose(shape, year):
        found = [c for c in shape['columns'] if EMPLOYMENT in shape['labels'][c] and re.search(word + '$', shape['labels'][c])]
        return found[:1]
    return choose


def tsa_amount_main(shape, year):
    if not any(EMPLOYMENT in label for label in shape['labels'].values()):
        return last_column(r'თანხა|მიმღებ')(shape, year)
    found = [c for c in shape['columns'] if 'თანხა' in shape['labels'][c] and EMPLOYMENT not in shape['labels'][c]
             and shape['labels'][c].endswith('სულ')]
    if not found:
        raise LookupError('no subsistence-allowance money total outside the employment group')
    return found[-1:]


def tsa_amount_emp(shape, year):
    found = [c for c in shape['columns'] if 'თანხა' in shape['labels'][c] and EMPLOYMENT in shape['labels'][c]
             and shape['labels'][c].endswith('სულ')]
    return found[-1:]


# programme id: (recipients table, recipients column chooser, money table, money column chooser, extras, is_flow)
PROGRAMMES = {
    'pension': ('pension-01', pick(r'^რაოდენობა$'), 'pension-01', pick(r'^გადარიცხული თანხა$'),
                {'required_gel': ('pension-01', pick(r'^საჭირო თანხა$'))}, False),
    'pension_idp': ('pension-02', pick(r'^რაოდენობა$'), 'pension-02', pick(r'^გადარიცხული თანხა$'),
                    {'required_gel': ('pension-02', pick(r'^საჭირო თანხა$'))}, False),
    'pension_highmountain': ('pension-04', pick(r'(^| / )სულ$'), 'pension-04', pick(r'^თანხა$'), {}, False),
    'social_package': ('socpackage-01', last_column(), 'socpackage-02', last_column(), {}, False),
    'social_package_highmountain': ('socpackage-10', pick(r'(^| / )სულ$'), 'socpackage-10', pick(r'^თანხა$'), {}, False),
    'subsistence_allowance': ('tsa_allowance-01', tsa_families, 'tsa_allowance-02', tsa_amount_main,
                              {'persons': ('tsa_allowance-01', tsa_persons),
                               'emp_families': ('tsa_allowance-01', tsa_emp('ოჯახი')),
                               'emp_persons': ('tsa_allowance-01', tsa_emp('(პირი|მოსახლეობა)')),
                               'amount_emp_gel': ('tsa_allowance-02', tsa_amount_emp)}, False),
    'utility_subsidy': ('utilitysubsidy-01', last_column(), 'utilitysubsidy-02', last_column(), {}, False),
    'idp_refugee_allowance': ('idp_refugee-01', last_column(), 'idp_refugee-02', last_column(), {}, False),
    # Some 2023 compensation sheets lost their agency heading row; the last column is still the grand total.
    'compensation_stipend': ('compensation-01', last_column(allow_blank=True), 'compensation-04',
                             last_column(allow_blank=True), {}, False),
    'workplace_injury': ('workinjury-01', last_column(), 'workinjury-03', last_column(), {}, False),
    'child_benefit_3rd_plus': ('demography-02', pick(r'სულ რაოდენობა$'), 'demography-02', pick(r'გადარიცხული თანხა$'), {}, False),
    'child_benefit_highmountain': ('demography-04', pick(r'სულ რაოდენობა$'), 'demography-04', pick(r'გადარიცხული თანხა$'), {}, False),
    'maternity': ('maternity-01', pick(r'სულ რაოდენობა$'), 'maternity-01', pick(r'გადარიცხული თანხა$'), {}, True),
    'highmountain_doctors_nurses': ('highmountain-01', pick(r'(^| / )სულ$'), 'highmountain-01', pick(r'^გადარიცხული თანხა'), {}, False),
    'highmountain_electricity': ('highmountain-03', pick(r'მიმღებ\s+ბენეფიციართა რაოდენობა'), 'highmountain-03',
                                 pick(r'გადარიცხული თანხა'), {}, False),
    'electricity_tariff_subsidy': ('other-01', pick(r'მიმღებ\s+ბენეფიციართა რაოდენობა'), 'other-01', pick(r'გადარიცხული თანხა'), {}, False),
    'electricity_large_families': ('other-02', pick(r'მიმღებ.*რაოდენობა', which=-1), 'other-02', pick(r'თანხა'), {}, False),
    'water_subsidy': ('other-03', pick(r'მოსარგებლე.*რაოდენობა|მიმღებ.*რაოდენობა', which=-1), 'other-03', pick(r'თანხა'), {}, False),
    'covid_vulnerable_compensation': ('other-04', all_matching(r'მოსახლეობა$'), 'other-04', all_matching(r'გადარიცხული თანხა$'), {}, False),
    'pre2012_pensions_all_types': ('pre2012-01', last_column(), 'pre2012-02', last_column(), {}, False),
    'pre2012_family_assistance': ('pre2012-14', pick(r'(^| / )სულ$'), 'pre2012-15', last_column(), {}, False),
    'pre2012_state_assistance': ('pre2012-17', pick(r'(^| / )სულ$'), 'pre2012-18', last_column(), {}, False),
}
# 2010–2013 maternity tables are single sheets with one column per month.
MATERNITY_BY_MONTH = ('maternity-02', 'maternity-03')


SOURCES = {}  # (field series id, year, month) -> 'table!columns', recorded for traceability


def monthly_values(parsed, table_id, chooser, rows_of, failures, where=None):
    """{(year, month, row label): Decimal} for the chosen columns (summed when several are chosen).

    With a `where` dict, also records {(year, month, row label): (sheet name, [cell addresses])} for each value."""
    values = {}
    sources = {}
    for year, months in parsed.get(table_id, {}).items():
        for month, sheet_name, shape in months:
            try:
                columns = chooser(shape, year)
            except (LookupError, StopIteration) as error:
                failures.append(f'{table_id} {year} {sheet_name!r}: {error}')
                continue
            if not columns:
                continue
            for column in columns:
                if not shape['labels'].get(column):
                    note = (table_id, year, month, column)
                    if note not in HEADING_NOTES:
                        HEADING_NOTES.append(note)
            sources[(year, month)] = f"{table_id}!{'+'.join(columns)}"
            for row, label, cells in rows_of(shape):
                if any(column in cells for column in columns):
                    values[(year, month, label)] = sum(cells.get(column, Decimal(0)) for column in columns)
                    if where is not None:
                        where[(year, month, label)] = (sheet_name, [f'{column}{row}' for column in columns
                                                                    if column in cells])
    SOURCES[id(values)] = sources
    return values


def maternity_by_month(parsed, failures):
    counts, money = {}, {}
    for table_id, target in zip(MATERNITY_BY_MONTH, (counts, money)):
        for year, months in parsed.get(table_id, {}).items():
            for _, sheet_name, shape in months:
                columns = shape['columns']
                if len(columns) != 12:
                    failures.append(f'{table_id} {year}: expected 12 month columns, found {len(columns)}')
                    continue
                for _, label, cells in shape['data']:
                    for month, column in enumerate(columns, 1):
                        if column in cells:
                            target[(year, month, label)] = cells[column]
    return counts, money


def programme_monthly(parsed, scope, failures):
    """Monthly programme values for the national total (scope 'national') or every area row (scope 'areas')."""
    def rows_of(shape):
        if scope == 'national':
            entry = total_row(shape)
            return [entry] if entry else []
        return shape['data']

    out = {}
    for programme, (count_table, count_pick, money_table, money_pick, extras, _) in PROGRAMMES.items():
        series = {'recipients': monthly_values(parsed, count_table, count_pick, rows_of, failures),
                  'amount_gel': monthly_values(parsed, money_table, money_pick, rows_of, failures)}
        for field, (table_id, chooser) in extras.items():
            series[field] = monthly_values(parsed, table_id, chooser, rows_of, failures)
        series['_sources'] = {field: SOURCES.get(id(values), {}) for field, values in series.items()}
        if programme == 'maternity':
            counts, money = maternity_by_month(parsed, failures)
            for field, table_id in (('recipients', MATERNITY_BY_MONTH[0]), ('amount_gel', MATERNITY_BY_MONTH[1])):
                series['_sources'][field].update({(y, m): f'{table_id}!month-column-{m}' for (y, m, _) in
                                                  (counts if field == 'recipients' else money)})
            if scope == 'national':
                counts = {key: value for key, value in counts.items() if TOTAL.match(key[2])}
                money = {key: value for key, value in money.items() if TOTAL.match(key[2])}
            series['recipients'].update(counts)
            series['amount_gel'].update(money)
        out[programme] = series
    return out


MONTHLY_FIELDS = ['recipients', 'amount_gel', 'required_gel', 'persons', 'emp_families', 'emp_persons', 'amount_emp_gel']


def programme_monthly_rows(series):
    rows = []
    for programme, fields in series.items():
        sources = fields.get('_sources', {})
        data = {field: values for field, values in fields.items() if field != '_sources'}
        keys = sorted({key for values in data.values() for key in values}, key=lambda k: (k[0], k[1] or 0))
        for key in keys:
            row = {'programme': programme, 'year': key[0], 'month': key[1]}
            for field in MONTHLY_FIELDS:
                value = data.get(field, {}).get(key)
                row[field] = plain(value) if value is not None else ''
            row['recipients_source'] = sources.get('recipients', {}).get(key[:2], '')
            row['amount_source'] = sources.get('amount_gel', {}).get(key[:2], '')
            rows.append(row)
    return rows


def annual(fields, is_flow):
    """{(year, key): annual figures} from one programme's monthly series keyed (year, month, key)."""
    groups = defaultdict(lambda: defaultdict(dict))
    for field, values in fields.items():
        if field.startswith('_'):
            continue
        for (year, month, key), value in values.items():
            groups[(year, key)][field][month] = value
    result = {}
    for (year, label), data in groups.items():
        recipients, money = data.get('recipients', {}), data.get('amount_gel', {})
        emp = data.get('amount_emp_gel', {})
        last = max(recipients, key=lambda m: m or 0) if recipients else None
        # The average uses the regular recipients' money only; the employment-programme money is added to the total.
        both = [m for m in money if m in recipients]
        count_sum = sum(recipients[m] for m in both)
        average = sum(money[m] for m in both) / count_sum if both and count_sum else None
        row = {
            'amount_months': len(money),
            'amount_gel': whole(sum(money.values()) + sum(emp.values())) if money else '',
            'count_months': len(recipients),
            'recipients': plain(sum(recipients.values())) if is_flow and recipients else
            (plain(recipients[last]) if recipients else ''),
            'recipients_month': 'sum' if is_flow else (last or ''),
            'avg_monthly_gel': plain(average.quantize(Decimal('0.01'), ROUND_HALF_UP)) if average is not None else '',
        }
        for extra in ('persons', 'emp_families'):
            if data.get(extra) and last in data[extra]:
                row[extra] = plain(data[extra][last])
        if emp:
            row['amount_emp_gel'] = whole(sum(emp.values()))
        if 'required_gel' in data:
            row['required_gel'] = whole(sum(data['required_gel'].values()))
        result[(year, label)] = row
    return result


def whole(value):
    return plain(value.quantize(Decimal('0.01'), ROUND_HALF_UP).quantize(Decimal('1'), ROUND_HALF_UP))


# ---------------------------------------------------------------------------------------------------------------------
# Areas: SSA prints old district (რაიონი) names, merged-away cities, regions and five combined Tbilisi districts.
# area-mapping.csv (reviewed by hand) says what each printed label is. Municipal figures add up the labels that now
# form one municipality; Tbilisi is taken from SSA's own Tbilisi total row and regions from SSA's region rows.

LEAF = ('municipality', 'city_merged', 'tbilisi_district', 'excluded_area')
LEVELS = ['national', 'region', 'municipality', 'excluded_area']
ANNUAL_FIELDS = ['amount_months', 'amount_gel', 'count_months', 'recipients', 'recipients_month', 'avg_monthly_gel',
                 'persons', 'emp_families', 'amount_emp_gel', 'required_gel']


def by_area(fields, mapping, unknown):
    """Re-key a programme's area series from printed labels to (level, area id)."""
    keyed = {}
    for field, values in fields.items():
        if field.startswith('_'):
            continue
        out = defaultdict(Decimal)
        for (year, month, label), value in values.items():
            row = mapping.get(label)
            if row is None:
                unknown.add(label)
                continue
            kind = row['kind']
            if kind == 'national':
                out[(year, month, ('national', 'georgia'))] += value
            elif kind == 'region':
                out[(year, month, ('region', row['region_id']))] += value
            elif kind == 'tbilisi_total':
                out[(year, month, ('region', 'region.tbilisi'))] += value
                out[(year, month, ('municipality', '04'))] += value
            elif kind in ('municipality', 'city_merged'):
                out[(year, month, ('municipality', row['municipality_code']))] += value
            elif kind == 'excluded_area':
                out[(year, month, ('excluded_area', label))] += value
        keyed[field] = dict(out)
    return keyed


def area_rows(series_areas, mapping, failures):
    with open(MUNICIPALITIES, encoding='utf-8-sig', newline='') as handle:
        regions = {row['municipality_code']: row['region_id'] for row in csv.DictReader(handle)}
    rows = []
    for programme, fields in series_areas.items():
        unknown = set()
        keyed = by_area(fields, mapping, unknown)
        failures.extend(f'{programme}: row label {label!r} is not in area-mapping.csv' for label in sorted(unknown))
        figures_by_key = annual(keyed, PROGRAMMES[programme][5] if programme in PROGRAMMES else False)
        for (year, (level, area_id)) in sorted(figures_by_key, key=lambda k: (k[0], LEVELS.index(k[1][0]), k[1][1])):
            figures = figures_by_key[(year, (level, area_id))]
            region = area_id if level == 'region' else regions.get(area_id, '') if level == 'municipality' else ''
            rows.append({'programme': programme, 'year': year, 'area_level': level, 'area_id': area_id,
                         'region_id': region, **figures})
    return rows


# ---------------------------------------------------------------------------------------------------------------------
# Served file: the 2013–2025 yearly values the explorer serves, each with the workbook, sheet and cells it is read from.
# People and families are the December count; money is the sum of the monthly sheets. Places use the site's own ids:
# country.georgia, region ids, two-digit municipality codes and unit.* for areas outside every municipality. Tbilisi is
# region.tbilisi only, never municipality 04, so it is not served twice.

SERVED_YEARS = range(2013, 2026)
UNITS = {'ახალგორის მუნიციპალიტეტი': 'unit.akhalgori', 'ახალგორის რაიონი': 'unit.akhalgori',
         'ზემო აფხაზეთი': 'unit.upper_abkhazia'}
# Families and persons registered in the targeted social assistance database, whether or not they are paid.
TSA_REGISTERED = {'recipients': ('tsa_db-01', pick(r'^რეგისტრირებულთა რაოდენობა / ოჯახი$')),
                  'persons': ('tsa_db-01', pick(r'^რეგისტრირებულთა რაოდენობა / მოსახლეობა$'))}
AREA_SERVED = ('pension', 'pension_idp', 'pension_highmountain', 'subsistence_allowance', 'tsa_registered')
# The other programmes on the Social payments page: national money only.
MONEY_ONLY = ('social_package_highmountain', 'idp_refugee_allowance', 'compensation_stipend', 'maternity',
              'child_benefit_3rd_plus', 'child_benefit_highmountain', 'utility_subsidy', 'electricity_tariff_subsidy',
              'highmountain_electricity', 'electricity_large_families', 'water_subsidy', 'highmountain_doctors_nurses',
              'workplace_injury', 'covid_vulnerable_compensation')

# Social package eligibility groups (socpackage-01 people, socpackage-02 money) by printed heading. Up to 2024 each group
# is one column, and the four disability-severity columns (2017–) are parts of "people with disabilities". From 2025 each
# group has breakdown columns and a "/ სულ" total: only the "/ სულ" columns are read, and people with disabilities are
# the four severity totals added together. Any other heading stops preparation.
SOCIAL_PACKAGE_GROUPS = {
    'სულ': 'total', 'სოციალური პაკეტი სულ': 'total',
    'შეზღუდული შესაძლებლობის მქონე პირები': 'disability',
    '0-18 წლამდე შშმ პირი': 'disability_children',
    'მკვეთრად გამოხატული ხარისხის მქონე შშმ პირი': 'disability_severe', 'მკვეთრად გამოხატული შშმ პირი': 'disability_severe',
    'მნიშვნელოვნად გამოხატული ხარისხის მქონე შშმ პირი': 'disability_significant',
    'მნიშვნელოვნად გამოხატული შშმ პირი': 'disability_significant',
    'ზომიერად გამოხატული ხარისხის მქონე შშმ პირი': 'disability_moderate',
    'ზომიერად გამოხატული შშმ პირი': 'disability_moderate',
    'მარჩენალ დაკარგული ოჯახის წევრი': 'survivors',
    'პოლიტ. რეპრესირებულები': 'political_repression',
    'ომის მონაწილეები': 'war_participants', 'ომის მონაწილე': 'war_participants',
    # Other groups: to 2024 compensation and utility-subsidy recipients and "other"; from 2025 defence veterans and
    # "social package by acquired right".
    'სახელმწიფო კომპესაციის მიმღებები': 'other', 'საყოფაცხოვრებო სუბსიდიის მიმღებები': 'other', 'სხვა': 'other',
    'თავდაცვის ძალების ვეტერანები': 'other', 'სოციალური პაკეტი მოპოვებული უფლებით': 'other',
}
SOCIAL_PACKAGE_BREAKDOWNS = ('სოციალური პაკეტის მიმღები', 'სახელმწიფო კომპენსაციის მიმღები', 'შშმპ ბავშვობიდან')
DISABILITY_PARTS = ('disability_children', 'disability_severe', 'disability_significant', 'disability_moderate')
# Where SSA's printed total differs from its own group columns (the groups less the total). May 2022 money: the total
# (socpackage-02 L85, 27,464,062.75) is 56 GEL less than the group columns F:K. May 2021 people: the total (socpackage-01
# M91, 176,572) is 1 more than the group columns F:L, so the year's month-count sums differ by -1. The check allows
# exactly these differences.
SOCIAL_PACKAGE_GROUP_DIFFERENCES = {(2022, 'amount'): Decimal(56), (2021, 'count_months_sum'): Decimal(-1)}
GROUP_MEMBERS = ('disability', 'survivors', 'war_participants', 'political_repression', 'other')  # partition the total
GROUPS = ('total', 'disability', *DISABILITY_PARTS, 'survivors', 'war_participants', 'political_repression', 'other')


# Reviewed heading corrections, used for the social package groups only: (table, year, month, column) -> (printed, used).
# In January–May 2019 the money table prints "war participants" over column J, but the people table prints
# utility-subsidy recipients for the same column and has no war participants until June 2019. Column J's money is a
# steady 22.45 GEL a month per utility-subsidy recipient, and the money table has no other utility-subsidy column in
# those months. The people table's heading is used, so that money is in "other".
HEADING_OVERRIDES = {('socpackage-02', 2019, month, 'J'): ('ომის მონაწილეები', 'საყოფაცხოვრებო სუბსიდიის მიმღებები')
                     for month in range(1, 6)}


def with_heading_overrides(parsed, failures):
    """A copy of the parsed tables with HEADING_OVERRIDES applied; an override that no longer matches its sheet fails."""
    out = dict(parsed)
    for (table_id, year, month, column), (printed, used) in HEADING_OVERRIDES.items():
        out[table_id] = dict(out[table_id])
        months = list(out[table_id].get(year, []))
        found = [i for i, (number, _, shape) in enumerate(months) if number == month
                 and shape['labels'].get(column) == printed]
        if len(found) != 1:
            failures.append(f'heading override {table_id} {year} month {month} {column}: {printed!r} not found once')
            continue
        number, name, shape = months[found[0]]
        months[found[0]] = (number, name, {**shape, 'labels': {**shape['labels'], column: used}})
        out[table_id][year] = months
    return out


def social_package_columns(shape):
    """{group: [columns]} of one social package sheet."""
    groups = defaultdict(list)
    for column in shape['columns']:
        label = shape['labels'][column]
        name, _, part = label.rpartition(' / ') if ' / ' in label else (label, '', 'სულ')
        if name not in SOCIAL_PACKAGE_GROUPS or (part != 'სულ' and part not in SOCIAL_PACKAGE_BREAKDOWNS):
            raise LookupError(f'social package heading {label!r} is not mapped to a group')
        if part == 'სულ':
            groups[SOCIAL_PACKAGE_GROUPS[name]].append(column)
    if 'disability' not in groups:
        groups['disability'] = [column for part in DISABILITY_PARTS for column in groups.get(part, [])]
    return groups


def group_columns(group):
    return lambda shape, year: social_package_columns(shape).get(group, [])


def served_geography(label, mapping, failures):
    """The site id of an area row, or None for rows served otherwise (national, Tbilisi districts, not areas)."""
    row = mapping.get(label)
    kind = row['kind'] if row else None
    if kind == 'region':
        return row['region_id']
    if kind == 'tbilisi_total':
        return 'region.tbilisi'
    if kind in ('municipality', 'city_merged'):
        return row['municipality_code']
    if kind == 'excluded_area':
        if label not in UNITS:
            failures.append(f'excluded area {label!r} has no served unit id')
        return UNITS.get(label)
    return None  # an unknown label is reported by area_rows


def served_readings(parsed, table_id, chooser, scope, mapping, failures):
    """{(year, site id): {month: (value, sheet name, [cells])}} for 2013–2025; areas mapping to one id are added."""
    def rows_of(shape):
        if scope == 'national':
            entry = total_row(shape)
            return [entry] if entry else []
        return shape['data']

    where = {}
    values = monthly_values(parsed, table_id, lambda shape, year: chooser(shape, year) if year in SERVED_YEARS else [],
                            rows_of, failures, where)
    out = defaultdict(dict)
    for (year, month, label), value in values.items():
        geography = 'country.georgia' if scope == 'national' else served_geography(label, mapping, failures)
        if geography is None:
            continue
        sheet, cells = where[(year, month, label)]
        if month in out[(year, geography)]:
            before, _, earlier = out[(year, geography)][month]
            value, cells = before + value, earlier + cells
        out[(year, geography)][month] = (value, sheet, cells)
    return out


def month_column_readings(parsed, table_id):
    """National readings of a single-sheet table with one column per month (maternity money to 2013)."""
    out = defaultdict(dict)
    for year, months in parsed.get(table_id, {}).items():
        for _, sheet_name, shape in months:
            entry = total_row(shape)
            if year not in SERVED_YEARS or entry is None or len(shape['columns']) != 12:
                continue  # maternity_by_month reports a layout without 12 month columns
            row, _, cells = entry
            for month, column in enumerate(shape['columns'], 1):
                if column in cells:
                    out[(year, 'country.georgia')][month] = (cells[column], sheet_name, [f'{column}{row}'])
    return out


def combined(first, second):
    """Two readings of the same sheets added month by month (subsistence money: regular plus employment programme)."""
    out = defaultdict(dict)
    for key in set(first) | set(second):
        for month in set(first.get(key, {})) | set(second.get(key, {})):
            parts = [readings[key][month] for readings in (first, second) if month in readings.get(key, {})]
            out[key][month] = (sum(part[0] for part in parts), parts[0][1], [cell for part in parts for cell in part[2]])
    return out


def served_source(parsed, table_id, year, readings):
    """(source_sheet, source_cell) for the [(sheet, cells)] a value adds up. One sheet: its name and cells. Every monthly
    sheet with the same cells: '*' and those cells. Otherwise '*' and 'Sheet!cells' for each sheet, separated by ';'."""
    sheets = [sheet for sheet, _ in readings]
    expressions = ['+'.join(cells) for _, cells in readings]
    if len(set(sheets)) == 1:
        return sheets[0], '+'.join(expressions)
    monthly = [name for _, name, _ in parsed[table_id][year]]
    if sorted(sheets) == sorted(monthly) and len(set(expressions)) == 1:
        return '*', expressions[0]
    return '*', ';'.join(f'{sheet}!{expression}' for sheet, expression in zip(sheets, expressions))


SERVED_COLUMNS = ['programme', 'measure', 'geography_id', 'year', 'value', 'months', 'value_status', 'source_table',
                  'source_workbook', 'source_sheet', 'source_cell']


def served_annual(parsed, index, mapping, failures):
    workbooks = {(record['table_id'], record['year']): record['name'] for record in index['files'] if record['year']}
    rows = []

    def add(programme, measure, table_id, key, value, readings):
        year, geography = key
        sheet, cells = served_source(parsed, table_id, year, readings)
        single = len(readings) == 1 and len(readings[0][1]) == 1  # one printed cell; anything added up is calculated
        rows.append({'programme': programme, 'measure': measure, 'geography_id': geography, 'year': year,
                     'value': value, 'months': len(readings), 'value_status': 'official' if single else 'calculated',
                     'source_table': table_id, 'source_workbook': workbooks[(table_id, year)],
                     'source_sheet': sheet, 'source_cell': cells})

    def december(programme, measure, table_id, readings):
        for key, months in readings.items():
            if 12 not in months:
                failures.append(f'{programme} {measure} {key}: monthly figures without a December sheet')
                continue
            value, sheet, cells = months[12]
            add(programme, measure, table_id, key, plain(value), [(sheet, cells)])

    def summed(programme, measure, table_id, readings, money=True, months_of=None):
        """The year's sum; with months_of, only the months that reading also has (the months an average uses)."""
        for key, months in readings.items():
            if None in months:
                failures.append(f'{programme} {measure} {key}: a sheet is not a month')
                continue
            used = sorted(month for month in months if months_of is None or month in months_of.get(key, {}))
            if used:
                total = sum(months[month][0] for month in used)
                add(programme, measure, table_id, key, whole(total) if money else plain(total),
                    [months[month][1:] for month in used])

    def read(table_id, chooser, scope):
        return served_readings(parsed, table_id, chooser, scope, mapping, failures if scope == 'national' else [])

    for scope in ('national', 'areas'):
        for programme in ('pension', 'pension_idp', 'pension_highmountain'):
            count_table, count_pick, money_table, money_pick = PROGRAMMES[programme][:4]
            counts, money = read(count_table, count_pick, scope), read(money_table, money_pick, scope)
            december(programme, 'recipients', count_table, counts)
            summed(programme, 'amount', money_table, money)
            summed(programme, 'count_months_sum', count_table, counts, money=False, months_of=money)
        families, persons = read('tsa_allowance-01', tsa_families, scope), read('tsa_allowance-01', tsa_persons, scope)
        regular, employment = (read('tsa_allowance-02', chooser, scope) for chooser in (tsa_amount_main, tsa_amount_emp))
        december('subsistence_allowance', 'recipients', 'tsa_allowance-01', families)
        december('subsistence_allowance', 'persons', 'tsa_allowance-01', persons)
        december('subsistence_allowance', 'employment_families', 'tsa_allowance-01',
                 read('tsa_allowance-01', tsa_emp('ოჯახი'), scope))
        summed('subsistence_allowance', 'amount', 'tsa_allowance-02', combined(regular, employment))
        summed('subsistence_allowance', 'employment_amount', 'tsa_allowance-02', employment)
        summed('subsistence_allowance', 'regular_amount', 'tsa_allowance-02', regular)
        summed('subsistence_allowance', 'regular_count_months_sum', 'tsa_allowance-01', families, money=False,
               months_of=regular)
        for measure, (table_id, chooser) in TSA_REGISTERED.items():
            december('tsa_registered', measure, table_id, read(table_id, chooser, scope))

    counts, money = read('socpackage-01', PROGRAMMES['social_package'][1], 'national'), \
        read('socpackage-02', PROGRAMMES['social_package'][3], 'national')
    december('social_package', 'recipients', 'socpackage-01', counts)
    summed('social_package', 'amount', 'socpackage-02', money)
    summed('social_package', 'count_months_sum', 'socpackage-01', counts, money=False, months_of=money)
    corrected = with_heading_overrides(parsed, failures)
    for group in GROUPS:
        people = read('socpackage-01', group_columns(group), 'national')
        group_money = served_readings(corrected, 'socpackage-02', group_columns(group), 'national', mapping, failures)
        december('social_package_group', f'group.{group}.recipients', 'socpackage-01', people)
        summed('social_package_group', f'group.{group}.amount', 'socpackage-02', group_money)
        # The group's average per month divides its money by this sum of its monthly people counts.
        summed('social_package_group', f'group.{group}.count_months_sum', 'socpackage-01', people, money=False,
               months_of=group_money)
    for programme in MONEY_ONLY:
        money_table, money_pick = PROGRAMMES[programme][2:4]
        summed(programme, 'amount', money_table, read(money_table, money_pick, 'national'))
    summed('maternity', 'amount', MATERNITY_BY_MONTH[1], month_column_readings(parsed, MATERNITY_BY_MONTH[1]))

    # Regular money is the total less the employment-programme money, so the three money rows agree exactly.
    totals = {(row['measure'], row['geography_id'], row['year']): row['value'] for row in rows
              if row['programme'] == 'subsistence_allowance'}
    for row in rows:
        if row['programme'] == 'subsistence_allowance' and row['measure'] == 'regular_amount':
            key = (row['geography_id'], row['year'])
            row['value'] = plain(Decimal(totals[('amount', *key)]) - Decimal(totals.get(('employment_amount', *key), 0)))

    order = {}
    for row in rows:
        order.setdefault((row['programme'], row['measure']), len(order))
    place = {'country': 0, 'region': 1, 'unit': 3}
    return sorted(rows, key=lambda row: (order[(row['programme'], row['measure'])],
                                         place.get(row['geography_id'].split('.')[0], 2), row['geography_id'], row['year']))


# ---------------------------------------------------------------------------------------------------------------------
# Validation


def arithmetic_findings(parsed, areas, mapping):
    """Where SSA's printed national total differs from the sum of its own area rows: a source finding, not a failure."""
    findings, checked = [], 0
    for table_id in sorted(areas):
        for year, months in sorted(parsed[table_id].items()):
            for month, sheet_name, shape in months:
                total = total_row(shape)
                if total is None:
                    findings.append({'table_id': table_id, 'year': year, 'month': month or '', 'note': 'no national total row'})
                    continue
                leaves = [values for _, label, values in shape['data'] if mapping.get(label, {}).get('kind') in LEAF]
                # An unnamed row above the national total is an area SSA forgot to name and still counts; below the
                # total it is SSA's own working figures and does not.
                for row, values in shape['unlabelled']:
                    inside = row < total[0]
                    if inside:
                        leaves.append(values)
                    findings.append({'table_id': table_id, 'year': year, 'month': month or '',
                                     'note': f'row {row} has figures but no area name' if inside else
                                     f'row {row} below the national total holds working figures, not data'})
                for column, printed in total[2].items():
                    label = shape['labels'].get(column, '')
                    measure = measure_of(label, shape['title'])
                    if measure == 'percent':
                        continue
                    summed = sum((values.get(column, Decimal(0)) for values in leaves), Decimal(0))
                    checked += 1
                    # Money may differ by rounding; counts only by binary-float noise in the stored cells.
                    tolerance = Decimal('1') if measure == 'amount_gel' else Decimal('0.001')
                    if abs(summed - printed) > tolerance:
                        findings.append({'table_id': table_id, 'year': year, 'month': month or '', 'column': column,
                                         'column_label': label, 'printed_total': plain(printed),
                                         'sum_of_areas': plain(summed), 'difference': plain(printed - summed), 'note': ''})
    return findings, checked


def social_package_findings(parsed):
    """Months where SSA's national people row breaks the social package groups (a source finding, not a failure): a group
    column left blank, or a printed total that differs from the sum of the groups that partition it."""
    findings = []
    for year, months in sorted(parsed.get('socpackage-01', {}).items()):
        if year not in SERVED_YEARS:
            continue
        for month, _, shape in months:
            entry = total_row(shape)
            try:
                groups = social_package_columns(shape)
            except LookupError:
                continue  # reported by the served extraction
            if entry is None:
                continue  # reported by arithmetic_findings
            cells = entry[2]
            for group in GROUPS:
                for column in groups.get(group, []):
                    if column not in cells:
                        findings.append({'table_id': 'socpackage-01', 'year': year, 'month': month or '', 'column': column,
                                         'column_label': shape['labels'][column],
                                         'note': 'the national total row has no value in this group column'})
            total = groups.get('total', [])
            printed = sum((cells.get(column, Decimal(0)) for column in total), Decimal(0))
            members = sum((cells.get(column, Decimal(0)) for name in GROUP_MEMBERS for column in groups.get(name, [])),
                          Decimal(0))
            if printed != members:
                findings.append({'table_id': 'socpackage-01', 'year': year, 'month': month or '', 'column': '+'.join(total),
                                 'column_label': ' + '.join(shape['labels'][column] for column in total),
                                 'printed_total': plain(printed), 'sum_of_areas': plain(members),
                                 'difference': plain(printed - members),
                                 'note': 'the printed total differs from the sum of the groups that partition it '
                                         '(sum_of_areas holds the sum of the groups)'})
    return findings


COMPARED = ['amount_months', 'amount_gel', 'count_months', 'recipients', 'recipients_month', 'avg_monthly_gel',
            'persons', 'emp_families', 'amount_emp_gel', 'required_gel']


def validate(index, manifest_rows, problems, failures, national_programmes, browser_check, reviewed_differences=None):
    """Every fatal failure; an empty list means the package passes."""
    failures = list(failures)
    reviewed_differences = reviewed_differences or {}
    used_reviews = set()
    workbooks = [row for row in manifest_rows if row['kind'] == 'workbook']
    if len(workbooks) != len(index['files']):
        failures.append(f"{len(workbooks)} workbooks in the manifest, {len(index['files'])} in the index")
    for row in workbooks:
        if not row['sha256']:
            failures.append(f"{row['local_file']} is missing")
        elif row['browser_sha256'] and row['browser_sha256'] != row['sha256']:
            failures.append(f"{row['local_file']}: SHA-256 differs from the hash the browser computed at download")
    failures.extend(f'workbook layout: {problem}' for problem in problems)
    if browser_check is not None:
        built = {(row['programme'], str(row['year'])): row for row in national_programmes}
        theirs = {(row['program'], row['year']): row for row in browser_check}
        for key in sorted(set(built) | set(theirs)):
            if key not in built or key not in theirs:
                failures.append(f"{key} is only in the {'browser' if key in theirs else 'rebuilt'} totals")
                continue
            for field in COMPARED:
                a, b = theirs[key].get(field, ''), str(built[key].get(field, ''))
                if a != b and not (a and b and Decimal(a) == Decimal(b)):
                    review_key = (*key, field)
                    if reviewed_differences.get(review_key) == (a, b):
                        used_reviews.add(review_key)
                    else:
                        failures.append(f'{key} {field}: independent browser read {a!r}, rebuilt {b!r}')
    for key in sorted(set(reviewed_differences) - used_reviews):
        failures.append(f'{key}: preliminary-difference review no longer matches the comparison')
    return failures


# Served measures that the reviewed yearly files also hold, by their field there.
SERVED_FIELDS = {'recipients': 'recipients', 'persons': 'persons', 'employment_families': 'emp_families',
                 'amount': 'amount_gel', 'employment_amount': 'amount_emp_gel'}


def validate_served(served, national_programmes, programme_areas):
    """Failures of the served file: places, years and duplicates, agreement with the reviewed yearly figures (the same
    values reached without cell tracking), and social package groups that add up to SSA's printed total."""
    failures = []
    with open(MUNICIPALITIES, encoding='utf-8-sig', newline='') as handle:
        municipalities = list(csv.DictReader(handle))
    places = ({'country.georgia'} | {row['region_id'] for row in municipalities} | set(UNITS.values()) |
              {row['municipality_code'] for row in municipalities if row['municipality_code'] != '04'})
    values, seen = {}, Counter()
    for row in served:
        key = (row['programme'], row['measure'], row['geography_id'], int(row['year']))
        seen[key] += 1
        values[key] = row
        if key[3] not in SERVED_YEARS:
            failures.append(f'served {key}: year outside {SERVED_YEARS.start}–{SERVED_YEARS.stop - 1}')
        if key[2] not in places:
            failures.append(f'served {key}: {key[2]!r} is not a served place')
        if row['value_status'] not in ('official', 'calculated') or int(row['months']) < 1:
            failures.append(f'served {key}: status {row["value_status"]!r}, months {row["months"]!r}')
    failures.extend(f'served {key}: {count} rows' for key, count in seen.items() if count > 1)

    expected = {}
    national = {row['programme'] for row in national_programmes}
    reviewed = [('country.georgia', row) for row in national_programmes]
    reviewed += [('country.georgia' if row['area_level'] == 'national' else row['area_id'], row)
                 for row in programme_areas if row['programme'] in AREA_SERVED and row['area_level'] != 'excluded_area'
                 and row['area_id'] != '04' and (row['area_level'] != 'national' or row['programme'] not in national)]
    for geography, row in reviewed:
        if int(row['year']) not in SERVED_YEARS:
            continue
        for measure, field in SERVED_FIELDS.items():
            if row.get(field) in (None, '') or (field in ('recipients', 'persons', 'emp_families')
                                               and str(row.get('recipients_month', 12)) != '12'):
                continue
            expected[(row['programme'], measure, geography, int(row['year']))] = (row[field], row.get('amount_months')
                                                                                  if measure == 'amount' else None)
    compared = {key[:2] for key in values}
    for key, (value, months) in expected.items():
        if key[:2] not in compared:
            continue
        if key not in values:
            failures.append(f'served {key}: missing; the reviewed yearly figure is {value}')
        elif Decimal(values[key]['value']) != Decimal(value):
            failures.append(f"served {key}: {values[key]['value']}, the reviewed yearly figure is {value}")
        elif months not in (None, '') and str(values[key]['months']) != str(months):
            failures.append(f"served {key}: {values[key]['months']} months, the reviewed yearly figure has {months}")
    reviewed_pairs = {key[:2] for key in expected}
    for key in values:
        if key not in expected and key[:2] in reviewed_pairs and not key[2].startswith('unit.') \
                and (key[2] == 'country.georgia' or key[0] in AREA_SERVED):
            failures.append(f'served {key}: not in the reviewed yearly figures')

    for year in SERVED_YEARS:
        # The group total's month-count sum is the package's own, the divisor of its average.
        group_total = values.get(('social_package_group', 'group.total.count_months_sum', 'country.georgia', year))
        package = values.get(('social_package', 'count_months_sum', 'country.georgia', year))
        if group_total and (not package or (group_total['value'], str(group_total['months'])) !=
                            (package['value'], str(package['months']))):
            failures.append(f'social package {year}: group total month-count sum differs from the package total')
        # Yearly money is rounded to whole GEL member by member, so it may differ from the total by the rounding.
        for measure, tolerance in (('recipients', Decimal(0)), ('amount', Decimal(3)), ('count_months_sum', Decimal(0))):
            rows = {name: values.get(('social_package_group', f'group.{name}.{measure}', 'country.georgia', year))
                    for name in GROUPS}
            if rows['total'] is None:
                continue
            total = Decimal(rows['total']['value'])
            members = sum(Decimal(rows[name]['value']) for name in GROUP_MEMBERS if rows[name])
            recorded = SOCIAL_PACKAGE_GROUP_DIFFERENCES.get((year, measure), Decimal(0))
            if abs(members - total - recorded) > tolerance:
                failures.append(f'social package {year} {measure}: groups add up to {members}, total {total}')
            parts = [rows[name] for name in DISABILITY_PARTS]
            # The severity columns start in October 2017, so 2017 money is compared only once they cover the same months.
            if measure != 'count_months_sum' and None not in parts and rows['disability'] and all(part['months'] == rows['disability']['months']
                                                                for part in parts):
                added = sum(Decimal(part['value']) for part in parts)
                if abs(added - Decimal(rows['disability']['value'])) > tolerance:
                    failures.append(f"social package {year} {measure}: disability parts add up to {added}, "
                                    f"disability {rows['disability']['value']}")
    return failures


# ---------------------------------------------------------------------------------------------------------------------
# Build


def write_csv(rows, fields):
    return csv_bytes([{field: row.get(field, '') for field in fields} for row in rows], fields)


def national_programme_rows(series_national):
    rows = []
    for programme, fields in series_national.items():
        keyed = {field: {(y, m, 'georgia'): v for (y, m, _), v in values.items()}
                 for field, values in fields.items() if not field.startswith('_')}
        for (year, _), figures in sorted(annual(keyed, PROGRAMMES[programme][5]).items()):
            rows.append({'programme': programme, 'year': year, **figures})
    return rows


def build(official, out, check=False):
    index = load_index(official)
    catalogue = load_catalogue()
    mapping = load_area_mapping()
    manifest_rows = manifest(official, index, catalogue)
    parsed, problems = extract_files(official, index)
    areas = area_tables(parsed, mapping)
    failures = []

    national = national_annual(parsed, areas)
    series_national = programme_monthly(parsed, 'national', failures)
    series_areas = programme_monthly(parsed, 'areas', [])  # column failures are already reported nationally
    monthly = programme_monthly_rows(series_national)
    national_programmes = national_programme_rows(series_national)
    registered = {'tsa_registered': {field: monthly_values(parsed, table_id, chooser, lambda shape: shape['data'], [])
                                     for field, (table_id, chooser) in TSA_REGISTERED.items()}}
    programme_areas = area_rows({**series_areas, **registered}, mapping, failures)
    served = served_annual(parsed, index, mapping, failures)
    browser_path = ROOT / 'browser-annual-amounts.csv'
    browser_check = None
    reviewed_differences = {}
    if browser_path.exists() and official == ROOT / 'official':
        with open(browser_path, encoding='utf-8-sig', newline='') as handle:
            browser_check = list(csv.DictReader(handle))
        review_path = ROOT / 'reviewed-browser-differences.csv'
        if review_path.exists():
            with open(review_path, encoding='utf-8-sig', newline='') as handle:
                reviewed_differences = {(r['programme'], r['year'], r['field']):
                                       (r['browser_value'], r['rebuilt_value']) for r in csv.DictReader(handle)}
    findings, checked = arithmetic_findings(parsed, areas, mapping)
    findings += [{'table_id': table_id, 'year': year, 'month': month or '', 'column': column,
                  'note': 'heading is blank; taken as the grand total because it is the last column'}
                 for table_id, year, month, column in HEADING_NOTES]
    findings += social_package_findings(parsed)
    failures = validate(index, manifest_rows, problems, failures, national_programmes, browser_check, reviewed_differences)
    failures += validate_served(served, national_programmes, programme_areas)

    coverage = []
    for table_id, row in sorted(catalogue.items(), key=lambda item: item[0]):
        years = parsed.get(table_id, {})
        files = [record for record in index['files'] if record['table_id'] == table_id]
        coverage.append({'table_id': table_id, 'title_en': row['title_en'], 'area_rows': 'yes' if table_id in areas else 'no',
                         'first_year': min(years) if years else '', 'last_year': max(years) if years else '',
                         'year_files': len(files),
                         'months_by_year': ' '.join(f'{year}:{len(months)}' for year, months in sorted(years.items()))})

    outputs = {
        'source-manifest.csv': write_csv(manifest_rows, list(manifest_rows[0])),
        'source-manifest.json': (json.dumps(manifest_rows, ensure_ascii=False, indent=1) + '\n').encode('utf-8'),
        'coverage.csv': write_csv(coverage, list(coverage[0])),
        'ssa-national-annual.csv': write_csv(national, ['table_id', 'year', 'row_label', 'column', 'column_label', 'measure',
                                                        'aggregation', 'months_published', 'last_month', 'value']),
        'ssa-programmes-monthly.csv': write_csv(monthly, ['programme', 'year', 'month'] + MONTHLY_FIELDS +
                                                ['recipients_source', 'amount_source']),
        'annual-amounts.csv': write_csv([{'program': row['programme'], **row} for row in national_programmes],
                                        ['program', 'year'] + ANNUAL_FIELDS),
        'ssa-programmes-areas-annual.csv': write_csv(programme_areas, ['programme', 'year', 'area_level', 'area_id',
                                                                       'region_id'] + ANNUAL_FIELDS),
        'ssa-served-annual.csv': write_csv(served, SERVED_COLUMNS),
        'source-findings.csv': write_csv(findings, ['table_id', 'year', 'month', 'column', 'column_label', 'printed_total',
                                                    'sum_of_areas', 'difference', 'note']),
    }
    report = {
        'retrieved_on': index['retrieved_on'], 'publisher': PUBLISHER,
        'counts': {'workbooks': len([row for row in manifest_rows if row['kind'] == 'workbook']),
                   'pages': len([row for row in manifest_rows if row['kind'] == 'page']),
                   'tables_parsed': len(parsed), 'tables_with_area_rows': len(areas),
                   'monthly_sheets': sum(len(months) for years in parsed.values() for months in years.values()),
                   'national_annual_rows': len(national), 'programme_monthly_rows': len(monthly),
                   'programme_annual_rows': len(national_programmes), 'programme_area_rows': len(programme_areas),
                   'served_rows': len(served),
                   'area_total_checks': checked, 'area_total_differences': len(findings),
                   'independent_browser_rows_compared': len(browser_check or []),
                   'reviewed_browser_differences': len(reviewed_differences)},
        'failures': failures,
        'passed': not failures,
    }
    outputs['validation-report.json'] = (json.dumps(report, ensure_ascii=False, indent=1) + '\n').encode('utf-8')

    stale = []
    for name, data in outputs.items():
        target = out / name
        if check:
            if not target.exists() or target.read_bytes() != data:
                stale.append(name)
        else:
            target.write_bytes(data)
    return report, stale


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true', help='fail if a generated file differs from a rebuild')
    parser.add_argument('--official', type=Path, default=ROOT / 'official', help=argparse.SUPPRESS)
    parser.add_argument('--out', type=Path, default=ROOT, help=argparse.SUPPRESS)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    report, stale = build(args.official.resolve(), args.out, check=args.check)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(report['counts'], indent=1))
    for failure in report['failures'][:40]:
        print('FAIL', failure)
    if len(report['failures']) > 40:
        print(f"... and {len(report['failures']) - 40} more failures")
    if stale:
        print('Out of date:', ', '.join(stale))
    return 1 if report['failures'] or stale else 0


if __name__ == '__main__':
    sys.exit(main())
