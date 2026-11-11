import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'linux-compose-setup.py'
spec = importlib.util.spec_from_file_location('linux_owner_access', SOURCE)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class OwnerAccess(unittest.TestCase):
    def setUp(self):
        self.assertTrue(hasattr(m, 'issue_owner_access'), 'Linux owner-access workflow is missing')
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.state = {'completed': True, 'network': {'publicOrigin': 'https://cast.example'}}
        self.invite = 'https://cast.example/super-admin#access=csa2.' + 'a' * 43 + '\n'
        self.output = self.folder / 'owner-access.txt'

    def test_issues_protected_file_without_link_stdout_or_session_revocation(self):
        calls = []
        def compose(folder, state, args, **unused):
            calls.append(args)
            if args[0] == 'cp': Path(args[-1]).write_text(self.invite)
            return 'Owner invitation saved; never relay raw child stdout'
        stdout = io.StringIO()
        with patch.object(m, 'compose', side_effect=compose), contextlib.redirect_stdout(stdout):
            m.issue_owner_access(self.folder, self.state, self.output)
        self.assertEqual(self.output.read_text(), self.invite)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)
        self.assertNotIn(self.invite.strip(), stdout.getvalue())
        self.assertNotIn('csa2.', stdout.getvalue())
        self.assertNotIn('--revoke-all', repr(calls))
        issue = calls[0]
        self.assertEqual(issue[:5], ['exec', '-T', 'web', 'node', '/app/scripts/super-admin-owner.mjs'])
        self.assertEqual(issue[issue.index('--origin') + 1], 'https://cast.example')
        remote = issue[issue.index('--output') + 1]
        self.assertRegex(remote, r'^/data/\.castlink-owner-access-[a-f0-9]{32}\.txt$')
        self.assertEqual(calls[1][:2], ['cp', 'web:' + remote])
        self.assertEqual(calls[-1][-1], remote)

    def test_existing_file_symlink_non_https_and_incomplete_install_refuse_before_issue(self):
        self.output.write_text('retained')
        with patch.object(m, 'compose', side_effect=AssertionError('must not issue')):
            with self.assertRaises(ValueError): m.issue_owner_access(self.folder, self.state, self.output)
            self.assertEqual(self.output.read_text(), 'retained')
            self.output.unlink(); self.output.symlink_to(self.folder / 'missing')
            with self.assertRaises(ValueError): m.issue_owner_access(self.folder, self.state, self.output)
            self.output.unlink()
            for state in [{**self.state, 'completed': False}, {'completed': True, 'network': {'publicOrigin': 'http://cast.example'}}]:
                with self.assertRaises(ValueError): m.issue_owner_access(self.folder, state, self.output)
            with self.assertRaises(ValueError): m.issue_owner_access(self.folder, self.state, Path('relative.txt'))
        self.assertFalse(self.output.exists())

    def test_wrong_origin_or_malformed_secret_is_never_exported(self):
        for text in ['https://other.example/super-admin#access=csa2.' + 'a' * 43 + '\n', self.invite + 'extra\n', 'not an invitation\n']:
            def compose(folder, state, args, **unused):
                if args[0] == 'cp': Path(args[-1]).write_text(text)
                return ''
            with patch.object(m, 'compose', side_effect=compose), self.assertRaises(ValueError):
                m.issue_owner_access(self.folder, self.state, self.output)
            self.assertFalse(self.output.exists())

    def test_copy_failure_cleans_only_own_remote_temp_and_does_not_leave_output(self):
        calls = []
        def compose(folder, state, args, **unused):
            calls.append(args)
            if args[0] == 'cp': raise ValueError('Docker copy failed')
            return ''
        with patch.object(m, 'compose', side_effect=compose), self.assertRaises(ValueError):
            m.issue_owner_access(self.folder, self.state, self.output)
        self.assertEqual(calls[-1][:4], ['exec', '-T', 'web', 'node'])
        self.assertFalse(self.output.exists())

    def test_malformed_fragment_error_does_not_include_secret_bytes(self):
        token = 'csa2.' + 's' * 43
        def compose(folder, state, args, **unused):
            if args[0] == 'cp': Path(args[-1]).write_text('https://cast.example/super-admin#' + token + '\n')
            return ''
        with patch.object(m, 'compose', side_effect=compose):
            with self.assertRaises(ValueError) as error: m.issue_owner_access(self.folder, self.state, self.output)
        self.assertNotIn(token, str(error.exception))

    def test_main_dispatch_uses_installation_lock_without_start_update_or_raw_output(self):
        with patch.object(m, 'load_state', return_value=self.state), patch.object(m, 'issue_owner_access') as issue, patch.object(m, 'installation_lock', return_value=contextlib.nullcontext()) as lock:
            self.assertEqual(m.main(['owner-access', '--state-dir', str(self.folder), '--owner-access-file', str(self.output)]), 0)
        lock.assert_called_once_with(self.folder)
        issue.assert_called_once_with(self.folder, self.state, self.output)


if __name__ == '__main__': unittest.main()
