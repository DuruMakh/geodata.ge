"""National goods, partners, selected domestic exports and overlapping groups."""
import json
from model import Observation,extract_layouts,numeric_usd,source_key

FAMILIES={'goods_national','goods_countries','goods_domestic','goods_country_groups'}

def read_goods(sources: dict,layouts: list[dict],package_root) -> list[Observation]:
    return extract_layouts(sources,layouts,package_root,FAMILIES)

def derive_goods(rows: list[Observation],compatible_pairs: set[tuple]) -> list[dict]:
    output=[]
    def add(indicator,dimension,left,right,value):
        output.append(dict(year=left['year'],domain='goods',dimension=dimension,item_id=left['item_id'],indicator_id=indicator,value_usd=str(value),value_status='numeric',publication_status='unspecified',input_source_refs=json.dumps([list(source_key(left)),list(source_key(right))],ensure_ascii=False,separators=(',',':')),role='derived'))
    national={}
    exports={}
    for row in rows:
        if numeric_usd(row) is None: continue
        if row['family']=='goods_national':
            national[(row['flow'],row['year'])]=row
            if row['flow']=='export': exports[('national',row['year'],'')]=row
        elif row['flow']=='export' and row['role']=='detail':
            if row['family']=='goods_countries' and row['partner_code']:
                exports[('country',row['year'],row['partner_code'])]=row
            elif row['family']=='goods_products' and row['classification']=='hs4':
                exports[('product',row['year'],row['product_code'])]=row
    for (flow,year),left in sorted(national.items()):
        if flow!='export' or ('import',year) not in national: continue
        right=national[('import',year)]
        add('trade_balance','national',left,right,numeric_usd(left)-numeric_usd(right))
        add('trade_turnover','national',left,right,numeric_usd(left)+numeric_usd(right))
    for right in rows:
        if right['family']!='goods_domestic' or numeric_usd(right) is None: continue
        if right['role']=='total' and right['dimension']=='country': dimension='national'; code=''
        elif right['role']=='detail' and right['dimension']=='country' and right['partner_code']: dimension='country'; code=right['partner_code']
        elif right['role']=='detail' and right['dimension']=='product' and right['product_code']: dimension='product'; code=right['product_code']
        else: continue
        left=exports.get((dimension,right['year'],code))
        if left is None: continue
        reviewed=(left['source_id'],left['item_id'],right['source_id'],right['item_id'])
        if reviewed not in compatible_pairs: continue
        add('reexports',dimension,left,right,numeric_usd(left)-numeric_usd(right))
    return sorted(output,key=lambda r:(int(r['year']),r['dimension'],r['item_id'],r['indicator_id']))
