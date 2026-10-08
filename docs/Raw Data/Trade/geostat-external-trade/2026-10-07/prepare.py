"""Offline deterministic research preparation; source acceptance is a separate gate."""
import argparse
from collections import defaultdict
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import archive
from model import ALL_FIELDS,COMMON,DIMENSIONS
from read_goods import read_goods
from read_products import read_products
from read_regions_services import read_regions,read_services
from validation import RECONCILIATION_FIELDS,validate_observations

ROOT=Path(__file__).resolve().parent
MAX_CSV_BYTES=50_000_000
MANIFEST_FIELDS=('file','family','source_block','row_count','sha256','bytes')
DERIVED_FIELDS=('year','domain','dimension','item_id','indicator_id','value_usd','value_status','publication_status','input_source_refs','role')
COVERAGE_FIELDS=('family','flow','source_id','source_sheet','source_block','year','identity_count','numeric_count','blank_count','not_applicable_count','source_key_count','key_sha256')
FAMILY_FILES={'goods_national':'goods-national-annual.csv','goods_countries':'goods-countries-annual.csv','goods_domestic':'goods-domestic-annual.csv','goods_country_groups':'goods-country-groups-annual.csv','goods_regions':'goods-regions-annual.csv','services':'services-annual.csv'}

def csv_bytes(rows: list[dict],fields: tuple) -> bytes:
    output=io.StringIO(newline='')
    writer=csv.DictWriter(output,fieldnames=fields,extrasaction='ignore',lineterminator='\n')
    writer.writeheader(); writer.writerows(rows)
    return output.getvalue().encode('utf-8-sig')

def json_bytes(value: dict) -> bytes:
    return (json.dumps(value,ensure_ascii=False,indent=2,sort_keys=True)+'\n').encode('utf-8')

def chunk_csv(stem: str,rows: list[dict],fields: tuple) -> dict[str,bytes]:
    data=csv_bytes(rows,fields)
    if len(data)<=MAX_CSV_BYTES: return {stem+'.csv':data}
    years=defaultdict(list)
    for row in rows: years[row['year']].append(row)
    chunks={}
    for year,members in sorted(years.items()):
        payload=csv_bytes(members,fields)
        if len(payload)>MAX_CSV_BYTES: raise ValueError(f'artifact_size: whole year {year} exceeds file-handling limit')
        chunks[f'{stem}-{year}.csv']=payload
    return chunks

def manifest_bytes(artifacts: dict[str,bytes]) -> bytes:
    csv.field_size_limit(MAX_CSV_BYTES)
    records=[]
    for name,data in sorted(artifacts.items()):
        if name=='artifact-manifest.csv': continue
        if name.endswith('.csv'):
            count=sum(1 for _ in csv.DictReader(io.StringIO(data.decode('utf-8-sig'))))
        else: count=''
        family='source_observations' if name.startswith('source-observations/') else 'goods_products' if name.startswith('goods-products-annual/') else next((key for key,value in FAMILY_FILES.items() if value==name),'evidence')
        records.append(dict(file=name,family=family,source_block='',row_count=count,sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
    return csv_bytes(records,MANIFEST_FIELDS)

def sync_artifacts(package_root: Path,artifacts: dict[str,bytes],write: bool) -> None:
    expected=set(artifacts)
    for directory in ('goods-products-annual','source-observations'):
        folder=package_root/directory
        actual={p.relative_to(package_root).as_posix() for p in folder.glob('*.csv')} if folder.exists() else set()
        if actual-expected: raise ValueError('artifact_mismatch: stale generated files '+repr(sorted(actual-expected)))
    for name,data in sorted(artifacts.items()):
        path=package_root/name
        if write:
            path.parent.mkdir(parents=True,exist_ok=True)
            if not path.exists() or path.read_bytes()!=data: path.write_bytes(data)
        elif not path.exists() or path.read_bytes()!=data:
            raise ValueError(f'artifact_mismatch: {name}')

def check_independent_evidence(evidence: dict,artifacts: dict[str,bytes]) -> None:
    inputs={name:hashlib.sha256(data).hexdigest() for name,data in artifacts.items() if name not in ('artifact-manifest.csv','independent-verification.json')}
    if evidence.get('input_artifact_sha256')!=inputs:
        raise ValueError('artifact_mismatch: independent evidence is stale for these artifact inputs')

def prepare_package(package_root: Path) -> tuple[list[dict],dict[str,bytes],dict]:
    sources=archive.load_verified_sources(package_root)
    layouts=archive.load_layouts(sources,package_root)
    inventory=json.loads((package_root/'expected-observation-inventory.json').read_text(encoding='utf-8'))
    with (package_root/'identity-review.csv').open(encoding='utf-8-sig',newline='') as stream: identities=list(csv.DictReader(stream))
    rows=read_goods(sources,layouts,package_root)+read_products(sources,layouts,package_root)+read_regions(sources,layouts,package_root)+read_services(sources,layouts,package_root)
    report=validate_observations(rows,inventory,identities)
    artifacts={}
    ordering=lambda r:tuple(r.get(f,'') for f in ('family','flow','year','dimension','geography_id','classification','product_code','partner_code','service_id','role','source_id','source_sheet','source_cell'))
    ordered=sorted(rows,key=ordering)
    primary=[r for r in ordered if r['role']!='supporting']
    for family,name in FAMILY_FILES.items():
        artifacts[name]=csv_bytes([r for r in primary if r['family']==family],DIMENSIONS[family]+COMMON)
    products=defaultdict(list); observed=defaultdict(list)
    sheet_indices={(t['source_id'],t['source_sheet']):t['sheet_index'] for t in layouts}
    for row in primary:
        if row['family']=='goods_products': products[(row['classification'],row['source_block'])].append(row)
    for row in ordered: observed[(row['source_id'],row['source_sheet'],row['source_block'])].append(row)
    for (classification,block),members in sorted(products.items()):
        artifacts.update(chunk_csv(f'goods-products-annual/{classification}-{block}',members,DIMENSIONS['goods_products']+COMMON))
    for (source_id,sheet,block),members in sorted(observed.items()):
        artifacts.update(chunk_csv(f'source-observations/{source_id}-{sheet_indices[(source_id,sheet)]:02d}-{block}',members,ALL_FIELDS))
    coverage=[]
    for block in inventory['blocks']:
        row={f:block.get(f,'') for f in COVERAGE_FIELDS}
        row.update(numeric_count=block['status_counts'].get('numeric',0),blank_count=block['status_counts'].get('blank',0),not_applicable_count=block['status_counts'].get('not_applicable',0));coverage.append(row)
    artifacts['coverage.csv']=csv_bytes(coverage,COVERAGE_FIELDS)
    artifacts['derived-annual.csv']=csv_bytes(report['derived'],DERIVED_FIELDS)
    artifacts['prepared-reconciliation.csv']=csv_bytes(report['reconciliations'],RECONCILIATION_FIELDS)
    summary={k:v for k,v in report.items() if k not in ('reconciliations','derived')}
    summary['primary_observations']=len(primary)
    summary['input_sha256']={name:hashlib.sha256((package_root/name).read_bytes()).hexdigest() for name in ('full-source-manifest.json','source-layouts.json','expected-observation-inventory.json','identity-review.csv','source-limitations.csv','source-comparison-exceptions.json','unresolved-source-issues.json')}
    artifacts['prepared-validation.json']=json_bytes(summary)
    evidence=package_root/'independent-verification.json'
    if evidence.exists(): artifacts['independent-verification.json']=evidence.read_bytes()
    artifacts['artifact-manifest.csv']=manifest_bytes(artifacts)
    return rows,artifacts,summary

def write_or_check(package_root: Path,write: bool) -> dict:
    rows,artifacts,report=prepare_package(package_root)
    sync_artifacts(package_root,artifacts,write)
    evidence=package_root/'independent-verification.json'
    if not write and evidence.exists():
        recorded=json.loads(evidence.read_text(encoding='utf-8'))
        check_independent_evidence(recorded,artifacts)
        if recorded.get('verifier_sha256')!=hashlib.sha256((package_root/'verify_independent.py').read_bytes()).hexdigest():
            raise ValueError('artifact_mismatch: independent evidence predates the current verifier')
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--write',action='store_true');group.add_argument('--check',action='store_true');group.add_argument('--acceptance',action='store_true')
    args=parser.parse_args()
    report=write_or_check(ROOT,args.write)
    print(json.dumps({k:v for k,v in report.items() if k not in ('input_sha256','unresolved_source_issues')},indent=2))
    if report['unresolved_source_issues']:
        print('Source acceptance is held: 2 UK country/type conflicts remain unresolved. Reproduction success is not source acceptance.')
    return 2 if args.acceptance and report['unresolved_source_issues'] else 0

if __name__=='__main__':
    sys.exit(main())
