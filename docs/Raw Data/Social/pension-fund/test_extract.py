"""Regression checks for the Pension Fund research package: the extracted values, the recorded differences and the committed outputs.

    python3 -I test_extract.py
"""

import csv
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))  # also works under python -I, which leaves the script's folder off the path
import extract  # noqa: E402

YEARS = list(range(2019, 2026))

# Money as printed, in thousand GEL; None where the statement prints no line or a dash.
MONEY = {
    'savings': [508031, 1164657, 1980291, 2947151, 4357160, 6060268, 8237530],
    'net_assets': [547844, 1213129, 2048024, 3027208, 4484620, 6191340, 8365433],
    'contributions': [548315, 571148, 658014, 802753, 996862, 1179226, 1431780],
    'contributions_private': [294314, 319679, 375117, 469120, 587066, 692043, 843224],
    'contributions_public': [88663, 85307, 94283, 108859, 137625, 175799, 217567],
    'contributions_state': [165338, 166162, 188614, 224774, 272171, 311384, 370989],
    'interest': [17038, 87026, 163741, 218227, 254614, 356201, 461555],
    'securities_gains': [None, None, None, -31187, 168430, 197986, 319147],
    'dividends': [None, None, None, 3543, 18598, 25485, 33223],
    'payouts': [57322, 1548, 1988, 5787, 15014, 40110, 63609],
}
COUNTS = {
    'members': [958226, 1105041, 1234732, 1359035, 1478720, 1581832, 1705365],
    'left': [164198, 3098, 1605, 1218, 1165, 727, 540],
    'paid_persons': [185, 466, 839, 1853, 3747, 8363, 11367],
    'employers': [61173, 71600, 82801, 94994, 108047, 119966, 145780],
}
RETURN = ['6.1', '12.9', '9.5', '7.3', '12.3', '11.5', '11.8']

MEASURES = list(MONEY) + list(COUNTS) + ['return']
STOCKS = {'savings', 'net_assets', 'members', 'employers'}
UNITS = {**{m: 'gel' for m in MONEY}, 'members': 'persons', 'left': 'persons', 'paid_persons': 'persons',
         'employers': 'employers', 'return': 'percent'}
SERVED_MONEY = ['2020-IFRS.pdf', '2020-IFRS.pdf', '2022-IFRS-GE.pdf', '2023-IFRS-GE.pdf', '2024-IFRS-GE.pdf',
                '2025-IFRS.pdf', '2025-IFRS.pdf']
SOURCE_IDS = {'2020-IFRS.pdf': 'pension_fund_ifrs_2020', '2022-IFRS-GE.pdf': 'pension_fund_ifrs_2022',
              '2023-IFRS-GE.pdf': 'pension_fund_ifrs_2023', '2024-IFRS-GE.pdf': 'pension_fund_ifrs_2024',
              '2025-IFRS.pdf': 'pension_fund_ifrs_2025', 'Annual_Rep_2025_geo.pdf': 'pension_fund_report_2025'}


def expected_values():
    values = {}
    for measure, series in MONEY.items():
        for year, thousands in zip(YEARS, series):
            if thousands is not None:
                values[(measure, year)] = str(thousands * 1000)
    for measure, series in COUNTS.items():
        for year, count in zip(YEARS, series):
            values[(measure, year)] = str(count)
    for year, text in zip(YEARS, RETURN):
        values[('return', year)] = text
    return values


# The differences found when the served values and the earlier reports were compared with the originals.
# Both lists were checked by hand against the PDFs; a different list means a source or a reading rule changed.
RECORDED_RESTATEMENTS = []
RECORDED_REVISIONS = [
    # (measure, year, earlier report, earlier value, served value)
    ('members', 2019, '2019-annual-report.pdf', '960394', '958226'),
    ('left', 2019, '2019-annual-report.pdf', '164096', '164198'),
    ('members', 2020, '2020-annual-report.pdf', '1106683', '1105041'),
    ('left', 2020, '2020-annual-report.pdf', '3377', '3098'),
    ('paid_persons', 2020, '2020-annual-report.pdf', '430', '466'),
    ('members', 2021, '2021-annual-report.pdf', '1235938', '1234732'),
    ('left', 2021, '2021-annual-report.pdf', '1880', '1605'),
    ('paid_persons', 2021, '2021-annual-report.pdf', '741', '839'),
    ('employers', 2021, '2021-annual-report.pdf', '82795', '82801'),
    ('members', 2022, '2022-annual-report.pdf', '1359887', '1359035'),
    ('left', 2022, '2022-annual-report.pdf', '1564', '1218'),
    ('paid_persons', 2022, '2022-annual-report.pdf', '1615', '1853'),
    ('return', 2023, '2023-annual-report.pdf', '11.9', '12.3'),
    ('return', 2024, '2024-annual-report.pdf', '11.6', '11.5'),
]


def read(name):
    with open(ROOT / name, encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


class ExtractedValues(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = extract.extract()

    def test_rows_are_exactly_the_fixture(self):
        got = {(row['measure'], row['year']): row['value'] for row in self.rows}
        self.assertEqual(len(got), len(self.rows), 'a measure and year appears twice')
        self.assertEqual(got, expected_values())
        self.assertEqual(len(self.rows), 99)

    def test_rows_are_sorted_by_measure_order_then_year(self):
        order = [(row['measure'], row['year']) for row in self.rows]
        self.assertEqual(order, sorted(order, key=lambda key: (MEASURES.index(key[0]), key[1])))

    def test_unit_and_months(self):
        for row in self.rows:
            with self.subTest(measure=row['measure'], year=row['year']):
                self.assertEqual(row['unit'], UNITS[row['measure']])
                self.assertEqual(row['months'], 1 if row['measure'] in STOCKS else 12)

    def test_each_year_comes_from_its_served_document(self):
        for row in self.rows:
            with self.subTest(measure=row['measure'], year=row['year']):
                document = 'Annual_Rep_2025_geo.pdf' if row['measure'] in COUNTS or row['measure'] == 'return' \
                    else SERVED_MONEY[row['year'] - 2019]
                self.assertEqual(row['document'], document)
                self.assertEqual(row['source_id'], SOURCE_IDS[document])
                self.assertGreaterEqual(row['page'], 1)
                self.assertTrue(row['line'])

    def test_a_dash_or_missing_line_gives_no_row(self):
        have = {(row['measure'], row['year']) for row in self.rows}
        for measure in ('securities_gains', 'dividends'):
            for year in (2019, 2020, 2021):
                self.assertNotIn((measure, year), have)

    def test_money_is_in_whole_gel_and_the_loss_is_negative(self):
        by_key = {(row['measure'], row['year']): row['value'] for row in self.rows}
        self.assertEqual(by_key[('securities_gains', 2022)], '-31187000')
        self.assertEqual(by_key[('savings', 2025)], '8237530000')

    def test_contribution_parts_sum_to_the_total_every_year(self):
        by_key = {(row['measure'], row['year']): int(row['value']) for row in self.rows if row['unit'] == 'gel'}
        for year in YEARS:
            with self.subTest(year=year):
                parts = sum(by_key[(f'contributions_{part}', year)] for part in ('private', 'public', 'state'))
                self.assertEqual(parts, by_key[('contributions', year)])

    def test_the_2024_return_is_11_5_and_the_2024_report_text_says_11_6(self):
        by_key = {(row['measure'], row['year']): row['value'] for row in self.rows}
        self.assertEqual(by_key[('return', 2024)], '11.5')
        revision = [r for r in extract.analyse()['revisions'] if (r['measure'], r['year']) == ('return', 2024)]
        self.assertEqual(len(revision), 1)
        self.assertEqual(revision[0]['earlier'], '11.6')
        self.assertEqual(revision[0]['served'], '11.5')
        self.assertEqual(revision[0]['document'], '2024-annual-report.pdf')
        self.assertIn('text', revision[0]['where'])


class RecordedDifferences(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.analysis = extract.analyse()

    def test_restatements_are_the_recorded_ones(self):
        got = [(r['measure'], r['year'], r['document'], r['own'], r['served']) for r in self.analysis['restatements']]
        self.assertEqual(got, RECORDED_RESTATEMENTS)

    def test_revisions_are_the_recorded_ones(self):
        got = [(r['measure'], r['year'], r['document'], r['earlier'], r['served']) for r in self.analysis['revisions']]
        self.assertEqual(got, RECORDED_REVISIONS)

    def test_every_check_passes(self):
        self.assertEqual(self.analysis['failures'], [])


class RejectedInputs(unittest.TestCase):
    def test_parts_that_do_not_add_up_are_a_failure(self):
        figures = {'contributions_private': 1, 'contributions_public': 1, 'contributions_state': 1, 'contributions': 4}
        self.assertEqual(len(extract.check_statement_column('x', 2020, figures)), 1)

    def test_a_dash_is_no_value_and_brackets_are_negative(self):
        self.assertIsNone(extract.parse_number('-'))
        self.assertEqual(extract.parse_number('(31,187)'), -31187)
        self.assertEqual(extract.parse_number('1,164,657'), 1164657)
        self.assertEqual(extract.parse_number('1 165'), 1165)

    def test_the_savings_line_is_the_one_that_follows_the_prior_balance(self):
        lines = ['Balance at 1 January        100     50', 'Balance at 31 December     300    100',
                 'Balance at 1 January        110     90', 'Balance at 31 December     130    110']
        found = extract.find_roll_forward(lines, 'en', 2, prior=90)
        self.assertEqual(found['closing'], (130, 110))


class CommittedOutputs(unittest.TestCase):
    def test_csv_is_what_extract_produces(self):
        rows = read('pension-fund-annual.csv')
        self.assertEqual(list(rows[0]), ['measure', 'year', 'value', 'unit', 'months', 'source_id', 'document', 'page', 'line'])
        got = [{**row, 'year': int(row['year']), 'months': int(row['months']), 'page': int(row['page'])} for row in rows]
        self.assertEqual(got, extract.extract())

    def test_csv_starts_with_a_byte_order_mark(self):
        self.assertEqual((ROOT / 'pension-fund-annual.csv').read_bytes()[:3], b'\xef\xbb\xbf')

    def test_report_says_passed(self):
        report = json.loads((ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        self.assertEqual(list(report), ['passed', 'failures', 'rows', 'restatements', 'revisions', 'csv_sha256'])
        self.assertIs(report['passed'], True)
        self.assertEqual(report['failures'], [])
        self.assertEqual(report['rows'], 99)

    def test_report_names_the_csv_it_was_written_with(self):
        report = json.loads((ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        self.assertEqual(report['csv_sha256'], extract.sha256_of(ROOT / 'pension-fund-annual.csv'))

    def test_manifest_matches_the_files(self):
        manifest = json.loads((ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(sorted(entry['used_for'] for entry in manifest).count('served'), 6)
        self.assertEqual(len(manifest), 13)
        self.assertEqual(extract.check_manifest(), [])
        for entry in manifest:
            self.assertEqual(sorted(entry), ['bytes', 'document', 'local_file', 'retrieved_on', 'sha256', 'source_id', 'url', 'used_for'])
            self.assertTrue(entry['url'].startswith('https://site-api.pensions.ge/uploads/docs/reports/'))
            self.assertEqual(entry['retrieved_on'], '2026-10-21')


if __name__ == '__main__':
    unittest.main()
