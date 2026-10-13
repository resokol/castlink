import base64
import importlib.util
import os
from pathlib import Path
import stat
import struct
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('authorize',Path(__file__).resolve().parents[1]/'server-ssh-authorize-key.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def public(seed):
 raw=struct.pack('>I',11)+b'ssh-ed25519'+struct.pack('>I',32)+bytes([seed])*32
 return 'ssh-ed25519 '+base64.b64encode(raw).decode()+' fixture'

class AuthorizeTests(unittest.TestCase):
 def test_append_preserves_existing_and_retry_is_idempotent(self):
  with tempfile.TemporaryDirectory() as tmp:
   home=Path(tmp);(home/'.ssh').mkdir();file=home/'.ssh/authorized_keys'
   previous=b'# existing access\n'+public(1).encode();file.write_bytes(previous)
   result=m.authorize_key(home,public(2));self.assertTrue(result['added'])
   final=file.read_bytes();self.assertTrue(final.startswith(previous+b'\n'));self.assertIn(b'castlink-generated',final)
   self.assertFalse(m.authorize_key(home,public(2))['added']);self.assertEqual(final,file.read_bytes())
   self.assertEqual(stat.S_IMODE(file.stat().st_mode),0o600)
   self.assertEqual(stat.S_IMODE((home/'.ssh').stat().st_mode),0o700)
 def test_invalid_key_has_no_filesystem_effect(self):
  for key in ['ssh-ed25519 garbage','command="id" '+public(1),public(1)+'\n'+public(2),'ssh-rsa '+public(1).split()[1]]:
   with tempfile.TemporaryDirectory() as tmp:
    with self.assertRaises(ValueError):m.authorize_key(Path(tmp),key)
    self.assertEqual(list(Path(tmp).iterdir()),[])
 def test_symlink_and_hardlink_refused_without_changing_target(self):
  for kind in ['directory','file','hardlink']:
   with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp);home=root/'home';home.mkdir();target=root/'target';target.write_bytes(b'preserve');os.chmod(target,0o644)
    if kind=='directory':(home/'.ssh').symlink_to(root,target_is_directory=True)
    else:
     (home/'.ssh').mkdir()
     if kind=='file':(home/'.ssh/authorized_keys').symlink_to(target)
     else:os.link(target,home/'.ssh/authorized_keys')
    with self.assertRaises((ValueError,OSError)):m.authorize_key(home,public(1))
    self.assertEqual(target.read_bytes(),b'preserve');self.assertEqual(stat.S_IMODE(target.stat().st_mode),0o644)

if __name__=='__main__':unittest.main()
