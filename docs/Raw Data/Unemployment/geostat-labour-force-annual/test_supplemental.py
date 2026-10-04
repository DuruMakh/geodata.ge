"""Checks for the approved education and long-term unemployment extension."""

import csv
import copy
import io
import sys
import unittest

sys.dont_write_bytecode = True
import prepare


class SupplementalDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.products, cls.report = prepare.build()

    def rows(self, name):
        return list(csv.DictReader(io.StringIO(self.products[name].decode('utf-8-sig'))))

    def test_education_has_published_rates_for_six_years_and_three_sexes(self):
        rows = self.rows('education-annual.csv')
        self.assertEqual(len(rows), 216)
        self.assertEqual({r['year'] for r in rows}, {str(y) for y in range(2020, 2026)})
        self.assertEqual({r['sex'] for r in rows}, {'total', 'women', 'men'})
        self.assertEqual({r['unit'] for r in rows}, {'percent'})
        self.assertEqual(len({r['group_id'] for r in rows}), 4)
        self.assertFalse(any(r['group_id'] == 'education.no_education' for r in rows))
        self.assertEqual(self.report['supplemental']['education_unpublished_rate_combinations'], 54)

    def test_education_control_extract_preserves_every_published_value(self):
        rows = self.rows('education-source-observations.csv')
        self.assertEqual(len(rows), 810)
        no_education = [r for r in rows if r['group_id'] == 'education.no_education']
        self.assertEqual(len(no_education), 90)
        self.assertTrue(all(r['indicator_id'].startswith('share_of_') for r in no_education))

    def test_long_term_has_separate_count_rate_and_unemployed_share(self):
        rows = self.rows('long-term-unemployment-annual.csv')
        self.assertEqual(len(rows), 54)
        self.assertEqual({r['year'] for r in rows}, {str(y) for y in range(2020, 2026)})
        self.assertEqual({r['sex'] for r in rows}, {'total', 'women', 'men'})
        latest = {r['indicator_id']: r for r in rows if r['year'] == '2025' and r['sex'] == 'total'}
        self.assertEqual(latest['long_term_unemployed']['published_value'], '79.4')
        self.assertEqual(latest['long_term_unemployment_rate']['published_value'], '4.9')
        self.assertEqual(latest['long_term_unemployed_share']['published_value'], '35.5')
        self.assertEqual(latest['long_term_unemployed']['unit'], 'thousand_persons')

    def test_original_dataset_and_overall_validation_are_preserved(self):
        self.assertEqual(len(self.rows('unemployment-annual.csv')), 2872)
        self.assertEqual(self.report['status'], 'passed')
        self.assertEqual(self.report['supplemental']['source_observation_count'], 864)
        self.assertEqual(self.report['supplemental']['primary_observation_count'], 270)
        self.assertEqual(self.report['supplemental']['failed_check_count'], 0)

    def test_missing_long_term_value_is_rejected(self):
        import supplemental
        _, groups = self.reference_groups()
        rows = self.rows('long-term-unemployment-annual.csv')
        next(r for r in rows if r['year'] == '2025' and r['sex'] == 'total' and
             r['indicator_id'] == 'long_term_unemployed')['value'] = ''
        _, failures = supplemental.validate(self.rows('education-source-observations.csv'), rows, groups)
        self.assertTrue(any(f.get('reason') == 'missing input' for f in failures))

    def reference_groups(self):
        import json
        manifest = json.loads((prepare.ROOT / 'source-manifest.json').read_text())
        observations = [r for record in manifest if record['source_id'] in prepare.LAYOUTS for r in prepare.extract(record)]
        groups, _, _, _ = prepare.validate(observations, manifest)
        return observations, groups

    def test_long_term_unemployed_share_cannot_replace_the_labour_force_rate(self):
        import supplemental
        _, groups = self.reference_groups()
        rows = self.rows('long-term-unemployment-annual.csv')
        next(r for r in rows if r['year'] == '2025' and r['sex'] == 'total' and
             r['indicator_id'] == 'long_term_unemployment_rate')['value'] = '35.5'
        _, failures = supplemental.validate(self.rows('education-source-observations.csv'), rows, groups)
        self.assertTrue(any(f['check'] == 'long_term_denominator' for f in failures))

    def test_education_rates_fail_if_a_published_value_is_removed(self):
        import supplemental
        _, groups = self.reference_groups()
        rows = self.rows('education-source-observations.csv')
        next(r for r in rows if r['year'] == '2025' and r['sex'] == 'total' and
             r['group_id'] == 'education.higher' and r['indicator_id'] == 'unemployment_rate')['value'] = ''
        _, failures = supplemental.validate(rows, self.rows('long-term-unemployment-annual.csv'), groups)
        self.assertTrue(failures)

    def test_duplicate_supplemental_records_fail(self):
        import supplemental
        _, groups = self.reference_groups()
        rows = self.rows('education-source-observations.csv')
        with self.assertRaisesRegex(ValueError, 'Duplicate supplemental observation'):
            supplemental.validate(rows + [copy.copy(rows[0])], self.rows('long-term-unemployment-annual.csv'), groups)


if __name__ == '__main__':
    unittest.main()
