"""Deliberate corruptions that preparation and verification must reject, plus pinned source behaviour."""
import csv
from decimal import Decimal
import io
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

import prepare
import readers
import sources
import verify_independent
from sources import Cell

ROOT = Path(__file__).resolve().parent

def rows_of(name):
    with (ROOT / name).open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))

def corrupt(filename, sheet_name, change):
    """Patch readers.sheet so one table is read with an edited cell map."""
    original = readers.sheet
    def edited(root, srcs, name, sheet_arg):
        cells = dict(original(root, srcs, name, sheet_arg))
        if name == filename and sheet_arg == sheet_name: change(cells)
        return cells
    return patch.object(readers, 'sheet', edited)

class SourceIntegrity(unittest.TestCase):
    def test_changed_source_fingerprint_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(ROOT / 'official', Path(tmp) / 'official')
            target = Path(tmp) / 'official' / 'nbg' / 'BOP-6_bopbpm6eng.xlsx'
            data = bytearray(target.read_bytes()); data[-10] ^= 1; target.write_bytes(bytes(data))
            with self.assertRaisesRegex(ValueError, 'source_fingerprint'):
                sources.load_verified_sources(Path(tmp))

    def test_changed_vintage_is_rejected(self):
        def change(cells):
            ref = next(r for r, c in cells.items() if c.value == '17.08.2026')
            cells[ref] = Cell('01.09.2026', '', 's', 'General')
        with corrupt('FDI_Eng-components.xlsx', 'Components (annual)', change), self.assertRaisesRegex(ValueError, 'vintage'):
            prepare.prepare()

class Coverage(unittest.TestCase):
    def test_omitted_year_is_rejected(self):
        with corrupt('FDI_Eng-components.xlsx', 'Components (annual)', lambda c: c.pop('H4')), self.assertRaisesRegex(ValueError, 'annual header years'):
            prepare.prepare()

    def test_omitted_month_is_rejected(self):
        with corrupt('REMC_money-transfers-by-countries-eng.xlsx', '2010-2011 (eng)', lambda c: c.pop('D3')), self.assertRaisesRegex(ValueError, 'twelve months'):
            prepare.prepare()

    def test_unreviewed_country_label_is_rejected(self):
        identities = [r for r in prepare.read_csv(ROOT / 'money-transfer-country-identities.csv') if r['source_label'] != 'Italy' or r['source_sheet'] != '2010-2011 (eng)']
        with self.assertRaisesRegex(ValueError, 'unreviewed money-transfer label'):
            readers.read_money_transfers(ROOT, sources.load_verified_sources(), identities)

    def test_duplicate_identity_is_rejected(self):
        identities = prepare.read_csv(ROOT / 'money-transfer-country-identities.csv')
        for row in identities:
            if row['source_sheet'] == '2010-2011 (eng)' and row['source_label'] == 'Italy': row['country_id'] = 'greece'
        with self.assertRaisesRegex(ValueError, 'duplicate_key'):
            readers.read_money_transfers(ROOT, sources.load_verified_sources(), identities)

    def test_no_2026_or_partial_year_enters_annual_files(self):
        for name in prepare.FAMILY_FILES.values():
            self.assertLessEqual(max(int(r['year']) for r in rows_of(name)), 2025, name)

class Values(unittest.TestCase):
    def test_altered_value_fails_reconciliation(self):
        def change(cells):
            cells['EA4'] = Cell(Decimal('-1000'), '-1000', 'n', 'General')  # current account, 2025
        with corrupt('BOP-6_bopbpm6eng.xlsx', 'BOP–BPM6(short)', change), self.assertRaisesRegex(ValueError, 'reconciliation'):
            prepare.prepare()

    def test_invented_zero_fails_reconciliation(self):
        def change(cells):
            cells['AF85'] = Cell(Decimal('0'), '0', 'n', 'General')  # United Kingdom, 2025
        with corrupt('FDI_Eng-countries.xlsx', 'FDI (annual)', change), self.assertRaisesRegex(ValueError, 'reconciliation'):
            prepare.prepare()

    def test_duplicate_key_is_rejected(self):
        row = rows_of('bop-annual.csv')[0]
        with self.assertRaisesRegex(ValueError, 'duplicate_key'):
            prepare.index([row, dict(row)])

    def test_blank_and_not_applicable_never_become_zero(self):
        flows = rows_of('fdi-flows-annual.csv')
        self.assertTrue(all(r['value_usd'] == '' for r in flows if r['value_status'] == 'not_applicable'))
        self.assertEqual(sum(r['value_status'] == 'not_applicable' for r in flows), 775)
        transfers = rows_of('money-transfers-annual.csv')
        self.assertTrue(all(r['value_usd'] == '' for r in transfers if r['value_status'] == 'blank'))

    def test_partial_months_keep_their_count(self):
        sudan = [r for r in rows_of('money-transfers-annual.csv') if r['item_id'] == 'sudan' and r['year'] == '2019']
        self.assertEqual({r['months_reported'] for r in sudan}, {'11'})
        self.assertEqual({r['value_status'] for r in sudan}, {'partial_months'})

    def test_leading_zero_country_codes_survive(self):
        austria = [r for r in rows_of('fdi-flows-annual.csv') if r['label_en'] == 'Austria']
        self.assertEqual({r['code'] for r in austria}, {'040'})
        self.assertEqual({r['item_id'] for r in austria}, {'m49_040'})

    def test_unit_conversion(self):
        row = next(r for r in rows_of('bop-annual.csv') if r['item_id'] == 'current_account' and r['flow'] == 'net' and r['year'] == '2025')
        self.assertEqual(Decimal(row['value_usd']), Decimal(row['source_value']) * 1000000)
        row = next(r for r in rows_of('fdi-flows-annual.csv') if r['dimension'] == 'component' and r['item_id'] == 'equity' and r['year'] == '2025')
        self.assertEqual(Decimal(row['value_usd']), Decimal(row['source_value']) * 1000)

    def test_2024_transfers_come_from_monthly_table(self):
        checks = rows_of('prepared-reconciliation.csv')
        missing = [c for c in checks if c['result'] == 'not_published']
        self.assertEqual({(c['year'], c['flow']) for c in missing}, {('2024', 'inflow'), ('2024', 'outflow')})
        total = next(r for r in rows_of('money-transfers-annual.csv') if r['item_id'] == 'total' and r['year'] == '2024' and r['flow'] == 'inflow')
        self.assertEqual(round(Decimal(total['value_usd']) / 1000), 3361549)

class Independent(unittest.TestCase):
    def test_verifier_detects_an_altered_prepared_value(self):
        row = next(r for r in rows_of('bop-annual.csv') if r['item_id'] == 'goods' and r['flow'] == 'credit' and r['year'] == '2020')
        bad = dict(row, value_usd=str(Decimal(row['value_usd']) + 5))
        self.assertFalse(verify_independent.recompute(bad))
        self.assertTrue(verify_independent.recompute(row))

    def test_verifier_walk_matches_prepared_keys(self):
        prepared = set()
        for name in verify_independent.OUTPUTS:
            prepared |= {(r['source_file'], r['source_sheet'], r['source_cells'].split(';')[0]) for r in rows_of(name)}
        self.assertEqual(prepared, verify_independent.expected_keys())

if __name__ == '__main__':
    unittest.main(verbosity=1)
