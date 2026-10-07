"""Behavioral checks against original cells and deliberate corruptions."""
import importlib
import json
from decimal import Decimal
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
TMP = ROOT.parents[4] / '.tmp'

class PackageTests(unittest.TestCase):
    def module(self, name):
        try:
            return importlib.import_module(name)
        except ModuleNotFoundError as error:
            self.fail(f'{name} feature is not implemented: {error}')

class ArchiveTests(PackageTests):
    def test_exact_source_inventory(self):
        archive = self.module('archive')
        sources = archive.load_verified_sources(ROOT)
        self.assertEqual(len(sources),45)
        self.assertEqual(sum(r['local_file'].endswith('.xlsx') for r in sources.values()),31)

    def test_legacy_hs6_stored_cell(self):
        cells = self.module('archive').read_stored_sheet(ROOT/'official/Export-Product-by-6-digit-2000-2014.xlsx','2009-2014-years')
        self.assertEqual(cells['A7'].value,Decimal('10121'))
        self.assertEqual(cells['A7'].number_format,'000000')

    def test_stored_precision_is_not_display_precision(self):
        archive = self.module('archive')
        cells = archive.read_stored_sheet(ROOT/'official/Georgian-exports-of-services-by-types.xlsx','Sheet1')
        self.assertEqual(cells['F5'].value,Decimal('7706284.9847599976'))
        self.assertEqual(cells['B8'].value,'-')

    def test_missing_and_duplicate_manifest_entries_fail(self):
        archive = self.module('archive')
        manifest = json.loads((ROOT/'full-source-manifest.json').read_text(encoding='utf-8'))
        for changed in (manifest[:-1],manifest[:-1]+[manifest[0]]):
            with tempfile.TemporaryDirectory(dir=TMP) as temporary:
                target=Path(temporary)
                (target/'full-source-manifest.json').write_text(json.dumps(changed),encoding='utf-8')
                with self.assertRaisesRegex(ValueError,'source_inventory'):
                    archive.load_verified_sources(target)

    def test_changed_source_bytes_fail(self):
        archive = self.module('archive')
        with tempfile.TemporaryDirectory(dir=TMP) as temporary:
            target=Path(temporary)/'package'
            shutil.copytree(ROOT,target,ignore=shutil.ignore_patterns('__pycache__'))
            path=target/'official/FTrade_1995-2026.xlsx'
            path.write_bytes(path.read_bytes()+b'changed')
            with self.assertRaisesRegex(ValueError,'source_fingerprint'):
                archive.load_verified_sources(target)

    def test_exact_sheet_names(self):
        archive=self.module('archive')
        joint=ROOT/'official/Georgian-Exports-of-services-by-types--and-countries.xlsx'
        self.assertIn('C5',archive.read_stored_sheet(joint,'Sheet1 '))
        with self.assertRaisesRegex(ValueError,'source_layout'):
            archive.read_stored_sheet(joint,'Sheet1')

    def test_header_and_unmapped_rows_fail(self):
        archive=self.module('archive')
        sources=archive.load_verified_sources(ROOT)
        layouts=archive.load_layouts(sources,ROOT)
        changed=json.loads(json.dumps(layouts))
        changed[0]['header_cells'][0]['value']='changed'
        with self.assertRaisesRegex(ValueError,'source_layout'):
            archive.validate_layouts(sources,changed,ROOT)
        changed=json.loads(json.dumps(layouts))
        changed[0]['rows']=changed[0]['rows'][1:]
        with self.assertRaisesRegex(ValueError,'source_layout'):
            archive.validate_layouts(sources,changed,ROOT)

    def test_blank_symbol_zero_and_small_values_remain_distinct(self):
        archive=self.module('archive')
        model=self.module('model')
        values=[None,'-',Decimal('0'),Decimal('0.00001')]
        got=[model.value_fields(archive.Cell(v,'' if v is None else str(v),'n' if isinstance(v,Decimal) else 's','0.0'),'thousand_usd') for v in values]
        self.assertEqual([r['value_status'] for r in got],['blank','not_applicable','numeric','numeric'])
        self.assertEqual([r['value_usd'] for r in got],['','','0','0.01000'])
        with self.assertRaisesRegex(ValueError,'cell_type'):
            model.value_fields(archive.Cell('unexpected','unexpected','s','General'),'thousand_usd')

    def test_code_conventions_do_not_mix_classifications(self):
        archive=self.module('archive')
        model=self.module('model')
        self.assertEqual(model.product_code(archive.Cell(Decimal('10121'),'10121','n','000000'),'hs6'),'010121')
        self.assertEqual(model.product_code(archive.Cell(Decimal('1.1'),'1.1','n','000.0'),'sitc4'),'001.1')

    def test_source_negative_corrections_are_preserved(self):
        archive=self.module('archive'); model=self.module('model')
        try:
            row=model.value_fields(archive.Cell(Decimal('-0.00005'),'-0.00005','n','0.0'),'thousand_usd')
        except ValueError as error:
            self.fail(f'published numeric correction was discarded: {error}')
        self.assertEqual(row['value_usd'],'-0.05000')

    def test_sitc_binary_storage_noise_retains_published_code(self):
        archive=self.module('archive'); model=self.module('model')
        try:
            code=model.product_code(archive.Cell(Decimal('1.1000000000000001'),'1.1000000000000001','n','General'),'sitc4')
        except ValueError as error:
            self.fail(f'published SITC code rejected for storage noise: {error}')
        self.assertEqual(code,'001.1')

if __name__ == '__main__':
    unittest.main()
