"""Regression tests for the annual NBG money and banking research package (stdlib unittest only)."""

import csv
import re
from collections import Counter
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

INDUSTRIES = ('agriculture', 'industry', 'construction', 'trade', 'hotels_restaurants', 'transport_communications', 'financial',
              'real_estate', 'education', 'health_social', 'other_services')
PURPOSES = ('consumer', 'home', 'sme', 'large_business', 'car', 'pawn', 'other')
REGIONS = ('region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
           'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
           'region_kvemo_kartli', 'region_shida_kartli')
AREAS = ('georgia',) + REGIONS
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
    **{indicator: 23 for indicator in ('borrowers.total', 'borrowers.businesses', 'borrowers.people')},
    **{indicator: 11 for indicator in ('borrowers.households', 'borrowers.individual_entrepreneurs')},
    **{f'borrowers.industry.{industry}': 23 for industry in INDUSTRIES},
    **{f'households.purpose.{purpose}': 11 for purpose in PURPOSES},
    **{f'loans_region.{area}.{part}': 11 for area in AREAS for part in ('total', 'gel', 'fx')},
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
        self.assertEqual(len(self.rows), 1547)
        self.assertEqual(sum(row['value_status'] == 'calculated' for row in self.rows), 119 + 77 + 132)
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
        breaks = breaks[:2]  # The four loan breaks are checked in test_loan_breaks.
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

    def test_row_count(self):
        self.assertEqual(len(self.rows), 1547)
        prepare.validate(self.rows)

    def test_loan_anchors(self):
        published = {(row['indicator_id'], row['year']): row['published_value'] for row in self.rows}
        self.assertEqual(published[('borrowers.total', 2025)], '69035.7')
        self.assertEqual(published[('borrowers.households', 2025)], '37355.4')
        self.assertEqual(published[('loans_region.georgia.total', 2025)], '71780.2')
        self.assertEqual(published[('loans_region.region_tbilisi.total', 2025)], '52420.1')
        self.assertEqual(published[('loans_region.georgia.gel', 2025)], '41698.7')
        self.assertEqual(published[('loans_region.georgia.fx', 2025)], '30081.5')
        with self.assertRaisesRegex(ValueError, 'anchor'):
            prepare.validate(altered(self.rows, 'borrowers.total', 2025, '69035.8'))

    def test_households_start_2015(self):
        for indicator in ('borrowers.households', 'borrowers.individual_entrepreneurs'):
            years = {row['year'] for row in self.rows if row['indicator_id'] == indicator}
            self.assertEqual(min(years), 2015, indicator)
            self.assertEqual(len(years), 11, indicator)
        for row in self.rows:
            if row['indicator_id'].startswith(('borrowers.households', 'borrowers.individual_entrepreneurs', 'households.purpose.', 'loans_region.')):
                self.assertGreaterEqual(row['year'], 2015, row['indicator_id'])

    def test_no_abkhazeti(self):
        for row in self.rows:
            self.assertNotIn('abkhaz', row['indicator_id'].lower())
        self.assertEqual({row['indicator_id'].split('.')[1] for row in self.rows if row['indicator_id'].startswith('loans_region.')},
                         set(AREAS))

    def test_people_plus_businesses_until_2014(self):
        people, businesses, total = (series(self.rows, f'borrowers.{i}') for i in ('people', 'businesses', 'total'))
        self.assertEqual(sorted(people), list(range(2003, 2026)))
        for year in range(2003, 2015):
            self.assertLessEqual(abs(people[year] + businesses[year] - total[year]), Decimal('0.5'), year)
        households = series(self.rows, 'borrowers.households')
        for year in range(2015, 2026):
            self.assertLessEqual(abs(businesses[year] + households[year] - total[year]), Decimal('0.5'), year)

    def test_validate_rejects_broken_industry_sum(self):
        trade = Decimal(find(self.rows, 'borrowers.industry.trade', 2020)['value'])
        with self.assertRaisesRegex(ValueError, 'industries'):
            prepare.validate(altered(self.rows, 'borrowers.industry.trade', 2020, str(trade + 1)))

    def test_validate_rejects_broken_household_and_region_sums(self):
        people = Decimal(find(self.rows, 'borrowers.people', 2018)['value'])
        with self.assertRaisesRegex(ValueError, 'Households'):
            prepare.validate(altered(self.rows, 'borrowers.people', 2018, str(people + 1)))
        businesses = Decimal(find(self.rows, 'borrowers.businesses', 2010)['value'])
        with self.assertRaisesRegex(ValueError, 'Businesses'):
            prepare.validate(altered(self.rows, 'borrowers.businesses', 2010, str(businesses + 1)))
        def bumped(rows, indicator, year):
            return altered(rows, indicator, year, str(Decimal(find(rows, indicator, year)['value']) + 1))
        with self.assertRaisesRegex(ValueError, 'Lari plus foreign'):
            prepare.validate(bumped(self.rows, 'loans_region.region_imereti.fx', 2020))
        # Moving an area's total with its part keeps that area consistent, so only the regions-to-Georgia sum can catch it.
        for area, part in (('region_imereti', 'fx'), ('georgia', 'gel')):
            patched = bumped(bumped(self.rows, f'loans_region.{area}.{part}', 2020), f'loans_region.{area}.total', 2020)
            with self.assertRaisesRegex(ValueError, 'regions do not add up'):
                prepare.validate(patched)

    def test_purpose_and_region_totals_are_calculated_cells(self):
        purpose = find(self.rows, 'households.purpose.home', 2025)
        self.assertEqual((purpose['source_sheet'], purpose['value_status'], purpose['unit']), ('HH', 'calculated', 'gel_million'))
        lari, foreign = purpose['source_cell'].split('+')
        self.assertTrue(lari.startswith('DS') and foreign.startswith('DS') and lari != foreign, purpose['source_cell'])
        # The 2021 purpose columns come from the one header NBG dated 1 December (printed 12-2021).
        self.assertTrue(find(self.rows, 'households.purpose.home', 2021)['source_cell'].startswith('BW'))
        total = find(self.rows, 'loans_region.region_adjara.total', 2025)
        self.assertEqual((total['source_sheet'], total['value_status']), ('NC+FC', 'calculated'))
        nc, fc = total['source_cell'].split('+')
        self.assertEqual(nc[:2], fc[:2])
        self.assertEqual(nc, fc)  # same column and the same row on both sheets
        for part, sheet in (('gel', 'NC'), ('fx', 'FC')):
            row = find(self.rows, f'loans_region.georgia.{part}', 2025)
            self.assertEqual((row['source_sheet'], row['value_status']), (sheet, 'official'))

    def test_loan_breaks(self):
        with open(prepare.ROOT / 'money-banks-series-breaks.csv', encoding='utf-8-sig', newline='') as handle:
            breaks = {row['break_id']: row for row in csv.DictReader(handle)}
        self.assertEqual(list(breaks)[2:], ['loans_activity_2014', 'loans_overdue_2015', 'loans_sector_2022', 'loans_microbanks_2025'])
        self.assertEqual([breaks[i]['reference_date'] for i in list(breaks)[2:]], ['2014-06-01', '2015-12-01', '2022-09-01', '2025-01-01'])
        self.assertEqual(len(breaks['loans_activity_2014']['applies_to'].split(';')), 11)
        self.assertIn('personal information regarding their economic activity', breaks['loans_activity_2014']['source_note'])
        self.assertIn('Including overdue loan amounts since December 1, 2015', breaks['loans_overdue_2015']['source_note'])
        self.assertIn('unified database of legal entities', breaks['loans_sector_2022']['source_note'])
        self.assertIn('include microbanks from January 2025', breaks['loans_microbanks_2025']['source_note'])
        known = {row['indicator_id'] for row in self.rows}
        for row in breaks.values():
            self.assertTrue(row['reason'].strip() and row['source_note'].strip(), row['break_id'])
            for indicator in row['applies_to'].split(';'):
                self.assertIn(indicator, known, (row['break_id'], indicator))

    def test_break_quotes_are_the_workbook_cells(self):
        source_of = {'L3.10.1': 'nbg_loans_structure_l3_10_1', 'LPR': 'nbg_loans_purpose_lop', 'LREG': 'nbg_loans_regions_lreg'}
        quoted = 0
        for entry in prepare.BREAKS[2:]:
            for code, name, cell, quote in re.findall(r'(L3\.10\.1|LPR|LREG) (\w+)!([A-Z]+\d+): "([^"]*)"', entry['source_note']):
                column, row = re.fullmatch(r'([A-Z]+)(\d+)', cell).groups()
                self.assertEqual(prepare.text(prepare.sheet(source_of[code], name)[int(row)][column]), quote, (entry['break_id'], cell))
                quoted += 1
        self.assertEqual(quoted, 5)

    def test_december_columns_accepts_only_december_headings(self):
        def header(*days, fmt='mm\\-yyyy'):
            return {chr(65 + i): {'value': Decimal((day - prepare.date(1899, 12, 30)).days), 'cell': f'{chr(65 + i)}3', 'kind': 'n', 'format': fmt}
                    for i, day in enumerate(days)}
        d = prepare.date
        self.assertEqual(prepare.december_columns({3: header(d(2015, 11, 30), d(2015, 12, 31), d(2016, 12, 31))}, 3), {2015: 'B', 2016: 'C'})
        self.assertEqual(prepare.december_columns({3: header(d(2021, 11, 1), d(2021, 12, 1))}, 3), {2021: 'B'})
        with self.assertRaises(ValueError):  # a 1 December heading is only a month heading when no day is printed
            prepare.december_columns({3: header(d(2021, 12, 1), fmt='dd/mm/yyyy')}, 3)
        with self.assertRaises(ValueError):
            prepare.december_columns({3: header(d(2015, 12, 31), d(2015, 12, 31))}, 3)
        with self.assertRaises(ValueError):
            prepare.december_columns({3: header(d(2015, 12, 15))}, 3)

    def test_row_by_label_needs_one_row(self):
        rows = {n: {'A': {'value': label, 'cell': f'A{n}', 'kind': 's'}} for n, label in
                enumerate(['In lari', 'Consumer', 'In foreign', 'Consumer'], start=1)}
        self.assertEqual(prepare.row_by_label(rows, 'In lari'), 1)
        self.assertEqual(prepare.row_by_label(rows, 'Consumer', after=3), 4)
        self.assertEqual(prepare.row_by_label(rows, 'Consumer', after=1, before=3), 2)
        with self.assertRaises(ValueError):
            prepare.row_by_label(rows, 'Consumer')
        with self.assertRaises(ValueError):
            prepare.row_by_label(rows, 'Missing')

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
