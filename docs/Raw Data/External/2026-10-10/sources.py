"""Frozen source capture and the reviewed table layouts it is read through."""
from datetime import date, timedelta
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import unicodedata
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
OFFICIAL = ROOT / 'official'
# Reuse the Trade package's stored-decimal XLSX reader rather than keeping a second copy. It is loaded
# by path so that the Trade package's other modules (prepare.py, verify_independent.py) never shadow ours.
_spec = importlib.util.spec_from_file_location('archive', ROOT.parents[1] / 'Trade' / 'geostat-external-trade' / '2026-10-07' / 'archive.py')
archive = importlib.util.module_from_spec(_spec); sys.modules['archive'] = archive; _spec.loader.exec_module(archive)
Cell, read_stored_sheet = archive.Cell, archive.read_stored_sheet

FROZEN_MANIFEST_SHA256 = 'b5651bf663195c0d9070c6595b1bde3ffa12ecc813171ecccdb9a7c0f0c07860'
LAST_COMPLETE_YEAR = 2025
EMPTY = Cell(None, '', 'n', 'General')
SCALE = {'usd': Decimal(1), 'thousand_usd': Decimal(1000), 'million_usd': Decimal(1000000)}

# Publication vintage per workbook: Geostat's own "Last update" footer, NBG's statistics-API updateDate.
VINTAGE = {
    'FDI_Eng-countries.xlsx': '2026-08-17', 'FDI_Eng-sectors-NACE-2.xlsx': '2026-08-17',
    'FDI_Eng-components.xlsx': '2026-08-17', 'FDI_Eng_regions.xlsx': '2026-08-17',
    'FDI_Eng_by_Quarters.xlsx': '2026-09-08', 'FDI_Eng_bpm6.xlsx': '2026-09-30',
    'FDI_Eng_stocks-countries.xlsx': '2026-09-08', 'FDI_Eng_stocks-sectors.xlsx': '2026-09-08',
    'BOP-6_bopbpm6eng.xlsx': '2026-09-30', 'REMC_money-transfers-by-countries-eng.xlsx': '2026-09-15',
    'REMM_money-transfers-by-months-eng.xlsx': '2026-09-15',
}

def load_verified_sources(root: Path = ROOT) -> dict[str, dict]:
    raw = (root / 'official' / 'full-source-manifest.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != FROZEN_MANIFEST_SHA256:
        raise ValueError('source_inventory: frozen 28-file capture manifest differs')
    records = json.loads(raw)['files']
    if len(records) != 28 or len({r['local_filename'] for r in records}) != 28:
        raise ValueError('source_inventory: expected 28 distinct files')
    for record in records:
        path = (root / 'official' / record['local_path']).resolve()
        if not path.is_relative_to((root / 'official').resolve()):
            raise ValueError('source_inventory: path outside capture')
        data = path.read_bytes()
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError(f'source_fingerprint: {record["local_filename"]}')
        if path.suffix == '.xlsx':
            with ZipFile(path) as archive:
                if archive.testzip() is not None:
                    raise ValueError(f'source_fingerprint: corrupt ZIP {path.name}')
    return {r['local_filename']: r for r in records}

def sheet(root: Path, sources: dict, filename: str, name: str) -> dict[str, Cell]:
    return read_stored_sheet(root / 'official' / sources[filename]['local_path'], name)

def col(index: int) -> str:
    letters = ''
    while index:
        index, rest = divmod(index - 1, 26)
        letters = chr(65 + rest) + letters
    return letters

def text(cells: dict, ref: str) -> str:
    value = cells.get(ref, EMPTY).value
    return '' if value is None else str(value).strip()

def max_row(cells: dict) -> int:
    return max(int(re.sub(r'[A-Z]+', '', ref)) for ref in cells)

def max_col(cells: dict) -> int:
    def number(letters):
        n = 0
        for ch in letters: n = n * 26 + ord(ch) - 64
        return n
    return max(number(re.sub(r'\d+', '', ref)) for ref in cells)

def excel_date(cell: Cell) -> date | None:
    """Header dates: stored serial numbers, 'DD.MM.YYYY' or 'M/D/YYYY' text, or NBG's 'YYYY_M' month labels."""
    value = cell.value
    if isinstance(value, Decimal):
        return date(1899, 12, 30) + timedelta(days=int(value))
    if isinstance(value, str):
        if m := re.fullmatch(r'(\d\d)\.(\d\d)\.(\d{4})', value.strip()):
            return date(int(m[3]), int(m[2]), int(m[1]))
        if m := re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})', value.strip()):
            return date(int(m[3]), int(m[1]), int(m[2]))
        if m := re.fullmatch(r'(\d{4})_(\d{1,2})', value.strip()):
            return date(int(m[1]), int(m[2]), 1)
    return None

def annual_year(cell: Cell) -> int | None:
    """A complete annual column/row header: a plain year, never an asterisked preliminary one."""
    value = cell.value
    if isinstance(value, Decimal) and value == value.to_integral_value() and 1990 <= value <= LAST_COMPLETE_YEAR:
        return int(value)
    return None

def value_fields(cell: Cell, unit: str) -> dict[str, str]:
    value = cell.value
    if value is None:
        return {'source_value': '', 'value_status': 'blank', 'value_usd': ''}
    if value == '-':
        return {'source_value': '-', 'value_status': 'not_applicable', 'value_usd': ''}
    if isinstance(value, Decimal) and cell.native_type == 'n' and value.is_finite():
        return {'source_value': cell.raw_token, 'value_status': 'numeric', 'value_usd': str(value * SCALE[unit])}
    raise ValueError(f'cell_type: unexpected value cell {value!r}')

def slug(label: str) -> str:
    value = label.lower().replace('&', ' and ').replace("'", '')
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    value = re.sub(r'[^a-z0-9]+', '_', value).strip('_')
    if not value: raise ValueError(f'identity: label has no ASCII identifier {label!r}')
    return value

def geostat_vintage(cells: dict, filename: str) -> str:
    """Read Geostat's 'Last update:' footer and require the reviewed vintage."""
    found = [text(cells, f'A{r + 1}') for r in range(1, max_row(cells) + 1) if text(cells, f'A{r}').startswith('Last update')]
    expected = VINTAGE[filename]
    if [f'{d[8:]}.{d[5:7]}.{d[:4]}' for d in [expected]] != found:
        raise ValueError(f'source_layout: publication vintage differs in {filename}: {found}')
    return expected

def stored_precision_usd(token: str, unit: str) -> Decimal:
    """Half a unit of the last stored digit: the most a value can differ from what the publisher rounded it from."""
    if not token: return Decimal(0)
    exponent = Decimal(token).as_tuple().exponent
    return Decimal(5).scaleb(exponent - 1) * SCALE[unit]
