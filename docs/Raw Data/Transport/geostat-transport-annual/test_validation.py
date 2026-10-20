"""Regression tests for the annual Geostat transport research package (stdlib unittest only)."""

import csv
from collections import Counter
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

REGIONS = ['region_tbilisi', 'region_adjara', 'region_guria', 'region_imereti', 'region_kakheti', 'region_mtskheta_mtianeti',
           'region_racha_lechkhumi_kvemo_svaneti', 'region_samegrelo_zemo_svaneti', 'region_samtskhe_javakheti',
           'region_kvemo_kartli', 'region_shida_kartli']
AREAS = ['total', *REGIONS, 'region_abkhazia', 'region_unknown']
TYPES = ['cars', 'buses', 'trucks', 'special']
CATEGORIES = {
    'type': ['cars', 'buses', 'trucks', 'special', 'type_unknown'],
    'fuel': [f'fuel_{fuel}' for fuel in ('gas', 'petrol', 'petrol_gas', 'diesel', 'diesel_gas', 'electric', 'hybrid', 'hybrid_gas',
                                         'hybrid_diesel', 'unknown')],
    'age': [f'age_{band}' for band in ('0_2', '2_5', '5_10', 'over_10', 'unknown')],
    'owner': ['owner_companies', 'owner_individuals']}
TENTH, FIFTH = Decimal('0.1'), Decimal('0.2')


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


class TransportPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        cls.values = {}
        for row in cls.rows:
            cls.values[(row['indicator_id'], row['year'])] = Decimal(row['value'])
        with open(prepare.ROOT / 'coverage.csv', encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))

    def value(self, indicator, year):
        return self.values.get((f'transport.{indicator}', year))

    def assertAddsUp(self, total, parts, year, tolerance, label):
        whole = self.value(total, year)
        if whole is None:
            return 0
        found = [self.value(part, year) for part in parts]
        if all(v is None for v in found):
            return 0  # Geostat prints no breakdown in this year.
        difference = sum(v for v in found if v is not None) - whole
        known = prepare.KNOWN_DIFFERENCES.get((f'{total} by {label}', year))
        if known is not None:
            self.assertEqual(str(difference), known, (label, total, year))
        else:
            self.assertLessEqual(abs(difference), tolerance, (label, total, year, difference))
        return 1

    def test_counts(self):
        counts = Counter(row['indicator_id'] for row in self.rows)
        expected = {row['indicator_id']: int(row['observations']) for row in self.coverage}
        self.assertEqual(dict(counts), expected)
        self.assertEqual(len(self.rows), sum(expected.values()))
        print(f'\n{len(self.rows)} observations in {len(expected)} indicators')
        for row in self.coverage:
            years = series(self.rows, row['indicator_id'])
            self.assertEqual((min(years), max(years)), (int(row['first_year']), int(row['last_year'])), row['indicator_id'])
            gaps = [year for year in range(min(years), max(years) + 1) if year not in years]
            self.assertEqual(row['unavailable_years'], ';'.join(map(str, gaps)), row['indicator_id'])
        self.assertFalse([row for row in self.rows if row['value_status'] != 'official' or row['basis'] != 'actual'])
        self.assertFalse([row for row in self.rows if row['year'] > 2025])
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, 'transport.passengers.metro', 2020, Decimal('0.01')))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, 'transport.registered.region_guria_owner_companies', 2023, Decimal('0.001')))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, 'transport.road_km.region_imereti_local', 2015, Decimal('0.01')))
        copy = [dict(row) for row in self.rows]
        find(copy, 'transport.passenger_km.total', 2025)['published_value'] = '11262.2'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])

    def test_anchor_values(self):
        anchors = {('fleet.cars', 2025): ('1650', '1650.0'), ('fleet.cars', 2000): ('244.8', '244.8'),
                   ('fleet.cars_fuel_electric', 2025): ('15.2', '15.2'), ('fleet.cars_age_over_10', 2025): ('1318.9', '1318.9'),
                   ('passenger_km.total', 2025): ('11262.1', '11262.1'), ('passenger_km.air', 2025): ('1862.6', '1862.6'),
                   ('tonne_km.rail', 2025): ('3814.9', '3814.9'), ('freight_tonnes.rail_transit', 2025): (None, '7616.6'),
                   ('registered.region_tbilisi', 2025): (None, '855.0'), ('registered.total', 2025): (None, '1914.9'),
                   ('registered.region_guria', 2025): (None, '40.7'), ('passengers.metro', 2025): ('147641.427', '147641.4')}
        for (indicator, year), (value, shown) in anchors.items():
            row = find(self.rows, f'transport.{indicator}', year)
            self.assertEqual(row['published_value'], shown, indicator)
            if value is not None:
                self.assertEqual(row['value'], value, indicator)
        self.assertEqual(find(self.rows, 'transport.passenger_km_per_person.total', 2025)['published_value'], '2858')
        self.assertEqual({f'transport.{i}:{y}': s for (i, y), (_, s) in anchors.items()},
                         {f'{i}:{y}': s for (i, y), s in prepare.ANCHORS.items()})

    def test_regional_columns(self):
        # Review Focus 1: the owner and age sheets print wrong year labels; fuel columns come and go; the age sheet's last
        # "Unknown" headings are Georgian text.
        self.assertEqual(find(self.rows, 'transport.registered.total_owner_companies', 2025)['published_value'], '191.1')
        self.assertEqual(find(self.rows, 'transport.registered.total_owner_companies', 2022)['published_value'], '163.2')
        self.assertEqual(find(self.rows, 'transport.registered.total_age_unknown', 2025)['published_value'], '7.3')
        self.assertEqual(set(series(self.rows, 'transport.registered.total_fuel_hybrid_gas')), set(range(2022, 2026)))
        self.assertEqual(set(series(self.rows, 'transport.registered.total_fuel_diesel_gas')), {2020, *range(2022, 2026)})
        self.assertEqual(set(series(self.rows, 'transport.registered.total_type_unknown')), set(range(2022, 2026)))
        for area in AREAS:
            for category in ('owner', 'age'):
                for part in CATEGORIES[category]:
                    self.assertEqual(set(series(self.rows, f'transport.registered.{area}_{part}')), set(range(2017, 2026)), part)
        self.assertEqual(set(series(self.rows, 'transport.road_km.total')), set(range(2011, 2025)))
        self.assertFalse([row for row in self.rows if '.road_km.region_unknown' in row['indicator_id']])

    def test_nil_cells(self):
        # Review Focus 4: "-" is nil (0) where the table says "magnitude nil" and a gap where it says "data not available".
        row = find(self.rows, 'transport.passenger_km.sea', 2020)
        self.assertEqual((row['value'], row['published_value']), ('0', '0.0'))
        self.assertEqual(prepare.text(prepare.source_cell(row)), '-')
        self.assertEqual(set(series(self.rows, 'transport.passenger_km.sea')), set(range(2000, 2026)))
        self.assertEqual(set(series(self.rows, 'transport.tonne_km.sea')), {*range(2000, 2009), 2011, 2012})
        indicators = {row['indicator_id'] for row in self.rows}
        for missing in ('fleet.buses_fuel_hybrid', 'fleet.trucks_fuel_hybrid', 'fleet.special_fuel_gas', 'fleet.cars_fuel_diesel_gas',
                        'fleet.cars_fuel_hybrid_diesel', 'passenger_km.inland', 'tonne_km.inland'):
            self.assertNotIn(f'transport.{missing}', indicators)
        self.assertEqual(set(series(self.rows, 'transport.fleet.cars')), set(range(2000, 2026)) - {2004, 2005})
        self.assertEqual(set(series(self.rows, 'transport.fleet.special')), set(range(2000, 2026)) - {2004, 2005, 2006})
        self.assertEqual(set(series(self.rows, 'transport.fleet.cars_fuel_hybrid_gas')), set(range(2022, 2026)))

    def test_parts_add_up(self):
        # Review Focus 2: every printed total equals its parts within Geostat's rounding; the H-4 age rows are cumulative.
        checked = 0
        for year in range(2000, 2026):
            for kind in TYPES:
                fuels = [f'fleet.{kind}_fuel_{fuel}' for fuel in prepare.FLEET_FUELS[kind]]
                checked += self.assertAddsUp(f'fleet.{kind}', fuels, year, TENTH, 'fuel')
                checked += self.assertAddsUp(f'fleet.{kind}', [f'fleet.{kind}_age_{band}' for band in ('up_to_10', 'over_10', 'unknown')],
                                             year, TENTH, 'age')
                ages = [self.value(f'fleet.{kind}_age_{band}', year) for band in ('up_to_2', 'up_to_5', 'up_to_10')]
                if None not in ages:
                    self.assertLessEqual(ages[0], ages[1])
                    self.assertLessEqual(ages[1], ages[2])
            checked += self.assertAddsUp('passenger_km.total', [f'passenger_km.{m}' for m in ('road', 'rail', 'metro', 'air', 'sea')],
                                         year, FIFTH, 'mode')
            checked += self.assertAddsUp('tonne_km.total', [f'tonne_km.{m}' for m in ('road', 'rail', 'air', 'sea')], year, FIFTH, 'mode')
            checked += self.assertAddsUp('freight_tonnes.rail', [f'freight_tonnes.rail_{d}' for d in ('domestic', 'exports', 'imports',
                                                                                                     'transit')], year, TENTH, 'direction')
            checked += self.assertAddsUp('passengers.rail', ['passengers.rail_domestic', 'passengers.rail_international'], year, TENTH,
                                         'direction')
            checked += self.assertAddsUp('freight_tonnes.seaports', [f'freight_tonnes.seaports_{c}' for c in ('liquid', 'general', 'dry')],
                                         year, TENTH, 'cargo')
            for category, parts in CATEGORIES.items():
                for part in ['', *(f'_{p}' for p in parts)]:
                    checked += self.assertAddsUp(f'registered.total{part}', [f'registered.{area}{part}' for area in AREAS[1:]], year,
                                                 FIFTH, 'region')
                for area in AREAS:
                    checked += self.assertAddsUp(f'registered.{area}', [f'registered.{area}_{p}' for p in parts], year, FIFTH, category)
            for part in ('', '_international', '_secondary', '_local'):
                checked += self.assertAddsUp(f'road_km.total{part}', [f'road_km.{area}{part}' for area in [*REGIONS, 'region_abkhazia']],
                                             year, FIFTH, 'region')
            for area in ['total', *REGIONS, 'region_abkhazia']:
                checked += self.assertAddsUp(f'road_km.{area}', [f'road_km.{area}_{p}' for p in ('international', 'secondary', 'local')],
                                             year, FIFTH, 'road type')
        print(f'\n{checked} totals compared; recorded differences: {prepare.KNOWN_DIFFERENCES}')
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'transport.fleet.cars_fuel_diesel', 2023, Decimal(1)))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'transport.registered.region_kakheti_age_over_10', 2020, Decimal(1)))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'transport.freight_tonnes.rail_transit', 2019, Decimal(1)))

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
