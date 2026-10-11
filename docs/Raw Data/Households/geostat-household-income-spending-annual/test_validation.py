"""Regression tests for the annual household income and spending research package (stdlib unittest only)."""

from copy import deepcopy
from decimal import Decimal
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402


def find(rows, indicator_id, area_id, measure, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['area_id'] == area_id
                and row['measure'] == measure and row['year'] == year)


def altered(rows, indicator_id, area_id, measure, year, value):
    """A copy with one value replaced and its published value kept consistent."""
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, area_id, measure, year)
    row['value'] = value
    row['published_value'] = prepare.published(Decimal(value), row['source_number_format'])
    return copy


class HouseholdPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows, cls.checks = prepare.extract()

    def test_primary_count_is_10638(self):
        income = [row for row in self.rows if row['indicator_id'].startswith('income.')]
        spending = [row for row in self.rows if row['indicator_id'].startswith('spending.')]
        self.assertEqual(len(self.rows), 10638)
        self.assertEqual(len(income), 4728)
        self.assertEqual(len(spending), 5910)
        self.assertEqual({row['source_id'] for row in self.rows},
                         {f'geostat_household_{domain}_{who}_{area}' for domain in ('income', 'spending')
                          for who in ('household', 'capita') for area in ('national', 'settlement', 'region')})
        prepare.validate(self.rows, self.checks)

    def test_published_value_rounds_the_displayed_digits(self):
        # Excel shows 15 significant digits, so a stored 17-digit token just below a half rounds up.
        self.assertEqual(prepare.published(Decimal('2025.7499999999999'), '#,##0.0'), '2025.8')
        self.assertEqual(prepare.published(Decimal('8.4499999999999993'), '#,##0.0'), '8.5')
        self.assertEqual(prepare.published(Decimal('8.4400000000000004'), '0.0'), '8.4')
        self.assertEqual(prepare.published(Decimal('0'), '#,##0.0'), '0.0')

    def test_altered_cell_fails(self):
        copy = [dict(row) for row in self.rows]
        find(copy, 'income.total', 'georgia', 'per_household', 2012)['value'] = '700.5'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy, self.checks)

    def test_missing_extra_and_duplicate_rows_fail(self):
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:], self.checks)
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])], self.checks)
        extra = dict(find(self.rows, 'income.total', 'georgia', 'per_household', 2012), year=2001)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [extra], self.checks)

    def test_negative_value_fails(self):
        with self.assertRaisesRegex(ValueError, 'negative'):
            prepare.validate(altered(self.rows, 'income.gifts', 'georgia', 'per_capita', 2015, '-1'), self.checks)

    def test_parts_sum_to_totals_fails_when_violated(self):
        for line, area, measure in [('income.wages', 'georgia', 'per_household'), ('spending.food', 'settlement.rural', 'per_capita'),
                                    ('spending.agriculture', 'region.tbilisi', 'per_household')]:
            row = find(self.rows, line, area, measure, 2020)
            with self.assertRaisesRegex(ValueError, 'sum'):
                prepare.validate(altered(self.rows, line, area, measure, 2020, str(Decimal(row['value']) + Decimal('0.000005'))), self.checks)
        # A check-only line can break its sum as well.
        checks = deepcopy(self.checks)
        key = ('per_household', 'georgia', 'income.cash', 2020)
        checks['values'][key] += Decimal('0.00001')
        with self.assertRaisesRegex(ValueError, 'sum'):
            prepare.validate(self.rows, checks)

    def test_georgia_between_urban_and_rural_fails_when_violated(self):
        with self.assertRaisesRegex(ValueError, 'between urban and rural'):
            prepare.validate(altered(self.rows, 'income.total', 'georgia', 'per_household', 2020, '1'), self.checks)
        with self.assertRaisesRegex(ValueError, 'between urban and rural'):
            prepare.validate(altered(self.rows, 'spending.education', 'georgia', 'per_capita', 2010, '900'), self.checks)

    def test_georgia_outside_regions_fails_when_violated(self):
        copy = self.rows
        for row in [r for r in self.rows if r['area_id'].startswith('region.') and r['indicator_id'] == 'income.total'
                    and r['measure'] == 'per_household' and r['year'] == 2011]:
            copy = altered(copy, 'income.total', row['area_id'], 'per_household', 2011, '1')
        with self.assertRaisesRegex(ValueError, 'regions'):
            prepare.validate(copy, self.checks)

    def test_regional_georgia_column_equals_national_fails_when_violated(self):
        checks = deepcopy(self.checks)
        key = ('per_household', 'regional_georgia', 'income.total', 2020)
        checks['values'][key] += Decimal('0.000000002')
        with self.assertRaisesRegex(ValueError, 'national'):
            prepare.validate(self.rows, checks)

    def test_placeholder_cells_not_served(self):
        unavailable = {'region.samtskhe_javakheti', 'region.guria', 'region.mtskheta_mtianeti', 'region.racha_lechkhumi_kvemo_svaneti'}
        self.assertEqual(unavailable, prepare.UNAVAILABLE_BEFORE_2019)
        self.assertFalse([row for row in self.rows if row['area_id'] in unavailable and row['year'] < 2019])
        self.assertEqual(min(row['year'] for row in self.rows if row['area_id'] in unavailable), 2019)
        self.assertFalse([row for row in self.rows if 'other' in row['area_id'] or row['area_id'] == 'regional_georgia'])
        self.assertTrue(all(row['value'] and row['published_value'] for row in self.rows))
        served = dict(find(self.rows, 'income.total', 'region.guria', 'per_household', 2019), year=2018)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [served], self.checks)

    def test_page_values_match(self):
        self.assertEqual(find(self.rows, 'income.total', 'georgia', 'per_household', 2025)['published_value'], '2025.8')
        self.assertEqual(find(self.rows, 'spending.consumption', 'georgia', 'per_household', 2025)['published_value'], '1438.7')
        # The page capture's headline table shows the all-inflows and total-expenditure lines.
        page = {(measure, line): prepare.published(self.checks['values'][(measure, 'georgia', line, 2025)], '0.0')
                for (measure, line) in prepare.PAGE_VALUES_2025}
        self.assertEqual(page, prepare.PAGE_VALUES_2025)
        with self.assertRaisesRegex(ValueError, 'page'):
            prepare.validate(altered(self.rows, 'income.total', 'georgia', 'per_household', 2025, '2025.9'), self.checks)

    def test_footnotes_kept(self):
        report = json.loads((prepare.ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        text = json.dumps(report, ensure_ascii=False)
        self.assertIn('* The data of 2011-2018 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions.', text)
        self.assertIn('… The data is not available due to small sample size of the survey. '
                      'Survey sample size has been increased since 2019.', text)
        self.assertIn('** Includes Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti regions.', text)
        self.assertEqual(sorted(report['footnotes']),
                         sorted(f'geostat_household_{d}_{w}_region' for d in ('income', 'spending') for w in ('household', 'capita')))
        checks = deepcopy(self.checks)
        checks['footnotes']['geostat_household_income_household_region'].pop()
        with self.assertRaisesRegex(ValueError, 'footnote'):
            prepare.validate(self.rows, checks)

    def test_committed_outputs_reproduce(self):
        report = prepare.build(check=True)
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(report['primary_observation_count'], 10638)
        self.assertEqual(report['imputed_values'], 0)
        self.assertEqual(report['reconciliation_failed_count'], 0)


if __name__ == '__main__':
    unittest.main()
