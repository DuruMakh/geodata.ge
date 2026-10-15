"""Regression tests for the annual health research package (stdlib unittest only)."""

from collections import Counter
import csv
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402

REPOSITORY = prepare.ROOT.parents[3]
GEORGIA = 'georgia'
REGIONS = ['region.tbilisi', 'region.adjara', 'region.guria', 'region.imereti', 'region.kakheti', 'region.mtskheta_mtianeti',
           'region.racha_lechkhumi_kvemo_svaneti', 'region.samegrelo_zemo_svaneti', 'region.samtskhe_javakheti',
           'region.kvemo_kartli', 'region.shida_kartli']
CAUSES = ['infectious', 'cancer', 'blood', 'endocrine', 'mental', 'nervous', 'eye', 'ear', 'circulatory', 'respiratory', 'digestive',
          'skin', 'musculoskeletal', 'urogenital', 'pregnancy', 'perinatal', 'congenital', 'ill_defined', 'external', 'covid19']
SPECIALITIES = ['internal', 'surgery', 'obgyn', 'paediatrics', 'eye', 'ent', 'neurology', 'psychiatry', 'tuberculosis',
                'dermatovenereology', 'radiology', 'rehabilitation', 'dentistry', 'other']


def find(rows, indicator_id, year, area_id=GEORGIA):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year and row['area_id'] == area_id)


def altered(rows, indicator_id, year, value, area_id=GEORGIA):
    """A copy with one value changed and its published text kept consistent, so only a cross-check can notice."""
    copied = [dict(row) for row in rows]
    row = find(copied, indicator_id, year, area_id)
    row['value'] = value
    row['published_value'] = prepare.display(row['unit'], value, row['source_number_format'])
    return copied


def workbook(path, rows_xml, strings=()):
    """A minimal one-sheet xlsx."""
    main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    with ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', f'<workbook xmlns="{main}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="1" sheetId="1" r:id="rId1"/></sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        archive.writestr('xl/styles.xml', f'<styleSheet xmlns="{main}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.0"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="3"/><xf numFmtId="164"/></cellXfs></styleSheet>')
        archive.writestr('xl/sharedStrings.xml', f'<sst xmlns="{main}">' + ''.join(f'<si><t>{text}</t></si>' for text in strings) + '</sst>')
        archive.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{main}"><sheetData>{rows_xml}</sheetData></worksheet>')


class HealthPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()
        with (prepare.ROOT / 'coverage.csv').open(encoding='utf-8-sig', newline='') as handle:
            cls.coverage = list(csv.DictReader(handle))

    def values(self, indicator_id, area_id=GEORGIA):
        return {row['year']: Decimal(row['value']) for row in self.rows if row['indicator_id'] == indicator_id and row['area_id'] == area_id}

    def test_counts(self):
        counted = Counter((row['indicator_id'], row['area_id']) for row in self.rows)
        self.assertEqual({(line['indicator_id'], line['area_id']): int(line['observations']) for line in self.coverage}, dict(counted))
        self.assertEqual(sum(int(line['observations']) for line in self.coverage), len(self.rows))
        # Each family counted from its own shape, not from the generated file
        families = Counter(row['indicator_id'].split('.')[1] for row in self.rows)
        self.assertEqual(families['staff'], 15 * 24 + 3 * 24 + 4 * 10)
        self.assertEqual(families['facilities'] + families['visits'], 4 * 24)
        self.assertEqual(families['illness'], 15 * 24 + 4 + 3 * 20 + 24 + 24 + 10 + 10 + 24 + 24)
        self.assertEqual(families['deaths'], 12 * (20 * 12 + 6))
        self.assertEqual(families['death_rate'], 12 * 12)
        print(f'\nServed rows: {len(self.rows)}')
        self.assertEqual(len(self.rows), 4204)
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        copied = [dict(row) for row in self.rows]
        find(copied, 'health.illness.tuberculosis', 2020)['value'] = '1'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copied)
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(altered(self.rows, 'health.illness.tuberculosis', 2020, '1'))
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(altered(self.rows, 'health.death_rate.total', 2025, '11.3', 'region.guria'))
        moved = [dict(row) for row in self.rows]
        find(moved, 'health.illness.hiv', 2020)['source_cell'] = 'W3'
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(moved)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])])
        extra = dict(find(self.rows, 'health.illness.diabetes', 2016), year=2015)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [extra])

    def test_display_rounding(self):
        rate = find(self.rows, 'health.death_rate.total', 2025)
        self.assertTrue(rate['value'].startswith('11.2605794'))
        self.assertEqual((rate['published_value'], rate['unit'], rate['source_number_format']), ('11.3', 'per_1000_population', '#,##0.0'))
        self.assertEqual(find(self.rows, 'health.illness.respiratory', 2025)['published_value'], '500.359')
        self.assertEqual(find(self.rows, 'health.illness.respiratory', 2025)['value'], '500.35899999999998')  # the exact stored token
        self.assertEqual(find(self.rows, 'health.death_rate.total', 2024, 'region.tbilisi')['value'], '9.8000000000000007')
        self.assertEqual(find(self.rows, 'health.death_rate.total', 2024, 'region.tbilisi')['published_value'], '9.8')
        self.assertEqual(find(self.rows, 'health.illness.infectious', 2002)['published_value'], '44.2')
        self.assertEqual(prepare.display('per_1000_population', '10.45', '#,##0.0'), '10.5')  # half up
        self.assertEqual(prepare.display('persons', '2.5', '#\\ ##0'), '3')
        self.assertEqual(prepare.display('persons', '1234', 'General'), '1234')
        with self.assertRaisesRegex(ValueError, 'number format'):
            prepare.display('persons', '1', '0.0')
        with self.assertRaisesRegex(ValueError, 'number format'):
            prepare.display('per_1000_population', '1', 'General')

    def test_staff_totals(self):
        thousands = prepare.main_staff_thousands()
        for indicator_id, key in (('health.staff.doctors', 'doctors'), ('health.staff.nurses', 'nurses')):
            served = self.values(indicator_id)
            self.assertEqual(sorted(served), list(range(2002, 2026)))
            for year, persons in served.items():
                self.assertEqual((thousands[key][year] * 1000).quantize(Decimal(1)), persons, f'{indicator_id} {year}')
        doctors = self.values('health.staff.doctors')
        for year in range(2002, 2026):
            self.assertEqual(sum(self.values(f'health.staff.doctors_{name}')[year] for name in SPECIALITIES), doctors[year], year)
        with self.assertRaisesRegex(ValueError, 'Doctors'):
            prepare.validate(altered(self.rows, 'health.staff.doctors', 2010, str(doctors[2010] + 1)))
        with self.assertRaisesRegex(ValueError, 'specialities'):
            prepare.validate(altered(self.rows, 'health.staff.doctors_surgery', 2010, str(self.values('health.staff.doctors_surgery')[2010] + 1)))
        nurses = self.values('health.staff.nurses')
        with self.assertRaisesRegex(ValueError, 'Nurses'):
            prepare.validate(altered(self.rows, 'health.staff.nurses', 2025, str(nurses[2025] + 1)))

    def test_causes_add_up(self):
        for area in [GEORGIA] + REGIONS:
            total = self.values('health.deaths.total', area)
            self.assertEqual(sorted(total), list(range(2014, 2026)))
            for year in total:
                parts = sum(self.values(f'health.deaths.{cause}', area).get(year, Decimal(0)) for cause in CAUSES)
                self.assertEqual(parts, total[year], f'{area} {year}')
        for indicator in ['total'] + CAUSES:
            georgia = self.values(f'health.deaths.{indicator}')
            for year in georgia:
                self.assertEqual(sum(self.values(f'health.deaths.{indicator}', area)[year] for area in REGIONS), georgia[year], f'{indicator} {year}')
        with self.assertRaisesRegex(ValueError, 'Causes'):
            prepare.validate(altered(self.rows, 'health.deaths.circulatory', 2025, '16712', 'region.guria'))
        with self.assertRaisesRegex(ValueError, 'Causes'):
            prepare.validate(altered(self.rows, 'health.deaths.covid19', 2021, '11287'))
        with self.assertRaisesRegex(ValueError, 'regions'):
            georgia = Decimal(find(self.rows, 'health.deaths.total', 2025)['value'])
            patched = altered(self.rows, 'health.deaths.total', 2025, str(georgia + 1))
            patched = altered(patched, 'health.deaths.ill_defined', 2025, str(Decimal(find(self.rows, 'health.deaths.ill_defined', 2025)['value']) + 1))
            prepare.validate(patched)

    def test_deaths_match_population(self):
        with (REPOSITORY / 'data/imports/demography-vital-annual.csv').open(encoding='utf-8-sig', newline='') as handle:
            population = {(line['geography_id'], int(line['year'])): Decimal(line['value'])
                          for line in csv.DictReader(handle) if line['series_id'] == 'demography.deaths'}
        # Population serves Georgia for 2014-2025 but the regions only for 2015-2025: compare every pair that exists
        checked, missing = 0, []
        for row in self.rows:
            if row['indicator_id'] == 'health.deaths.total':
                geography = 'country.georgia' if row['area_id'] == GEORGIA else row['area_id']
                if (geography, row['year']) not in population:
                    missing.append((row['area_id'], row['year']))
                    continue
                self.assertEqual(population[(geography, row['year'])], Decimal(row['value']), f"{row['area_id']} {row['year']}")
                checked += 1
        self.assertEqual(checked, 12 + 11 * 11)
        self.assertEqual(missing, [(area, 2014) for area in sorted(REGIONS)])

    def test_icd10_split(self):
        years = lambda indicator: sorted(row['year'] for row in self.rows if row['indicator_id'] == indicator)  # noqa: E731
        self.assertEqual(years('health.illness.nervous_sense_organs'), list(range(2002, 2006)))
        for indicator in ('nervous', 'eye', 'ear'):
            self.assertEqual(years(f'health.illness.{indicator}'), list(range(2006, 2026)))

    def test_no_placeholder_rows(self):
        marked = []
        for row in self.rows:
            cell = prepare.reread(row['source_id'], row['source_sheet'], row['source_cell'])
            if cell['kind'] == 's':  # the one number printed as text with footnote asterisks
                marked.append((row['indicator_id'], row['area_id'], row['year'], cell['value'], row['value']))
            self.assertNotIn(prepare.clean(cell['value']) if isinstance(cell['value'], str) else '', prepare.PLACEHOLDERS)
        self.assertEqual(marked, [('health.deaths.pregnancy', GEORGIA, 2021, '34***', '34')])
        self.assertEqual(Counter(row['value_status'] for row in self.rows), {'published': len(self.rows)})
        self.assertEqual(Counter(row['basis'] for row in self.rows), {'actual': len(self.rows)})
        self.assertEqual({row['area_id'] for row in self.rows}, {GEORGIA, *REGIONS})
        self.assertFalse([row for row in self.rows if 'abkhazia' in row['area_id'].lower()])
        # The placeholders really are in the workbooks, in cells that are not served
        sheet = prepare.sheet('geostat_health_morbidity_groups')
        placeholders = {prepare.clean(cell['value']) for row in sheet.values() for cell in row.values() if cell['kind'] == 's'} & set(prepare.PLACEHOLDERS)
        self.assertEqual(placeholders, {'...', '…'})
        self.assertIn('-', {prepare.clean(cell['value']) for row in prepare.sheet('geostat_death_rate_region').values() for cell in row.values() if cell['kind'] == 's'})
        served = {(row['source_id'], row['source_cell']) for row in self.rows}
        nurses = prepare.sheet('geostat_health_nurses')
        unserved = [cell['cell'] for row in nurses.values() for cell in row.values() if cell['kind'] == 's' and prepare.clean(cell['value']) == '…']
        self.assertEqual(len(unserved), 4 * 14)
        self.assertFalse([cell for cell in unserved if ('geostat_health_nurses', cell) in served])

    def test_placeholders_in_served_cells_fail(self):
        for text in ('…', '...', '-', '- '):
            with self.assertRaisesRegex(ValueError, 'placeholder'):
                prepare.cell_token({'kind': 's', 'value': text})
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            prepare.cell_token({'kind': 's', 'value': 'n/a'})
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            prepare.cell_token(None)
        self.assertEqual(prepare.cell_token({'kind': 'n', 'value': Decimal('0')}), '0')  # a real zero is a value
        self.assertEqual(prepare.cell_token({'kind': 'n', 'value': Decimal('11.260579422224215')}), '11.260579422224215')

    def test_anchor_values(self):
        anchors = [('health.staff.doctors', GEORGIA, 2025, '22491'), ('health.staff.nurses', GEORGIA, 2025, '21262'),
                   ('health.facilities.hospitals', GEORGIA, 2025, '232'), ('health.facilities.beds', GEORGIA, 2025, '15.232'),
                   ('health.visits.outpatient', GEORGIA, 2025, '16760.072'), ('health.illness.respiratory', GEORGIA, 2025, '500.359'),
                   ('health.illness.tuberculosis', GEORGIA, 2025, '933'), ('health.illness.hiv', GEORGIA, 2025, '562'),
                   ('health.deaths.total', GEORGIA, 2025, '44319'), ('health.deaths.circulatory', GEORGIA, 2025, '16711'),
                   ('health.deaths.covid19', GEORGIA, 2021, '11286'), ('health.deaths.total', 'region.guria', 2025, '1567'),
                   ('health.death_rate.total', 'region.racha_lechkhumi_kvemo_svaneti', 2025, '19.7')]
        for indicator_id, area, year, published in anchors:
            self.assertEqual(find(self.rows, indicator_id, year, area)['published_value'], published, f'{indicator_id} {area} {year}')

    def test_units_and_ranges(self):
        units = {}
        for row in self.rows:
            units.setdefault(row['indicator_id'], set()).add(row['unit'])
        self.assertTrue(all(len(found) == 1 for found in units.values()))
        flat = {indicator: next(iter(found)) for indicator, found in units.items()}
        self.assertEqual(flat['health.facilities.beds'], 'units_thousand')
        self.assertEqual(flat['health.visits.outpatient'], 'visits_thousand')
        self.assertEqual(flat['health.facilities.outpatient_clinics'], 'units')
        self.assertEqual(flat['health.illness.cancer'], 'persons_thousand')
        self.assertEqual(flat['health.illness.syphilis'], 'persons')
        self.assertEqual(flat['health.death_rate.total'], 'per_1000_population')
        self.assertEqual(set(flat.values()), {'persons', 'persons_thousand', 'units', 'units_thousand', 'visits_thousand', 'per_1000_population'})
        years = lambda indicator, area=GEORGIA: sorted(row['year'] for row in self.rows if row['indicator_id'] == indicator and row['area_id'] == area)  # noqa: E731
        for name in ('midwives', 'medical'):
            self.assertEqual(years(f'health.staff.nurses_{name}'), list(range(2002, 2026)))
        for name in ('doctor_assistants', 'lab_assistants', 'xray_assistants', 'other'):
            self.assertEqual(years(f'health.staff.nurses_{name}'), list(range(2002, 2012)))
        self.assertEqual(years('health.deaths.covid19', 'region.kakheti'), list(range(2020, 2026)))
        self.assertEqual(years('health.illness.diabetes'), list(range(2016, 2026)))
        self.assertEqual(years('health.illness.anaemia'), list(range(2016, 2026)))
        self.assertEqual(years('health.death_rate.total', 'region.tbilisi'), list(range(2014, 2026)))
        self.assertEqual(find(self.rows, 'health.death_rate.total', 2025, 'region.tbilisi')['source_cell'], 'AG6')  # "C. Tbilisi"
        self.assertEqual(find(self.rows, 'health.deaths.covid19', 2020)['source_cell'], 'I25')  # the extra empty cells before it are skipped

    def test_label_typos_are_matched_as_printed(self):
        for label in ('ophtalmologists', 'neuropayhologists', 'gonorrheae'):
            self.assertIn(label, json.dumps(prepare.CELL_LABELS))
        sheet = prepare.sheet('geostat_health_physicians')
        self.assertEqual(prepare.find_row(sheet, 'ophtalmologists'), 9)
        with self.assertRaisesRegex(ValueError, 'row'):
            prepare.find_row(sheet, 'ophthalmologists')
        self.assertEqual(prepare.clean('diseases of the ear  and mastoid process'), 'diseases of the ear and mastoid process')

    def test_series_breaks(self):
        path = prepare.ROOT / 'health-series-breaks.csv'
        self.assertTrue(path.read_bytes().startswith(b'\xef\xbb\xbf'))
        with path.open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            breaks = {line['break_id']: line for line in reader}
        self.assertEqual(reader.fieldnames, ['break_id', 'applies_to', 'reference_date', 'reason', 'source_note'])
        self.assertEqual({key: line['reference_date'] for key, line in breaks.items()},
                         {'staff_definitions_2012': '2012-01-01', 'staff_register_2020': '2020-01-01', 'icd10_groups_2006': '2006-01-01',
                          'new_cases_electronic_2020': '2020-01-01'})
        indicators = {row['indicator_id'] for row in self.rows}
        for line in breaks.values():
            applies = line['applies_to'].split(';')
            self.assertTrue(set(applies) <= indicators, line['break_id'])
            self.assertEqual(len(applies), len(set(applies)))
        self.assertEqual(len(breaks['staff_definitions_2012']['applies_to'].split(';')), 15 + 7)
        self.assertEqual(breaks['icd10_groups_2006']['applies_to'], 'health.illness.nervous_sense_organs;health.illness.nervous;health.illness.eye;health.illness.ear')
        self.assertIn('health.illness.diabetes', breaks['new_cases_electronic_2020']['applies_to'])
        self.assertIn('ISCO-08', breaks['staff_definitions_2012']['reason'])
        # Every quoted piece is a footnote that Geostat prints in the named workbook
        readme = ' '.join((prepare.ROOT / 'README.md').read_text(encoding='utf-8').split())
        for source_id, quote in prepare.FOOTNOTE_QUOTES.values():
            self.assertIn(quote, prepare.workbook_text(source_id))
            self.assertIn(quote, readme)  # and the README quotes it as printed

    def test_footnote_quote_missing_fails(self):
        with self.assertRaisesRegex(ValueError, 'footnote'):
            prepare.check_footnote('geostat_health_physicians', 'This sentence is not printed by Geostat.')

    def test_manifest_matches_files(self):
        records = json.loads((prepare.ROOT / 'source-manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(records), 21 + 13 + 2)
        on_disk = {path.relative_to(prepare.ROOT).as_posix() for path in (prepare.ROOT / 'official').rglob('*') if path.is_file()}
        self.assertEqual({record['local_file'] for record in records}, on_disk)
        for record in records:
            data = (prepare.ROOT / record['local_file']).read_bytes()
            self.assertEqual((record['sha256'], record['bytes']), (hashlib.sha256(data).hexdigest().upper(), len(data)))
        ids = {record['source_id'] for record in records}
        self.assertEqual(len(ids), len(records))
        served = {row['source_id'] for row in self.rows}
        self.assertEqual(served, {'geostat_health_physicians', 'geostat_health_nurses', 'geostat_health_main', 'geostat_health_morbidity_groups',
                                  'geostat_health_tuberculosis', 'geostat_health_hiv', 'geostat_health_diabetes', 'geostat_health_anaemia',
                                  'geostat_health_sti', 'geostat_deaths_by_cause_region', 'geostat_death_rate_region'})
        self.assertTrue(served <= ids)
        self.assertTrue({'geostat_health_page', 'geostat_deaths_page', 'geostat_health_abortions', 'geostat_deaths_23_1_deaths_by_chapters_sex'} <= ids)
        self.assertTrue(all(record['source_id'].startswith(('geostat_health_', 'geostat_deaths_', 'geostat_death_rate_')) for record in records))

    def test_self_closing_cell(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'book.xlsx'
            rows = ('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="1"/><c r="C1" s="2"><v>7.5</v></c></row>'
                    '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1</v></c><c r="C2" s="1"/><c r="D2" s="1"><v>1234</v></c></row>')
            workbook(path, rows, strings=['Production', 'Imports'])
            sheet = prepare.read_sheet(path)
        self.assertEqual({column: str(cell['value']) for column, cell in sheet[1].items()}, {'A': 'Production', 'C': '7.5'})
        self.assertEqual(sheet[1]['C']['format'], '#,##0.0')
        self.assertEqual({column: str(cell['value']) for column, cell in sheet[2].items()}, {'A': 'Imports', 'B': '1', 'D': '1234'})
        self.assertEqual(sheet[2]['D']['format'], '#,##0')  # a built-in format id is resolved, never left "unsupported"
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            prepare.cell_token(sheet[1].get('B'))  # an empty cell is absent, never read as a value

    def test_extra_empty_cell_before_values_is_skipped(self):
        sheet = prepare.sheet('geostat_deaths_by_cause_region')
        row = prepare.death_blocks('geostat_deaths_by_cause_region')[GEORGIA][1]['XXII']
        self.assertEqual(row, 25)
        self.assertTrue(all(column not in sheet[row] for column in 'CDEFGH'))
        self.assertEqual(sorted(prepare.year_columns(sheet).items(), key=lambda item: item[1])[6], ('I', 2020))

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
