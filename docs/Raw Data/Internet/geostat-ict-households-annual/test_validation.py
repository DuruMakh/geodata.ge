"""Regression tests for the annual Geostat ICT household survey research package (stdlib unittest only)."""

import csv
from collections import Counter
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

GROUPS = ['total', 'urban', 'rural', 'female', 'male', 'age_6_14', 'age_15_29', 'age_30_59', 'age_60_plus']


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def series(rows, indicator_id):
    return {row['year']: Decimal(row['value']) for row in rows if row['indicator_id'] == indicator_id}


def patched(rows, indicator_id, year, delta):
    """A copy with one value moved by delta and its published value kept consistent, so only the check under test fails."""
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, year)
    row['value'] = str(Decimal(row['value']) + delta)
    row['published_value'] = prepare.published(row['value'], 1)
    return copy


class InternetPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        with open(prepare.ROOT / 'coverage.csv', encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))

    def test_counts(self):
        counts = Counter(row['indicator_id'] for row in self.rows)
        expected = {row['indicator_id']: int(row['observations']) for row in self.coverage}
        self.assertEqual(dict(counts), expected)
        print(f'\n{len(self.rows)} observations')
        self.assertEqual(len(self.rows), 1055)
        self.assertTrue(all((row['unit'], row['basis'], row['value_status']) == ('percent', 'actual', 'survey_estimate') for row in self.rows))
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        copy = patched(self.rows, 'internet.bought_online.total', 2026, Decimal('0.5'))
        with self.assertRaises(ValueError):
            prepare.validate(copy)

    def test_region_coverage(self):
        years = lambda indicator_id: sorted(series(self.rows, indicator_id))
        self.assertEqual(years('internet.homes_internet.region_guria'), list(range(2020, 2027)))
        self.assertEqual(years('internet.homes_internet.region_imereti'), list(range(2016, 2027)))
        self.assertEqual(years('internet.homes_internet.region_tbilisi'), list(range(2016, 2027)))
        self.assertEqual(years('internet.homes_computer.region_racha_lechkhumi_kvemo_svaneti')[0], 2020)
        self.assertFalse(any('other' in row['indicator_id'] for row in self.rows))
        for group in GROUPS:
            self.assertEqual(years(f'internet.own_smartphone.{group}'), list(range(2019, 2027)))
        ids = {row['indicator_id'] for row in self.rows}
        self.assertNotIn('internet.daily.age_6_14', ids)
        self.assertNotIn('internet.bought_online.age_6_14', ids)

    def test_shares_close(self):
        prepare.shares_close()
        copy = patched(self.rows, 'internet.used_3m.total', 2020, Decimal(1))
        with self.assertRaises(ValueError):
            prepare.validate(copy)

    def test_brackets(self):
        prepare.check_brackets({(row['indicator_id'], row['year']): Decimal(row['value']) for row in self.rows})
        copy = patched(self.rows, 'internet.own_mobile.total', 2022, Decimal(10))
        with self.assertRaises(ValueError):
            prepare.validate(copy)

    def test_georgian_twins(self):
        self.assertEqual(prepare.georgian_twins_agree(self.rows), len(self.rows))

    def test_anchor_values(self):
        anchors = {('internet.homes_internet.total', 2016): '70.1', ('internet.homes_internet.total', 2026): '93.5',
                   ('internet.homes_internet.region_tbilisi', 2026): '98.2', ('internet.homes_internet.rural', 2026): '89.0',
                   ('internet.used_3m.total', 2026): '89.6', ('internet.bought_online.total', 2026): '38.6',
                   ('internet.bought_online.age_15_29', 2026): '63.0', ('internet.activity_banking.total', 2026): '61.0',
                   ('internet.own_mobile.total', 2026): '93.3', ('internet.homes_internet.region_guria', 2026): '91.1'}
        for (indicator_id, year), expected in anchors.items():
            self.assertEqual(find(self.rows, indicator_id, year)['published_value'], expected, (indicator_id, year))


if __name__ == '__main__':
    unittest.main()
