import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('linux_recovery',Path(__file__).resolve().parents[1]/'linux-compose-setup.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ServerRecovery(unittest.TestCase):
    def test_hidden_input_and_private_file_never_fall_back_to_echoed_stdin(self):
        with patch.object(m.getpass,'getpass',return_value='code-fixture') as hidden:
            self.assertEqual(m.read_recovery_code(None,'en'),'code-fixture');hidden.assert_called_once()
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'private-code';f.write_text('code-fixture\n');f.chmod(0o600)
            self.assertEqual(m.read_recovery_code(f,'en'),'code-fixture')
            f.write_text('x'*65536)
            self.assertEqual(len(m.read_recovery_code(f,'en')),65536)
            f.chmod(0o644)
            with self.assertRaises(ValueError):m.read_recovery_code(f,'en')
            f.chmod(0o600);f.write_text('x'*65537)
            with self.assertRaises(ValueError):m.read_recovery_code(f,'en')
            link=Path(d)/'link';link.symlink_to(f)
            with self.assertRaises(ValueError):m.read_recovery_code(link,'en')

    def test_recover_uses_only_running_web_stdin_without_restarting_or_rewriting_installation(self):
        with tempfile.TemporaryDirectory() as d:
            folder=Path(d);sentinel=folder/'retained';sentinel.write_bytes(b'unchanged')
            state={'completed':True};calls=[]
            def compose(folder_arg,state_arg,args,**kwargs):
                calls.append((args,kwargs));self.assertEqual(folder_arg,folder);self.assertEqual(state_arg,state)
                self.assertEqual(args,['exec','-T','web','node','/app/scripts/server-recovery-client.mjs'])
                self.assertEqual(json.loads(kwargs['stdin']),{'action':'recover','code':'SECRET-RECOVERY'})
                self.assertNotIn('SECRET-RECOVERY',repr(args))
                return json.dumps({'ok':True,'profile':{'id':'peer','origin':'https://source.example','installationId':'source','label':'Source'}})
            output=io.StringIO()
            with patch.object(m,'load_state',return_value=state),patch.object(m,'read_recovery_code',return_value='SECRET-RECOVERY'),patch.object(m,'compose',side_effect=compose),contextlib.redirect_stdout(output):
                m.recover_connection(folder,state,None,'en')
            self.assertEqual(len(calls),1);self.assertEqual(sentinel.read_bytes(),b'unchanged');self.assertNotIn('SECRET-RECOVERY',output.getvalue())
            self.assertIn('restored',output.getvalue())

    def test_recover_failure_is_retryable_and_redacts_transport_output(self):
        with tempfile.TemporaryDirectory() as d:
            state={'completed':True}
            with patch.object(m,'load_state',return_value=state),patch.object(m,'read_recovery_code',return_value='SECRET-RECOVERY'),patch.object(m,'compose',side_effect=ValueError('SECRET-RECOVERY')):
                with self.assertRaises(ValueError) as error:m.recover_connection(Path(d),state,None,'en')
            self.assertNotIn('SECRET-RECOVERY',str(error.exception));self.assertIn('retry',str(error.exception).lower())

    def test_cli_wires_recover_and_accepts_only_code_file_path_or_hidden_input(self):
        with tempfile.TemporaryDirectory() as d:
            state={'completed':True};code=Path(d)/'private-code'
            with patch.object(m,'load_state',return_value=state),patch.object(m,'recover_connection') as recover,patch('builtins.print'):
                self.assertEqual(m.main(['recover','--state-dir',d,'--recovery-code-file',str(code),'--lang','en']),0)
                recover.assert_called_once_with(Path(d).resolve(),state,code,'en')

if __name__=='__main__':unittest.main()
