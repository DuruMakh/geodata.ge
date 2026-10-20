"""Regression checks for the SSA statistics package: reading rules, validation failures and committed outputs.

    python test_validation.py
"""

import csv
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))  # also works under python -I, which leaves the script's folder off the path
import prepare  # noqa: E402


def read(name):
    with open(ROOT / name, encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def sheet(cells, merges=()):
    """A worksheet in read_workbook's shape from {row: {column: value}}; numbers become Decimals."""
    return {'name': 'January', 'hidden': False, 'merges': list(merges),
            'cells': {row: {column: Decimal(str(value)) if isinstance(value, (int, float)) else value
                            for column, value in values.items()} for row, values in cells.items()}}


class ReadingRules(unittest.TestCase):
    def test_legacy_font_is_converted_and_unicode_left_alone(self):
        self.assertEqual(prepare.decode('ÓÖË'), 'სულ')
        self.assertEqual(prepare.decode('ÓÀØÀÒÈÅÄËÏ'), 'საქართველო')
        self.assertEqual(prepare.decode('ÂËÃÀÍÉ-ÍÀÞÀËÀÃÄÅÉÓ ÒÀÉÏÍÉ'), 'გლდანი-ნაძალადევის რაიონი')
        self.assertEqual(prepare.decode('სულ'), 'სულ')
        self.assertEqual(prepare.decode('January'), 'January')

    def test_month_names_including_ssa_typos(self):
        cases = {'January': 1, 'იანვარი': 1, 'Jenuary': 1, 'Ferbuary': 2, 'Fabruary': 2, 'JuIy': 7, 'Junly': 7,
                 'Setember': 9, '2015-December': 12, 'desember': 12, 'Dec': 12, 'განმარტებები': None, 'Sheet1': None}
        for name, month in cases.items():
            with self.subTest(name=name):
                self.assertEqual(prepare.month_of(name), month)

    def test_layout_joins_merged_headings_and_keeps_unnamed_rows_apart(self):
        shape = prepare.layout(sheet({
            1: {'A': 'სსიპ სოციალური მომსახურების სააგენტო'},
            2: {'A': 'სათაური'},
            3: {'A': 'რეგიონი/რაიონი', 'B': 'ჯგუფი'},
            4: {'B': 'კაცი', 'C': 'ქალი'},
            5: {'B': 1, 'C': 2},
            6: {'A': 'ქუთაისი', 'B': 3, 'C': 4},
            7: {'A': 'სულ', 'B': 4, 'C': 6},
        }, merges=[(2, 3, 3, 3)]))
        self.assertEqual(shape['labels'], {'B': 'ჯგუფი / კაცი', 'C': 'ჯგუფი / ქალი'})
        self.assertEqual([label for _, label, _ in shape['data']], ['ქუთაისი', 'სულ'])
        self.assertEqual(shape['unlabelled'], [(5, {'B': Decimal(1), 'C': Decimal(2)})])

    def test_money_tables_named_by_group_are_money(self):
        self.assertEqual(prepare.measure_of('გადარიცხული თანხა'), 'amount_gel')
        self.assertEqual(prepare.measure_of('ინვალიდობა', 'კომპენსაციისათვის საჭირო თანხა თვეში'), 'amount_gel')
        self.assertEqual(prepare.measure_of('ინვალიდობა', 'კომპენსაციის მიმღებთა რაოდენობა'), 'count')
        self.assertEqual(prepare.measure_of('პროცენტული წილი'), 'percent')

    def test_repeated_row_labels_are_named_after_their_group(self):
        rows = [(1, 'შშმ პირები', {}), (2, 'მიმღები', {}), (3, 'ომის მონაწილე', {}), (4, 'მიმღები', {})]
        self.assertEqual([label for _, label, _ in prepare.qualified(rows)],
                         ['შშმ პირები', 'შშმ პირები / მიმღები', 'ომის მონაწილე', 'ომის მონაწილე / მიმღები'])

    def test_yearly_figures_sum_money_and_take_december_people(self):
        fields = {'recipients': {(2025, 11, 'georgia'): Decimal(10), (2025, 12, 'georgia'): Decimal(20)},
                  'amount_gel': {(2025, 11, 'georgia'): Decimal(100), (2025, 12, 'georgia'): Decimal(300)},
                  'amount_emp_gel': {(2025, 12, 'georgia'): Decimal(50)}}
        figures = prepare.annual(fields, is_flow=False)[(2025, 'georgia')]
        self.assertEqual((figures['recipients'], figures['recipients_month']), ('20', 12))
        self.assertEqual(figures['amount_gel'], '450')  # employment-programme money is part of the total ...
        self.assertEqual(figures['avg_monthly_gel'], '13.33')  # ... but not of the regular recipients' average
        flow = prepare.annual(fields, is_flow=True)[(2025, 'georgia')]
        self.assertEqual((flow['recipients'], flow['recipients_month']), ('30', 'sum'))

    def test_legacy_recipient_totals_are_selected_before_trailing_columns(self):
        cases = [('pre2012_family_assistance', 2008,
                  {'H': 'სულ', 'I': 'საოჯახო დახმარების მიმღებთათვის გადარიცხული თანხა'}, 'H'),
                 ('pre2012_state_assistance', 2011,
                  {'B': '55', 'C': '110', 'D': 'სხვა', 'E': 'სულ', 'F': '55', 'G': '110', 'H': 'სხვა'}, 'E')]
        for programme, year, labels, expected in cases:
            chooser = prepare.PROGRAMMES[programme][1]
            self.assertEqual(chooser({'columns': list(labels), 'labels': labels}, year), [expected])

    def test_yearly_money_normalizes_sub_tetri_float_noise_before_rounding(self):
        self.assertEqual(prepare.whole(Decimal('1040360.49999999996')), '1040361')

    def test_missing_recipient_month_is_not_zero_and_average_uses_matching_months(self):
        fields = {'recipients': {(2020, 1, 'georgia'): Decimal(10)},
                  'amount_gel': {(2020, 1, 'georgia'): Decimal(100), (2020, 2, 'georgia'): Decimal(300)}}
        value = prepare.annual(fields, is_flow=False)[(2020, 'georgia')]
        self.assertEqual(value['count_months'], 1)
        self.assertEqual(value['amount_months'], 2)
        self.assertEqual(value['amount_gel'], '400')
        self.assertEqual(value['avg_monthly_gel'], '10')


class ValidationFailures(unittest.TestCase):
    def setUp(self):
        self.index = {'files': [{'name': 'a.xlsx'}]}
        self.manifest = [{'kind': 'workbook', 'local_file': 'official/workbooks/a.xlsx', 'sha256': 'x', 'browser_sha256': 'x'}]
        self.built = [{'programme': 'pension', 'year': 2025, 'amount_gel': '10'}]
        self.browser = [{'program': 'pension', 'year': '2025', 'amount_gel': '10'}]

    def test_clean_inputs_pass(self):
        self.assertEqual(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser), [])

    def test_hash_mismatch_with_the_browser_download_fails(self):
        self.manifest[0]['sha256'] = 'y'
        self.assertTrue(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser))

    def test_missing_workbook_fails(self):
        self.manifest[0]['sha256'] = ''
        self.assertTrue(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser))

    def test_disagreement_with_the_independent_browser_read_fails(self):
        self.built[0]['amount_gel'] = '11'
        self.assertTrue(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser))

    def test_a_year_missing_from_the_rebuild_fails(self):
        self.assertTrue(prepare.validate(self.index, self.manifest, [], [], [], self.browser))

    def test_unmapped_area_label_is_reported(self):
        unknown = set()
        prepare.by_area({'recipients': {(2025, 12, 'უცნობი რაიონი'): Decimal(1)}}, {}, unknown)
        self.assertEqual(unknown, {'უცნობი რაიონი'})

    def test_documented_preliminary_difference_requires_both_exact_values(self):
        self.built[0]['amount_gel'] = '11'
        reviews = {('pension', '2025', 'amount_gel'): ('10', '11')}
        self.assertEqual(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser, reviews), [])
        self.built[0]['amount_gel'] = '12'
        self.assertTrue(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser, reviews))

    def test_unused_preliminary_difference_review_fails(self):
        reviews = {('pension', '2025', 'amount_gel'): ('10', '11')}
        self.assertTrue(prepare.validate(self.index, self.manifest, [], [], self.built, self.browser, reviews))


@unittest.skipUnless((ROOT / 'annual-amounts.csv').exists(), 'generated files not built yet')
class CommittedOutputs(unittest.TestCase):
    def test_validation_report_passed(self):
        import json
        report = json.loads((ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        self.assertTrue(report['passed'], report['failures'][:5])

    def test_regions_and_municipalities_add_up_to_the_national_total(self):
        rows = [row for row in read('ssa-programmes-areas-annual.csv') if row['recipients_month'] == '12']
        sums = {}
        upper_abkhazia = {}
        for row in rows:
            if row['recipients']:
                key = (row['programme'], row['year'], row['area_level'])
                sums[key] = sums.get(key, Decimal(0)) + Decimal(row['recipients'])
                if row['area_level'] == 'excluded_area' and row['area_id'] == 'ზემო აფხაზეთი':
                    area_key = (row['programme'], row['year'])
                    upper_abkhazia[area_key] = upper_abkhazia.get(area_key, Decimal(0)) + Decimal(row['recipients'])
        checked = 0
        for (programme, year, level), total in sums.items():
            if level != 'national':
                continue
            excluded = sums.get((programme, year, 'excluded_area'), Decimal(0))
            tolerance = max(Decimal(50), total * Decimal('0.001'))  # SSA's sheets differ from their printed totals here and there
            municipal = sums.get((programme, year, 'municipality'))
            if municipal is not None:
                checked += 1
                self.assertLess(abs(municipal + excluded - total), tolerance, (programme, year, 'municipalities'))
            regional = sums.get((programme, year, 'region'))
            if regional is not None:
                # December 2008 TSA includes Akhalgori inside Mtskheta-Mtianeti, but Upper Abkhazia outside all regions.
                checked += 1
                outside = upper_abkhazia.get((programme, year), Decimal(0))
                self.assertLess(min(abs(regional - total), abs(regional + excluded - total),
                                    abs(regional + outside - total)), tolerance,
                                (programme, year, 'regions'))
        self.assertGreater(checked, 100)

    def test_every_area_label_is_reviewed(self):
        mapping = read('area-mapping.csv')
        kinds = {'national', 'region', 'tbilisi_total', 'tbilisi_district', 'municipality', 'city_merged',
                 'excluded_area', 'not_area'}
        self.assertTrue(all(row['kind'] in kinds for row in mapping))
        self.assertTrue(all(row['municipality_code'] for row in mapping if row['kind'] in ('municipality', 'city_merged')))


if __name__ == '__main__':
    unittest.main()
