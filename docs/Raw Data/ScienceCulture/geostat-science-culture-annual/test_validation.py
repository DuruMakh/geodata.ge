"""Regression tests for the annual Geostat science and culture research package (stdlib unittest only)."""

import csv
from collections import Counter, defaultdict
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
DEGREES = ['degree_doctoral', 'degree_master', 'degree_bachelor', 'degree_short_cycle']
AGES = ['age_under25', 'age_25_34', 'age_35_44', 'age_45_54', 'age_55_64', 'age_65_plus']
FIELDS = ['field_natural', 'field_engineering', 'field_medical', 'field_agricultural', 'field_social', 'field_humanities',
          'field_not_identified']
STAFF_AGES = ['age_under25', 'age_25_54', 'age_55_plus']
MUSEUM_TYPES = ['type_memorial', 'type_history', 'type_art', 'type_reserve', 'type_literature', 'type_other']
THEATRE_TYPES = ['type_drama', 'type_puppet', 'type_opera_ballet', 'type_youth']


def ind(measure, group):
    return f'science_culture.{measure}.{group}'


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def series(rows, measure, group):
    return {row['year']: Decimal(row['value']) for row in rows if row['indicator_id'] == ind(measure, group)}


def patched(rows, indicator_id, year, delta):
    """A copy with one value moved by delta and its published value kept consistent, so only the check under test fails."""
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, year)
    row['value'] = str(Decimal(row['value']) + delta)
    row['published_value'] = prepare.published(row['value'], prepare.places_of(prepare.source_cell(row), row['unit']))
    return copy


class SourceRow:
    """A raw workbook row found by its printed label, for cross-checks that do not use the package's own readers."""

    @staticmethod
    def values(source_id, sheet_name, label, after=None):
        rows = prepare.sheet(source_id, sheet_name)
        start = 0
        if after is not None:
            start = next(n for n, cells in rows.items() if any(prepare.text(cell) == after for cell in cells.values()))
        number = next(n for n, cells in sorted(rows.items()) if n > start and prepare.text(cells.get('A')) == label)
        years = prepare.year_columns(rows[next(n for n, cells in sorted(rows.items()) if prepare.year_columns(cells))])
        return {year: prepare.cell_number(rows[number][column]) for year, column in years.items() if column in rows[number]}


class SciencePackageTests(unittest.TestCase):
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
            years = {int(r['year']) for r in self.rows if r['indicator_id'] == row['indicator_id']}
            self.assertEqual((min(years), max(years)), (int(row['first_year']), int(row['last_year'])), row['indicator_id'])
            gaps = [year for year in range(min(years), max(years) + 1) if year not in years]
            self.assertEqual(row['unavailable_years'], ';'.join(map(str, gaps)), row['indicator_id'])
        self.assertEqual(sum(row['value_status'] != 'official' or row['basis'] != 'actual' for row in self.rows), 0)
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        # A change too small to move the published value is still caught by re-reading the cell.
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, ind('theatre_seats', 'total'), 2025, Decimal('0.001')))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(patched(self.rows, ind('invention_applications', 'local'), 2020, Decimal(1)))
        copy = [dict(row) for row in self.rows]
        find(copy, ind('theatre_audience', 'total'), 2025)['published_value'] = '620.3'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])])

    def test_dash_cells(self):
        # Review Focus 1: "-" is none (zero) where the rows add up only that way, and "not collected" (no row) in the events rows.
        self.assertEqual(find(self.rows, ind('researchers', 'field_not_identified'), 2022)['value'], '0')
        self.assertEqual(find(self.rows, ind('researchers', 'degree_short_cycle'), 2019)['value'], '0')
        self.assertEqual(find(self.rows, ind('invention_patents', 'foreign'), 2018)['value'], '0')
        row = find(self.rows, ind('researchers', 'degree_short_cycle'), 2019)
        self.assertEqual((row['source_sheet'], row['source_cell'], row['published_value']), ('1', 'B9', '0'))
        self.assertEqual(prepare.text(prepare.source_cell(row)), '-')
        events = [row for row in self.rows if row['indicator_id'].startswith('science_culture.theatre_events.')]
        self.assertEqual(sorted({int(row['year']) for row in events}), list(range(2021, 2026)))
        self.assertEqual(len(events), 15)
        # The audience and the performances are collected for every year.
        self.assertEqual(sorted(series(self.rows, 'theatre_audience', 'total')), list(range(2006, 2026)))
        self.assertEqual(sorted(series(self.rows, 'theatre_shows', 'total')), list(range(2006, 2026)))
        # A dash outside the tables where it means none stops the run.
        with self.assertRaisesRegex(ValueError, 'dash|Expected a number'):
            prepare.number_or_zero({'value': '-', 'cell': 'B4', 'kind': 's', 'format': ''}, 'geostat_culture_museums')

    def test_parts_add_up(self):
        def total(measure, year):
            return series(self.rows, measure, 'total')[year]

        def parts(measure, groups, year):
            return sum(series(self.rows, measure, group)[year] for group in groups)

        for year in range(2019, 2025):
            for measure in ('researchers', 'rd_staff'):
                self.assertEqual(parts(measure, ['women', 'men'], year), total(measure, year), (measure, year))
            for groups in (DEGREES, AGES, FIELDS):
                self.assertEqual(parts('researchers', groups, year), total('researchers', year), (groups, year))
            self.assertEqual(total('researchers', year) + parts('rd_staff', ['technicians', 'support', 'not_specified'], year),
                             total('rd_staff', year), year)
        for year in range(2020, 2026):
            for measure in ('museum_staff', 'theatre_staff'):
                self.assertEqual(parts(measure, ['women', 'men'], year), total(measure, year), (measure, year))
                self.assertEqual(parts(measure, ['permanent', 'contract'], year), total(measure, year), (measure, year))
                self.assertEqual(parts(measure, STAFF_AGES, year), total(measure, year), (measure, year))
        for year in range(2005, 2026):
            self.assertEqual(parts('museums', MUSEUM_TYPES, year), total('museums', year), year)
            self.assertEqual(parts('museums', REGIONS, year), total('museums', year), year)
            self.assertEqual(parts('museum_exhibitions', REGIONS, year), total('museum_exhibitions', year), year)
            # The regional visitors fall short of Georgia by a few persons in three years; the amounts are recorded exactly.
            self.assertEqual(parts('museum_visitors', REGIONS, year) - total('museum_visitors', year),
                             prepare.KNOWN_DIFFERENCES['museum_visitors'].get(year, 0), year)
            self.assertLessEqual(abs(parts('museum_tours', REGIONS, year) - total('museum_tours', year)), Decimal('0.2'), year)
        for year in range(2006, 2026):
            self.assertEqual(parts('theatres', THEATRE_TYPES, year), total('theatres', year), year)
        # The national file's visitors are in million persons; times 1000 they match the by-region Georgia row to 0.1 thousand.
        national = SourceRow.values('geostat_culture_museums', '1', 'Number of visitors, million persons')
        self.assertEqual(sorted(national), list(range(2005, 2026)))
        for year, million in national.items():
            self.assertLessEqual(abs(million * 1000 - total('museum_visitors', year)), Decimal('0.1'), year)
        # The audience in Events.xls is the by-region theatre workbook's Georgia row: exact where Events prints three decimals, and
        # the same number rounded to one decimal in the years where Events prints one.
        regional = SourceRow.values('geostat_culture_theatres_regions', '1', 'Georgia, total', after='Number of attendants, thsd')
        self.assertEqual(sorted(regional), list(range(2006, 2026)))
        rounded = 0
        for year, value in regional.items():
            audience = total('theatre_audience', year)
            if audience != value:
                rounded += 1
                self.assertEqual(value.quantize(Decimal('0.1'), rounding='ROUND_HALF_UP'), audience, year)
        self.assertEqual(rounded, 4)
        self.assertEqual(prepare.KNOWN_DIFFERENCES, {'museum_visitors': {2005: Decimal('-0.013'), 2013: Decimal('-0.019'),
                                                                         2023: Decimal('-0.030')}})
        # A region moved by 10 no longer adds up to Georgia (visitors, exhibitions, museums); neither does any other part.
        for measure, group, year in (('museum_visitors', 'region_guria', 2025), ('museum_visitors', 'region_guria', 2013),
                                     ('museum_exhibitions', 'region_imereti', 2010),
                                     ('museum_tours', 'region_kakheti', 2015), ('museums', 'region_tbilisi', 2020),
                                     ('museums', 'type_art', 2005), ('theatres', 'type_puppet', 2012),
                                     ('researchers', 'women', 2024), ('researchers', 'age_65_plus', 2021),
                                     ('rd_staff', 'support', 2022), ('museum_staff', 'permanent', 2023),
                                     ('theatre_staff', 'age_25_54', 2025)):
            with self.assertRaisesRegex(ValueError, 'add up'):
                prepare.validate(patched(self.rows, ind(measure, group), year, Decimal(10)))

    def test_anchor_values(self):
        anchors = {('researchers', 'total', 2024): '14046', ('researchers', 'women', 2024): '7732',
                   ('rd_staff', 'total', 2024): '16191', ('institutions', 'total', 2024): '66', ('rd_spending', 'total', 2024): '242.9',
                   ('invention_applications', 'local', 2025): '79', ('invention_patents', 'local', 2025): '41',
                   ('invention_applications', 'international', 2025): '85', ('museums', 'total', 2025): '261',
                   ('museum_visitors', 'total', 2025): '1998.924', ('museum_visitors', 'region_samtskhe_javakheti', 2025): '164.893',
                   ('theatres', 'total', 2025): '53', ('theatre_audience', 'total', 2025): '620.322'}
        for (measure, group, year), value in anchors.items():
            self.assertEqual(find(self.rows, ind(measure, group), year)['value'], value, (measure, group))
            self.assertEqual(find(self.rows, ind(measure, group), year)['published_value'], value, (measure, group))
        self.assertEqual({(ind(m, g), y): v for (m, g, y), v in anchors.items()}, prepare.ANCHORS)

    def test_published_value_precision(self):
        # Counts have no decimals; the thousands and million GEL keep the decimals the cell stores or its format shows.
        pairs = {(ind('museum_visitors', 'total'), 2011): ('705.067', '705.067'),
                 (ind('museum_visitors', 'total'), 2005): ('412.5', '412.5'),
                 (ind('museum_tours', 'region_racha_lechkhumi_kvemo_svaneti'), 2005): ('0', '0.0'),
                 (ind('museum_tours', 'total'), 2025): ('44.615', '44.615'),
                 (ind('museum_tours', 'total'), 2005): ('11.8', '11.8'),
                 (ind('rd_spending', 'total'), 2019): ('140.2', '140.2'),
                 (ind('rd_spending', 'total'), 2022): ('171', '171.0'),
                 (ind('theatre_audience', 'total'), 2006): ('343.6', '343.6'),
                 (ind('theatre_seats', 'total'), 2006): ('14.168', '14.168'),
                 (ind('theatre_staff', 'total'), 2025): ('4391', '4391')}
        for (indicator, year), (value, shown) in pairs.items():
            row = find(self.rows, indicator, year)
            self.assertEqual((row['value'], row['published_value']), (value, shown), (indicator, year))
        units = defaultdict(set)
        for row in self.rows:
            units[row['indicator_id'].split('.')[1]].add(row['unit'])
        self.assertEqual(dict(units), {
            'researchers': {'persons'}, 'rd_staff': {'persons'}, 'institutions': {'count'}, 'rd_spending': {'gel_million'},
            'invention_applications': {'count'}, 'invention_patents': {'count'}, 'utility_applications': {'count'},
            'utility_patents': {'count'}, 'museums': {'count'}, 'museum_visitors': {'persons_thousand'},
            'museum_tours': {'count_thousand'}, 'museum_exhibitions': {'count'}, 'museum_staff': {'persons'},
            'theatres': {'count'}, 'theatre_seats': {'count_thousand'}, 'theatre_audience': {'persons_thousand'},
            'theatre_shows': {'count'}, 'theatre_events': {'count'}, 'theatre_staff': {'persons'}})
        for row in self.rows:
            if row['unit'] in ('persons', 'count'):
                self.assertNotIn('.', row['published_value'], row)

    def test_labels_found_by_text(self):
        # Review Focus 2: the region labels Geostat prints differently map by their exact text; an unknown label stops the run.
        for label in ('Adjar AR', 'Adjara AR', ' Tbilisi', 'Racha-Lechkhumi and Kvemo svaneti', 'Samegrelo-Zemo Svaneti'):
            self.assertIn(prepare.region_group(label), REGIONS)
        self.assertEqual(prepare.region_group('Georgia, total'), 'total')
        for label in ('Adjara', 'Abkhazia AR', 'The remaining regions', ''):
            with self.assertRaisesRegex(ValueError, 'Unexpected'):
                prepare.region_group(label)
        # The three museum blocks are found by the heading above them, and the staff blocks by Total, Women and Men.
        self.assertEqual(find(self.rows, ind('museum_visitors', 'total'), 2025)['source_cell'], 'V4')
        self.assertEqual(find(self.rows, ind('museum_tours', 'total'), 2025)['source_cell'], 'V17')
        self.assertEqual(find(self.rows, ind('museum_exhibitions', 'total'), 2025)['source_cell'], 'V30')
        self.assertEqual(find(self.rows, ind('museum_staff', 'women'), 2025)['source_cell'], 'G15')
        self.assertEqual(find(self.rows, ind('museum_staff', 'men'), 2025)['source_cell'], 'G26')
        self.assertEqual(find(self.rows, ind('museum_staff', 'total'), 2025)['source_cell'], 'G4')
        # The researcher tables have a Total, Women and Men column per year.
        self.assertEqual(find(self.rows, ind('researchers', 'women'), 2024)['source_cell'], 'R4')
        self.assertEqual(find(self.rows, ind('researchers', 'age_65_plus'), 2024)['source_cell'], 'Q11')
        self.assertEqual(find(self.rows, ind('researchers', 'age_65_plus'), 2024)['source_sheet'], '2')
        # The international columns of the patent sheets: filed applications (F) and registered patents (G).
        self.assertEqual(find(self.rows, ind('utility_applications', 'international'), 2025)['source_cell'], 'F14')
        self.assertEqual(find(self.rows, ind('utility_patents', 'international'), 2025)['source_cell'], 'G14')
        self.assertEqual(find(self.rows, ind('utility_patents', 'international'), 2025)['source_sheet'], '2')

    def test_series_break_and_footnote(self):
        text = (prepare.ROOT / 'science-culture-series-breaks.csv').read_bytes()
        self.assertTrue(text.startswith(b'\xef\xbb\xbf'))
        with open(prepare.ROOT / 'science-culture-series-breaks.csv', encoding='utf-8-sig', newline='') as handle:
            breaks = list(csv.DictReader(handle))
        self.assertEqual(list(breaks[0]), ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note'])
        self.assertEqual([(b['break_id'], b['applies_to'], b['reference_date']) for b in breaks],
                         [('theatre_audience_2021', 'science_culture.theatre_audience.total', '2021-01-01')])
        footnote = prepare.text(prepare.sheet('geostat_culture_theatre_events', '1')[12]['A'])
        self.assertEqual(footnote, '*2006-2020 data includes only performances.')
        self.assertIn(footnote, breaks[0]['reason'])

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)

    def test_only_served_years_and_sources(self):
        self.assertFalse([row for row in self.rows if int(row['year']) > 2025])
        self.assertEqual({row['source_id'] for row in self.rows}, set(prepare.SERVED))
        self.assertEqual(set(prepare.SERVED), {
            'geostat_science_researchers', 'geostat_science_rd_staff', 'geostat_science_institutions', 'geostat_science_patents',
            'geostat_culture_museums', 'geostat_culture_museums_regions', 'geostat_culture_museums_count_regions',
            'geostat_culture_museum_staff', 'geostat_culture_theatres', 'geostat_culture_theatre_events',
            'geostat_culture_theatre_staff'})


if __name__ == '__main__':
    unittest.main()
