"""Source-faithful string records and exact monetary conversion."""
from decimal import Decimal, getcontext
from collections import Counter,defaultdict
import hashlib
import json
import re
from archive import Cell, read_stored_sheet

getcontext().prec=50
Observation=dict[str,str]
COMMON=('year','flow','item_id','value_usd','source_value','source_unit','value_status','publication_status','role','source_block','source_id','source_sheet','source_cell','source_label','source_number_format')
DIMENSIONS={
 'goods_national':('geography_id',),
 'goods_countries':('partner_code','partner_label_en','source_group_id','source_group_label_en'),
 'goods_products':('classification','classification_level','product_code','product_label_en'),
 'goods_domestic':('dimension','geography_id','partner_code','partner_label_en','classification','classification_level','product_code','product_label_en'),
 'goods_country_groups':('group_id','group_label_en'),
 'goods_regions':('geography_id','geography_label_en','classification','classification_level','product_code','product_label_en','attribution_basis'),
 'services':('dimension','partner_code','partner_label_en','service_id','service_label_en'),
}
ALL_FIELDS=tuple(dict.fromkeys(('family',)+tuple(f for fields in DIMENSIONS.values() for f in fields)+COMMON))
METADATA_FIELDS=tuple(f for f in ALL_FIELDS if f not in ('value_usd','source_value'))
SCALES={'million_usd':Decimal(1000000),'thousand_usd':Decimal(1000)}

def value_fields(cell: Cell,unit: str) -> dict[str,str]:
    value=cell.value
    if value is None: status='blank'; native=usd=''
    elif value=='-': status='not_applicable'; native='-'; usd=''
    elif isinstance(value,Decimal) and cell.native_type=='n' and value.is_finite():
        status='numeric'; native=cell.raw_token or str(value); usd=str(value*SCALES[unit])
    else: raise ValueError(f'cell_type: unexpected monetary cell {value!r} ({cell.native_type})')
    return {'source_value':native,'source_unit':unit,'value_status':status,'value_usd':usd}

def numeric_usd(row: Observation) -> Decimal | None:
    return Decimal(row['value_usd']) if row['value_status']=='numeric' else None

def product_code(cell: Cell,classification: str) -> str:
    if classification=='sitc4':
        value=Decimal(str(cell.value))
        if abs(value-value.quantize(Decimal('0.1')))>Decimal('0.0000000001'): raise ValueError('source_layout: non-four-digit SITC code')
        return str(value.quantize(Decimal('0.1'))).zfill(5)
    width={'hs4':4,'hs6':6,'sitc1':1,'bec1':1}[classification]
    if isinstance(cell.value,Decimal):
        if cell.value!=cell.value.to_integral_value(): raise ValueError('source_layout: fractional product code')
        value=str(int(cell.value)).zfill(width)
    else: value=str(cell.value).strip().zfill(width)
    if not re.fullmatch(r'\d{'+str(width)+'}',value): raise ValueError('source_layout: invalid product code')
    return value

def extract_layouts(sources: dict,layouts: list[dict],package_root,families: set[str]) -> list[Observation]:
    observations=[]
    for table in layouts:
        if table['family'] not in families: continue
        cells=read_stored_sheet(package_root/sources[table['source_id']]['local_file'],table['source_sheet'])
        for spec in table['rows']:
            dims=spec['dimensions']
            if spec['code_cells'] and dims.get('classification'):
                coordinate=spec['code_cells'][0]['cell']
                if product_code(cells[coordinate],dims['classification'])!=dims.get('product_code'):
                    raise ValueError('source_layout: frozen product identity differs')
            label=' | '.join(c['value'] for c in spec['label_cells'])
            for year,column in table['year_columns'].items():
                coordinate=f'{column}{spec["row_index"]}'
                cell=cells.get(coordinate,Cell(None,'','n','General'))
                row=dict.fromkeys(ALL_FIELDS,'')
                row.update(dims)
                row.update(family=table['family'],year=year,flow=table['flow'],item_id=spec['item_id'],publication_status='unspecified',role=spec['role'],source_block=table['source_block'],source_id=table['source_id'],source_sheet=table['source_sheet'],source_cell=coordinate,source_label=label,source_number_format=cell.number_format)
                row.update(value_fields(cell,table['source_unit']))
                observations.append(row)
    return observations

def source_key(row: Observation) -> tuple:
    return tuple(row[f] for f in ('source_id','source_sheet','source_cell'))

def check_coverage(rows: list[Observation],inventory: dict,families: set[str] | None=None) -> dict:
    def digest(values):
        return hashlib.sha256(json.dumps(sorted(values),ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest()
    selected=rows if families is None else [r for r in rows if r['family'] in families]
    keys=[source_key(r) for r in selected]
    if len(set(keys))!=len(keys): raise ValueError('duplicate_key: source observation repeated')
    groups=defaultdict(list)
    for row in selected:
        key=tuple(row[f] for f in ('source_id','source_sheet','source_block','family','flow','year'))
        groups[key].append(row)
    expected={tuple(b[f] for f in ('source_id','source_sheet','source_block','family','flow','year')):b for b in inventory['blocks'] if families is None or b['family'] in families}
    if set(groups)!=set(expected): raise ValueError('coverage: whole source block/year omitted or invented')
    for key,group in groups.items():
        block=expected[key]
        metadata=[sorted({f:r.get(f,'') for f in METADATA_FIELDS}.items()) for r in group]
        if len(group)!=block['source_key_count'] or digest([source_key(r) for r in group])!=block['key_sha256'] or digest(metadata)!=block['metadata_sha256'] or dict(Counter(r['value_status'] for r in group))!=block['status_counts']:
            raise ValueError(f'coverage: source keys or metadata differ {key}')
    return {'matched_observations':len(selected),'matched_blocks':len(groups)}
