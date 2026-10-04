"""Regression checks for missing annual sections and source captures."""

import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
import prepare


class CoreValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((prepare.ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
        cls.observations = [row for record in cls.manifest if record['source_id'] in prepare.LAYOUTS
                            for row in prepare.extract(record)]

    def test_missing_entire_published_section_is_rejected(self):
        for dimension, year in (('settlement', 2025), ('region', 2025), ('age', 2020)):
            with self.subTest(dimension=dimension, year=year):
                remaining = [row for row in self.observations
                             if (row['dimension'], row['year']) != (dimension, year)]
                _, _, failures, _ = prepare.validate(remaining, self.manifest)
                self.assertTrue(failures, 'An omitted published section must fail validation')

    def test_missing_entire_historical_year_is_rejected(self):
        remaining = [row for row in self.observations if row['year'] != 1999]
        _, _, failures, _ = prepare.validate(remaining, self.manifest)
        self.assertTrue(failures, 'An omitted historical year must fail validation')

    def test_missing_published_employment_component_is_rejected(self):
        remaining = [row for row in self.observations
                     if (row['dimension'], row['year'], row['indicator_id']) != ('national', 2025, 'hired')]
        _, _, failures, _ = prepare.validate(remaining, self.manifest)
        self.assertTrue(failures, 'Omitting a published component must fail validation')

    def test_combined_region_cannot_be_relabelled_as_one_member(self):
        relabelled = [{**row, 'group_id': 'region.imereti'}
                      if row['dimension'] == 'region' and row['year'] == 2018 and
                      row['group_id'] == 'region.imereti_racha_lechkhumi_kvemo_svaneti' else row
                      for row in self.observations]
        _, _, failures, _ = prepare.validate(relabelled, self.manifest)
        self.assertTrue(failures, 'A combined regional value must retain its published group')

    def test_omitted_required_capture_cannot_produce_a_passed_package(self):
        original_root = prepare.ROOT
        scratch = (original_root.parents[3] / '.tmp').resolve()
        self.assertTrue(scratch.is_relative_to(original_root.parents[3].resolve()))
        scratch.mkdir(exist_ok=True)
        for missing in ('geostat_lfs_annual_settlement', 'geostat_lfs_annual_age',
                        'geostat_lfs_annual_region', 'geostat_lfs_metadata_2026'):
            with self.subTest(source_id=missing):
                records = [{**record, 'local_file': str(original_root / record['local_file'])}
                           for record in self.manifest if record['source_id'] != missing]
                with tempfile.TemporaryDirectory(dir=scratch, prefix='unemployment-validation-') as directory:
                    temporary = Path(directory).resolve()
                    self.assertTrue(temporary.is_relative_to(scratch))
                    (temporary / 'source-manifest.json').write_text(json.dumps(records), encoding='utf-8')
                    with patch.object(prepare, 'ROOT', temporary):
                        with self.assertRaises(ValueError):
                            prepare.build()


if __name__ == '__main__':
    unittest.main()
