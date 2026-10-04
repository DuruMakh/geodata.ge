"""Compare the saved data with a separate Excel reader without changing package files.

Requires openpyxl. Temporary altered-source fixtures stay in the repository's .tmp directory.
"""

from collections import defaultdict
import copy
import csv
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import sys

import openpyxl


root = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(root))
spec = importlib.util.spec_from_file_location('unemployment_prepare', root / 'prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
manifest = json.loads((root / 'source-manifest.json').read_text(encoding='utf-8'))
observations = list(csv.DictReader((root / 'source-observations.csv').open(encoding='utf-8-sig')))
education_observations = list(csv.DictReader((root / 'education-source-observations.csv').open(encoding='utf-8-sig')))
long_term_observations = list(csv.DictReader((root / 'long-term-unemployment-annual.csv').open(encoding='utf-8-sig')))
all_observations = observations + education_observations + long_term_observations
current = list(csv.DictReader((root / 'unemployment-annual.csv').open(encoding='utf-8-sig')))
reader_cells, observation_cells = {}, {}
max_difference = Decimal(0)
for record in manifest:
    if not record['local_file'].endswith('.xlsx'):
        continue
    workbook = openpyxl.load_workbook(root / record['local_file'], data_only=True)
    for sheet in workbook:
        for row in sheet.iter_rows(max_col=33):
            label = ' '.join(str(row[0].value).split())
            extra_labels = {'Primary or Lower Secondary', 'Upper Secondary', 'Vocational', 'Higher', 'No education', 'Total',
                            'Number of long-term unemployed', 'Long-term unemployment rate',
                            'Share of long-term unemployed in unemployed persons (%)',
                            'Share of long-term unemployeds in unemployed persons (%)'}
            labels = module.INDICATORS if record['source_id'] in module.LAYOUTS else extra_labels
            if label not in labels:
                continue
            for cell in row[1:]:
                if isinstance(cell.value, (int, float)):
                    reader_cells[(record['source_id'], sheet.title, cell.coordinate)] = (cell.value, label, cell.number_format)
for row in all_observations:
    key = row['source_id'], row['source_sheet'], row['source_cell']
    assert key not in observation_cells, key
    observation_cells[key] = row
    original, label, number_format = reader_cells[key]
    difference = abs(Decimal(row['value']) - Decimal(str(original)))
    assert difference <= Decimal('0.000000001'), (key, difference)
    max_difference = max(max_difference, difference)
    if row['source_id'] == 'geostat_lfs_annual_education':
        assert row['source_group_label'] == label
    else:
        assert row['source_label'] == label
    assert row['source_number_format'] == number_format
    assert Decimal(row['published_value']) == Decimal(str(original)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
assert set(reader_cells) == set(observation_cells), 'Uncaptured or unexpected source data cells'
assert len(reader_cells) == 7073

coverage = defaultdict(set)
for row in current:
    year = int(row['year'])
    assert 2010 <= year <= 2025
    assert row['frequency'] == 'annual' and row['methodology_epoch'] == 'ilo19_20'
    assert row['role'] == 'primary' and row['group_id'] != 'georgia' or row['dimension'] == 'national'
    coverage[(row['dimension'], year)].add(row['group_id'])
direct_regions = {v[0] for k, v in module.REGIONS.items() if k not in ('Georgia', 'Imereti**', 'The remaining regions***')}
early_regions = {'region.kakheti', 'region.tbilisi', 'region.shida_kartli', 'region.kvemo_kartli',
                 'region.adjara', 'region.samegrelo_zemo_svaneti',
                 'region.imereti_racha_lechkhumi_kvemo_svaneti',
                 'region.samtskhe_javakheti_guria_mtskheta_mtianeti'}
middle_regions = (early_regions - {'region.samtskhe_javakheti_guria_mtskheta_mtianeti'}) | {
    'region.samtskhe_javakheti', 'region.guria', 'region.mtskheta_mtianeti'}
for year in range(2010, 2026):
    assert coverage[('national', year)] == {'georgia'}
    assert coverage[('sex', year)] == {'women', 'men'}
    assert coverage[('settlement', year)] == {'urban', 'rural'}
    width = 10 if year < 2020 else 5
    expected_ages = {'age.' + str(start) + '_' + str(start + width - 1) for start in range(15, 65, width)} | {'age.65_plus'}
    assert coverage[('age', year)] == expected_ages
    expected_regions = early_regions if year <= 2016 else middle_regions if year <= 2018 else direct_regions
    assert coverage[('region', year)] == expected_regions

test_results = []
def passed(name):
    test_results.append({'test': name, 'passed': True})

numeric_observations = [{**r, 'year': int(r['year'])} for r in observations]
try:
    module.validate(numeric_observations + [numeric_observations[0]], manifest)
except ValueError as error:
    assert 'Duplicate observation' in str(error)
else:
    raise AssertionError('Duplicate record accepted')
passed('duplicate_observation_rejected')

missing = copy.deepcopy(numeric_observations)
next(r for r in missing if r['dimension'] == 'national' and r['year'] == 2025 and r['indicator_id'] == 'unemployed')['value'] = ''
_, _, failures, gaps = module.validate(missing, manifest)
assert failures and len(gaps) == 1
passed('blank_value_remains_missing_and_fails_validation')

wrong_rate = copy.deepcopy(numeric_observations)
next(r for r in wrong_rate if r['dimension'] == 'national' and r['year'] == 2025 and r['indicator_id'] == 'unemployment_rate')['value'] = '14.9'
_, _, failures, _ = module.validate(wrong_rate, manifest)
assert any(f['check'] == 'unemployment_rate' for f in failures)
passed('incorrect_unemployment_rate_rejected')

zero_denominator = copy.deepcopy(numeric_observations)
next(r for r in zero_denominator if r['dimension'] == 'national' and r['year'] == 2025 and r['indicator_id'] == 'labour_force')['value'] = '0'
_, _, failures, _ = module.validate(zero_denominator, manifest)
assert any(f['check'] == 'positive_denominator' for f in failures)
passed('zero_labour_force_denominator_rejected')

record = manifest[0]
blank_rows = []
module.add_observation(blank_rows, record, 'national', 'georgia', 'Georgia', 2025, 'Unemployed', None, 'AC10', 'Georgia')
assert blank_rows[0]['value'] == '' and blank_rows[0]['source_cell'] == 'AC10'
passed('blank_source_cell_is_not_converted_to_zero')
for value in (Decimal(-1), Decimal(101)):
    try:
        module.add_observation([], record, 'national', 'georgia', 'Georgia', 2025, 'Unemployment rate, percentage',
                               {'value': value, 'format': '0.0'}, 'AC12', 'Georgia')
    except ValueError as error:
        assert 'Invalid value' in str(error)
    else:
        raise AssertionError('Out-of-range rate accepted')
passed('negative_and_over_100_rates_rejected')

workspace_tmp = root.parents[3] / '.tmp'
assert workspace_tmp.resolve().is_relative_to(root.parents[3])
workspace_tmp.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=workspace_tmp, prefix='unemployment-negative-') as directory:
    temporary = Path(directory).resolve()
    assert temporary.is_relative_to(workspace_tmp.resolve())
    (temporary / 'source-manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    capture = temporary / record['local_file']
    capture.parent.mkdir()
    capture.write_bytes((root / record['local_file']).read_bytes() + b'altered')
    module.ROOT = temporary
    try:
        module.build()
    except ValueError as error:
        assert 'Source hash or size mismatch' in str(error)
    else:
        raise AssertionError('Altered capture accepted')
    finally:
        module.ROOT = root
passed('altered_original_capture_rejected')

_, _, failures, gaps = module.validate(numeric_observations, manifest)
assert not failures and not gaps
assert any(Decimal(r['value']) == 0 for r in observations)
passed('published_zero_values_are_preserved_and_accepted')

for path in root.glob('*.csv'):
    assert path.read_bytes().startswith(b'\xef\xbb\xbf'), path.name
report = {
    'status': 'passed', 'verified_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    'reader': 'openpyxl ' + openpyxl.__version__ + ' (read only; independent of the XML extraction)',
    'source_cells_compared': len(reader_cells), 'omitted_numeric_indicator_cells': 0,
    'core_source_cells_compared': len(observations),
    'education_source_cells_compared': len(education_observations),
    'long_term_source_cells_compared': len(long_term_observations),
    'max_decimal_difference_from_float_reader': str(max_difference),
    'float_reader_tolerance': '0.000000001',
    'published_precision_matches': len(reader_cells), 'year_classifications_checked': 16,
    'csv_utf8_bom_checks': len(list(root.glob('*.csv'))),
    'negative_and_zero_tests': test_results,
    'artifact_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest().upper()
                        for p in sorted(root.glob('*.csv'))},
}
print(json.dumps(report, indent=2))
