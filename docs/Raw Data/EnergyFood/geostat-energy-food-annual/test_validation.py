"""Regression tests for the annual energy and food research package (stdlib unittest only)."""

from collections import Counter
import copy
from decimal import Decimal
from pathlib import Path
import sys
import tempfile
import unittest
from zipfile import ZipFile

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare  # noqa: E402


def find(rows, indicator_id, year):
    return next(row for row in rows if row['indicator_id'] == indicator_id and row['year'] == year)


def altered(rows, indicator_id, year, value):
    """A copy with one value changed and its published text kept consistent, so only a cross-check can notice."""
    copied = [dict(row) for row in rows]
    row = find(copied, indicator_id, year)
    row['value'] = value
    row['published_value'] = prepare.display(indicator_id, year, Decimal(value), row['source_number_format'])
    return copied


def workbook(path, sheets, strings=(), styles=None):
    """A minimal xlsx. `sheets` is a list of (name, rId, part, xml); the order listed is the workbook order."""
    listing = ''.join(f'<sheet name="{name}" sheetId="{index}" r:id="{rid}"/>' for index, (name, rid, _, _) in enumerate(sheets, 1))
    rels = ''.join(f'<Relationship Id="{rid}" Type="worksheet" Target="worksheets/{part}"/>' for _, rid, part, _ in sheets)
    main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    with ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', f'<workbook xmlns="{main}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>{listing}</sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>')
        archive.writestr('xl/styles.xml', styles or f'<styleSheet xmlns="{main}"><cellXfs><xf numFmtId="0"/></cellXfs></styleSheet>')
        archive.writestr('xl/sharedStrings.xml', f'<sst xmlns="{main}">' + ''.join(f'<si><t>{text}</t></si>' for text in strings) + '</sst>')
        for _, _, part, xml in sheets:
            archive.writestr(f'xl/worksheets/{part}', f'<worksheet xmlns="{main}"><sheetData>{xml}</sheetData></worksheet>')


class EnergyFoodPackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = prepare.extract()

    def test_primary_count_is_681(self):
        groups = Counter('electricity' if row['indicator_id'].startswith('electricity.') else
                         'food' if row['indicator_id'].startswith('food.') else
                         'supply page' if row['indicator_id'].split('.')[1] in ('supply', 'production', 'imports', 'exports') else
                         'use page' for row in self.rows)
        self.assertEqual(len(self.rows), 681)
        self.assertEqual(groups, {'supply page': 204, 'use page': 168, 'electricity': 165, 'food': 144})
        prepare.validate(self.rows)

    def test_altered_cell_fails(self):
        copied = [dict(row) for row in self.rows]
        find(copied, 'electricity.imports', 2020)['value'] = '1'
        with self.assertRaisesRegex(ValueError, 'published'):
            prepare.validate(copied)
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(altered(self.rows, 'electricity.imports', 2020, '1'))
        relabelled = [dict(row) for row in self.rows]
        find(relabelled, 'electricity.imports', 2020)['source_label'] = 'Exports | Electricity (GWh)'
        with self.assertRaisesRegex(ValueError, 'source cell'):
            prepare.validate(relabelled)

    def test_missing_extra_and_duplicate_rows_fail(self):
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows[1:])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            prepare.validate(self.rows + [dict(self.rows[0])])
        extra = dict(find(self.rows, 'electricity.production.hydro', 2020), indicator_id='electricity.production.wind', year=2015)
        with self.assertRaisesRegex(ValueError, 'Coverage'):
            prepare.validate(self.rows + [extra])

    def test_balance_identity_fails_when_violated(self):
        for year in range(2013, 2025):
            prepare.check_energy_balance(year)
        sheet, columns = prepare.read_ktoe(2024)
        broken = copy.deepcopy(sheet)
        broken[prepare.find_row(sheet, 'imports')][columns['natural_gas']]['value'] += Decimal('1')
        with self.assertRaisesRegex(ValueError, 'Balance identity'):
            prepare.check_energy_balance(2024, broken, columns)
        broken = copy.deepcopy(sheet)  # 0.3 of coal stock change that supply does not reflect
        broken[prepare.find_row(sheet, 'stock changes')][columns['coal']]['value'] += Decimal('0.3')
        with self.assertRaisesRegex(ValueError, 'Balance identity'):
            prepare.check_energy_balance(2024, broken, columns)

    def test_total_column_fails_when_violated(self):
        for indicator_id in ('energy.supply.coal', 'energy.imports.natural_gas', 'energy.final_fuel.electricity'):
            current = Decimal(find(self.rows, indicator_id, 2022)['value'])
            with self.assertRaisesRegex(ValueError, 'Total column'):
                prepare.validate(altered(self.rows, indicator_id, 2022, str(current + 1)))

    def test_final_sum_fails_when_violated(self):
        with self.assertRaisesRegex(ValueError, 'Final consumption'):
            prepare.validate(altered(self.rows, 'energy.final.transport', 2019, str(Decimal(find(self.rows, 'energy.final.transport', 2019)['value']) + 2)))
        with self.assertRaisesRegex(ValueError, 'Final consumption'):
            prepare.validate(altered(self.rows, 'electricity.final.households', 2019, str(Decimal(find(self.rows, 'electricity.final.households', 2019)['value']) + 2)))

    def test_electricity_production_sum(self):
        with self.assertRaisesRegex(ValueError, 'Electricity production'):
            prepare.validate(altered(self.rows, 'electricity.production.thermal', 2021, str(Decimal(find(self.rows, 'electricity.production.thermal', 2021)['value']) + 1)))
        # 2013-2015 have no wind row: it counts as 0 inside this check only, and no wind row is stored
        for year in (2013, 2014, 2015):
            total = Decimal(find(self.rows, 'electricity.production.total', year)['value'])
            parts = sum(Decimal(find(self.rows, f'electricity.production.{kind}', year)['value']) for kind in ('thermal', 'hydro'))
            self.assertLessEqual(abs(total - parts), Decimal('0.5'))

    def test_food_ratio_plausible(self):
        with self.assertRaisesRegex(ValueError, 'Self-sufficiency ratio'):
            prepare.validate(altered(self.rows, 'food.self_sufficiency.wheat', 2020, '40'))
        flows = prepare.food_flows()
        self.assertEqual(len(flows), 144)
        gap = abs(Decimal(find(self.rows, 'food.self_sufficiency.sheep_goat_meat', 2017)['value']) -
                  prepare.implied_ratio(*flows[('sheep_goat_meat', 2017)]))
        self.assertGreater(gap, 5)  # a gap this size is plausible but not explained
        self.assertLessEqual(gap, 10)

    def test_spot_values(self):
        expected = [('energy.supply.total', 2024, '5914.5'), ('energy.imports.total', 2024, '5099'),
                    ('electricity.production.total', 2024, '14234.1'), ('food.self_sufficiency.wheat', 2025, '19'),
                    ('food.self_sufficiency.sheep_goat_meat', 2018, '345')]
        for indicator_id, year, value in expected:
            self.assertEqual(find(self.rows, indicator_id, year)['value'], value, f'{indicator_id} {year}')
        self.assertEqual(find(self.rows, 'energy.imports.total', 2024)['published_value'], '5099.0')
        self.assertEqual(find(self.rows, 'energy.imports.coal', 2024)['value'], '138.69999999999999')  # the exact stored token
        self.assertEqual(find(self.rows, 'energy.imports.coal', 2024)['published_value'], '138.7')
        # Food ratios follow their own cell's number format ("0" or "General"), so 2024-2025 publish as whole numbers
        self.assertEqual(find(self.rows, 'food.self_sufficiency.wheat', 2025)['published_value'], '19')
        self.assertEqual(find(self.rows, 'food.self_sufficiency.wheat', 2023)['published_value'], '22')
        for indicator_id, year, value, published in [('food.self_sufficiency.meat', 2024, '47.1', '47'), ('food.self_sufficiency.milk', 2025, '68.400000000000006', '68'),
                                                     ('food.self_sufficiency.eggs', 2024, '96.5', '97')]:
            row = find(self.rows, indicator_id, year)
            self.assertEqual((row['value'], row['published_value'], row['source_number_format']), (value, published, '0'))

    def test_wind_starts_2016(self):
        wind = [row['year'] for row in self.rows if row['indicator_id'] == 'electricity.production.wind']
        self.assertEqual(sorted(wind), list(range(2016, 2025)))
        for indicator in ('electricity.production.thermal', 'electricity.production.hydro'):
            self.assertEqual(min(row['year'] for row in self.rows if row['indicator_id'] == indicator), 2013)

    def test_losses_label_changes_are_kept(self):
        labels = {row['year']: row['source_label'] for row in self.rows if row['indicator_id'] == 'electricity.losses'}
        self.assertEqual({year for year, label in labels.items() if label.startswith('Distribution Losses')}, {2016, 2017, 2018})
        self.assertTrue(all(label.startswith(('Losses', 'LOSSES')) for year, label in labels.items() if year not in (2016, 2017, 2018)))

    def test_dash_is_no_flow(self):
        self.assertEqual(prepare.cell_value({'kind': 's', 'value': '-'}), ('0', 'no_flow'))
        self.assertEqual(prepare.cell_value({'kind': 's', 'value': '- '}), ('0', 'no_flow'))  # 2013-2015 workbooks add a non-breaking space
        self.assertEqual(prepare.cell_value({'kind': 'n', 'value': Decimal('138.69999999999999')}), ('138.69999999999999', 'published'))
        dashes = [row for row in self.rows if row['value_status'] == 'no_flow']
        self.assertEqual(Counter(row['value'] for row in dashes), {'0': len(dashes)})
        for row in dashes:
            self.assertIn(prepare.reread(row['source_id'], row['source_sheet'], row['source_cell'])['value'].strip('  '), '-')
        report = prepare.build(check=True)
        self.assertEqual(report['no_flow_count'], len(dashes))
        self.assertEqual(len(report['no_flow_cells']), len(dashes))

    def test_ellipsis_fails(self):
        for text in ('…', '… '):
            with self.assertRaisesRegex(ValueError, 'Ellipsis'):
                prepare.cell_value({'kind': 's', 'value': text})
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            prepare.cell_value({'kind': 's', 'value': 'n/a'})
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            prepare.cell_value(None)
        # The 2013 electricity workbook really contains an ellipsis (Non-ferrous metals); no served cell may be one
        sheet = prepare.read_named(prepare.ROOT / 'official/energy-balance-2013-electricity.xlsx', 'GWh&TJ')
        cells = [cell for row in sheet.values() for cell in row.values() if cell['kind'] == 's' and prepare.clean(cell['value']) == '…']
        self.assertTrue(cells)
        served = {(row['source_id'], row['source_cell']) for row in self.rows}
        self.assertFalse([cell for cell in cells if ('geostat_energy_balance_2013_electricity', cell['cell']) in served])

    def test_self_closing_cell(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'book.xlsx'
            rows = ('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="0"/><c r="C1"><v>7.5</v></c></row>'
                    '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1</v></c><c r="C2" s="0"/></row>')
            workbook(path, [('GWH&amp;TJ', 'rId1', 'sheet1.xml', rows)], strings=['Production', 'Imports'])
            sheet = prepare.read_named(path, 'GWh&TJ')
        self.assertEqual({column: str(cell['value']) for column, cell in sheet[1].items()}, {'A': 'Production', 'C': '7.5'})
        self.assertEqual({column: str(cell['value']) for column, cell in sheet[2].items()}, {'A': 'Imports', 'B': '1'})
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            prepare.cell_value(sheet[1].get('B'))  # an empty cell is absent, never read as a value

    def test_sheet_order_from_rels(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'book.xlsx'
            # The workbook lists TJ first, but its relationship points at the second part; KTOE points at the first.
            workbook(path, [('TJ', 'rId2', 'sheet2.xml', '<row r="1"><c r="A1"><v>2</v></c></row>'),
                            ('KTOE', 'rId1', 'sheet1.xml', '<row r="1"><c r="A1"><v>1</v></c></row>')])
            self.assertEqual(str(prepare.read_named(path, 'ktoe')[1]['A']['value']), '1')
            self.assertEqual(str(prepare.read_named(path, 'tj')[1]['A']['value']), '2')
            with self.assertRaisesRegex(ValueError, 'sheet'):
                prepare.read_named(path, 'GWh&TJ')

    def test_real_workbooks_resolve_sheets_by_case_insensitive_name(self):
        names = {prepare.sheet_name(prepare.ROOT / f'official/energy-balance-{year}-electricity.xlsx', 'GWh&TJ') for year in range(2013, 2025)}
        self.assertEqual(names, {'GWh&TJ', 'GWH&TJ'})
        food = prepare.sheet_names(prepare.ROOT / 'official/food-balance-sheets.xlsx')
        self.assertEqual(sorted(food), sorted(prepare.FOODS.values()))

    def test_labels_are_found_by_text(self):
        sheet, columns = prepare.read_ktoe(2013)  # 2013 header says "Geothermal, solar etc." and rows sit one line higher
        self.assertEqual(prepare.find_row(sheet, 'domestic supply'), 11)
        self.assertEqual(columns['wind_solar_geothermal'], 'H')
        sheet, columns = prepare.read_ktoe(2024)
        self.assertEqual(prepare.find_row(sheet, 'domestic supply'), 12)
        first = prepare.find_row(sheet, 'residential', after='final consumption')
        self.assertEqual(first, 62)
        self.assertEqual(prepare.norm('   Mining and quarrying1'), 'mining and quarrying')
        self.assertEqual(prepare.norm('Iron and steel[1]'), 'iron and steel')
        self.assertEqual(prepare.norm('Transformation Sector - Production'), prepare.norm('Transformation Sector-Production'))
        self.assertEqual(prepare.norm('Self-sufficiency ratio,%'), prepare.norm('Self-sufficiency ratio, %'))
        with self.assertRaisesRegex(ValueError, 'row'):
            prepare.find_row(sheet, 'no such row')

    def test_committed_outputs_reproduce(self):
        prepare.build(check=True)


if __name__ == '__main__':
    unittest.main()
