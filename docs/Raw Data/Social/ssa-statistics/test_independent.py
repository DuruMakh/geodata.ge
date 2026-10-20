"""The independent verifier must handle SSA sheets with oversized used ranges."""
import csv
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent


class IndependentReader(unittest.TestCase):
    def test_sparse_wide_sheet_preserves_values_and_finishes_promptly(self):
        with TemporaryDirectory(prefix='.ssa-reader-', dir=ROOT) as folder:
            root = Path(folder)
            self.assertTrue(root.resolve().is_relative_to(ROOT.resolve()))
            (root / 'workbooks').mkdir()
            ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
            rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
            rows = ''.join(f'<row r="{r}"><c r="A{r}" t="inlineStr"><is><t>row {r}</t></is></c>'
                           f'<c r="B{r}"><v>1</v></c></row>' for r in range(1, 10000))
            rows += '<row r="10000"><c r="A10000" t="inlineStr"><is><t>სულ</t></is></c>'
            rows += '<c r="B10000"><v>9999</v></c><c r="AZ10000"><v>42</v></c></row>'
            with ZipFile(root / 'workbooks' / 'wide.xlsx', 'w', ZIP_DEFLATED) as book:
                book.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                              '<Default Extension="xml" ContentType="application/xml"/>'
                              '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                              '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
                book.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>'
                              '<sheet name="January" sheetId="1" r:id="rId1"/></sheets></workbook>')
                book.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                              f'<Relationship Id="rId1" Type="{rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
                book.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{ns}"><dimension ref="A1:XFD10000"/>'
                              f'<sheetData>{rows}</sheetData></worksheet>')
            (root / 'ssa-file-index.json').write_text(json.dumps({'files': [
                {'cat': 'fixture', 'ti': 1, 'label': '2025', 'name': 'wide.xlsx'}]}), encoding='utf-8')
            fields = ['table_id', 'year', 'row_label', 'column', 'aggregation', 'months_published', 'last_month', 'value']
            with (root / 'ssa-national-annual.csv').open('w', encoding='utf-8-sig', newline='') as handle:
                writer = csv.writer(handle, lineterminator='\n')
                writer.writerow(fields)
                writer.writerows([['fixture-01', 2025, 'სულ', 'B', 'sum_of_months', 1, 1, 9999],
                                  ['fixture-01', 2025, 'სულ', 'AZ', 'last_month', 1, 1, 42]])
            (root / 'ssa-programmes-monthly.csv').write_text('programme,year,month,recipients,amount_gel,recipients_source,amount_source\n', encoding='utf-8')
            try:
                result = subprocess.run(['node', str(ROOT / 'verify_independent.mjs'), '--official', str(root), '--out', str(root)],
                                        capture_output=True, text=True, encoding='utf-8', timeout=15)
            except subprocess.TimeoutExpired:
                self.fail('Independent reader scans empty columns instead of finishing the sparse workbook within 15 seconds')
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report['national_annual_rows_checked'], 2)
            self.assertEqual(report['problems'], 0)
            csv_path = root / 'ssa-national-annual.csv'
            csv_path.write_bytes(csv_path.read_text(encoding='utf-8-sig').replace(',9999\n', ',9998\n').encode('utf-8-sig'))
            changed = subprocess.run(['node', str(ROOT / 'verify_independent.mjs'), '--official', str(root), '--out', str(root)],
                                     capture_output=True, text=True, encoding='utf-8', timeout=15)
            self.assertEqual(changed.returncode, 1, changed.stdout + changed.stderr)
            self.assertEqual(json.loads(changed.stdout)['problems'], 1)


if __name__ == '__main__':
    unittest.main()
