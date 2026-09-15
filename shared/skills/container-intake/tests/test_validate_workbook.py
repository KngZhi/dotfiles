import importlib.util
from pathlib import Path
import tempfile
import unittest

import openpyxl

spec = importlib.util.spec_from_file_location('validator', Path(__file__).parents[1] / 'scripts/validate_workbook.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'input.xlsx'
        self.wb = openpyxl.Workbook()
        s = self.wb.active
        s.title = 'data'
        s.append(v.HEADERS)
        s.append(['PM535', '6903070215357', '袜子', None, None, 10, 80, 2,
                  1600, 160, .1, 100, 100, 10, .2, '新疆', None, '打'])
        s.append(['DATA_END'])
        s.append(['合计', None, None, None, None, None, None, 2, 1600, 160,
                  None, None, None, None, .2])
        c = self.wb.create_sheet('config')
        c.append(['参数', '值', '说明'])
        c.append(['货柜号', 'TGBU5973558'])
        c.append(['海运费', 2000, 'USD'])
        c.append(['内陆费', 0, '厂家承担'])

    def check(self):
        self.wb.save(self.path)
        before = self.path.read_bytes()
        result = v.validate(self.path)
        self.assertEqual(before, self.path.read_bytes())
        return result

    def test_valid_and_read_only(self):
        self.assertEqual(self.check()['status'], 'PASS')

    def test_each_column_rejects_invalid_content(self):
        for col in range(1, 19):
            with self.subTest(col=col):
                cell = self.wb['data'].cell(2, col)
                original = cell.value
                cell.value = 'bad' if col in v.NUMERIC or col in (2, 18) else 123
                self.assertEqual(self.check()['status'], 'ERROR')
                cell.value = original

    def test_arithmetic_and_totals(self):
        for coordinate in ['I2', 'J2', 'K2', 'O2', 'H4', 'I4', 'J4', 'O4']:
            with self.subTest(cell=coordinate):
                cell = self.wb['data'][coordinate]
                original = cell.value
                cell.value += 1
                self.assertEqual(self.check()['status'], 'ERROR')
                cell.value = original

    def test_formula_cache_is_not_silently_accepted(self):
        self.wb['data']['I2'] = '=F2*J2'
        result = self.check()
        self.assertEqual(result['status'], 'PENDING')
        self.assertTrue(any(i['cell'] == 'I2' for i in result['issues']))

    def test_missing_price_and_barcode_are_pending(self):
        self.wb['data']['F2'] = None
        self.wb['data']['B2'] = None
        self.assertEqual(self.check()['status'], 'PENDING')

    def test_structure_and_config(self):
        self.wb['config']['D1'] = '说明'
        self.wb['config']['B3'] = -1
        self.wb['data']['A3'] = 'forgot marker'
        self.assertEqual(self.check()['status'], 'ERROR')


if __name__ == '__main__':
    unittest.main()
