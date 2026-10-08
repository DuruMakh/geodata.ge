"""Verify the frozen capture and read original XLSX decimal tokens offline."""
from collections import defaultdict
import csv
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

FROZEN_MANIFEST_SHA256 = 'c9b273fefe788c04240dc353cef46d9dbcc046a5294cfc498591c6e53cb189b2'
NS = {'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
FORMATS = {0:'General',1:'0',2:'0.00',3:'#,##0',4:'#,##0.00',9:'0%',10:'0.00%',11:'0.00E+00',12:'# ?/?',13:'# ??/??',14:'mm-dd-yy',15:'d-mmm-yy',16:'d-mmm',17:'mmm-yy',18:'h:mm AM/PM',19:'h:mm:ss AM/PM',20:'h:mm',21:'h:mm:ss',22:'m/d/yy h:mm',37:'#,##0 ;(#,##0)',38:'#,##0 ;[Red](#,##0)',39:'#,##0.00;(#,##0.00)',40:'#,##0.00;[Red](#,##0.00)',45:'mm:ss',46:'[h]:mm:ss',47:'mmss.0',48:'##0.0E+0',49:'@'}

@dataclass(frozen=True,slots=True)
class Cell:
    value: Decimal | str | None
    raw_token: str
    native_type: str
    number_format: str

def load_verified_sources(package_root: Path) -> dict[str,dict]:
    raw=(package_root/'full-source-manifest.json').read_bytes()
    records=json.loads(raw)
    ids=[r['source_id'] for r in records]
    if len(records)!=45 or len(set(ids))!=45 or sum(r['local_file'].endswith('.xlsx') for r in records)!=31 or hashlib.sha256(raw).hexdigest()!=FROZEN_MANIFEST_SHA256:
        raise ValueError('source_inventory: frozen 45-source capture differs')
    with (package_root/'full-source-manifest.csv').open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream); fields=reader.fieldnames; counterpart=list(reader)
    if len(counterpart)!=45 or {r['source_id'] for r in counterpart}!=set(ids):
        raise ValueError('source_inventory: manifest CSV differs')
    by_id={r['source_id']:r for r in counterpart}
    for record in records:
        if any(by_id[record['source_id']][f] != str(record.get(f,'')) for f in fields):
            raise ValueError('source_inventory: manifest CSV/JSON parity')
        path=(package_root/record['local_file']).resolve()
        if not path.is_relative_to(package_root.resolve()):
            raise ValueError('source_inventory: path outside capture')
        data=path.read_bytes()
        if len(data)!=record['bytes'] or hashlib.sha256(data).hexdigest()!=record['sha256']:
            raise ValueError(f'source_fingerprint: {record["source_id"]}')
        if path.suffix=='.xlsx':
            with ZipFile(path) as archive:
                if archive.testzip() is not None:
                    raise ValueError(f'source_fingerprint: corrupt ZIP {path.name}')
    return {r['source_id']:r for r in records}

def read_stored_sheet(path: Path,sheet_name: str) -> dict[str,Cell]:
    with ZipFile(path) as archive:
        book=ET.fromstring(archive.read('xl/workbook.xml'))
        sheets=[s for s in book.findall('x:sheets/x:sheet',NS) if s.get('name')==sheet_name]
        if len(sheets)!=1: raise ValueError(f'source_layout: exact sheet {sheet_name!r} absent in {path.name}')
        rid=sheets[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        rels=ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target=next(r.get('Target') for r in rels if r.get('Id')==rid)
        location=target.lstrip('/') if target.startswith('/') else 'xl/'+target
        strings=[]
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings=[''.join(t.text or '' for t in item.findall('.//x:t',NS)) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('x:si',NS)]
        styles=ET.fromstring(archive.read('xl/styles.xml'))
        formats=dict(FORMATS)
        formats.update({int(f.get('numFmtId')):f.get('formatCode') for f in styles.findall('x:numFmts/x:numFmt',NS)})
        style_formats=[formats.get(int(s.get('numFmtId')),f'unsupported:{s.get("numFmtId")}') for s in styles.findall('x:cellXfs/x:xf',NS)]
        cells={}
        for c in ET.fromstring(archive.read(location)).findall('x:sheetData/x:row/x:c',NS):
            kind=c.get('t','n'); v=c.find('x:v',NS); token='' if v is None or v.text is None else v.text
            if kind=='s': value=strings[int(token)] if token else None
            elif kind=='inlineStr': value=''.join(t.text or '' for t in c.findall('.//x:t',NS))
            elif kind=='n': value=Decimal(token) if token else None
            elif kind=='str': value=token or None
            else: value=token or None
            cells[c.get('r')]=Cell(value,token,kind,style_formats[int(c.get('s','0'))])
    return cells

def validate_layouts(sources: dict,layouts: list[dict],package_root: Path) -> None:
    tables=defaultdict(list)
    for table in layouts:
        tables[(table['source_id'],table['source_sheet'])].append(table)
    for (source_id,sheet),group in tables.items():
        cells=read_stored_sheet(package_root/sources[source_id]['local_file'],sheet)
        assigned=set(); excluded=set(); columns=set()
        for table in group:
            columns.update(table['year_columns'].values())
            for row in table['rows']:
                if row['row_index'] in assigned: raise ValueError('source_layout: duplicate assigned row')
                assigned.add(row['row_index'])
            excluded.update(r['row_index'] for r in table['excluded_rows'])
            snapshots=table['header_cells']+[c for row in table['rows'] for c in row['label_cells']+row['code_cells']]
            for expected in snapshots:
                cell=cells.get(expected['cell'],Cell(None,'','n','General'))
                actual='' if cell.value is None else str(cell.value)
                if isinstance(cell.value,Decimal):
                    try: same=abs(cell.value-Decimal(expected['value']))<=Decimal('0.0000000001')
                    except InvalidOperation: same=False
                    same=same and actual==expected.get('stored_value',actual)
                else: same=actual==expected['value']
                if not same or cell.number_format!=expected['format']:
                    raise ValueError(f'source_layout: changed label/code/header {source_id}:{sheet}:{expected["cell"]}')
        for coordinate,cell in cells.items():
            column,index=re.fullmatch(r'([A-Z]+)(\d+)',coordinate).groups(); index=int(index)
            if index>=5 and column in columns and (isinstance(cell.value,Decimal) or cell.value=='-') and index not in assigned and index not in excluded:
                raise ValueError(f'source_layout: unassigned annual data {source_id}:{sheet}:{coordinate}')
        # Exclusions may contain separators/footers, never unexplained annual numbers.
        for index in excluded-assigned:
            if any(isinstance(cells.get(f'{c}{index}',Cell(None,'','n','General')).value,Decimal) or cells.get(f'{c}{index}',Cell(None,'','n','General')).value=='-' for c in columns):
                if not all('sub-annual' in r['reason'] for table in group for r in table['excluded_rows'] if r['row_index']==index):
                    raise ValueError(f'source_layout: excluded annual data row {index}')

def load_layouts(sources: dict,package_root: Path) -> list[dict]:
    raw=(package_root/'source-layouts.json').read_bytes()
    inventory_path=package_root/'expected-observation-inventory.json'
    if inventory_path.exists():
        inventory=json.loads(inventory_path.read_text(encoding='utf-8'))
        if hashlib.sha256(raw).hexdigest()!=inventory['layout_sha256']:
            raise ValueError('source_layout: reviewed layout fingerprint differs')
    layouts=json.loads(raw)
    if {t['source_id'] for t in layouts}!={sid for sid,r in sources.items() if r['local_file'].endswith('.xlsx')}:
        raise ValueError('source_layout: a workbook is missing')
    validate_layouts(sources,layouts,package_root)
    return layouts
