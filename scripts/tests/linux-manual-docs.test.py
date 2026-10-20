"""Validate shipped manual examples through the real readonly CLI."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / 'scripts/linux-compose-setup.py'
GUIDES = {
    'ru': ROOT / 'distribution/LINUX_MANUAL.md',
    'en': ROOT / 'distribution/docs/en/LINUX_MANUAL.md',
    'zh-CN': ROOT / 'distribution/docs/zh-CN/LINUX_MANUAL.md',
}


class LinuxManual(unittest.TestCase):
    def test_real_cli_accepts_both_examples_in_every_language(self):
        env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
        canonical = None
        with tempfile.TemporaryDirectory(prefix='castlink-manual-docs-') as temp:
            for lang, guide in GUIDES.items():
                text = guide.read_text(encoding='utf-8')
                examples = re.findall(r'```json\n(.*?)\n```', text, re.S)
                self.assertEqual(len(examples), 2, str(guide))
                values = [json.loads(example) for example in examples]
                self.assertEqual([v['setupMode'] for v in values], ['quick', 'advanced'])
                if canonical is None:
                    canonical = values
                self.assertEqual(values, canonical, 'localized examples must match')
                for i, example in enumerate(examples):
                    config = Path(temp) / (lang + str(i) + '.json')
                    config.write_text(example, encoding='utf-8')
                    result = subprocess.run(
                        [sys.executable, str(HELPER), 'validate', '--config', str(config), '--lang', lang],
                        env=env, capture_output=True, text=True, encoding='utf-8')
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertTrue(result.stdout.strip())
            result = subprocess.run([sys.executable, str(HELPER), '--help'], env=env,
                                    capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(result.returncode, 0, result.stderr)
            for flag in ['--state-dir', '--config', '--package', '--lang', '--advanced']:
                self.assertIn(flag, result.stdout)

    def test_current_cli_and_pinned_historical_cli_are_separated(self):
        for guide in GUIDES.values():
            text = guide.read_text(encoding='utf-8')
            self.assertIn('1.0.0-rc.8', text)
            self.assertEqual(text.count('<a id="legacy-1472"></a>'), 1)
            self.assertIn('](#legacy-1472)', text)
            historical = text.split('<a id="legacy-1472"></a>', 1)[1].split('<a id="out-of-box"></a>', 1)[0]
            self.assertIn('1472cd052d7e', historical)
            for command in re.findall(r'\x60\x60\x60bash\n(.*?)\n\x60\x60\x60', historical, re.S):
                self.assertNotIn('--advanced', command, 'legacy package must not receive the new flag')
            advanced = text.split('<a id="advanced"></a>', 1)[1]
            self.assertRegex(advanced, r'linux-compose-setup\.py init[^\n]*--advanced')
            self.assertIn('PRODUCTS.md', text)

    def test_manual_anchors_and_relative_link_targets_exist(self):
        for guide in GUIDES.values():
            text = guide.read_text(encoding='utf-8')
            for anchor in ['out-of-box', 'advanced']:
                self.assertEqual(text.count('<a id="' + anchor + '"></a>'), 1)
                self.assertIn('](#' + anchor + ')', text)
            for target in re.findall(r'\]\(([^)]+)\)', text):
                if '://' in target or target.startswith('#'):
                    continue
                relative = target.split('#', 1)[0]
                self.assertTrue((guide.parent / relative).is_file(), target)
            install = (guide.parent / 'INSTALL.md').read_text(encoding='utf-8')
            for anchor in ['out-of-box', 'advanced']:
                self.assertIn('LINUX_MANUAL.md#' + anchor, install)


if __name__ == '__main__':
    unittest.main()
