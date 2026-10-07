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

class GoodsTests(PackageTests):
    _data=None
    def rows(self):
        module=self.module('read_goods')
        if self.__class__._data is None:
            archive=self.module('archive')
            self.__class__._data=module.read_goods(archive.load_verified_sources(ROOT),json.loads((ROOT/'source-layouts.json').read_text(encoding='utf-8')),ROOT)
        return self.__class__._data

    def test_complete_annual_goods_bounds_and_exact_conversion(self):
        rows=self.rows()
        report=self.module('model').check_coverage(rows,json.loads((ROOT/'expected-observation-inventory.json').read_text()),{r['family'] for r in rows})
        self.assertEqual(report['matched_observations'],len(rows))
        national=[r for r in rows if r['family']=='goods_national']
        self.assertEqual({int(r['year']) for r in national},set(range(1995,2026)))
        self.assertEqual(len(national),62)
        current=next(r for r in national if r['year']=='2025' and r['flow']=='export')
        self.assertEqual(Decimal(current['value_usd']),Decimal('7287805027.5742908'))
        self.assertEqual({int(r['year']) for r in rows if r['flow']=='domestic_export'},set(range(2014,2026)))
        self.assertTrue(all(int(r['year'])<=2025 for r in rows))

    def test_domestic_selected_products_keep_other_commodities(self):
        rows=self.rows()
        for year,count in [('2014',96),('2015',99),('2025',99)]:
            selected=[r for r in rows if r['family']=='goods_domestic' and r['dimension']=='product' and r['year']==year]
            self.assertEqual(sum(r['role']=='detail' for r in selected),count)
            residual=[r for r in selected if r['role']=='residual']
            self.assertEqual(len(residual),1)
            self.assertEqual(residual[0]['product_label_en'],'Other commodities')
        inventory=json.loads((ROOT/'expected-observation-inventory.json').read_text())
        changed=[r for r in rows if not (r['family']=='goods_domestic' and r['role']=='residual')]
        with self.assertRaisesRegex(ValueError,'coverage'):
            self.module('model').check_coverage(changed,inventory,{r['family'] for r in rows})

    def test_zero_country_omission_is_rejected(self):
        rows=self.rows()
        zero=next(r for r in rows if r['family']=='goods_countries' and r['role']=='detail' and r['value_usd']=='0')
        changed=[r for r in rows if r is not zero]
        with self.assertRaisesRegex(ValueError,'coverage'):
            self.module('model').check_coverage(changed,json.loads((ROOT/'expected-observation-inventory.json').read_text()),{r['family'] for r in rows})

    def test_overlapping_groups_and_partner_subtotals_keep_roles(self):
        rows=self.rows()
        groups={r['group_id'] for r in rows if r['family']=='goods_country_groups' and r['role']=='subtotal'}
        self.assertEqual(groups,{'group.eu','group.cis','group.bsec','group.oecd','group.guam'})
        section=next(r for r in rows if r['family']=='goods_countries' and r['source_cell']=='C7')
        self.assertEqual(section['role'],'subtotal')
        self.assertEqual(section['source_label'],'EU countries')

    def test_permitted_derivations_have_exact_inputs_and_missingness(self):
        goods=self.module('read_goods')
        def fixture(flow,value,source,family='goods_national'):
            return dict(family=family,flow=flow,year='2025',item_id='goods.total',value_status='numeric',value_usd=value,source_id=source,source_sheet='Annual',source_cell='B5',source_block='2025-2025',publication_status='unspecified',role='total',partner_code='',product_code='',dimension='country' if family=='goods_domestic' else '',classification='',geography_id='georgia')
        export=fixture('export','100','fixture_export'); imports=fixture('import','120','fixture_import'); domestic=fixture('domestic_export','40','fixture_domestic','goods_domestic')
        reviewed={('fixture_export','goods.total','fixture_domestic','goods.total')}
        got=goods.derive_goods([export,imports,domestic],reviewed)
        self.assertEqual({r['indicator_id']:r['value_usd'] for r in got},{'trade_balance':'-20','trade_turnover':'220','reexports':'60'})
        reexports=next(r for r in got if r['indicator_id']=='reexports')
        self.assertEqual(json.loads(reexports['input_source_refs']),[['fixture_export','Annual','B5'],['fixture_domestic','Annual','B5']])
        domestic=dict(domestic,value_status='not_applicable',value_usd='')
        self.assertFalse(any(r['indicator_id']=='reexports' for r in goods.derive_goods([export,imports,domestic],reviewed)))
        self.assertFalse(any(r['indicator_id']=='reexports' for r in goods.derive_goods([export,imports,dict(domestic,value_status='numeric',value_usd='40')],set())))

if __name__ == '__main__':
    unittest.main()
