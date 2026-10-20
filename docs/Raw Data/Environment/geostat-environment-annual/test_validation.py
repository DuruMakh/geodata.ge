"""Regression tests for the annual environment and climate research package (stdlib unittest only)."""

from collections import Counter
import csv
from decimal import Decimal
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

POLLUTANTS = ['co', 'nox', 'so2', 'nh3', 'nmvoc', 'tsp', 'pm10', 'pm25']


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def altered(rows, indicator_id, year, value):
    """A copy with one value changed and its published value kept equal, so only a cross-check can notice."""
    copied = [dict(row) for row in rows]
    row = find(copied, indicator_id, year)
    row['value'] = row['published_value'] = value
    row['decimals'] = prepare.decimals(value)
    return copied


class EnvironmentPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        with (prepare.ROOT / 'coverage.csv').open(encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))

    def values(self, indicator_id):
        return {row['year']: row['value'] for row in self.rows if row['indicator_id'] == indicator_id}

    def test_counts(self):
        counted = Counter(row['indicator_id'] for row in self.rows)
        self.assertEqual({line['indicator_id']: int(line['observations']) for line in self.coverage}, dict(counted))
        families = Counter(row['indicator_id'].split('.')[1] for row in self.rows)
        # Each family counted from its table's shape, not from the generated file
        self.assertEqual(families['ghg'], 16 * 23 - 1 - 10)  # HFCs start in 2001, SF6 in 2010
        self.assertEqual(families['air'], 8 * 3 * 12)
        self.assertEqual(families['climate'], 12 * 27)
        self.assertEqual(families['water'], 15 * 11)
        self.assertEqual(families['waste'], 13 * 10)
        self.assertEqual(families['forest'], 2 * 15 * 13 - 15 - 3 - 3 - 7 + 2 * 12)  # Tbilisi timber, protected areas 2010-2012, Tbilisi logging 2012-2018
        self.assertEqual(families['aq'], 475)
        print(f'\nServed rows: {len(self.rows)}')
        self.assertEqual(len(self.rows), 2125)
        prepare.validate(self.rows)

    def test_anchor_values(self):
        for indicator, year, expected in (('environment.ghg.total', 2000, '11.4'), ('environment.ghg.total', 2022, '20.1'),
                                          ('environment.ghg.per_person', 2022, '5.4'), ('environment.air.co.total', 2024, '86.4'),
                                          ('environment.aq.pm10_avg.tbilisi_a1', 2025, '31'), ('environment.aq.pm10_avg.rustavi_d1', 2025, '51'),
                                          ('environment.climate.temperature.georgia', 2024, '10.3'), ('environment.water.lost', 2025, '559.9'),
                                          ('environment.water.lost_share', 2025, '64.4'), ('environment.waste.collected.georgia', 2024, '1184'),
                                          ('environment.forest.timber_cut.georgia', 2024, '376215'),
                                          ('environment.forest.illegal_logging.georgia', 2014, '45915')):
            self.assertEqual(self.values(indicator)[year], expected, indicator)

    def test_published_values(self):
        land = self.values('environment.ghg.sector_land')
        self.assertEqual((land[2002], land[2022]), ('-6.7', '-5.8'))
        lulucf = Decimal(str(prepare.reread('geostat_env_ghg', 'B-3', 'E11')['value']))
        self.assertEqual(str(lulucf), '-6.6999999999999993')  # the floating noise Geostat stores, never served (row 11 is not used)
        self.assertEqual(self.values('environment.ghg.energy_stationary')[2000], '3.8')  # stored as 3.8000000000000003
        self.assertEqual(self.values('environment.forest.timber_cut.region_kakheti')[2023], '52954.015')  # stored as 52954.01500000112
        self.assertEqual(self.values('environment.ghg.gas_sf6')[2022], '1.14')
        for row in self.rows:
            self.assertEqual(row['decimals'], len(row['published_value'].split('.')[1]) if '.' in row['published_value'] else 0)
            places = Decimal(1).scaleb(-row['decimals'])
            self.assertEqual(Decimal(row['value']).quantize(places, rounding='ROUND_HALF_UP'), Decimal(row['published_value']))
        # The published value is the figure the table prints, which can have fewer decimals than the stored cell.
        shown = {(row['indicator_id'], row['year']): (row['value'], row['published_value']) for row in self.rows if row['published_value'] != row['value']}
        self.assertEqual(len(shown), 89)
        self.assertEqual(shown[('environment.ghg.total', 2018)], ('17.66', '17.7'))
        self.assertEqual(shown[('environment.ghg.gas_sf6', 2022)], ('1.14', '1.1'))
        self.assertEqual(shown[('environment.aq.pm10_avg.rustavi_d2', 2025)], ('44.5', '45'))
        self.assertEqual(shown[('environment.forest.timber_cut.region_kakheti', 2023)], ('52954.015', '52954'))
        self.assertEqual(find(self.rows, 'environment.forest.timber_cut.region_kakheti', 2023)['decimals'], 0)

    def test_placeholders(self):
        self.assertNotIn(2000, self.values('environment.ghg.gas_hfcs'))  # "…"
        self.assertEqual(self.values('environment.ghg.gas_hfcs')[2001], '0')  # a printed zero is a value
        self.assertFalse(any(row['indicator_id'].startswith('environment.forest.timber_cut.region_tbilisi') for row in self.rows))  # "..." in every year
        logging = self.values('environment.forest.illegal_logging.region_tbilisi')
        self.assertNotIn(2015, logging)  # "…" is not available, even in the magnitude-nil table
        self.assertEqual(self.values('environment.forest.illegal_logging.region_guria')[2011], '0')  # "-" is magnitude nil there
        self.assertNotIn(2010, self.values('environment.aq.pm10_avg.tbilisi_a1'))  # "-" in the air quality table is "not available"
        self.assertNotIn(2024, self.values('environment.aq.pm10_avg.tbilisi_a4'))
        self.assertEqual(self.values('environment.aq.pm10_avg.tbilisi_a4')[2019], '47')  # printed "47*"
        self.assertEqual(self.values('environment.aq.no2_avg.kutaisi_b1')[2019], '46')  # printed "46*"
        for row in self.rows:
            cell = prepare.reread(row['source_id'], row['source_sheet'], row['source_cell'])
            if cell['kind'] == 's':
                printed = prepare.clean(cell['value'])
                self.assertTrue(printed.endswith('*') or (printed == '-' and row['source_id'] == 'geostat_env_illegal_logging'), row)

    def test_city_limits(self):
        pm25 = self.values('environment.aq.pm25_limit.kutaisi')
        self.assertEqual(sorted(pm25), list(range(2018, 2026)))  # Kutaisi's stations measure from 2018, the printed limit from 1990
        self.assertEqual((pm25[2019], pm25[2020]), ('25', '20'))
        self.assertEqual(set(self.values('environment.aq.pm10_limit.tbilisi').values()), {'40'})
        self.assertFalse(any('zestaponi' in row['indicator_id'] and '_limit' in row['indicator_id'] for row in self.rows))
        self.assertEqual(sorted(self.values('environment.aq.tsp_avg.zestaponi_e1')), list(range(2005, 2026)))
        self.assertFalse(any(row['indicator_id'] == 'environment.aq.pm10_days.zugdidi_f1' and row['year'] < 2024 for row in self.rows))

    def test_altered_cell_fails(self):
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(altered(self.rows, 'environment.aq.pm10_avg.mestia_i1', 2025, '10'))
        with self.assertRaisesRegex(ValueError, 'does not add up'):
            prepare.validate(altered(self.rows, 'environment.ghg.sector_energy', 2022, '14.2'))
        with self.assertRaisesRegex(ValueError, 'does not add up'):
            prepare.validate(altered(self.rows, 'environment.waste.collected.region_guria', 2024, '35'))
        with self.assertRaisesRegex(ValueError, 'Anchor'):
            prepare.validate(altered(self.rows, 'environment.aq.pm10_limit.rustavi', 2025, '50'))
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])])
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [dict(find(self.rows, 'environment.ghg.gas_hfcs', 2001), year=2000)])  # a 0 over the "…" cell
        with self.assertRaisesRegex(ValueError, 'outside'):
            prepare.validate(self.rows + [dict(find(self.rows, 'environment.water.gross', 2025), year=2026)])
        changed = [dict(row) for row in self.rows]
        find(changed, 'environment.water.gross', 2025)['unit'] = 'percent'
        with self.assertRaisesRegex(ValueError, 'Unexpected unit'):
            prepare.validate(changed)

    def test_rounding(self):
        self.assertEqual(prepare.published({'kind': 'n', 'value': Decimal('-6.699999999999999')}, 'geostat_env_ghg'), ('-6.7', False))
        self.assertEqual(prepare.published({'kind': 'n', 'value': Decimal('876749.0')}, 'geostat_env_timber'), ('876749', False))
        self.assertEqual(prepare.published({'kind': 's', 'value': '…'}, 'geostat_env_illegal_logging'), None)
        self.assertEqual(prepare.published({'kind': 's', 'value': '-'}, 'geostat_env_timber'), None)
        with self.assertRaisesRegex(ValueError, 'Unexpected cell content'):
            prepare.published({'kind': 's', 'value': '12 3'}, 'geostat_env_timber')

    def test_manifest_and_report(self):
        manifest = json.loads((prepare.ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(manifest), len(prepare.FILES) + 6)
        self.assertEqual(len({record['source_id'] for record in manifest}), len(manifest))
        for record in manifest:
            self.assertTrue((prepare.ROOT / record['local_file']).exists(), record['local_file'])
        report = json.loads((prepare.ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        self.assertEqual((report['status'], report['primary_observation_count'], report['imputed_values'], report['calculated_values']),
                         ('passed', len(self.rows), 0, 0))
        self.assertEqual(report['placeholder_cells_in_served_values'], 0)
        self.assertEqual(sum(report['observations_by_source'].values()), len(self.rows))
        self.assertEqual(len(report['footnoted_number_cells']), 4)

    def test_generated_files_are_current(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
