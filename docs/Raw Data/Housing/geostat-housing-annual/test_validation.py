"""Regression tests for the annual Geostat housing and construction research package (stdlib unittest only)."""

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

REGIONS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
           'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
           'region_kvemo_kartli', 'region_shida_kartli']
TYPES = ['residential', 'trade', 'administrative', 'hotels', 'cafes', 'industrial', 'farm', 'fuel', 'parking', 'education',
         'preschool', 'health', 'sports', 'culture', 'pharmacy', 'holiday_camps', 'other']
DISTRICTS = ['gldani', 'didube', 'vake', 'isani', 'krtsanisi', 'mtatsminda', 'nadzaladevi', 'saburtalo', 'samgori', 'chughureti']
MEASURES = ['permits', 'completed']


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


class HousingPackageTests(unittest.TestCase):
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
        self.assertEqual(sum(row['value_status'] != 'official' or row['basis'] != 'actual' for row in self.rows), 0)
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        # A change too small to move the published price is still caught by re-reading the cell.
        copy = patched(self.rows, 'housing.price_flat.district_vake', 2024, Decimal('0.01'))
        self.assertEqual(find(copy, 'housing.price_flat.district_vake', 2024)['published_value'],
                         find(self.rows, 'housing.price_flat.district_vake', 2024)['published_value'])
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, 'housing.permits_count.region_tbilisi_residential', 2025, Decimal(1)))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, 'housing.price_index.flats', 2023, Decimal('0.01')))
        copy = [dict(row) for row in self.rows]
        find(copy, 'housing.price_index.total', 2020)['published_value'] = '107.3'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])

    def test_type_columns_by_name(self):
        # Review Focus 1: columns are found by header text, whatever their position or spelling in each year's sheet.
        self.assertEqual(find(self.rows, 'housing.permits_count.type_residential', 2006)['value'], '1279')
        self.assertEqual(find(self.rows, 'housing.permits_count.type_residential', 2025)['value'], '8167')
        for measure in ('count', 'area'):
            self.assertNotIn(2008, series(self.rows, f'housing.permits_{measure}.type_preschool'))
            self.assertEqual(set(series(self.rows, f'housing.permits_{measure}.type_preschool')), set(range(2006, 2026)) - {2008})
            self.assertEqual(set(series(self.rows, f'housing.permits_{measure}.type_holiday_camps')), {2022, 2023})
            self.assertFalse([row for row in self.rows if row['indicator_id'] == f'housing.completed_{measure}.type_holiday_camps'])
            # The completed sheets lack the pre-school column in the years where Geostat printed no such buildings.
            self.assertEqual(set(range(2006, 2026)) - set(series(self.rows, f'housing.completed_{measure}.type_preschool')),
                             {2006, 2009, 2011, 2012, 2021})
        types = {row['indicator_id'].split('.')[2][5:] for row in self.rows if row['indicator_id'].split('.')[2].startswith('type_')}
        self.assertEqual(types, set(TYPES))
        # The first and last year of every sheet read the same type by name although the columns moved.
        row = find(self.rows, 'housing.permits_count.type_residential', 2006)
        self.assertEqual((row['source_sheet'], row['source_cell']), ('2006', 'D7'))
        row = find(self.rows, 'housing.permits_count.type_residential', 2025)
        self.assertEqual((row['source_sheet'], row['source_cell']), ('2025', 'E5'))

    def test_parts_add_up(self):
        for measure in MEASURES:
            for unit, tolerance in (('count', Decimal(0)), ('area', Decimal(1))):
                total = series(self.rows, f'housing.{measure}_{unit}.total')
                self.assertEqual(set(total), set(range(2006, 2026)))
                known = prepare.KNOWN_DIFFERENCES.get((f'{measure}_{unit}', 'region'), {})
                for year in range(2006, 2026):
                    regions = sum(series(self.rows, f'housing.{measure}_{unit}.{region}')[year] for region in REGIONS)
                    types = sum(row_value for row_value in (
                        series(self.rows, f'housing.{measure}_{unit}.type_{kind}').get(year, Decimal(0)) for kind in TYPES))
                    self.assertLessEqual(abs(regions - total[year]), tolerance, (measure, unit, year))
                    self.assertEqual(str(regions - total[year]) if regions != total[year] else None, known.get(year), (measure, unit, year))
                    self.assertLessEqual(abs(types - total[year]), tolerance, (measure, unit, year))
        # The by-type sheets print their own region totals; they equal the regional workbooks'.
        checked = prepare.type_totals_agree()
        self.assertEqual(checked, 4 * 20 * 12)
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'housing.permits_count.region_guria', 2025, Decimal(10)))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'housing.completed_count.type_trade', 2015, Decimal(10)))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'housing.permits_area.region_adjara', 2010, Decimal(10)))

    def test_fourth_quarter_cells(self):
        # Review Focus 3: every price value is the IV column of its year; the 2026 columns (quarters I and II) are not served.
        prices = [row for row in self.rows if row['indicator_id'].split('.')[1].startswith('price_')]
        self.assertEqual(len(prices), 3 * 6 + 2 * 10 * 5)
        for row in prices:
            rows = prepare.sheet(row['source_id'], row['source_sheet'])
            column, number = re.fullmatch(r'([A-Z]+)(\d+)', row['source_cell']).groups()
            quarter = next(cells[column]['value'].strip() for n, cells in sorted(rows.items(), reverse=True)
                           if n < int(number) and column in cells and cells[column]['kind'] == 's'
                           and cells[column]['value'].strip() in ('I', 'II', 'III', 'IV'))
            self.assertEqual(quarter, 'IV', row)
        self.assertEqual(find(self.rows, 'housing.price_index.total', 2020)['published_value'], '107.2')
        self.assertEqual(find(self.rows, 'housing.price_index.total', 2025)['published_value'], '159.4')
        self.assertFalse([row for row in self.rows if row['year'] >= 2026])
        self.assertEqual(set(series(self.rows, 'housing.price_index.flats')), set(range(2020, 2026)))
        self.assertEqual(set(series(self.rows, 'housing.price_flat.district_vake')), set(range(2021, 2026)))

    def test_regional_workbook_2026_not_served(self):
        # The regional workbooks print a "2026 January-June" column pair; it is read as a heading and never served.
        for source_id in ('geostat_housing_permits_regions', 'geostat_housing_completed_regions'):
            self.assertEqual(sorted(prepare.regional_table(source_id)[0]), list(range(2006, 2026)))
        self.assertFalse([row for row in self.rows if row['year'] > 2025])

    def test_anchor_values(self):
        anchors = {('housing.permits_count.total', 2025): '11578', ('housing.permits_area.total', 2025): '11397190',
                   ('housing.completed_count.total', 2025): '3393', ('housing.completed_area.total', 2025): '3509126',
                   ('housing.permits_area.region_tbilisi', 2025): '6423329', ('housing.permits_count.region_guria', 2025): '150'}
        for (indicator, year), value in anchors.items():
            self.assertEqual(find(self.rows, indicator, year)['published_value'], value, indicator)
        self.assertEqual({key: value for key, value in prepare.ANCHORS.items() if key[0] in {k[0] for k in anchors}}, anchors)
        # Vake flats 2025 Q4 is the stored 5873.77 (Residential-property-prices... Flats U8), displayed as 5874 by its format.
        row = find(self.rows, 'housing.price_flat.district_vake', 2025)
        self.assertEqual((row['source_sheet'], row['source_cell'], row['value'], row['published_value']),
                         ('Flats', 'U8', '5873.77', '5874'))
        self.assertEqual(prepare.token(prepare.source_cell(row)), '5873.77')

    def test_display_rounding(self):
        self.assertEqual(prepare.published('8.4499999999999993', 1), '8.5')
        self.assertEqual(prepare.published('5873.77', 0), '5874')
        self.assertEqual(prepare.published('1404055.5', 0), '1404056')
        # The 2023 and 2024 by-type sheets store a few areas with decimals; they are published in whole square metres.
        row = find(self.rows, 'housing.permits_area.type_residential', 2024)
        self.assertEqual((row['value'], row['published_value']), ('8737406.53', '8737407'))
        self.assertEqual(find(self.rows, 'housing.permits_area.total', 2024)['value'], '12040430')

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)

    def test_unit_and_basis(self):
        units = defaultdict(set)
        for row in self.rows:
            units[row['indicator_id'].split('.')[1]].add(row['unit'])
        self.assertEqual(dict(units), {'permits_count': {'count'}, 'permits_area': {'square_metres'}, 'completed_count': {'count'},
                                       'completed_area': {'square_metres'}, 'price_index': {'index_2020'},
                                       'price_flat': {'gel_per_square_metre'}, 'price_house': {'gel_per_square_metre'}})


if __name__ == '__main__':
    unittest.main()
