"""Separate openpyxl source walk; never imports normalizer readers/helpers."""
import argparse
import csv
from collections import Counter, defaultdict
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import re
from zipfile import ZipFile
import openpyxl

ROOT=Path(__file__).resolve().parent
METADATA_FIELDS=('family','geography_id','partner_code','partner_label_en','source_group_id','source_group_label_en','classification','classification_level','product_code','product_label_en','dimension','group_id','group_label_en','geography_label_en','attribution_basis','service_id','service_label_en','year','flow','item_id','source_unit','value_status','publication_status','role','source_block','source_id','source_sheet','source_cell','source_label','source_number_format')
PRIMARY_COMMON=('year','flow','item_id','value_usd','source_value','source_unit','value_status','publication_status','role','source_block','source_id','source_sheet','source_cell','source_label','source_number_format')
PRIMARY_DIMENSIONS={
    'goods_national':('geography_id',),
    'goods_countries':('partner_code','partner_label_en','source_group_id','source_group_label_en'),
    'goods_products':('classification','classification_level','product_code','product_label_en'),
    'goods_domestic':('dimension','geography_id','partner_code','partner_label_en','classification','classification_level','product_code','product_label_en'),
    'goods_country_groups':('group_id','group_label_en'),
    'goods_regions':('geography_id','geography_label_en','classification','classification_level','product_code','product_label_en','attribution_basis'),
    'services':('dimension','partner_code','partner_label_en','service_id','service_label_en'),
}

def digest(values):
    return hashlib.sha256(json.dumps(sorted(values),ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest()

def independent_code(value,classification):
    if classification=='sitc4':
        number=Decimal(str(value))
        return f'{number:05.1f}'
    width={'hs4':4,'hs6':6,'sitc1':1,'bec1':1}.get(classification,3)
    text=str(int(value)) if isinstance(value,(int,float)) else str(value).strip()
    return text.zfill(width)

def verify_fingerprint(path: Path,descriptor: dict) -> None:
    data=path.read_bytes()
    if len(data)!=descriptor['bytes'] or hashlib.sha256(data).hexdigest()!=descriptor['sha256']:
        raise ValueError(f'source_fingerprint: independent {descriptor["source_id"]}')

def compare_record(prepared: dict,metadata: dict,native,fields=None) -> Decimal:
    selected=METADATA_FIELDS if fields is None else tuple(f for f in fields if f not in ('value_usd','source_value'))
    if not set(selected+('source_value','value_usd')).issubset(prepared): raise ValueError('source_metadata: independent required columns omitted')
    if prepared.get('source_unit')!=metadata['source_unit']: raise ValueError('unit_conversion: independent native unit differs')
    if prepared.get('value_status')!=metadata['value_status']: raise ValueError('missingness: independent source status differs')
    for field in selected:
        if prepared.get(field,'')!=metadata.get(field,''): raise ValueError(f'source_metadata: independent {field} differs {metadata["source_cell"]}')
    if metadata['value_status']!='numeric':
        expected='' if metadata['value_status']=='blank' else '-'
        if prepared['source_value']!=expected or prepared['value_usd']!='': raise ValueError('missingness: unavailable source value became numeric')
        return Decimal(0)
    scale=Decimal(1_000_000) if metadata['source_unit']=='million_usd' else Decimal(1000)
    source=Decimal(prepared['source_value']); usd=Decimal(prepared['value_usd'])
    if not source.is_finite() or not usd.is_finite() or source*scale!=usd: raise ValueError('unit_conversion: exact native/USD identity fails')
    difference=abs(Decimal(str(native))*scale-usd)
    if difference>Decimal('0.001'): raise ValueError(f'source_value: independent source differs by USD {difference}')
    return difference

def compare_primary_record(prepared: dict,metadata: dict,native) -> Decimal:
    required=PRIMARY_DIMENSIONS[metadata['family']]+PRIMARY_COMMON
    if tuple(prepared)!=required: raise ValueError('artifact_schema: primary columns differ from fixed family contract')
    return compare_record(prepared,metadata,native,required)

def verify_derivations(derived: list[dict],sources: list[dict],identities: list[dict]) -> int:
    # Establish every eligible binding from source metadata and reviewed periods,
    # independently of the normalizer's generator and validation helpers.
    source_index={(r['year'],r['flow'],r['source_id'],r['item_id']):r for r in sources}
    national={}
    expected={}
    def record(indicator,dimension,left,right):
        key=(left['year'],dimension,left['item_id'],indicator)
        if key in expected: raise ValueError('duplicate_key: independent ambiguous derived binding')
        expected[key]=(tuple(left[f] for f in ('source_id','source_sheet','source_cell')),tuple(right[f] for f in ('source_id','source_sheet','source_cell')))
    for row in sources:
        if row['family']=='goods_national' and row['role']=='total' and row['geography_id']=='georgia' and row['item_id']=='goods.total' and row['value_status']=='numeric': national[(row['year'],row['flow'])]=row
    for (year,flow),left in national.items():
        right=national.get((year,'import'))
        if flow=='export' and right is not None:
            record('trade_balance','national',left,right);record('trade_turnover','national',left,right)
    for review in identities:
        if review['disposition']!='verified_equivalent' or review['family'] not in ('reexports_national','reexports_country','reexports_product'): continue
        dimension=review['family'].removeprefix('reexports_')
        for year in range(int(review['first_year']),int(review['last_year'])+1):
            left=source_index.get((str(year),'export',review['left_source_id'],review['left_identity']))
            right=source_index.get((str(year),'domestic_export',review['right_source_id'],review['right_identity']))
            if left is None or right is None or left['value_status']!='numeric' or right['value_status']!='numeric' or right['family']!='goods_domestic': continue
            if dimension=='national': eligible=left['family']=='goods_national' and left['role']==right['role']=='total' and left['geography_id']==right['geography_id']=='georgia' and left['item_id']==right['item_id']=='goods.total' and right['dimension']=='country'
            elif dimension=='country': eligible=left['family']=='goods_countries' and left['role']==right['role']=='detail' and right['dimension']=='country' and bool(left['partner_code']) and left['partner_code']==right['partner_code']
            else: eligible=left['family']=='goods_products' and left['role']==right['role']=='detail' and right['dimension']=='product' and left['classification']==right['classification']=='hs4' and bool(left['product_code']) and left['product_code']==right['product_code']
            if eligible: record('reexports',dimension,left,right)
    lookup={tuple(r[f] for f in ('source_id','source_sheet','source_cell')):r for r in sources}
    seen=set()
    for row in derived:
        key=tuple(row[f] for f in ('year','dimension','item_id','indicator_id'))
        if key in seen: raise ValueError('duplicate_key: independent derived key repeats')
        seen.add(key)
        if any(row.get(field)!=value for field,value in (('domain','goods'),('role','derived'),('value_status','numeric'),('publication_status','unspecified'))): raise ValueError('derived_inputs: independent meaning or status differs')
        refs=tuple(tuple(ref) for ref in json.loads(row['input_source_refs']))
        if key not in expected or refs!=expected[key]: raise ValueError('derived_inputs: independent indicator, identity or reviewed period differs')
        left,right=(lookup[ref] for ref in refs)
        wanted=Decimal(left['value_usd'])+Decimal(right['value_usd']) if row['indicator_id']=='trade_turnover' else Decimal(left['value_usd'])-Decimal(right['value_usd'])
        if wanted!=Decimal(row['value_usd']): raise ValueError('derived_inputs: independent arithmetic differs')
    if seen!=set(expected): raise ValueError('coverage: independent approved derivations omitted')
    return len(seen)

def check_inventory(rows: list[dict],inventory: dict) -> dict:
    groups=defaultdict(list); keys=set()
    for row in rows:
        source_key=tuple(row[f] for f in ('source_id','source_sheet','source_cell'))
        if source_key in keys: raise ValueError('duplicate_key: independent source key repeated')
        keys.add(source_key)
        key=tuple(row[f] for f in ('source_id','source_sheet','source_block','family','flow','year'))
        groups[key].append(row)
    expected={tuple(b[f] for f in ('source_id','source_sheet','source_block','family','flow','year')):b for b in inventory['blocks']}
    if set(groups)!=set(expected): raise ValueError('coverage: independent whole block/year differs')
    for key,members in groups.items():
        block=expected[key]
        if len(members)!=block['source_key_count'] or digest([tuple(r[f] for f in ('source_id','source_sheet','source_cell')) for r in members])!=block['key_sha256'] or digest([sorted({f:r.get(f,'') for f in METADATA_FIELDS}.items()) for r in members])!=block['metadata_sha256'] or dict(Counter(r['value_status'] for r in members))!=block['status_counts']:
            raise ValueError(f'coverage: independent source inventory differs {key}')
    return {'matched_observations':len(rows),'matched_blocks':len(groups)}

def walk_sources(package_root: Path):
    manifest=json.loads((package_root/'full-source-manifest.json').read_text(encoding='utf-8'))
    if len(manifest)!=45 or len({r['source_id'] for r in manifest})!=45:
        raise ValueError('source_inventory: independent source count')
    tables=json.loads((package_root/'source-layouts.json').read_text(encoding='utf-8'))
    by_source=defaultdict(list)
    for table in tables: by_source[table['source_id']].append(table)
    for source in manifest:
        path=package_root/source['local_file']
        verify_fingerprint(path,source)
        if path.suffix!='.xlsx': continue
        with ZipFile(path) as zipped:
            if zipped.testzip() is not None: raise ValueError('source_fingerprint: independent ZIP check')
        book=openpyxl.load_workbook(path,read_only=True,data_only=True)
        try:
            for table in by_source[source['source_id']]:
                if table['source_sheet'] not in book.sheetnames: raise ValueError('source_layout: independent exact sheet')
                sheet=book[table['source_sheet']]
                needed={cell['cell'] for row in table['rows'] for cell in row['label_cells']+row['code_cells']}
                needed.update(h['cell'] for h in table['header_cells'])
                needed.update(f'{col}{r["row_index"]}' for r in table['rows'] for col in table['year_columns'].values())
                cells={c.coordinate:c for row in sheet.iter_rows() for c in row if getattr(c,'coordinate',None) in needed}
                unit_text=str(cells['A3'].value)
                actual_unit='million_usd' if 'Mill.' in unit_text else 'thousand_usd' if 'Thsd.' in unit_text else None
                if actual_unit!=table['source_unit']: raise ValueError('unit_conversion: original workbook unit header differs')
                for expected in table['header_cells']+[c for row in table['rows'] for c in row['label_cells']+row['code_cells']]:
                    cell=cells.get(expected['cell'])
                    text='' if cell is None or cell.value is None else str(cell.value)
                    fmt='General' if cell is None else cell.number_format
                    if text!=expected['value'] or fmt!=expected['format']:
                        raise ValueError(f'source_layout: independent metadata {source["source_id"]}:{expected["cell"]}')
                for row in table['rows']:
                    dimensions=dict(row['dimensions'])
                    if row['code_cells']:
                        native=cells[row['code_cells'][0]['cell']].value
                        if dimensions.get('classification'):
                            code=independent_code(native,dimensions['classification'])
                            if code!=dimensions['product_code']: raise ValueError('source_layout: independent product identity')
                            dimensions['product_code']=code
                        elif 'partner_code' in dimensions:
                            code=independent_code(native,'country')
                            if code!=dimensions['partner_code']: raise ValueError('source_layout: independent partner identity')
                            dimensions['partner_code']=code
                    label=' | '.join('' if cells.get(c['cell']) is None or cells[c['cell']].value is None else str(cells[c['cell']].value) for c in row['label_cells'])
                    for year,column in table['year_columns'].items():
                        coordinate=f'{column}{row["row_index"]}'; cell=cells.get(coordinate)
                        value=None if cell is None else cell.value
                        status='blank' if value is None else 'not_applicable' if value=='-' else 'numeric' if isinstance(value,(int,float)) and not isinstance(value,bool) else 'invalid'
                        if status=='invalid': raise ValueError('cell_type: independent monetary type')
                        metadata=dict(dimensions,family=table['family'],year=year,flow=table['flow'],item_id=row['item_id'],source_block=table['source_block'],source_id=source['source_id'],source_sheet=table['source_sheet'],source_cell=coordinate,source_unit=actual_unit,source_label=label,source_number_format='General' if cell is None else cell.number_format,value_status=status,publication_status='unspecified',role=row['role'])
                        yield {field:metadata.get(field,'') for field in METADATA_FIELDS},value
        finally:
            book.close()

def capture_inventory(package_root: Path) -> dict:
    groups=defaultdict(list)
    for row,value in walk_sources(package_root):
        key=tuple(row[f] for f in ('source_id','source_sheet','source_block','family','flow','year'))
        groups[key].append(row)
    blocks=[]
    for key,rows in sorted(groups.items()):
        block=dict(zip(('source_id','source_sheet','source_block','family','flow','year'),key))
        block.update(source_key_count=len(rows),key_sha256=digest([(r['source_id'],r['source_sheet'],r['source_cell']) for r in rows]),metadata_sha256=digest([sorted(r.items()) for r in rows]),identity_count=len({r['item_id'] for r in rows}),status_counts=dict(Counter(r['value_status'] for r in rows)))
        blocks.append(block)
    return {'full_manifest_sha256':hashlib.sha256((package_root/'full-source-manifest.json').read_bytes()).hexdigest(),'layout_sha256':hashlib.sha256((package_root/'source-layouts.json').read_bytes()).hexdigest(),'source_count':45,'workbook_count':31,'table_count':len(json.loads((package_root/'source-layouts.json').read_text(encoding='utf-8'))),'observation_count':sum(g['source_key_count'] for g in blocks),'blocks':blocks}

def read_csv(path: Path):
    csv.field_size_limit(50_000_000)
    if not path.read_bytes().startswith(b'\xef\xbb\xbf'): raise ValueError('artifact_mismatch: CSV lacks UTF-8 BOM')
    with path.open(encoding='utf-8-sig',newline='') as stream:
        yield from csv.DictReader(stream)

def verify_package(package_root: Path) -> dict:
    inventory=json.loads((package_root/'expected-observation-inventory.json').read_text(encoding='utf-8'))
    for name,key in [('full-source-manifest.json','full_manifest_sha256'),('source-layouts.json','layout_sha256')]:
        if hashlib.sha256((package_root/name).read_bytes()).hexdigest()!=inventory[key]: raise ValueError('source_inventory: independent reviewed input differs')
    manifest=list(read_csv(package_root/'artifact-manifest.csv'))
    inputs={}
    for entry in manifest:
        if entry['file']=='independent-verification.json': continue
        path=package_root/entry['file']; data=path.read_bytes()
        if hashlib.sha256(data).hexdigest()!=entry['sha256'] or len(data)!=int(entry['bytes']): raise ValueError('artifact_mismatch: independent artifact fingerprint')
        inputs[entry['file']]=entry['sha256']
    prepared={}; metadata=[]
    for name in sorted(n for n in inputs if n.startswith('source-observations/')):
        for row in read_csv(package_root/name):
            key=tuple(row[f] for f in ('source_id','source_sheet','source_cell'))
            if key in prepared: raise ValueError('duplicate_key: independent prepared cell repeats')
            prepared[key]=row;metadata.append({f:row.get(f,'') for f in METADATA_FIELDS})
    coverage=check_inventory(metadata,inventory)
    maximum=Decimal(0); matched=set(); primary_keys=set()
    native_lookup={}
    for expected,native in walk_sources(package_root):
        key=tuple(expected[f] for f in ('source_id','source_sheet','source_cell'))
        if key in matched or key not in prepared: raise ValueError('coverage: independent raw/prepared key sets differ')
        difference=compare_record(prepared[key],expected,native)
        maximum=max(maximum,difference);matched.add(key);native_lookup[key]=(expected,native)
        if expected['role']!='supporting': primary_keys.add(key)
    if matched!=set(prepared): raise ValueError('coverage: unmatched prepared cells remain')
    # Check all primary CSV values/dimensions against the independent source walk.
    seen_primary=set()
    primary_files=[name for name in inputs if name.startswith('goods-products-annual/') or name in ('goods-national-annual.csv','goods-countries-annual.csv','goods-domestic-annual.csv','goods-country-groups-annual.csv','goods-regions-annual.csv','services-annual.csv')]
    for name in primary_files:
        for row in read_csv(package_root/name):
            key=tuple(row[f] for f in ('source_id','source_sheet','source_cell'))
            if key in seen_primary or key not in primary_keys: raise ValueError('duplicate_key: primary cell repeated or unsupported')
            expected,native=native_lookup[key]
            compare_primary_record(row,expected,native);seen_primary.add(key)
    if seen_primary!=primary_keys: raise ValueError('coverage: primary family CSV cells omitted')
    identities=list(read_csv(package_root/'identity-review.csv'))
    derived_count=verify_derivations(list(read_csv(package_root/'derived-annual.csv')),list(prepared.values()),identities)
    return dict(status='source_cells_matched',coverage=coverage,source_observations=len(matched),primary_observations=len(seen_primary),derived_observations=derived_count,max_reader_difference_usd=str(maximum),reader_tolerance_usd='0.001',input_artifact_sha256=inputs,verifier_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),source_acceptance='requires_source_resolution: two UK country/type conflicts; this reader check does not resolve publisher inconsistencies')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--capture-inventory',action='store_true');args=parser.parse_args()
    if args.capture_inventory:
        path=ROOT/'expected-observation-inventory.json'
        if path.exists(): raise ValueError('source_inventory: capture already exists; review changes explicitly')
        result=capture_inventory(ROOT);path.write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    else:
        result=verify_package(ROOT)
        data=(json.dumps(result,ensure_ascii=False,indent=2,sort_keys=True)+'\n').encode('utf-8');(ROOT/'independent-verification.json').write_bytes(data)
        rows=[r for r in read_csv(ROOT/'artifact-manifest.csv') if r['file']!='independent-verification.json']
        rows.append(dict(file='independent-verification.json',family='evidence',source_block='',row_count='',sha256=hashlib.sha256(data).hexdigest(),bytes=str(len(data))))
        output=io.StringIO(newline='');writer=csv.DictWriter(output,fieldnames=('file','family','source_block','row_count','sha256','bytes'),lineterminator='\n');writer.writeheader();writer.writerows(sorted(rows,key=lambda r:r['file']));(ROOT/'artifact-manifest.csv').write_bytes(output.getvalue().encode('utf-8-sig'))
    print(json.dumps({k:v for k,v in result.items() if k not in ('blocks','input_artifact_sha256')},indent=2))

if __name__=='__main__':
    main()
