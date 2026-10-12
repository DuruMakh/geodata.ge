"""Independent verification with openpyxl: no code is shared with prepare.py, sources.py or readers.py.

It walks the source tables itself, requires exactly the same observation keys as the prepared CSVs,
and recomputes every prepared value from the cells it cites.
"""
import csv
from datetime import date, datetime
import hashlib
import json
from pathlib import Path
import re
import sys
import openpyxl

ROOT = Path(__file__).resolve().parent
OUTPUTS = ('money-transfers-annual.csv', 'bop-annual.csv', 'fdi-flows-annual.csv', 'fdi-position-annual.csv')
SCALE = {'usd': 1, 'thousand_usd': 1000, 'million_usd': 1000000}
FOOTERS = ('of which:', 'of Which:')  # sub-headings, not observations
books = {}

def book(filename):
    if filename not in books:
        folder = 'nbg' if filename.startswith(('BOP', 'REM')) else 'geostat'
        books[filename] = openpyxl.load_workbook(ROOT / 'official' / folder / filename, data_only=True)
    return books[filename]

def year_of(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and 1990 <= value <= 2025 else None

def walk_rows(ws, label_col, first, stop_words):
    for r in range(first, ws.max_row + 1):
        if any(str(ws.cell(r, c).value or '').strip().startswith(w) for c in (1, label_col) for w in stop_words): break
        label = ws.cell(r, label_col).value
        if label is None or str(label).strip() in FOOTERS: continue
        yield r

def expected_keys():
    keys = set()
    # Geostat annual tables: year columns in header row 4.
    for filename, sheet, label_col, first, stop in (
            ('FDI_Eng-countries.xlsx', 'FDI (annual)', 2, 5, ('Last update',)), ('FDI_Eng-sectors-NACE-2.xlsx', 'ENG (annual)', 1, 5, ('*',)),
            ('FDI_Eng-components.xlsx', 'Components (annual)', 1, 5, ('^',)), ('FDI_Eng_regions.xlsx', 'ENG (annual)', 1, 5, ('Last update',))):
        ws = book(filename)[sheet]
        columns = [c for c in range(1, ws.max_column + 1) if year_of(ws.cell(4, c).value)]
        for r in walk_rows(ws, label_col, first, stop):
            for c in columns: keys.add((filename, sheet, f'{openpyxl.utils.get_column_letter(c)}{r}'))
    for filename, sheet in (('FDI_Eng_stocks-countries.xlsx', 'countries-ENG'), ('FDI_Eng_stocks-sectors.xlsx', 'FDI Sectors')):
        ws = book(filename)[sheet]
        columns = []
        for c in range(3, ws.max_column + 1):
            v = ws.cell(4, c).value
            if isinstance(v, (datetime, date)): when = (v.year, v.month, v.day)
            elif isinstance(v, str) and (m := re.fullmatch(r'(\d\d)\.(\d\d)\.(\d{4})', v)): when = (int(m[3]), int(m[2]), int(m[1]))
            elif isinstance(v, str) and (m := re.fullmatch(r'(\d+)/(\d+)/(\d{4})', v)): when = (int(m[3]), int(m[1]), int(m[2]))
            else: continue
            if when[1:] == (12, 31) and when[0] <= 2025: columns.append(c)
        for r in walk_rows(ws, 2, 6, ('*',)):
            for c in columns: keys.add((filename, sheet, f'{openpyxl.utils.get_column_letter(c)}{r}'))
    ws = book('FDI_Eng_by_Quarters.xlsx')['FDI']
    for r in range(5, ws.max_row + 1):
        if year_of(ws.cell(r, 1).value): keys.add(('FDI_Eng_by_Quarters.xlsx', 'FDI', f'B{r}'))
    ws = book('FDI_Eng_bpm6.xlsx')['Sheet1']
    for r in range(4, ws.max_row + 1):
        if year_of(ws.cell(r, 1).value):
            for c in 'BCD': keys.add(('FDI_Eng_bpm6.xlsx', 'Sheet1', f'{c}{r}'))
    # NBG balance of payments: every row of the short presentation, plus the named detail lines.
    detail_labels = {'Compensation of employees', "Of which: Workers' remittances", 'Net incurrence of liabilities', 'Personal remittances: Credit',
                     'Personal remittances: Debit', 'Total remittances: Credit', 'Total remittances: Debit'}
    for sheet in ('BOP–BPM6(short)', 'BOP–BPM6'):
        ws = book('BOP-6_bopbpm6eng.xlsx')[sheet]
        columns = [c for c in range(2, ws.max_column + 1) if year_of(ws.cell(3, c).value)]
        if sheet.endswith('(short)'):
            rows = [r for r in range(4, ws.max_row + 1) if ws.cell(r, 1).value]
        else:
            rows, seen = [], set()
            for r in range(1, ws.max_row + 1):
                label = str(ws.cell(r, 1).value or '').strip()
                if label == 'Net incurrence of liabilities' and label in seen: continue  # only direct investment's, the first in the account
                seen.add(label)
                if label in detail_labels or label.startswith('Personal transfers'):
                    rows.append(r)
                    if label in ('Compensation of employees', "Of which: Workers' remittances") or label.startswith('Personal transfers'):
                        rows += [r + 1, r + 2]  # its Credit and Debit lines
                    if label == 'Net incurrence of liabilities':
                        rows += [r + 2, r + 9, r + 12]  # equity other than reinvested earnings, reinvestment of earnings, debt instruments
            rows = sorted(set(rows))
        for r in rows:
            for c in columns: keys.add(('BOP-6_bopbpm6eng.xlsx', sheet, f'{openpyxl.utils.get_column_letter(c)}{r}'))
    # NBG money transfers: every labelled row, every complete year, both flows (keyed by the January cell).
    for ws in book('REMC_money-transfers-by-countries-eng.xlsx').worksheets[1:]:
        januaries = {}
        for c in range(2, ws.max_column + 1):
            v = ws.cell(3, c).value
            year, month = (v.year, v.month) if isinstance(v, datetime) else map(int, v.split('_')) if isinstance(v, str) and '_' in v else (None, None)
            if year and month == 1 and year <= 2025: januaries[year] = c
        for r in walk_rows(ws, 1, 5, ('Source',)):
            for c in januaries.values():
                for offset in (0, 1): keys.add(('REMC_money-transfers-by-countries-eng.xlsx', ws.title, f'{openpyxl.utils.get_column_letter(c + offset)}{r}'))
    return keys

def recompute(row):
    ws = book(row['source_file'])[row['source_sheet']]
    values = [ws[ref].value for ref in row['source_cells'].split(';')]
    numbers = [v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if row['value_status'] == 'not_applicable': return all(v == '-' for v in values)
    if row['value_status'] == 'blank': return all(v is None for v in values)
    if len(numbers) != int(row['months_reported'] or 1): return False
    expected = sum(numbers) * SCALE[row['source_unit']]
    return abs(expected - float(row['value_usd'])) <= max(1e-6, abs(expected) * 1e-12)

def main() -> int:
    prepared, mismatches = set(), []
    for name in OUTPUTS:
        with (ROOT / name).open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                prepared.add((row['source_file'], row['source_sheet'], row['source_cells'].split(';')[0]))
                if not recompute(row): mismatches.append((name, row['source_sheet'], row['source_cells'][:40]))
    expected = expected_keys()
    report = {
        'prepared_keys': len(prepared), 'independent_keys': len(expected),
        'missing_from_prepared': sorted(expected - prepared)[:20], 'not_in_independent_walk': sorted(prepared - expected)[:20],
        'value_mismatches': mismatches[:20],
        'input_artifact_sha256': {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in OUTPUTS},
        'verifier_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }
    ok = not report['missing_from_prepared'] and not report['not_in_independent_walk'] and not mismatches
    report['result'] = 'pass' if ok else 'fail'
    (ROOT / 'independent-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('result', 'prepared_keys', 'independent_keys')}))
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
