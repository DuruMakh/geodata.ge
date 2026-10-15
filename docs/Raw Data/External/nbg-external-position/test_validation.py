"""Regression tests for the NBG external debt and reserves research package (stdlib unittest only)."""

from collections import Counter
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

DEBT = ('ext_debt.total', 'ext_debt.government', 'ext_debt.central_bank', 'ext_debt.banks', 'ext_debt.companies', 'ext_debt.intercompany')
RESERVES = ('reserves.total', 'reserves.fx', 'reserves.sdr', 'reserves.gold')
COUNTS = {**{indicator: 21 for indicator in DEBT}, **{indicator: 32 for indicator in RESERVES}}


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def altered(rows, indicator_id, year, value):
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, year)
    row['value'] = value
    row['published_value'] = prepare.published(Decimal(value))
    return copy


def series(rows, indicator_id):
    return {row['year']: Decimal(row['value']) for row in rows if row['indicator_id'] == indicator_id}


class ExternalPositionPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()

    def test_counts(self):
        counts = Counter(row['indicator_id'] for row in self.rows)
        self.assertEqual(dict(counts), COUNTS)
        self.assertEqual(len(self.rows), 6 * 21 + 4 * 32)
        self.assertEqual(len(self.rows), 254)
        self.assertEqual({row['unit'] for row in self.rows}, {'usd_million'})
        self.assertEqual({row['basis'] for row in self.rows}, {'actual'})
        self.assertEqual({row['value_status'] for row in self.rows}, {'official'})
        prepare.validate(self.rows)

    def test_period_end(self):
        for row in self.rows:
            latest = row['year'] == 2026
            if not latest:
                self.assertEqual(row['period_end'], f"{row['year']}-12-31", row['indicator_id'])
            elif row['indicator_id'].startswith('ext_debt.'):
                self.assertEqual(row['period_end'], '2026-06-30', row['indicator_id'])
            else:
                self.assertEqual(row['period_end'], '2026-09-30', row['indicator_id'])
        self.assertEqual(sum(row['year'] == 2026 for row in self.rows), 10)
        patched = [dict(row) for row in self.rows]
        find(patched, 'reserves.fx', 2025)['period_end'] = '2025-11-30'
        with self.assertRaisesRegex(ValueError, 'period end'):
            prepare.validate(patched)

    def test_debt_parts_add_up(self):
        total = series(self.rows, 'ext_debt.total')
        parts = [series(self.rows, i) for i in DEBT[1:]]
        self.assertEqual(sorted(total), list(range(2006, 2027)))
        for year, amount in total.items():
            self.assertLessEqual(abs(sum(part[year] for part in parts) - amount), Decimal('0.05'), year)
        banks = Decimal(find(self.rows, 'ext_debt.banks', 2020)['value'])
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(altered(self.rows, 'ext_debt.banks', 2020, str(banks + 1)))

    def test_reserves_residual(self):
        total, fx, sdr, gold = (series(self.rows, i) for i in RESERVES)
        self.assertEqual(sorted(total), list(range(1995, 2027)))
        for year, amount in total.items():
            self.assertLessEqual(abs(amount - (fx[year] + gold[year] + sdr[year])), Decimal('30'), year)
        patched = altered(self.rows, 'reserves.fx', 2020, str(fx[2020] - 100))
        with self.assertRaisesRegex(ValueError, 'residual'):
            prepare.validate(patched)

    def test_gold_zero_before_2024(self):
        gold = series(self.rows, 'reserves.gold')
        for year in range(1995, 2024):
            self.assertEqual(gold[year], 0, year)
        for year in range(2024, 2027):
            self.assertGreater(gold[year], 0, year)

    def test_altered_cell_fails(self):
        copy = [dict(row) for row in self.rows]
        find(copy, 'ext_debt.total', 2020)['value'] = '21000.5'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaises(ValueError):
            prepare.validate(self.rows[1:])
        with self.assertRaises(ValueError):
            prepare.validate(self.rows + [dict(self.rows[0])])

    def test_anchor_values(self):
        anchors = {('ext_debt.total', 2025): '27046.9', ('ext_debt.government', 2025): '9202.9', ('reserves.total', 2025): '6159.3',
                   ('reserves.total', 1995): '196.2', ('reserves.total', 2026): '8166.9', ('ext_debt.total', 2026): '28166.2'}
        for (indicator, year), published in anchors.items():
            self.assertEqual(find(self.rows, indicator, year)['published_value'], published, (indicator, year))
        with self.assertRaisesRegex(ValueError, 'anchor'):
            prepare.validate(altered(self.rows, 'reserves.total', 2025, '6159.4'))

    def test_exact_values(self):
        # Reserves are stored in thousand USD and converted exactly; debt is already in million USD.
        reserves = find(self.rows, 'reserves.total', 1995)
        self.assertEqual(reserves['value'], '196.18877250844121')
        self.assertEqual(reserves['source_sheet'], 'GIR (eng) ')
        self.assertEqual(reserves['source_cell'], 'B7')
        debt = find(self.rows, 'ext_debt.government', 2026)
        self.assertEqual(debt['source_sheet'], 'ED-GEO-Tb1')
        self.assertEqual(debt['source_cell'], 'CB4')
        self.assertEqual(debt['value'], '9126.8738636999988')

    def test_rounds_as_excel_displays(self):
        self.assertEqual(prepare.published('8.4499999999999993'), '8.5')
        self.assertEqual(prepare.published('8.4499999999999'), '8.4')

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
