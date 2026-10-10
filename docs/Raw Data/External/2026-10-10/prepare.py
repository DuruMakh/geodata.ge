"""Offline, deterministic preparation of the external-flows research package.

--write regenerates every artifact; --check regenerates them in memory and fails on any byte difference.
"""
import argparse
from collections import defaultdict
import csv
from decimal import Decimal, getcontext
import hashlib
import io
import json
from pathlib import Path
import sys
from readers import FIELDS, read_bop, read_fdi_flows, read_fdi_positions, read_fdi_quarter_sums, read_money_transfers, read_remm_totals
from sources import ROOT, load_verified_sources

getcontext().prec = 50
REPO = ROOT.parents[3]
GDP_FILE = 'data/imports/gdp-overview-annual.csv'
TOLERANCE_USD = Decimal(1)
# Geostat tables display thousand USD to one decimal and footnote that totals can differ from sums through rounding.
GEOSTAT_DISPLAY_HALF_UNIT = Decimal(50)
GEOSTAT_ROUNDING_NOTE = 'Geostat footnote: totals and sums can differ through rounding (display unit 0.1 thousand USD).'
# REMM vs REMC: larger than any observed publisher difference (about 0.0001%), far below one missing month (about 8%).
REMM_RELATIVE_BOUND = Decimal('0.00001')
FAMILY_FILES = {'money_transfers': 'money-transfers-annual.csv', 'bop': 'bop-annual.csv',
                'fdi_flows': 'fdi-flows-annual.csv', 'fdi_position': 'fdi-position-annual.csv'}
RECONCILIATION_FIELDS = ('check', 'family', 'dimension', 'year', 'flow', 'item_id', 'expected_usd', 'actual_usd', 'difference_usd', 'tolerance_usd', 'result', 'note')
SHARE_FIELDS = ('year', 'indicator_id', 'share_of_gdp_percent', 'numerator_usd', 'gdp_usd', 'numerator_ref', 'gdp_ref')
SHARES = {  # indicator -> (family, dimension, item_id, flow)
    'current_account_balance': ('bop', 'bop_bpm6', 'current_account', 'net'),
    'personal_transfers_credit': ('bop', 'bop_bpm6', 'personal_transfers', 'credit'),
    'money_transfers_inflow': ('money_transfers', 'total', 'total', 'inflow'),
    'fdi_geostat_total': ('fdi_flows', 'total', 'total', 'inflow'),
}

def csv_bytes(rows: list[dict], fields: tuple) -> bytes:
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction='ignore', lineterminator='\n')
    writer.writeheader(); writer.writerows(rows)
    return output.getvalue().encode('utf-8-sig')

def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode('utf-8')

def read_csv(path: Path) -> list[dict]:
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))

def number(row: dict | None) -> Decimal | None:
    return Decimal(row['value_usd']) if row and row['value_status'] == 'numeric' else None

class Checks:
    def __init__(self):
        self.rows = []

    def compare(self, check, family, dimension, year, flow, item_id, expected, actual, note='', precision=Decimal(0)):
        """Pass within USD 1, or within the stored rounding of the compared values when that is coarser."""
        tolerance = max(TOLERANCE_USD, precision)
        difference = actual - expected
        result = 'pass' if abs(difference) <= tolerance else 'fail'
        self.rows.append(dict(check=check, family=family, dimension=dimension, year=year, flow=flow, item_id=item_id,
                              expected_usd=expected, actual_usd=actual, difference_usd=difference, tolerance_usd=tolerance, result=result, note=note))

    def report(self, check, family, dimension, year, flow, item_id, expected, actual, note):
        """Cross-publisher comparison: recorded, never forced to agree."""
        self.rows.append(dict(check=check, family=family, dimension=dimension, year=year, flow=flow, item_id=item_id,
                              expected_usd=expected, actual_usd=actual, difference_usd=actual - expected, tolerance_usd='', result='reported', note=note))

def index(rows: list[dict]) -> dict:
    found = {}
    for row in rows:
        key = (row['family'], row['dimension'], row['item_id'], row['year'], row['flow'], row['source_sheet'])
        if key in found: raise ValueError(f'duplicate_key: {key}')
        found[key] = row
    return found

def tree_checks(checks: Checks, rows: list[dict], family: str, dimension: str) -> None:
    """Every parent equals the sum of its published children; a year with no published breakdown is skipped."""
    by_year = defaultdict(list)
    for row in rows:
        if row['family'] == family and row['dimension'] == dimension: by_year[(row['year'], row['flow'], row['source_sheet'])].append(row)
    for (year, flow, _), members in sorted(by_year.items()):
        children = defaultdict(list)
        for row in members: children[row['parent_id']].append(row)
        for parent in members:
            kids = children.get(parent['item_id'])
            if not kids: continue
            if all(number(k) is None for k in kids):
                continue  # no breakdown published for this year (e.g. regions before they were split)
            value = sum((number(k) or Decimal(0)) for k in kids)
            note = 'Not-applicable children count as absent, not zero.' if any(k['value_status'] != 'numeric' for k in kids) else ''
            if number(parent) is None:
                raise ValueError(f'reconciliation: {parent["item_id"]} {year} is not applicable but has numeric children')
            checks.compare(f'{family}.{dimension}.children', family, dimension, year, flow, parent['item_id'], number(parent), value, note,
                           parent['_precision'] + sum(k['_precision'] for k in kids))

def bop_checks(checks: Checks, rows: list[dict]) -> None:
    get = lambda item, year, flow, sheet='BOP–BPM6(short)': number(rows.get(('bop', 'bop_bpm6', item, year, flow, sheet)))
    years = sorted({k[3] for k in rows if k[0] == 'bop'})
    for year in years:
        for item in ('current_account', 'goods_and_services', 'goods', 'services', 'primary_income', 'secondary_income', 'capital_account'):
            checks.compare('bop.net_is_credit_minus_debit', 'bop', 'bop_bpm6', year, 'net', item, get(item, year, 'credit') - get(item, year, 'debit'), get(item, year, 'net'))
        for item in ('compensation_of_employees', 'personal_transfers', 'workers_remittances'):
            checks.compare('bop.net_is_credit_minus_debit', 'bop', 'bop_bpm6', year, 'net', item, get(item, year, 'credit', 'BOP–BPM6') - get(item, year, 'debit', 'BOP–BPM6'), get(item, year, 'net', 'BOP–BPM6'))
        for item in ('direct_investment', 'portfolio_investment', 'financial_derivatives', 'other_investment'):
            checks.compare('bop.net_is_assets_minus_liabilities', 'bop', 'bop_bpm6', year, 'net', item, get(item, year, 'assets') - get(item, year, 'liabilities'), get(item, year, 'net'))
        parts = sum(get(i, year, 'net') for i in ('goods_and_services', 'primary_income', 'secondary_income'))
        checks.compare('bop.current_account_parts', 'bop', 'bop_bpm6', year, 'net', 'current_account', get('current_account', year, 'net'), parts)
        checks.compare('bop.goods_and_services_parts', 'bop', 'bop_bpm6', year, 'net', 'goods_and_services', get('goods_and_services', year, 'net'), get('goods', year, 'net') + get('services', year, 'net'))
        checks.compare('bop.net_lending', 'bop', 'bop_bpm6', year, 'net', 'net_lending_borrowing', get('current_account', year, 'net') + get('capital_account', year, 'net'), get('net_lending_borrowing', year, 'net'))
        financial = sum(get(i, year, 'net') for i in ('direct_investment', 'portfolio_investment', 'financial_derivatives', 'other_investment', 'reserve_assets'))
        checks.compare('bop.financial_account_parts', 'bop', 'bop_bpm6', year, 'net', 'financial_account', get('financial_account', year, 'net'), financial)
        checks.compare('bop.errors_and_omissions', 'bop', 'bop_bpm6', year, 'net', 'net_errors_and_omissions', get('financial_account', year, 'net') - get('net_lending_borrowing', year, 'net'), get('net_errors_and_omissions', year, 'net'))
        detail = lambda item: get(item, year, 'liabilities', 'BOP–BPM6')
        checks.compare('bop.direct_investment_liabilities_detail', 'bop', 'bop_bpm6', year, 'liabilities', 'direct_investment_liabilities', get('direct_investment', year, 'liabilities'), detail('direct_investment_liabilities'))
        checks.compare('bop.direct_investment_liabilities_components', 'bop', 'bop_bpm6', year, 'liabilities', 'direct_investment_liabilities', detail('direct_investment_liabilities'),
                       detail('direct_investment_liabilities_equity') + detail('direct_investment_liabilities_reinvested_earnings') + detail('direct_investment_liabilities_debt'))

def fdi_checks(checks: Checks, rows: list[dict], indexed: dict, quarters: dict) -> None:
    for row in rows:
        if row['family'] == 'fdi_flows' and row['dimension'] == 'total' and int(row['year']) in quarters:
            value, precision = quarters[int(row['year'])]
            checks.compare('fdi_flows.quarters_sum_to_annual_total', 'fdi_flows', 'total', row['year'], 'inflow', 'total', number(row), value, '', precision + row['_precision'])
    for dimension in ('country', 'sector', 'component', 'region'):
        tree_checks(checks, rows, 'fdi_flows', dimension)
    for dimension in ('country', 'sector'):
        tree_checks(checks, rows, 'fdi_position', dimension)
    total_rows = {(r['year'], r['dimension']): r for r in rows if r['family'] == 'fdi_flows' and r['item_id'] == 'total'}
    totals = {key: number(row) for key, row in total_rows.items()}
    for (year, dimension), value in sorted(totals.items()):
        if dimension != 'total':
            checks.compare('fdi_flows.table_total_matches_annual_total', 'fdi_flows', dimension, year, 'inflow', 'total', totals[(year, 'total')], value,
                           GEOSTAT_ROUNDING_NOTE, max(GEOSTAT_DISPLAY_HALF_UNIT, total_rows[(year, 'total')]['_precision'] + total_rows[(year, dimension)]['_precision']))
    positions = {(r['year'], r['dimension']): number(r) for r in rows if r['family'] == 'fdi_position' and r['item_id'] == 'total'}
    for year in sorted({y for y, _ in positions}):
        checks.compare('fdi_position.country_total_matches_sector_total', 'fdi_position', 'sector', year, 'position_end_of_year', 'total', positions[(year, 'country')], positions[(year, 'sector')])
    bpm6 = {(r['year'], r['item_id']): number(r) for r in rows if r['dimension'] == 'bpm6'}
    for year in sorted({y for y, _ in bpm6}):
        checks.compare('fdi_flows.bpm6_balance_is_assets_minus_liabilities', 'fdi_flows', 'bpm6', year, 'net', 'balance', bpm6[(year, 'assets')] - bpm6[(year, 'liabilities')], bpm6[(year, 'balance')])
        nbg = number(indexed.get(('bop', 'bop_bpm6', 'direct_investment', year, 'liabilities', 'BOP–BPM6(short)')))
        checks.compare('fdi_flows.bpm6_liabilities_match_nbg_bop', 'fdi_flows', 'bpm6', year, 'net', 'liabilities', nbg, bpm6[(year, 'liabilities')],
                       'Same compiler (NBG); a difference would mean the two files are different vintages.')
        if (year, 'total') in totals:
            checks.report('fdi.geostat_total_vs_nbg_liabilities', 'fdi_flows', 'total', year, 'inflow', 'total', nbg, totals[(year, 'total')],
                          'Geostat FDI total against NBG BoP direct-investment liabilities; reported, never forced to agree.')

def transfer_checks(checks: Checks, rows: list[dict], remm: dict) -> None:
    groups = defaultdict(list)
    for row in rows:
        if row['family'] == 'money_transfers': groups[(row['year'], row['flow'])].append(row)
    for (year, flow), members in sorted(groups.items()):
        total = next(r for r in members if r['role'] == 'total')
        parts = [r for r in members if r['role'] != 'total']
        incomplete = sum(1 for r in parts if r['value_status'] == 'partial_months')
        note = f'{incomplete} countries have blank months; blanks count as absent.' if incomplete else ''
        checks.compare('money_transfers.countries_sum_to_total', 'money_transfers', 'country', year, flow, 'total', number(total), sum((Decimal(r['value_usd']) for r in parts if r['value_usd']), Decimal(0)), note,
                       total['_precision'] + sum(r['_precision'] for r in parts))
        published, ref, precision = remm.get((int(year), flow), (None, '', Decimal(0)))
        if published is not None:
            difference = number(total) - published
            allowed = max(precision + total['_precision'], abs(published) * REMM_RELATIVE_BOUND)
            checks.rows.append(dict(check='money_transfers.monthly_sum_matches_remm_annual_total', family='money_transfers', dimension='total', year=year, flow=flow, item_id='total',
                                    expected_usd=published, actual_usd=number(total), difference_usd=difference, tolerance_usd=allowed,
                                    result='reported' if abs(difference) <= allowed else 'fail',
                                    note=f'REMM {ref}: a second NBG table, used only as a check; small differences are reported, a missing month would fail.'))
        elif (int(year), flow) not in remm:
            checks.rows.append(dict(check='money_transfers.monthly_sum_matches_remm_annual_total', family='money_transfers', dimension='total', year=year, flow=flow, item_id='total',
                                    expected_usd='', actual_usd=number(total), difference_usd='', tolerance_usd='', result='not_published', note='REMM has no column for this year; REMC monthly sum only.'))

def shares_of_gdp(indexed: dict) -> tuple[list[dict], str]:
    gdp_rows = [r for r in read_csv(REPO / GDP_FILE) if r['series_id'] == 'nominal_usd']
    gdp = {r['year']: (Decimal(r['value']), r['source_locator']) for r in gdp_rows}
    out = []
    for indicator, (family, dimension, item, flow) in SHARES.items():
        candidates = [(k, v) for k, v in indexed.items() if k[:3] == (family, dimension, item) and k[4] == flow]
        for (_, _, _, year, _, sheet), row in sorted(candidates, key=lambda kv: kv[0][3]):
            value = number(row)
            if value is None or year not in gdp: continue
            share = (value / gdp[year][0] * 100).quantize(Decimal('0.000000000001'))
            out.append(dict(year=year, indicator_id=indicator, share_of_gdp_percent=share, numerator_usd=value, gdp_usd=gdp[year][0],
                            numerator_ref=f'{row["source_file"]}!{sheet}!{row["source_cells"]}', gdp_ref=f'{GDP_FILE}:nominal_usd:{year} ({gdp[year][1]})'))
    return out, hashlib.sha256((REPO / GDP_FILE).read_bytes()).hexdigest()

def prepare(root: Path = ROOT) -> dict[str, bytes]:
    sources = load_verified_sources(root)
    identities = read_csv(root / 'money-transfer-country-identities.csv')
    rows = read_money_transfers(root, sources, identities) + read_bop(root, sources) + read_fdi_flows(root, sources) + read_fdi_positions(root, sources)
    indexed = index(rows)
    checks = Checks()
    transfer_checks(checks, rows, read_remm_totals(root, sources))
    bop_checks(checks, indexed)
    fdi_checks(checks, rows, indexed, read_fdi_quarter_sums(root, sources))
    failures = [c for c in checks.rows if c['result'] == 'fail']
    shares, gdp_sha = shares_of_gdp(indexed)
    artifacts = {}
    order = lambda r: (r['dimension'], r['item_id'], int(r['year']), r['flow'], r['source_sheet'])
    for family, name in FAMILY_FILES.items():
        artifacts[name] = csv_bytes(sorted((r for r in rows if r['family'] == family), key=order), FIELDS)
    artifacts['shares-of-gdp-annual.csv'] = csv_bytes(shares, SHARE_FIELDS)
    artifacts['prepared-reconciliation.csv'] = csv_bytes(checks.rows, RECONCILIATION_FIELDS)
    counts = defaultdict(lambda: defaultdict(int))
    for row in rows: counts[f'{row["family"]}.{row["dimension"]}'][row['value_status']] += 1
    summary = {
        'observations': len(rows), 'status_counts': {k: dict(v) for k, v in sorted(counts.items())},
        'years': {f: [min(int(r['year']) for r in rows if r['family'] == f), max(int(r['year']) for r in rows if r['family'] == f)] for f in FAMILY_FILES},
        'checks': {result: sum(1 for c in checks.rows if c['result'] == result) for result in ('pass', 'fail', 'reported', 'not_published')},
        'failed_checks': [f'{c["check"]} {c["dimension"]} {c["year"]} {c["flow"]} {c["item_id"]}: {c["difference_usd"]}' for c in failures],
        'input_sha256': {'official/full-source-manifest.json': hashlib.sha256((root / 'official' / 'full-source-manifest.json').read_bytes()).hexdigest(),
                         'money-transfer-country-identities.csv': hashlib.sha256((root / 'money-transfer-country-identities.csv').read_bytes()).hexdigest(),
                         GDP_FILE: gdp_sha},
    }
    artifacts['prepared-validation.json'] = json_bytes(summary)
    manifest = [dict(file=n, rows=data.decode('utf-8-sig').count('\n') - 1 if n.endswith('.csv') else '', sha256=hashlib.sha256(data).hexdigest(), bytes=len(data)) for n, data in sorted(artifacts.items())]
    artifacts['artifact-manifest.csv'] = csv_bytes(manifest, ('file', 'rows', 'sha256', 'bytes'))
    if failures: raise ValueError('reconciliation: ' + '; '.join(summary['failed_checks'][:10]))
    return artifacts

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true'); mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    artifacts = prepare()
    for name, data in artifacts.items():
        path = ROOT / name
        if args.write: path.write_bytes(data)
        elif not path.exists() or path.read_bytes() != data:
            raise SystemExit(f'artifact_mismatch: {name} differs from a fresh preparation')
    if args.check: check_independent_evidence(artifacts)
    print(json.loads(artifacts['prepared-validation.json'])['checks'])
    return 0

def check_independent_evidence(artifacts: dict[str, bytes]) -> None:
    """The independent report must have passed on exactly these prepared files and the current verifier."""
    evidence = json.loads((ROOT / 'independent-verification.json').read_text(encoding='utf-8'))
    current = {name: hashlib.sha256(artifacts[name]).hexdigest() for name in FAMILY_FILES.values()}
    verifier = hashlib.sha256((ROOT / 'verify_independent.py').read_bytes()).hexdigest()
    if evidence['result'] != 'pass' or evidence['input_artifact_sha256'] != current or evidence['verifier_sha256'] != verifier:
        raise SystemExit('artifact_mismatch: independent verification is missing, failed or stale; run verify_independent.py')

if __name__ == '__main__':
    sys.exit(main())
