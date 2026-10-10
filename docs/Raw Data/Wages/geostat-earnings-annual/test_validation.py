"""Regression checks: each validation rejects the defect it exists to catch."""

from decimal import Decimal
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
import prepare


def failed_checks(observations, unavailable, manifest, transcriptions):
    _, failures = prepare.validate(observations, unavailable, manifest, transcriptions)
    return {failure['check'] for failure in failures}


class EarningsValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest, _, cls.observations, cls.unavailable, _ = prepare.collect()
        cls.transcriptions = prepare.load_transcriptions()

    def checks(self, observations=None, unavailable=None, transcriptions=None):
        return failed_checks(self.observations if observations is None else observations,
                             self.unavailable if unavailable is None else unavailable,
                             self.manifest, self.transcriptions if transcriptions is None else transcriptions)

    def edited(self, match, **changes):
        rows = [{**row, **changes} if match(row) else row for row in self.observations]
        self.assertNotEqual(rows, self.observations, 'The test edit must change at least one row')
        return rows

    def test_preserved_package_passes(self):
        self.assertEqual(self.checks(), set())

    def test_omitted_published_cells_are_rejected(self):
        omissions = {
            'one activity-year': lambda r: (r['source_id'], r['sector_id'], r['year']) == (
                'geostat_earnings_annual_activity', 'sector.k', 2025),
            'one whole region': lambda r: r['group_id'] == 'region.guria',
            'one legacy year': lambda r: r['year'] == 1999 and r['source_sheet'] == 'NACE1',
            'the median workbook': lambda r: r['indicator_id'] == prepare.MEDIAN,
        }
        for name, omit in omissions.items():
            with self.subTest(name):
                remaining = [row for row in self.observations if not omit(row)]
                self.assertIn('source_cell_inventory', self.checks(observations=remaining))

    def test_unavailable_cell_cannot_disappear_or_be_duplicated(self):
        self.assertIn('source_cell_inventory', self.checks(unavailable=self.unavailable[1:]))
        self.assertIn('duplicate_source_cell', self.checks(unavailable=self.unavailable + self.unavailable[:1]))

    def test_repeated_total_must_match_headline(self):
        rows = self.edited(lambda r: r['role'] == 'control' and r['source_id'] == 'geostat_earnings_annual_sex'
                           and r['group_id'] == 'women' and r['year'] == 2025 and r['source_sheet'] == 'NACE2',
                           published_value='1743.5')
        self.assertIn('repeated_total', self.checks(observations=rows))

    def test_single_sector_activity_must_repeat_national_value(self):
        rows = self.edited(lambda r: (r['dimension'], r['group_id'], r['sector_id'], r['year']) == (
            'ownership', 'public', 'sector.o', 2020), published_value='1.0')
        self.assertIn('single_sector_activity', self.checks(observations=rows))

    def test_swap_with_section_absent_from_table_is_rejected(self):
        swap = {'sector.j': 'sector.k', 'sector.k': 'sector.j'}
        rows = [{**row, 'sector_id': swap[row['sector_id']]}
                if row['source_id'] == 'geostat_earnings_annual_business_sector' and row['sector_id'] in swap
                else row for row in self.observations]
        self.assertIn('source_cell_inventory', self.checks(observations=rows))

    def test_swaps_within_one_table_are_rejected(self):
        swaps = {'two published sections': ('sector_id', {'sector.p': 'sector.q', 'sector.q': 'sector.p'}),
                 'two regions': ('group_id', {'region.guria': 'region.imereti', 'region.imereti': 'region.guria'}),
                 'women and men': ('group_id', {'women': 'men', 'men': 'women'})}
        for name, (field, swap) in swaps.items():
            with self.subTest(name):
                rows = [{**row, field: swap[row[field]]} if row[field] in swap else row for row in self.observations]
                self.assertIn('label_matches_id', self.checks(observations=rows))

    def test_activity_mapping_must_match_published_section_letters(self):
        swapped = {**prepare.NACE2, 'Education': 'sector.q', 'Human health and social work activities': 'sector.p'}
        with patch.object(prepare, 'NACE2', swapped):
            self.assertIn('nace_section_letters', self.checks())

    def test_duplicate_primary_and_orphan_control_are_rejected(self):
        headline = next(row for row in self.observations if row['role'] == 'primary'
                        and row['source_id'] == 'geostat_earnings_annual_headline' and row['group_id'] == 'women'
                        and row['year'] == 2025)
        self.assertIn('duplicate_primary', self.checks(observations=self.observations + [headline]))
        remaining = [row for row in self.observations if row is not headline]
        self.assertIn('repeated_total', self.checks(observations=remaining))

    def test_official_page_value_must_match(self):
        page = next(r for r in self.manifest if r['source_id'] == 'geostat_wages_source_page')
        original = (prepare.ROOT / page['local_file']).read_text(encoding='utf-8-sig')
        self.assertIn('>2165.2<', original)
        scratch = (prepare.ROOT.parents[3] / '.tmp').resolve()
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch, prefix='wages-page-') as directory:
            temporary = Path(directory).resolve()
            (temporary / 'official').mkdir()
            (temporary / page['local_file']).write_text(original.replace('>2165.2<', '>2165.3<'), encoding='utf-8')
            shutil.copy(prepare.ROOT / 'nace-sections-transcription.csv', temporary)
            with patch.object(prepare, 'ROOT', temporary):
                self.assertIn('official_page_annual_headline', self.checks())

    def test_unexpected_format_stray_number_or_extra_sheet_stops_the_build(self):
        record = next(r for r in self.manifest if r['source_id'] == 'geostat_earnings_annual_median')
        layout = prepare.LAYOUTS[('geostat_earnings_annual_median', '1')]
        with self.subTest('whole-lari median shown with a decimal format'):
            formats = {k: v for k, v in prepare.PRECISION.items() if k != '0'}
            with patch.object(prepare, 'PRECISION', formats), self.assertRaisesRegex(ValueError, 'precision'):
                prepare.extract(record, '1', layout)
        with self.subTest('number beside a data row'):
            real_read = prepare.read_sheet

            def with_stray(path, sheet):
                rows = real_read(path, sheet)
                rows[3]['Z'] = {'value': Decimal('5'), 'cell': 'Z3', 'kind': 'n', 'format': '0'}
                return rows
            with patch.object(prepare, 'read_sheet', with_stray), self.assertRaisesRegex(ValueError, 'Z3'):
                prepare.extract(record, '1', layout)
        with self.subTest('worksheet missing from the inventory'):
            reduced = {k: v for k, v in prepare.LAYOUTS.items() if k != ('geostat_earnings_annual_sex', 'NACE1')}
            with patch.object(prepare, 'LAYOUTS', reduced), self.assertRaisesRegex(ValueError, 'worksheets'):
                prepare.collect()

    def test_total_outside_its_parts_is_rejected(self):
        rows = self.edited(lambda r: r['role'] == 'primary' and r['dimension'] == 'region'
                           and r['year'] == 2015, value='1.0', published_value='1.0')
        self.assertIn('within_parts_range', self.checks(observations=rows))

    def test_release_statement_mismatch_is_rejected(self):
        for check_id, wrong in (('total_change_pct', '9.8'), ('median_ict_rank', '3'), ('public_gap_gel', '405.7')):
            with self.subTest(check_id):
                transcriptions = [{**t, 'published_value': wrong} if t['check_id'] == check_id else t
                                  for t in self.transcriptions]
                self.assertIn('release_statement', self.checks(transcriptions=transcriptions))

    def test_altered_or_missing_capture_cannot_produce_a_package(self):
        original_root = prepare.ROOT
        scratch = (original_root.parents[3] / '.tmp').resolve()
        self.assertTrue(scratch.is_relative_to(original_root.parents[3].resolve()))
        scratch.mkdir(exist_ok=True)
        cases = {'altered workbook': ('geostat_earnings_annual_region', 'alter'),
                 'missing metadata': ('geostat_median_metadata_2026', 'omit')}
        for name, (source_id, action) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory(dir=scratch, prefix='wages-validation-') as directory:
                temporary = Path(directory).resolve()
                self.assertTrue(temporary.is_relative_to(scratch))
                shutil.copytree(original_root / 'official', temporary / 'official')
                records = [record for record in self.manifest if action == 'alter' or record['source_id'] != source_id]
                (temporary / 'source-manifest.json').write_text(json.dumps(records), encoding='utf-8')
                if action == 'alter':
                    target = temporary / next(r['local_file'] for r in records if r['source_id'] == source_id)
                    target.write_bytes(target.read_bytes() + b'\0')
                with patch.object(prepare, 'ROOT', temporary):
                    with self.assertRaises(ValueError):
                        prepare.collect()

    def test_unmapped_activity_label_is_rejected(self):
        reduced = {label: code for label, code in prepare.NACE2.items() if code != 'sector.k'}
        record = next(r for r in self.manifest if r['source_id'] == 'geostat_earnings_annual_activity')
        layout = prepare.LAYOUTS[('geostat_earnings_annual_activity', 'NACE2')]
        with patch.object(prepare, 'NACE2', reduced):
            with self.assertRaises(KeyError):
                prepare.extract(record, 'NACE2', layout)

    def test_primary_values_are_lari_and_positive(self):
        primary = [row for row in self.observations if row['role'] == 'primary']
        self.assertTrue(all(row['unit'] == 'gel' and Decimal(row['value']) > 0 for row in primary))
        self.assertEqual(min(row['year'] for row in primary), prepare.PRIMARY_START)


if __name__ == '__main__':
    unittest.main()
