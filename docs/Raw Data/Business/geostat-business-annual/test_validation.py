"""Regression tests for the annual Geostat business statistics research package (stdlib unittest only)."""

import csv
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
import re
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

SECTORS = ['sector_a', 'sector_b_e', 'sector_f', 'sector_g', 'sector_h', 'sector_i', 'sector_j', 'sector_l', 'sector_m',
           'sector_n', 'sector_p', 'sector_q', 'sector_r', 'sector_s']
SECTIONS = [f'sector_{letter}' for letter in 'abcdefghijklmnpqrs']
REGIONS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
           'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
           'region_kvemo_kartli', 'region_shida_kartli']
SIZES = ['size_large', 'size_medium', 'size_small']
SURVEY = ('turnover', 'employed', 'investment', 'profit', 'loss')
FIRMS = ('active', 'births', 'deaths')
TOLERANCE = {'gel_million': Decimal('0.15'), 'persons': Decimal(2), 'enterprises': Decimal(0)}


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def series(rows, indicator_id):
    return {row['year']: Decimal(row['value']) for row in rows if row['indicator_id'] == indicator_id}


def patched(rows, indicator_id, year, delta):
    """A copy with one value moved by delta and its published value kept consistent, so only the check under test fails."""
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, year)
    row['value'] = str(Decimal(row['value']) + delta)
    row['published_value'] = prepare.published(row['value'], prepare.UNIT_PLACES[row['unit']])
    return copy


class BusinessPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        with open(prepare.ROOT / 'coverage.csv', encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))

    def test_counts(self):
        counts = Counter(row['indicator_id'] for row in self.rows)
        expected = {row['indicator_id']: int(row['observations']) for row in self.coverage}
        self.assertEqual(dict(counts), expected)
        self.assertEqual(len(self.rows), sum(expected.values()))
        print(f'\n{len(self.rows)} observations')
        for row in self.coverage:
            years = series(self.rows, row['indicator_id'])
            self.assertEqual((min(years), max(years)), (int(row['first_year']), int(row['last_year'])), row['indicator_id'])
            gaps = [year for year in range(min(years), max(years) + 1) if year not in years]
            self.assertEqual(row['unavailable_years'], ';'.join(map(str, gaps)), row['indicator_id'])
        # The 2016 and 2019 activity sheets print no death-rate column; nothing is calculated in its place.
        self.assertEqual({row['unavailable_years'] for row in self.coverage if row['unavailable_years']}, {'2016;2019'})
        self.assertEqual(sum(row['value_status'] != 'official' for row in self.rows), 0)
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        # A change too small to move the published rate is still caught by re-reading the cell.
        copy = patched(self.rows, 'business.birth_rate.sector_c', 2020, Decimal('0.001'))
        self.assertEqual(find(copy, 'business.birth_rate.sector_c', 2020)['published_value'],
                         find(self.rows, 'business.birth_rate.sector_c', 2020)['published_value'])
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, 'business.turnover.sector_g', 2020, Decimal('0.01')))
        copy = [dict(row) for row in self.rows]
        find(copy, 'business.employed.total', 2010)['published_value'] = '1'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])

    def test_text_numbers(self):
        # A text cell is read as the number it shows once its spaces are removed, never by guessing.
        self.assertEqual(prepare.cell_number({'kind': 's', 'value': ' 5 054 ', 'cell': 'H25'}), Decimal('5054'))
        self.assertEqual(prepare.cell_number({'kind': 's', 'value': '5054', 'cell': 'H25'}), Decimal('5054'))
        with self.assertRaises(ValueError):
            prepare.cell_number({'kind': 's', 'value': '...', 'cell': 'B6'})
        # Main-results stores the 2019 year heading of its region table as text (By regions C80); it still opens 2019's block.
        cell = prepare.sheet('geostat_business_demography', 'By regions')[80]['C']
        self.assertEqual((cell['kind'], cell['value']), ('s', '2019'))
        self.assertEqual(find(self.rows, 'business.active.total', 2019)['source_cell'], 'C81')
        self.assertEqual(find(self.rows, 'business.active.total', 2019)['value'], '167744')
        # Turnover by activity 2018 transportation (H25) is the stored number 5054 and keeps its exact token.
        row = find(self.rows, 'business.turnover.sector_h', 2018)
        self.assertEqual((row['source_cell'], row['value'], row['published_value']), ('H25', '5054', '5054.0'))

    def test_display_rounding(self):
        row = find(self.rows, 'business.turnover.sector_a', 2004)
        self.assertEqual((row['value'], row['published_value']), ('25.863899825519319', '25.9'))
        row = find(self.rows, 'business.employed.size_medium', 2006)
        self.assertEqual((row['value'], row['published_value']), ('99592.295662591016', '99592'))
        self.assertEqual(prepare.published('8.4499999999999993', 1), '8.5')
        self.assertEqual(find(self.rows, 'business.birth_rate.total', 2024)['value'], '22.5725818100114')

    def test_parts_add_up(self):
        def differences(measure, groups, years):
            """{year: (stored parts minus total, published parts minus total)} for the years outside the tolerance."""
            total = series(self.rows, f'business.{measure}.total')
            shown = {r['year']: Decimal(r['published_value']) for r in self.rows if r['indicator_id'] == f'business.{measure}.total'}
            unit = find(self.rows, f'business.{measure}.total', max(total))['unit']
            found = {}
            for year in years:
                parts = [find(self.rows, f'business.{measure}.{group}', year) for group in groups]
                stored = sum(Decimal(part['value']) for part in parts) - total[year]
                if abs(stored) > TOLERANCE[unit]:
                    found[year] = str(sum(Decimal(part['published_value']) for part in parts) - shown[year])
            return found

        for measure in SURVEY:
            first = 1999 if measure in ('turnover', 'employed') else 2006
            for kind, groups, years in (('size', SIZES, range(first, 2026)), ('sector', SECTORS, range(first, 2026)),
                                        ('region', REGIONS, range(2006, 2026))):
                found = differences(measure, groups, years)
                # Every year outside the brief's tolerance is recorded in prepare.py with its exact printed difference.
                self.assertEqual(found, prepare.KNOWN_DIFFERENCES.get((measure, kind), {}), (measure, kind))
                for year, difference in found.items():
                    if kind == 'region':  # The 11 regions fall short of Georgia; they never exceed it.
                        self.assertLess(Decimal(difference), 0, (measure, year))
                    elif year < 2006:  # Totals to 2005 include section K, which no column shows.
                        self.assertEqual((kind, measure in ('turnover', 'employed')), ('sector', True))
                        self.assertLess(Decimal(difference), 0, (measure, year))
                    else:  # From 2006 sizes and sectors differ only by rounding of the printed values.
                        self.assertEqual(abs(Decimal(difference)), Decimal('0.2'), (measure, kind, year))
        for measure in FIRMS:
            regions = REGIONS + ['region_abkhazeti', 'region_unknown']
            self.assertEqual(differences(measure, regions, range(2014, 2025)), {}, measure)
            # Sections add up only with Geostat's "ACTIVITY UNKNOWN" row, which is read for this check and not served.
            unknown = prepare.activity_unknown(measure)
            total, sections = series(self.rows, f'business.{measure}.total'), [series(self.rows, f'business.{measure}.{s}') for s in SECTIONS]
            for year in range(2014, 2025):
                self.assertEqual(sum(part[year] for part in sections) + unknown[year], total[year], (measure, year))
                self.assertGreater(unknown[year], 0, (measure, year))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'business.turnover.size_large', 2020, Decimal(10)))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'business.births.region_unknown', 2024, Decimal(1)))
        with self.assertRaisesRegex(ValueError, 'add up'):  # A year with a recorded difference must keep exactly that difference.
            prepare.validate(patched(self.rows, 'business.turnover.region_tbilisi', 2025, Decimal('0.1')))

    def test_rates(self):
        for kind, part in (('birth_rate', 'births'), ('death_rate', 'deaths')):
            rates = [row for row in self.rows if row['indicator_id'].startswith(f'business.{kind}.')]
            self.assertTrue(rates)
            for row in rates:
                group = row['indicator_id'].rsplit('.', 1)[1]
                self.assertTrue(group == 'total' or group in SECTIONS, row['indicator_id'])
                year = row['year']
                ratio = Decimal(find(self.rows, f'business.{part}.{group}', year)['value']) * 100 / Decimal(
                    find(self.rows, f'business.active.{group}', year)['value'])
                self.assertEqual(row['published_value'], prepare.published(ratio, 1), (row['indicator_id'], year))
        with self.assertRaisesRegex(ValueError, 'rate'):
            prepare.validate(patched(self.rows, 'business.birth_rate.sector_c', 2020, Decimal(1)))

    def test_no_quarters_no_2026(self):
        self.assertFalse([row for row in self.rows if row['year'] >= 2026])
        survey_sources = {source_id for source_id, *_ in prepare.SURVEY_TABLES}
        for row in self.rows:
            if row['source_id'] not in survey_sources:
                continue
            sheet_rows = prepare.sheet(row['source_id'], row['source_sheet'])
            number = int(re.fullmatch(r'[A-Z]+(\d+)', row['source_cell']).group(1))
            # The cell's row runs down, without a blank row, to its table's 2025 row; quarters lie below that blank.
            while True:
                cells = sheet_rows.get(number)
                self.assertTrue(cells, row)
                if cells.get('A') and cells['A']['value'] == 2025:
                    break
                number += 1

    def test_anchor_values(self):
        # size_large 2025 is 173004.5 in the workbook (By enterprise size D32), not the 173004.0 in the task brief.
        anchors = {('business.turnover.total', 2025): '253725.5', ('business.turnover.size_large', 2025): '173004.5',
                   ('business.turnover.region_tbilisi', 2025): '200837.9', ('business.employed.total', 2025): '899026',
                   ('business.investment.total', 2025): '8021.8', ('business.profit.total', 2025): '27936.1',
                   ('business.loss.total', 2025): '7152.9', ('business.active.total', 2024): '249236',
                   ('business.births.total', 2024): '56259', ('business.deaths.total', 2024): '29634',
                   ('business.birth_rate.total', 2024): '22.6'}
        for (indicator, year), value in anchors.items():
            self.assertEqual(find(self.rows, indicator, year)['published_value'], value, indicator)
        self.assertEqual(prepare.ANCHORS, anchors)

    def test_regions_start_2006(self):
        for row in self.rows:
            measure, group = row['indicator_id'].split('.')[1:]
            if measure in SURVEY and group.startswith('region_'):
                self.assertGreaterEqual(row['year'], 2006, row['indicator_id'])
        by_measure = defaultdict(set)
        for row in self.rows:
            if row['indicator_id'].split('.')[2].startswith('region_'):
                by_measure[row['indicator_id']].add(row['year'])
        self.assertEqual(by_measure['business.turnover.region_tbilisi'], set(range(2006, 2026)))
        self.assertEqual(by_measure['business.active.region_unknown'], set(range(2014, 2025)))

    def test_series_break(self):
        with open(prepare.ROOT / 'business-series-breaks.csv', encoding='utf-8-sig', newline='') as handle:
            breaks = list(csv.DictReader(handle))
        self.assertEqual([(b['break_id'], b['reference_date']) for b in breaks], [('survey_scope_2006', '2006-01-01')])
        expected = sorted({row['indicator_id'] for row in self.rows if row['indicator_id'].split('.')[1] in ('turnover', 'employed')})
        self.assertEqual(breaks[0]['applies_to'].split(';'), expected)
        self.assertIn('K (Financial and Insurance Activities - from 2006)', breaks[0]['reason'])
        self.assertIn('From 2006 - non-commercial legal persons and entities of public law', breaks[0]['reason'])

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
