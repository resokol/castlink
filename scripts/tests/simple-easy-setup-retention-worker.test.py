import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

WORKER = Path(__file__).resolve().parents[1] / 'simple-easy-setup-retention.py'

class RetentionWorkerTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(WORKER.is_file(), 'Linux-side Windows retention worker is missing')
        spec = importlib.util.spec_from_file_location('windows_retention', WORKER)
        self.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.m)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name) / ('castlink-easy-' + '1' * 32)
        self.folder.mkdir()
        self.iid = '11111111-1111-1111-1111-111111111111'
        self.a, self.b, self.c = ['castlink-easy-web:' + x * 40 for x in 'abc']
        self.ident = 'sha256:' + '1' * 64
        self.record = dict(schemaVersion=1, owner='castlink-windows-retention-v1', installationId=self.iid,
                           folder=str(self.folder), daemonId='fixture-engine', successfulImageSets=[dict(commit='c'*40, images=[self.c]), dict(commit='b'*40, images=[self.b])],
                           images=[dict(tag=t, id=self.ident, preexisting=False) for t in (self.a,self.b,self.c)], parents=[], archives=[])
        self.removed=[]
        def docker(args):
            if args[:2] == ['image','inspect']:
                return json.dumps(dict(Id=self.ident, Parent='', RootFS=dict(Layers=[self.ident]), RepoTags=[self.a,self.b,self.c], RepoDigests=[]))
            if args[:2] == ['image','rm']:
                self.assertEqual(args[2], '--no-prune'); self.removed.append(args[3]); return ''
            if args[0] in ('ps', 'volume'): return ''
            self.fail('Unexpected Docker command: '+repr(args))
        self.m.docker=docker
    def test_retains_current_and_previous_tags_with_same_image_identity(self):
        self.m.cleanup(self.folder, self.record)
        self.assertEqual(self.removed,[self.a])
    def test_changed_and_preexisting_images_are_retained(self):
        self.record['images'][0]['id']='sha256:'+'2'*64
        self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
        self.record['images'][0].update(id=self.ident,preexisting=True)
        self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
    def test_sibling_success_history_is_protected(self):
        sibling=self.folder.parent/('castlink-easy-'+'2'*32);sibling.mkdir()
        other=dict(self.record,folder=str(sibling),installationId='22222222-2222-2222-2222-222222222222',successfulImageSets=[dict(commit='a'*40,images=[self.a])])
        (sibling/'.castlink-retention.json').write_text(json.dumps(other))
        self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
    def test_mixed_installer_sibling_rollback_references_only_add_protection(self):
        for kind in ('web','native','windows-owned'):
            with self.subTest(kind=kind):
                sibling=self.folder.parent/('castlink-easy-'+'2'*32)
                sibling.mkdir(exist_ok=True)
                for path in sibling.iterdir():path.unlink()
                iid='22222222-2222-2222-2222-222222222222'
                if kind=='web':
                    value=dict(schemaVersion=1,installationId=iid,current=[dict(tag=self.c,id=self.ident)],previous=[dict(tag=self.a,id=self.ident)],owned=[])
                    path=sibling/'.castlink-retention.json'
                elif kind=='native':
                    value=dict(schemaVersion=1,images=[],parents=[],successfulReleases=[dict(commit='a'*40,images=dict(web=self.a))])
                    path=sibling/'.castlink-image-ownership.json'
                    (sibling/'.castlink-install.json').write_text(json.dumps(dict(owner='castlink-linux-compose-v1',installationId=iid,project='castlink-linux-'+'2'*32)))
                else:
                    value=dict(schemaVersion=1,installationId=iid,successfulImageSets=[dict(commit='a'*40,images=[self.a])],images=[])
                    path=sibling/'.castlink-owned.json'
                path.write_text(json.dumps(value))
                self.removed.clear()
                self.m.cleanup(self.folder,json.loads(json.dumps(self.record)))
                self.assertEqual(self.removed,[])
    def test_lease_blocks_cleanup_and_releases_after_exit(self):
        with self.m.operation_lock(self.folder):
            with self.assertRaisesRegex(ValueError,'operation'):
                with self.m.operation_lock(self.folder): pass
        with self.m.operation_lock(self.folder): pass
    def test_archive_cleanup_requires_receipted_hash_and_keeps_manual_files(self):
        import hashlib
        good=self.folder/'release.tar.gz';good.write_bytes(b'owned')
        manual=self.folder/'manual-backup.zip';manual.write_bytes(b'manual')
        self.record['archives']=[dict(path='release.tar.gz',sha256=hashlib.sha256(b'owned').hexdigest())]
        self.m.cleanup(self.folder,self.record)
        self.assertFalse(good.exists());self.assertTrue(manual.exists())
    def test_malformed_alias_observation_keeps_protected_identity(self):
        base=self.m.docker
        def docker(args):
            out=base(args)
            if args[:2]==['image','inspect']:
                value=json.loads(out);value['RepoTags']='incomplete';return json.dumps(value)
            return out
        self.m.docker=docker
        self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
    def test_stopped_container_exact_tag_is_retained(self):
        base=self.m.docker
        def docker(args):
            if args==['ps','-aq','--filter','ancestor='+self.a]: return 'stopped'
            if args==['inspect','stopped','--format','{{.Config.Image}}']: return self.a
            return base(args)
        self.m.docker=docker
        self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
    def test_incomplete_protected_root_prevents_any_removal(self):
        base=self.m.docker
        def docker(args):
            out=base(args)
            if args[:2]==['image','inspect'] and args[2]==self.b:
                value=json.loads(out);value.pop('RootFS');return json.dumps(value)
            return out
        self.m.docker=docker
        with self.assertRaisesRegex(ValueError,'layer'):self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
    def test_previous_release_layer_ancestor_is_retained(self):
        base=self.m.docker
        def docker(args):
            out=base(args)
            if args[:2]==['image','inspect']:
                value=json.loads(out)
                if args[2]==self.a:
                    value['Id']='sha256:'+'2'*64
                else:
                    value['RootFS']['Layers'].append('sha256:'+'3'*64)
                return json.dumps(value)
            return out
        self.record['images'][0]['id']='sha256:'+'2'*64
        self.m.docker=docker
        self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])
    def test_foreign_or_incomplete_backup_files_are_never_retired(self):
        backups=self.folder/'backups';backups.mkdir()
        one=backups/'20261025-010000-deadbeef';one.mkdir()
        (one/'postgres.dump').write_text('incomplete unknown backup')
        self.m.cleanup(self.folder,self.record)
        self.assertTrue((one/'postgres.dump').exists())

    def test_inactive_docker_service_is_not_socket_activated(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        (self.folder/self.m.RECORD).write_text(json.dumps(self.record))
        def forbidden(args): self.fail('Inactive Docker daemon was contacted')
        self.m.docker=forbidden
        with patch('sys.argv',[str(WORKER),'--folder',str(self.folder),'--installation-id',self.iid]), patch.object(self.m.subprocess,'run',return_value=SimpleNamespace(returncode=3)):
            self.m.main()
    def test_replaced_daemon_refuses_cleanup_before_image_deletion(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        (self.folder/self.m.RECORD).write_text(json.dumps(self.record))
        self.m.docker=lambda args: 'replacement-engine'
        with patch('sys.argv',[str(WORKER),'--folder',str(self.folder),'--installation-id',self.iid]), patch.object(self.m.subprocess,'run',return_value=SimpleNamespace(returncode=0)):
            with self.assertRaisesRegex(ValueError,'daemon identity'):
                self.m.main()
        self.assertEqual(self.removed,[])
    def test_installation_identity_is_checked_before_deletion(self):
        self.record['installationId']='22222222-2222-2222-2222-222222222222'
        with self.assertRaises(ValueError):self.m.cleanup(self.folder,self.record)
        self.assertEqual(self.removed,[])

if __name__=='__main__':unittest.main()
