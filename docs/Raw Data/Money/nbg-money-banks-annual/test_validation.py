"""Regression tests for the annual NBG money and banking research package (stdlib unittest only)."""

import csv
from collections import Counter
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

COUNTS = {
    **{indicator: 31 for indicator in ('money.m3', 'money.m2', 'money.m1', 'money.m0')},
    'money.m3_to_gdp': 30, 'money.m2_to_gdp': 30,
    **{indicator: 24 for indicator in ('loans.total', 'loans.gel', 'loans.fx', 'loans.fx_share', 'deposits.individuals')},
    **{indicator: 30 for indicator in ('deposits.total', 'deposits.gel', 'deposits.fx', 'deposits.fx_share')},
    'deposits.legal_entities': 11,
    'rates.policy': 18,
    **{indicator: 30 for indicator in ('rates.loans_total', 'rates.loans_gel', 'rates.loans_fx',
                                       'rates.deposits_total', 'rates.deposits_gel', 'rates.deposits_fx')},
    'banks.npl_ratio': 23, 'banks.roa': 25, 'banks.roe': 25, 'banks.capital_ratio': 12, 'banks.tier1_ratio': 12,
}


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def altered(rows, indicator_id, year, value):
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, year)
    row['value'] = value
    row['published_value'] = prepare.published(Decimal(value), prepare.PLACES.get(indicator_id, 1))
    return copy


def series(rows, indicator_id):
    return {row['year']: Decimal(row['value']) for row in rows if row['indicator_id'] == indicator_id}


class MoneyBanksPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()

    def test_counts(self):
        counts = Counter(row['indicator_id'] for row in self.rows)
        self.assertEqual(dict(counts), COUNTS)
        self.assertEqual(len(self.rows), sum(COUNTS.values()))
        self.assertEqual(len(self.rows), 730)
        self.assertEqual(sum(row['value_status'] == 'calculated' for row in self.rows), 119)
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        copy = [dict(row) for row in self.rows]
        find(copy, 'money.m3', 2020)['value'] = '30000.5'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'calculated'):
            prepare.validate(altered(self.rows, 'deposits.total', 2010, '1.5'))
        with self.assertRaises(ValueError):
            prepare.validate(self.rows[1:])

    def test_currency_parts_add_up(self):
        for total, gel, fx in (('loans.total', 'loans.gel', 'loans.fx'), ('deposits.total', 'deposits.gel', 'deposits.fx')):
            totals, lari, foreign = (series(self.rows, i) for i in (total, gel, fx))
            for year, amount in totals.items():
                self.assertLessEqual(abs(lari[year] + foreign[year] - amount), Decimal('0.01'), (total, year))
        patched = altered(self.rows, 'loans.gel', 2020, str(Decimal(find(self.rows, 'loans.gel', 2020)['value']) + 1))
        with self.assertRaisesRegex(ValueError, 'lari plus foreign'):
            prepare.validate(patched)

    def test_people_plus_companies(self):
        people, companies, total = (series(self.rows, i) for i in ('deposits.individuals', 'deposits.legal_entities', 'deposits.total'))
        self.assertEqual(sorted(companies), list(range(2015, 2026)))
        for year in range(2015, 2026):
            self.assertLessEqual(abs(people[year] + companies[year] - total[year]), Decimal('0.01'), year)
        patched = altered(self.rows, 'deposits.individuals', 2018, str(people[2018] + 5))
        with self.assertRaisesRegex(ValueError, 'people plus companies'):
            prepare.validate(patched)

    def test_money_order(self):
        m0, m1, m2, m3 = (series(self.rows, f'money.m{n}') for n in range(4))
        for year in range(1995, 2026):
            self.assertTrue(m0[year] <= m1[year] <= m2[year] <= m3[year], year)
        with self.assertRaisesRegex(ValueError, 'order'):
            prepare.validate(altered(self.rows, 'money.m0', 2020, str(m1[2020] + 1)))

    def test_ranges(self):
        for row in self.rows:
            if row['unit'] == 'percent' and row['indicator_id'] not in ('banks.roa', 'banks.roe'):
                self.assertTrue(Decimal(0) <= Decimal(row['value']) <= Decimal(100), row['indicator_id'])
        self.assertLess(Decimal(find(self.rows, 'banks.roa', 2008)['value']), 0)
        with self.assertRaisesRegex(ValueError, 'range'):
            prepare.validate(altered(self.rows, 'rates.policy', 2020, '101'))

    def test_fsi_overlap(self):
        archive = prepare.fsi_overlap()
        expected = {'banks.capital_ratio': ('20.3', '20.3'), 'banks.tier1_ratio': ('17.1', '17.1'), 'banks.roa': ('3.8', '3.8'),
                    'banks.npl_ratio': ('1.7', '1.5'), 'banks.roe': ('30.2', '24.8')}
        for indicator, (old, new) in expected.items():
            self.assertEqual(prepare.published(archive[indicator]['value'], 1), old, indicator)
            self.assertEqual(find(self.rows, indicator, 2022)['published_value'], new, indicator)
        with open(prepare.ROOT / 'money-banks-series-breaks.csv', encoding='utf-8-sig', newline='') as handle:
            breaks = list(csv.DictReader(handle))
        self.assertEqual([row['break_id'] for row in breaks], ['fsi_method_2022', 'fsi_ifrs_2023'])
        self.assertEqual([row['applies_to'] for row in breaks],
                         ['banks.npl_ratio;banks.roe', 'banks.npl_ratio;banks.roa;banks.roe;banks.capital_ratio;banks.tier1_ratio'])
        self.assertEqual([row['reference_date'] for row in breaks], ['2022-01-01', '2023-01-01'])
        for row in breaks:
            self.assertTrue(row['reason'].strip() and row['source_note'].strip(), row['break_id'])
            self.assertNotIn('updated IMF guide', row['reason'])
        self.assertIn('3.10%', breaks[1]['reason'])
        self.assertIn('reviewed starting from 2023-01', breaks[1]['source_note'])
        with self.assertRaisesRegex(ValueError, 'overlap'):
            prepare.validate(altered(self.rows, 'banks.capital_ratio', 2022, '25'))

    def test_anchor_values(self):
        anchors = {('money.m3', 2025): '57680.2', ('loans.total', 2025): '72453.0', ('rates.policy', 2025): '8.00',
                   ('rates.loans_total', 2010): '18.56', ('banks.npl_ratio', 2025): '2.5', ('deposits.fx_share', 2025): '48.6', ('loans.fx_share', 2025): '41.9'}
        for (indicator, year), published in anchors.items():
            self.assertEqual(find(self.rows, indicator, year)['published_value'], published, indicator)
        with self.assertRaisesRegex(ValueError, 'anchor'):
            prepare.validate(altered(self.rows, 'money.m3', 2025, '57680.3'))

    def test_rounds_as_excel_displays(self):
        # Excel stores these cells just below a .x5 boundary and shows them to 15 significant digits, as NBG prints them.
        self.assertEqual(prepare.published('8.4499999999999993', 1), '8.5')
        self.assertEqual(prepare.published('8.4499999999999', 1), '8.4')
        self.assertEqual(find(self.rows, 'rates.deposits_gel', 2013)['value'], '8.4499999999999993')
        # Interest rates publish to two decimals, as NBG prints them.
        self.assertEqual(find(self.rows, 'rates.deposits_gel', 2013)['published_value'], '8.45')
        self.assertEqual(find(self.rows, 'rates.deposits_fx', 2003)['value'], '8.9499999999999993')
        self.assertEqual(find(self.rows, 'rates.deposits_fx', 2003)['published_value'], '8.95')

    def test_exact_tokens(self):
        self.assertEqual(find(self.rows, 'money.m3', 2025)['value'], '57680.224000000002')
        self.assertEqual(find(self.rows, 'loans.total', 2025)['source_cell'][0], 'B')
        calculated = find(self.rows, 'deposits.total', 2025)
        self.assertIn('+', calculated['source_cell'])
        self.assertIn('/', find(self.rows, 'loans.fx_share', 2025)['source_cell'])

    def test_no_exchange_rates(self):
        for row in self.rows:
            self.assertNotIn('exchange', row['indicator_id'])
            self.assertNotIn('fx_rate', row['indicator_id'])
        for path in (prepare.ROOT / 'official').iterdir():
            self.assertNotIn('exchange', path.name.lower())
            self.assertNotIn('exrate', path.name.lower())

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
