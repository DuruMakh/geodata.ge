"""Coverage and money controls; unresolved publisher disagreements stay failed."""
from collections import Counter,defaultdict
from decimal import Decimal
import csv
import json
from pathlib import Path
from model import SCALES,check_coverage,numeric_usd,source_key
from read_goods import derive_goods
from read_products import compare_hs_parents,resolve_source_exceptions
from read_regions_services import comparison,sum_available,region_comparisons,services_comparisons

ROOT=Path(__file__).resolve().parent
RECONCILIATION_FIELDS=('check','family','flow','year','item_id','expected_usd','actual_usd','difference_usd','tolerance_usd','status','source_refs','evidence')

def validate_units(rows: list[dict]) -> None:
    for row in rows:
        if row['source_unit'] not in SCALES: raise ValueError('unit_conversion: unknown native unit')
        status=row['value_status']
        if status=='numeric':
            if row['source_value'] in ('','-') or not row['value_usd'] or not Decimal(row['source_value']).is_finite() or Decimal(row['value_usd'])!=Decimal(row['source_value'])*SCALES[row['source_unit']]:
                raise ValueError('unit_conversion: normalized USD differs from exact native value')
        elif status in ('blank','not_applicable'):
            if row['value_usd'] or row['source_value']!=('' if status=='blank' else '-'):
                raise ValueError('missingness: unavailable source became a numeric amount')
        else: raise ValueError('missingness: unknown source status')

def reviewed_pairs(identities: list[dict]) -> set[tuple]:
    return {(r['left_source_id'],r['left_identity'],r['right_source_id'],r['right_identity']) for r in identities if r['family'].startswith('reexports_') and r['disposition']=='verified_equivalent'}

def derivation_bindings(rows: list[dict],identities: list[dict]) -> dict:
    bindings={}
    national={r['year']:r for r in rows if r['family']=='goods_national' and r['flow']=='export' and r['role']=='total' and r['geography_id']=='georgia' and r['item_id']=='goods.total' and numeric_usd(r) is not None}
    imports={r['year']:r for r in rows if r['family']=='goods_national' and r['flow']=='import' and r['role']=='total' and r['geography_id']=='georgia' and r['item_id']=='goods.total' and numeric_usd(r) is not None}
    def bind(indicator,dimension,left,right):
        key=(left['year'],dimension,left['item_id'],indicator)
        if key in bindings: raise ValueError('duplicate_key: ambiguous derived source binding')
        bindings[key]=(source_key(left),source_key(right))
    for year in national.keys()&imports.keys():
        for indicator in ('trade_balance','trade_turnover'): bind(indicator,'national',national[year],imports[year])
    reviewed=defaultdict(list)
    for review in identities:
        if review['family'] in ('reexports_national','reexports_country','reexports_product') and review['disposition']=='verified_equivalent': reviewed[(review['right_source_id'],review['right_identity'])].append(review)
    exports={}
    for left in rows:
        if left['flow']=='export' and numeric_usd(left) is not None: exports[(left['year'],left['source_id'],left['item_id'])]=left
    for right in rows:
        if right['family']!='goods_domestic' or right['flow']!='domestic_export' or numeric_usd(right) is None: continue
        for review in reviewed[(right['source_id'],right['item_id'])]:
            if not int(review['first_year'])<=int(right['year'])<=int(review['last_year']): continue
            left=exports.get((right['year'],review['left_source_id'],review['left_identity']))
            if left is None: continue
            if right['role']=='total' and right['dimension']=='country' and right['geography_id']==left['geography_id']=='georgia' and right['item_id']==left['item_id']=='goods.total' and left['family']=='goods_national' and left['role']=='total': dimension='national'
            elif right['role']==left['role']=='detail' and right['dimension']=='country' and left['family']=='goods_countries' and right['partner_code'] and right['partner_code']==left['partner_code']: dimension='country'
            elif right['role']==left['role']=='detail' and right['dimension']=='product' and left['family']=='goods_products' and right['classification']==left['classification']=='hs4' and right['product_code'] and right['product_code']==left['product_code']: dimension='product'
            else: continue
            if review['family']=='reexports_'+dimension: bind('reexports',dimension,left,right)
    return bindings

def validate_derivations(derived: list[dict],rows: list[dict],identities: list[dict] | None=None) -> None:
    if identities is None:
        with (ROOT/'identity-review.csv').open(encoding='utf-8-sig',newline='') as stream: identities=list(csv.DictReader(stream))
    expected=derivation_bindings(rows,identities)
    lookup={source_key(r):r for r in rows}
    keys=set()
    for row in derived:
        key=tuple(row[f] for f in ('year','dimension','item_id','indicator_id'))
        if key in keys: raise ValueError('duplicate_key: derived series repeated')
        keys.add(key)
        if any(row.get(field)!=value for field,value in (('domain','goods'),('role','derived'),('value_status','numeric'),('publication_status','unspecified'))): raise ValueError('derived_inputs: meaning or status outside approved scope')
        refs=json.loads(row['input_source_refs'])
        if len(refs)!=2 or any(tuple(ref) not in lookup for ref in refs): raise ValueError('derived_inputs: source reference missing')
        if key not in expected or tuple(tuple(ref) for ref in refs)!=expected[key]: raise ValueError('derived_inputs: indicator, identity or reviewed source counterpart differs')
        left,right=(lookup[tuple(ref)] for ref in refs)
        if left['year']!=right['year'] or row['year']!=left['year'] or numeric_usd(left) is None or numeric_usd(right) is None:
            raise ValueError('derived_inputs: incompatible or unavailable inputs')
        indicator=row['indicator_id']
        if indicator not in ('trade_balance','trade_turnover','reexports'): raise ValueError('derived_inputs: indicator outside scope')
        wanted=numeric_usd(left)+numeric_usd(right) if indicator=='trade_turnover' else numeric_usd(left)-numeric_usd(right)
        if Decimal(row['value_usd'])!=wanted: raise ValueError('derived_inputs: formula or input order differs')
    if keys!=set(expected): raise ValueError('coverage: approved derivations omitted')

def validate_observations(rows: list[dict],inventory: dict,identities: list[dict]) -> dict:
    coverage=check_coverage(rows,inventory)
    validate_units(rows)
    series=set()
    for r in rows:
        key=tuple(r[f] for f in ('family','flow','year','source_id','source_sheet','source_block','item_id','dimension','geography_id','partner_code','source_group_id','classification','product_code','group_id','service_id'))
        if key in series: raise ValueError('duplicate_key: prepared series repeated')
        series.add(key)
    checks=[]; grouped=defaultdict(list)
    national={(r['flow'],r['year']):r for r in rows if r['family']=='goods_national'}
    domestic={(r['flow'],r['year']):r for r in rows if r['family']=='goods_domestic' and r['dimension']=='country' and r['role']=='total'}
    for row in rows: grouped[(row['source_id'],row['source_sheet'],row['flow'],row['year'])].append(row)
    for key,members in sorted(grouped.items()):
        family=members[0]['family']; flow=members[0]['flow']; year=members[0]['year']
        if family in ('goods_countries','goods_products','goods_domestic'):
            total=next(r for r in members if r['role']=='total')
            leaves=[r for r in members if r['role'] in ('detail','residual')]
            checks.append(comparison('published_detail_sum',total,sum_available(leaves),leaves,'Only numeric leaves and explicit residuals are summed; source missingness is retained.'))
            anchor=domestic[(flow,year)] if family=='goods_domestic' else national[(flow,year)]
            if source_key(anchor)!=source_key(total):
                checks.append(comparison('published_total_matches_anchor',anchor,numeric_usd(total),[total],'Same-year matching domain/unit total; alternative representations are not added.'))
            for subtotal in [r for r in members if r['role']=='subtotal' and r['source_group_id']]:
                subleaves=[r for r in leaves if r['source_group_id']==subtotal['source_group_id']]
                checks.append(comparison('country_section_sum',subtotal,sum_available(subleaves),subleaves,'Publisher-defined section membership only; no current membership is inferred.'))
        elif family=='goods_country_groups':
            total=next(r for r in members if r['role']=='total')
            checks.append(comparison('group_table_total_matches_national',national[(flow,year)],numeric_usd(total),[total],'Overlapping groups are not summed as components of the national total.'))
        elif family=='goods_regions':
            total=next(r for r in members if r['geography_id']=='georgia' and r['item_id']=='goods.total')
            checks.append(comparison('regional_grand_matches_national',national[(flow,year)],numeric_usd(total),[total],'Registered-address regional grand total including Unknown.'))
    for (flow,year),total in sorted(domestic.items()):
        exported=national[('export',year)]
        check=comparison('domestic_not_exceed_exports',exported,numeric_usd(total),[total],'Domestic exports are a subset; this is an inequality, not an equality.')
        check['status']='pass' if numeric_usd(total)>=0 and numeric_usd(total)<=numeric_usd(exported)+1 else 'fail'
        checks.append(check)
    tables=json.loads((ROOT/'source-layouts.json').read_text(encoding='utf-8'))
    pairs={(six['source_id'],four['source_id']) for six in tables for four in tables if six['family']==four['family']=='goods_products' and six['flow']==four['flow'] and six['rows'][0]['dimensions']['classification']=='hs6' and four['rows'][0]['dimensions']['classification']=='hs4' and set(six['year_columns'])&set(four['year_columns'])}
    parents,controls=resolve_source_exceptions(compare_hs_parents(rows,pairs),rows,json.loads((ROOT/'source-comparison-exceptions.json').read_text(encoding='utf-8')))
    checks.extend(parents); checks.extend(controls)
    checks.extend(region_comparisons(rows)); checks.extend(services_comparisons(rows))
    known=json.loads((ROOT/'unresolved-source-issues.json').read_text(encoding='utf-8'))['issues']
    known_by_key={tuple(r[f] for f in ('check','flow','year','item_id')):r for r in known}
    failures=[r for r in checks if r['status']=='fail']
    if {tuple(r[f] for f in ('check','flow','year','item_id')) for r in failures}!=set(known_by_key):
        raise ValueError('source_arithmetic: unexpected failure or changed source issue inventory')
    for failure in failures:
        expected=known_by_key[tuple(failure[f] for f in ('check','flow','year','item_id'))]
        if Decimal(failure['difference_usd'])!=Decimal(expected['difference_usd']) or {tuple(ref) for ref in json.loads(failure['source_refs'])}!={tuple(ref) for ref in json.loads(expected['source_refs'])}:
            raise ValueError('source_arithmetic: unresolved discrepancy changed')
    derived=derive_goods(rows,reviewed_pairs(identities)); validate_derivations(derived,rows,identities)
    return dict(status='requires_source_resolution' if failures else 'accepted',source_observations=len(rows),coverage=coverage,family_counts=dict(Counter(r['family'] for r in rows)),value_status_counts=dict(Counter(r['value_status'] for r in rows)),reconciliation_status_counts=dict(Counter(r['status'] for r in checks)),unresolved_source_issues=failures,derived_observations=len(derived),reconciliations=checks,derived=derived)
