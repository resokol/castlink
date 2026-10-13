import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const script=path.resolve('scripts/server-provision-vps.py');
test('VPS accepts packaged license documentation and rejects unsafe archive members before extraction',()=>{
 const result=execFileSync(process.env.CASTLINK_PYTHON||'python3',['-c',String.raw`
import importlib.util,tempfile,pathlib,tarfile,io,json,hashlib,sys
s=importlib.util.spec_from_file_location('p',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def archive(folder,extra=None):
 with tarfile.open(folder/'release.tar.gz','w:gz') as t:
  files={'LICENSE':b'license','THIRD_PARTY_NOTICES':b'notices','distribution/README.md':b'readme','third_party/npm/license.txt':b'license','payload/images.tar.gz':b'images','payload/release.json':json.dumps({'imageArchiveSha256':hashlib.sha256(b'images').hexdigest()}).encode(),'scripts/ubuntu-easy-setup-bootstrap.sh':b'script'}
  for name,body in files.items():
   info=tarfile.TarInfo(name);info.size=len(body);t.addfile(info,io.BytesIO(body))
  if extra:
   name,kind=extra;info=tarfile.TarInfo(name)
   if kind=='link':info.type=tarfile.SYMTYPE;info.linkname='/tmp/outside'
   elif kind=='hardlink':info.type=tarfile.LNKTYPE;info.linkname='LICENSE'
   t.addfile(info)
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp)
 folder=root/'valid';folder.mkdir();archive(folder);m.prepare_release(folder)
 assert (folder/'THIRD_PARTY_NOTICES').read_bytes()==b'notices'
 assert (folder/'third_party/npm/license.txt').read_bytes()==b'license'
 for i,extra in enumerate([('../outside','file'),('/tmp/outside','file'),('third_party/link','link'),('payload/link','hardlink'),('private/key','file')]):
  folder=root/str(i);folder.mkdir();archive(folder,extra)
  try:m.prepare_release(folder)
  except ValueError:pass
  else:raise AssertionError('unsafe archive accepted')
  assert not (folder/'LICENSE').exists(),'extracted files before validation'
print('ok')
`,script],{encoding:'utf8'});assert.equal(result.trim(),'ok');
});
test('failed release preparation leaves no apparent installed scope and retry can proceed',()=>{
 const result=execFileSync(process.env.CASTLINK_PYTHON||'python3',['-c',String.raw`
import importlib.util,tempfile,pathlib,sys
s=importlib.util.spec_from_file_location('p',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp);original=m.Path;m.Path=lambda v:root if v=='/opt' else original(v)
 m.discover=lambda:[];m.ports_available=lambda *_:None;m.event=lambda **_:None
 m.download_release=lambda url,checksum,destination:destination.write_bytes(b'archive')
 def refuse(folder):raise ValueError('Invalid release archive member')
 m.prepare_release=refuse
 for attempt in range(2):
  try:m.deploy({'host':'8.8.8.8','releaseUrl':'fixture','releaseSha256':'a'*64})
  except ValueError as error:assert str(error)=='Invalid release archive member',str(error)
  else:raise AssertionError('expected failure')
  assert not list(root.iterdir()),'failed preparation left a scope or staging directory'
print('ok')
`,script],{encoding:'utf8'});assert.equal(result.trim(),'ok');
});
