"""Behavioral checks against original cells and deliberate corruptions."""
import importlib
import csv
import hashlib
import io
import json
from decimal import Decimal
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
TMP = ROOT.parents[4] / '.tmp'

class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        TMP.mkdir(parents=True,exist_ok=True)

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
        cells = archive.read_stored_sheet(ROOT/'official/Georgian-Exports-of-services-by-types.xlsx','Sheet1')
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

class FreshCheckoutTests(PackageTests):
    def test_checks_create_their_temporary_parent(self):
        with tempfile.TemporaryDirectory(prefix='.trade-review-fixture-',dir=TMP.parent) as directory:
            missing_parent=Path(directory)/'new-checkout'/'.tmp'
            with patch(__name__+'.TMP',missing_parent):
                result=unittest.TestResult()
                unittest.TestSuite([ArchiveTests('test_missing_and_duplicate_manifest_entries_fail')]).run(result)
                self.assertEqual(result.errors,[])
                self.assertEqual(result.failures,[])
                self.assertTrue(missing_parent.is_dir())

    def test_source_precision_check_uses_case_sensitive_filename(self):
        archive=self.module('archive')
        stored_reader=archive.read_stored_sheet
        def case_sensitive_reader(path,sheet):
            if path.name not in {item.name for item in path.parent.iterdir()}:
                raise FileNotFoundError(path)
            return stored_reader(path,sheet)
        with patch.object(archive,'read_stored_sheet',side_effect=case_sensitive_reader):
            result=unittest.TestResult()
            ArchiveTests('test_stored_precision_is_not_display_precision').run(result)
            self.assertEqual(result.errors,[])
            self.assertEqual(result.failures,[])

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

class RegionTests(PackageTests):
    _data=None
    def rows(self):
        module=self.module('read_regions_services')
        if self.__class__._data is None:
            self.__class__._data=module.read_regions(self.module('archive').load_verified_sources(ROOT),json.loads((ROOT/'source-layouts.json').read_text(encoding='utf-8')),ROOT)
        return self.__class__._data

    def test_registered_address_annual_regions_keep_unknown(self):
        rows=self.rows(); totals=[r for r in rows if r['role']=='total']
        expected={'region.tbilisi','region.adjara','region.guria','region.imereti','region.kakheti','region.mtskheta_mtianeti','region.racha_lechkhumi_kvemo_svaneti','region.samegrelo_zemo_svaneti','region.samtskhe_javakheti','region.kvemo_kartli','region.shida_kartli','region.unknown'}
        self.assertEqual({r['geography_id'] for r in totals},expected)
        self.assertEqual(len(totals),96)
        self.assertEqual({r['year'] for r in rows},{'2022','2023','2024','2025'})
        self.assertEqual({r['attribution_basis'] for r in rows},{'registered_address'})
        self.assertTrue(any(r['source_cell']=='W4789' for r in totals))
        self.assertTrue(any(r['source_cell']=='W8255' for r in totals))
        self.assertFalse(any(r['role']=='detail' and r['geography_id']=='region.unknown' for r in rows))
        report=self.module('model').check_coverage(rows,json.loads((ROOT/'expected-observation-inventory.json').read_text()),{'goods_regions'})
        self.assertEqual(report['matched_observations'],len(rows))

    def test_unpublished_unknown_products_are_eight_unavailable_checks(self):
        comparisons=self.module('read_regions_services').region_comparisons(self.rows())
        unknown=[r for r in comparisons if r['check']=='regional_product_sum' and r['item_id']=='region.unknown']
        self.assertEqual(len(unknown),8)
        self.assertEqual({r['status'] for r in unknown},{'not_published'})
        self.assertTrue(all(r['actual_usd']=='' and r['expected_usd']=='' for r in unknown))
        self.assertFalse(any(r['status']=='fail' for r in comparisons))

class ServicesTests(PackageTests):
    _data=None
    def rows(self):
        module=self.module('read_regions_services')
        if self.__class__._data is None:
            self.__class__._data=module.read_services(self.module('archive').load_verified_sources(ROOT),json.loads((ROOT/'source-layouts.json').read_text(encoding='utf-8')),ROOT)
        return self.__class__._data

    def test_all_types_countries_and_joint_source_keys_are_preserved(self):
        rows=self.rows()
        self.assertEqual({r['dimension'] for r in rows},{'type','country','type_country'})
        self.assertEqual({r['year'] for r in rows},{'2020','2021','2022','2023','2024'})
        types={r['service_id'] for r in rows if r['dimension']=='type' and r['role']=='detail'}
        self.assertEqual(len(types),12)
        current=next(r for r in rows if r['dimension']=='type' and r['flow']=='export' and r['year']=='2024' and r['role']=='total')
        self.assertEqual(Decimal(current['value_usd']),Decimal('7706284984.7599976'))
        self.assertEqual(current['source_cell'],'F5')
        report=self.module('model').check_coverage(rows,json.loads((ROOT/'expected-observation-inventory.json').read_text()),{'services'})
        self.assertEqual(report['matched_observations'],len(rows))

    def test_published_dash_and_sparse_country_details_stay_unavailable(self):
        rows=self.rows()
        repair=next(r for r in rows if r['dimension']=='type' and r['flow']=='export' and r['year']=='2020' and r['service_id']=='services.maintenance_repair')
        self.assertEqual((repair['source_value'],repair['value_usd'],repair['value_status']),('-','','not_applicable'))
        comparisons=self.module('read_regions_services').services_comparisons(rows)
        conflicts=[r for r in comparisons if r['status']=='fail']
        self.assertEqual({(r['check'],r['flow'],r['year'],r['item_id']) for r in conflicts},{('service_country_matches_joint','import','2022','partner.2020-2024.826'),('service_country_matches_joint','import','2024','partner.2020-2024.826')})
        self.assertTrue(any(r['status']=='not_published' for r in comparisons))
        self.assertTrue(any(r['check']=='service_type_sum' and r['status']=='pass' for r in comparisons))

    def test_unlabelled_maintenance_amounts_reconcile_without_country_allocation(self):
        rows=self.rows()
        blank=[r for r in rows if r['dimension']=='type_country' and r['flow']=='export' and r['service_id']=='services.maintenance_repair' and r['source_cell']=='G36']
        self.assertEqual(len(blank),1)
        self.assertEqual((blank[0]['partner_code'],blank[0]['partner_label_en'],blank[0]['role']),('','','supporting'))
        checks=self.module('read_regions_services').services_comparisons(rows)
        repair=[c for c in checks if c['check']=='service_joint_country_sum' and c['flow']=='export' and c['item_id']=='services.maintenance_repair' and c['year'] in ('2023','2024')]
        self.assertEqual([c['status'] for c in repair],['pass','pass'])

class PrepareTests(PackageTests):
    def test_independent_evidence_cannot_survive_changed_artifact_inputs(self):
        prepare=self.module('prepare')
        self.assertTrue(hasattr(prepare,'check_independent_evidence'),'stale independent-report protection is not implemented')
        artifacts={'source-observations/fixture.csv':b'original','prepared-validation.json':b'{}'}
        evidence={'input_artifact_sha256':{name:hashlib.sha256(data).hexdigest() for name,data in artifacts.items()}}
        prepare.check_independent_evidence(evidence,artifacts)
        with self.assertRaisesRegex(ValueError,'artifact_mismatch'):
            prepare.check_independent_evidence(evidence,dict(artifacts,**{'source-observations/fixture.csv':b'changed'}))

    def test_manifest_counts_large_exact_provenance_fields(self):
        prepare=self.module('prepare')
        references=json.dumps([['fixture-source-'+'x'*50,'Annual','A7']]*2000)
        data=prepare.csv_bytes([{'source_refs':references}],('source_refs',))
        try: manifest=prepare.manifest_bytes({'prepared-reconciliation.csv':data})
        except csv.Error as error: self.fail(f'exact provenance field could not be inventoried: {error}')
        row=next(csv.DictReader(io.StringIO(manifest.decode('utf-8-sig'))))
        self.assertEqual(row['row_count'],'1')
        self.assertEqual(int(row['bytes']),len(data))

    def test_csv_bom_unicode_quoting_and_leading_zero_text(self):
        prepare=self.module('prepare')
        raw=prepare.csv_bytes([{'year':'2024','code':'010121','label':'Türkiye, Côte d\'Ivoire\nSecond line'}],('year','code','label'))
        self.assertTrue(raw.startswith(b'\xef\xbb\xbf'))
        self.assertNotIn(b'\r\n',raw)
        parsed=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
        self.assertEqual(parsed,[{'year':'2024','code':'010121','label':'Türkiye, Côte d\'Ivoire\nSecond line'}])

    def test_repeated_write_and_readonly_check_reject_missing_stale_artifacts(self):
        prepare=self.module('prepare')
        artifacts={'goods-national-annual.csv':b'\xef\xbb\xbfyear\n2025\n','source-observations/fixture-01-2020-2021.csv':b'\xef\xbb\xbfyear\n2020\n2021\n'}
        with tempfile.TemporaryDirectory(dir=TMP) as directory:
            root=Path(directory)
            prepare.sync_artifacts(root,artifacts,True)
            first={p.relative_to(root).as_posix():p.read_bytes() for p in root.rglob('*') if p.is_file()}
            prepare.sync_artifacts(root,artifacts,True)
            self.assertEqual(first,{p.relative_to(root).as_posix():p.read_bytes() for p in root.rglob('*') if p.is_file()})
            before={p.as_posix():p.stat().st_mtime_ns for p in root.rglob('*') if p.is_file()}
            prepare.sync_artifacts(root,artifacts,False)
            self.assertEqual(before,{p.as_posix():p.stat().st_mtime_ns for p in root.rglob('*') if p.is_file()})
            (root/'goods-national-annual.csv').unlink()
            with self.assertRaisesRegex(ValueError,'artifact_mismatch'): prepare.sync_artifacts(root,artifacts,False)
            prepare.sync_artifacts(root,artifacts,True)
            stale=root/'source-observations/stale.csv'; stale.write_bytes(b'keep')
            with self.assertRaisesRegex(ValueError,'artifact_mismatch'): prepare.sync_artifacts(root,artifacts,False)
            self.assertEqual(stale.read_bytes(),b'keep')

    def test_large_chunks_split_only_at_complete_year_boundaries(self):
        prepare=self.module('prepare')
        rows=[{'year':'2024','label':'A'*35},{'year':'2025','label':'B'*35}]
        with patch.object(prepare,'MAX_CSV_BYTES',60):
            chunks=prepare.chunk_csv('source-observations/fixture-01-2024-2025',rows,('year','label'))
            self.assertEqual(set(chunks),{'source-observations/fixture-01-2024-2025-2024.csv','source-observations/fixture-01-2024-2025-2025.csv'})
            self.assertTrue(all(len(data)<=60 for data in chunks.values()))
            with self.assertRaisesRegex(ValueError,'artifact_size'):
                prepare.chunk_csv('source-observations/fixture-01-2024-2025',[rows[0],dict(rows[0])],('year','label'))

    def test_unit_conversion_and_unavailable_values_cannot_be_fabricated(self):
        validation=self.module('validation')
        row=dict(source_unit='thousand_usd',source_value='1',value_status='numeric',value_usd='1000')
        validation.validate_units([row])
        with self.assertRaisesRegex(ValueError,'unit_conversion'):
            validation.validate_units([dict(row,value_usd='1')])
        with self.assertRaisesRegex(ValueError,'missingness'):
            validation.validate_units([dict(row,source_value='-',value_status='not_applicable',value_usd='0')])

class IndependentTests(PackageTests):
    def fixture(self):
        verifier=self.module('verify_independent')
        self.assertTrue(hasattr(verifier,'compare_record'),'independent prepared-record comparison is not implemented')
        metadata=dict.fromkeys(verifier.METADATA_FIELDS,'')
        metadata.update(family='goods_products',year='2020',flow='export',item_id='goods.hs6.2020-2025.010121',classification='hs6',classification_level='6',product_code='010121',product_label_en='Horses',source_unit='thousand_usd',value_status='numeric',publication_status='unspecified',role='detail',source_block='2020-2025',source_id='fixture',source_sheet='Annual',source_cell='B7',source_label='Horses',source_number_format='0.0')
        return verifier,metadata,dict(metadata,source_value='0.0001',value_usd='0.1000')

    def test_independent_value_and_exact_normalization_checks(self):
        verifier,metadata,row=self.fixture()
        self.assertEqual(verifier.compare_record(row,metadata,0.0001),Decimal('0'))
        for changed in (dict(row,value_usd='0.1100'),dict(row,source_value='0.00011',value_usd='0.1100')):
            with self.assertRaisesRegex(ValueError,'source_value|unit_conversion'): verifier.compare_record(changed,metadata,0.0001)

    def test_leading_zero_labels_formats_and_units_cannot_change(self):
        verifier,metadata,row=self.fixture()
        for field,value in [('product_code','10121'),('source_label','Changed'),('source_number_format','General'),('source_unit','million_usd')]:
            with self.assertRaisesRegex(ValueError,'source_metadata|unit_conversion'):
                verifier.compare_record(dict(row,**{field:value}),metadata,0.0001)

    def test_published_missing_value_cannot_become_numeric_zero(self):
        verifier,metadata,row=self.fixture()
        metadata=dict(metadata,value_status='not_applicable')
        row=dict(row,value_status='not_applicable',source_value='-',value_usd='')
        verifier.compare_record(row,metadata,'-')
        with self.assertRaisesRegex(ValueError,'missingness'):
            verifier.compare_record(dict(row,value_usd='0'),metadata,'-')

    def test_independent_coverage_catches_year_zero_and_duplicate_omissions(self):
        verifier,metadata,row=self.fixture()
        self.assertTrue(hasattr(verifier,'check_inventory'),'independent coverage check is not implemented')
        second=dict(metadata,year='2021',source_cell='C7')
        blocks=[]
        for meta in (metadata,second):
            block={f:meta[f] for f in ('source_id','source_sheet','source_block','family','flow','year')}
            encode=lambda values:hashlib.sha256(json.dumps(sorted(values),ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            block.update(source_key_count=1,key_sha256=encode([(meta['source_id'],meta['source_sheet'],meta['source_cell'])]),metadata_sha256=encode([sorted(meta.items())]),status_counts={'numeric':1})
            blocks.append(block)
        inventory={'blocks':blocks}
        verifier.check_inventory([metadata,second],inventory)
        with self.assertRaisesRegex(ValueError,'coverage'): verifier.check_inventory([metadata],inventory)
        with self.assertRaisesRegex(ValueError,'coverage'): verifier.check_inventory([],inventory)
        with self.assertRaisesRegex(ValueError,'duplicate_key'): verifier.check_inventory([metadata,second,metadata],inventory)

    def test_independent_source_fingerprint_detects_corruption(self):
        verifier=self.module('verify_independent')
        self.assertTrue(hasattr(verifier,'verify_fingerprint'),'independent source fingerprint check is not implemented')
        with tempfile.TemporaryDirectory(dir=TMP) as directory:
            path=Path(directory)/'source.xlsx'; path.write_bytes(b'original')
            descriptor={'source_id':'fixture','bytes':8,'sha256':hashlib.sha256(b'original').hexdigest()}
            verifier.verify_fingerprint(path,descriptor)
            path.write_bytes(b'changed!')
            with self.assertRaisesRegex(ValueError,'source_fingerprint'): verifier.verify_fingerprint(path,descriptor)

class ReviewRegressionTests(PackageTests):
    _fixture=None
    def derived_fixture(self):
        if self.__class__._fixture is None:
            with (ROOT/'derived-annual.csv').open(encoding='utf-8-sig',newline='') as stream:
                available=[r for r in csv.DictReader(stream) if r['year']=='2025']
            derived=[next(r for r in available if r['indicator_id']==indicator and r['dimension']=='national') for indicator in ('trade_balance','trade_turnover','reexports')]
            derived.extend(next(r for r in available if r['indicator_id']=='reexports' and r['dimension']==dimension) for dimension in ('country','product'))
            needed={tuple(ref) for row in derived for ref in json.loads(row['input_source_refs'])}
            sources=[]
            for path in sorted((ROOT/'source-observations').glob('*.csv')):
                if not any(path.name.startswith(key[0]+'-') for key in needed): continue
                with path.open(encoding='utf-8-sig',newline='') as stream:
                    sources.extend(r for r in csv.DictReader(stream) if (r['source_id'],r['source_sheet'],r['source_cell']) in needed)
            with (ROOT/'identity-review.csv').open(encoding='utf-8-sig',newline='') as stream:
                identities=list(csv.DictReader(stream))
            self.__class__._fixture=derived,sources,identities
        return self.__class__._fixture

    def test_normal_validation_rejects_national_balance_labelled_as_country_reexports(self):
        derived,sources,identities=self.derived_fixture()
        validation=self.module('validation')
        validation.validate_derivations(derived,sources)
        changed=[dict(r) for r in derived]
        changed[0].update(indicator_id='reexports',dimension='country',item_id='partner.2020-2025.826')
        with self.assertRaisesRegex(ValueError,'derived_inputs'):
            validation.validate_derivations(changed,sources)

    def test_normal_validation_rejects_omitted_and_duplicate_derivations(self):
        derived,sources,identities=self.derived_fixture()
        validation=self.module('validation')
        with self.assertRaisesRegex(ValueError,'coverage'):
            validation.validate_derivations(derived[:-1],sources)
        with self.assertRaisesRegex(ValueError,'duplicate_key'):
            validation.validate_derivations(derived+[derived[0]],sources)

    def test_normal_validation_requires_approved_status_and_review_period(self):
        derived,sources,identities=self.derived_fixture()
        validation=self.module('validation')
        for field,value in [('domain','services'),('role','detail'),('value_status','blank'),('publication_status','planned')]:
            changed=[dict(r) for r in derived];changed[0][field]=value
            with self.assertRaisesRegex(ValueError,'derived_inputs'):
                validation.validate_derivations(changed,sources,identities)
        expired=[dict(r,last_year='2024') if r['disposition']=='verified_equivalent' else r for r in identities]
        with self.assertRaisesRegex(ValueError,'derived_inputs|coverage'):
            validation.validate_derivations(derived,sources,expired)

    def test_independent_derivations_require_meaning_reviewed_years_and_complete_keys(self):
        derived,sources,identities=self.derived_fixture()
        verifier=self.module('verify_independent')
        self.assertTrue(hasattr(verifier,'verify_derivations'),'independent derivation semantics are not checked')
        self.assertEqual(verifier.verify_derivations(derived,sources,identities),len(derived))
        changed=[dict(r) for r in derived]
        changed[0].update(indicator_id='reexports',dimension='country',item_id='partner.2020-2025.826')
        with self.assertRaisesRegex(ValueError,'derived_inputs'): verifier.verify_derivations(changed,sources,identities)
        with self.assertRaisesRegex(ValueError,'coverage'): verifier.verify_derivations(derived[:-1],sources,identities)
        with self.assertRaisesRegex(ValueError,'duplicate_key'): verifier.verify_derivations(derived+[derived[0]],sources,identities)
        for field,value in [('domain','services'),('role','detail'),('value_status','blank'),('publication_status','planned')]:
            changed=[dict(r) for r in derived];changed[0][field]=value
            with self.assertRaisesRegex(ValueError,'derived_inputs'): verifier.verify_derivations(changed,sources,identities)
        expired=[dict(r,last_year='2024') if r['disposition']=='verified_equivalent' else r for r in identities]
        with self.assertRaisesRegex(ValueError,'derived_inputs|coverage'): verifier.verify_derivations(derived,sources,expired)

    def test_primary_schema_rejects_missing_identity_and_empty_columns(self):
        verifier=self.module('verify_independent')
        self.assertTrue(hasattr(verifier,'compare_primary_record'),'independent primary schema is not fixed')
        source=next(r for r in self.derived_fixture()[1] if r['family']=='goods_products')
        metadata={f:source.get(f,'') for f in verifier.METADATA_FIELDS}
        fields=self.module('model').DIMENSIONS['goods_products']+self.module('model').COMMON
        row={f:source[f] for f in fields}
        native=float(source['source_value'])
        verifier.compare_primary_record(row,metadata,native)
        for field in ('classification','classification_level','product_code','item_id','product_label_en'):
            changed=dict(row);del changed[field]
            with self.assertRaisesRegex(ValueError,'source_metadata|artifact_schema'):
                verifier.compare_primary_record(changed,metadata,native)
        changed=dict(row,unexpected='extra')
        with self.assertRaisesRegex(ValueError,'artifact_schema'):
            verifier.compare_primary_record(changed,metadata,native)
        changed=dict(row,product_label_en='');del changed['product_label_en']
        with self.assertRaisesRegex(ValueError,'artifact_schema'):
            verifier.compare_primary_record(changed,dict(metadata,product_label_en=''),native)

if __name__ == '__main__':
    unittest.main()
