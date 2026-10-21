"""Read the Pension Fund originals in official/ and write the research package's outputs.

Uses Python's standard library and poppler's pdftotext. Never downloads anything and never serves product data.
Each value is found by its printed line label in the statement, and the checks of the funded pension design
(spec section 4) must all pass before anything is written.

    python3 -I extract.py                    # check the originals, then write pension-fund-annual.csv and validation-report.json
    python3 -I extract.py --write-manifest   # rebuild source-manifest.json from the files in official/ (after a re-download)
"""

import csv
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
OFFICIAL = ROOT / 'official'
RETRIEVED_ON = '2026-10-21'
SITE = 'https://site-api.pensions.ge/uploads/docs/reports/'
YEARS = list(range(2019, 2026))

# key, file name as served by pensions.ge, folder on the site, source id, used for
DOCUMENTS = [
    ('ifrs_2020', '2020-IFRS.pdf', 'financial-statements', 'pension_fund_ifrs_2020', 'served'),
    ('ifrs_2022', '2022-IFRS-GE.pdf', 'financial-statements', 'pension_fund_ifrs_2022', 'served'),
    ('ifrs_2023', '2023-IFRS-GE.pdf', 'financial-statements', 'pension_fund_ifrs_2023', 'served'),
    ('ifrs_2024', '2024-IFRS-GE.pdf', 'financial-statements', 'pension_fund_ifrs_2024', 'served'),
    ('ifrs_2025', '2025-IFRS.pdf', 'financial-statements', 'pension_fund_ifrs_2025', 'served'),
    ('report_2025', 'Annual_Rep_2025_geo.pdf', 'activity-reports', 'pension_fund_report_2025', 'served'),
    ('ifrs_2019', '2019-IFRS.pdf', 'financial-statements', 'pension_fund_ifrs_2019', 'check'),
    ('report_2019', '2019-annual-report.pdf', 'activity-reports', 'pension_fund_report_2019', 'check'),
    ('report_2020', '2020-annual-report.pdf', 'activity-reports', 'pension_fund_report_2020', 'check'),
    ('report_2021', '2021-annual-report.pdf', 'activity-reports', 'pension_fund_report_2021', 'check'),
    ('report_2022', '2022-annual-report.pdf', 'activity-reports', 'pension_fund_report_2022', 'check'),
    ('report_2023', '2023-annual-report.pdf', 'activity-reports', 'pension_fund_report_2023', 'check'),
    ('report_2024', '2024-annual-report.pdf', 'activity-reports', 'pension_fund_report_2024', 'check'),
]
FILE = {key: name for key, name, *_ in DOCUMENTS}
SOURCE_ID = {key: source_id for key, _, _, source_id, _ in DOCUMENTS}

MONEY = ['savings', 'net_assets', 'contributions', 'contributions_private', 'contributions_public',
         'contributions_state', 'interest', 'securities_gains', 'dividends', 'payouts']
COUNTS = ['members', 'left', 'paid_persons', 'employers']
MEASURES = MONEY + COUNTS + ['return']
STOCKS = {'savings', 'net_assets', 'members', 'employers'}
UNIT = {**{measure: 'gel' for measure in MONEY}, 'members': 'persons', 'left': 'persons',
        'paid_persons': 'persons', 'employers': 'employers', 'return': 'percent'}
CSV_FIELDS = ['measure', 'year', 'value', 'unit', 'months', 'source_id', 'document', 'page', 'line']

# A year is served from the latest statement that prints it as text (the 2021 statement is a scanned image).
SERVED_FROM = {2019: 'ifrs_2020', 2020: 'ifrs_2020', 2021: 'ifrs_2022', 2022: 'ifrs_2023', 2023: 'ifrs_2024',
               2024: 'ifrs_2025', 2025: 'ifrs_2025'}
# Each statement prints its own year and the year before, newest first. The 2019 statement prints only 2019.
COLUMNS = {'ifrs_2019': [2019], 'ifrs_2020': [2020, 2019], 'ifrs_2022': [2022, 2021], 'ifrs_2023': [2023, 2022],
           'ifrs_2024': [2024, 2023], 'ifrs_2025': [2025, 2024]}
LANGUAGE = {'ifrs_2019': 'ka', 'ifrs_2020': 'ka', 'ifrs_2022': 'ka', 'ifrs_2023': 'ka', 'ifrs_2024': 'ka', 'ifrs_2025': 'en'}
# Years whose own statement is in text, to compare with the served value. 2020 and 2025 are served from their own.
OWN_STATEMENT = {2019: 'ifrs_2019', 2022: 'ifrs_2022', 2023: 'ifrs_2023', 2024: 'ifrs_2024'}

# The statement of changes in net assets: the printed line label of every figure, per language and layout.
# A line is (key, label pattern, key it follows or None, required). The 2019 and 2020 totals have no label.
STATEMENT_ANCHOR = {'ka': 'წმინდა აქტივების ზრდა:', 'en': 'Increase in net assets:'}
KA_EARLY = [
    ('contributions_private', r'კერძო დამქირავებელნი', None, True),
    ('contributions_public', r'საჯარო დამქირავებელნი', None, True),
    ('contributions_state', r'სუბსიდია$', None, True),
    ('contributions', r'^სულ სქემის მონაწილეთა (შენატანი|დანაზოგები)$', None, True),
    ('interest', r'^საპროცენტო შემოსავალი$', None, True),
    ('unallocated', r'^გაუნაწილებელი თანხები$', None, True),
    ('total_increase', r'^$', 'unallocated', True),
    ('payouts', r'^ანაზ.აურება/სქემის დატოვების ანაზღაურება$', None, True),
    ('total_decrease', r'^$', 'payouts', True),
    ('net_change', r'წმინდა ზრდა$', None, True),
    ('opening', r'(1 იანვარს|დასაწყისში)$', None, True),
    ('closing', r'31 დეკემბერს$', None, True),
]
KA_LATE = [
    ('contributions_private', r'კერძო დამსაქმებლები', None, True),
    ('contributions_public', r'საჯარო დამსაქმებლები', None, True),
    ('contributions_state', r'სახელმწიფოს საპენსიო შენატანი$', None, True),
    ('contributions', r'^სულ სქემის მონაწილეთა შენატანი$', None, True),
    ('unallocated', r'^გაუნაწილებელი თანხები$', None, True),
    ('interest', r'^საპროცენტო შემოსავალი$', None, True),
    ('securities_gain', r'ფასიანი ქაღალდების ფლობით მიღებული წმინდა მოგება$', None, False),
    ('securities_loss', r'ფასიანი ქაღალდების ფლობით მიღებული წმინდა ზარალი$', None, False),
    ('dividends', r'^დივიდენდის შემოსავალი$', None, False),
    ('total_increase', r'^წმინდა აქტივების ჯამური ზრდა$', None, True),
    ('payouts', r'^საპენსიო სქემის მონაწილეზე ჯამურად გაცემული პენსია$', None, True),
    ('fx', r'(ეკვივალენტებზე$|^$)', 'payouts', False),  # the label wraps; the figures sit on its first or last line
    ('fee', r'დაფინანსება$', None, False),
    ('total_decrease', r'^წმინდა აქტივების ჯამური შემცირება$', None, True),
    ('net_change', r'წმინდა აქტივების წმინდა ზრდა$', None, True),
    ('opening', r'1 იანვარს$', None, True),
    ('closing', r'31 დეკემბერს$', None, True),
]
EN = [
    ('contributions_private', r'^Private employers and employees$', None, True),
    ('contributions_public', r'^State employers and employees$', None, True),
    ('contributions_state', r'^Subsidy from the State of Georgia$', None, True),
    ('contributions', r'^Total scheme member contributions$', None, True),
    ('unallocated', r'^Receipt of unallocated amounts$', None, True),
    ('interest', r'^Interest income$', None, True),
    ('securities_gain', r'^Net gains on investments in marketable securities$', None, False),
    ('dividends', r'^Dividend income$', None, False),
    ('total_increase', r'^Total increase in net assets$', None, True),
    ('payouts', r'^Total scheme member opt-outs$', None, True),
    ('fx', r'^Net Foreign exchange losses on cash and cash equivalents$', None, False),
    ('fee', r'^Service fee of ', None, False),
    ('total_decrease', r'^Total decrease in net assets$', None, True),
    ('net_change', r'^Net increase in net assets available for benefits$', None, True),
    ('opening', r'as at 1 January$', None, True),
    ('closing', r'as at 31 December$', None, True),
]
STATEMENT_LINES = {'ifrs_2019': KA_EARLY, 'ifrs_2020': KA_EARLY, 'ifrs_2022': KA_LATE, 'ifrs_2023': KA_LATE,
                   'ifrs_2024': KA_LATE, 'ifrs_2025': EN}
# The members' liabilities note: the balance rolls forward from one 31 December to the next.
NOTE_LINES = {'ka': (re.compile(r'^ნაშთი 1 იანვარს$'), re.compile(r'^ნაშთი 31 დეკემბერს$')),
              'en': (re.compile(r'^Balance at 1 January$'), re.compile(r'^Balance at 31 December$'))}

TOKEN = re.compile(r'\(\d[\d,]*\)|\d[\d,]*|-')
WORD = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>')
COUNT = r'(\d{1,3}(?:,\d{3})+|\d{1,3} \d{3}|\d+)'
BIG = r'(\d{1,3}(?:,\d{3})+)'
EXIT_RIGHT = (r'(?:განმავლობაში|პერიოდში) ' + COUNT + r' დასაქმებულმა.{0,120}?ისარგებლა'
              r'(?: დაგროვებითი)? საპენსიო სქემიდან გასვლის უფლებით')
MEMBERS_BLOCK = r'სულ უნიკალური მონაწილე \(2019 წლის 1 .{0,90}?' + BIG
# What each earlier report printed for its own year: (year, measure, pattern, which match, where). The pattern is
# searched in the whole report with line breaks collapsed; a return can instead come from a chart.
EARLIER = [
    (2019, 'members', r'სულ უნიკალური მონაწილე ' + COUNT + r' \(2019', 0, 'year-end statistics block'),
    (2019, 'left', r'სულ უნიკალური გასული ' + COUNT, 0, 'year-end statistics block'),
    (2020, 'members', r'გაწევრიანებულ დასაქმებულთა რაოდენობა შეადგენდა ' + COUNT + r'-ს', 0, 'report text'),
    (2020, 'left', EXIT_RIGHT, 0, 'report text'),
    (2020, 'paid_persons', r'დანიშნული პენსიები ' + COUNT, 0, 'year-end statistics block'),
    (2021, 'members', MEMBERS_BLOCK, 0, 'year-end statistics block'),
    (2021, 'left', EXIT_RIGHT, 0, 'report text'),
    (2021, 'paid_persons', r'დანიშნული პენსიები ' + COUNT, 1, 'year-end statistics block'),
    (2021, 'employers', r'რეგისტრირებული დამსაქმებლების ოდენობაა ' + COUNT, 0, 'report text'),
    (2022, 'members', MEMBERS_BLOCK, 0, 'year-end statistics block'),
    (2022, 'left', EXIT_RIGHT, 0, 'report text'),
    (2022, 'paid_persons', r'დანიშნული პენსიები ' + COUNT, 1, 'year-end statistics block'),
    (2022, 'employers', r'დამსაქმებლების რაოდენობაა ' + COUNT, 0, 'report text'),
    (2023, 'members', MEMBERS_BLOCK, 0, 'year-end statistics block'),
    (2023, 'left', EXIT_RIGHT, 0, 'report text'),
    (2023, 'paid_persons', r'დანიშნული პენსიები ' + COUNT, 1, 'year-end statistics block'),
    (2023, 'employers', r'დამსაქმებლის რაოდენობა 2023 ' + COUNT, 0, 'employers chart'),
    (2024, 'members', MEMBERS_BLOCK, 0, 'year-end statistics block'),
    (2024, 'left', EXIT_RIGHT, 0, 'report text'),
    (2024, 'paid_persons', r'დანიშნული პენსიები ' + COUNT, 1, 'year-end statistics block'),
    (2024, 'employers', r'დამსაქმებლის რაოდენობა 2024 ' + COUNT, 0, 'employers chart'),
    (2024, 'return', r'2024 წლის ნომინალურმა წლიურმა ამონაგებმა (\d+\.\d)%', 0, 'report text'),
]
# Returns printed only on a chart: (report year, PDF page). The 2022 report's chart has no year labels to read.
EARLIER_RETURN_CHARTS = [(2021, 8), (2023, 9)]


class ExtractError(Exception):
    """A figure could not be found or read; nothing is written."""


def parse_number(token):
    """A printed figure as an integer: a dash is no value, brackets are negative, spaces and commas are separators."""
    token = token.strip()
    if token == '-':
        return None
    digits = re.sub(r'[()\s,]', '', token)
    if not digits.isdigit():
        raise ExtractError(f'not a number: {token!r}')
    return -int(digits) if token.startswith('(') and token.endswith(')') else int(digits)


def split_line(line, n):
    """(label, [n figures]) when the line ends with n figures or dashes, otherwise None."""
    tokens = line.split()
    values = []
    while len(values) < n and tokens and TOKEN.fullmatch(tokens[-1]):
        values.append(parse_number(tokens.pop()))
    if len(values) < n:
        return None
    while tokens and re.fullmatch(r'\d+,?', tokens[-1]):  # note references such as "5, 6"
        tokens.pop()
    return re.sub(r'^[-•]\s*', '', ' '.join(tokens)), values[::-1]


@lru_cache(maxsize=None)
def pages_of(name):
    """The layout text of every page of an original."""
    result = subprocess.run(['pdftotext', '-layout', str(OFFICIAL / name), '-'], capture_output=True, check=True)
    return tuple(result.stdout.decode('utf-8').split('\f')[:-1])


@lru_cache(maxsize=None)
def words_of(name, page):
    result = subprocess.run(['pdftotext', '-bbox', '-f', str(page), '-l', str(page), str(OFFICIAL / name), '-'],
                            capture_output=True, check=True)
    return tuple((float(a), float(b), float(c), float(d), text)
                 for a, b, c, d, text in WORD.findall(result.stdout.decode('utf-8')))


def search(name, pattern, nth=0):
    """(match, page) of the nth match of the pattern in the report with line breaks collapsed to single spaces."""
    flat, starts = '', []
    for page in pages_of(name):
        starts.append(len(flat))
        flat += re.sub(r'\s+', ' ', page) + ' '
    matches = list(re.finditer(pattern, flat))
    if len(matches) <= nth:
        raise ExtractError(f'{name}: no match for {pattern!r} (#{nth})')
    match = matches[nth]
    return match, max(i for i, start in enumerate(starts) if start <= match.start()) + 1


def chart_labels(words, pattern, years, window=200):
    """Labels of a bar chart by year: each label whose text fits the pattern belongs to the nearest year label
    under the chart, by horizontal position. Returns {year: [(x, text), ...]} with each year's labels left to right."""
    rows = {}
    for x0, y0, x1, _, text in words:
        if re.fullmatch(r'20\d\d', text) and int(text) in years:
            rows.setdefault(round(y0), []).append(((x0 + x1) / 2, int(text)))
    for row_y, items in sorted(rows.items()):
        centres = {}
        for x, year in sorted(items):
            centres.setdefault(year, x)  # a year repeated further right belongs to another label
        if set(centres) == set(years):
            break
    else:
        raise ExtractError('no row of year labels under the chart')
    xs = sorted(centres.values())
    spacing = (xs[-1] - xs[0]) / (len(xs) - 1)
    found = {year: [] for year in years}
    for x0, y0, x1, _, text in words:
        if re.fullmatch(pattern, text) and row_y - window < y0 < row_y:
            x = (x0 + x1) / 2
            year, centre = min(centres.items(), key=lambda item: abs(item[1] - x))
            if abs(centre - x) <= 0.45 * spacing:
                found[year].append((x, text))
    return {year: [item for item in sorted(items)] for year, items in found.items()}


def find_roll_forward(lines, language, columns, prior):
    """The members' balance that rolls forward in a statement note, from the lines of the whole statement.
    Its opening balance is the earlier year's closing one, and the opening balance of the year before (or a dash for the
    first year) is `prior`. Returns the figures of both lines and everything between them, with the closing line's index."""
    opening_pattern, closing_pattern = NOTE_LINES[language]
    candidates = []
    for i, line in enumerate(lines):
        opening = split_line(line, columns)
        if not opening or not opening_pattern.search(opening[0]):
            continue
        for j in range(i + 1, min(i + 30, len(lines))):
            closing = split_line(lines[j], columns)
            if closing and closing_pattern.search(closing[0]):
                break
        else:
            continue
        rolls = all(opening[1][k] == closing[1][k + 1] for k in range(columns - 1))
        if rolls and opening[1][columns - 1] == prior:
            between = [split_line(line, columns) for line in lines[i + 1:j]]
            candidates.append({'opening': tuple(opening[1]), 'closing': tuple(closing[1]), 'label': closing[0],
                               'index': j, 'between': [item[1] for item in between if item]})
    if not candidates:
        raise ExtractError('no balance that rolls forward from the prior year')
    if any((c['opening'], c['closing']) != (candidates[0]['opening'], candidates[0]['closing']) for c in candidates):
        raise ExtractError('more than one balance rolls forward from the prior year')
    return candidates[0]


def read_statement(key, savings_before):
    """Every figure of one financial statement, per year it prints: {year: {name: (value, label, page)}}.
    Money is in thousand GEL as printed; a dash or an absent optional line is None."""
    name, language = FILE[key], LANGUAGE[key]
    columns = len(COLUMNS[key])
    pages = pages_of(name)
    page = next((i for i, text in enumerate(pages, 1) if STATEMENT_ANCHOR[language] in text), None)
    if page is None:
        raise ExtractError(f'{name}: no statement of changes in net assets')
    lines = pages[page - 1].splitlines()
    start = next(i for i, line in enumerate(lines) if STATEMENT_ANCHOR[language] in line)
    found = {}
    result = {year: {} for year in COLUMNS[key]}
    for line_key, pattern, after, required in STATEMENT_LINES[key]:
        first = found[after] + 1 if after else start
        for i in range(first, len(lines)):
            parsed = split_line(lines[i], columns)
            if parsed and re.search(pattern, parsed[0]):
                found[line_key] = i
                for year, value in zip(COLUMNS[key], parsed[1]):
                    result[year][line_key] = (value, parsed[0], page)
                break
        else:
            if required:
                raise ExtractError(f'{name}: no line {pattern!r}')
            for year in COLUMNS[key]:
                result[year][line_key] = (None, '', page)
    for year in COLUMNS[key]:
        gain, loss = result[year].get('securities_gain'), result[year].get('securities_loss')
        printed = [item for item in (gain, loss) if item and item[0] is not None]
        result[year]['securities'] = printed[0] if len(printed) == 1 else (None, '', page)
        if len(printed) > 1:
            raise ExtractError(f'{name}: securities printed as both gain and loss in {year}')
    # The members' liabilities note, in the lines of the whole statement.
    all_lines = [(number, line) for number, text in enumerate(pages, 1) for line in text.splitlines()]
    prior = savings_before.get(COLUMNS[key][0] - 2) if columns > 1 else None  # None is a dash: the scheme's first year
    found = find_roll_forward([line for _, line in all_lines], language, columns, prior)
    note_page = all_lines[found['index']][0]
    for position, year in enumerate(COLUMNS[key]):
        result[year]['savings'] = (found['closing'][position], found['label'], note_page)
        result[year]['savings_opening'] = (found['opening'][position], '', note_page)
        result[year]['savings_between'] = (sum(values[position] or 0 for values in found['between']), '', note_page)
    return result


def check_statement_column(document, year, figures):
    """The checks one statement column must pass; returns the failures as text. `figures` holds integers or None."""
    value = lambda name: figures.get(name) or 0  # noqa: E731
    failures = []
    parts = value('contributions_private') + value('contributions_public') + value('contributions_state')
    if parts != value('contributions'):
        failures.append(f'{document} {year}: the three contribution parts add up to {parts}, the printed total is {value("contributions")}')
    if 'total_increase' in figures:
        securities = value('securities')
        increases = value('contributions') + value('unallocated') + value('interest') + value('dividends') + max(securities, 0)
        decreases = value('payouts') + value('fx') + value('fee') + min(securities, 0)
        if increases != value('total_increase'):
            failures.append(f'{document} {year}: the increases add up to {increases}, the printed total is {value("total_increase")}')
        if decreases != value('total_decrease'):
            failures.append(f'{document} {year}: the decreases add up to {decreases}, the printed total is {value("total_decrease")}')
        if value('total_increase') + value('total_decrease') != value('net_change'):
            failures.append(f'{document} {year}: increases less decreases are not the printed net change')
        if value('opening') + value('net_change') != value('closing'):
            failures.append(f'{document} {year}: opening net assets plus the net change are not the closing net assets')
        if value('savings_opening') + value('savings_between') != value('savings'):
            failures.append(f'{document} {year}: the members\' balance does not roll forward in the note')
    return failures


def money_value(figures, measure):
    """A money measure from a statement column, in thousand GEL; payouts are printed in brackets and stored positive."""
    column = {'net_assets': 'closing', 'securities_gains': 'securities'}.get(measure, measure)
    value = figures.get(column, (None,))[0]  # a statement without the line prints no such value
    return -value if measure == 'payouts' and value is not None else value


def read_page_rows(name, title_pattern, row_pattern):
    """{year: value} from chart rows such as '2024   1,581,832' on the page whose layout text matches the title."""
    pages = [i for i, text in enumerate(pages_of(name), 1) if re.search(title_pattern, text, re.M)]
    if len(pages) != 1:
        raise ExtractError(f'{name}: expected one page for {title_pattern!r}, found {pages}')
    rows = {}
    for line in pages_of(name)[pages[0] - 1].splitlines():
        match = re.match(row_pattern, line)
        if match:
            rows[int(match.group(1))] = int(match.group(2).replace(',', ''))
    if sorted(rows) != YEARS:
        raise ExtractError(f'{name} page {pages[0]}: chart rows for {sorted(rows)}')
    return rows, pages[0]


def read_counts_and_return():
    """Members, people who left, people paid, employers and the return from the 2025 annual report."""
    name = FILE['report_2025']
    counts = {}
    rows, page = read_page_rows(name, r'^\s*დამსაქმებელთა რაოდენობა\s*$', r'^\s*(20\d\d)\s+([\d,]+)\s*$')
    counts['employers'] = (rows, page, 'დამსაქმებელთა რაოდენობა')
    rows, page = read_page_rows(name, r'მონაწილეთა\*\s+რაოდენობა', r'^\s*(20\d\d)\s+([\d,]+)\s*$')
    counts['members'] = (rows, page, 'რეგისტრირებული მონაწილეთა რაოდენობა')

    left_pages = [i for i, text in enumerate(pages_of(name), 1)
                  if 'საპენსიო სქემიდან გასული დასაქმებულების რაოდენობა' in re.sub(r'\s+', ' ', text)]
    return_pages = [i for i, text in enumerate(pages_of(name), 1) if 'საინვესტიციო ამონაგები და ინფლაცია' in re.sub(r'\s+', ' ', text)]
    if len(left_pages) != 1 or len(return_pages) != 1:
        raise ExtractError(f'{name}: charts not found (left {left_pages}, return {return_pages})')
    left = chart_labels(words_of(name, left_pages[0]), r'\d{1,3}(?:,\d{3})*', YEARS)
    if any(len(items) != 1 for items in left.values()):
        raise ExtractError(f'{name} page {left_pages[0]}: expected one label per year, found {left}')
    counts['left'] = ({year: int(items[0][1].replace(',', '')) for year, items in left.items()}, left_pages[0],
                      'საპენსიო სქემიდან გასული დასაქმებულების რაოდენობა')
    pairs = chart_labels(words_of(name, return_pages[0]), r'\d+\.\d%', YEARS)
    if any(len(items) != 2 for items in pairs.values()):
        raise ExtractError(f'{name} page {return_pages[0]}: expected a return and an inflation label per year, found {pairs}')
    returns = {year: items[0][1].rstrip('%') for year, items in pairs.items()}  # the left bar of each pair
    paid_pages = [i for i, text in enumerate(pages_of(name), 1)
                  if 'დანიშნული პენსიების რაოდენობა წლების მიხედვით' in re.sub(r'\s+', ' ', text)]
    if len(paid_pages) != 1:
        raise ExtractError(f'{name}: payout table not found ({paid_pages})')
    table, total = [], None
    for line in pages_of(name)[paid_pages[0] - 1].splitlines():
        if 'თანხები წლების მიხედვით' in line:
            break  # the second table lists amounts, not people
        parsed = split_line(line, 7)
        if parsed and parsed[0] == 'სულ':
            total = parsed[1]
        elif parsed and parsed[0]:
            table.append(parsed[1])
    if total is None:
        raise ExtractError(f'{name} page {paid_pages[0]}: no total row in the payout table')
    counts['paid_persons'] = (dict(zip(YEARS, total)), paid_pages[0], 'დანიშნული პენსიების რაოდენობა წლების მიხედვით / სულ')
    counts['table'] = [sum(column or 0 for column in column_values) for column_values in zip(*table)]
    return counts, returns, return_pages[0]


@lru_cache(maxsize=None)
def analyse():
    """Everything the package establishes: the rows, the checks' failures and the recorded differences."""
    failures = check_manifest()
    # Statements, oldest served first so each note's prior balance is known.
    statements, savings = {}, {}
    for key in ['ifrs_2019', 'ifrs_2020', 'ifrs_2022', 'ifrs_2023', 'ifrs_2024', 'ifrs_2025']:
        statements[key] = read_statement(key, savings)
        for year in COLUMNS[key]:
            savings.setdefault(year, statements[key][year]['savings'][0])
        for year in COLUMNS[key]:
            figures = {name: item[0] for name, item in statements[key][year].items()}
            failures += check_statement_column(FILE[key], year, figures)

    rows = []
    for measure in MONEY:
        for year in YEARS:
            key = SERVED_FROM[year]
            value = money_value(statements[key][year], measure)
            if value is None:
                continue  # the statement prints a dash or no line: a gap, never a zero
            column = {'net_assets': 'closing', 'securities_gains': 'securities'}.get(measure, measure)
            _, label, page = statements[key][year][column]
            rows.append({'measure': measure, 'year': year, 'value': str(value * 1000), 'unit': 'gel',
                         'months': 1 if measure in STOCKS else 12, 'source_id': SOURCE_ID[key],
                         'document': FILE[key], 'page': page, 'line': label})

    # The closing net assets of a year are the opening net assets of the next, in every statement that prints both.
    closing = {year: money_value(statements[SERVED_FROM[year]][year], 'net_assets') for year in YEARS}
    for key, years in COLUMNS.items():
        for year in years:
            opening = statements[key][year]['opening'][0]
            expected = closing.get(year - 1)
            if opening != expected:
                failures.append(f'{FILE[key]} {year}: opening net assets {opening}, but {year - 1} closed at {expected}')

    counts, returns, return_page = read_counts_and_return()
    report = FILE['report_2025']
    for measure in COUNTS:
        values, page, label = counts[measure]
        for year in YEARS:
            rows.append({'measure': measure, 'year': year, 'value': str(values[year]), 'unit': UNIT[measure],
                         'months': 1 if measure in STOCKS else 12, 'source_id': SOURCE_ID['report_2025'],
                         'document': report, 'page': page, 'line': label})
    for year in YEARS:
        rows.append({'measure': 'return', 'year': year, 'value': returns[year], 'unit': 'percent', 'months': 12,
                     'source_id': SOURCE_ID['report_2025'], 'document': report, 'page': return_page,
                     'line': 'საინვესტიციო ამონაგები და ინფლაცია / ამონაგები'})
    rows.sort(key=lambda row: (MEASURES.index(row['measure']), row['year']))

    if counts['table'] != [counts['paid_persons'][0][year] for year in YEARS]:
        failures.append(f'{report}: the payout table\'s rows add up to {counts["table"]}, its total row differs')
    match, _ = search(report, r'ნომინალურმა წლიურმა ამონაგებმა (\d+\.\d)%')
    if match.group(1) != returns[2025]:
        failures.append(f'{report}: the 2025 return in the text is {match.group(1)}%, the chart gives {returns[2025]}%')

    # Anchor values from the design (spec section 4).
    by_key = {(row['measure'], row['year']): row['value'] for row in rows}
    anchors = {('savings', 2025): '8237530000', ('savings', 2019): '508031000', ('net_assets', 2025): '8365433000',
               ('contributions', 2025): '1431780000', ('contributions_state', 2025): '370989000',
               ('securities_gains', 2022): '-31187000', ('members', 2025): '1705365', ('members', 2019): '958226',
               ('employers', 2025): '145780', ('return', 2025): '11.8'}
    for anchor, expected in anchors.items():
        if by_key.get(anchor) != expected:
            failures.append(f'anchor {anchor}: {by_key.get(anchor)}, expected {expected}')
    if len(rows) != 99:
        failures.append(f'{len(rows)} rows, expected 99')

    # The served value against the year's own statement.
    restatements = []
    for year, key in OWN_STATEMENT.items():
        for measure in MONEY:
            own = money_value(statements[key][year], measure)
            served = money_value(statements[SERVED_FROM[year]][year], measure)
            if own != served:
                restatements.append({'measure': measure, 'year': year, 'document': FILE[key],
                                     'own': None if own is None else str(own * 1000),
                                     'served_document': FILE[SERVED_FROM[year]],
                                     'served': None if served is None else str(served * 1000)})

    # Each earlier report's own-year counts and returns against the 2025 report's.
    revisions = []
    for year, measure, pattern, nth, where in EARLIER:
        name = FILE[f'report_{year}']
        match, page = search(name, pattern, nth)
        earlier = match.group(1).replace(',', '').replace(' ', '')
        served = by_key[(measure, year)]
        if earlier != served:
            revisions.append({'measure': measure, 'year': year, 'document': name, 'page': page, 'earlier': earlier,
                              'served': served, 'where': where})
    for year, page in EARLIER_RETURN_CHARTS:
        name = FILE[f'report_{year}']
        pairs = chart_labels(words_of(name, page), r'\d+\.\d%', list(range(2019, year + 1)))
        if len(pairs[year]) < 2:
            raise ExtractError(f'{name} page {page}: no return and inflation pair for {year}')
        earlier = pairs[year][0][1].rstrip('%')
        if earlier != by_key[('return', year)]:
            revisions.append({'measure': 'return', 'year': year, 'document': name, 'page': page, 'earlier': earlier,
                              'served': by_key[('return', year)], 'where': 'return chart'})
    revisions.sort(key=lambda r: (r['year'], (COUNTS + ['return']).index(r['measure'])))
    return {'rows': rows, 'failures': failures, 'restatements': restatements, 'revisions': revisions}


def extract():
    """The 99 served values as rows in the CSV's columns."""
    return [dict(row) for row in analyse()['rows']]


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def manifest_entries():
    entries = []
    for _, name, folder, source_id, used_for in DOCUMENTS:
        path = OFFICIAL / name
        entries.append({'source_id': source_id, 'document': name, 'url': SITE + folder + '/' + name,
                        'local_file': 'official/' + name, 'bytes': path.stat().st_size, 'sha256': sha256_of(path),
                        'retrieved_on': RETRIEVED_ON, 'used_for': used_for})
    return entries


def check_manifest():
    """Failures when source-manifest.json and the files in official/ disagree."""
    try:
        manifest = json.loads((ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
    except FileNotFoundError:
        return ['source-manifest.json is missing']
    failures = []
    listed = {entry['local_file'] for entry in manifest}
    for entry in manifest:
        path = ROOT / entry['local_file']
        if not path.is_file():
            failures.append(f'{entry["local_file"]} is listed but missing')
        elif path.stat().st_size != entry['bytes'] or sha256_of(path) != entry['sha256']:
            failures.append(f'{entry["local_file"]} differs from the manifest')
    for path in sorted(OFFICIAL.iterdir()):
        if 'official/' + path.name not in listed:
            failures.append(f'official/{path.name} is not in the manifest')
    expected = {(name, source_id, used_for) for _, name, _, source_id, used_for in DOCUMENTS}
    if {(e['document'], e['source_id'], e['used_for']) for e in manifest} != expected:
        failures.append('the manifest lists other documents than the package uses')
    return failures


def write_csv(rows):
    with open(ROOT / 'pension-fund-annual.csv', 'w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def write_json(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def main(argv):
    if argv == ['--write-manifest']:
        write_json('source-manifest.json', manifest_entries())
        print(f'wrote source-manifest.json ({len(DOCUMENTS)} documents)')
        return 0
    if argv:
        print(__doc__)
        return 2
    analysis = analyse()
    if analysis['failures']:
        for failure in analysis['failures']:
            print('FAIL', failure, file=sys.stderr)
        return 1
    write_csv(analysis['rows'])
    write_json('validation-report.json', {'passed': True, 'failures': [], 'rows': len(analysis['rows']),
                                          'restatements': analysis['restatements'], 'revisions': analysis['revisions'],
                                          'csv_sha256': sha256_of(ROOT / 'pension-fund-annual.csv')})
    print(f'{len(analysis["rows"])} rows, {len(analysis["restatements"])} restatements, {len(analysis["revisions"])} revisions')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
