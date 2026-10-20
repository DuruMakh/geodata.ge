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


def served_row(programme, measure, geography_id, year, value, **extra):
    return {'programme': programme, 'measure': measure, 'geography_id': geography_id, 'year': year,
            'value': str(value), 'months': extra.get('months', 1), 'value_status': 'official', **extra}


class ServedValidationFailures(unittest.TestCase):
    """validate_served rejects rows the served file must never hold."""

    def setUp(self):
        self.national = [{'programme': 'pension', 'year': 2025, 'recipients': '10', 'amount_gel': '100'}]
        self.areas = [{'programme': 'pension', 'year': 2025, 'area_level': 'municipality', 'area_id': '06',
                       'recipients': '4', 'recipients_month': 12, 'amount_gel': '40'},
                      {'programme': 'pension', 'year': 2025, 'area_level': 'region', 'area_id': 'region.tbilisi',
                       'recipients': '6', 'recipients_month': 12, 'amount_gel': '60'}]
        self.served = [served_row('pension', 'recipients', 'country.georgia', 2025, 10),
                       served_row('pension', 'amount', 'country.georgia', 2025, 100, months=12),
                       served_row('pension', 'recipients', '06', 2025, 4),
                       served_row('pension', 'amount', '06', 2025, 40, months=12),
                       served_row('pension', 'recipients', 'region.tbilisi', 2025, 6),
                       served_row('pension', 'amount', 'region.tbilisi', 2025, 60, months=12)]

    def failures(self):
        return prepare.validate_served(self.served, self.national, self.areas)

    def test_clean_rows_pass(self):
        self.assertEqual(self.failures(), [])

    def test_a_tbilisi_municipality_row_fails(self):
        self.served.append(served_row('pension', 'recipients', '04', 2025, 6))
        self.assertTrue(self.failures())

    def test_a_year_outside_2013_to_2025_fails(self):
        self.served.append(served_row('pension', 'recipients', 'country.georgia', 2026, 10))
        self.assertTrue(self.failures())

    def test_a_duplicate_row_fails(self):
        self.served.append(dict(self.served[0]))
        self.assertTrue(self.failures())

    def test_a_value_differing_from_the_reviewed_extraction_fails(self):
        self.served[2]['value'] = '5'
        self.assertTrue(self.failures())

    def test_a_value_missing_from_the_served_file_fails(self):
        del self.served[3]
        self.assertTrue(self.failures())

    def test_social_package_groups_that_do_not_add_up_fail(self):
        groups = {'total': 10, 'disability': 5, 'survivors': 2, 'war_participants': 1, 'political_repression': 1,
                  'other': 1, 'disability_children': 1, 'disability_severe': 2, 'disability_significant': 1,
                  'disability_moderate': 1}
        self.served += [served_row('social_package_group', f'group.{group}.recipients', 'country.georgia', 2025, value)
                        for group, value in groups.items()]
        self.assertEqual(self.failures(), [])
        self.served[-6]['value'] = '2'  # other
        self.assertTrue(self.failures())


def served_rows():
    return read('ssa-served-annual.csv')


def served_values():
    return {(row['programme'], row['measure'], row['geography_id'], int(row['year'])): row for row in served_rows()}


SITE_MUNICIPALITIES = {row['municipality_code'] for row in csv.DictReader(
    open(prepare.MUNICIPALITIES, encoding='utf-8-sig', newline=''))} - {'04'}
GROUP_MEMBERS = ('disability', 'survivors', 'war_participants', 'political_repression', 'other')
DISABILITY_PARTS = ('disability_children', 'disability_severe', 'disability_significant', 'disability_moderate')


class ServedFile(unittest.TestCase):
    """ssa-served-annual.csv: the yearly values the explorer serves, each traceable to a workbook cell."""

    def test_tsa_registered(self):
        values = served_values()
        self.assertEqual(values[('tsa_registered', 'recipients', 'country.georgia', 2025)]['value'], '397144')
        self.assertEqual(values[('tsa_registered', 'recipients', 'country.georgia', 2013)]['value'], '524482')
        places_2025 = {key[2] for key in values if key[:2] == ('tsa_registered', 'recipients') and key[3] == 2025}
        self.assertLessEqual(SITE_MUNICIPALITIES | {'region.tbilisi'}, places_2025)
        recorded = {(row['table_id'], int(row['year']), row['month'], row['column']): Decimal(row['difference'])
                    for row in read('source-findings.csv') if row['table_id'] == 'tsa_db-01' and row['difference']}
        columns = {'recipients': 'B', 'persons': 'C'}
        checked = 0
        for year in range(2013, 2026):
            for measure, column in columns.items():
                total = Decimal(values[('tsa_registered', measure, 'country.georgia', year)]['value'])
                parts = sum(Decimal(row['value']) for key, row in values.items()
                            if key[:2] == ('tsa_registered', measure) and key[3] == year
                            and (key[2] in SITE_MUNICIPALITIES or key[2] == 'region.tbilisi' or key[2].startswith('unit.')))
                difference = recorded.get(('tsa_db-01', year, '12', column), Decimal(0))
                self.assertEqual(total - parts, difference, (measure, year))
                checked += 1
        self.assertEqual(checked, 26)

    def test_served_anchors(self):
        values = served_values()
        anchors = {('pension', 'recipients', 2025): '888518',
                   ('pension', 'amount', 2025): '4262309090',
                   ('subsistence_allowance', 'recipients', 2025): '129506',
                   ('subsistence_allowance', 'persons', 2025): '463122',
                   ('subsistence_allowance', 'employment_families', 2025): '54842',
                   ('tsa_registered', 'recipients', 2025): '397144',
                   ('subsistence_allowance', 'amount', 2025): '855291818',
                   ('social_package', 'recipients', 2025): '187764',
                   ('social_package', 'amount', 2025): '544241359'}
        for (programme, measure, year), expected in anchors.items():
            with self.subTest(programme=programme, measure=measure):
                row = values[(programme, measure, 'country.georgia', year)]
                self.assertEqual(row['value'], expected)
                self.assertEqual(row['value_status'], 'official' if measure != 'amount' else 'calculated')

    def test_partial_months(self):
        values = served_values()
        self.assertEqual(values[('workplace_injury', 'amount', 'country.georgia', 2013)]['months'], '9')
        for year in (2020, 2021):
            self.assertEqual(values[('covid_vulnerable_compensation', 'amount', 'country.georgia', year)]['months'], '6')
        self.assertEqual(values[('pension', 'amount', 'country.georgia', 2025)]['months'], '12')
        self.assertEqual(values[('pension', 'recipients', 'country.georgia', 2025)]['source_sheet'].lower()[:3], 'dec')
        years = {key[3] for key in values}
        self.assertEqual((min(years), max(years)), (2013, 2025))

    def test_tbilisi(self):
        values = served_values()
        self.assertFalse([key for key in values if key[2] == '04'])
        fields = {'recipients': 'recipients', 'persons': 'persons', 'employment_families': 'emp_families',
                  'amount': 'amount_gel', 'employment_amount': 'amount_emp_gel'}
        checked = 0
        for row in read('ssa-programmes-areas-annual.csv'):
            if row['area_id'] != '04' or not 2013 <= int(row['year']) <= 2025:
                continue
            for measure, field in fields.items():
                key = (row['programme'], measure, 'region.tbilisi', int(row['year']))
                if row.get(field) and key in values:
                    self.assertEqual(values[key]['value'], row[field], key)
                    checked += 1
        programmes = {key[0] for key in values if key[2] == 'region.tbilisi'}
        self.assertEqual(programmes, {'pension', 'pension_idp', 'pension_highmountain', 'subsistence_allowance',
                                      'tsa_registered'})
        self.assertEqual(checked, 145)  # every Tbilisi figure of these measures in the reviewed yearly file, 2013–2025

    def test_social_package_groups(self):
        values = served_values()
        # SSA's May 2022 printed money total (socpackage-02 L85) is 56 GEL less than its own group columns.
        recorded = {(2022, 'amount'): Decimal(56)}
        for year in range(2013, 2026):
            for measure, tolerance in (('recipients', Decimal(0)), ('amount', Decimal(3))):
                def group(name):
                    row = values.get(('social_package_group', f'group.{name}.{measure}', 'country.georgia', year))
                    return Decimal(row['value']) if row else None
                with self.subTest(year=year, measure=measure):
                    total = group('total')
                    self.assertEqual(str(total), values[('social_package', measure, 'country.georgia', year)]['value'])
                    members = sum(group(name) or Decimal(0) for name in GROUP_MEMBERS)
                    self.assertLessEqual(abs(members - total - recorded.get((year, measure), 0)), tolerance)
                    # The severity columns start in October 2017: 2017 money covers only their three months.
                    if year >= 2017 and (measure == 'recipients' or year > 2017):
                        self.assertLessEqual(abs(sum(group(name) for name in DISABILITY_PARTS) - group('disability')),
                                             tolerance)
        disability = values[('social_package_group', 'group.disability.recipients', 'country.georgia', 2025)]
        self.assertEqual(disability['value'], str(18819 + 32151 + 73514 + 5998))
        self.assertEqual(disability['value_status'], 'calculated')
        war = [key[3] for key in values if key[:3] == ('social_package_group', 'group.war_participants.recipients',
                                                       'country.georgia')]
        self.assertEqual(min(war), 2019)

    def test_2019_money_follows_the_people_table_headings(self):
        # January–May 2019 money column J (746,479 GEL) is utility-subsidy recipients, as the people table prints it.
        values = served_values()
        war = values[('social_package_group', 'group.war_participants.amount', 'country.georgia', 2019)]
        self.assertEqual((war['value'], war['months']), ('1749795', '7'))
        self.assertNotIn('January!', war['source_cell'])
        other = values[('social_package_group', 'group.other.amount', 'country.georgia', 2019)]
        self.assertEqual(other['value'], '3910297')
        self.assertIn('January!I91+J91+K91', other['source_cell'])

    def test_cells(self):
        import random
        rows = random.Random(20251231).sample(served_rows(), 20)
        books = {}
        for row in rows:
            with self.subTest(row={key: row[key] for key in ('programme', 'measure', 'geography_id', 'year')}):
                name = row['source_workbook']
                if name not in books:
                    books[name] = [sheet for sheet in prepare.read_workbook(ROOT / 'official' / 'workbooks' / name)
                                   if not sheet['hidden'] and prepare.EXPLANATIONS not in sheet['name']]
                sheets = {sheet['name']: sheet for sheet in books[name]}
                if ';' in row['source_cell']:
                    readings = [item.split('!') for item in row['source_cell'].split(';')]
                elif row['source_sheet'] == '*':
                    readings = [(sheet['name'], row['source_cell']) for sheet in books[name]
                                if prepare.month_of(sheet['name']) is not None]
                else:
                    readings = [(row['source_sheet'], row['source_cell'])]
                total = Decimal(0)
                for sheet_name, expression in readings:
                    for ref in expression.split('+'):
                        column, number = prepare.re.fullmatch(r'([A-Z]+)(\d+)', ref).groups()
                        total += sheets[sheet_name]['cells'][int(number)][column]
                if row['source_sheet'] == '*':
                    self.assertEqual(len(readings), int(row['months']))
                tolerance = Decimal(1) if 'amount' in row['measure'] else Decimal('0.000001')
                self.assertLessEqual(abs(total - Decimal(row['value'])), tolerance)


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
