"""Regression tests for the Geostat Labour Force Survey detail research package (stdlib unittest only).

Run from this folder: python3 -I -m unittest test_validation
"""

from collections import Counter
import csv
from decimal import Context, Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

# The indicator list, written out here independently of prepare.py (the order Task 2's LABOUR_INDICATORS also uses)
JOBS_ITEMS = ['total', 'sector_a', 'sector_b_e', 'sector_f', 'sector_g', 'sector_h', 'sector_i', 'sector_j', 'sector_k', 'sector_l', 'sector_m',
              'sector_n', 'sector_o', 'sector_p', 'sector_q', 'sector_r', 'sector_s', 'sector_t', 'sector_u', 'not_identified']
HOURS_ITEMS = [item for item in JOBS_ITEMS if item not in ('sector_l', 'sector_u', 'not_identified')]
EXPECTED_IDS = (
    [f'labour.jobs.{group}.{item}' for group in ('all', 'women', 'men') for item in JOBS_ITEMS]
    + [f'labour.hours.{group}.{item}' for group in ('all', 'women', 'men', 'urban', 'rural') for item in HOURS_ITEMS]
    + [f'labour.informal.{item}' for item in ('total', 'women', 'men', 'urban', 'rural')]
    + [f'labour.underuse.{item}' for item in ('unemployment_rate', 'time_related', 'potential', 'composite')]
    + [f'labour.neet.{band}.{item}' for band in ('age_15_24', 'age_15_29') for item in ('total', 'women', 'men')]
)
SECTOR_ITEMS = JOBS_ITEMS[1:]  # the 19 rows under a group's total


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def published(value):
    """One decimal, after first rounding to 15 significant digits, half up (written out again here)."""
    return str(Context(prec=15, rounding=ROUND_HALF_UP).create_decimal(Decimal(value)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))


class LabourDetailPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()

    def values(self, indicator_id):
        return {row['year']: Decimal(row['value']) for row in self.rows if row['indicator_id'] == indicator_id}

    def test_counts(self):
        self.assertEqual(len(self.rows), 1014)
        self.assertEqual(len({(row['indicator_id'], row['year']) for row in self.rows}), len(self.rows))
        by_source = Counter(row['source_id'] for row in self.rows)
        self.assertEqual(dict(by_source), {
            'geostat_lfs_jobs_industry': 420, 'geostat_lfs_hours_sex': 300, 'geostat_lfs_hours_settlement': 204,
            'geostat_lfs_informal': 30, 'geostat_lfs_underuse': 24, 'geostat_lfs_neet': 36})
        # hours by sex: all 102 + women 102 + men 96
        hours_sex = Counter(row['indicator_id'].split('.')[2] for row in self.rows if row['source_id'] == 'geostat_lfs_hours_sex')
        self.assertEqual(dict(hours_sex), {'all': 102, 'women': 102, 'men': 96})
        jobs = Counter(row['indicator_id'].split('.')[2] for row in self.rows if row['source_id'] == 'geostat_lfs_jobs_industry')
        self.assertEqual(dict(jobs), {'all': 180, 'women': 120, 'men': 120})
        prepare.validate(self.rows)

    def test_indicator_order(self):
        self.assertEqual(len(EXPECTED_IDS), 160)
        self.assertEqual(list(prepare.SPECS), EXPECTED_IDS)
        seen = list(dict.fromkeys(row['indicator_id'] for row in self.rows))
        self.assertEqual(seen, [indicator for indicator in EXPECTED_IDS if indicator != 'labour.hours.men.sector_t'])
        order = {indicator: number for number, indicator in enumerate(EXPECTED_IDS)}
        self.assertEqual([(order[row['indicator_id']], row['year']) for row in self.rows],
                         sorted((order[row['indicator_id']], row['year']) for row in self.rows))
        units = {indicator: ('thousand_persons' if '.jobs.' in indicator else 'hours' if '.hours.' in indicator else 'percent') for indicator in EXPECTED_IDS}
        for row in self.rows:
            self.assertEqual(row['unit'], units[row['indicator_id']])
            self.assertEqual((row['basis'], row['value_status']), ('actual', 'survey_estimate'))

    def test_anchor_values(self):
        for indicator_id, year, expected in (
            ('labour.jobs.all.total', 2025, '1389.7'), ('labour.jobs.all.sector_a', 2017, '289.5'), ('labour.jobs.all.sector_a', 2025, '218.3'),
            ('labour.jobs.all.sector_f', 2017, '84.3'), ('labour.jobs.all.sector_f', 2025, '122.6'),
            ('labour.hours.all.total', 2025, '41.0'), ('labour.informal.total', 2025, '28.3'),
            ('labour.underuse.composite', 2020, '39.5'), ('labour.underuse.composite', 2025, '27.8'),
            ('labour.neet.age_15_24.total', 2025, '17.6'), ('labour.neet.age_15_29.total', 2025, '23.4'),
        ):
            self.assertEqual(find(self.rows, indicator_id, year)['published_value'], expected, f'{indicator_id} {year}')

    def test_value_is_the_stored_text(self):
        # A value is the cell's <v> text, kept exactly, including an exponent; the published value is derived from it
        row = find(self.rows, 'labour.jobs.all.not_identified', 2024)
        self.assertEqual((row['value'], row['published_value']), ('1.6567258500672373E-2', '0.0'))
        self.assertEqual(find(self.rows, 'labour.jobs.all.total', 2025)['value'], '1389.6524984883797')
        for row in self.rows:
            self.assertEqual(row['published_value'], published(row['value']), row)
        # 15 significant digits first, then one decimal, half up: 0.05 is 0.1 and 0.0499999999999999 (15 digits: 0.0500000000000000) is too
        self.assertEqual(prepare.published_value('0.05'), '0.1')
        self.assertEqual(prepare.published_value('0.04999999999999999'), '0.1')
        self.assertEqual(prepare.published_value('0.0499999999999'), '0.0')
        self.assertEqual(prepare.published_value('28.249999999999996'), '28.3')
        self.assertEqual(prepare.published_value('0'), '0.0')

    def test_sums(self):
        for group in ('all', 'women', 'men'):
            total = self.values(f'labour.jobs.{group}.total')
            parts = {item: self.values(f'labour.jobs.{group}.{item}') for item in SECTOR_ITEMS}
            self.assertEqual(sorted(total), list(range(2017, 2026)) if group == 'all' else list(range(2020, 2026)))
            for year, whole in total.items():
                self.assertLess(abs(sum(part[year] for part in parts.values()) - whole), Decimal('0.000001'), f'{group} {year}')
        # women and men add up to all, for the years the sex sheet covers
        for year in range(2020, 2026):
            both = self.values('labour.jobs.women.total')[year] + self.values('labour.jobs.men.total')[year]
            self.assertLess(abs(both - self.values('labour.jobs.all.total')[year]), Decimal('0.000001'), year)

    def test_placeholders(self):
        self.assertEqual([row for row in self.rows if row['indicator_id'] == 'labour.hours.men.sector_t'], [])
        # every cell of that row is "..." or blank in the workbook
        cells = prepare.sheet_rows('geostat_lfs_hours_sex', '1')
        row = cells[prepare.locate('labour.hours.men.sector_t')]
        printed = [prepare.clean(cell['value']) for column, cell in row.items() if column != 'A']
        self.assertEqual(printed, ['...'] * 5)  # E is blank
        self.assertNotIn('E', {column for column in row})
        zero = find(self.rows, 'labour.jobs.all.not_identified', 2018)
        self.assertEqual((zero['value'], zero['published_value']), ('0', '0.0'))  # a published 0 is a real zero and is served
        self.assertEqual(zero['source_cell'], 'C23')
        self.assertTrue(all(row['value'] not in prepare.PLACEHOLDERS and row['value'] != '' for row in self.rows))

    def test_hours_blocks_agree(self):
        # Table 10's first (all-persons) block equals table 09's, cell for cell, and is checked but never emitted
        self.assertEqual(len(prepare.HOURS_ITEMS), 17)
        for item in prepare.HOURS_ITEMS:
            sex = prepare.cells_of(f'labour.hours.all.{item}')
            settlement = prepare.cells_of(f'check.hours_settlement_all.{item}')
            self.assertEqual(sorted(sex), list(range(2020, 2026)))
            self.assertEqual(sorted(settlement), sorted(sex))
            for year in sex:  # the two tables differ by floating-point noise of about 1e-13 in the stored text
                self.assertLess(abs(sex[year]['value'] - settlement[year]['value']), Decimal('0.000000001'), f'{item} {year}')
                self.assertEqual(prepare.published_value(sex[year]['raw']), prepare.published_value(settlement[year]['raw']), f'{item} {year}')
                self.assertEqual((sex[year]['cell']), (settlement[year]['cell']))
        self.assertEqual({row['source_id'] for row in self.rows if '.hours.all.' in row['indicator_id']}, {'geostat_lfs_hours_sex'})

    def test_no_quarterly_or_2026(self):
        years = {row['year'] for row in self.rows}
        self.assertTrue(years <= set(range(2017, 2026)))
        self.assertEqual(min(years), 2017)
        self.assertEqual(max(years), 2025)
        self.assertEqual({row['year'] for row in self.rows if not row['indicator_id'].startswith('labour.jobs.all.')}, set(range(2020, 2026)))

    def test_cells_are_where_the_labels_are(self):
        self.assertEqual(find(self.rows, 'labour.jobs.all.total', 2017)['source_cell'], 'B4')
        self.assertEqual(find(self.rows, 'labour.jobs.all.total', 2025)['source_cell'], 'J4')
        women = find(self.rows, 'labour.jobs.women.total', 2020)
        self.assertEqual((women['source_sheet'], women['source_cell']), ('NACE2 sex', 'B4'))
        self.assertEqual(find(self.rows, 'labour.jobs.men.total', 2020)['source_cell'], 'B27')
        self.assertEqual(find(self.rows, 'labour.hours.women.total', 2020)['source_cell'], 'B24')
        self.assertEqual(find(self.rows, 'labour.hours.men.sector_s', 2025)['source_cell'], 'G59')
        self.assertEqual(find(self.rows, 'labour.hours.rural.sector_t', 2025)['source_cell'], 'G60')
        self.assertEqual(find(self.rows, 'labour.informal.rural', 2025)['source_cell'], 'G7')
        self.assertEqual(find(self.rows, 'labour.underuse.composite', 2025)['source_cell'], 'G6')
        self.assertEqual(find(self.rows, 'labour.neet.age_15_24.men', 2020)['source_cell'], 'B5')
        self.assertEqual(find(self.rows, 'labour.neet.age_15_29.women', 2025)['source_cell'], 'G10')
        self.assertEqual(find(self.rows, 'labour.neet.age_15_29.total', 2025)['source_sheet'], '1')

    def test_altered_cell_fails(self):
        def copy():
            return [dict(row) for row in self.rows]

        def mutated(indicator_id, year, **change):
            rows = copy()
            find(rows, indicator_id, year).update(change)
            return rows

        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(mutated('labour.informal.total', 2025, value='28.3', published_value='28.3'))
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(mutated('labour.informal.total', 2025, published_value='28.4'))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(mutated('labour.informal.total', 2025, source_cell='F3'))
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])])
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [dict(find(self.rows, 'labour.informal.total', 2025), year=2026)])
        for field, wrong in (('unit', 'hours'), ('basis', 'planned'), ('value_status', 'official'), ('source_id', 'geostat_lfs_neet')):
            with self.assertRaisesRegex(ValueError, 'Unexpected'):
                prepare.validate(mutated('labour.informal.total', 2025, **{field: wrong}))
        # a sector part changed in both value and published value breaks the sum before it breaks the source check
        part = find(self.rows, 'labour.jobs.women.sector_g', 2022)
        bumped = str(Decimal(part['value']) + 1)
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(mutated('labour.jobs.women.sector_g', 2022, value=bumped, published_value=prepare.published_value(bumped)))

    def test_georgian_copies_hold_the_same_numbers(self):
        self.assertEqual(len(prepare.GEORGIAN_PAIRS), 6)
        compared = 0
        for ka, en in prepare.GEORGIAN_PAIRS:
            self.assertEqual(prepare.numeric_sheets(ka), prepare.numeric_sheets(en))
            for index in range(prepare.numeric_sheets(en)):
                english, georgian = prepare.numeric_cells(en, index), prepare.numeric_cells(ka, index)
                self.assertEqual(georgian, english, f'{ka} sheet {index + 1}')
                compared += len(english)
        self.assertGreater(compared, 1000)

    def test_manifest(self):
        records = prepare.manifest()
        self.assertEqual(len(records), 14)
        self.assertEqual([record['source_id'] for record in records[:6]], [
            'geostat_lfs_jobs_industry', 'geostat_lfs_hours_sex', 'geostat_lfs_hours_settlement', 'geostat_lfs_informal',
            'geostat_lfs_underuse', 'geostat_lfs_neet'])
        self.assertEqual([record['source_id'] for record in records[6:12]], [
            'geostat_lfs_jobs_industry_ka', 'geostat_lfs_hours_sex_ka', 'geostat_lfs_hours_settlement_ka', 'geostat_lfs_informal_ka',
            'geostat_lfs_underuse_ka', 'geostat_lfs_neet_ka'])
        self.assertEqual([record['source_id'] for record in records[12:]], ['geostat_lfs_detail_page', 'geostat_lfs_detail_page_ka'])
        for record in records:
            data = (prepare.ROOT / record['local_file']).read_bytes()
            self.assertEqual((record['sha256'], record['bytes']), (hashlib.sha256(data).hexdigest().upper(), len(data)))
            self.assertEqual(record['local_file'], record['local_file'].lower())
        self.assertEqual(records[0]['resolved_file_url'], 'https://www.geostat.ge/media/78741/07-Employment-by-branch-NACE_Eng.xlsx')
        self.assertEqual(records[11]['resolved_file_url'], 'https://www.geostat.ge/media/78730/14-NEET.xlsx')

    def test_generated_files_are_current(self):
        prepare.build(check=True)  # raises if a committed generated file differs from a rebuild
        with (prepare.ROOT / 'labour-annual.csv').open('rb') as handle:
            data = handle.read()
        self.assertTrue(data.startswith(b'\xef\xbb\xbf'))
        lines = list(csv.DictReader(data.decode('utf-8-sig').splitlines()))
        self.assertEqual(len(lines), 1014)
        self.assertEqual(list(lines[0]), ['year', 'indicator_id', 'value', 'published_value', 'unit', 'basis', 'value_status', 'source_id',
                                          'source_sheet', 'source_cell'])
        report = json.loads((prepare.ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(report['primary_observation_count'], 1014)
        self.assertEqual((report['reconciliation_failed_count'], report['imputed_values'], report['placeholder_cells_in_served_values']), (0, 0, 0))
        self.assertEqual(report['observations_by_source']['geostat_lfs_hours_settlement'], 204)


if __name__ == '__main__':
    unittest.main()
