"""Synthetic adapter checks; real upstream parsers, no live database reads."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
SOURCE = Path(os.environ.get('WECHAT_EVIDENCE_SOURCE', SKILL / 'scripts/evidence.py'))
spec = importlib.util.spec_from_file_location('wechat_evidence_under_test', SOURCE)
evidence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evidence)
BACKEND = Path(os.environ.get('WECHAT_BACKEND_DIR', SKILL.parents[1] / 'skill-packs/tzwkb-wechat-decrypt')).resolve()
if not (BACKEND / 'message.py').is_file():
    raise unittest.SkipTest('Install the declared wechat-decrypt backend to run parser integration checks')
sys.path.insert(0, str(BACKEND))
import message
import appmsg


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.storage = Path(self.tmp.name) / 'account/db_storage'
        self.directory = self.storage / 'message'
        self.directory.mkdir(parents=True)
        self.paths = [str(self.directory / f'message_{i}.db') for i in (0, 1)]
        for path in self.paths:
            Path(path).touch()
        self.table = 'Msg_' + '1' * 32
        self.db = SimpleNamespace(get_name2id=lambda: {self.table: 'synthetic@chatroom'},
                                  get_message_dbs=lambda: self.paths,
                                  find_data_dir=lambda: str(self.storage))
        self.contacts = SimpleNamespace(find_contact=Mock(return_value=[(self.table, 'synthetic@chatroom', 'Synthetic')]),
                                        resolve_contact_name=lambda wxid: 'Name-' + wxid)
        self.fetch = Mock(return_value=[])
        modules = [self.db, self.contacts, message, appmsg, SimpleNamespace(fetch=self.fetch)]
        self.patch = patch.object(evidence, 'backend', return_value=modules)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.parser_check = patch.object(message, 'has_zstd_decoder', return_value=True)
        self.parser_check.start()
        self.addCleanup(self.parser_check.stop)

    def row(self, text, shard=0, local_id=1, sender='sender-one', epoch=1788451200, kind=1):
        return {'_db': self.paths[shard], 'local_id': str(local_id), 'server_id': str(1000 + shard * 100 + local_id),
                'create_time': str(epoch), 'local_type': str(kind), 'real_sender_id': '2',
                'sender_wxid': sender, 'is_me': '0', 'msg_hex': text.encode().hex()}

    def read(self, **changes):
        args = dict(backend_dir='unused', chat='synthetic@chatroom', start='2026-09-03', end='2026-09-04',
                    timezone='Asia/Shanghai')
        args.update(changes)
        return evidence.read_evidence(**args)

    def test_keyword_after_500_characters_keeps_complete_text(self):
        original = 'a' * 650 + 'Needle-Here' + 'z' * 75
        self.fetch.return_value = [self.row(original)]
        result = self.read(keywords=('needle-here',))
        self.assertEqual(result['coverage']['matched'], 1)
        self.assertEqual(result['messages'][0]['content'], original)
        self.assertGreater(len(result['messages'][0]['content']), 500)

    def test_shard_local_ids_and_sender_identity_are_preserved(self):
        self.fetch.return_value = [self.row('one', shard=0, sender='wxid_one'),
                                   self.row('two', shard=1, sender='wxid_two')]
        result = self.read()
        self.assertEqual(len(result['messages']), 2)
        self.assertEqual([r['local_id'] for r in result['messages']], ['1', '1'])
        self.assertEqual([r['sender_wxid'] for r in result['messages']], ['wxid_one', 'wxid_two'])
        self.assertEqual([r['source_db'] for r in result['messages']], ['message_0.db', 'message_1.db'])
        self.assertTrue(all(r['server_id'] for r in result['messages']))

    def test_ambiguous_chat_stops_before_fetch(self):
        self.contacts.find_contact.return_value += [(self.table, 'other@chatroom', 'Other')]
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            self.read()
        self.fetch.assert_not_called()

    def test_inclusive_end_aware_dates_and_dst_offsets(self):
        zone = ZoneInfo('America/Santiago')
        before = datetime(2026, 9, 5, 23, 30, tzinfo=zone)
        after = datetime(2026, 9, 6, 3, 30, tzinfo=zone)
        self.fetch.return_value = [self.row('before', epoch=int(before.timestamp())),
                                   self.row('after', local_id=2, epoch=int(after.timestamp()))]
        result = self.read(start='2026-09-05', end='2026-09-06', timezone='America/Santiago')
        _, paths, since, until = self.fetch.call_args.args
        self.assertEqual(paths, self.paths)
        self.assertIsNotNone(since.tzinfo)
        self.assertEqual(until.date().isoformat(), '2026-09-07')
        self.assertEqual((until.timestamp() - since.timestamp()) / 3600, 47)
        self.assertEqual(since.utcoffset(), timedelta(hours=-4))
        self.assertEqual(until.utcoffset(), timedelta(hours=-3))
        self.assertTrue(result['messages'][0]['time'].endswith('-04:00'))
        self.assertTrue(result['messages'][1]['time'].endswith('-03:00'))
        self.assertEqual(result['range']['until_exclusive'], until.isoformat())

    def test_nested_quote_xml_exposes_title_without_media_parameters(self):
        nested = ('<msg><appmsg><type>6</type><title>synthetic-order.xlsx</title><appattach>'
                  '<fileext>xlsx</fileext><aeskey>synthetic-secret-marker</aeskey>'
                  '<cdnattachurl>https://media.invalid/private-token</cdnattachurl></appattach></appmsg></msg>')
        outer = ('<msg><appmsg><type>57</type><title>Deposit confirmation</title>'
                 '<thumburl>https://media.invalid/other-token</thumburl><refermsg><type>49</type>'
                 '<displayname>Synthetic Sender</displayname><content><![CDATA[' + nested +
                 ']]></content></refermsg></appmsg></msg>')
        self.fetch.return_value = [self.row(outer, kind=49)]
        result = self.read(keywords=('synthetic-order.xlsx',))
        self.assertEqual(result['coverage']['matched'], 1)
        self.assertEqual(result['messages'][0]['app']['quoted_attachment']['title'], 'synthetic-order.xlsx')
        serialized = json.dumps(result).lower()
        for secret in ('aeskey', 'cdnattachurl', 'private-token', 'other-token', 'synthetic-secret-marker', '<appmsg'):
            self.assertNotIn(secret, serialized)

    def test_limit_reports_truncation_and_incomplete(self):
        self.fetch.return_value = [self.row(str(i), local_id=i + 1) for i in range(3)]
        result = self.read(limit=2)
        self.assertEqual(len(result['messages']), 2)
        self.assertEqual(result['coverage']['matched'], 3)
        self.assertTrue(result['coverage']['truncated'])
        self.assertFalse(result['coverage']['complete'])

    def test_multidigit_missing_shard_and_factory_report_incomplete(self):
        for name in ('message_fts.db', 'message_resource.db'):
            (self.directory / name).touch()
        with self.subTest('healthy two shards ignore auxiliary databases'):
            self.assertTrue(self.read()['coverage']['complete'])
        missing = self.directory / 'message_10.db'
        missing.touch()
        with self.subTest('multi digit shard omitted by upstream'):
            coverage = self.read()['coverage']
            self.assertEqual(coverage['unread_shards'], ['message_10.db'])
            self.assertFalse(coverage['complete'])
        missing.unlink()
        (self.directory / 'message_2.db.factory').mkdir()
        with self.subTest('quarantine alone remains incomplete'):
            coverage = self.read()['coverage']
            self.assertEqual(coverage['unread_shards'], [])
            self.assertEqual(coverage['quarantined_shards'], ['message_2.db.factory'])
            self.assertFalse(coverage['complete'])

    def test_inverted_dates_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'end must not precede start'):
            self.read(start='2026-09-05', end='2026-09-03')
        self.fetch.assert_not_called()


if __name__ == '__main__':
    unittest.main()
