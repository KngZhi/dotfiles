import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import auto_verify as hook
import install_hook


class HookTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / 'state.json'
        env = patch.dict(os.environ, {'CONTAINER_INTAKE_STATE': str(self.state)})
        env.start()
        self.addCleanup(env.stop)
        self.book = self.root / 'container.xlsx'
        self.book.write_bytes((SCRIPTS.parent / 'assets/模板.xlsx').read_bytes())
        self.event = {'hook_event_name': 'PostToolUse', 'session_id': 'session-one'}

    def arm(self):
        with contextlib.redirect_stdout(io.StringIO()):
            hook.register('session-one', [str(self.book)])

    def test_inactive_session_does_nothing(self):
        self.assertEqual(hook.run_hook(self.event), {})
        self.assertFalse(self.state.exists())
        self.arm()
        self.assertEqual(hook.run_hook(dict(self.event, session_id='other')), {})
        self.assertFalse(self.book.with_suffix('.validation.json').exists())

    def test_verifies_changed_file_only_and_preserves_input(self):
        self.arm()
        before = self.book.read_bytes()
        result = hook.run_hook(self.event)
        self.assertIn('additionalContext', result['hookSpecificOutput'])
        import openpyxl
        from io import BytesIO
        old = openpyxl.load_workbook(BytesIO(before), data_only=True)
        marked = openpyxl.load_workbook(self.book, data_only=True)
        self.assertEqual(list(old['data'].values), list(marked['data'].values))
        self.assertEqual(marked['data']['A2'].fill.fgColor.rgb, 'FFFFC7CE')
        self.assertIn('货号缺失', marked['data']['A2'].comment.text)
        report = self.book.with_suffix('.validation.json')
        self.assertEqual(json.loads(report.read_text())['hook']['session_id'], 'session-one')
        self.assertEqual(hook.run_hook(self.event), {})
        import openpyxl
        w = openpyxl.load_workbook(self.book)
        w['data']['A2'] = 'changed'
        w.save(self.book)
        w.close()
        self.assertTrue(hook.run_hook(self.event))
        w = openpyxl.load_workbook(self.book)
        self.assertIsNone(w['data']['A2'].comment)
        self.assertNotEqual(w['data']['A2'].fill.fgColor.rgb, 'FFFFC7CE')
        self.assertEqual(hook.run_hook(self.event), {})

    def test_business_issue_blocks_and_preserves_user_note(self):
        import openpyxl
        from openpyxl.comments import Comment
        w = openpyxl.load_workbook(self.book)
        w['data']['A2'] = 'SC109/C109'
        w['data']['A2'].comment = Comment('用户原备注', 'owner')
        w.save(self.book)
        self.book.with_suffix('.review.json').write_text(json.dumps({'issues': [dict(
            sheet='data', cell='A2', expected_value='SC109/C109', blocking=True,
            message='43打混合包需确认各货号数量，拆分核对后再导入')]}))
        self.arm()
        hook.run_hook(self.event)
        w = openpyxl.load_workbook(self.book)
        self.assertIn('阻断导入', w['data']['A2'].comment.text)
        self.assertIn('用户原备注', w['data']['A2'].comment.text)
        self.assertEqual(json.loads(self.book.with_suffix('.validation.json').read_text())['status'], 'ERROR')
        saved = self.book.read_bytes()
        self.assertEqual(hook.run_hook(self.event), {})
        self.assertEqual(saved, self.book.read_bytes())
        self.book.with_suffix('.review.json').write_text('{"issues": []}')
        hook.run_hook(self.event)
        self.assertEqual(openpyxl.load_workbook(self.book)['data']['A2'].comment.text, '用户原备注')

    def test_formula_xml_and_cached_values_survive_annotations(self):
        from zipfile import ZipFile
        from io import BytesIO
        import xml.etree.ElementTree as ET
        def payload(raw):
            with ZipFile(BytesIO(raw)) as z:
                result = {}
                for name in ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']:
                    tree = ET.fromstring(z.read(name))
                    for c in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                        if list(c):
                            result[name, c.get('r')] = (c.get('t'), [(e.tag, e.text, e.attrib) for e in c])
                return result
        before = payload(self.book.read_bytes())
        self.arm()
        hook.run_hook(self.event)
        self.assertEqual(before, payload(self.book.read_bytes()))

    def test_stale_business_issue_does_not_mark_wrong_cell(self):
        self.book.with_suffix('.review.json').write_text(json.dumps({'issues': [dict(
            sheet='data', cell='A2', expected_value='SC109/C109', blocking=True, message='混合包未拆清')]}))
        self.arm()
        before = self.book.read_bytes()
        self.assertIn('定位已变化', str(hook.run_hook(self.event)))
        self.assertEqual(before, self.book.read_bytes())

    def test_failure_retries_and_stop_uses_compatible_output(self):
        self.arm()
        self.book.write_bytes(b'incomplete zip')
        self.assertIn('自动验证失败', str(hook.run_hook(self.event)))
        self.book.write_bytes((SCRIPTS.parent / 'assets/模板.xlsx').read_bytes())
        self.assertIn('systemMessage', hook.run_hook(dict(self.event, hook_event_name='Stop')))

    def test_installer_preserves_other_hooks_and_is_idempotent(self):
        config = self.root / '.codex/hooks.json'
        config.parent.mkdir()
        config.write_text(json.dumps({'hooks': {'PostToolUse': [{'hooks': [{'type': 'command', 'command': 'original'}]}]}}))
        install_hook.install(self.root)
        content = config.read_text()
        self.assertIn('original', content)
        install_hook.install(self.root)
        self.assertEqual(config.read_text(), content)

    def test_expiry_disables_old_registration(self):
        self.arm()
        data = json.loads(self.state.read_text())
        data['session-one']['updated'] = 0
        self.state.write_text(json.dumps(data))
        self.assertEqual(hook.run_hook(self.event), {})


if __name__ == '__main__':
    unittest.main()
