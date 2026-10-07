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

class ProductsTests(PackageTests):
    _data=None
    def rows(self):
        module=self.module('read_products')
        if self.__class__._data is None:
            self.__class__._data=module.read_products(self.module('archive').load_verified_sources(ROOT),json.loads((ROOT/'source-layouts.json').read_text(encoding='utf-8')),ROOT)
        return self.__class__._data

    def test_classification_bounds_and_historical_ids(self):
        rows=self.rows()
        expected={'hs4':{'1995-1999','2000-2014','2015-2019','2020-2025'},'hs6':{'2000-2008','2009-2014','2015-2019','2020-2025'}}
        for classification,blocks in expected.items():
            selected=[r for r in rows if r['classification']==classification]
            self.assertEqual({r['source_block'] for r in selected},blocks)
            self.assertEqual(min(int(r['year']) for r in selected),1995 if classification=='hs4' else 2000)
        leading=next(r for r in rows if r['source_id']=='geostat_trade_export-product-by-6-digit-2000-2014' and r['source_sheet']=='2009-2014-years' and r['source_cell']=='C7')
        self.assertEqual(leading['product_code'],'010121')
        self.assertEqual(leading['item_id'],'goods.hs6.2009-2014.010121')
        self.assertEqual(len({r['item_id'] for r in rows if r['classification']=='hs6' and r['product_code']=='010121'}),3)
        report=self.module('model').check_coverage(rows,json.loads((ROOT/'expected-observation-inventory.json').read_text()),{'goods_products'})
        self.assertEqual(report['matched_observations'],len(rows))

    def test_broad_classifications_keep_all_published_categories(self):
        rows=self.rows()
        self.assertEqual({r['product_code'] for r in rows if r['classification']=='sitc1' and r['role']=='detail'},set('0123456789'))
        self.assertEqual({r['product_code'] for r in rows if r['classification']=='bec1' and r['role']=='detail'},set('1234567'))

    def test_zero_product_and_entire_block_omissions_fail(self):
        rows=self.rows(); model=self.module('model'); inventory=json.loads((ROOT/'expected-observation-inventory.json').read_text())
        zero=next(r for r in rows if r['role']=='detail' and r['value_usd']=='0')
        for changed in ([r for r in rows if r is not zero],[r for r in rows if not (r['classification']=='hs6' and r['source_block']=='2000-2008')]):
            with self.assertRaisesRegex(ValueError,'coverage'): model.check_coverage(changed,inventory,{'goods_products'})
        with self.assertRaisesRegex(ValueError,'duplicate_key'): model.check_coverage(rows+[rows[0]],inventory,{'goods_products'})

    def test_parent_comparison_has_fixed_tolerance_and_period_matching(self):
        products=self.module('read_products')
        def fixture(classification,code,value,source,cell,year='2009'):
            return dict(family='goods_products',flow='export',year=year,classification=classification,product_code=code,value_status='numeric',value_usd=value,source_id=source,source_sheet='Annual',source_cell=cell,role='detail',item_id='goods.'+classification+'.'+code,source_block='2009-2014')
        parent=fixture('hs4','0101','100','four','C7')
        children=[fixture('hs6','010121','30','six','C7'),fixture('hs6','010129','70','six','C8')]
        result=products.compare_hs_parents([parent]+children,{('six','four')})
        self.assertEqual([(r['expected_usd'],r['actual_usd'],r['status']) for r in result],[('100','100','pass')])
        altered=[parent,children[0],dict(children[1],value_usd='68')]
        self.assertEqual(products.compare_hs_parents(altered,{('six','four')})[0]['status'],'fail')
        self.assertFalse(any(r['status']=='pass' for r in products.compare_hs_parents([parent]+children,set())))
        self.assertFalse(any(r['status']=='pass' for r in products.compare_hs_parents([dict(parent,year='2010')]+children,{('six','four')})))

    def test_source_coding_exception_requires_exact_refs_and_balanced_group(self):
        products=self.module('read_products')
        self.assertTrue(hasattr(products,'resolve_source_exceptions'),'reviewed source-coding exception checks are not implemented')
        rows=[dict(family='goods_products',flow='export',year='2000',classification=classification,product_code=code,value_status='numeric',value_usd=value,source_id=source,source_sheet='Annual',source_cell=cell,role='detail',item_id=code,source_block='2000-2004') for classification,code,value,source,cell in [('hs4','0101','100','four','B7'),('hs4','0102','20','four','B8'),('hs6','010121','90','six','B7'),('hs6','010221','30','six','B8')]]
        comparisons=products.compare_hs_parents(rows,{('six','four')})
        registry={'groups':{'allocation':{'codes':['0101','0102'],'explanation':'Source allocations differ; preserve separate codes.'}},'cases':[dict(flow=c['flow'],year=c['year'],item_id=c['item_id'],group_id='allocation',difference_usd=c['difference_usd'],source_refs=c['source_refs']) for c in comparisons]}
        resolved,controls=products.resolve_source_exceptions(comparisons,rows,registry)
        self.assertEqual({r['status'] for r in resolved},{'source_exception'})
        self.assertEqual(controls[0]['status'],'pass')
        self.assertTrue(all(r['difference_usd']!='0' for r in resolved))
        bad=[dict(r,value_usd='39') if r['classification']=='hs6' and r['product_code']=='010221' else r for r in rows]
        with self.assertRaisesRegex(ValueError,'source_arithmetic'):
            products.resolve_source_exceptions(products.compare_hs_parents(bad,{('six','four')}),bad,registry)

if __name__ == '__main__':
    unittest.main()
