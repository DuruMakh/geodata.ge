"""Regression tests for the annual crime and justice research package (stdlib unittest only)."""

from collections import Counter
import csv
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

RECORDED = ['life', 'health', 'rights', 'family', 'property', 'public_safety', 'drugs', 'transport', 'malfeasance', 'government', 'other']
TYPES = ['murder', 'aggravated_murder', 'injury', 'rape', 'larceny', 'robbery', 'theft', 'drugs', 'hooliganism', 'traffic', 'other']
AGES = ['14_17', '18_24', '25_29', '30_49', '50_plus']
SENTENCES = ['prison', 'corrective_labour', 'suspended', 'fine', 'deferred', 'community_work', 'other']
VICTIM_SEX = ['men', 'women', 'unknown']
VICTIM_AGE = ['under_17', '17_24', '25_44', '45_plus', 'unknown']
VICTIM_CITIZENSHIP = ['georgia', 'foreign', 'dual', 'stateless', 'unknown']
VICTIM_YEARS = list(range(2007, 2012)) + list(range(2015, 2026))


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def altered(rows, indicator_id, year, value):
    """A copy with one value changed and its published value kept equal, so only a cross-check can notice."""
    copied = [dict(row) for row in rows]
    row = find(copied, indicator_id, year)
    row['value'] = row['published_value'] = value
    return copied


class CrimePackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        with (prepare.ROOT / 'coverage.csv').open(encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))

    def values(self, indicator_id):
        return {row['year']: int(row['value']) for row in self.rows if row['indicator_id'] == indicator_id}

    def years(self, indicator_id):
        return sorted(self.values(indicator_id))

    def test_counts(self):
        counted = Counter(row['indicator_id'] for row in self.rows)
        self.assertEqual({line['indicator_id']: int(line['observations']) for line in self.coverage}, dict(counted))
        self.assertEqual(sum(int(line['observations']) for line in self.coverage), len(self.rows))
        # Each family counted from its own shape, not from the generated file
        families = Counter(row['indicator_id'].split('.')[1] for row in self.rows)
        self.assertEqual(families['recorded'], 12 * 11)
        self.assertEqual(families['convicted'], (1 + 11 + 5 + 2 + 7) * 25)
        self.assertEqual(families['prison'], 5 * 25 + 2 * 16)
        self.assertEqual(families['victims'], (1 + 3 + 5 + 5) * 16)
        self.assertEqual(families['road'], 25 + 24 + 25 + 25)
        self.assertEqual(len(counted), 12 + 26 + 7 + 14 + 4)
        print(f'\nServed rows: {len(self.rows)}')
        self.assertEqual(len(self.rows), 1262)
        self.assertEqual(len({(row['indicator_id'], row['year']) for row in self.rows}), len(self.rows))
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        copied = [dict(row) for row in self.rows]
        find(copied, 'crime.road.killed', 2025)['value'] = '1'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copied)
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(altered(self.rows, 'crime.road.killed', 2025, '470'))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(altered(self.rows, 'crime.road.accidents_drunk', 2025, '425'))
        moved = [dict(row) for row in self.rows]
        find(moved, 'crime.road.injured', 2020)['source_cell'] = 'W5'
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(moved)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])])
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [dict(find(self.rows, 'crime.road.killed', 2025), year=2026)])
        for field, wrong in (('unit', 'persons'), ('basis', 'planned'), ('value_status', 'derived'), ('source_id', 'geostat_crime_prison')):
            changed = [dict(row) for row in self.rows]
            find(changed, 'crime.road.accidents', 2025)[field] = wrong
            with self.assertRaisesRegex(ValueError, 'Unexpected'):
                prepare.validate(changed)
        negative = altered(self.rows, 'crime.road.killed', 2025, '-469')
        with self.assertRaisesRegex(ValueError, 'whole'):
            prepare.validate(negative)

    def test_text_numbers(self):
        self.assertEqual(find(self.rows, 'crime.recorded.total', 2024)['value'], '49976')
        self.assertEqual(find(self.rows, 'crime.road.accidents', 2023)['value'], '5594')
        for indicator_id, year, printed in (('crime.recorded.total', 2024, '49 976'), ('crime.road.accidents', 2023, '5 594'),
                                            ('crime.road.injured', 2023, '7 310'), ('crime.recorded.life', 2024, '1 499')):
            row = find(self.rows, indicator_id, year)
            cell = prepare.reread(row['source_id'], row['source_sheet'], row['source_cell'])
            self.assertEqual((cell['kind'], prepare.clean(cell['value'])), ('s', printed))
            self.assertEqual(row['published_value'], row['value'])
        self.assertEqual(prepare.cell_token({'kind': 's', 'value': '49 976'}), '49976')
        self.assertEqual(prepare.cell_token({'kind': 's', 'value': '49 976'}), '49976')
        self.assertEqual(prepare.cell_token({'kind': 's', 'value': '1 234 567'}), '1234567')
        self.assertEqual(prepare.cell_token({'kind': 'n', 'value': Decimal('8897.0')}), '8897')
        self.assertEqual(prepare.cell_token({'kind': 'n', 'value': Decimal('0.0')}), '0')  # a real zero is a value
        for bad in ({'kind': 'n', 'value': Decimal('8897.5')}, {'kind': 's', 'value': '49 97'}, {'kind': 's', 'value': '4 9976'},
                    {'kind': 's', 'value': 'n/a'}, {'kind': 's', 'value': '49,976'}, None):
            with self.assertRaisesRegex(ValueError, 'Unexpected|whole'):
                prepare.cell_token(bad)

    def test_breakdowns_add_up(self):
        def total(parts, year):
            return sum(self.values(part)[year] for part in parts)

        identities = [
            ('crime.recorded.total', [f'crime.recorded.{n}' for n in RECORDED]),
            ('crime.convicted.total', [f'crime.convicted.type_{n}' for n in TYPES]),
            ('crime.convicted.total', [f'crime.convicted.age_{n}' for n in AGES]),
            ('crime.convicted.total', ['crime.convicted.sex_women', 'crime.convicted.sex_men']),
            ('crime.convicted.total', [f'crime.convicted.sentence_{n}' for n in SENTENCES]),
            ('crime.prison.total', ['crime.prison.women', 'crime.prison.men']),
            ('crime.prison.total', ['crime.prison.adults', 'crime.prison.juveniles']),
            ('crime.victims.total', [f'crime.victims.sex_{n}' for n in VICTIM_SEX]),
            ('crime.victims.total', [f'crime.victims.age_{n}' for n in VICTIM_AGE]),
            ('crime.victims.total', [f'crime.victims.citizenship_{n}' for n in VICTIM_CITIZENSHIP]),
        ]
        for whole, parts in identities:
            for year, value in self.values(whole).items():
                self.assertEqual(total(parts, year), value, f'{whole} {year}')
        for year in range(2010, 2026):
            self.assertEqual(self.values('crime.prison.sentenced')[year] + self.values('crime.prison.pretrial')[year],
                             self.values('crime.prison.total')[year], year)
        # Any change of +1 to a total or to a part is noticed, in the first and the last served year
        for whole, parts in identities + [('crime.prison.total', ['crime.prison.sentenced', 'crime.prison.pretrial'])]:
            for indicator_id in [whole] + parts:
                for year in (self.years(indicator_id)[0], self.years(indicator_id)[-1]):
                    with self.assertRaisesRegex(ValueError, 'add up', msg=f'{indicator_id} {year}'):
                        prepare.validate(altered(self.rows, indicator_id, year, str(self.values(indicator_id)[year] + 1)))

    def test_convict_totals_agree(self):
        served = self.values('crime.convicted.total')
        self.assertEqual(sorted(served), list(range(2001, 2026)))
        for key in ('age_sex_ages_total', 'age_sex_sexes_total', 'penalties_total'):
            self.assertEqual({year: int(value) for year, value in prepare.check_values(key).items()}, served, key)
        # The three workbooks really are separate files with their own total rows
        self.assertEqual(len({prepare.CHECKS[key].source_id for key in prepare.CHECKS} | {prepare.SPECS['crime.convicted.total'].source_id}), 3)

    def test_victims_gap(self):
        for indicator_id in {row['indicator_id'] for row in self.rows if row['indicator_id'].startswith('crime.victims.')}:
            self.assertEqual(self.years(indicator_id), VICTIM_YEARS, indicator_id)
        self.assertFalse([row for row in self.rows if row['indicator_id'].startswith('crime.victims.') and 2012 <= row['year'] <= 2014])
        line = next(line for line in self.coverage if line['indicator_id'] == 'crime.victims.total')
        self.assertEqual((line['first_year'], line['last_year'], line['observations'], line['unavailable_years']), ('2007', '2025', '16', '2012-2014'))
        # Geostat prints no 2012-2014 columns at all
        sheet = prepare.sheet('geostat_crime_victims')
        self.assertEqual(sorted(prepare.year_columns(sheet, 2).values()), VICTIM_YEARS)

    def test_no_placeholder_rows(self):
        text_rows = []
        for row in self.rows:
            cell = prepare.reread(row['source_id'], row['source_sheet'], row['source_cell'])
            self.assertNotIn(prepare.clean(cell['value']) if isinstance(cell['value'], str) else '', prepare.PLACEHOLDERS)
            if cell['kind'] == 's':
                text_rows.append((row['indicator_id'], row['year'], prepare.clean(cell['value']), row['value']))
        self.assertEqual(len(text_rows), 12)  # ten 2024 recorded-crime cells and two 2023 road cells, all with a space
        self.assertEqual(Counter((indicator.split('.')[1], year) for indicator, year, _, _ in text_rows), {('recorded', 2024): 10, ('road', 2023): 2})
        self.assertFalse([row for row in self.rows if row['year'] >= 2026])
        self.assertEqual(Counter(row['value_status'] for row in self.rows), {'official': len(self.rows)})
        self.assertEqual(Counter(row['basis'] for row in self.rows), {'actual': len(self.rows)})
        self.assertEqual({row['published_value'] == row['value'] for row in self.rows}, {True})
        # The placeholders really are in the workbooks, in cells that are not served
        served = {(row['source_id'], row['source_cell']) for row in self.rows}
        unserved = {}
        for source_id in ('geostat_crime_road', 'geostat_crime_prison'):
            unserved[source_id] = [cell['cell'] for line in prepare.sheet(source_id).values() for cell in line.values()
                                   if cell['kind'] == 's' and prepare.clean(cell['value']) in prepare.PLACEHOLDERS]
            self.assertFalse([cell for cell in unserved[source_id] if (source_id, cell) in served])
        self.assertEqual(unserved['geostat_crime_road'], ['C4'])  # drunk-driving 2002
        self.assertTrue(unserved['geostat_crime_prison'])  # "..." before 2010 (convicted and defendants) and before 2012 (their sexes)
        # No quarterly column is served: the only text heading cells are the 2026 quarters
        for source_id in ('geostat_crime_recorded', 'geostat_crime_victims', 'geostat_crime_road'):
            quarter = [cell for cell in prepare.sheet(source_id)[2].values() if cell['kind'] == 's']
            self.assertEqual([prepare.clean(cell['value']) for cell in quarter], ['I-II Q., 2026'])
            column = quarter[0]['cell'].rstrip('0123456789')
            self.assertFalse([row for row in self.rows if row['source_id'] == source_id and row['source_cell'].rstrip('0123456789') == column])

    def test_placeholders_in_served_cells_fail(self):
        for text in ('…', '...', '-', '- '):
            with self.assertRaisesRegex(ValueError, 'placeholder'):
                prepare.cell_token({'kind': 's', 'value': text})

    def test_anchor_values(self):
        anchors = [('crime.recorded.total', 2015, '35096'), ('crime.recorded.total', 2018, '58412'), ('crime.recorded.total', 2025, '54134'),
                   ('crime.recorded.property', 2025, '17251'), ('crime.convicted.total', 2001, '8897'), ('crime.convicted.total', 2025, '22767'),
                   ('crime.convicted.sentence_prison', 2025, '5793'), ('crime.prison.total', 2011, '24114'), ('crime.prison.total', 2025, '11153'),
                   ('crime.victims.total', 2025, '17209'), ('crime.road.accidents', 2025, '5969'), ('crime.road.killed', 2025, '469'),
                   ('crime.road.injured', 2025, '8191')]
        for indicator_id, year, published in anchors:
            self.assertEqual(find(self.rows, indicator_id, year)['published_value'], published, f'{indicator_id} {year}')

    def test_units_and_ranges(self):
        units = {}
        for row in self.rows:
            units.setdefault(row['indicator_id'], set()).add(row['unit'])
        self.assertTrue(all(len(found) == 1 for found in units.values()))
        flat = {indicator: next(iter(found)) for indicator, found in units.items()}
        self.assertEqual(flat['crime.recorded.total'], 'crimes')
        self.assertEqual(flat['crime.recorded.other'], 'crimes')
        self.assertEqual(flat['crime.road.accidents'], 'accidents')
        self.assertEqual(flat['crime.road.accidents_drunk'], 'accidents')
        self.assertEqual(flat['crime.road.killed'], 'persons')
        self.assertEqual(flat['crime.road.injured'], 'persons')
        self.assertEqual(flat['crime.convicted.type_theft'], 'persons')
        self.assertEqual(set(flat.values()), {'crimes', 'persons', 'accidents'})
        self.assertEqual(sum(1 for unit in flat.values() if unit == 'crimes'), 12)
        self.assertEqual(self.years('crime.recorded.total'), list(range(2015, 2026)))
        self.assertEqual(self.years('crime.convicted.total'), list(range(2001, 2026)))
        self.assertEqual(self.years('crime.prison.women'), list(range(2001, 2026)))
        for indicator in ('crime.prison.sentenced', 'crime.prison.pretrial'):
            self.assertEqual(self.years(indicator), list(range(2010, 2026)))
        self.assertEqual(self.years('crime.road.accidents'), list(range(2001, 2026)))
        self.assertEqual(self.years('crime.road.accidents_drunk'), [2001] + list(range(2003, 2026)))
        line = next(line for line in self.coverage if line['indicator_id'] == 'crime.road.accidents_drunk')
        self.assertEqual((line['first_year'], line['last_year'], line['observations'], line['unavailable_years']), ('2001', '2025', '24', '2002'))
        line = next(line for line in self.coverage if line['indicator_id'] == 'crime.prison.pretrial')
        self.assertEqual((line['first_year'], line['observations'], line['unavailable_years']), ('2010', '16', '2001-2009'))

    def test_cells_found_by_label_not_position(self):
        # xls cell addresses come from 0-based row and column; xlsx addresses are read as printed
        self.assertEqual(prepare.a1(0, 0), 'A1')
        self.assertEqual(prepare.a1(2, 25), 'Z3')
        self.assertEqual(prepare.a1(2, 26), 'AA3')
        self.assertEqual(find(self.rows, 'crime.convicted.total', 2001)['source_cell'], 'B3')
        self.assertEqual(find(self.rows, 'crime.convicted.total', 2025)['source_cell'], 'Z3')
        self.assertEqual(find(self.rows, 'crime.recorded.total', 2025)['source_cell'], 'L3')
        self.assertEqual(find(self.rows, 'crime.recorded.other', 2015)['source_cell'], 'B15')
        self.assertEqual(find(self.rows, 'crime.road.accidents_drunk', 2003)['source_cell'], 'D4')
        # Repeated labels are taken from inside the block that follows their title
        self.assertEqual(find(self.rows, 'crime.prison.women', 2025)['source_cell'], 'Z5')
        self.assertEqual(find(self.rows, 'crime.prison.men', 2025)['source_cell'], 'Z6')
        self.assertEqual(find(self.rows, 'crime.prison.sentenced', 2025)['source_cell'], 'Z18')
        self.assertEqual(find(self.rows, 'crime.prison.pretrial', 2025)['source_cell'], 'Z33')
        self.assertEqual(find(self.rows, 'crime.victims.sex_unknown', 2025)['source_cell'], 'Q7')
        self.assertEqual(find(self.rows, 'crime.victims.age_unknown', 2025)['source_cell'], 'Q13')
        self.assertEqual(find(self.rows, 'crime.victims.citizenship_unknown', 2025)['source_cell'], 'Q19')
        self.assertEqual(find(self.rows, 'crime.convicted.sex_women', 2025)['source_cell'], 'Z16')
        self.assertEqual(find(self.rows, 'crime.convicted.age_14_17', 2025)['source_cell'], 'Z5')
        # A label that is missing, or repeated without a block title, is an error
        rows = {1: {'A': {'value': 'x', 'cell': 'A1', 'kind': 's'}}, 2: {'A': {'value': 'x', 'cell': 'A2', 'kind': 's'}}}
        with self.assertRaisesRegex(ValueError, 'not found exactly once'):
            prepare.find_row(rows, 'x')
        with self.assertRaisesRegex(ValueError, 'not found exactly once'):
            prepare.find_row(rows, 'y')
        self.assertEqual(prepare.find_row(rows, 'x', first=True), 1)
        self.assertEqual(prepare.find_row({1: {'A': {'value': ' x  y ', 'cell': 'A1', 'kind': 's'}}}, 'x y'), 1)

    def test_year_headings(self):
        def heading(*values):
            return {chr(66 + i): {'value': value, 'cell': f'{chr(66 + i)}2', 'kind': 'n' if isinstance(value, Decimal) else 's'}
                    for i, value in enumerate(values)}

        columns = prepare.year_columns({2: heading(Decimal('2015.0'), Decimal('2016'), Decimal('2017.0'), 'I-II Q., 2026')}, 2)
        self.assertEqual(columns, {'B': 2015, 'C': 2016, 'D': 2017})
        columns = prepare.year_columns({2: heading(Decimal('2024.0'), Decimal('2025.0'), 'I-II quarters, 2026')}, 2)
        self.assertEqual(columns, {'B': 2024, 'C': 2025})
        for odd in ('Q1 2026', '2026', 'I-II Q., 2027'):
            with self.assertRaisesRegex(ValueError, 'heading'):
                prepare.year_columns({2: heading(Decimal('2024'), Decimal('2025'), odd)}, 2)
        with self.assertRaisesRegex(ValueError, 'heading'):
            prepare.year_columns({2: heading(Decimal('2024'), Decimal('2025.5'))}, 2)
        # Real headings of all served workbooks end at 2025, with the quarterly column skipped
        for source_id in {spec.source_id for spec in prepare.SPECS.values()}:
            sheet = prepare.sheet(source_id)
            for header in prepare.header_rows(sheet):
                years = list(prepare.year_columns(sheet, header).values())
                self.assertEqual(years, sorted(set(years)))
                self.assertEqual(max(years), 2025, source_id)

    def test_sources(self):
        with (prepare.ROOT / 'source-manifest.csv').open(encoding='utf-8-sig', newline='') as handle:
            manifest = list(csv.DictReader(handle))
        self.assertEqual(len(manifest), 10 + 10 + 2)
        self.assertEqual(len({line['source_id'] for line in manifest}), len(manifest))
        served = {'geostat_crime_recorded', 'geostat_crime_convicts_types', 'geostat_crime_convicts_age_sex', 'geostat_crime_convicts_penalties',
                  'geostat_crime_prison', 'geostat_crime_victims', 'geostat_crime_road'}
        self.assertEqual({row['source_id'] for row in self.rows}, served)
        self.assertEqual({'geostat_crime_recorded_2001_2011', 'geostat_crime_juvenile', 'geostat_crime_trafficking', 'geostat_crime_page'} - {
            line['source_id'] for line in manifest}, set())
        georgian = [line for line in manifest if line['source_id'].endswith('_ka')]
        self.assertEqual(len(georgian), 11)  # ten workbooks and the page capture
        self.assertEqual(sorted(re_media(line['retrieved_file_url']) for line in georgian if line['local_file'] != 'official/crime-page-ka.html'),
                         sorted(['81889', '31826', '81979', '81981', '81983', '81985', '81045', '81891', '81913', '81893']))
        for line in manifest:
            data = (prepare.ROOT / line['local_file']).read_bytes()
            self.assertEqual((hashlib.sha256(data).hexdigest().upper(), str(len(data))), (line['sha256'], line['bytes']), line['local_file'])
            self.assertTrue(line['retrieved_file_url'].startswith('https://'))
            self.assertEqual(line['retrieved_at'], '2026-10-16')
        # Every file in official/ is in the manifest, and the Unified Report PDF is not archived
        on_disk = sorted(f'official/{path.name}' for path in (prepare.ROOT / 'official').iterdir())
        self.assertEqual(on_disk, sorted(line['local_file'] for line in manifest))
        self.assertFalse([name for name in on_disk if name.lower().endswith('.pdf')])

    def test_series_breaks(self):
        with (prepare.ROOT / 'crime-series-breaks.csv').open(encoding='utf-8-sig', newline='') as handle:
            lines = list(csv.DictReader(handle))
        self.assertEqual([line['break_id'] for line in lines], ['registration_2018', 'drunk_driving_coverage_2025'])
        self.assertEqual(list(lines[0]), ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note'])
        self.assertEqual(lines[0]['reference_date'], '2018-01-01')
        self.assertEqual(lines[0]['applies_to'].split(';'), ['crime.recorded.total'] + [f'crime.recorded.{n}' for n in RECORDED])
        for text in ('37,944', '58,412', 'not comparable', '2015-2017', 'Number-of-Recorded-Crimes.xlsx'):
            self.assertIn(text, lines[0]['reason'] + lines[0]['source_note'])
        # No explanation is attributed to anyone: none was found in an official text.
        for text in ('Ministry said', 'Interior', 'each suicide'):
            self.assertNotIn(text, lines[0]['reason'] + lines[0]['source_note'])
        self.assertEqual(self.values('crime.recorded.total')[2017], 37944)
        self.assertEqual(self.values('crime.recorded.total')[2018], 58412)
        self.assertEqual((lines[1]['reference_date'], lines[1]['applies_to']), ('2025-01-01', 'crime.road.accidents_drunk'))
        footnote = prepare.FOOTNOTE_QUOTES['drunk_driving'][1]
        self.assertTrue(footnote.startswith('*Data on road traffic accidents caused by drunk driving from 2001 to 2024'))
        self.assertTrue(footnote.endswith('Accordingly, the 2025 data is not comparable with data from previous years.'))
        self.assertIn(f'"{footnote}"', lines[1]['reason'])
        prepare.check_footnote('geostat_crime_road', footnote)
        with self.assertRaisesRegex(ValueError, 'footnote'):
            prepare.check_footnote('geostat_crime_road', footnote + ' It is also comparable.')

    def test_reports(self):
        report = json.loads((prepare.ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        self.assertEqual((report['status'], report['primary_observation_count'], report['imputed_values'], report['calculated_values']),
                         ('passed', len(self.rows), 0, 0))
        self.assertEqual(report['placeholder_cells_in_served_values'], 0)
        self.assertEqual(sum(report['observations_by_source'].values()), len(self.rows))

    def test_generated_files_are_current(self):
        prepare.build(check=True)


def re_media(url):
    return url.split('/media/')[1].split('/')[0]


if __name__ == '__main__':
    unittest.main()
