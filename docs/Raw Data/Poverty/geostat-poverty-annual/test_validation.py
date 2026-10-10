"""Regression tests for the annual poverty and Gini research package (stdlib unittest only)."""

from collections import Counter
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402


def find(rows, indicator_id, group_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['group_id'] == group_id
                and row['year'] == year)


def altered(rows, indicator_id, group_id, year, value):
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, group_id, year)
    row['value'] = value
    row['published_value'] = prepare.published(Decimal(value), row['source_number_format'])
    return copy


class PovertyPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()

    def test_primary_count_is_491(self):
        families = Counter(row['indicator_id'].split('_')[0].split('.')[0] + ':' + row['indicator_id'].split('.')[1].split('_')[0]
                           for row in self.rows)
        self.assertEqual(len(self.rows), 491)
        self.assertEqual(families['poverty:absolute'], 176)
        self.assertEqual(families['poverty:relative'], 132)
        self.assertEqual(families['poverty:international'], 63)
        self.assertEqual(sum(count for key, count in families.items() if key.startswith('gini:')), 120)
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        copy = [dict(row) for row in self.rows]
        find(copy, 'poverty.absolute', 'georgia', 2012)['value'] = '30.5'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)

    def test_georgia_between_groups_fails_when_violated(self):
        with self.assertRaisesRegex(ValueError, 'between'):
            prepare.validate(altered(self.rows, 'poverty.absolute', 'georgia', 2010, '50'))
        with self.assertRaisesRegex(ValueError, 'between'):
            prepare.validate(altered(self.rows, 'poverty.relative_40', 'georgia', 2010, '1'))

    def test_relative_40_above_60_fails(self):
        with self.assertRaisesRegex(ValueError, '40'):
            prepare.validate(altered(self.rows, 'poverty.relative_40', 'settlement.urban', 2020, '25'))

    def test_international_order_fails(self):
        with self.assertRaisesRegex(ValueError, 'international'):
            prepare.validate(altered(self.rows, 'poverty.international_420', 'georgia', 2015, '5'))

    def test_ranges_fail(self):
        with self.assertRaisesRegex(ValueError, 'range'):
            prepare.validate(altered(self.rows, 'gini.total_income', 'georgia', 2020, '1.2'))

    def test_page_values_match(self):
        published = [find(self.rows, 'poverty.absolute', 'georgia', year)['published_value'] for year in range(2016, 2026)]
        self.assertEqual(published, ['22.0', '21.9', '20.1', '19.5', '21.3', '17.5', '15.6', '11.8', '9.4', '7.1'])
        self.assertEqual(find(self.rows, 'gini.total_income', 'georgia', 2025)['published_value'], '0.34')
        with self.assertRaisesRegex(ValueError, 'page'):
            prepare.validate(altered(self.rows, 'poverty.absolute', 'georgia', 2024, '9.3'))

    def test_2015_footnote_kept(self):
        for row in self.rows:
            if row['indicator_id'] == 'poverty.absolute' and row['year'] == 2015:
                self.assertIn('2015*', row['source_label'])
        self.assertIn('Base year of calculating poverty line.', (prepare.ROOT / 'README.md').read_text(encoding='utf-8'))

    def test_lari_lines_not_primary(self):
        international = [row for row in self.rows if row['source_id'] == 'geostat_poverty_international']
        self.assertEqual(len(international), 63)
        self.assertTrue(all(row['unit'] == 'percent' and 'Poverty headcount' in row['source_label'] for row in international))
        self.assertEqual(max(row['year'] for row in international), 2024)

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
