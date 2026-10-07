"""Published goods classifications; historical blocks stay distinct."""
from collections import defaultdict
from decimal import Decimal
import json
from model import Observation,extract_layouts,numeric_usd,source_key

def read_products(sources: dict,layouts: list[dict],package_root) -> list[Observation]:
    return extract_layouts(sources,layouts,package_root,{'goods_products'})

def compare_hs_parents(rows: list[Observation],compatible_pairs: set[tuple]) -> list[dict]:
    parents={}; children=defaultdict(list)
    for row in rows:
        if row['family']!='goods_products' or row['role']!='detail': continue
        if row['classification']=='hs4': parents[(row['flow'],row['year'],row['product_code'])]=row
        elif row['classification']=='hs6': children[(row['flow'],row['year'],row['product_code'][:4])].append(row)
    six_periods={(flow,year) for flow,year,code in children}
    result=[]
    for key in sorted(set(parents)|set(children)):
        flow,year,code=key
        if (flow,year) not in six_periods: continue
        parent=parents.get(key); members=children.get(key,[])
        available=[r for r in members if numeric_usd(r) is not None]
        refs=([source_key(parent)] if parent else [])+[source_key(r) for r in members]
        supported=parent is not None and numeric_usd(parent) is not None and bool(available) and all((r['source_id'],parent['source_id']) in compatible_pairs for r in members)
        expected=numeric_usd(parent) if supported else None
        actual=sum((numeric_usd(r) for r in available),Decimal(0)) if supported else None
        difference=actual-expected if supported else None
        result.append(dict(check='hs6_to_hs4_parent',family='goods_products',flow=flow,year=year,item_id=code,expected_usd='' if expected is None else str(expected),actual_usd='' if actual is None else str(actual),difference_usd='' if difference is None else str(difference),tolerance_usd='1' if supported else '',status=('pass' if abs(difference)<=Decimal(1) else 'fail') if supported else 'not_published',source_refs=json.dumps(refs,ensure_ascii=False,separators=(',',':')),evidence=f'{len(available)} numeric child cells; {len(members)-len(available)} unavailable child cells; same-year prefix comparison; historical source identities retained.' if supported else 'No published numeric counterpart or no reviewed source-period match; no zero is invented.'))
    return result

def resolve_source_exceptions(comparisons: list[dict],rows: list[Observation],registry: dict) -> tuple[list[dict],list[dict]]:
    cases={(c['flow'],c['year'],c['item_id']):c for c in registry['cases']}
    controls={}; result=[]
    for comparison in comparisons:
        key=(comparison['flow'],comparison['year'],comparison['item_id'])
        case=cases.get(key)
        if comparison['status']!='fail' or case is None:
            result.append(comparison); continue
        if Decimal(comparison['difference_usd'])!=Decimal(case['difference_usd']) or {tuple(r) for r in json.loads(comparison['source_refs'])}!={tuple(r) for r in json.loads(case['source_refs'])}:
            raise ValueError('source_arithmetic: reviewed discrepancy evidence changed')
        group=registry['groups'][case['group_id']]
        group_key=(case['group_id'],comparison['flow'],comparison['year'])
        if group_key not in controls:
            members=[r for r in rows if r['family']=='goods_products' and r['role']=='detail' and r['flow']==comparison['flow'] and r['year']==comparison['year'] and r['classification'] in ('hs4','hs6') and r['product_code'][:4] in group['codes']]
            totals={classification:sum((numeric_usd(r) for r in members if r['classification']==classification and numeric_usd(r) is not None),Decimal(0)) for classification in ('hs4','hs6')}
            difference=totals['hs6']-totals['hs4']
            if abs(difference)>1: raise ValueError('source_arithmetic: reviewed code-group subtotal no longer reconciles')
            controls[group_key]=dict(check='source_code_group_subtotal',family='goods_products',flow=comparison['flow'],year=comparison['year'],item_id=case['group_id'],expected_usd=str(totals['hs4']),actual_usd=str(totals['hs6']),difference_usd=str(difference),tolerance_usd='1',status='pass',source_refs=json.dumps([source_key(r) for r in members],ensure_ascii=False,separators=(',',':')),evidence=group['explanation'])
        result.append(dict(comparison,status='source_exception',evidence=case['group_id']+': '+group['explanation']+' Individual prefix discrepancy retained; no code/value remapping and no passing label.'))
    return result,list(controls.values())
