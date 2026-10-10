"""Read each reviewed table into source-faithful annual observations."""
from collections import defaultdict
from decimal import Decimal
import re
from sources import EMPTY, stored_precision_usd, LAST_COMPLETE_YEAR, VINTAGE, annual_year, col, excel_date, geostat_vintage, max_col, max_row, sheet, slug, text, value_fields

FIELDS = ('family', 'dimension', 'item_id', 'code', 'label_en', 'parent_id', 'role', 'year', 'flow',
          'value_usd', 'source_value', 'source_unit', 'value_status', 'months_reported', 'vintage',
          'source_file', 'source_sheet', 'source_cells', 'derivation')
FDI_GROUPS = {'EU countries (27)': 'group_eu27', 'CIS countries': 'group_cis', 'Other countries': 'group_other'}
FDI_TOP_LEVEL = {'Unknown': 'unknown', 'International Organizations': 'international_organizations'}
COMBINED_REGIONS = {
    'Samegrelo-Zemo Svaneti and Guria': ('Samegrelo-Zemo Svaneti', 'Guria'),
    'Imereti, Racha-Lechkhumi and Kvemo Svaneti': ('Imereti', 'Racha-Lechkhumi and Kvemo Svaneti'),
    'Shida Kartli and Mtskheta-Mtianeti': ('Shida Kartli', 'Mtskheta-Mtianeti'),
}
COMPONENTS = {'Total': 'total', 'Equity': 'equity', 'Reinvestment of earnings^': 'reinvestment_of_earnings', 'Debt instruments^^': 'debt_instruments'}

def record(**values) -> dict:
    row = dict.fromkeys(FIELDS, '')
    row.update({k: str(v) for k, v in values.items()})
    return row

def observation(cells, ref, unit, **values) -> dict:
    row = record(source_unit=unit, source_cells=ref, derivation='published', **values, **value_fields(cells.get(ref, EMPTY), unit))
    row['_precision'] = stored_precision_usd(row['source_value'] if row['value_status'] == 'numeric' else '', unit)
    return row

def header_years(cells, row: int, first_col: int) -> dict[int, str]:
    years = {}
    for index in range(first_col, max_col(cells) + 1):
        year = annual_year(cells.get(f'{col(index)}{row}', EMPTY))
        if year is not None:
            if year in years: raise ValueError(f'source_layout: repeated year header {year}')
            years[year] = col(index)
    if not years or sorted(years) != list(range(min(years), max(years) + 1)) or max(years) != LAST_COMPLETE_YEAR:
        raise ValueError('source_layout: annual header years are not one complete run ending in 2025')
    return years

def fdi_code(cells, ref: str) -> str:
    cell = cells.get(ref, EMPTY)
    if cell.value is None or cell.value == '': return ''
    value = str(int(cell.value)) if isinstance(cell.value, Decimal) else str(cell.value).strip()
    if not re.fullmatch(r'\d{1,3}', value): raise ValueError(f'source_layout: invalid country code {value!r}')
    return value.zfill(3)

def fdi_country_tree(cells, first: int, last: int) -> list[dict]:
    """Rows of a Geostat country table: total, three published groups, their members and remainders."""
    rows, group, groups_seen = [], None, set()
    for index in range(first, last + 1):
        label, code = text(cells, f'B{index}'), fdi_code(cells, f'A{index}')
        if not label or label == 'of which:': continue
        if label == 'Total' and not rows:
            rows.append(dict(row=index, item_id='total', code='', label=label, parent='', role='total'))
        elif code:
            if group is None: raise ValueError('source_layout: country before any group')
            rows.append(dict(row=index, item_id=f'm49_{code}', code=code, label=label, parent=group, role='country'))
        elif label in FDI_GROUPS and FDI_GROUPS[label] not in groups_seen:
            group = FDI_GROUPS[label]; groups_seen.add(group)
            rows.append(dict(row=index, item_id=group, code='', label=label, parent='total', role='country_group'))
        elif label == 'Other countries' and group == 'group_other':
            rows.append(dict(row=index, item_id='other_countries_remainder', code='', label=label, parent=group, role='remainder'))
        elif label in FDI_TOP_LEVEL:
            group = None
            rows.append(dict(row=index, item_id=FDI_TOP_LEVEL[label], code='', label=label, parent='total', role='unallocated'))
        else:
            raise ValueError(f'source_layout: unexpected country-table row {index} {label!r}')
    if len(groups_seen) != 3 or not {'unknown', 'international_organizations'} <= {r['item_id'] for r in rows}:
        raise ValueError('source_layout: country table structure changed')
    return rows

def table_rows(cells, structure, years, unit, family, dimension, filename, sheet_name, vintage) -> list[dict]:
    out = []
    for spec in structure:
        for year, column in years.items():
            out.append(observation(cells, f'{column}{spec["row"]}', unit, family=family, dimension=dimension,
                                   item_id=spec['item_id'], code=spec['code'], label_en=spec['label'], parent_id=spec['parent'],
                                   role=spec['role'], year=year, flow='inflow', vintage=vintage, source_file=filename, source_sheet=sheet_name))
    return out

def labelled_rows(cells, first: int, last: int, label_col: str, ids: dict | None = None, codes: dict | None = None) -> list[dict]:
    rows = []
    for index in range(first, last + 1):
        label = text(cells, f'{label_col}{index}')
        if not label or label == 'of which:': continue
        if label == 'Total':
            rows.append(dict(row=index, item_id='total', code='', label=label, parent='', role='total')); continue
        item = ids[label] if ids else slug(label)
        code = (codes or {}).get(label, '')
        rows.append(dict(row=index, item_id=f'nace_{code.lower()}' if code else item, code=code, label=label, parent='total', role='component'))
    return rows

def nace_codes(root, sources) -> dict[str, str]:
    cells = sheet(root, sources, 'FDI_Eng_stocks-sectors.xlsx', 'FDI Sectors')
    codes = {text(cells, f'B{r}'): text(cells, f'A{r}') for r in range(8, 26)}
    if len(codes) != 18 or not all(re.fullmatch(r'[A-S]', c) for c in codes.values()):
        raise ValueError('source_layout: NACE section list changed')
    return codes

def read_fdi_flows(root, sources) -> list[dict]:
    out = []
    # Annual totals, 1996-2025, from the by-quarters workbook (rows are years).
    name = 'FDI_Eng_by_Quarters.xlsx'; cells = sheet(root, sources, name, 'FDI'); vintage = geostat_vintage(cells, name)
    if [text(cells, f'{c}4') for c in 'ABCDEF'] != ['Year', 'Total', 'Q I', 'Q II', 'Q III', 'Q IV']:
        raise ValueError('source_layout: quarterly FDI header changed')
    for index in range(5, max_row(cells) + 1):
        year = annual_year(cells.get(f'A{index}', EMPTY))
        if year is None: continue
        out.append(observation(cells, f'B{index}', 'million_usd', family='fdi_flows', dimension='total', item_id='total', label_en='Total',
                               role='total', year=year, flow='inflow', vintage=vintage, source_file=name, source_sheet='FDI'))
    if sorted(int(r['year']) for r in out) != list(range(1996, LAST_COMPLETE_YEAR + 1)):
        raise ValueError('coverage: FDI annual totals are not 1996-2025')
    codes = nace_codes(root, sources)
    tables = [
        ('FDI_Eng-countries.xlsx', 'FDI (annual)', 'country', 'C', lambda c: fdi_country_tree(c, 5, 88)),
        ('FDI_Eng-sectors-NACE-2.xlsx', 'ENG (annual)', 'sector', 'B', lambda c: labelled_rows(c, 5, 24, 'A', codes={k.strip(): v for k, v in codes.items()})),
        ('FDI_Eng-components.xlsx', 'Components (annual)', 'component', 'B', lambda c: labelled_rows(c, 5, 9, 'A', ids=COMPONENTS)),
        ('FDI_Eng_regions.xlsx', 'ENG (annual)', 'region', 'B', region_rows),
    ]
    for name, sheet_name, dimension, first_col, structure in tables:
        cells = sheet(root, sources, name, sheet_name)
        if text(cells, 'A3') != 'Thsd. USD': raise ValueError(f'source_layout: unit changed in {name}')
        years = header_years(cells, 4, ord(first_col) - 64)
        out += table_rows(cells, structure(cells), years, 'thousand_usd', 'fdi_flows', dimension, name, sheet_name, geostat_vintage(cells, name))
    # Geostat's BPM6 presentation (compiled by NBG): balance, assets and liabilities.
    name = 'FDI_Eng_bpm6.xlsx'; cells = sheet(root, sources, name, 'Sheet1'); vintage = geostat_vintage(cells, name)
    if [text(cells, f'{c}3') for c in 'BCD'] != ['Balance1', 'Assets', 'Liabilities'] or text(cells, 'A2') != 'Million USD':
        raise ValueError('source_layout: BPM6 FDI header changed')
    years = 0
    for index in range(4, max_row(cells) + 1):
        year = annual_year(cells.get(f'A{index}', EMPTY))
        if year is None: continue
        years += 1
        for column, item in (('B', 'balance'), ('C', 'assets'), ('D', 'liabilities')):
            out.append(observation(cells, f'{column}{index}', 'million_usd', family='fdi_flows', dimension='bpm6', item_id=item,
                                   label_en=text(cells, f'{column}3'), role='bpm6_line', year=year, flow='net', vintage=vintage, source_file=name, source_sheet='Sheet1'))
    if years != LAST_COMPLETE_YEAR - 2000 + 1: raise ValueError('coverage: BPM6 FDI years are not 2000-2025')
    return out

def region_rows(cells) -> list[dict]:
    rows, parts = [], {p: combined for combined, members in COMBINED_REGIONS.items() for p in members}
    for index in range(5, 21):
        label = text(cells, f'A{index}')
        if not label or label == 'of which:': continue
        if label == 'Total':
            rows.append(dict(row=index, item_id='total', code='', label=label, parent='', role='total'))
        elif label in COMBINED_REGIONS:
            rows.append(dict(row=index, item_id=slug(label), code='', label=label, parent='total', role='region_group'))
        elif label in parts:
            rows.append(dict(row=index, item_id=slug(label), code='', label=label, parent=slug(parts[label]), role='region_part'))
        else:
            rows.append(dict(row=index, item_id=slug(label), code='', label=label, parent='total', role='region'))
    if len(rows) != 15: raise ValueError('source_layout: region table changed')
    return rows

def read_fdi_positions(root, sources) -> list[dict]:
    out = []
    for name, sheet_name, dimension in (('FDI_Eng_stocks-countries.xlsx', 'countries-ENG', 'country'), ('FDI_Eng_stocks-sectors.xlsx', 'FDI Sectors', 'sector')):
        cells = sheet(root, sources, name, sheet_name); vintage = geostat_vintage(cells, name)
        if text(cells, 'A3') != 'Thsd. USD': raise ValueError(f'source_layout: unit changed in {name}')
        years = {}
        for index in range(3, max_col(cells) + 1):
            when = excel_date(cells.get(f'{col(index)}4', EMPTY))
            if when and when.month == 12 and when.day == 31 and when.year <= LAST_COMPLETE_YEAR:
                years[when.year] = col(index)
        if sorted(years) != list(range(2015, LAST_COMPLETE_YEAR + 1)):
            raise ValueError(f'coverage: year-end positions in {name} are not 2015-2025')
        if dimension == 'country':
            structure = fdi_country_tree(cells, 6, 89)
        else:
            structure = [dict(row=6, item_id='total', code='', label='Total', parent='', role='total')] + [
                dict(row=r, item_id=f'nace_{text(cells, f"A{r}").lower()}', code=text(cells, f'A{r}'), label=text(cells, f'B{r}'), parent='total', role='component')
                for r in range(8, 26)]
        rows = table_rows(cells, structure, years, 'thousand_usd', 'fdi_position', dimension, name, sheet_name, vintage)
        for row in rows: row['flow'] = 'position_end_of_year'
        out += rows
    return out

# NBG balance of payments. Short presentation rows, with reviewed identifiers.
BOP_SHORT = {
    4: ('current_account', 'net'), 5: ('current_account', 'credit'), 6: ('current_account', 'debit'),
    7: ('goods_and_services', 'net'), 8: ('goods_and_services', 'credit'), 9: ('goods_and_services', 'debit'),
    10: ('goods', 'net'), 11: ('goods', 'credit'), 12: ('goods', 'debit'),
    13: ('services', 'net'), 14: ('services', 'credit'), 15: ('services', 'debit'),
    16: ('primary_income', 'net'), 17: ('primary_income', 'credit'), 18: ('primary_income', 'debit'),
    19: ('secondary_income', 'net'), 20: ('secondary_income', 'credit'), 21: ('secondary_income', 'debit'),
    22: ('capital_account', 'net'), 23: ('capital_account', 'credit'), 24: ('capital_account', 'debit'),
    25: ('net_lending_borrowing', 'net'), 26: ('financial_account', 'net'),
    27: ('direct_investment', 'net'), 28: ('direct_investment', 'assets'), 29: ('direct_investment', 'liabilities'),
    30: ('portfolio_investment', 'net'), 31: ('portfolio_investment', 'assets'), 32: ('portfolio_investment', 'liabilities'),
    33: ('financial_derivatives', 'net'), 34: ('financial_derivatives', 'assets'), 35: ('financial_derivatives', 'liabilities'),
    36: ('other_investment', 'net'), 37: ('other_investment', 'assets'), 38: ('other_investment', 'liabilities'),
    39: ('reserve_assets', 'net'), 40: ('net_errors_and_omissions', 'net'),
}
# Detail rows from the full presentation, each with its exact label as a layout check.
BOP_DETAIL = {
    269: ('compensation_of_employees', 'net', 'Compensation of employees'), 270: ('compensation_of_employees', 'credit', 'Credit'), 271: ('compensation_of_employees', 'debit', 'Debit'),
    416: ('personal_transfers', 'net', 'Personal transfers (Current transfers between resident and nonresident households)'),
    417: ('personal_transfers', 'credit', 'Credit'), 418: ('personal_transfers', 'debit', 'Debit'),
    419: ('workers_remittances', 'net', "Of which: Workers' remittances"), 420: ('workers_remittances', 'credit', 'Credit'), 421: ('workers_remittances', 'debit', 'Debit'),
    515: ('direct_investment_liabilities', 'liabilities', 'Net incurrence of liabilities'),
    517: ('direct_investment_liabilities_equity', 'liabilities', 'Equity other than reinvestment of earnings'),
    524: ('direct_investment_liabilities_reinvested_earnings', 'liabilities', 'Reinvestment of earnings'),
    527: ('direct_investment_liabilities_debt', 'liabilities', 'Debt instruments'),
    858: ('personal_remittances', 'credit', 'Personal remittances: Credit'), 859: ('personal_remittances', 'debit', 'Personal remittances: Debit'),
    860: ('total_remittances', 'credit', 'Total remittances: Credit'), 861: ('total_remittances', 'debit', 'Total remittances: Debit'),
}
BOP_SHORT_LABELS = {4: 'Current account', 7: 'Goods and services', 10: 'Goods', 13: 'Services', 16: 'Primary income', 19: 'Secondary income',
                    22: 'Capital account', 26: 'Financial account', 27: 'Direct investment', 30: 'Portfolio investment',
                    33: 'Financial derivatives and employee stock options', 36: 'Other investment', 39: 'Reserve assets', 40: 'Net errors and omissions'}

def read_bop(root, sources) -> list[dict]:
    name = 'BOP-6_bopbpm6eng.xlsx'; out = []
    for sheet_name, layout, first in (('BOP–BPM6(short)', BOP_SHORT, 4), ('BOP–BPM6', BOP_DETAIL, 4)):
        cells = sheet(root, sources, name, sheet_name)
        if text(cells, 'A2') != '(Million of USD)': raise ValueError('source_layout: BoP unit changed')
        years = header_years(cells, 3, 2)
        for index, spec in layout.items():
            label = text(cells, f'A{index}')
            expected = spec[2] if len(spec) == 3 else BOP_SHORT_LABELS.get(index)
            if expected is not None and label != expected: raise ValueError(f'source_layout: BoP row {index} is {label!r}')
            if expected is None and spec[1] in ('credit', 'debit', 'assets', 'liabilities') and label.lower() not in (spec[1], spec[1] + ' '):
                raise ValueError(f'source_layout: BoP row {index} is {label!r}')
            for year, column in years.items():
                out.append(observation(cells, f'{column}{index}', 'million_usd', family='bop', dimension='bop_bpm6', item_id=spec[0],
                                       label_en=label, role='presentation' if sheet_name.endswith('(short)') else 'detail',
                                       year=year, flow=spec[1], vintage=VINTAGE[name], source_file=name, source_sheet=sheet_name))
    return out

# NBG money transfers: monthly by country; annual values are sums of the twelve published months.
REMC_SHEETS = {'2000-2007(eng)': (2000, 2007), '2008-2009(eng)': (2008, 2009), '2010-2011 (eng)': (2010, 2011), '2012-2026 (eng) ': (2012, 2025)}

def read_money_transfers(root, sources, identity_rows: list[dict]) -> list[dict]:
    name = 'REMC_money-transfers-by-countries-eng.xlsx'; out = []
    identities = {(r['source_sheet'], r['source_label']): r for r in identity_rows}
    if len(identities) != len(identity_rows): raise ValueError('identity: duplicate reviewed money-transfer label')
    for sheet_name, (first_year, last_year) in REMC_SHEETS.items():
        cells = sheet(root, sources, name, sheet_name)
        if 'thousand USD' not in text(cells, 'A1') or text(cells, 'A3') != 'Country': raise ValueError('source_layout: REMC header changed')
        months = defaultdict(dict)
        for index in range(2, max_col(cells) + 1):
            when = excel_date(cells.get(f'{col(index)}3', EMPTY))
            if when is None: continue
            if text(cells, f'{col(index)}4') != 'Inflow' or text(cells, f'{col(index + 1)}4') != 'Outflow':
                raise ValueError('source_layout: REMC inflow/outflow pair changed')
            if when.month in months[when.year]: raise ValueError('source_layout: repeated REMC month')
            months[when.year][when.month] = (col(index), col(index + 1))
        complete = [y for y in sorted(months) if y <= LAST_COMPLETE_YEAR]
        if complete != list(range(first_year, last_year + 1)) or any(sorted(months[y]) != list(range(1, 13)) for y in complete):
            raise ValueError(f'coverage: REMC sheet {sheet_name!r} does not hold twelve months for {first_year}-{last_year}')
        index = 5
        while not text(cells, f'A{index}').startswith('Source'):
            label = text(cells, f'A{index}')
            if label and label != 'of Which:':
                if index == 5:
                    if label != 'Money transfers, total': raise ValueError('source_layout: REMC total row moved')
                    item, role = 'total', 'total'
                else:
                    identity = identities.pop((sheet_name.strip(), label), None)
                    if identity is None: raise ValueError(f'identity: unreviewed money-transfer label {label!r} in {sheet_name!r}')
                    item = identity['country_id']
                    role = 'remainder' if identity['basis'] == 'remainder_kept_separate' else 'country'
                for year in complete:
                    for flow, position in (('inflow', 0), ('outflow', 1)):
                        refs = [f'{months[year][m][position]}{index}' for m in range(1, 13)]
                        out.append(month_sum(cells, refs, family='money_transfers', dimension='country' if role != 'total' else 'total',
                                             item_id=item, label_en=label, parent_id='' if role == 'total' else 'total', role=role,
                                             year=year, flow=flow, vintage=VINTAGE[name], source_file=name, source_sheet=sheet_name))
            index += 1
            if index > 400: raise ValueError('source_layout: REMC source footer missing')
    if identities: raise ValueError(f'identity: reviewed labels absent from the source {sorted(identities)[:3]}')
    keys = [(r['source_sheet'], r['item_id'], r['year'], r['flow']) for r in out]
    if len(keys) != len(set(keys)): raise ValueError('duplicate_key: two money-transfer labels share one identity in a block')
    return out

def month_sum(cells, refs, **values) -> dict:
    numbers, precision = [], Decimal(0)
    for ref in refs:
        fields = value_fields(cells.get(ref, EMPTY), 'thousand_usd')
        if fields['value_status'] == 'not_applicable': raise ValueError(f'cell_type: unexpected symbol in month {ref}')
        if fields['value_status'] == 'numeric':
            numbers.append(Decimal(fields['value_usd'])); precision += stored_precision_usd(fields['source_value'], 'thousand_usd')
    status = 'numeric' if len(numbers) == 12 else 'blank' if not numbers else 'partial_months'
    row = record(value_usd=str(sum(numbers)) if numbers else '', source_value='', source_unit='thousand_usd', value_status=status,
                 months_reported=len(numbers), source_cells=';'.join(refs), derivation='sum_of_published_months', **values)
    row['_precision'] = precision
    return row

def read_remm_totals(root, sources) -> dict[tuple[int, str], tuple[Decimal | None, str, Decimal]]:
    """NBG's published annual totals (REMM row 5), used only to check the REMC monthly sums."""
    name = 'REMM_money-transfers-by-months-eng.xlsx'; cells = sheet(root, sources, name, '1999-2026 E')
    if text(cells, 'A5') != 'Money transfers, total' or 'thousand USD' not in text(cells, 'A1'):
        raise ValueError('source_layout: REMM total row moved')
    totals = {}
    for index in range(2, max_col(cells) + 1):
        header = text(cells, f'{col(index)}3').rstrip('*')
        if re.fullmatch(r'\d{4}', header) and int(header) <= LAST_COMPLETE_YEAR:
            for offset, flow in ((0, 'inflow'), (1, 'outflow')):
                ref = f'{col(index + offset)}5'
                fields = value_fields(cells.get(ref, EMPTY), 'thousand_usd')
                totals[(int(header), flow)] = (Decimal(fields['value_usd']) if fields['value_status'] == 'numeric' else None, ref,
                                               stored_precision_usd(fields['source_value'] if fields['value_status'] == 'numeric' else '', 'thousand_usd'))
    return totals

def read_fdi_quarter_sums(root, sources) -> dict[int, tuple[Decimal, Decimal]]:
    """Sum of the four published quarters per complete year (quarters alone, never output as data)."""
    name = 'FDI_Eng_by_Quarters.xlsx'; cells = sheet(root, sources, name, 'FDI'); sums = {}
    for index in range(5, max_row(cells) + 1):
        year = annual_year(cells.get(f'A{index}', EMPTY))
        if year is None: continue
        quarters = [value_fields(cells.get(f'{c}{index}', EMPTY), 'million_usd') for c in 'CDEF']
        if all(q['value_status'] == 'numeric' for q in quarters):
            sums[year] = (sum(Decimal(q['value_usd']) for q in quarters), sum(stored_precision_usd(q['source_value'], 'million_usd') for q in quarters))
        elif any(q['value_status'] == 'numeric' for q in quarters):
            raise ValueError(f'source_layout: {year} has only some quarters')
    return sums
