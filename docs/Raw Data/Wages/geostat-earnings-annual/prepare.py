"""Reproduce and check the annual earnings research package from its preserved sources.

Uses Python's standard library only. Never downloads sources or serves product data.
The worksheet reader, CSV writer and HTML table parser are reused from the unemployment package.
"""

import argparse
from collections import defaultdict
import csv
from decimal import Decimal, ROUND_HALF_UP
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
clean, csv_bytes, read_sheet, Tables = _shared.clean, _shared.csv_bytes, _shared.read_sheet, _shared.Tables
NS = _shared.NS

AVERAGE = 'average_monthly_nominal_earnings'
MEDIAN = 'median_monthly_earnings'
# The primary series starts with the lari (1995), as published in Geostat's headline workbook. Earlier values use
# roubles or coupons. The preserved survey metadata documents coverage only from 1998, a caveat kept in the docs.
PRIMARY_START = 1995
UNAVAILABLE = {'…', '...'}
PRECISION = {'0.0': Decimal('0.1'), '#\\ ##0.0': Decimal('0.1'), '0': Decimal('1')}
NACE2 = {
    'Agriculture, forestry and fishing': 'sector.a',
    'Mining and quarrying': 'sector.b',
    'Manufacturing': 'sector.c',
    'Electricity, gas, steam and air conditioning supply': 'sector.d',
    'Water supply, sewerage, waste management and remediation activities': 'sector.e',
    'Construction': 'sector.f',
    'Wholesale and retail trade; repair of motor vehicles and motorcycles': 'sector.g',
    'Transportation and storage': 'sector.h',
    'Accommodation and food service activities': 'sector.i',
    'Information and communication': 'sector.j',
    'Financial and insurance activities': 'sector.k',
    'Real estate activities': 'sector.l',
    'Professional, scientific and technical activities': 'sector.m',
    'Administrative and support service activities': 'sector.n',
    'Public administration and defence; compulsory social security': 'sector.o',
    'Education': 'sector.p',
    'Human health and social work activities': 'sector.q',
    'Arts, entertainment and recreation': 'sector.r',
    'Other service activities': 'sector.s',
}
NACE1 = {
    'Agriculture, hunting and forestry': 'nace1.a',
    'Fishing': 'nace1.b',
    'Mining and quarrying': 'nace1.c',
    'Manufacturing': 'nace1.d',
    'Production and distribution of electricity, gas and water': 'nace1.e',
    'Construction': 'nace1.f',
    'Wholesale and retail trade; repair of motor vehicles and personal and household goods': 'nace1.g',
    'Hotels and restaurants': 'nace1.h',
    'Transport and communication': 'nace1.i',
    'Financial intermediation': 'nace1.j',
    'Real estate, renting and business activities': 'nace1.k',
    'Public administration': 'nace1.l',
    'Education': 'nace1.m',
    'Health and social work': 'nace1.n',
    'Other community, social and personal service activities': 'nace1.o',
}
SECTOR_LABELS = {sector_id: label for mapping in (NACE2, NACE1) for label, sector_id in mapping.items()}
SECTOR_LABELS['total'] = 'All economic activities'
GROUPS = {  # Source row or block label -> (dimension, group_id, English label)
    'Total': ('national', 'georgia', 'Georgia'),
    'Women': ('sex', 'women', 'Women'),
    'Men': ('sex', 'men', 'Men'),
    'Public': ('ownership', 'public', 'Public sector'),
    'Public sector': ('ownership', 'public', 'Public sector'),
    'Non-public': ('ownership', 'non_public', 'Non-public sector'),
    'Non-public sector': ('ownership', 'non_public', 'Non-public sector'),
    'Business': ('business_sector', 'business', 'Business sector'),
    'Business sector': ('business_sector', 'business', 'Business sector'),
    'Non-business': ('business_sector', 'non_business', 'Non-business and financial sector'),
    'Non-business sector': ('business_sector', 'non_business', 'Non-business and financial sector'),
}
REGIONS = {
    'Tbilisi': ('region.tbilisi', 'Tbilisi'),
    'Adjara A.R.': ('region.adjara', 'Adjara'),
    'Guria': ('region.guria', 'Guria'),
    'Imereti': ('region.imereti', 'Imereti'),
    'Kakheti': ('region.kakheti', 'Kakheti'),
    'Mtskheta-Mtianeti': ('region.mtskheta_mtianeti', 'Mtskheta-Mtianeti'),
    'Racha-Lechkhumi and Kvemo Svaneti': ('region.racha_lechkhumi_kvemo_svaneti', 'Racha-Lechkhumi and Kvemo Svaneti'),
    'Samegrelo-Zemo Svaneti': ('region.samegrelo_zemo_svaneti', 'Samegrelo-Zemo Svaneti'),
    'Samtskhe-Javakheti': ('region.samtskhe_javakheti', 'Samtskhe-Javakheti'),
    'Kvemo Kartli': ('region.kvemo_kartli', 'Kvemo Kartli'),
    'Shida Kartli': ('region.shida_kartli', 'Shida Kartli'),
}
SECTION_LABELS = {'Sex', 'Type of ownership', 'Sector'}  # Headline workbook headings without values.

_N2 = ['total'] + list(NACE2.values())
_N1 = ['total'] + list(NACE1.values())


def _years(first, last):
    return tuple(range(first, last + 1))


def _without(sectors, *codes):
    return [s for s in sectors if s.rsplit('.', 1)[-1] not in codes or s == 'total']


# Independent inventory of every published cell: (source_id, sheet) -> (kind, classification, years, {group: sectors}).
LAYOUTS = {
    ('geostat_earnings_annual_headline', '1'): ('headline', 'none', (1970, 1975, 1980) + _years(1985, 2025), {
        g: ['total'] for g in ('georgia', 'women', 'men', 'public', 'non_public', 'business', 'non_business')}),
    ('geostat_earnings_annual_activity', 'NACE1'): ('activity', 'nace_rev1_1', _years(1998, 2019), {'georgia': _N1}),
    ('geostat_earnings_annual_activity', 'NACE2'): ('activity', 'nace_rev2', _years(2014, 2025), {'georgia': _N2}),
    ('geostat_earnings_annual_sex', 'NACE1'): ('activity', 'nace_rev1_1', _years(1999, 2019), {'women': _N1, 'men': _N1}),
    ('geostat_earnings_annual_sex', 'NACE2'): ('activity', 'nace_rev2', _years(2014, 2025), {'women': _N2, 'men': _N2}),
    ('geostat_earnings_annual_business_sector', 'NACE1'): ('activity', 'nace_rev1_1', _years(2006, 2019), {
        'business': _without(_N1, 'j', 'l'),
        'non_business': ['total'] + [f'nace1.{c}' for c in 'ajklmno']}),
    ('geostat_earnings_annual_business_sector', 'NACE2'): ('activity', 'nace_rev2', _years(2014, 2025), {
        'business': _without(_N2, 'k', 'o'),
        'non_business': ['total'] + [f'sector.{c}' for c in 'akmopqrs']}),
    ('geostat_earnings_annual_ownership', 'NACE1'): ('activity', 'nace_rev1_1', _years(2000, 2019), {
        'public': _without(_N1, 'j'), 'non_public': _without(_N1, 'l')}),
    ('geostat_earnings_annual_ownership', 'NACE2'): ('activity', 'nace_rev2', _years(2014, 2025), {
        'public': _without(_N2, 'k'), 'non_public': _without(_N2, 'o')}),
    ('geostat_earnings_annual_region', '1'): ('region', 'none', _years(2010, 2025), {
        g: ['total'] for g in ['georgia'] + [region_id for region_id, _ in REGIONS.values()]}),
    ('geostat_earnings_annual_median', '1'): ('median', 'nace_rev2', _years(2018, 2025), {'georgia': _N2}),
}
REQUIRED_SOURCES = {source_id for source_id, _ in LAYOUTS} | {
    'geostat_wages_source_page', 'geostat_earnings_release_2025', 'geostat_median_release_2025',
    'geostat_earnings_metadata_2026', 'geostat_median_metadata_2026'}
FIELDS = ('year', 'frequency', 'indicator_id', 'dimension', 'group_id', 'group_label_en', 'sector_id',
          'sector_label_en', 'classification', 'unit', 'value', 'published_value', 'basis', 'value_status', 'role',
          'role_note', 'source_id', 'source_sheet', 'source_cell', 'source_group_label', 'source_label',
          'source_number_format')
UNAVAILABLE_FIELDS = ('year', 'indicator_id', 'dimension', 'group_id', 'sector_id', 'classification', 'source_id',
                      'source_sheet', 'source_cell', 'source_group_label', 'source_label', 'source_token')


def legacy_unit(year):
    """Headline workbook footnote: rouble before 1993, coupon in 1993, thousand coupon in 1994, lari since 1995."""
    return 'rouble' if year < 1993 else 'coupon' if year == 1993 else 'thousand_coupon' if year == 1994 else 'gel'


def group_of(kind, label):
    if kind == 'region':
        if label == 'Total':
            return GROUPS['Total']
        region_id, region_label = REGIONS[label]
        return 'region', region_id, region_label
    return GROUPS[label]


def role_of(kind, classification, group_id, sector_id, year):
    if kind == 'headline':
        if year < PRIMARY_START:
            return 'legacy', f'Before the lari ({PRIMARY_START}); unit {legacy_unit(year)}'
        return 'primary', ''
    if kind in ('median', 'region'):
        return 'primary', ''
    if sector_id == 'total':
        return 'control', 'Repeats the headline workbook total'
    if classification == 'nace_rev1_1':
        return 'legacy', 'NACE Rev.1.1 activity; superseded by NACE Rev.2 from 2014'
    return 'primary', ''


def extract(record, sheet, layout):
    """Return (observations, unavailable cells, footnotes) for one worksheet, failing on any unmapped value."""
    kind, classification, years, _ = layout
    source_id = record['source_id']
    rows = read_sheet(ROOT / record['local_file'], sheet)
    header = next(r for r in sorted(rows) if sum(
        isinstance(c['value'], Decimal) and 1950 <= c['value'] <= 2030 for col, c in rows[r].items() if col != 'A') >= 3)
    year_columns, notes = {}, []
    for col, c in rows[header].items():
        if col == 'A':
            continue
        match = re.fullmatch(r'(\d{4})(\**)', str(c['value']).strip())
        if match is None:
            raise ValueError(f'Unexpected year heading: {source_id} {sheet}!{c["cell"]}')
        year_columns[col] = int(match.group(1))
        if match.group(2):  # A starred year refers to a footnote below the table.
            notes.append({'source_id': source_id, 'source_sheet': sheet, 'source_cell': c['cell'],
                          'text': f'Year heading marked {c["value"]}'})
    if sorted(year_columns.values()) != list(years):
        raise ValueError(f'Unexpected annual coverage: {source_id} {sheet}')
    indicator = MEDIAN if kind == 'median' else AVERAGE
    sector_map = NACE1 if classification == 'nace_rev1_1' else NACE2
    # Single-group workbooks have no group heading; the others name each group in column B.
    block = ('Total', ) if source_id in ('geostat_earnings_annual_activity', 'geostat_earnings_annual_median') else None
    observations, unavailable, consumed = [], [], {header}
    for r in sorted(rows):
        if r <= header:
            continue
        label = clean(rows[r].get('A', {}).get('value'))
        values = {col: rows[r][col] for col in year_columns if col in rows[r]}
        if label is None and 'B' in rows[r] and isinstance(rows[r]['B']['value'], str) and not values.keys() - {'B'}:
            block = (clean(rows[r]['B']['value']), )
            if block[0] not in GROUPS:
                raise ValueError(f'Unmapped group heading: {source_id} {sheet}!B{r}')
            consumed.add(r)
            continue
        if not values:
            if label is None:
                continue
            if label in SECTION_LABELS:
                consumed.add(r)
            elif label.startswith(('*', 'Source:')):
                notes.append({'source_id': source_id, 'source_sheet': sheet, 'source_cell': f'A{r}', 'text': label})
                consumed.add(r)
            else:
                raise ValueError(f'Unmapped label without values: {source_id} {sheet}!A{r}')
            continue
        if not isinstance(label, str):
            raise ValueError(f'Data row without label: {source_id} {sheet} row {r}')
        if kind in ('headline', 'region'):
            group_label, sector_id = label, 'total'
        else:
            if block is None:
                raise ValueError(f'Data row before group heading: {source_id} {sheet}!A{r}')
            group_label = block[0]
            sector_id = 'total' if label == 'Total' else sector_map[label.rstrip('*').strip()]
        dimension, group_id, group_label_en = group_of(kind, group_label)
        if kind == 'median':
            role_kind = 'median'
        elif kind == 'region' and group_id == 'georgia':
            role_kind = 'activity'  # The regional workbook's total repeats the headline value.
        else:
            role_kind = kind
        for col, year in sorted(year_columns.items(), key=lambda item: item[1]):
            cell = values.get(col)
            coordinate = f'{col}{r}'
            if cell is None:
                raise ValueError(f'Blank published cell: {source_id} {sheet}!{coordinate}')
            if isinstance(cell['value'], str):
                if cell['value'].strip() not in UNAVAILABLE:
                    raise ValueError(f'Non-numeric source value: {source_id} {sheet}!{coordinate}')
                unavailable.append(dict(zip(UNAVAILABLE_FIELDS, (
                    year, indicator, dimension, group_id, sector_id, classification, source_id, sheet, coordinate,
                    group_label, label, cell['value'].strip()))))
                continue
            value = cell['value']
            if not value.is_finite() or value <= 0:
                raise ValueError(f'Invalid value: {source_id} {sheet}!{coordinate}')
            if cell['format'] not in PRECISION or (kind == 'median') != (cell['format'] == '0'):
                raise ValueError(f'Unexpected source precision: {source_id} {sheet}!{coordinate} {cell["format"]}')
            role, note = role_of(role_kind, classification, group_id, sector_id, year)
            unit = legacy_unit(year) if kind == 'headline' else 'gel'
            observations.append(dict(zip(FIELDS, (
                year, 'annual', indicator, dimension, group_id, group_label_en, sector_id, SECTOR_LABELS[sector_id],
                classification, unit, str(value),
                str(value.quantize(PRECISION[cell['format']], rounding=ROUND_HALF_UP)), 'actual',
                'administrative' if kind == 'median' else 'survey_estimate', role, note,
                source_id, sheet, coordinate, group_label, label, cell['format'],
            ))))
        consumed.add(r)
    stray = [c['cell'] for r, cells in rows.items() for col, c in cells.items() if isinstance(c['value'], Decimal)
             and (r not in consumed or (r != header and col not in year_columns))]
    if stray:
        raise ValueError(f'Unmapped numeric cells: {source_id} {sheet} {stray}')
    return observations, unavailable, notes


def published(row):
    return Decimal(row['published_value'])


def validate(observations, unavailable, manifest, transcriptions):
    failures, checks = [], []

    def compare(name, key, actual, expected, tolerance=Decimal(0)):
        if actual is None or expected is None:
            failures.append({'check': name, 'key': key, 'reason': 'missing input'})
            return
        difference = abs(actual - expected)
        check = {'check': name, 'key': key, 'actual': str(actual), 'expected': str(expected),
                 'difference': str(difference), 'tolerance': str(tolerance), 'passed': difference <= tolerance}
        checks.append(check)
        if not check['passed']:
            failures.append(check)

    # 0. The activity mapping agrees with Geostat's own section letters (2025 release, printed page 8), and every
    # row's IDs agree with the labels printed next to it.
    with open(ROOT / 'nace-sections-transcription.csv', encoding='utf-8-sig', newline='') as handle:
        sections = {row['section_title']: f'sector.{row["section_letter"].lower()}' for row in csv.DictReader(handle)}
    if sections != NACE2:
        failures.append({'check': 'nace_section_letters', 'key': ('release_2025', 'page_8'),
                         'reason': 'activity mapping differs from the published section list'})
    for row in observations + unavailable:
        kind, classification = LAYOUTS[(row['source_id'], row['source_sheet'])][:2]
        mapping = NACE1 if classification == 'nace_rev1_1' else NACE2
        label = row['source_label'].rstrip('*').strip()
        sector_id = 'total' if label == 'Total' or kind in ('headline', 'region') else mapping.get(label)
        group_id = group_of(kind, row['source_group_label'])[1]
        if (sector_id, group_id) != (row['sector_id'], row['group_id']):
            failures.append({'check': 'label_matches_id', 'key': (row['source_id'], row['source_sheet'],
                                                                  row['source_cell'])})

    # 1. Each published cell exactly once, against the independent inventory.
    seen = defaultdict(int)
    for row in observations + unavailable:
        seen[(row['source_id'], row['source_sheet'], row['group_id'], row['sector_id'], row['year'])] += 1
    expected = {(source_id, sheet, group_id, sector_id, year)
                for (source_id, sheet), (_, _, years, groups) in LAYOUTS.items()
                for group_id, sectors in groups.items() for sector_id in sectors for year in years}
    for key in sorted(expected - set(seen)):
        failures.append({'check': 'source_cell_inventory', 'key': key, 'reason': 'missing published cell'})
    for key in sorted(set(seen) - expected):
        failures.append({'check': 'source_cell_inventory', 'key': key, 'reason': 'unexpected cell'})
    for key, count in sorted(seen.items()):
        if count > 1:
            failures.append({'check': 'duplicate_source_cell', 'key': key, 'count': count})

    # 2. Exactly one primary value per statistical key; every control repeats one.
    def stat_key(row):
        return row['indicator_id'], row['dimension'], row['group_id'], row['sector_id'], row['year']
    primary = {}
    for row in observations:
        if row['role'] == 'primary':
            if stat_key(row) in primary:
                failures.append({'check': 'duplicate_primary', 'key': stat_key(row)})
            primary[stat_key(row)] = row
    for row in observations:
        if row['role'] == 'control':
            match = primary.get(stat_key(row))
            compare('repeated_total', stat_key(row) + (row['source_id'], row['source_sheet']), published(row),
                    None if match is None else published(match))

    # 3. Activities that belong wholly to one sector repeat the national value (metadata section 3.6).
    index = {stat_key(row): row for row in observations if row['role'] != 'control'}
    identities = [
        ('sector.o', [('ownership', 'public'), ('business_sector', 'non_business')]),
        ('sector.k', [('business_sector', 'non_business')]),
        ('nace1.l', [('ownership', 'public'), ('business_sector', 'non_business')]),
        ('nace1.j', [('business_sector', 'non_business')]),
    ]
    for sector_id, groups in identities:
        for dimension, group_id in groups:
            compared = 0
            for year in range(1998, 2026):
                national = index.get((AVERAGE, 'national', 'georgia', sector_id, year))
                other = index.get((AVERAGE, dimension, group_id, sector_id, year))
                if national is not None and other is not None:
                    compared += 1
                    compare('single_sector_activity', (sector_id, dimension, group_id, year),
                            published(other), published(national))
            if not compared:  # A mistyped ID must not turn the identity into zero checks.
                failures.append({'check': 'single_sector_activity', 'key': (sector_id, dimension, group_id),
                                 'reason': 'no comparable years'})

    # 4. An average (or median) of a whole lies within its parts' range.
    totals = {k: v for k, v in primary.items() if k[3] == 'total'}
    parts = defaultdict(list)
    for row in observations:
        if row['role'] == 'control' or row['unit'] != 'gel':
            continue
        if row['sector_id'] != 'total':
            parts[(row['indicator_id'], row['dimension'], row['group_id'], row['year'], row['classification'])].append(row)
        elif row['dimension'] != 'national':
            parts[(row['indicator_id'], 'national', 'georgia', row['year'], row['dimension'])].append(row)
    for (indicator, dimension, group_id, year, partition), members in sorted(parts.items()):
        whole = totals.get((indicator, dimension, group_id, 'total', year))
        if whole is None:
            failures.append({'check': 'within_parts_range', 'key': (indicator, dimension, group_id, year, partition),
                             'reason': 'missing total'})
            continue
        low, high = min(map(published, members)), max(map(published, members))
        value = published(whole)
        outside = max(low - value, value - high, Decimal(0))
        compare('within_parts_range', (indicator, dimension, group_id, year, partition), outside, Decimal(0))

    # 5. Annual headline values on the preserved source page.
    parser = Tables()
    page = next(r for r in manifest if r['source_id'] == 'geostat_wages_source_page')
    parser.feed((ROOT / page['local_file']).read_text(encoding='utf-8-sig'))
    page_rows = [r for r in parser.rows if len(r) > 1]
    header = next(r for r in page_rows if r[1:5] == ['2022', '2023', '2024', '2025'])
    values = next(r for r in page_rows if r[0] == 'Average monthly nominal earnings, Gel')
    page_years = 0
    for period, text in zip(header[1:], values[1:]):
        if not period.isdigit():  # The page also shows quarters; this package is annual only.
            continue
        page_years += 1
        match = primary.get((AVERAGE, 'national', 'georgia', 'total', int(period)))
        compare('official_page_annual_headline', (int(period), ), Decimal(text),
                None if match is None else published(match))
    if page_years != 4:
        failures.append({'check': 'official_page_annual_headline', 'reason': f'{page_years} annual columns'})

    # 6. Statements transcribed from the two 2025 news releases.
    def value_of(indicator, dimension, group_id, sector_id, year):
        row = primary.get((indicator, dimension, group_id, sector_id, year))
        return None if row is None else Decimal(row['value'])

    for t in transcriptions:
        year = int(t['year'])
        key = (t['indicator_id'], t['dimension'], t['group_id'], t['sector_id'], year)
        current = value_of(*key)
        measure, result = t['measure'], None
        step = Decimal('1') if t['indicator_id'] == MEDIAN and measure == 'level' else Decimal('0.1')
        if current is not None:
            if measure == 'level':
                result = current
            elif measure in ('change_gel', 'change_pct'):
                previous = value_of(*key[:4], year - 1)
                if previous is not None:
                    result = current - previous if measure == 'change_gel' else (current / previous - 1) * 100
            elif measure in ('gap_gel', 'gap_pct'):
                other = value_of(t['indicator_id'], t['dimension'], t['other_group_id'], t['sector_id'], year)
                if other is not None:
                    result = other - current if measure == 'gap_gel' else (other - current) / other * 100
            elif measure == 'below_mean_pct':
                mean = value_of(AVERAGE, *key[1:])
                if mean is not None:
                    result = (1 - current / mean) * 100
            elif measure == 'rank_desc':
                if t['dimension'] == 'region':
                    peers = [v for k, v in primary.items() if k[0] == key[0] and k[1] == 'region' and k[4] == year]
                else:
                    peers = [v for k, v in primary.items() if k[:3] == key[:3] and k[3] != 'total' and k[4] == year]
                if len(peers) >= 2:
                    result = Decimal(1 + sum(Decimal(p['value']) > current for p in peers))
            elif measure == 'sectors_not_below_mean':
                medians = [v for k, v in primary.items() if k[:3] == key[:3] and k[3] != 'total' and k[4] == year]
                means = [value_of(AVERAGE, *key[1:3], m['sector_id'], year) for m in medians]
                if medians and None not in means:
                    result = Decimal(sum(Decimal(m['value']) >= mean for m, mean in zip(medians, means)))
            else:
                failures.append({'check': 'release_statement', 'key': t['check_id'], 'reason': 'unknown measure'})
                continue
        compare('release_statement', (t['check_id'], ), Decimal(t['published_value']),
                None if result is None else result.quantize(step, rounding=ROUND_HALF_UP))
    return checks, failures


def load_transcriptions():
    with open(ROOT / 'release-transcriptions.csv', encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def collect():
    """Check the source captures and extract every published cell."""
    manifest = json.loads((ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
    source_ids = [record['source_id'] for record in manifest]
    if set(source_ids) != REQUIRED_SOURCES or len(source_ids) != len(REQUIRED_SOURCES):
        raise ValueError('Source manifest must contain each of the twelve required captures exactly once')
    records = {record['source_id']: record for record in manifest}
    hashes = []
    for record in manifest:
        content = (ROOT / record['local_file']).read_bytes()
        digest = hashlib.sha256(content).hexdigest().upper()
        if digest != record['sha256'] or len(content) != record['bytes']:
            raise ValueError(f'Source hash or size mismatch: {record["local_file"]}')
        hashes.append({'source_id': record['source_id'], 'sha256': digest, 'bytes': len(content), 'passed': True})
    for source_id in {source_id for source_id, _ in LAYOUTS}:
        with ZipFile(ROOT / records[source_id]['local_file']) as archive:
            names = [s.get('name') for s in ET.fromstring(archive.read('xl/workbook.xml')).findall('x:sheets/x:sheet', NS)]
        if sorted(names) != sorted(sheet for sid, sheet in LAYOUTS if sid == source_id):
            raise ValueError(f'Unexpected worksheets in {source_id}: {names}')
    observations, unavailable, notes = [], [], []
    for (source_id, sheet), layout in LAYOUTS.items():
        found, missing, footnotes = extract(records[source_id], sheet, layout)
        observations += found
        unavailable += missing
        notes += footnotes
    order = lambda r: (r['indicator_id'], r['dimension'], r['group_id'], r['sector_id'], r['year'], r['source_id'],
                       r['source_sheet'])
    observations.sort(key=order)
    unavailable.sort(key=order)
    return manifest, hashes, observations, unavailable, notes


def build():
    manifest, hashes, observations, unavailable, notes = collect()
    transcriptions = load_transcriptions()
    checks, failures = validate(observations, unavailable, manifest, transcriptions)

    current = [r for r in observations if r['role'] == 'primary']
    summary = [{'year': r['year'], 'indicator_id': r['indicator_id'], 'dimension': r['dimension'],
                'group_label_en': r['group_label_en'], 'sector_id': r['sector_id'],
                'sector_label_en': r['sector_label_en'], 'gel': r['published_value'],
                'source_id': r['source_id'], 'source_cell': f'{r["source_sheet"]}!{r["source_cell"]}'}
               for r in current]
    coverage_groups = defaultdict(list)
    for r in current:
        coverage_groups[(r['indicator_id'], r['dimension'], r['group_id'], r['sector_id'])].append(r)
    coverage = []
    for (indicator, dimension, group_id, sector_id), rows in sorted(coverage_groups.items()):
        years = sorted(r['year'] for r in rows)
        coverage.append({'indicator_id': indicator, 'dimension': dimension, 'group_id': group_id,
                         'group_label_en': rows[0]['group_label_en'], 'sector_id': sector_id,
                         'sector_label_en': rows[0]['sector_label_en'], 'year_min': years[0], 'year_max': years[-1],
                         'year_count': len(years), 'gaps': '|'.join(str(y) for y in range(years[0], years[-1] + 1)
                                                                   if y not in years)})
    never_published = defaultdict(list)  # Current-classification series whose every cell is marked unavailable.
    for r in unavailable:
        key = (r['indicator_id'], r['dimension'], r['group_id'], r['sector_id'])
        if r['classification'] == 'nace_rev2' and key not in coverage_groups:
            never_published[key].append(r)
    for (indicator, dimension, group_id, sector_id), rows in sorted(never_published.items()):
        kind = LAYOUTS[(rows[0]['source_id'], rows[0]['source_sheet'])][0]
        coverage.append({'indicator_id': indicator, 'dimension': dimension, 'group_id': group_id,
                         'group_label_en': group_of(kind, rows[0]['source_group_label'])[2], 'sector_id': sector_id,
                         'sector_label_en': SECTOR_LABELS[sector_id], 'year_min': '', 'year_max': '',
                         'year_count': 0, 'gaps': '|'.join(sorted(str(r['year']) for r in rows))})
    coverage.sort(key=lambda c: (c['indicator_id'], c['dimension'], c['group_id'], c['sector_id']))
    check_counts = defaultdict(int)
    for check in checks:
        check_counts[check['check']] += 1
    roles = defaultdict(int)
    for r in observations:
        roles[r['role']] += 1
    report = {
        'status': 'passed' if not failures else 'failed',
        'retrieved_at': '2026-10-09',
        'scope': 'Annual research only: national, economic activity (NACE Rev.2), sex, ownership, business sector, '
                 'region and median earnings; no quarterly data, real wages, serving or UI integration',
        'source_observation_count': len(observations), 'role_counts': dict(sorted(roles.items())),
        'primary_observation_count': len(current), 'unavailable_cell_count': len(unavailable),
        'imputed_values': 0, 'source_checks': hashes, 'reconciliation_check_count': len(checks),
        'reconciliation_checks_by_type': dict(sorted(check_counts.items())),
        'reconciliation_failed_count': len(failures), 'failures': failures,
        'source_footnotes': notes, 'coverage': coverage,
        'limitations': [
            'Average earnings are gross monthly earnings per paid employee, with part-time employees converted to '
            'full-time equivalents; they exclude self-employed people.',
            'The median is calculated from Revenue Service records per employee (2018 onward); it is not from the '
            'enterprise survey and is published in whole lari.',
            'Primary national values start in 1995 with the lari; 1970-1994 headline values are retained as legacy '
            'observations, in roubles before 1993, coupons in 1993 and thousand coupons in 1994. The preserved survey '
            'metadata documents coverage from 1998, so 1995-1997 rest on the headline workbook alone.',
            'Activity breakdowns use NACE Rev.2 from 2014; NACE Rev.1.1 values for 1998-2019 are retained as legacy '
            'observations and must not be joined to NACE Rev.2 sections.',
            'Since 2006 the business sector and the non-business and financial sector are surveyed separately.',
            'Regional values place some enterprises at their head office location.',
            'Cells marked as unavailable in the source are listed in unavailable-cells.csv; none is filled.',
            'Source cells keep more decimals than the published one-decimal values; those decimals are retained for '
            'reconciliation only.',
        ],
    }
    products = {
        'source-observations.csv': csv_bytes(observations, FIELDS),
        'earnings-annual.csv': csv_bytes(current, FIELDS),
        'earnings-summary.csv': csv_bytes(summary, tuple(summary[0])),
        'unavailable-cells.csv': csv_bytes(unavailable, UNAVAILABLE_FIELDS),
        'coverage.csv': csv_bytes(coverage, tuple(coverage[0])),
        'source-manifest.csv': csv_bytes(manifest, tuple(manifest[0])),
        'reconciliation.csv': csv_bytes([{**c, 'key': '|'.join(map(str, c['key']))} for c in checks],
                                        ('check', 'key', 'actual', 'expected', 'difference', 'tolerance', 'passed')),
        'validation-report.json': (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
    }
    return products, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare generated outputs without writing.')
    args = parser.parse_args()
    products, report = build()
    if args.check:
        stale = [name for name, content in products.items() if not (ROOT / name).exists() or (ROOT / name).read_bytes() != content]
        if stale:
            raise SystemExit('Missing or stale outputs: ' + ', '.join(stale))
    else:
        for name, content in products.items():
            (ROOT / name).write_bytes(content)
    print(json.dumps({k: report[k] for k in ('status', 'source_observation_count', 'role_counts',
                                           'primary_observation_count', 'unavailable_cell_count',
                                           'reconciliation_check_count', 'reconciliation_checks_by_type',
                                           'reconciliation_failed_count')}, indent=2))
    if report['failures']:
        print(json.dumps(report['failures'][:40], indent=2, default=str))
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
