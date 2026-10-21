"""Regression tests for the annual Geostat education statistics research package (stdlib unittest only)."""

import csv
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

GEORGIA = 'country.georgia'
HE_FIELDS = ['field_education', 'field_humanities_arts', 'field_social_business_law', 'field_science', 'field_engineering',
             'field_agriculture', 'field_health_welfare', 'field_services']
HE_LEVELS = ['level_bachelor', 'level_master', 'level_professional']
VET_CURRENT = ['field_agriculture_vet', 'field_arts_humanities', 'field_business_law', 'field_education', 'field_engineering',
               'field_health_welfare', 'field_ict', 'field_services', 'field_social_journalism']
VET_OLD = ['old_agricultural_sciences', 'old_business_administration', 'old_engineering', 'old_natural_sciences',
           'old_inter_directional', 'old_law', 'old_social_sciences', 'old_art', 'old_health']
PLACE_MEASURES = ('schools', 'pupils', 'teachers', 'kindergartens', 'kg_children', 'kg_staff')
NOT_DRAWN = ('unit.abkhazia_ar', 'unit.akhalgori', 'unit.eredvi', 'unit.tighva', 'unit.kurta')


def find(rows, indicator_id, year, geography_id=GEORGIA):
    found = [r for r in rows if (r['indicator_id'], r['geography_id'], r['year']) == (indicator_id, geography_id, year)]
    return found[0] if found else None


_INDEX = {}


def values(rows, indicator_id, geography_id=GEORGIA):
    if id(rows) not in _INDEX:  # Indexed once per list of rows; the tests never change a list after reading it.
        index = defaultdict(dict)
        for r in rows:
            index[(r['indicator_id'], r['geography_id'])][r['year']] = Decimal(r['value'])
        _INDEX[id(rows)] = (rows, index)
    return dict(_INDEX[id(rows)][1].get((indicator_id, geography_id), {}))


def patched(rows, indicator_id, year, delta, geography_id=GEORGIA):
    """A copy with one value moved by delta and its published value kept consistent, so only the check under test fails."""
    copy = [dict(row) for row in rows]
    row = find(copy, indicator_id, year, geography_id)
    row['value'] = str(Decimal(row['value']) + delta)
    row['published_value'] = prepare.published(row['value'], prepare.UNIT_PLACES[row['unit']])
    return copy


class EducationPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        with open(prepare.ROOT / 'coverage.csv', encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))
        with open(prepare.UNITS_FILE, encoding='utf-8-sig', newline='') as handle:
            cls.units = list(csv.DictReader(handle))
        report = json.loads((prepare.ROOT / 'validation-report.json').read_text(encoding='utf-8'))
        cls.report_shortfall = report['checks']['vocational_current_fields_shortfall_total_minus_current']

    def test_counts(self):
        counts = Counter(r['indicator_id'] for r in self.rows)
        expected = Counter()
        for row in self.coverage:
            expected[row['indicator_id']] += int(row['observations'])
            years = values(self.rows, row['indicator_id'], row['geography_id'])
            self.assertEqual((min(years), max(years)), (int(row['first_year']), int(row['last_year'])), row)
            gaps = [year for year in range(min(years), max(years) + 1) if year not in years]
            self.assertEqual(row['unavailable_years'], ';'.join(map(str, gaps)), row)
        self.assertEqual(dict(counts), dict(expected))
        self.assertEqual(len({(r['indicator_id'], r['geography_id'], r['year']) for r in self.rows}), len(self.rows))
        print(f'\n{len(self.rows)} observations')
        # The spec estimated about 9,500; the exact count by page: Schools 5,665, Kindergartens 2,052, Universities 720
        # (16 rows x 3 headings x 15 years), Vocational 378 (including the old fields, which are not shown).
        pages = Counter('kindergartens' if m in ('kindergartens', 'kg_children', 'kg_staff') else 'universities' if m.startswith('he_')
                        else 'vocational' if m.startswith('vet_') else 'schools' for m in (r['indicator_id'].split('.')[1] for r in self.rows))
        self.assertEqual(dict(pages), {'schools': 5665, 'kindergartens': 2052, 'universities': 720, 'vocational': 378})
        self.assertEqual(len(self.rows), 8815)
        self.assertEqual({r['value_status'] for r in self.rows}, {'official'})
        self.assertEqual({r['basis'] for r in self.rows}, {'actual'})
        self.assertEqual({r['shown'] for r in self.rows if '.old_' in r['indicator_id']}, {'false'})
        self.assertEqual({r['shown'] for r in self.rows if '.old_' not in r['indicator_id']}, {'true'})
        for row in self.rows:
            year = row['year']
            label = str(year) if row['indicator_id'].startswith('education.vet_') else f'{year}/{(year + 1) % 100:02d}'
            self.assertEqual(row['period_label'], label, row)
        self.assertEqual(find(self.rows, 'education.pupils_national.total', 2025)['period_label'], '2025/26')
        self.assertEqual(find(self.rows, 'education.schools.total', 2009, '41')['period_label'], '2009/10')
        self.assertEqual(find(self.rows, 'education.vet_admitted.total', 2025)['period_label'], '2025')
        prepare.validate(self.rows)

    def test_units_mapping(self):
        codes = {}
        with open(prepare.ROOT.parents[3] / 'data' / 'imports' / 'municipalities.csv', encoding='utf-8-sig', newline='') as handle:
            for row in csv.DictReader(handle):
                codes[row['municipality_code']] = row['region_id']
        ids = [u['geography_id'] for u in self.units]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotIn('04', ids)
        municipalities = [i for i in ids if i.isdigit()]
        self.assertEqual(sorted(municipalities), sorted(c for c in codes if c != '04'))
        self.assertEqual(len([i for i in ids if i.startswith('region.')]), 11)
        self.assertEqual(sorted(i for i in ids if i.startswith('unit.')), sorted(NOT_DRAWN))
        self.assertEqual(next(u['geography_id'] for u in self.units if u['source_label'] == 'TBILISI'), 'region.tbilisi')
        for unit in self.units:
            self.assertEqual(unit['source_label'], unit['source_label'].strip())
            self.assertTrue(unit['mapping_note'] and unit['reviewed_at'], unit)
        # Every place a page could draw has a row; the five non-map units are kept with their own ids.
        geographies = {r['geography_id'] for r in self.rows}
        self.assertEqual(geographies, set(ids))
        self.assertNotIn('04', geographies)

    def test_altered_cell_fails(self):
        # A change too small to move the published thousands is still caught by re-reading the cell.
        copy = patched(self.rows, 'education.pupils_national.total', 2012, Decimal('0.0001'))
        self.assertEqual(find(copy, 'education.pupils_national.total', 2012)['published_value'], '559.4')
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(copy)
        copy = patched(self.rows, 'education.pupils_national.public', 2020, Decimal('0.01'))  # Within the 0.15 sum tolerance.
        self.assertEqual(find(copy, 'education.pupils_national.public', 2020)['published_value'], '549.1')
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(copy)
        copy = [dict(row) for row in self.rows]
        find(copy, 'education.kg_children.total', 2020, '41')['published_value'] = '1'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copy)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        copy = [dict(row) for row in self.rows]
        copy.append(dict(copy[0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(copy)

    def test_text_numbers(self):
        # Table 01 stores the 2024/25 schools total as the text '2 294'; it is read as 2294 once its space is removed.
        row = find(self.rows, 'education.schools.total', 2024)
        cell = prepare.source_cell(row)
        self.assertEqual((cell['kind'], cell['value']), ('s', '2 294'))
        self.assertEqual((row['value'], row['published_value'], row['source_id']), ('2294', '2294', 'geostat_education_schools_national'))
        with self.assertRaises(ValueError):
            prepare.cell_number({'kind': 's', 'value': '...', 'cell': 'F7', 'format': 'General'})
        # 2012/13 pupils: the stored double 559.41499999999996 shows as 559.415 (15 digits) and is published as 559.4.
        row = find(self.rows, 'education.pupils_national.total', 2012)
        self.assertEqual(row['value'], '559.41499999999996')
        self.assertEqual(prepare.displayed(row['value']), '559.415')
        self.assertEqual((row['published_value'], row['unit']), ('559.4', 'persons_thousand'))
        # A whole number of thousands still publishes one decimal (2006/07: 636 shown as 636.0).
        self.assertEqual(find(self.rows, 'education.pupils_national.total', 2006)['published_value'], '636.0')
        self.assertEqual(find(self.rows, 'education.pupils_national.total', 2025)['published_value'], '644.2')
        self.assertEqual(prepare.published('8.4499999999999993', 1), '8.5')

    def test_unavailable_cells(self):
        # Table 06 prints '...' for private-school teachers in 2010/11: no row, and no zero.
        self.assertIsNone(find(self.rows, 'education.teachers.private', 2010))
        self.assertEqual(sorted(values(self.rows, 'education.teachers.private')), [y for y in range(2006, 2026) if y != 2010])
        cell = prepare.sheet('geostat_education_teachers_national', '1')[7]['F']
        self.assertEqual(cell['value'], '...')
        # The kindergarten table prints '…' for Abkhazia AR in every year: no Abkhazia kindergarten row at all.
        self.assertFalse([r for r in self.rows if r['geography_id'] == 'unit.abkhazia_ar' and r['indicator_id'].split('.')[1].startswith(('kindergartens', 'kg_'))])
        # Vocational ICT starts in 2019; Geostat's zeros before that produce no row.
        for measure in ('vet_admitted', 'vet_graduates'):
            self.assertIsNone(find(self.rows, f'education.{measure}.field_ict', 2018))
            self.assertEqual(min(values(self.rows, f'education.{measure}.field_ict')), 2019)
        self.assertEqual(sorted(values(self.rows, 'education.vet_admitted.field_education')), list(range(2016, 2026)))
        self.assertEqual(sorted(values(self.rows, 'education.vet_graduates.field_social_journalism')), list(range(2020, 2026)))
        # No '…', '...' or '-' cell, and no blank, ever becomes a row.
        for row in self.rows:
            self.assertEqual(prepare.source_cell(row)['kind'] == 's', (row['source_id'], row['source_cell']) == ('geostat_education_schools_national', 'Z3'), row)
        # Akhalgori's schools are printed only to 2008/09; Eredvi, Tighva and Kurta only in a few early years.
        self.assertEqual(sorted(values(self.rows, 'education.schools.total', 'unit.akhalgori')), [2005, 2006, 2007, 2008])
        self.assertEqual(sorted(values(self.rows, 'education.schools.total', 'unit.kurta')), [2005, 2006, 2007])

    def test_unknown_label_stops(self):
        units = prepare.load_units()
        del units['Keda Municipality']
        with self.assertRaisesRegex(ValueError, 'units.csv'):
            prepare.extract(units)
        units = prepare.load_units()
        units['Keda Municipality'] = '07'  # Two labels on one code stop as well.
        with self.assertRaisesRegex(ValueError, 'twice'):
            prepare.extract(units)

    def test_parts_add_up(self):
        mismatches = []

        def check(name, parts, total, tolerance=Decimal(0)):
            years = sorted(set(total) & set.intersection(*(set(p) for p in parts))) if parts else []
            for year in years:
                difference = sum(p[year] for p in parts) - total[year]
                if abs(difference) > tolerance:
                    mismatches.append((name, year, str(difference)))
            return years

        for measure in ('schools', 'pupils_national', 'teachers'):
            years = check(f'{measure} public+private', [values(self.rows, f'education.{measure}.public'), values(self.rows, f'education.{measure}.private')],
                          values(self.rows, f'education.{measure}.total'), Decimal('0.15') if measure == 'pupils_national' else Decimal(0))
            self.assertGreaterEqual(len(years), 19, measure)
        sexed = sorted({r['geography_id'] for r in self.rows if r['indicator_id'] == 'education.teachers.women'})
        self.assertEqual(len(sexed), 76)  # Georgia, 11 regions, Abkhazia AR and 63 municipalities (Akhalgori prints none).
        for geography in sexed:
            total = {y: v for y, v in values(self.rows, 'education.teachers.total', geography).items() if y >= 2016}
            self.assertEqual(len(check(f'teachers sex {geography}', [values(self.rows, f'education.teachers.{g}', geography) for g in ('women', 'men')], total)), 10)
        for measure in ('he_students', 'he_admitted', 'he_graduates'):
            total = values(self.rows, f'education.{measure}.total')
            self.assertEqual(len(check(f'{measure} ownership', [values(self.rows, f'education.{measure}.{g}') for g in ('public', 'private')], total)), 15)
            self.assertEqual(len(check(f'{measure} sex', [values(self.rows, f'education.{measure}.{g}') for g in ('women', 'men')], total)), 15)
            self.assertEqual(len(check(f'{measure} levels', [values(self.rows, f'education.{measure}.{g}') for g in HE_LEVELS], total)), 15)
            self.assertEqual(len(check(f'{measure} fields', [values(self.rows, f'education.{measure}.{g}') for g in HE_FIELDS], total)), 15)
        for measure in ('vet_admitted', 'vet_graduates'):
            total = values(self.rows, f'education.{measure}.total')
            self.assertEqual(len(check(f'{measure} sex', [values(self.rows, f'education.{measure}.{g}') for g in ('women', 'men')], total)), 13)
            fields = {g: values(self.rows, f'education.{measure}.{g}') for g in VET_CURRENT + VET_OLD}
            for year in range(2013, 2026):
                parts = sum(series.get(year, Decimal(0)) for series in fields.values())  # Outside a field's span Geostat prints 0.
                if parts != total[year]:
                    mismatches.append((f'{measure} fields', year, str(parts - total[year])))
                current = sum(fields[g].get(year, Decimal(0)) for g in VET_CURRENT)
                if year >= 2023:
                    self.assertEqual(current, total[year], (measure, year))
                elif year >= 2019:  # The old fields still count students then; the shortfall is recorded exactly.
                    self.assertLessEqual(current, total[year], (measure, year))
                    self.assertEqual(self.report_shortfall[measure][str(year)], str(total[year] - current), (measure, year))
        self.assertEqual(self.report_shortfall, {
            'vet_admitted': {'2019': '5696', '2020': '119', '2021': '0', '2022': '0'},
            'vet_graduates': {'2019': '10434', '2020': '2079', '2021': '421', '2022': '546'}})
        geographies = {u['geography_id']: u['source_label'] for u in self.units}
        regions = [g for g in geographies if g.startswith('region.')]
        for measure in PLACE_MEASURES:
            groups = ('total', 'women', 'men') if measure == 'teachers' else ('total',)
            for group in groups:
                indicator = f'education.{measure}.{group}'
                for region in regions:
                    members = [g for g in geographies if prepare.region_of(g) == region]
                    if not members:
                        self.assertEqual(region, 'region.tbilisi')
                        continue
                    total = values(self.rows, indicator, region)
                    for year, value in total.items():
                        parts = sum(values(self.rows, indicator, g).get(year, Decimal(0)) for g in members)
                        if parts != value:
                            mismatches.append((f'{indicator} {region}', year, str(parts - value)))
                georgia = prepare.georgia_row_values(measure, group)  # Table 11's own GEORGIA row for schools, pupils, teachers.
                for year, value in georgia.items():
                    parts = sum(values(self.rows, indicator, g).get(year, Decimal(0)) for g in regions + ['unit.abkhazia_ar'])
                    if parts != value:
                        mismatches.append((f'{indicator} georgia', year, str(parts - value)))
        recorded = sorted((m['check'], m['year'], m['difference']) for m in prepare.known_differences())
        self.assertEqual(sorted(mismatches), recorded)
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'education.he_admitted.field_science', 2020, Decimal(1)))
        with self.assertRaisesRegex(ValueError, 'add up'):
            prepare.validate(patched(self.rows, 'education.pupils.total', 2020, Decimal(1), '09'))
        with self.assertRaisesRegex(ValueError, 'add up'):  # Women + men no longer equal Tbilisi's total.
            prepare.validate(patched(self.rows, 'education.teachers.women', 2020, Decimal(1), 'region.tbilisi'))

    def test_cross_checks(self):
        national_pupils = {r['year']: r['published_value'] for r in self.rows if r['indicator_id'] == 'education.pupils_national.total'}
        municipal = prepare.georgia_row_values('pupils', 'total')
        self.assertEqual(sorted(municipal), list(range(2005, 2026)))
        for year, value in municipal.items():
            self.assertEqual(str((value / 1000).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)), national_pupils[year], year)
        self.assertEqual(municipal[2025], Decimal(644243))
        schools = values(self.rows, 'education.schools.total')
        for year, value in prepare.georgia_row_values('schools', 'total').items():
            self.assertEqual(value, schools[year], year)
        teachers = values(self.rows, 'education.teachers.total')
        municipal_teachers = prepare.georgia_row_values('teachers', 'total')
        self.assertEqual(sorted(municipal_teachers), list(range(2016, 2026)))
        for year, value in municipal_teachers.items():
            self.assertEqual(value, teachers[year], year)
        # Georgia's teachers by sex are served from table 11, the total from table 06.
        self.assertEqual(find(self.rows, 'education.teachers.women', 2025)['source_id'], 'geostat_education_municipal')
        self.assertEqual(find(self.rows, 'education.teachers.total', 2025)['source_id'], 'geostat_education_teachers_national')
        self.assertIsNone(find(self.rows, 'education.pupils.total', 2025))  # Georgia's pupils are only the national thousands.

    def test_graduate_years(self):
        graduates = values(self.rows, 'education.he_graduates.total')
        self.assertEqual(sorted(graduates), list(range(2010, 2025)))
        row = find(self.rows, 'education.he_graduates.total', 2024)
        self.assertEqual((row['value'], row['period_label']), ('32494', '2024/25'))
        rows = prepare.sheet('geostat_education_higher', 'Graduates')
        column = ''.join(ch for ch in row['source_cell'] if ch.isalpha())
        self.assertEqual(prepare.text(rows[2][column]), '2025 year')
        self.assertEqual(sorted(values(self.rows, 'education.he_students.total')), list(range(2011, 2026)))

    def test_anchor_values(self):
        anchors = {
            ('education.schools.total', GEORGIA, 2025): '2292', ('education.schools.private', GEORGIA, 2025): '206',
            ('education.pupils_national.total', GEORGIA, 2025): '644.2', ('education.pupils.total', 'region.tbilisi', 2025): '232134',
            ('education.teachers.total', GEORGIA, 2025): '66328', ('education.kindergartens.total', GEORGIA, 2025): '1717',
            ('education.kg_children.total', GEORGIA, 2025): '130337', ('education.kg_staff.total', GEORGIA, 2025): '19176',
            ('education.he_students.total', GEORGIA, 2025): '195426', ('education.he_admitted.total', GEORGIA, 2025): '58554',
            ('education.he_graduates.total', GEORGIA, 2024): '32494', ('education.vet_admitted.total', GEORGIA, 2025): '19690',
            ('education.vet_graduates.total', GEORGIA, 2025): '10537'}
        for (indicator, geography, year), value in anchors.items():
            self.assertEqual(find(self.rows, indicator, year, geography)['published_value'], value, indicator)
        self.assertEqual(prepare.ANCHORS, anchors)

    def test_series_breaks(self):
        with open(prepare.ROOT / 'education-series-breaks.csv', encoding='utf-8-sig', newline='') as handle:
            breaks = list(csv.DictReader(handle))
        self.assertEqual(list(breaks[0]), ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note'])
        self.assertEqual([(b['break_id'], b['reference_date']) for b in breaks],
                         [('kindergarten_staff_2020', '2020-09-01'), ('he_levels_2015', '2015-09-01'), ('he_levels_2015_graduates', '2014-09-01')])
        indicators = {r['indicator_id'] for r in self.rows}
        self.assertEqual(breaks[0]['applies_to'].split(';'), sorted(i for i in indicators if i.startswith('education.kg_staff.')))
        self.assertIn('caregiver-pedagogues/caregivers/assistant caregivers/Inclusive education special teachers', breaks[0]['reason'])
        self.assertEqual(breaks[1]['applies_to'].split(';'),
                         sorted(i for i in indicators if i.startswith(('education.he_students.', 'education.he_admitted.')) and i.endswith(('.level_bachelor', '.level_master'))))
        self.assertEqual(breaks[2]['applies_to'].split(';'),
                         sorted(i for i in indicators if i.startswith('education.he_graduates.') and i.endswith(('.level_bachelor', '.level_master'))))
        self.assertIn('certified doctor (veterinarian) program, residency - are included in the Masters level', breaks[1]['reason'])

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
