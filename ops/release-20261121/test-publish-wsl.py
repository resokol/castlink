"""Offline tests only; imports never invoke gh or publish a release."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name('publish-wsl.py')

class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCRIPT.exists():
            return
        spec = importlib.util.spec_from_file_location('publisher', SCRIPT)
        cls.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.m)

    def setUp(self):
        self.assertTrue(SCRIPT.exists(), 'Operational verifier is not implemented yet')
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        for name in self.m.NAMES:
            (self.folder/name).write_bytes(('fixture '+name).encode())
        def entry(name):
            b=(self.folder/name).read_bytes()
            return {'file':name,'size':len(b),'sha256':hashlib.sha256(b).hexdigest()}
        manifest={'schemaVersion':1,'version':'1.0.7','sourceCommit':self.m.SOURCE,
                  'releaseTag':self.m.TAG,'channel':'server-wsl','repository':'resokol/castlink',
                  'architecture':'amd64','rootfs':{**entry(self.m.ROOTFS),'expandedBytes':2000},
                  'sources':entry(self.m.SOURCES),'upstreamSources':entry(self.m.UPSTREAM),
                  'inventory':entry('packages.tsv'),
                  'lifecycle':{'schemaVersion':1,'runtimeContract':'castlink-wsl-pg16-v1',
                               'postgresMajor':16,'supportedSources':list(self.m.SUPPORTED),
                               'applicationMigrations':'runtime-bootstrap-v1',
                               'helpers':[entry(n) for n in self.m.HELPERS]},
                  'nativePanel':{'schemaVersion':1,'host':'CastLinkServer.exe',
                                 'binding':'server-native-binding.json',
                                 'files':[entry(n) for n in self.m.NATIVE]}}
        (self.folder/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
        self.resum()

    def resum(self):
        with zipfile.ZipFile(self.folder/self.m.MAINTENANCE_ZIP,'w') as z:
            for name in self.m.ZIP_NAMES:
                z.write(self.folder/name,name)
        (self.folder/'SHA256SUMS').write_text(''.join(
            hashlib.sha256((self.folder/n).read_bytes()).hexdigest()+'  '+n+'\n'
            for n in sorted(self.m.NAMES-{'SHA256SUMS'})),encoding='ascii')

    def test_valid_complete_package(self):
        result=self.m.verify_package(self.folder)
        self.assertEqual(len(result),26)
        self.assertEqual({a['name'] for a in result},self.m.NAMES)

    def test_corruption_missing_extra_and_duplicate_checksum_refused(self):
        for kind in ('corrupt','missing','extra','duplicate'):
            with self.subTest(kind=kind):
                file=self.folder/'LICENSE'; original=file.read_bytes()
                sums=(self.folder/'SHA256SUMS').read_bytes()
                if kind=='corrupt':file.write_bytes(b'changed')
                elif kind=='missing':file.unlink()
                elif kind=='extra':(self.folder/'unowned.txt').write_text('extra')
                else:
                    with (self.folder/'SHA256SUMS').open('ab') as out:out.write(sums.splitlines()[0]+b'\n')
                with self.assertRaises(self.m.Refused):self.m.verify_package(self.folder)
                file.write_bytes(original)
                (self.folder/'unowned.txt').unlink(missing_ok=True)
                (self.folder/'SHA256SUMS').write_bytes(sums)

    def test_manifest_identity_and_referenced_hash_fail_even_with_recomputed_sums(self):
        file=self.folder/'manifest.json'; manifest=json.loads(file.read_text())
        for key,value in [('sourceCommit','a'*40),('version','1.0.8'),('repository','elsewhere/repo'),('architecture','arm64'),('releaseTag','server-wsl-v1.0.7-wrong'),('channel','linux')]:
            with self.subTest(key=key):
                changed={**manifest,key:value};file.write_text(json.dumps(changed));self.resum()
                with self.assertRaises(self.m.Refused):self.m.verify_package(self.folder)
        file.write_text(json.dumps(manifest));manifest['sources']['sha256']='0'*64
        file.write_text(json.dumps(manifest));self.resum()
        with self.assertRaises(self.m.Refused):self.m.verify_package(self.folder)

    def test_unknown_source_refused(self):
        file=self.folder/'manifest.json';manifest=json.loads(file.read_text())
        manifest['lifecycle']['supportedSources'][-1]='server-wsl-v1.0.6-rc.1-dddddddddddd'
        file.write_text(json.dumps(manifest));self.resum()
        with self.assertRaises(self.m.Refused):self.m.verify_package(self.folder)

    def test_incomplete_zip_refused_even_with_recomputed_checksum(self):
        with zipfile.ZipFile(self.folder/self.m.MAINTENANCE_ZIP,'w') as archive:
            archive.writestr('manifest.json',(self.folder/'manifest.json').read_bytes())
        sums=self.folder/'SHA256SUMS'
        sums.write_text(''.join(hashlib.sha256((self.folder/n).read_bytes()).hexdigest()+'  '+n+'\n'
                               for n in sorted(self.m.NAMES-{'SHA256SUMS'})))
        with self.assertRaises(self.m.Refused):self.m.verify_package(self.folder)

    def world(self):
        m=self.m
        class FakeGitHub:
            release=None
            assets=[]
            mutations=[]
            ci_ok=True
            lose_create=False
            lose_upload=False
            lose_patch=False
            orphan_create=False
            def api(fake,route,method='GET',body=None,binary=None,paginate=False):
                if route=='actions/runs/'+str(m.RUN):
                    return {'id':m.RUN,'head_sha':m.SOURCE,'status':'completed','conclusion':'success',
                            'repository':{'full_name':m.REPO},'path':'.github/workflows/server-wsl-package.yml'}
                if route=='compare/'+m.SOURCE+'...main':
                    return {'status':'identical','merge_base_commit':{'sha':m.SOURCE}}
                if route.startswith('git/matching-refs/'):
                    return [{'ref':'refs/tags/'+m.TAG,'object':{'type':'commit','sha':m.SOURCE}}]
                if route.startswith('actions/workflows/ci.yml/'):
                    return [{'workflow_runs':[{'id':456,'head_sha':m.SOURCE,'run_number':1,'run_attempt':1,
                           'status':'completed','conclusion':'success' if fake.ci_ok else 'failure',
                           'path':'.github/workflows/ci.yml','repository':{'full_name':m.REPO}}]}]
                if method=='POST' and route=='releases':
                    fake.mutations.append(('create',body))
                    if not fake.orphan_create:
                        fake.release={'id':123,**body}
                    if fake.lose_create or fake.orphan_create:raise m.Refused('lost create response')
                    return dict(fake.release)
                if method=='POST' and route.startswith('https://uploads.github.com/'):
                    assert '/releases/123/assets?' in route
                    fake.mutations.append(('upload',binary.name))
                    fake.assets.append({'id':len(fake.assets)+1,'name':binary.name,'state':'uploaded',
                                        'size':binary.stat().st_size,'digest':'sha256:'+m.digest_file(binary)})
                    if fake.lose_upload:raise m.Refused('lost upload response')
                    return dict(fake.assets[-1])
                if route=='releases/123' and method=='PATCH':
                    fake.mutations.append(('publish',body))
                    fake.release.update(body)
                    if fake.lose_patch:raise m.Refused('lost publish response')
                    return dict(fake.release)
                if route=='releases/123':return dict(fake.release)
                raise AssertionError(('unexpected API',route,method))
            def listing(fake,route):
                if route=='releases?per_page=100':return [dict(fake.release)] if fake.release else []
                if route=='releases/123/assets?per_page=100':return [dict(a) for a in fake.assets]
                raise AssertionError(('unexpected list',route))
        return FakeGitHub()

    def operation_inputs(self):
        self.notes=self.folder.parent/(self.folder.name+'-notes.txt')
        self.receipt=self.folder.parent/(self.folder.name+'-receipt.json')
        self.notes.write_text('Release notes — UTF-8',encoding='utf-8')
        self.addCleanup(lambda:self.notes.unlink(missing_ok=True))
        self.addCleanup(lambda:self.receipt.unlink(missing_ok=True))

    def test_lost_responses_reconcile_and_publish_only_once(self):
        self.operation_inputs();gh=self.world()
        gh.lose_create=gh.lose_upload=gh.lose_patch=True
        self.m.operate('draft',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(len(gh.assets),26)
        self.assertEqual(sum(k=='create' for k,v in gh.mutations),1)
        self.m.operate('draft',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(sum(k=='upload' for k,v in gh.mutations),26)
        gh.ci_ok=False
        with self.assertRaises(self.m.Refused):self.m.operate('publish',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(sum(k=='publish' for k,v in gh.mutations),0)
        gh.ci_ok=True
        receipt=self.m.operate('publish',self.folder,self.notes,self.receipt,gh)
        self.assertTrue(receipt['published'])
        self.assertEqual(gh.mutations[-1],('publish',{'draft':False,'prerelease':False,'make_latest':'false'}))
        self.m.operate('publish',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(sum(k=='publish' for k,v in gh.mutations),1)
        before=len(gh.mutations)
        with self.assertRaises(self.m.Refused):self.m.operate('draft',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(len(gh.mutations),before)

    def test_created_draft_omitted_from_collection_uses_persisted_id(self):
        self.operation_inputs();gh=self.world()
        original=gh.listing
        gh.listing=lambda route: [] if route=='releases?per_page=100' else original(route)
        self.m.operate('draft',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(len(gh.assets),26)
        self.m.operate('publish',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(sum(k=='create' for k,v in gh.mutations),1)
        self.assertEqual(sum(k=='publish' for k,v in gh.mutations),1)

    def test_unresolved_create_never_blindly_reposts(self):
        self.operation_inputs();gh=self.world();gh.orphan_create=True
        for _ in range(2):
            with self.assertRaises(self.m.Refused):self.m.operate('draft',self.folder,self.notes,self.receipt,gh)
        self.assertEqual(sum(k=='create' for k,v in gh.mutations),1)

    def test_verify_is_read_only_and_incomplete_draft_cannot_publish(self):
        self.operation_inputs();gh=self.world()
        self.m.operate('verify',self.folder,self.notes,self.receipt,gh)
        self.assertFalse(gh.mutations)
        gh.release={'id':123,'tag_name':self.m.TAG,'target_commitish':self.m.SOURCE,
                    'name':self.m.TITLE,'body':self.notes.read_text(),'draft':True,'prerelease':False}
        with self.assertRaises(self.m.Refused):self.m.operate('publish',self.folder,self.notes,self.receipt,gh)
        self.assertFalse(gh.mutations)

    def test_release_and_assets_exact_identity(self):
        release={'id':123,'tag_name':self.m.TAG,'target_commitish':self.m.SOURCE,
                 'name':self.m.TITLE,'body':'notes','draft':True,'prerelease':False}
        self.m.validate_release(release,'notes',True)
        for key,value in [('draft',False),('target_commitish','a'*40),('prerelease',True),('tag_name','wrong')]:
            with self.subTest(key=key),self.assertRaises(self.m.Refused):
                self.m.validate_release({**release,key:value},'notes',True)
        expected=self.m.verify_package(self.folder)
        assets=[{'id':i+1,'name':a['name'],'state':'uploaded','size':a['size'],'digest':'sha256:'+a['sha256']} for i,a in enumerate(expected)]
        self.m.validate_assets(assets,expected,True)
        for changed in (assets[:-1],assets+[assets[0]],[{**assets[0],'digest':'sha256:'+'0'*64},*assets[1:]]):
            with self.assertRaises(self.m.Refused):self.m.validate_assets(changed,expected,True)

if __name__=='__main__':unittest.main()
