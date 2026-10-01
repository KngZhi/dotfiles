import importlib.util
import json
from argparse import Namespace
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPTS = Path(__file__).parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('sheets', SCRIPTS / 'sheets.py')
sheets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sheets)
from grid import book_from_matrices, load_xlsx  # noqa: E402
from validate_workbook import validate, validate_book  # noqa: E402

ROW = {'货号': 'PM535', '条形码': '6903070215357', '品名': '袜子', '供应商': '新疆', '计价单位': '打',
       '采购单价（元）': 10, '标准装箱数': 80, '整件数': 2, '散件数': 5, '总体积（m³）': 0.2}


def computed(matrix, row_values):
    """Simulate Sheets: replace formulas in a matrix with supplied computed values."""
    out = []
    for r, row in enumerate(matrix):
        out.append([row_values.get((r, c), '' if isinstance(v, str) and v.startswith('=') else v) for c, v in enumerate(row)])
    return out


class ImageDumpTests(unittest.TestCase):
    def test_image_metadata_distinguishes_formula_literal_blank_and_error(self):
        formula = '=IMAGE("https://example.test/a.jpg")'
        error = {'type': 'ERROR', 'message': 'Image could not load'}
        sh = Mock()
        sh.fetch_sheet_metadata.return_value = {'sheets': [{'properties': {'title': 'data'},
            'data': [{'startRow': 1, 'startColumn': 3, 'rowData': [
                {'values': [{'userEnteredValue': {'formulaValue': formula}}]},
                {'values': [{'userEnteredValue': {'stringValue': formula}}]},
                {},
                {'values': [{'userEnteredValue': {'formulaValue': formula},
                             'effectiveValue': {'errorValue': error}}]},
            ]}]}]}
        result = sheets.image_cells(sh, 4)
        self.assertEqual(sh.fetch_sheet_metadata.call_args.args[0]['ranges'], "'data'!D2:D5")
        self.assertEqual(result['D2']['formula'], formula)
        self.assertIsNone(result['D2']['error'])
        self.assertEqual(result['D3']['formula'], '')  # RAW text is not a native formula.
        self.assertEqual(result['D3']['user_entered_value']['stringValue'], formula)
        self.assertEqual(result['D4']['user_entered_value'], {})
        self.assertEqual(result['D5']['error'], error)

    def test_dump_roundtrip_preserves_image_formula_computed_values_and_notes(self):
        formula = '=IMAGE("https://example.test/a.jpg")'
        matrix = sheets.data_matrix([dict(ROW, 图片=formula)])
        book = book_from_matrices({'data': computed(matrix, {(1, 10): 165, (1, 11): 1650}),
                                  'config': [['参数', '值', '说明'], ['海运费', 6400, '用户待核']]},
                                 {'data': matrix})
        sh = Mock(url='https://example.test/sheet')
        diagnostics = {'D2': {'formula': formula, 'user_entered_value': {'formulaValue': formula}, 'error': None}}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'dump.json'
            with patch.object(sheets, 'connect'), patch.object(sheets, 'open_sheet', return_value=sh), \
                 patch.object(sheets, 'load_book', return_value=book), \
                 patch.object(sheets, 'image_cells', return_value=diagnostics), \
                 patch.object(sheets, 'existing_notes', return_value={('data', 'D2'): '用户批注'}):
                sheets.cmd_dump(Namespace(ref='sheet', out=out))
            payload = json.loads(out.read_text())
        self.assertEqual(payload['rows'][0]['图片'], formula)
        self.assertEqual(sheets.data_matrix(payload['rows'])[1][3], formula)
        self.assertEqual(payload['rows'][0]['总数量'], 165)
        self.assertEqual(payload['rows'][0]['货款合计（元）'], 1650)
        self.assertEqual(payload['config']['海运费'], 6400)
        self.assertEqual(payload['config_notes']['海运费'], '用户待核')
        self.assertEqual(payload['cell_notes']['data!D2'], '用户批注')
        self.assertEqual(payload['image_cells'], diagnostics)


class LayoutTests(unittest.TestCase):
    def test_data_matrix_keeps_text_ids_and_row_formulas(self):
        m = sheets.data_matrix([dict(ROW, 条形码=6903070215357)])
        self.assertEqual(m[0], sheets.HEADERS)
        self.assertEqual(m[1][1], '6903070215357')
        self.assertEqual(m[1][10], '=IF(COUNT(H2:J2)<>3,"",H2*I2+J2)')
        self.assertEqual(m[2], ['DATA_END'])
        self.assertEqual([r[0] for r in m[4:]], ['合计', '打数合计', '条数合计'])
        self.assertIn('MATCH("DATA_END",A:A,0)-1', m[4][8])

    def test_set_keeps_id_columns_as_text(self):
        # A numeric-looking 货号/条形码 sent through `set` must stay a raw string: parsing it
        # to int/float and sending a JSON number strips Sheets' TEXT number format from the
        # cell and turns the barcode into a number for good.
        self.assertEqual(sheets.set_cell_value('data', 'B2', '6903070215357'), '6903070215357')
        self.assertEqual(sheets.set_cell_value('data', 'A2', '12345'), '12345')
        self.assertEqual(sheets.set_cell_value('data', 'G2', '12.5'), 12.5)
        self.assertEqual(sheets.set_cell_value('config', 'B2', '6903070215357'), 6903070215357)

    def test_upload_title_defaults_to_xlsx_basename(self):
        self.assertEqual(sheets.upload_title(Path('/tmp/MSMU8846603_成本暂估.xlsx')), 'MSMU8846603_成本暂估')
        self.assertEqual(sheets.upload_title(Path('/tmp/MSMU8846603_成本暂估.xlsx'), 'Custom标题'), 'Custom标题')

    def test_loose_defaults_to_zero(self):
        row = {k: v for k, v in ROW.items() if k != '散件数'}
        self.assertEqual(sheets.data_matrix([row])[1][9], 0)

    def test_config_matrix_defaults_and_formulas(self):
        m = sheets.config_matrix({'货柜号': 'TGBU5973558'})
        self.assertEqual(m[0], ['参数', '值', '说明'])
        self.assertEqual([r[0] for r in m[1:]], sheets.CONFIG)
        self.assertEqual(m[1][1], 'TGBU5973558')
        self.assertEqual(m[sheets.CONFIG_ROW['卸柜费'] - 1][1], 125000)
        self.assertTrue(m[sheets.CONFIG_ROW['IVA'] - 1][1].startswith('=IF('))
        self.assertEqual(m[sheets.CONFIG_ROW['IVA计税货值USD'] - 1][1], 18000)
        formula = m[sheets.CONFIG_ROW['IVA'] - 1][1]
        self.assertEqual(formula, '=IF(COUNT(B13,B5,B9)<>3,"",(B13+B5)*B9*0.19)')
        self.assertNotIn('data!', formula)
        self.assertEqual(sheets.config_matrix({'IVA': 123})[sheets.CONFIG_ROW['IVA'] - 1][2], 'CLP，实际（显式输入）')

    def test_config_migrates_known_estimates_and_preserves_actual_iva(self):
        row = sheets.CONFIG_ROW['IVA'] - 1
        expected = sheets.config_formulas()['IVA']
        self.assertEqual(sheets.config_matrix({'IVA': '=(A1/B1+C1)*D1*0.3*0.19'})[row][1], expected)
        self.assertEqual(sheets.config_matrix({'IVA': 999}, {'IVA': 'CLP，估算'})[row][1], expected)
        self.assertEqual(sheets.config_matrix({'IVA': 999}, {'IVA': 'CLP，实际'})[row][1], 999)
        with self.assertRaises(ValueError):
            sheets.config_matrix({'IVA': '=(A1/B1+C1)*D1*0.3*0.19'}, {'IVA': '实际'})

    def test_matrices_validate_like_a_workbook(self):
        data = computed(sheets.data_matrix([ROW]), {(1, 10): 165, (1, 11): 1650, (4, 8): 2, (4, 11): 1650, (4, 12): 0.2,
                                                   (5, 9): 5, (5, 10): 165, (6, 9): 0, (6, 10): 0})
        config = computed(sheets.config_matrix({'货柜号': 'TGBU5973558', '海运费': 2000, '内陆费': 0,
                                                '发柜日期': '2026-09-01', 'ETA': '2026-10-18',
                                                'USD-CLP': 930, 'USD-CNY': 6.7}),
                          {(sheets.CONFIG_ROW['CNY-CLP'] - 1, 1): 140.6, (sheets.CONFIG_ROW['IVA'] - 1, 1): 1.0})
        book = book_from_matrices({'data': data, 'config': config},
                                  {'data': sheets.data_matrix([ROW]), 'config': sheets.config_matrix()})
        result = validate_book(book, 'sheet')
        self.assertEqual([i for i in result['issues'] if i['level'] != 'review'], [], result['issues'])
        self.assertEqual(result['rows'], 1)
        rows, config_values, notes = sheets.rows_from_book(book)
        self.assertEqual(rows[0]['总数量'], 165)
        self.assertEqual(config_values['ETA'], '2026-10-18')
        self.assertEqual(notes['卸柜费'], 'CLP，默认')

    def test_existing_positive_iva_without_provenance_is_not_relabelled_actual(self):
        data = sheets.data_matrix([ROW])
        config = [['参数', '值', '说明'], ['IVA', 123, '']]
        with self.assertRaisesRegex(ValueError, 'IVA 来源不明'):
            sheets.rows_from_book(book_from_matrices({'data': data, 'config': config}, {}))

    def test_sheet_errors_and_numeric_ids_are_reported(self):
        data = computed(sheets.data_matrix([dict(ROW, 条形码='x')]), {(1, 10): '#REF!', (1, 11): 1650})
        data[1][1] = 6903070215357
        book = book_from_matrices({'data': data, 'config': sheets.config_matrix()}, {'data': sheets.data_matrix([ROW]), 'config': []})
        messages = {}
        for i in validate_book(book, 'sheet')['issues']:
            messages.setdefault(i['cell'], []).append(i['message'])
        self.assertIn('公式错误值', messages['K2'])
        self.assertTrue(any('文本' in m for m in messages['B2']), messages['B2'])

    def test_template_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / '模板.xlsx'
            sheets.main(['template', str(out)])
            result = validate(out)
            self.assertEqual(result['template_version'], 2)
            self.assertNotIn('ERROR', result['status'])
            rows, config, _ = sheets.rows_from_book(load_xlsx(out))
            self.assertEqual(len(rows), 1)
            self.assertEqual(config['清关杂费'], 1500000)


class MarkTests(unittest.TestCase):
    def test_auto_marks_layer_over_user_and_ai_notes(self):
        existing = {('data', 'A2'): '用户备注' + sheets.MARKS['ai'] + '混合包待拆',
                    ('data', 'B2'): sheets.MARKS['auto'] + '旧问题',
                    ('data', 'C2'): '仅用户'}
        issues = [dict(sheet='data', cell='A2', message='数量不符'), dict(sheet='data', cell='D2', message='缺失')]
        plan = sheets.plan_marks(existing, issues, 'auto')
        self.assertEqual(plan[('data', 'A2')], ('用户备注' + sheets.MARKS['ai'] + '混合包待拆' + sheets.MARKS['auto'] + '数量不符', True))
        self.assertEqual(plan[('data', 'B2')], ('', False))
        self.assertEqual(plan[('data', 'D2')], (sheets.MARKS['auto'] + '缺失', True))
        self.assertNotIn(('data', 'C2'), plan)

    def test_unchanged_marks_are_not_rewritten(self):
        existing = {('data', 'A2'): sheets.MARKS['auto'] + '数量不符'}
        self.assertEqual(sheets.plan_marks(existing, [dict(sheet='data', cell='A2', message='数量不符')], 'auto'), {})

    def test_clearing_ai_keeps_auto_and_user_text(self):
        note = '用户' + sheets.MARKS['ai'] + '阻断导入：拆分' + sheets.MARKS['auto'] + '缺失'
        plan = sheets.plan_marks({('data', 'A2'): note}, [], 'ai')
        self.assertEqual(plan[('data', 'A2')], ('用户' + sheets.MARKS['auto'] + '缺失', True))

    def test_blocking_prefix_and_markable_filter(self):
        plan = sheets.plan_marks({}, [dict(sheet='data', cell='A53', message='拆分', blocking=True)], 'ai')
        self.assertTrue(plan[('data', 'A53')][0].endswith('阻断导入：拆分'))
        issues = [dict(sheet='data', cell='A'), dict(sheet='data', cell='L2:N2'), dict(sheet='x', cell='A1'), dict(sheet='data', cell='A1')]
        self.assertEqual(sheets.markable(issues, {'data'}), [dict(sheet='data', cell='A1')])


if __name__ == '__main__':
    unittest.main()
